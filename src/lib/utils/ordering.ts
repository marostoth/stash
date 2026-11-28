import {
  type Collection,
  DEFAULT_SPACE_ID,
  type LinkItem,
} from '@/lib/types/stash';
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

/**
 * Maps a drop index in a filtered visible list (e.g. when `hideChecked` hides
 * checked items) back to the exact insertion index in the full ordered list
 * so hidden items keep their relative positions untouched.
 */
export function mapVisibleIndexToFullIndex(
  fullOrderedLinks: readonly LinkItem[],
  visibleLinks: readonly LinkItem[],
  visibleTargetIndex: number,
): number {
  if (visibleLinks.length === 0) return fullOrderedLinks.length;
  const clampedVisible = clampIndex(visibleTargetIndex, visibleLinks.length);
  if (clampedVisible >= visibleLinks.length) return fullOrderedLinks.length;
  const anchor = visibleLinks[clampedVisible];
  if (!anchor) return fullOrderedLinks.length;
  const fullIndex = fullOrderedLinks.findIndex((item) => item.id === anchor.id);
  return fullIndex === -1 ? fullOrderedLinks.length : fullIndex;
}

export function reorderCollectionsList(
  collections: readonly Collection[],
  sourceId: string,
  targetIndex: number,
  updatedAt: string,
  scopeSpaceId?: string,
): Collection[] {
  const sorted = sortByOrder(collections);

  if (scopeSpaceId !== undefined) {
    const slotIndices: number[] = [];
    const spaceSlice: Collection[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const col = sorted[i];
      if (col && (col.spaceId ?? DEFAULT_SPACE_ID) === scopeSpaceId) {
        slotIndices.push(i);
        spaceSlice.push(col);
      }
    }

    const fromLocal = spaceSlice.findIndex((item) => item.id === sourceId);
    if (fromLocal === -1) return sorted;

    const [moved] = spaceSlice.splice(fromLocal, 1);
    if (!moved) return sorted;

    const clampedLocal = clampIndex(targetIndex, spaceSlice.length);
    spaceSlice.splice(clampedLocal, 0, { ...moved, updatedAt });

    const next = [...sorted];
    for (let k = 0; k < slotIndices.length; k++) {
      const globalSlot = slotIndices[k];
      const replacement = spaceSlice[k];
      if (globalSlot !== undefined && replacement) {
        next[globalSlot] = replacement;
      }
    }

    return next.map((item, idx) =>
      item.order === idx ? item : { ...item, order: idx },
    );
  }

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
