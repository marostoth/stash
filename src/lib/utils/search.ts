import {
  type Collection,
  DEFAULT_SPACE_ID,
  type LinkItem,
} from '@/lib/types/stash';

export interface SearchFilterOptions {
  starredOnly?: boolean;
  /** When provided, restricts board/search to this Space unless `searchAllSpaces` is active with a query/filter. */
  activeSpaceId?: string;
  /** Opt-in cross-Space search when a query or `starredOnly` filter is active. Defaults to `false`. */
  searchAllSpaces?: boolean;
}

interface ParsedSearchFilter {
  requireStarred: boolean;
  textTerms: string[];
}

function parseSearchFilter(
  rawQuery: string,
  options?: SearchFilterOptions,
): ParsedSearchFilter {
  const tokens = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let requireStarred = Boolean(options?.starredOnly);
  const textTerms: string[] = [];

  for (const token of tokens) {
    if (token === 'is:starred') {
      requireStarred = true;
    } else {
      textTerms.push(token);
    }
  }

  return { requireStarred, textTerms };
}

export function matchesSearchQuery(
  link: LinkItem,
  collectionName: string,
  rawQuery: string,
  options?: SearchFilterOptions,
): boolean {
  const { requireStarred, textTerms } = parseSearchFilter(rawQuery, options);
  if (requireStarred && !link.starred) return false;
  if (textTerms.length === 0) return true;

  const haystack = [
    link.title,
    link.url,
    link.note,
    link.tags.join(' '),
    collectionName,
  ]
    .join(' ')
    .toLowerCase();

  return textTerms.every((term) => haystack.includes(term));
}

export interface FilteredCollectionGroup {
  collection: Collection;
  links: LinkItem[];
}

export function groupAndFilterCollections(
  collections: readonly Collection[],
  links: readonly LinkItem[],
  rawQuery: string,
  options?: SearchFilterOptions,
): FilteredCollectionGroup[] {
  const { requireStarred, textTerms } = parseSearchFilter(rawQuery, options);
  const hasFilter = requireStarred || textTerms.length > 0;
  const activeSpaceId = options?.activeSpaceId;
  const spanAllSpaces = Boolean(options?.searchAllSpaces) && hasFilter;

  const scopedCollections =
    activeSpaceId && !spanAllSpaces
      ? collections.filter(
          (col) => (col.spaceId ?? DEFAULT_SPACE_ID) === activeSpaceId,
        )
      : collections;

  const linksByCollection = new Map<string, LinkItem[]>();

  for (const link of links) {
    const bucket = linksByCollection.get(link.collectionId);
    if (bucket) {
      bucket.push(link);
    } else {
      linksByCollection.set(link.collectionId, [link]);
    }
  }

  const normalizedCollectionQuery = textTerms.join(' ');
  const groups: FilteredCollectionGroup[] = [];
  for (const collection of scopedCollections) {
    const collectionLinks = (linksByCollection.get(collection.id) ?? []).sort(
      (a, b) => a.order - b.order,
    );

    if (!hasFilter) {
      groups.push({ collection, links: collectionLinks });
      continue;
    }

    const matchingLinks = collectionLinks.filter((link) =>
      matchesSearchQuery(link, collection.name, rawQuery, options),
    );
    const collectionMatchesDirectly =
      !requireStarred &&
      normalizedCollectionQuery.length > 0 &&
      collection.name.toLowerCase().includes(normalizedCollectionQuery);

    if (matchingLinks.length > 0 || collectionMatchesDirectly) {
      groups.push({
        collection,
        links: matchingLinks.length > 0 ? matchingLinks : collectionLinks,
      });
    }
  }

  return groups;
}
