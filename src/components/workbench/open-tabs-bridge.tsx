import { useEffect } from 'react';
import { useOpenTabs } from '@/hooks/use-open-tabs';
import { useOpenTabsStore } from '@/store/open-tabs-store';

/**
 * Zero-DOM subscriber that bridges `useOpenTabs()` into `useOpenTabsStore`
 * without triggering full `Workbench` / collection-board re-renders on every
 * Chrome tab event.
 */
export function OpenTabsBridge() {
  const { tabs, pinnedTabs, regularTabs, clearableCount } = useOpenTabs();

  useEffect(() => {
    useOpenTabsStore.getState().setOpenTabsSnapshot({
      tabs,
      pinnedTabs,
      regularTabs,
      clearableCount,
    });
  }, [tabs, pinnedTabs, regularTabs, clearableCount]);

  return null;
}
