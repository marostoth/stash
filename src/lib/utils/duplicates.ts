import {
  type Collection,
  DEFAULT_SPACE_ID,
  type LinkItem,
  type Space,
} from '@/lib/types/stash';
import { normalizeUrlForComparison } from '@/lib/utils/url';

export interface DuplicateLinkEntry {
  link: LinkItem;
  collectionName: string;
  spaceName: string;
  recommendedKeep: boolean;
}

export interface DuplicateUrlGroup {
  normalizedUrl: string;
  displayUrl: string;
  entries: DuplicateLinkEntry[];
}

function scoreLinkForKeep(link: LinkItem): number {
  let score = 0;
  if (link.starred) score += 8;
  if (link.pinnedToDock) score += 6;
  if (typeof link.product?.price === 'number') score += 5;
  if (link.note.trim().length > 0) score += 3;
  if (link.tags.length > 0) score += Math.min(3, link.tags.length);
  return score;
}

/**
 * Scans all links across every Space and collection to find duplicate URLs.
 * Recommends keeping the richest copy (starred, pinned, priced, noted, tagged,
 * or earliest saved).
 */
export function findCrossSpaceDuplicates(
  links: readonly LinkItem[],
  collections: readonly Collection[],
  spaces: readonly Space[],
): DuplicateUrlGroup[] {
  const collectionMap = new Map(collections.map((c) => [c.id, c]));
  const spaceMap = new Map(spaces.map((s) => [s.id, s]));
  const buckets = new Map<string, LinkItem[]>();

  for (const link of links) {
    const key = normalizeUrlForComparison(link.url);
    if (!key) continue;
    const list = buckets.get(key);
    if (list) list.push(link);
    else buckets.set(key, [link]);
  }

  const groups: DuplicateUrlGroup[] = [];
  for (const [normalizedUrl, items] of buckets.entries()) {
    if (items.length < 2) continue;

    const sorted = [...items].sort((a, b) => {
      const scoreDiff = scoreLinkForKeep(b) - scoreLinkForKeep(a);
      if (scoreDiff !== 0) return scoreDiff;
      return a.createdAt.localeCompare(b.createdAt);
    });

    const entries: DuplicateLinkEntry[] = sorted.map((link, idx) => {
      const col = collectionMap.get(link.collectionId);
      const spaceId = col?.spaceId ?? DEFAULT_SPACE_ID;
      const space = spaceMap.get(spaceId);
      return {
        link,
        collectionName: col?.name ?? 'Unknown Collection',
        spaceName: space?.name ?? 'Main',
        recommendedKeep: idx === 0,
      };
    });

    groups.push({
      normalizedUrl,
      displayUrl: sorted[0]?.url ?? normalizedUrl,
      entries,
    });
  }

  return groups.sort((a, b) => b.entries.length - a.entries.length);
}
