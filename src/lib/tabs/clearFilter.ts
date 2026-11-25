import { extractDomain } from '@/lib/utils/url';

export interface ClearableTabLike {
  id?: number;
  url?: string;
  pendingUrl?: string;
  title?: string;
  pinned?: boolean;
  audible?: boolean;
}

export interface ClearFilterOptions {
  currentTabId?: number;
}

export interface ClearFilterResult<
  T extends ClearableTabLike = ClearableTabLike,
> {
  tabsToClose: (T & { id: number })[];
  skippedPinnedCount: number;
  skippedAudibleCount: number;
  wouldCloseWindow: boolean;
}

export interface RestorableTabSnapshot {
  url: string;
  title: string;
}

const RESTRICTED_RESTORE_PROTOCOLS = new Set([
  'chrome:',
  'chrome-extension:',
  'edge:',
  'about:',
  'devtools:',
  'view-source:',
  'javascript:',
  'data:',
]);

/**
 * Filters a window's tabs down to safe-to-close candidates while protecting
 * pinned tabs, audible tabs (music/video/calls), and the current Stash tab.
 */
export function filterClearableTabs<T extends ClearableTabLike>(
  tabs: readonly T[],
  options: ClearFilterOptions = {},
): ClearFilterResult<T> {
  const { currentTabId } = options;
  const tabsToClose: (T & { id: number })[] = [];
  let skippedPinnedCount = 0;
  let skippedAudibleCount = 0;

  for (const tab of tabs) {
    if (typeof tab.id !== 'number') {
      continue;
    }

    if (currentTabId !== undefined && tab.id === currentTabId) {
      continue;
    }

    const isPinned = tab.pinned === true;
    const isAudible = tab.audible === true;

    if (isPinned) {
      skippedPinnedCount += 1;
    }
    if (isAudible) {
      skippedAudibleCount += 1;
    }
    if (isPinned || isAudible) {
      continue;
    }

    tabsToClose.push(tab as T & { id: number });
  }

  const wouldCloseWindow =
    tabsToClose.length > 0 && tabsToClose.length === tabs.length;

  return {
    tabsToClose,
    skippedPinnedCount,
    skippedAudibleCount,
    wouldCloseWindow,
  };
}

export function isRestorableTabUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    const proto = parsed.protocol.toLowerCase();
    if (RESTRICTED_RESTORE_PROTOCOLS.has(proto)) {
      return false;
    }
    return proto === 'http:' || proto === 'https:' || proto === 'file:';
  } catch {
    return false;
  }
}

export function extractRestorableTabs(
  tabs: readonly ClearableTabLike[],
): RestorableTabSnapshot[] {
  const snapshots: RestorableTabSnapshot[] = [];
  for (const tab of tabs) {
    const rawUrl = (tab.url || tab.pendingUrl || '').trim();
    if (!isRestorableTabUrl(rawUrl)) continue;
    snapshots.push({
      url: rawUrl,
      title: tab.title?.trim() || extractDomain(rawUrl),
    });
  }
  return snapshots;
}

export function formatClearTabsToast(
  clearedCount: number,
  skippedPinnedCount: number,
  skippedAudibleCount: number,
): string {
  const base = `Cleared ${clearedCount} ${clearedCount === 1 ? 'tab' : 'tabs'}`;
  if (skippedAudibleCount > 0 && skippedPinnedCount > 0) {
    return `${base} (audible/pinned kept)`;
  }
  if (skippedAudibleCount > 0) {
    return `${base} (audible kept)`;
  }
  if (skippedPinnedCount > 0) {
    return `${base} (pinned kept)`;
  }
  return base;
}
