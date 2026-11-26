import { linksStorage } from '@/lib/storage/items';
import { pruneEmptyAutoInboxesInStorage } from '@/lib/storage/spaces-ops';
import { normalizeTags, normalizeUrlForComparison } from '@/lib/utils/url';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Batch-updates `starred` on multiple links in a single storage write.
 */
export async function setLinksStarredInStorage(
  ids: readonly string[],
  starred: boolean,
): Promise<string[]> {
  if (ids.length === 0) return [];
  const idSet = new Set(ids);
  const existing = await linksStorage.getValue();
  const changedIds: string[] = [];
  const timestamp = nowIso();

  const next = existing.map((item) => {
    if (!idSet.has(item.id)) return item;
    const currentlyStarred = item.starred === true;
    if (currentlyStarred === starred) return item;
    changedIds.push(item.id);
    return {
      ...item,
      starred: starred ? true : undefined,
      updatedAt: timestamp,
    };
  });

  if (changedIds.length > 0) {
    await linksStorage.setValue(next);
  }
  return changedIds;
}

/**
 * Batch-updates `checked` (Bought / Done) on multiple links in a single write.
 */
export async function setLinksCheckedInStorage(
  ids: readonly string[],
  checked: boolean,
): Promise<string[]> {
  if (ids.length === 0) return [];
  const idSet = new Set(ids);
  const existing = await linksStorage.getValue();
  const changedIds: string[] = [];
  const timestamp = nowIso();

  const next = existing.map((item) => {
    if (!idSet.has(item.id)) return item;
    const currentlyChecked = item.checked === true;
    if (currentlyChecked === checked) return item;
    changedIds.push(item.id);
    return {
      ...item,
      checked: checked ? true : undefined,
      updatedAt: timestamp,
    };
  });

  if (changedIds.length > 0) {
    await linksStorage.setValue(next);
  }
  return changedIds;
}

/**
 * Bulk-moves links to a target collection in a single storage write, skipping
 * any link whose normalized URL already exists in the destination collection.
 */
export async function moveLinksToCollectionInStorage(
  ids: readonly string[],
  targetCollectionId: string,
): Promise<{ movedCount: number; skippedDuplicates: number }> {
  if (ids.length === 0) return { movedCount: 0, skippedDuplicates: 0 };
  const idSet = new Set(ids);
  const existing = await linksStorage.getValue();
  const timestamp = nowIso();

  const existingUrlsInTarget = new Set(
    existing
      .filter((l) => l.collectionId === targetCollectionId)
      .map((l) => normalizeUrlForComparison(l.url)),
  );
  let nextOrder = existing
    .filter((l) => l.collectionId === targetCollectionId)
    .reduce((max, l) => Math.max(max, l.order), -1);

  let movedCount = 0;
  let skippedDuplicates = 0;
  const sourceCollections = new Set<string>();

  const next = existing.map((item) => {
    if (!idSet.has(item.id) || item.collectionId === targetCollectionId) {
      return item;
    }
    const normUrl = normalizeUrlForComparison(item.url);
    if (existingUrlsInTarget.has(normUrl)) {
      skippedDuplicates += 1;
      return item;
    }
    existingUrlsInTarget.add(normUrl);
    sourceCollections.add(item.collectionId);
    nextOrder += 1;
    movedCount += 1;
    return {
      ...item,
      collectionId: targetCollectionId,
      order: nextOrder,
      updatedAt: timestamp,
    };
  });

  if (movedCount > 0) {
    await linksStorage.setValue(next);
    await pruneEmptyAutoInboxesInStorage(Array.from(sourceCollections), next);
  }
  return { movedCount, skippedDuplicates };
}

/**
 * Bulk-adds normalized tags to multiple links in a single storage write.
 */
export async function addTagsToLinksInStorage(
  ids: readonly string[],
  rawTags: readonly string[],
): Promise<number> {
  const toAdd = normalizeTags(rawTags);
  if (ids.length === 0 || toAdd.length === 0) return 0;
  const idSet = new Set(ids);
  const existing = await linksStorage.getValue();
  const timestamp = nowIso();
  let updatedCount = 0;

  const next = existing.map((item) => {
    if (!idSet.has(item.id)) return item;
    const merged = normalizeTags([...item.tags, ...toAdd]);
    if (merged.length === item.tags.length) return item;
    updatedCount += 1;
    return {
      ...item,
      tags: merged,
      tagsLocked: true,
      updatedAt: timestamp,
    };
  });

  if (updatedCount > 0) {
    await linksStorage.setValue(next);
  }
  return updatedCount;
}
