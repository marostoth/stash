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
        setActiveTab(normalized ?? null);
      } else {
        setActiveTab(null);
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

    browser.tabs.onActivated.addListener(handleChange);
    browser.tabs.onUpdated.addListener(handleChange);
    browser.windows?.onFocusChanged?.addListener(handleChange);

    return () => {
      browser.tabs.onActivated.removeListener(handleChange);
      browser.tabs.onUpdated.removeListener(handleChange);
      browser.windows?.onFocusChanged?.removeListener(handleChange);
    };
  }, [queryActive]);

  return { activeTab, rawUrl, loading };
}
