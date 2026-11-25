import type { LinkItem } from '@/lib/types/stash';
import { normalizeUrlForComparison } from '@/lib/utils/url';

export type ClutterKind = 'duplicate' | 'local' | 'search';

export interface ClutterFinding {
  linkId: string;
  kind: ClutterKind;
  reason: string;
  duplicateGroupKey?: string;
  duplicateCount?: number;
}

const LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

/**
 * Flags local development URLs (localhost, loopback IPs, 0.0.0.0, *.local, *.localhost).
 */
export function isLocalDevUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (LOCAL_HOSTNAMES.has(host)) return true;
    if (host.endsWith('.local') || host.endsWith('.localhost')) return true;
    if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Flags stale search-engine query result pages (Google, Bing, DuckDuckGo, Yahoo, Brave, Ecosia, Kagi, Yandex).
 */
export function isSearchResultUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const params = parsed.searchParams;

    // Google search (google.com, google.co.uk, google.de, etc.)
    if (/^google\.[a-z.]+$/.test(host) && path === '/search') {
      return params.has('q') || parsed.search.length > 0;
    }

    // Bing search
    if (
      (host === 'bing.com' || host.endsWith('.bing.com')) &&
      path === '/search'
    ) {
      return params.has('q');
    }

    // DuckDuckGo search
    if (host === 'duckduckgo.com' || host === 'html.duckduckgo.com') {
      return params.has('q') && (path === '/' || path === '/html');
    }

    // Brave, Ecosia, Kagi search
    if (
      (host === 'search.brave.com' ||
        host === 'ecosia.org' ||
        host === 'kagi.com') &&
      path === '/search'
    ) {
      return params.has('q');
    }

    // Yahoo search
    if (host === 'search.yahoo.com' && path === '/search') {
      return params.has('p');
    }

    // Yandex search
    if (/^yandex\.[a-z.]+$/.test(host) && path === '/search') {
      return params.has('text');
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Pure synchronous clutter scan across all saved LinkItems.
 * Groups cross-collection duplicate URLs together and flags local/dev and search-query pages.
 */
export function detectClutter(links: readonly LinkItem[]): ClutterFinding[] {
  const byNormalizedUrl = new Map<string, LinkItem[]>();
  for (const link of links) {
    const key = normalizeUrlForComparison(link.url);
    const bucket = byNormalizedUrl.get(key);
    if (bucket) {
      bucket.push(link);
    } else {
      byNormalizedUrl.set(key, [link]);
    }
  }

  const findings: ClutterFinding[] = [];
  const seenLinkIds = new Set<string>();

  // 1. Cross-collection (or any) duplicate URLs grouped consecutively
  for (const [key, group] of byNormalizedUrl.entries()) {
    if (group.length < 2) continue;
    for (const link of group) {
      seenLinkIds.add(link.id);
      findings.push({
        linkId: link.id,
        kind: 'duplicate',
        reason: `Duplicate (${group.length} copies)`,
        duplicateGroupKey: key,
        duplicateCount: group.length,
      });
    }
  }

  // 2. Local/dev URLs & stale search-engine query pages
  for (const link of links) {
    if (seenLinkIds.has(link.id)) continue;

    if (isLocalDevUrl(link.url)) {
      seenLinkIds.add(link.id);
      findings.push({
        linkId: link.id,
        kind: 'local',
        reason: 'Local / dev URL',
      });
      continue;
    }

    if (isSearchResultUrl(link.url)) {
      seenLinkIds.add(link.id);
      findings.push({
        linkId: link.id,
        kind: 'search',
        reason: 'Search results page',
      });
    }
  }

  return findings;
}
