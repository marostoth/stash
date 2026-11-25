import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type OpenTabInfo,
  partitionSidebarTabs,
} from '@/lib/tabs/session-filter';
import { getCurrentWindowTabs } from '@/lib/tabs/tab-actions';

export interface OpenTabsState {
  tabs: OpenTabInfo[];
  pinnedTabs: OpenTabInfo[];
  regularTabs: OpenTabInfo[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useOpenTabs(): OpenTabsState {
  const [tabs, setTabs] = useState<OpenTabInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getCurrentWindowTabs();
      setTabs(next);
    } catch (error: unknown) {
      console.warn('Stash: failed to query open tabs', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    if (typeof browser === 'undefined' || !browser.tabs) {
      return;
    }

    const scheduleRefresh = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void refresh();
      }, 60);
    };

    browser.tabs.onCreated.addListener(scheduleRefresh);
    browser.tabs.onRemoved.addListener(scheduleRefresh);
    browser.tabs.onUpdated.addListener(scheduleRefresh);
    browser.tabs.onMoved.addListener(scheduleRefresh);
    browser.tabs.onActivated.addListener(scheduleRefresh);
    browser.tabs.onAttached.addListener(scheduleRefresh);
    browser.tabs.onDetached.addListener(scheduleRefresh);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      browser.tabs.onCreated.removeListener(scheduleRefresh);
      browser.tabs.onRemoved.removeListener(scheduleRefresh);
      browser.tabs.onUpdated.removeListener(scheduleRefresh);
      browser.tabs.onMoved.removeListener(scheduleRefresh);
      browser.tabs.onActivated.removeListener(scheduleRefresh);
      browser.tabs.onAttached.removeListener(scheduleRefresh);
      browser.tabs.onDetached.removeListener(scheduleRefresh);
    };
  }, [refresh]);

  const { pinned, regular } = useMemo(() => partitionSidebarTabs(tabs), [tabs]);

  return {
    tabs,
    pinnedTabs: pinned,
    regularTabs: regular,
    loading,
    refresh,
  };
}
