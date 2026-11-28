import { storage } from '#imports';
import {
  collectionsStorage,
  linksStorage,
  spacesStorage,
  trashStorage,
} from '@/lib/storage/items';
import {
  buildTrashWithDeletedCollection,
  buildTrashWithDeletedLinks,
  buildTrashWithoutRestoredLinks,
} from '@/lib/storage/trash-ops';
import {
  type Collection,
  DEFAULT_SPACE_ID,
  type LinkItem,
  type TrashEntry,
} from '@/lib/types/stash';
import { insertLinkAtIndexInList, sortByOrder } from '@/lib/utils/ordering';
import { normalizeUrlForComparison } from '@/lib/utils/url';

function pruneEmptyAutoInboxesInList(
  collections: readonly Collection[],
  candidateIds: readonly string[],
  nextLinks: readonly LinkItem[],
): Collection[] | null {
  if (candidateIds.length === 0) return null;
  const candidateSet = new Set(candidateIds);
  const nonEmptyIds = new Set(nextLinks.map((l) => l.collectionId));
  let prunedAny = false;
  const remaining = collections.filter((col) => {
    const shouldPrune =
      col.isAutoInbox === true &&
      candidateSet.has(col.id) &&
      !nonEmptyIds.has(col.id);
    if (shouldPrune) prunedAny = true;
    return !shouldPrune;
  });
  if (!prunedAny) return null;
  return sortByOrder(remaining).map((col, idx) => ({ ...col, order: idx }));
}

