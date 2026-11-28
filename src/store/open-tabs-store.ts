import { create } from 'zustand';
import type { OpenTabInfo } from '@/lib/tabs/session-filter';

interface OpenTabsStoreState {
  tabs: readonly OpenTabInfo[];
  pinnedTabs: readonly OpenTabInfo[];
  regularTabs: readonly OpenTabInfo[];
  clearableCount: number;
  setOpenTabsSnapshot: (snapshot: {
    tabs: readonly OpenTabInfo[];
    pinnedTabs: readonly OpenTabInfo[];
    regularTabs: readonly OpenTabInfo[];
    clearableCount: number;
  }) => void;
}

/**
 * Isolates reactive Chrome Open Tab snapshots from the root `Workbench` so
 * background tab title/favicon updates only re-render `OpenTabsSidebar` (and
 * the count badge in `TopBar` when tab count actually changes).
 */
export const useOpenTabsStore = create<OpenTabsStoreState>((set) => ({
  tabs: [],
  pinnedTabs: [],
  regularTabs: [],
  clearableCount: 0,
  setOpenTabsSnapshot: (snapshot) => set(snapshot),
}));
