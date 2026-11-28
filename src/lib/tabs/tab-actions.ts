import {
  extractRestorableTabs,
  filterClearableTabs,
  type RestorableTabSnapshot,
} from '@/lib/tabs/clearFilter';
import {
  isStashableUrl,
  normalizeRawTabs,
  type OpenTabInfo,
  type RawTabLike,
} from '@/lib/tabs/session-filter';
import type { Collection, LinkItem, TabGroupColor } from '@/lib/types/stash';

export async function getRawCurrentWindowTabs(): Promise<RawTabLike[]> {
  if (typeof browser === 'undefined' || !browser.tabs?.query) {
    return [];
  }
  return browser.tabs.query({ currentWindow: true });
}

export async function getCurrentTabId(): Promise<number | undefined> {
  if (typeof browser === 'undefined' || !browser.tabs?.getCurrent) {
    return undefined;
  }
  try {
    const current = await browser.tabs.getCurrent();
    return typeof current?.id === 'number' ? current.id : undefined;
  } catch {
    return undefined;
  }
}

export async function getCurrentWindowTabs(): Promise<OpenTabInfo[]> {
  const tabs = await getRawCurrentWindowTabs();
  return normalizeRawTabs(tabs);
}

export interface ClearWindowTabsOutcome {
  clearedCount: number;
  skippedPinnedCount: number;
  skippedAudibleCount: number;
  restorableTabs: RestorableTabSnapshot[];
}

/**
 * Re-queries current window tabs right before closing, protects pinned/audible/current tabs,
 * guarantees the window stays open if triggered from Side Panel, and returns a transient
 * restorable snapshot for the 8-second Reopen toast.
 */
export async function executeClearWindowTabs(): Promise<ClearWindowTabsOutcome> {
  if (
    typeof browser === 'undefined' ||
    !browser.tabs?.query ||
    !browser.tabs?.remove
  ) {
    return {
      clearedCount: 0,
      skippedPinnedCount: 0,
      skippedAudibleCount: 0,
      restorableTabs: [],
    };
  }

  const [rawTabs, currentTabId] = await Promise.all([
    browser.tabs.query({ currentWindow: true }),
    getCurrentTabId(),
  ]);

  const {
    tabsToClose,
    skippedPinnedCount,
    skippedAudibleCount,
    wouldCloseWindow,
  } = filterClearableTabs(rawTabs, { currentTabId });

  if (tabsToClose.length === 0) {
    return {
      clearedCount: 0,
      skippedPinnedCount,
      skippedAudibleCount,
      restorableTabs: [],
    };
  }

  const restorableTabs = extractRestorableTabs(tabsToClose);
  const idsToClose = tabsToClose.map((t) => t.id);

  if (wouldCloseWindow && browser.tabs.create) {
    await browser.tabs.create({ active: true });
  }

  await closeTabs(idsToClose);

  return {
    clearedCount: idsToClose.length,
    skippedPinnedCount,
    skippedAudibleCount,
    restorableTabs,
  };
}

export async function reopenTabSnapshots(
  snapshots: readonly RestorableTabSnapshot[],
): Promise<number> {
  if (
    snapshots.length === 0 ||
    typeof browser === 'undefined' ||
    !browser.tabs?.create
  ) {
    return 0;
  }

  let reopened = 0;
  for (const snapshot of snapshots) {
    if (!isStashableUrl(snapshot.url)) continue;
    try {
      await browser.tabs.create({ url: snapshot.url.trim(), active: false });
      reopened += 1;
    } catch {
      // Skip any URL Chrome rejects (e.g., restricted internal schemes)
    }
  }
  return reopened;
}

export async function switchToTab(tabId: number): Promise<void> {
  if (typeof browser === 'undefined' || !browser.tabs?.update) return;
  await browser.tabs.update(tabId, { active: true });
}

export async function closeTabs(tabIds: readonly number[]): Promise<void> {
  if (tabIds.length === 0) return;
  if (typeof browser === 'undefined' || !browser.tabs?.remove) return;
  try {
    await browser.tabs.remove([...tabIds]);
  } catch {
    // If any tab was already closed during an animation sweep, close remaining tabs individually
    for (const id of tabIds) {
      try {
        await browser.tabs.remove(id);
      } catch {
        // Tab already closed or unavailable; continue closing the rest
      }
    }
  }
}

export async function openLinksInNamedTabGroup(
  title: string,
  links: readonly LinkItem[],
  color: TabGroupColor = 'green',
): Promise<number> {
  if (links.length === 0) return 0;
  if (typeof browser === 'undefined' || !browser.tabs?.create) return 0;

  const createdIds: number[] = [];
  for (const link of links) {
    if (!isStashableUrl(link.url)) continue;
    try {
      const created = await browser.tabs.create({
        url: link.url.trim(),
        active: false,
      });
      if (typeof created.id === 'number') {
        createdIds.push(created.id);
      }
    } catch {
      // Skip any URL Chrome rejects so remaining tabs still open and group
    }
  }

  if (createdIds.length === 0) return 0;

  const firstId = createdIds[0];
  if (firstId !== undefined && browser.tabs.group) {
    try {
      const groupId = await browser.tabs.group({
        tabIds: [firstId, ...createdIds.slice(1)],
      });
      if (browser.tabGroups?.update) {
        await browser.tabGroups.update(groupId, { title, color });
      }
    } catch (error: unknown) {
      console.warn('Stash: failed to group woken tabs', error);
    }
  }

  return createdIds.length;
}

export async function wakeUpCollectionInTabGroup(
  collection: Collection,
  links: readonly LinkItem[],
): Promise<number> {
  return openLinksInNamedTabGroup(collection.name, links, collection.color);
}

export async function wakeUpCollectionInNewWindow(
  links: readonly LinkItem[],
): Promise<number> {
  if (links.length === 0) return 0;
  if (typeof browser === 'undefined' || !browser.windows?.create) return 0;

  const urls = links
    .map((link) => link.url.trim())
    .filter((url) => isStashableUrl(url));
  if (urls.length === 0) return 0;
  await browser.windows.create({ url: urls, focused: true });
  return urls.length;
}
