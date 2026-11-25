import type { Collection, LinkItem } from '@/lib/types/stash';
import { normalizeUrlForComparison } from '@/lib/utils/url';

export function sortByOrder<T extends { order: number }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

export function clampIndex(index: number, maxLength: number): number {
  if (index < 0) return 0;
  if (index > maxLength) return maxLength;
  return index;
}

export function reorderCollectionsList(
  collections: readonly Collection[],
  sourceId: string,
  targetIndex: number,
  updatedAt: string,
): Collection[] {
  const sorted = sortByOrder(collections);
  const fromIndex = sorted.findIndex((item) => item.id === sourceId);
  if (fromIndex === -1) return sorted;

  const [moved] = sorted.splice(fromIndex, 1);
  if (!moved) return sorted;

  const clamped = clampIndex(targetIndex, sorted.length);
  sorted.splice(clamped, 0, { ...moved, updatedAt });

  return sorted.map((item, idx) =>
    item.order === idx ? item : { ...item, order: idx },
  );
}

export type MoveLinkListResult =
  | { ok: true; links: LinkItem[]; link: LinkItem }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'duplicate'; existingLink: LinkItem };

export function moveOrReorderLinkInList(
  links: readonly LinkItem[],
  linkId: string,
  targetCollectionId: string,
  targetIndex: number | undefined,
  updatedAt: string,
): MoveLinkListResult {
  const current = links.find((item) => item.id === linkId);
  if (!current) {
    return { ok: false, reason: 'not_found' };
  }

  const isCrossCollection = current.collectionId !== targetCollectionId;
  if (isCrossCollection) {
    const normalized = normalizeUrlForComparison(current.url);
    const duplicate = links.find(
      (item) =>
        item.collectionId === targetCollectionId &&
        item.id !== linkId &&
        normalizeUrlForComparison(item.url) === normalized,
    );
    if (duplicate) {
      return { ok: false, reason: 'duplicate', existingLink: duplicate };
    }
  }

  const others = links.filter(
    (item) =>
      item.collectionId !== current.collectionId &&
      item.collectionId !== targetCollectionId,
  );

  if (!isCrossCollection) {
    const siblings = sortByOrder(
      links.filter((item) => item.collectionId === targetCollectionId),
    );
    const fromIndex = siblings.findIndex((item) => item.id === linkId);
    if (fromIndex === -1) return { ok: false, reason: 'not_found' };

    const [moved] = siblings.splice(fromIndex, 1);
    if (!moved) return { ok: false, reason: 'not_found' };

    const clamped =
      targetIndex === undefined
        ? siblings.length
        : clampIndex(targetIndex, siblings.length);
    const nextMoved: LinkItem = { ...moved, updatedAt };
    siblings.splice(clamped, 0, nextMoved);

    const reindexed = siblings.map((item, idx) => ({ ...item, order: idx }));
    const updatedMoved =
      reindexed.find((item) => item.id === linkId) ?? nextMoved;

    return {
      ok: true,
      links: [...others, ...reindexed],
      link: updatedMoved,
    };
  }

  const sourceSiblings = sortByOrder(
    links.filter(
      (item) =>
        item.collectionId === current.collectionId && item.id !== linkId,
    ),
  ).map((item, idx) => ({ ...item, order: idx }));

  const targetSiblings = sortByOrder(
    links.filter((item) => item.collectionId === targetCollectionId),
  );
  const clamped =
    targetIndex === undefined
      ? targetSiblings.length
      : clampIndex(targetIndex, targetSiblings.length);
  const movedLink: LinkItem = {
    ...current,
    collectionId: targetCollectionId,
    updatedAt,
  };
  targetSiblings.splice(clamped, 0, movedLink);

  const reindexedTarget = targetSiblings.map((item, idx) => ({
    ...item,
    order: idx,
  }));
  const updatedMoved =
    reindexedTarget.find((item) => item.id === linkId) ?? movedLink;

  return {
    ok: true,
    links: [...others, ...sourceSiblings, ...reindexedTarget],
    link: updatedMoved,
  };
}

export function insertLinkAtIndexInList(
  links: readonly LinkItem[],
  newLink: LinkItem,
  targetIndex?: number,
): LinkItem[] {
  const others = links.filter(
    (item) => item.collectionId !== newLink.collectionId,
  );
  const siblings = sortByOrder(
    links.filter((item) => item.collectionId === newLink.collectionId),
  );
  const clamped =
    targetIndex === undefined
      ? siblings.length
      : clampIndex(targetIndex, siblings.length);
  siblings.splice(clamped, 0, newLink);

  const reindexed = siblings.map((item, idx) => ({ ...item, order: idx }));
  return [...others, ...reindexed];
}
