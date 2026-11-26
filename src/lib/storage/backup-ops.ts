import type { ImportedBookmarkFolder } from '@/lib/import-export/bookmarks-html';
import {
  mergeBundleIntoSnapshot,
  prepareReplaceSnapshot,
  type RestoreStats,
} from '@/lib/import-export/bundle';
import {
  collectionsStorage,
  customThemesStorage,
  linksStorage,
  rulesStorage,
  settingsStorage,
  spacesStorage,
} from '@/lib/storage/items';
import type {
  SaveSessionResult,
  StashSnapshot,
} from '@/lib/storage/repo-types';
import { pruneEmptyAutoInboxesInStorage } from '@/lib/storage/spaces-ops';
import {
  recordDeletedCollectionInTrash,
  recordDeletedLinksInTrash,
  removeRestoredLinksFromTrash,
} from '@/lib/storage/trash-ops';
import {
  formatSessionName,
  type OpenTabInfo,
  selectEligibleTabsForClose,
  selectTabsForSession,
} from '@/lib/tabs/session-filter';
import { normalizeImportedCustomTheme } from '@/lib/themes/theme-validator';
import {
  type Collection,
  type LinkItem,
  type StashExportBundle,
  TAB_GROUP_COLORS,
  type ThemeDefinition,
} from '@/lib/types/stash';
import { insertLinkAtIndexInList, sortByOrder } from '@/lib/utils/ordering';
import { extractDomain, normalizeUrlForComparison } from '@/lib/utils/url';

export interface BookmarkImportSummary {
  collectionsCreated: number;
  collectionsMatched: number;
  linksAdded: number;
  linksSkipped: number;
}

export async function restoreBundleInStorage(
  current: StashSnapshot,
  bundle: StashExportBundle,
  mode: 'merge' | 'replace',
): Promise<RestoreStats> {
  const { snapshot, stats } =
    mode === 'replace'
      ? prepareReplaceSnapshot(bundle)
      : mergeBundleIntoSnapshot(current, bundle);

  await Promise.all([
    spacesStorage.setValue(snapshot.spaces),
    collectionsStorage.setValue(snapshot.collections),
    linksStorage.setValue(snapshot.links),
    rulesStorage.setValue(snapshot.rules),
    settingsStorage.setValue(snapshot.settings),
    customThemesStorage.setValue(snapshot.customThemes),
  ]);

  return stats;
}

export async function importBookmarkFoldersInStorage(
  folders: readonly ImportedBookmarkFolder[],
): Promise<BookmarkImportSummary> {
  const [existingCollections, existingLinks] = await Promise.all([
    collectionsStorage.getValue(),
    linksStorage.getValue(),
  ]);

  const now = new Date().toISOString();
  const collections = sortByOrder(existingCollections);
  const collectionByLowerName = new Map<string, Collection>(
    collections.map((c) => [c.name.trim().toLowerCase(), c]),
  );

  const urlsByCollection = new Map<string, Set<string>>();
  const countByCollection = new Map<string, number>();
  for (const link of existingLinks) {
    const urlSet = urlsByCollection.get(link.collectionId) ?? new Set<string>();
    urlSet.add(normalizeUrlForComparison(link.url));
    urlsByCollection.set(link.collectionId, urlSet);
    countByCollection.set(
      link.collectionId,
      (countByCollection.get(link.collectionId) ?? 0) + 1,
    );
  }

  const nextLinks: LinkItem[] = [...existingLinks];
  let collectionsCreated = 0;
  let collectionsMatched = 0;
  let linksAdded = 0;
  let linksSkipped = 0;

  for (const folder of folders) {
    if (folder.links.length === 0) continue;
    const key = folder.name.trim().toLowerCase();
    let targetCollection = collectionByLowerName.get(key);

    if (targetCollection) {
      collectionsMatched += 1;
    } else {
      const color =
        TAB_GROUP_COLORS[collections.length % TAB_GROUP_COLORS.length] ??
        'green';
      targetCollection = {
        id: crypto.randomUUID(),
        name: folder.name.trim() || 'Imported Bookmarks',
        color,
        order: collections.length,
        collapsed: false,
        createdAt: now,
        updatedAt: now,
      };
      collections.push(targetCollection);
      collectionByLowerName.set(key, targetCollection);
      collectionsCreated += 1;
    }

    const urlSet =
      urlsByCollection.get(targetCollection.id) ?? new Set<string>();
    urlsByCollection.set(targetCollection.id, urlSet);

    for (const item of folder.links) {
      const normalized = normalizeUrlForComparison(item.url);
      if (urlSet.has(normalized)) {
        linksSkipped += 1;
        continue;
      }
      urlSet.add(normalized);
      const order = countByCollection.get(targetCollection.id) ?? 0;
      countByCollection.set(targetCollection.id, order + 1);
      nextLinks.push({
        id: crypto.randomUUID(),
        collectionId: targetCollection.id,
        url: item.url,
        title: item.title,
        note: '',
        tags: [],
        faviconUrl: item.faviconUrl,
        order,
        createdAt: now,
        updatedAt: now,
      });
      linksAdded += 1;
    }
  }

  await Promise.all([
    collectionsStorage.setValue(collections),
    linksStorage.setValue(nextLinks),
  ]);

  return {
    collectionsCreated,
    collectionsMatched,
    linksAdded,
    linksSkipped,
  };
}

