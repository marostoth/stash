import type { CollectionSortMode, LinkItem } from '@/lib/types/stash';

export interface CollectionSortOption {
  id: CollectionSortMode;
  label: string;
  shortLabel: string;
}

const DEFAULT_SORT_OPTION: CollectionSortOption = {
  id: 'manual',
  label: 'Manual (Drag order)',
  shortLabel: 'Manual',
};

export const COLLECTION_SORT_OPTIONS: readonly CollectionSortOption[] = [
  DEFAULT_SORT_OPTION,
  { id: 'title-asc', label: 'Title (A → Z)', shortLabel: 'A–Z' },
  { id: 'newest', label: 'Newest Added', shortLabel: 'Newest' },
  { id: 'last-opened', label: 'Recently Opened', shortLabel: 'Opened' },
  { id: 'price-asc', label: 'Price: Low → High', shortLabel: 'Price ↑' },
  { id: 'price-desc', label: 'Price: High → Low', shortLabel: 'Price ↓' },
] as const;

export function getCollectionSortMeta(
  sortMode?: CollectionSortMode,
): CollectionSortOption {
  const resolved = sortMode ?? 'manual';
  return (
    COLLECTION_SORT_OPTIONS.find((opt) => opt.id === resolved) ??
    DEFAULT_SORT_OPTION
  );
}

function getEffectiveLinePrice(link: LinkItem): number | null {
  const price = link.product?.price;
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  const qty =
    typeof link.product?.orderQty === 'number' && link.product.orderQty >= 1
      ? Math.floor(link.product.orderQty)
      : 1;
  return price * qty;
}

/**
 * Returns a new array of links sorted according to the collection's active
 * sortMode without mutating persisted manual `order` values.
 */
export function sortCollectionLinks(
  links: readonly LinkItem[],
  sortMode: CollectionSortMode = 'manual',
): LinkItem[] {
  const copy = [...links];
  switch (sortMode) {
    case 'title-asc':
      return copy.sort((a, b) => {
        const cmp = a.title.localeCompare(b.title, undefined, {
          sensitivity: 'base',
        });
        return cmp !== 0 ? cmp : a.order - b.order;
      });
    case 'newest':
      return copy.sort((a, b) => {
        const cmp = b.createdAt.localeCompare(a.createdAt);
        return cmp !== 0 ? cmp : a.order - b.order;
      });
    case 'last-opened':
      return copy.sort((a, b) => {
        const aOpen = a.lastOpenedAt ?? '';
        const bOpen = b.lastOpenedAt ?? '';
        if (aOpen && !bOpen) return -1;
        if (!aOpen && bOpen) return 1;
        const cmp = bOpen.localeCompare(aOpen);
        return cmp !== 0 ? cmp : a.order - b.order;
      });
    case 'price-asc':
    case 'price-desc': {
      const factor = sortMode === 'price-asc' ? 1 : -1;
      return copy.sort((a, b) => {
        const ap = getEffectiveLinePrice(a);
        const bp = getEffectiveLinePrice(b);
        if (ap === null && bp === null) return a.order - b.order;
        if (ap === null) return 1;
        if (bp === null) return -1;
        if (ap !== bp) return (ap - bp) * factor;
        return a.order - b.order;
      });
    }
    default:
      return copy.sort((a, b) => a.order - b.order);
  }
}

export interface SpaceTagStat {
  tag: string;
  count: number;
}

/**
 * Aggregates unique tags across all links in the active Space (or all Spaces
 * when `collectionIds` is omitted), sorted by frequency descending then A–Z.
 */
export function collectSpaceTagStats(
  links: readonly LinkItem[],
  collectionIds?: ReadonlySet<string>,
): SpaceTagStat[] {
  const counts = new Map<string, number>();

  for (const link of links) {
    if (collectionIds && !collectionIds.has(link.collectionId)) continue;
    const seenOnLink = new Set<string>();
    for (const rawTag of link.tags) {
      const tag = rawTag.trim().toLowerCase();
      if (!tag || seenOnLink.has(tag)) continue;
      seenOnLink.add(tag);
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) =>
      b.count !== a.count ? b.count - a.count : a.tag.localeCompare(b.tag),
    );
}
