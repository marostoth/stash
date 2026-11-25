import type { Collection, LinkItem } from '@/lib/types/stash';

export function matchesSearchQuery(
  link: LinkItem,
  collectionName: string,
  rawQuery: string,
): boolean {
  const terms = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = [
    link.title,
    link.url,
    link.note,
    link.tags.join(' '),
    collectionName,
  ]
    .join(' ')
    .toLowerCase();

  return terms.every((term) => haystack.includes(term));
}

export interface FilteredCollectionGroup {
  collection: Collection;
  links: LinkItem[];
}

export function groupAndFilterCollections(
  collections: readonly Collection[],
  links: readonly LinkItem[],
  rawQuery: string,
): FilteredCollectionGroup[] {
  const hasQuery = rawQuery.trim().length > 0;
  const linksByCollection = new Map<string, LinkItem[]>();

  for (const link of links) {
    const bucket = linksByCollection.get(link.collectionId);
    if (bucket) {
      bucket.push(link);
    } else {
      linksByCollection.set(link.collectionId, [link]);
    }
  }

  const groups: FilteredCollectionGroup[] = [];
  for (const collection of collections) {
    const collectionLinks = (linksByCollection.get(collection.id) ?? []).sort(
      (a, b) => a.order - b.order,
    );

    if (!hasQuery) {
      groups.push({ collection, links: collectionLinks });
      continue;
    }

    const matchingLinks = collectionLinks.filter((link) =>
      matchesSearchQuery(link, collection.name, rawQuery),
    );
    const collectionMatchesDirectly = collection.name
      .toLowerCase()
      .includes(rawQuery.trim().toLowerCase());

    if (matchingLinks.length > 0 || collectionMatchesDirectly) {
      groups.push({
        collection,
        links: matchingLinks.length > 0 ? matchingLinks : collectionLinks,
      });
    }
  }

  return groups;
}