export async function saveCustomThemeInStorage(
  theme: ThemeDefinition,
): Promise<ThemeDefinition> {
  const normalized = normalizeImportedCustomTheme(theme);
  const existing = await customThemesStorage.getValue();
  const filtered = existing.filter((item) => item.id !== normalized.id);
  await customThemesStorage.setValue([...filtered, normalized]);
  return normalized;
}

export async function deleteCustomThemeInStorage(id: string): Promise<boolean> {
  const existing = await customThemesStorage.getValue();
  const remaining = existing.filter((item) => item.id !== id);
  if (remaining.length === existing.length) return false;
  await customThemesStorage.setValue(remaining);
  return true;
}

export async function saveSessionCollectionInStorage(
  tabs: readonly OpenTabInfo[],
  options: {
    includePinned: boolean;
    name?: string;
    date?: Date;
    spaceId?: string;
  },
): Promise<SaveSessionResult | null> {
  const closableTabs = selectEligibleTabsForClose(tabs, {
    includePinned: options.includePinned,
  });
  const savedTabs = selectTabsForSession(closableTabs, {
    includePinned: options.includePinned,
  });
  if (savedTabs.length === 0) return null;

  const [existingCollections, existingLinks] = await Promise.all([
    collectionsStorage.getValue(),
    linksStorage.getValue(),
  ]);

  const timestamp = new Date().toISOString();
  const sessionCollection: Collection = {
    id: crypto.randomUUID(),
    name: options.name?.trim() || formatSessionName(options.date),
    color: 'blue',
    spaceId: options.spaceId,
    order: 0,
    collapsed: false,
    isSession: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const shiftedCollections = [
    sessionCollection,
    ...sortByOrder(existingCollections).map((col, idx) => ({
      ...col,
      order: idx + 1,
    })),
  ];

  const sessionLinks: LinkItem[] = savedTabs.map((tab, idx) => ({
    id: crypto.randomUUID(),
    collectionId: sessionCollection.id,
    url: tab.url,
    title: tab.title || extractDomain(tab.url),
    note: '',
    tags: [],
    faviconUrl: tab.favIconUrl,
    order: idx,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  await Promise.all([
    collectionsStorage.setValue(shiftedCollections),
    linksStorage.setValue([...existingLinks, ...sessionLinks]),
  ]);

  return {
    collection: sessionCollection,
    links: sessionLinks,
    savedTabs,
    closableTabs,
  };
}

export async function deleteCollectionInStorage(id: string): Promise<boolean> {
  const [existingCollections, existingLinks] = await Promise.all([
    collectionsStorage.getValue(),
    linksStorage.getValue(),
  ]);
  const targetCollection = existingCollections.find((item) => item.id === id);
  if (!targetCollection) return false;

  const remaining = existingCollections.filter((item) => item.id !== id);
  const reindexed = sortByOrder(remaining).map((item, index) => ({
    ...item,
    order: index,
  }));
  const removedLinks = existingLinks.filter((link) => link.collectionId === id);
  const remainingLinks = existingLinks.filter(
    (link) => link.collectionId !== id,
  );

  await Promise.all([
    collectionsStorage.setValue(reindexed),
    linksStorage.setValue(remainingLinks),
    recordDeletedCollectionInTrash(targetCollection, removedLinks),
  ]);
  return true;
}

export async function deleteLinkInStorage(id: string): Promise<boolean> {
  const [collections, existing] = await Promise.all([
    collectionsStorage.getValue(),
    linksStorage.getValue(),
  ]);
  const target = existing.find((item) => item.id === id);
  if (!target) return false;

  const remaining = existing.filter((item) => item.id !== id);
  const sameColSorted = sortByOrder(
    remaining.filter((item) => item.collectionId === target.collectionId),
  );
  const orderById = new Map(sameColSorted.map((item, idx) => [item.id, idx]));
  const finalLinks = remaining.map((item) => {
    const nextOrder = orderById.get(item.id);
    return nextOrder !== undefined ? { ...item, order: nextOrder } : item;
  });
  const colNames = new Map(collections.map((c) => [c.id, c.name]));

  await Promise.all([
    linksStorage.setValue(finalLinks),
    recordDeletedLinksInTrash([target], colNames),
  ]);
  await pruneEmptyAutoInboxesInStorage([target.collectionId], finalLinks);
  return true;
}

/**
 * Restores a previously deleted LinkItem with its exact ID, metadata, tags,
 * tagsLocked state, and original collection order position (for 5-second Undo).
 */
export async function restoreLinkInStorage(
  link: LinkItem,
): Promise<LinkItem | null> {
  const [collections, existingLinks] = await Promise.all([
    collectionsStorage.getValue(),
    linksStorage.getValue(),
  ]);

  if (!collections.some((c) => c.id === link.collectionId)) {
    return null;
  }

  const normalized = normalizeUrlForComparison(link.url);
  const duplicate = existingLinks.find(
    (item) =>
      item.id === link.id ||
      (item.collectionId === link.collectionId &&
        normalizeUrlForComparison(item.url) === normalized),
  );
  if (duplicate) return null;

  const nextLinks = insertLinkAtIndexInList(existingLinks, link, link.order);
  await Promise.all([
    linksStorage.setValue(nextLinks),
    removeRestoredLinksFromTrash([link.id]),
  ]);
  return nextLinks.find((item) => item.id === link.id) ?? link;
}

/**
 * Batch-deletes multiple links in a single storage write, re-indexing orders
 * cleanly per affected collection and returning the removed snapshots for Undo.
 */
export async function deleteLinksInStorage(
  ids: readonly string[],
): Promise<LinkItem[]> {
  if (ids.length === 0) return [];
  const idSet = new Set(ids);
  const [collections, existing] = await Promise.all([
    collectionsStorage.getValue(),
    linksStorage.getValue(),
  ]);

  const removed: LinkItem[] = [];
  const remaining: LinkItem[] = [];
  const affectedCollections = new Set<string>();

  for (const item of existing) {
    if (idSet.has(item.id)) {
      removed.push(item);
      affectedCollections.add(item.collectionId);
    } else {
      remaining.push(item);
    }
  }

  if (removed.length === 0) return [];

  const orderById = new Map<string, number>();
  for (const colId of affectedCollections) {
    const colSorted = sortByOrder(
      remaining.filter((item) => item.collectionId === colId),
    );
    for (let idx = 0; idx < colSorted.length; idx++) {
      const link = colSorted[idx];
      if (link) orderById.set(link.id, idx);
    }
  }

  const finalLinks = remaining.map((item) => {
    const nextOrder = orderById.get(item.id);
    return nextOrder !== undefined ? { ...item, order: nextOrder } : item;
  });
  const colNames = new Map(collections.map((c) => [c.id, c.name]));

  await Promise.all([
    linksStorage.setValue(finalLinks),
    recordDeletedLinksInTrash(sortByOrder(removed), colNames),
  ]);
  await pruneEmptyAutoInboxesInStorage(
    Array.from(affectedCollections),
    finalLinks,
  );
  return sortByOrder(removed);
}

/**
 * Restores a batch of previously deleted LinkItems in a single storage write,
 * preserving exact IDs, collections, notes, tags, tagsLocked, and original order.
 */
export async function restoreLinksInStorage(
  linksToRestore: readonly LinkItem[],
): Promise<LinkItem[]> {
  if (linksToRestore.length === 0) return [];

  const [collections, existingLinks] = await Promise.all([
    collectionsStorage.getValue(),
    linksStorage.getValue(),
  ]);
  const validCollectionIds = new Set(collections.map((c) => c.id));

  let working = [...existingLinks];
  const restoredIds = new Set<string>();

  // Restore in ascending original order per collection so indices land accurately
  const orderedToRestore = [...linksToRestore].sort(
    (a, b) => a.order - b.order,
  );

  for (const link of orderedToRestore) {
    if (!validCollectionIds.has(link.collectionId)) continue;
    const normalized = normalizeUrlForComparison(link.url);
    const duplicate = working.find(
      (item) =>
        item.id === link.id ||
        (item.collectionId === link.collectionId &&
          normalizeUrlForComparison(item.url) === normalized),
    );
    if (duplicate) continue;

    working = insertLinkAtIndexInList(working, link, link.order);
    restoredIds.add(link.id);
  }

  if (restoredIds.size === 0) return [];

  await Promise.all([
    linksStorage.setValue(working),
    removeRestoredLinksFromTrash(Array.from(restoredIds)),
  ]);
  return working.filter((item) => restoredIds.has(item.id));
}
