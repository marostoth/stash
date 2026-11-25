import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { verifySuspiciousPageWithNano } from '@/lib/health/nano-tiebreaker';
import {
  HEALTH_SCAN_PORT_NAME,
  type HealthPortServerMessage,
  type HealthUrlScanItem,
} from '@/lib/health/scanner';
import {
  hasVisualPreviewPermission,
  requestVisualPreviewPermission,
} from '@/lib/previews/permissions';
import type { LinkItem } from '@/lib/types/stash';
import { normalizeUrlForComparison } from '@/lib/utils/url';

export interface ScanProgressState {
  scanned: number;
  total: number;
  refiningAi?: boolean;
}

export function useHealthScan(open: boolean, links: readonly LinkItem[]) {
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
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
  const aiAbortRef = useRef<AbortController | null>(null);
  const linksRef = useRef(links);
  linksRef.current = links;

  const stopActiveScan = useCallback(() => {
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

  const refreshPermission = useCallback(async () => {
    const granted = await hasVisualPreviewPermission();
    setHasPermission(granted);
    if (granted) setPermissionError(null);
  }, []);

  useEffect(() => {
    if (!open) {
      stopActiveScan();
      setScanning(false);
      return;
    }
    void refreshPermission();
    const onFocus = () => void refreshPermission();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      stopActiveScan();
    };
  }, [open, refreshPermission, stopActiveScan]);

  const applyCompletedResults = useCallback(
    async (items: readonly HealthUrlScanItem[], canceled: boolean) => {
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
      setScanning(false);
      setProgress(null);
    },
    [],
  );

  const launchBackgroundScan = useCallback(() => {
    if (typeof browser === 'undefined' || !browser.runtime?.connect) {
      toast.error('Extension background scanner is unavailable in this view.');
      return;
    }

    stopActiveScan();
    setScanning(true);
    setWasCanceled(false);
    setPermissionError(null);
    setProgress({ scanned: 0, total: linksRef.current.length });

    const port = browser.runtime.connect({ name: HEALTH_SCAN_PORT_NAME });
    portRef.current = port;

    port.onMessage.addListener((raw: unknown) => {
      if (!raw || typeof raw !== 'object') return;
      const msg = raw as HealthPortServerMessage;

      if (msg.type === 'progress') {
        setProgress({ scanned: msg.scanned, total: msg.total });
        return;
      }

      if (msg.type === 'error') {
        stopActiveScan();
        setScanning(false);
        setProgress(null);
        setPermissionError(msg.message);
        toast.error(msg.message);
        return;
      }

      if (msg.type === 'complete') {
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
      if (portRef.current === port) {
        portRef.current = null;
        setScanning(false);
      }
    });

    port.postMessage({
      type: 'start',
      urls: linksRef.current.map((l) => l.url),
    });
  }, [applyCompletedResults, stopActiveScan]);

  const startScan = () => {
    if (scanning) return;
    if (links.length === 0) {
      toast.info('Your library has no saved links to scan yet.');
      return;
    }

    if (hasPermission) {
      launchBackgroundScan();
      return;
    }

    // Call permissions.request synchronously as the very first statement
    // inside this click handler so Chrome preserves the user gesture.
    const requestPromise = requestVisualPreviewPermission();
    setPermissionError(null);
    void requestPromise.then((result) => {
      setHasPermission(result.granted);
      if (!result.granted) {
        const message =
          result.error ??
          'Site access permission was not granted. Local clutter & duplicate checks remain available below.';
        setPermissionError(message);
        toast.info(message);
        return;
      }
      launchBackgroundScan();
    });
  };

  const cancelScan = () => {
    aiAbortRef.current?.abort();
    if (portRef.current) {
      try {
        portRef.current.postMessage({ type: 'cancel' });
      } catch {
        stopActiveScan();
        setScanning(false);
      }
    } else {
      setScanning(false);
      setProgress(null);
    }
  };

  return {
    hasPermission,
    permissionError,
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
