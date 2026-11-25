import type { CategorizationTarget } from '@/lib/categorizer/types';
import type { Collection, LinkItem } from '@/lib/types/stash';
import { normalizeStoreName } from '@/lib/utils/product-url';
import { extractDomain } from '@/lib/utils/url';

/**
 * Broad multi-topic platforms where a single domain commonly spans many
 * unrelated collections (so domain-level affinity should not lock a folder).
 */
const GENERIC_MULTI_TOPIC_HOSTS = new Set([
  'youtube.com',
  'youtu.be',
  'github.com',
  'gitlab.com',
  'reddit.com',
  'x.com',
  'twitter.com',
  'google.com',
  'google.co.uk',
  'amazon.com',
  'amazon.co.uk',
  'amazon.de',
  'amazon.fr',
  'amazon.ca',
  'ebay.com',
  'ebay.co.uk',
  'medium.com',
  'substack.com',
  'wikipedia.org',
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'pinterest.com',
  'notion.so',
  'stackoverflow.com',
  'npmjs.com',
  'pypi.org',
]);

const GENERIC_COLLECTION_NAMES = new Set([
  'inbox',
  'links',
  'saved',
  'saved links',
  'bookmarks',
  'general',
  'notes',
  'misc',
  'home',
  'shop',
  'store',
  'reading',
  'tools',
  'work',
  'news',
  'docs',
]);

const DOMAIN_AFFINITY_THRESHOLD = 0.7;

export interface LibraryMatchResult {
  collectionId: string;
  collectionName: string;
  reason: 'domain' | 'name';
}

function isGenericHost(domain: string): boolean {
  const lower = domain.toLowerCase();
  if (GENERIC_MULTI_TOPIC_HOSTS.has(lower)) return true;
  for (const host of GENERIC_MULTI_TOPIC_HOSTS) {
    if (lower.endsWith(`.${host}`)) return true;
  }
  return false;
}

function extractPrimaryDomainLabel(domain: string): string {
  const parts = domain
    .toLowerCase()
    .split('.')
    .filter((p) => p.length > 0 && p !== 'www');
  return parts[0] ?? '';
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWholePhrase(haystack: string, needle: string): boolean {
  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegex(needle)}([^a-z0-9]|$)`,
    'i',
  );
  return pattern.test(haystack);
}

/**
 * Tier 1.5 deterministic matcher backed by the user's own saved library:
 * 1. Domain affinity: if non-generic domain already lives overwhelmingly (>=70%)
 *    in one non-session collection, select that collection instantly (0ms).
 * 2. Collection-name match: if the page's store/domain label or title directly
 *    matches an unambiguous collection name (e.g. "Autoglym"), select it.
 */
export function matchFromLibraryMemory(
  target: CategorizationTarget,
  collections: readonly Collection[],
  existingLinks: readonly LinkItem[],
): LibraryMatchResult | null {
  const nonSession = collections.filter((col) => !col.isSession);
  if (nonSession.length === 0) return null;

  const validById = new Map(nonSession.map((col) => [col.id, col]));
  const targetDomain = extractDomain(target.url).toLowerCase();

  // 1. Existing-domain affinity
  if (
    targetDomain &&
    !isGenericHost(targetDomain) &&
    existingLinks.length > 0
  ) {
    const countsByCollection = new Map<string, number>();
    let totalOnDomain = 0;

    for (const link of existingLinks) {
      if (!validById.has(link.collectionId)) continue;
      if (extractDomain(link.url).toLowerCase() !== targetDomain) continue;
      countsByCollection.set(
        link.collectionId,
        (countsByCollection.get(link.collectionId) ?? 0) + 1,
      );
      totalOnDomain += 1;
    }

    if (totalOnDomain > 0) {
      let bestId: string | null = null;
      let bestCount = 0;
      let tied = false;

      for (const [colId, count] of countsByCollection.entries()) {
        if (count > bestCount) {
          bestId = colId;
          bestCount = count;
          tied = false;
        } else if (count === bestCount) {
          tied = true;
        }
      }

      if (
        bestId &&
        !tied &&
        bestCount / totalOnDomain >= DOMAIN_AFFINITY_THRESHOLD
      ) {
        const matched = validById.get(bestId);
        if (matched) {
          return {
            collectionId: matched.id,
            collectionName: matched.name,
            reason: 'domain',
          };
        }
      }
    }
  }

  // 2. Direct store/domain-label or title phrase match against collection names
  const storeLower = normalizeStoreName(target.url).toLowerCase();
  const domainLabel = extractPrimaryDomainLabel(targetDomain);

  const exactDomainNameMatches = nonSession.filter((col) => {
    const lower = col.name.trim().toLowerCase();
    if (lower.length < 3 || GENERIC_COLLECTION_NAMES.has(lower)) return false;
    return (
      lower === storeLower || (domainLabel.length >= 3 && lower === domainLabel)
    );
  });

  if (exactDomainNameMatches.length === 1 && exactDomainNameMatches[0]) {
    return {
      collectionId: exactDomainNameMatches[0].id,
      collectionName: exactDomainNameMatches[0].name,
      reason: 'name',
    };
  }

  const titleLower = target.title.trim().toLowerCase();
  if (titleLower.length >= 4) {
    const titleMatches = nonSession.filter((col) => {
      const lower = col.name.trim().toLowerCase();
      if (lower.length < 4 || GENERIC_COLLECTION_NAMES.has(lower)) return false;
      return containsWholePhrase(titleLower, lower);
    });
    if (titleMatches.length === 1 && titleMatches[0]) {
      return {
        collectionId: titleMatches[0].id,
        collectionName: titleMatches[0].name,
        reason: 'name',
      };
    }
  }

  return null;
}
