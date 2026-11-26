import {
  collectionsStorage,
  linksStorage,
  spacesStorage,
  trashStorage,
} from '@/lib/storage/items';
import {
  type Collection,
  DEFAULT_SPACE_ID,
  type LinkItem,
  type TrashEntry,
} from '@/lib/types/stash';
import { insertLinkAtIndexInList, sortByOrder } from '@/lib/utils/ordering';
import { normalizeUrlForComparison } from '@/lib/utils/url';

export const TRASH_RETENTION_DAYS = 7;
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const MAX_TRASH_ENTRIES = 200;

export function pruneExpiredTrashEntries(
  entries: readonly TrashEntry[],
  nowMs: number = Date.now(),
): TrashEntry[] {
  return entries
    .filter((entry) => {
      const deletedMs = Date.parse(entry.deletedAt);
      return (
        Number.isFinite(deletedMs) && nowMs - deletedMs <= TRASH_RETENTION_MS
      );
    })
    .slice(0, MAX_TRASH_ENTRIES);
}

export async function getTrashEntriesInStorage(
  nowMs: number = Date.now(),
): Promise<TrashEntry[]> {
  const raw = await trashStorage.getValue();
  const pruned = pruneExpiredTrashEntries(raw, nowMs);
  if (pruned.length !== raw.length) {
    await trashStorage.setValue(pruned);
  }
  return pruned;
}

export function watchTrashEntriesInStorage(
  cb: (entries: TrashEntry[]) => void,
): () => void {
  return trashStorage.watch((next) => cb(pruneExpiredTrashEntries(next)));
}

export async function recordDeletedLinksInTrash(
  links: readonly LinkItem[],
  collectionNameById: ReadonlyMap<string, string>,
  deletedAt: string = new Date().toISOString(),
): Promise<void> {
  if (links.length === 0) return;
  const existing = pruneExpiredTrashEntries(await trashStorage.getValue());
  const additions: TrashEntry[] = links.map((link) => ({
    id: `trash-link:${link.id}:${crypto.randomUUID().slice(0, 6)}`,
    kind: 'link',
    deletedAt,
    collectionName: collectionNameById.get(link.collectionId),
    link: {
      ...link,
      tags: [...link.tags],
      ...(link.product ? { product: { ...link.product } } : {}),
    },
  }));
  await trashStorage.setValue(
    [...additions, ...existing].slice(0, MAX_TRASH_ENTRIES),
  );
}

export async function recordDeletedCollectionInTrash(
  collection: Collection,
  links: readonly LinkItem[],
  deletedAt: string = new Date().toISOString(),
): Promise<void> {
  const existing = pruneExpiredTrashEntries(await trashStorage.getValue());
  const entry: TrashEntry = {
    id: `trash-col:${collection.id}:${crypto.randomUUID().slice(0, 6)}`,
    kind: 'collection',
    deletedAt,
    collection: { ...collection },
    links: sortByOrder(links).map((link) => ({
      ...link,
      tags: [...link.tags],
      ...(link.product ? { product: { ...link.product } } : {}),
    })),
  };
  await trashStorage.setValue([entry, ...existing].slice(0, MAX_TRASH_ENTRIES));
}

export async function removeRestoredLinksFromTrash(
  linkIds: readonly string[],
): Promise<void> {
  if (linkIds.length === 0) return;
  const idSet = new Set(linkIds);
  const existing = await trashStorage.getValue();
  const next = existing.filter(
    (entry) => !(entry.kind === 'link' && idSet.has(entry.link.id)),
  );
  if (next.length !== existing.length) {
    await trashStorage.setValue(next);
  }
}

export interface TrashRestoreResult {
  restoredKind: 'link' | 'collection';
  restoredCount: number;
  label: string;
}

