import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { verifySuspiciousPageWithNano } from '@/lib/health/nano-tiebreaker';
import {
  buildUniqueScanTargets,
  HEALTH_SCAN_PORT_NAME,
  type HealthPortServerMessage,
  type HealthUrlScanItem,
  runHealthUrlScan,
} from '@/lib/health/scanner';
import {
  hasVisualPreviewPermission,
  requestVisualPreviewPermission,
} from '@/lib/previews/permissions';
import type { LinkItem } from '@/lib/types/stash';
import { normalizeUrlForComparison } from '@/lib/utils/url';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';
import { useUiStore } from '@/store/ui-store';

export interface ScanProgressState {
  scanned: number;
  total: number;
  refiningAi?: boolean;
}

function readRuntimeLastError(): string | undefined {
  try {
    const rt = browser.runtime as { lastError?: { message?: string } };
    return rt?.lastError?.message;
  } catch {
    return undefined;
  }
}

export function useHealthScan(open: boolean, links: readonly LinkItem[]) {
  const [hasPermission, setHasPermission] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [wasCanceled, setWasCanceled] = useState(false);
  const [progress, setProgress] = useState<ScanProgressState | null>(null);
  const [urlResults, setUrlResults] = useState<
    Record<string, HealthUrlScanItem>
  >({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const portRef = useRef<ReturnType<typeof browser.runtime.connect> | null>(
    null,
  );
  const localScanAbortRef = useRef<AbortController | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const userCanceledRef = useRef(false);
  const linksRef = useRef(links);
  linksRef.current = links;
  const openRef = useRef(open);
  openRef.current = open;
  const cancelScanRef = useRef<() => void>(() => {});

  const stopActiveScan = useCallback(() => {
    localScanAbortRef.current?.abort();
    localScanAbortRef.current = null;
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    if (portRef.current) {
      try {
        portRef.current.postMessage({ type: 'cancel' });
      } catch {
        // Ignore already-disconnected port
      }
      try {
        portRef.current.disconnect();
      } catch {
        // Ignore disconnect noise
      }
      portRef.current = null;
    }
  }, []);

  // Only abort active scan if the entire workbench unmounts
  useEffect(() => {
    return () => {
      stopActiveScan();
      useBackgroundJobsStore.getState().removeJob('health-check');
    };
  }, [stopActiveScan]);

  const refreshPermission = useCallback(async () => {
    const granted = await hasVisualPreviewPermission();
    setHasPermission(granted);
    if (granted) setScanError(null);
  }, []);

  useEffect(() => {
    if (!open) return;

    // Clear "ready" notification pill once the user opens Health Check to review
    const job = useBackgroundJobsStore
      .getState()
      .jobs.find((j) => j.id === 'health-check');
    if (job?.status === 'ready') {
      useBackgroundJobsStore.getState().removeJob('health-check');
    }

    void refreshPermission();
    const onFocus = () => void refreshPermission();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [open, refreshPermission]);

  // Keep bottom-right background tray synced with live scan progress
  useEffect(() => {
    if (!scanning) return;
    useBackgroundJobsStore.getState().upsertJob({
      id: 'health-check',
      title: 'Library Health Check',
      detail: progress?.refiningAi
        ? 'Refining suspicious pages with AI...'
        : progress
          ? `Scanning ${progress.scanned} / ${progress.total} links`
          : 'Starting scan...',
      status: 'running',
      progress:
        progress && !progress.refiningAi
          ? { current: progress.scanned, total: progress.total }
          : null,
      usesNano: Boolean(progress?.refiningAi),
      onReopen: () => useUiStore.getState().openHealthCheck(),
      onCancel: () => cancelScanRef.current(),
    });
  }, [scanning, progress]);

  const applyCompletedResults = useCallback(
    async (items: readonly HealthUrlScanItem[], canceled: boolean) => {
      try {
        const byNormalized: Record<string, HealthUrlScanItem> = {};
        for (const item of items) {
          byNormalized[item.normalizedUrl] = item;
        }

        // Optional on-device Gemini Nano tie-breaker for suspicious 200 OK pages
        const suspicious = items.filter((item) => item.suspiciousForAi);
        if (!canceled && suspicious.length > 0) {
          const aiController = new AbortController();
          aiAbortRef.current = aiController;
          setProgress({
            scanned: items.length,
            total: items.length,
            refiningAi: true,
          });

          for (const candidate of suspicious) {
            if (aiController.signal.aborted) break;
            const verdict = await verifySuspiciousPageWithNano(
              {
                url: candidate.finalUrl ?? candidate.originalUrl,
                title: candidate.title,
                snippet: candidate.snippet,
              },
              aiController.signal,
            );
            if (verdict?.isDead) {
              byNormalized[candidate.normalizedUrl] = {
                ...candidate,
                status: 'dead',
                reason: verdict.reason,
                suspiciousForAi: false,
              };
            }
          }
          aiAbortRef.current = null;
        }

        // Pre-check Confirmed Dead only; Needs a Quick Look & Clutter stay unchecked
        const preChecked = new Set<string>();
        for (const link of linksRef.current) {
          const normalized = normalizeUrlForComparison(link.url);
          if (byNormalized[normalized]?.status === 'dead') {
            preChecked.add(link.id);
          }
        }

        setUrlResults(byNormalized);
        setSelectedIds(preChecked);
        setHasScanned(true);
        setWasCanceled(canceled);

        const jobsStore = useBackgroundJobsStore.getState();
        if (!canceled && !openRef.current) {
          let flaggedCount = 0;
          for (const item of Object.values(byNormalized)) {
            if (item.status === 'dead' || item.status === 'needs_review') {
              flaggedCount += 1;
            }
          }
          jobsStore.upsertJob({
            id: 'health-check',
            title: 'Health Check ready',
            detail:
              flaggedCount > 0
                ? `${flaggedCount} ${flaggedCount === 1 ? 'link' : 'links'} flagged · Click to review`
                : 'Scan complete · All links look healthy',
            status: 'ready',
            reopenLabel: 'Review',
            onReopen: () => useUiStore.getState().openHealthCheck(),
          });
        } else {
          jobsStore.removeJob('health-check');
        }
      } catch (error: unknown) {
        console.error('[Stash HealthCheck] Failed processing results:', error);
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to process scan results.';
        setScanError(message);
        useBackgroundJobsStore.getState().removeJob('health-check');
        toast.error(message);
      } finally {
        setScanning(false);
        setProgress(null);
      }
    },
    [],
  );

  const runInPageFallbackScan = useCallback(
    async (urls: readonly string[], reason: string) => {
      console.error(
        '[Stash HealthCheck] Falling back to in-page scan after port disconnect:',
        reason,
      );
      const controller = new AbortController();
      localScanAbortRef.current = controller;

      try {
        const outcome = await runHealthUrlScan(urls, {
          signal: controller.signal,
          onProgress: (scanned, total) => {
            setProgress({ scanned, total });
          },
        });
        localScanAbortRef.current = null;
        await applyCompletedResults(outcome.results, outcome.canceled);
      } catch (error: unknown) {
        localScanAbortRef.current = null;
        console.error('[Stash HealthCheck] In-page scan failed:', error);
        const message =
          error instanceof Error
            ? error.message
            : 'Health scan failed unexpectedly.';
        setScanError(message);
        setScanning(false);
        setProgress(null);
        useBackgroundJobsStore.getState().removeJob('health-check');
        toast.error(message);
      }
    },
    [applyCompletedResults],
  );

  const launchBackgroundScan = useCallback(() => {
    const rawUrls = linksRef.current.map((l) => l.url);
    const uniqueTargets = buildUniqueScanTargets(rawUrls);

    stopActiveScan();
    userCanceledRef.current = false;
    setScanning(true);
    setWasCanceled(false);
    setScanError(null);
    setProgress({ scanned: 0, total: uniqueTargets.length });

    if (uniqueTargets.length === 0) {
      void applyCompletedResults([], false);
      return;
    }

    if (typeof browser === 'undefined' || !browser.runtime?.connect) {
      void runInPageFallbackScan(
        rawUrls,
        'browser.runtime.connect is unavailable',
      );
      return;
    }

    let settled = false;
    let receivedAnyMessage = false;

    try {
      const port = browser.runtime.connect({ name: HEALTH_SCAN_PORT_NAME });
      portRef.current = port;

      port.onMessage.addListener((raw: unknown) => {
        if (!raw || typeof raw !== 'object') return;
        receivedAnyMessage = true;
        const msg = raw as HealthPortServerMessage;

        if (msg.type === 'progress') {
          setProgress({ scanned: msg.scanned, total: msg.total });
          return;
        }

        if (msg.type === 'error') {
          settled = true;
          stopActiveScan();
          setScanning(false);
          setProgress(null);
          setScanError(msg.message);
          useBackgroundJobsStore.getState().removeJob('health-check');
          console.error('[Stash HealthCheck] Scanner error:', msg.message);
          toast.error(msg.message);
          return;
        }

        if (msg.type === 'complete') {
          settled = true;
          try {
            port.disconnect();
          } catch {
            // Ignore disconnect noise
          }
          portRef.current = null;
          void applyCompletedResults(msg.results, msg.canceled);
        }
      });

      port.onDisconnect.addListener(() => {
        const lastError = readRuntimeLastError();
        if (portRef.current === port) {
          portRef.current = null;
        }
        if (settled) return;
        settled = true;

        if (userCanceledRef.current) {
          setScanning(false);
          setProgress(null);
          useBackgroundJobsStore.getState().removeJob('health-check');
          return;
        }

        const disconnectReason =
          lastError ||
          'Background service worker disconnected before the scan finished.';

        // If the background port dropped before delivering any messages (e.g.
        // inactive/restarting worker), seamlessly fall back to in-page fetch
        // which shares the exact same granted optional_host_permissions.
        if (!receivedAnyMessage) {
          void runInPageFallbackScan(rawUrls, disconnectReason);
          return;
        }

        console.error(
          '[Stash HealthCheck] Background port disconnected mid-scan:',
          disconnectReason,
        );
        setScanError(disconnectReason);
        setScanning(false);
        setProgress(null);
        useBackgroundJobsStore.getState().removeJob('health-check');
        toast.error(`Health scan interrupted: ${disconnectReason}`);
      });

      port.postMessage({
        type: 'start',
        urls: rawUrls,
      });
    } catch (error: unknown) {
      settled = true;
      const reason = error instanceof Error ? error.message : String(error);
      console.error('[Stash HealthCheck] Port startup threw:', error);
      void runInPageFallbackScan(rawUrls, reason);
    }
  }, [applyCompletedResults, runInPageFallbackScan, stopActiveScan]);

  const startScan = () => {
    if (scanning) return;
    if (links.length === 0) {
      const msg = 'Your library has no saved links to scan yet.';
      setScanError(msg);
      toast.info(msg);
      return;
    }

    if (hasPermission) {
      launchBackgroundScan();
      return;
    }

    // Call permissions.request() synchronously as the VERY FIRST statement
    // inside this click handler so Chrome preserves the user gesture.
    const requestPromise = requestVisualPreviewPermission();
    setScanError(null);
    void requestPromise
      .then((result) => {
        setHasPermission(result.granted);
        if (!result.granted) {
          const message =
            result.error ??
            'Site access permission was not granted. Local clutter & duplicate checks remain available below.';
          console.error('[Stash HealthCheck] Permission not granted:', message);
          setScanError(message);
          toast.error(message);
          return;
        }
        launchBackgroundScan();
      })
      .catch((error: unknown) => {
        console.error('[Stash HealthCheck] Permission request failed:', error);
        const message =
          error instanceof Error
            ? error.message
            : 'Could not request site access permission.';
        setScanError(message);
        toast.error(message);
      });
  };

  const cancelScan = useCallback(() => {
    userCanceledRef.current = true;
    localScanAbortRef.current?.abort();
    aiAbortRef.current?.abort();
    useBackgroundJobsStore.getState().removeJob('health-check');
    if (portRef.current) {
      try {
        portRef.current.postMessage({ type: 'cancel' });
      } catch (error: unknown) {
        console.error('[Stash HealthCheck] Cancel postMessage failed:', error);
        stopActiveScan();
        setScanning(false);
        setProgress(null);
      }
    } else if (!localScanAbortRef.current) {
      setScanning(false);
      setProgress(null);
    }
  }, [stopActiveScan]);

  cancelScanRef.current = cancelScan;

  return {
    hasPermission,
    scanError,
    scanning,
    hasScanned,
    wasCanceled,
    progress,
    urlResults,
    selectedIds,
    setSelectedIds,
    startScan,
    cancelScan,
  };
}
