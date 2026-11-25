import {
  classifyLinkHealth,
  extractTitleAndSnippetFromHtml,
  type HealthClassification,
  type LinkHealthStatus,
} from '@/lib/health/classifier';
import { isLocalDevUrl } from '@/lib/health/clutter';
import { hasVisualPreviewPermission } from '@/lib/previews/permissions';
import { normalizeUrlForComparison } from '@/lib/utils/url';

export const HEALTH_SCAN_PORT_NAME = 'stash-health-scan';

const MAX_CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 6000;
const MAX_HTML_SNIPPET_BYTES = 16_384;

export interface HealthUrlScanItem {
  normalizedUrl: string;
  originalUrl: string;
  finalUrl?: string;
  httpStatus?: number;
  title?: string;
  snippet?: string;
  status: LinkHealthStatus;
  reason: string;
  suspiciousForAi?: boolean;
}

export type HealthPortClientMessage =
  | { type: 'start'; urls: string[] }
  | { type: 'cancel' };

export type HealthPortServerMessage =
  | { type: 'progress'; scanned: number; total: number }
  | {
      type: 'complete';
      canceled: boolean;
      results: HealthUrlScanItem[];
    }
  | { type: 'error'; message: string };

async function readBoundedHtml(response: Response): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    return text.slice(0, MAX_HTML_SNIPPET_BYTES);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let totalBytes = 0;
  let html = '';

  try {
    while (totalBytes < MAX_HTML_SNIPPET_BYTES) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      const remaining = MAX_HTML_SNIPPET_BYTES - totalBytes;
      const slice =
        value.byteLength > remaining ? value.subarray(0, remaining) : value;
      totalBytes += slice.byteLength;
      html += decoder.decode(slice, { stream: true });
    }
    html += decoder.decode();
  } finally {
    void reader.cancel().catch(() => {
      // Ignore stream cancellation noise
    });
  }

  return html;
}

function isHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Deduplicates input URLs by normalized form and excludes non-http(s) and local/dev URLs.
 */
export function buildUniqueScanTargets(
  rawUrls: readonly string[],
): Array<{ normalizedUrl: string; url: string }> {
  const seen = new Set<string>();
  const targets: Array<{ normalizedUrl: string; url: string }> = [];

  for (const raw of rawUrls) {
    if (!isHttpUrl(raw) || isLocalDevUrl(raw)) continue;
    const normalizedUrl = normalizeUrlForComparison(raw);
    if (seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);
    targets.push({ normalizedUrl, url: raw });
  }

  return targets;
}

async function probeSingleUrl(
  target: { normalizedUrl: string; url: string },
  scanSignal: AbortSignal,
): Promise<HealthUrlScanItem | null> {
  if (scanSignal.aborted) return null;

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const onScanAbort = () => controller.abort();
  scanSignal.addEventListener('abort', onScanAbort, { once: true });

  try {
    const response = await fetch(target.url, {
      method: 'GET',
      redirect: 'follow',
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
      },
    });

    const contentType = (
      response.headers.get('content-type') ?? ''
    ).toLowerCase();
    let title: string | undefined;
    let snippet: string | undefined;

    if (response.status === 200 && contentType.includes('text/html')) {
      const html = await readBoundedHtml(response);
      const extracted = extractTitleAndSnippetFromHtml(html);
      title = extracted.title;
      snippet = extracted.snippet;
    } else {
      void response.body?.cancel().catch(() => {
        // Free underlying network stream immediately
      });
    }

    const classification: HealthClassification = classifyLinkHealth({
      originalUrl: target.url,
      finalUrl: response.url || target.url,
      status: response.status,
      title,
      snippet,
    });

    return {
      normalizedUrl: target.normalizedUrl,
      originalUrl: target.url,
      finalUrl: response.url || target.url,
      httpStatus: response.status,
      title,
      snippet,
      status: classification.status,
      reason: classification.reason,
      suspiciousForAi: classification.suspiciousForAi,
    };
  } catch (error: unknown) {
    if (scanSignal.aborted && !timedOut) {
      return null;
    }
    const errText = timedOut
      ? 'timeout'
      : error instanceof Error
        ? error.message
        : 'network_error';
    const classification = classifyLinkHealth({
      originalUrl: target.url,
      error: errText,
    });

    return {
      normalizedUrl: target.normalizedUrl,
      originalUrl: target.url,
      status: classification.status,
      reason: classification.reason,
    };
  } finally {
    clearTimeout(timeoutId);
    scanSignal.removeEventListener('abort', onScanAbort);
  }
}

/**
 * Throttled concurrency pool (max 5 in-flight requests) for background scanning.
 */
export async function runHealthUrlScan(
  urls: readonly string[],
  options: {
    signal: AbortSignal;
    onProgress?: (scanned: number, total: number) => void;
  },
): Promise<{ canceled: boolean; results: HealthUrlScanItem[] }> {
  const targets = buildUniqueScanTargets(urls);
  const total = targets.length;
  if (total === 0) {
    return { canceled: false, results: [] };
  }

  let nextIndex = 0;
  let scanned = 0;
  const results: HealthUrlScanItem[] = [];

  options.onProgress?.(0, total);

  const workerCount = Math.min(MAX_CONCURRENCY, total);
  const workers = Array.from({ length: workerCount }, async () => {
    while (!options.signal.aborted) {
      const idx = nextIndex;
      nextIndex += 1;
      const target = targets[idx];
      if (!target) break;

      const item = await probeSingleUrl(target, options.signal);
      if (item) {
        results.push(item);
        scanned += 1;
        options.onProgress?.(scanned, total);
      }
    }
  });

  await Promise.all(workers);

  return {
    canceled: options.signal.aborted,
    results,
  };
}

/**
 * Attaches the on-demand Health Check port listener in the MV3 background worker.
 * Never scans automatically — only runs when the UI sends a 'start' message.
 */
export function registerHealthScanPortListener(): void {
  if (typeof browser === 'undefined' || !browser.runtime?.onConnect) return;

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== HEALTH_SCAN_PORT_NAME) return;

    let scanController: AbortController | null = null;
    let disconnected = false;

    const safePost = (msg: HealthPortServerMessage) => {
      if (disconnected) return;
      try {
        port.postMessage(msg);
      } catch {
        disconnected = true;
      }
    };

    port.onDisconnect.addListener(() => {
      disconnected = true;
      scanController?.abort();
    });

    port.onMessage.addListener((raw: unknown) => {
      if (!raw || typeof raw !== 'object') return;
      const message = raw as Partial<HealthPortClientMessage>;

      if (message.type === 'cancel') {
        scanController?.abort();
        return;
      }

      if (message.type === 'start' && Array.isArray(message.urls)) {
        const urls = message.urls.filter(
          (u): u is string => typeof u === 'string',
        );
        scanController?.abort();
        const controller = new AbortController();
        scanController = controller;

        void (async () => {
          const granted = await hasVisualPreviewPermission();
          if (!granted) {
            safePost({
              type: 'error',
              message:
                'Site access permission is required to check link status.',
            });
            return;
          }

          const outcome = await runHealthUrlScan(urls, {
            signal: controller.signal,
            onProgress: (scanned, total) => {
              safePost({ type: 'progress', scanned, total });
            },
          });

          safePost({
            type: 'complete',
            canceled: outcome.canceled,
            results: outcome.results,
          });
        })();
      }
    });
  });
}