export async function restoreTrashEntryInStorage(
  entryId: string,
): Promise<TrashRestoreResult | null> {
  const entries = await getTrashEntriesInStorage();
  const target = entries.find((e) => e.id === entryId);
  if (!target) return null;

  const [spaces, existingCollections, existingLinks] = await Promise.all([
    spacesStorage.getValue(),
    collectionsStorage.getValue(),
    linksStorage.getValue(),
  ]);

  const remainingTrash = entries.filter((e) => e.id !== entryId);
  const now = new Date().toISOString();

  if (target.kind === 'link') {
    let collections = [...existingCollections];
    let targetCollectionId = target.link.collectionId;
    if (!collections.some((c) => c.id === targetCollectionId)) {
      const fallback = sortByOrder(collections)[0];
      if (fallback) {
        targetCollectionId = fallback.id;
      } else {
        const created: Collection = {
          id: crypto.randomUUID(),
          name: target.collectionName?.trim() || 'Restored Links',
          color: 'green',
          spaceId: spaces[0]?.id ?? DEFAULT_SPACE_ID,
          order: 0,
          collapsed: false,
          createdAt: now,
          updatedAt: now,
        };
        collections = [created];
        targetCollectionId = created.id;
        await collectionsStorage.setValue(collections);
      }
    }

    const normalized = normalizeUrlForComparison(target.link.url);
    const duplicate = existingLinks.find(
      (item) =>
        item.collectionId === targetCollectionId &&
        normalizeUrlForComparison(item.url) === normalized,
    );

    if (!duplicate) {
      const nextLink: LinkItem = {
        ...target.link,
        id: existingLinks.some((l) => l.id === target.link.id)
          ? crypto.randomUUID()
          : target.link.id,
        collectionId: targetCollectionId,
        updatedAt: now,
      };
      const nextLinks = insertLinkAtIndexInList(
        existingLinks,
        nextLink,
        nextLink.order,
      );
      await linksStorage.setValue(nextLinks);
    }

    await trashStorage.setValue(remainingTrash);
    return {
      restoredKind: 'link',
      restoredCount: duplicate ? 0 : 1,
      label: target.link.title,
    };
  }

  // Restore entire collection + its links
  const spaceIds = new Set(spaces.map((s) => s.id));
  const resolvedSpaceId =
    target.collection.spaceId && spaceIds.has(target.collection.spaceId)
      ? target.collection.spaceId
      : (spaces[0]?.id ?? DEFAULT_SPACE_ID);

  const colIdCollision = existingCollections.some(
    (c) => c.id === target.collection.id,
  );
  const restoredColId = colIdCollision
    ? crypto.randomUUID()
    : target.collection.id;

  const restoredCollection: Collection = {
    ...target.collection,
    id: restoredColId,
    spaceId: resolvedSpaceId,
    order: existingCollections.length,
    collapsed: false,
    updatedAt: now,
  };

  const existingLinkIds = new Set(existingLinks.map((l) => l.id));
  const restoredLinks: LinkItem[] = sortByOrder(target.links).map(
    (link, idx) => ({
      ...link,
      id: existingLinkIds.has(link.id) ? crypto.randomUUID() : link.id,
      collectionId: restoredColId,
      order: idx,
      updatedAt: now,
    }),
  );

  await Promise.all([
    collectionsStorage.setValue([...existingCollections, restoredCollection]),
    linksStorage.setValue([...existingLinks, ...restoredLinks]),
    trashStorage.setValue(remainingTrash),
  ]);

  return {
    restoredKind: 'collection',
    restoredCount: restoredLinks.length,
    label: restoredCollection.name,
  };
}

export async function deleteTrashEntryInStorage(
  entryId: string,
): Promise<boolean> {
  const existing = await trashStorage.getValue();
  const next = existing.filter((e) => e.id !== entryId);
  if (next.length === existing.length) return false;
  await trashStorage.setValue(next);
  return true;
}

export async function emptyTrashInStorage(): Promise<void> {
  await trashStorage.setValue([]);
}
