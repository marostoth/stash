import {
  getPreviewEntry,
  type PreviewCacheEntry,
  putPreviewEntry,
} from '@/lib/previews/cache';
import {
  isPreviewableUrl,
  shouldCaptureTab,
} from '@/lib/previews/capture-guard';
import { parseOgFromHtml } from '@/lib/previews/og-parser';
import { hasVisualPreviewPermission } from '@/lib/previews/permissions';
import { stashRepo } from '@/lib/storage/repo';
import { normalizeUrlForComparison } from '@/lib/utils/url';

const CAPTURE_SETTLE_DELAY_MS = 1200;
const CAPTURE_MIN_INTERVAL_MS = 3000;
const SCREENSHOT_FRESHNESS_MS = 10 * 60 * 1000;
const OG_FETCH_TIMEOUT_MS = 4000;
const OG_MAX_BYTES = 65_536;
const OG_POSITIVE_TTL_MS = 24 * 60 * 60 * 1000;
const OG_NEGATIVE_COOLDOWN_MS = 30 * 60 * 1000;
const MAX_PREVIEW_WIDTH = 480;

let lastCaptureTimestamp = 0;
let pendingCaptureTimer: ReturnType<typeof setTimeout> | null = null;
const inFlightOgFetches = new Map<string, Promise<PreviewCacheEntry | null>>();

async function compressDataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  if (
    typeof createImageBitmap !== 'function' ||
    typeof OffscreenCanvas === 'undefined'
  ) {
    return null;
  }

  try {
    const response = await fetch(dataUrl);
    const rawBlob = await response.blob();
    const bitmap = await createImageBitmap(rawBlob);
    try {
      const scale =
        bitmap.width > MAX_PREVIEW_WIDTH ? MAX_PREVIEW_WIDTH / bitmap.width : 1;
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, width, height);

      try {
        return await canvas.convertToBlob({
          type: 'image/webp',
          quality: 0.72,
        });
      } catch {
        return await canvas.convertToBlob({
          type: 'image/jpeg',
          quality: 0.78,
        });
      }
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

async function canRunVisualPreviews(): Promise<boolean> {
  const settings = await stashRepo.getSettings();
  if (!settings.visualPreviewsEnabled) return false;
  return hasVisualPreviewPermission();
}

export async function captureTabScreenshotIfEligible(
  tabId: number,
): Promise<void> {
  if (!(await canRunVisualPreviews())) return;

  const now = Date.now();
  if (now - lastCaptureTimestamp < CAPTURE_MIN_INTERVAL_MS) return;

  try {
    const tab = await browser.tabs.get(tabId);
    if (!tab.active || tab.status !== 'complete' || !tab.url) return;
    if (!shouldCaptureTab({ url: tab.url, incognito: tab.incognito })) return;

    const existing = await getPreviewEntry(tab.url);
    if (
      existing?.screenshotBlob &&
      now - existing.updatedAt < SCREENSHOT_FRESHNESS_MS
    ) {
      return;
    }

    if (typeof browser.tabs.captureVisibleTab !== 'function') return;

    lastCaptureTimestamp = Date.now();
    const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
    });
    const compressed = await compressDataUrlToBlob(dataUrl);
    if (!compressed) return;

    await putPreviewEntry(tab.url, {
      screenshotBlob: compressed,
      ogImageUrl: existing?.ogImageUrl,
      ogTitle: existing?.ogTitle,
      ogDescription: existing?.ogDescription,
      source: 'screenshot',
      updatedAt: Date.now(),
    });
  } catch {
    // Silent fail on restricted tabs, unfocused windows, or active drag
  }
}

export function scheduleTabScreenshotCapture(tabId: number): void {
  if (pendingCaptureTimer) {
    clearTimeout(pendingCaptureTimer);
  }
  pendingCaptureTimer = setTimeout(() => {
    pendingCaptureTimer = null;
    void captureTabScreenshotIfEligible(tabId);
  }, CAPTURE_SETTLE_DELAY_MS);
}

async function readFirstHtmlChunk(response: Response): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    return text.slice(0, OG_MAX_BYTES);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let totalBytes = 0;
  let html = '';

  try {
    while (totalBytes < OG_MAX_BYTES) {
      const { value, done } = await reader.read();
      if (done || !value) break;
      const remaining = OG_MAX_BYTES - totalBytes;
      const slice =
        value.byteLength > remaining ? value.subarray(0, remaining) : value;
      totalBytes += slice.byteLength;
      html += decoder.decode(slice, { stream: true });
      if (/<\/head\s*>/i.test(html)) break;
    }
    html += decoder.decode();
  } finally {
    void reader.cancel().catch(() => {
      // Ignore stream cancel errors
    });
  }

  return html;
}

export async function fetchAndCacheOgPreview(
  rawUrl: string,
): Promise<PreviewCacheEntry | null> {
  if (!isPreviewableUrl(rawUrl)) return null;
  if (!(await canRunVisualPreviews())) return null;

  const key = normalizeUrlForComparison(rawUrl);
  const existing = await getPreviewEntry(rawUrl);
  const now = Date.now();

  if (existing?.screenshotBlob) return existing;
  if (existing && existing.source === 'og') {
    const hasMetadata = Boolean(
      existing.ogImageUrl || existing.ogDescription || existing.ogTitle,
    );
    const ttl = hasMetadata ? OG_POSITIVE_TTL_MS : OG_NEGATIVE_COOLDOWN_MS;
    if (now - existing.updatedAt < ttl) {
      return existing;
    }
  }

  const pending = inFlightOgFetches.get(key);
  if (pending) return pending;

  const task = (async (): Promise<PreviewCacheEntry | null> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OG_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(rawUrl, {
        method: 'GET',
        redirect: 'follow',
        credentials: 'omit',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        },
      });

      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.toLowerCase().includes('text/html')) {
        await putPreviewEntry(rawUrl, { source: 'og', updatedAt: Date.now() });
        return getPreviewEntry(rawUrl);
      }

      const html = await readFirstHtmlChunk(response);
      const parsed = parseOgFromHtml(html, response.url || rawUrl);

      await putPreviewEntry(rawUrl, {
        ogTitle: parsed.ogTitle,
        ogDescription: parsed.ogDescription,
        ogImageUrl: parsed.ogImageUrl,
        source: 'og',
        updatedAt: Date.now(),
      });
      return getPreviewEntry(rawUrl);
    } catch {
      await putPreviewEntry(rawUrl, { source: 'og', updatedAt: Date.now() });
      return null;
    } finally {
      clearTimeout(timeoutId);
      inFlightOgFetches.delete(key);
    }
  })();

  inFlightOgFetches.set(key, task);
  return task;
}
