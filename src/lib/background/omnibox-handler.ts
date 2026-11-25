import { stashRepo } from '@/lib/storage/repo';
import type { Collection, LinkItem } from '@/lib/types/stash';
import { matchesSearchQuery } from '@/lib/utils/search';
import { extractDomain } from '@/lib/utils/url';

export interface OmniboxSuggestionItem {
  content: string;
  description: string;
}

const MAX_OMNIBOX_RESULTS = 6;

/**
 * Strictly XML-escapes dynamic text for Chrome omnibox suggestion descriptions.
 * Prevents `&`, `<`, `>`, `"`, and `'` from breaking Chrome's XML parser.
 */
export function escapeOmniboxXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * XML-escapes `text` and wraps case-insensitive matches of `terms` in `<match>`.
 */
export function highlightOmniboxText(
  text: string,
  terms: readonly string[],
): string {
  const cleaned = Array.from(
    new Set(
      terms
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.toLowerCase() !== 'is:starred'),
    ),
  ).sort((a, b) => b.length - a.length);

  if (cleaned.length === 0) {
    return escapeOmniboxXml(text);
  }

  const pattern = new RegExp(`(${cleaned.map(escapeRegExp).join('|')})`, 'gi');
  let output = '';
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    const hit = match[0];
    if (start > lastIndex) {
      output += escapeOmniboxXml(text.slice(lastIndex, start));
    }
    output += `<match>${escapeOmniboxXml(hit)}</match>`;
    lastIndex = start + hit.length;
  }

  if (lastIndex < text.length) {
    output += escapeOmniboxXml(text.slice(lastIndex));
  }

  return output;
}

/**
 * Validates that a string is an explicit http(s) URL safe to open from omnibox.
 */
export function isSafeHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function scoreOmniboxLink(
  link: LinkItem,
  collectionName: string,
  normalizedQuery: string,
  terms: readonly string[],
): number {
  let score = 0;
  if (link.starred) score += 40;

  const titleLower = link.title.toLowerCase();
  const domainLower = extractDomain(link.url).toLowerCase();
  const tagsLower = link.tags.map((t) => t.toLowerCase());
  const noteLower = link.note.toLowerCase();
  const colLower = collectionName.toLowerCase();

  if (normalizedQuery) {
    if (titleLower === normalizedQuery) score += 45;
    else if (titleLower.startsWith(normalizedQuery)) score += 32;
    else if (titleLower.includes(normalizedQuery)) score += 20;

    if (domainLower === normalizedQuery) score += 36;
    else if (domainLower.startsWith(normalizedQuery)) score += 24;
    else if (domainLower.includes(normalizedQuery)) score += 16;
  }

  for (const term of terms) {
    if (titleLower.includes(term)) score += 12;
    if (domainLower.includes(term)) score += 10;
    if (tagsLower.some((tag) => tag === term || tag.includes(term))) score += 8;
    if (colLower.includes(term)) score += 6;
    if (noteLower.includes(term)) score += 4;
  }

  return score;
}

/**
 * Searches and ranks stashed links for Chrome's `s <query>` omnibox keyword.
 * Boosts starred links and title/domain matches, returning XML-safe top results.
 */
export function rankAndBuildOmniboxSuggestions(
  collections: readonly Collection[],
  links: readonly LinkItem[],
  rawQuery: string,
  limit = MAX_OMNIBOX_RESULTS,
): OmniboxSuggestionItem[] {
  const colNameById = new Map(collections.map((c) => [c.id, c.name]));
  const rawTerms = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const textTerms = rawTerms.filter((t) => t !== 'is:starred');
  const normalizedQuery = textTerms.join(' ');

  const scored: Array<{
    link: LinkItem;
    collectionName: string;
    score: number;
  }> = [];

  for (const link of links) {
    if (!isSafeHttpUrl(link.url)) continue;
    const collectionName = colNameById.get(link.collectionId) ?? '';
    if (!matchesSearchQuery(link, collectionName, rawQuery)) continue;

    scored.push({
      link,
      collectionName,
      score: scoreOmniboxLink(link, collectionName, normalizedQuery, textTerms),
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTime = a.link.lastOpenedAt ?? a.link.updatedAt;
    const bTime = b.link.lastOpenedAt ?? b.link.updatedAt;
    return bTime.localeCompare(aTime);
  });

  return scored.slice(0, limit).map(({ link, collectionName }) => {
    const domain = extractDomain(link.url);
    const starPrefix = link.starred ? '★ ' : '';
    const titlePart = highlightOmniboxText(link.title, textTerms);
    const metaPieces = [
      collectionName,
      ...link.tags.slice(0, 2).map((tag) => `#${tag}`),
    ].filter(Boolean);
    const metaPart =
      metaPieces.length > 0
        ? ` <dim>· ${escapeOmniboxXml(metaPieces.join(' · '))}</dim>`
        : '';
    const urlPart = ` <url>${highlightOmniboxText(domain, textTerms)}</url>`;

    return {
      content: link.url,
      description: `${starPrefix}${titlePart}${metaPart}${urlPart}`,
    };
  });
}

function openOmniboxDestination(
  url: string,
  disposition: 'currentTab' | 'newForegroundTab' | 'newBackgroundTab',
): void {
  if (disposition === 'currentTab') {
    void browser.tabs?.update?.({ url });
    return;
  }
  void browser.tabs?.create?.({
    url,
    active: disposition === 'newForegroundTab',
  });
}

export function registerOmniboxHandler(): void {
  if (typeof browser === 'undefined' || !browser.omnibox) return;

  try {
    browser.omnibox.setDefaultSuggestion({
      description: 'Search Stash bookmarks: <match>%s</match>',
    });
  } catch {
    // Ignore if unavailable in non-standard test/runtime environments
  }

  browser.omnibox.onInputChanged.addListener((text, suggest) => {
    void Promise.all([stashRepo.getCollections(), stashRepo.getLinks()])
      .then(([collections, links]) => {
        const results = rankAndBuildOmniboxSuggestions(
          collections,
          links,
          text,
          MAX_OMNIBOX_RESULTS,
        );
        suggest(results);
      })
      .catch(() => {
        suggest([]);
      });
  });

  browser.omnibox.onInputEntered.addListener((text, disposition) => {
    const trimmed = text.trim();
    if (isSafeHttpUrl(trimmed)) {
      openOmniboxDestination(trimmed, disposition);
      return;
    }

    const baseNewTab = browser.runtime.getURL('/newtab.html');
    const targetUrl = trimmed
      ? `${baseNewTab}?q=${encodeURIComponent(trimmed)}`
      : baseNewTab;
    openOmniboxDestination(targetUrl, disposition);
  });
}