function buildRecoveredInboxCollection(
  collectionId: string,
  trashEntries: readonly TrashEntry[],
  fallbackSpaceId: string,
  now: string,
): Collection {
  const trashMatch = trashEntries.find(
    (entry) =>
      entry.kind === 'link' && entry.link.collectionId === collectionId,
  );
  const name =
    trashMatch?.kind === 'link' && trashMatch.collectionName?.trim()
      ? trashMatch.collectionName.trim()
      : 'Inbox';
  return {
    id: collectionId,
    name,
    color: 'cyan',
    icon: 'inbox',
    spaceId: fallbackSpaceId,
    order: 0,
    collapsed: false,
    isAutoInbox: name.toLowerCase() === 'inbox' ? true : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteCollectionInStorage(id: string): Promise<boolean> {
  const [existingCollections, existingLinks, existingTrash] = await Promise.all(
    [
      collectionsStorage.getValue(),
      linksStorage.getValue(),
      trashStorage.getValue(),
    ],
  );
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
  const nextTrash = buildTrashWithDeletedCollection(
    existingTrash,
    targetCollection,
    removedLinks,
  );

  await storage.setItems([
    { item: collectionsStorage, value: reindexed },
    { item: linksStorage, value: remainingLinks },
    { item: trashStorage, value: nextTrash },
  ]);
  return true;
}

export async function deleteLinkInStorage(id: string): Promise<boolean> {
  const [collections, existing, existingTrash] = await Promise.all([
    collectionsStorage.getValue(),
    linksStorage.getValue(),
    trashStorage.getValue(),
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
  const nextTrash = buildTrashWithDeletedLinks(
    existingTrash,
    [target],
    colNames,
  );
  const prunedCollections = pruneEmptyAutoInboxesInList(
    collections,
    [target.collectionId],
    finalLinks,
  );

  const writes: Parameters<typeof storage.setItems>[0] = [
    { item: linksStorage, value: finalLinks },
    { item: trashStorage, value: nextTrash },
  ];
  if (prunedCollections) {
    writes.push({ item: collectionsStorage, value: prunedCollections });
  }
  await storage.setItems(writes);
  return true;
}

/**
 * Restores a previously deleted LinkItem with its exact ID, metadata, tags,
 * tagsLocked state, and original collection order position (for 5-second Undo).
 * If its Auto-Inbox or parent collection was pruned, re-creates the collection
 * atomically so Undo never silently drops the link.
 */
export async function restoreLinkInStorage(
  link: LinkItem,
): Promise<LinkItem | null> {
  const [spaces, existingCollections, existingLinks, existingTrash] =
    await Promise.all([
      spacesStorage.getValue(),
      collectionsStorage.getValue(),
      linksStorage.getValue(),
      trashStorage.getValue(),
    ]);

  let nextCollections: Collection[] | null = null;
  if (!existingCollections.some((c) => c.id === link.collectionId)) {
    const recovered = buildRecoveredInboxCollection(
      link.collectionId,
      existingTrash,
      spaces[0]?.id ?? DEFAULT_SPACE_ID,
      new Date().toISOString(),
    );
    nextCollections = [recovered, ...sortByOrder(existingCollections)].map(
      (col, idx) => ({ ...col, order: idx }),
    );
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
  const nextTrash = buildTrashWithoutRestoredLinks(existingTrash, [link.id]);
  const writes: Parameters<typeof storage.setItems>[0] = [
    { item: linksStorage, value: nextLinks },
    { item: trashStorage, value: nextTrash },
  ];
  if (nextCollections) {
    writes.push({ item: collectionsStorage, value: nextCollections });
  }
  await storage.setItems(writes);
  return nextLinks.find((item) => item.id === link.id) ?? link;
}

/**
 * Batch-deletes multiple links in a single atomic storage write, re-indexing
 * orders cleanly per affected collection and returning removed snapshots for Undo.
 */
export async function deleteLinksInStorage(
  ids: readonly string[],
): Promise<LinkItem[]> {
  if (ids.length === 0) return [];
  const idSet = new Set(ids);
  const [collections, existing, existingTrash] = await Promise.all([
    collectionsStorage.getValue(),
    linksStorage.getValue(),
    trashStorage.getValue(),
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
  const sortedRemoved = sortByOrder(removed);
  const colNames = new Map(collections.map((c) => [c.id, c.name]));
  const nextTrash = buildTrashWithDeletedLinks(
    existingTrash,
    sortedRemoved,
    colNames,
  );
  const prunedCollections = pruneEmptyAutoInboxesInList(
    collections,
    Array.from(affectedCollections),
    finalLinks,
  );

  const writes: Parameters<typeof storage.setItems>[0] = [
    { item: linksStorage, value: finalLinks },
    { item: trashStorage, value: nextTrash },
  ];
  if (prunedCollections) {
    writes.push({ item: collectionsStorage, value: prunedCollections });
  }
  await storage.setItems(writes);
  return sortedRemoved;
}

/**
 * Restores a batch of previously deleted LinkItems in a single atomic write,
 * recreating any pruned Auto-Inbox collections so Undo never loses items.
 */
export async function restoreLinksInStorage(
  linksToRestore: readonly LinkItem[],
): Promise<LinkItem[]> {
  if (linksToRestore.length === 0) return [];

  const [spaces, existingCollections, existingLinks, existingTrash] =
    await Promise.all([
      spacesStorage.getValue(),
      collectionsStorage.getValue(),
      linksStorage.getValue(),
      trashStorage.getValue(),
    ]);
  const validCollectionIds = new Set(existingCollections.map((c) => c.id));
  const recoveredCollections: Collection[] = [];
  const fallbackSpaceId = spaces[0]?.id ?? DEFAULT_SPACE_ID;
  const now = new Date().toISOString();

  let working = [...existingLinks];
  const restoredIds = new Set<string>();
  const orderedToRestore = [...linksToRestore].sort(
    (a, b) => a.order - b.order,
  );

  for (const link of orderedToRestore) {
    if (!validCollectionIds.has(link.collectionId)) {
      const recovered = buildRecoveredInboxCollection(
        link.collectionId,
        existingTrash,
        fallbackSpaceId,
        now,
      );
      recoveredCollections.push(recovered);
      validCollectionIds.add(recovered.id);
    }
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

  const nextTrash = buildTrashWithoutRestoredLinks(
    existingTrash,
    Array.from(restoredIds),
  );
  const writes: Parameters<typeof storage.setItems>[0] = [
    { item: linksStorage, value: working },
    { item: trashStorage, value: nextTrash },
  ];
  if (recoveredCollections.length > 0) {
    const mergedCols = [
      ...recoveredCollections,
      ...sortByOrder(existingCollections),
    ].map((col, idx) => ({ ...col, order: idx }));
    writes.push({ item: collectionsStorage, value: mergedCols });
  }
  await storage.setItems(writes);
  return working.filter((item) => restoredIds.has(item.id));
}
