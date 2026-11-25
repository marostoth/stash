import { useCallback, useEffect, useState } from 'react';
import {
  isStashableUrl,
  normalizeRawTabs,
  type OpenTabInfo,
} from '@/lib/tabs/session-filter';

export interface ActiveTabState {
  activeTab: OpenTabInfo | null;
  rawUrl: string | null;
  loading: boolean;
}

export function useActiveTab(): ActiveTabState {
  const [activeTab, setActiveTab] = useState<OpenTabInfo | null>(null);
  const [rawUrl, setRawUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const queryActive = useCallback(async () => {
    if (typeof browser === 'undefined' || !browser.tabs?.query) {
      setLoading(false);
      return;
    }
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) {
        setActiveTab(null);
        setRawUrl(null);
        return;
      }
      const url = tab.url || tab.pendingUrl || null;
      setRawUrl(url);
      if (url && isStashableUrl(url)) {
        const [normalized] = normalizeRawTabs([tab]);
        const next = normalized ?? null;
        setActiveTab((prev) => {
          if (
            prev &&
            next &&
            prev.id === next.id &&
            prev.url === next.url &&
            prev.title === next.title &&
            prev.favIconUrl === next.favIconUrl
          ) {
            return prev;
          }
          return next;
        });
      } else {
        setActiveTab((prev) => (prev === null ? prev : null));
      }
    } catch (error: unknown) {
      console.warn('Stash: failed to read active tab', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void queryActive();
    if (typeof browser === 'undefined' || !browser.tabs) return;

    const handleChange = () => {
      void queryActive();
    };

    const handleUpdated = (
      _tabId: number,
      changeInfo: {
        status?: string;
        url?: string;
        title?: string;
        favIconUrl?: string;
      },
      tab: { active?: boolean },
    ) => {
      if (!tab.active) return;
      if (
        changeInfo.url === undefined &&
        changeInfo.title === undefined &&
        changeInfo.favIconUrl === undefined &&
        changeInfo.status !== 'complete'
      ) {
        return;
      }
      void queryActive();
    };

    browser.tabs.onActivated.addListener(handleChange);
    browser.tabs.onUpdated.addListener(handleUpdated);
    browser.windows?.onFocusChanged?.addListener(handleChange);

    return () => {
      browser.tabs.onActivated.removeListener(handleChange);
      browser.tabs.onUpdated.removeListener(handleUpdated);
      browser.windows?.onFocusChanged?.removeListener(handleChange);
    };
  }, [queryActive]);

  return { activeTab, rawUrl, loading };
}
