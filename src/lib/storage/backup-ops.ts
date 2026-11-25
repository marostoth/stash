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
} from '@/lib/storage/items';
import type {
  SaveSessionResult,
  StashSnapshot,
} from '@/lib/storage/repo-types';
import {
  formatSessionName,
  type OpenTabInfo,
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
import { sortByOrder } from '@/lib/utils/ordering';
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
  options: { includePinned: boolean; name?: string; date?: Date },
): Promise<SaveSessionResult | null> {
  const savedTabs = selectTabsForSession(tabs, {
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

  return { collection: sessionCollection, links: sessionLinks, savedTabs };
}
