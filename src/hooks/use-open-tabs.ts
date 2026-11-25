import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { filterClearableTabs } from '@/lib/tabs/clearFilter';
import {
  normalizeRawTabs,
  type OpenTabInfo,
  partitionSidebarTabs,
  type RawTabLike,
} from '@/lib/tabs/session-filter';
import {
  getCurrentTabId,
  getRawCurrentWindowTabs,
} from '@/lib/tabs/tab-actions';

export interface OpenTabsState {
  tabs: OpenTabInfo[];
  pinnedTabs: OpenTabInfo[];
  regularTabs: OpenTabInfo[];
  clearableCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useOpenTabs(): OpenTabsState {
  const [rawTabs, setRawTabs] = useState<RawTabLike[]>([]);
  const [currentTabId, setCurrentTabId] = useState<number | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextRaw, nextCurrentId] = await Promise.all([
        getRawCurrentWindowTabs(),
        getCurrentTabId(),
      ]);
      setRawTabs(nextRaw);
      setCurrentTabId(nextCurrentId);
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

  const tabs = useMemo(() => normalizeRawTabs(rawTabs), [rawTabs]);
  const { pinned, regular } = useMemo(() => partitionSidebarTabs(tabs), [tabs]);
  const clearableCount = useMemo(
    () => filterClearableTabs(rawTabs, { currentTabId }).tabsToClose.length,
    [rawTabs, currentTabId],
  );

  return {
    tabs,
    pinnedTabs: pinned,
    regularTabs: regular,
    clearableCount,
    loading,
    refresh,
  };
}
