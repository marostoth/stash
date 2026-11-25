import { isValidCatalogIcon } from '@/lib/icons/catalog';
import type { LinkItem } from '@/lib/types/stash';
import { extractDomain } from '@/lib/utils/url';

export const UNCATEGORIZED_CATEGORY_NAME = 'Uncategorized';

export interface ProposedCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

export interface LibraryDigestResult {
  text: string;
  totalLinks: number;
  uniqueDomains: number;
  sampleCount: number;
}

export interface BuildDigestOptions {
  maxChars?: number;
  maxDomains?: number;
  maxSamples?: number;
}

const DEFAULT_MAX_CHARS = 4000;
const DEFAULT_MAX_DOMAINS = 35;
const DEFAULT_MAX_SAMPLES = 70;

const BOILERPLATE_SUFFIX_PATTERN =
  /\s*(?:\||—|–|-)\s*(?:home|homepage|official\s+site|welcome|youtube|google\s+search|x|twitter)\s*$/i;

/**
 * Strips notification counters, excess whitespace, and trailing boilerplate
 * so Pass 1 spends Gemini Nano tokens on actual topic signal.
 */
export function cleanTitleForDigest(rawTitle: string): string {
  const withoutCounters = rawTitle.replace(/^\(\d+\+?\)\s*/g, '');
  const collapsed = withoutCounters.replace(/\s+/g, ' ').trim();
  const trimmed = collapsed.replace(BOILERPLATE_SUFFIX_PATTERN, '').trim();
  const finalTitle = trimmed || collapsed;
  return finalTitle.length > 72 ? `${finalTitle.slice(0, 69)}...` : finalTitle;
}

/**
 * Summarizes a LinkItem array into a token-lean digest:
 * 1) Domain frequency counts (e.g. `github.com (14), youtube.com (9)`)
 * 2) Cleaned representative sample titles & tags distributed across domains
 * Strictly capped at `maxChars` (~4,000 chars default) for Gemini Nano's window.
 */
export function buildLibraryDigest(
  links: readonly LinkItem[],
  options: BuildDigestOptions = {},
): LibraryDigestResult {
  const maxChars = Math.max(400, options.maxChars ?? DEFAULT_MAX_CHARS);
  const maxDomains = Math.max(5, options.maxDomains ?? DEFAULT_MAX_DOMAINS);
  const maxSamples = Math.max(5, options.maxSamples ?? DEFAULT_MAX_SAMPLES);

  if (links.length === 0) {
    return {
      text: 'Total links: 0\nTop domains: none\nSamples:\n',
      totalLinks: 0,
      uniqueDomains: 0,
      sampleCount: 0,
    };
  }

  const domainBuckets = new Map<string, LinkItem[]>();
  for (const link of links) {
    const domain = extractDomain(link.url).toLowerCase() || 'unknown';
    const bucket = domainBuckets.get(domain);
    if (bucket) {
      bucket.push(link);
    } else {
      domainBuckets.set(domain, [link]);
    }
  }

  const sortedDomains = Array.from(domainBuckets.entries()).sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  );

  const topDomainSummary = sortedDomains
    .slice(0, maxDomains)
    .map(([domain, items]) => `${domain} (${items.length})`)
    .join(', ');

  const headerLines = [
    `Total links: ${links.length} across ${sortedDomains.length} domains`,
    `Top domains: ${topDomainSummary}`,
    'Sample items:',
  ];
  let output = `${headerLines.join('\n')}\n`;

  if (output.length > maxChars) {
    output = `${output.slice(0, maxChars - 3)}...`;
    return {
      text: output,
      totalLinks: links.length,
      uniqueDomains: sortedDomains.length,
      sampleCount: 0,
    };
  }

  // Round-robin across domains so one high-volume domain doesn't crowd out other topics
  const sampleLines: string[] = [];
  const cursors = sortedDomains.map(() => 0);
  let progressed = true;

  while (sampleLines.length < maxSamples && progressed) {
    progressed = false;
    for (let i = 0; i < sortedDomains.length; i++) {
      if (sampleLines.length >= maxSamples) break;
      const entry = sortedDomains[i];
      const cursor = cursors[i] ?? 0;
      if (!entry || cursor >= entry[1].length) continue;

      const [domain, bucket] = entry;
      const item = bucket[cursor];
      cursors[i] = cursor + 1;
      if (!item) continue;

      progressed = true;
      const cleanedTitle = cleanTitleForDigest(item.title);
      const tagSuffix =
        item.tags.length > 0 ? ` [${item.tags.slice(0, 3).join(', ')}]` : '';
      const line = `- ${domain}: ${cleanedTitle}${tagSuffix}\n`;

      if (output.length + line.length > maxChars) {
        progressed = false;
        break;
      }

      output += line;
      sampleLines.push(line);
    }
  }

  return {
    text: output.trimEnd(),
    totalLinks: links.length,
    uniqueDomains: sortedDomains.length,
    sampleCount: sampleLines.length,
  };
}

export interface RawProposedCategory {
  name?: unknown;
  description?: unknown;
  icon?: unknown;
}

/**
 * Deduplicates proposed category names (case-insensitive), trims descriptions,
 * strips leading numbering/bullets, excludes "Uncategorized", and enforces 3–10 max.
 */
export function sanitizeProposedCategories(
  rawCategories: readonly RawProposedCategory[],
  options: { maxCount?: number; createId?: () => string } = {},
): ProposedCategory[] {
  const maxCount = Math.min(10, Math.max(3, options.maxCount ?? 10));
  const createId = options.createId ?? (() => crypto.randomUUID());

  const seen = new Set<string>();
  const cleaned: ProposedCategory[] = [];

  for (const item of rawCategories) {
    if (typeof item.name !== 'string') continue;
    const normalizedName = item.name
      .trim()
      .replace(/^\d+[.)]\s*/, '')
      .replace(/^[-*#]+\s*/, '')
      .replace(/\s+/g, ' ')
      .slice(0, 40)
      .trim();

    if (!normalizedName) continue;
    const key = normalizedName.toLowerCase();
    if (key === UNCATEGORIZED_CATEGORY_NAME.toLowerCase()) continue;
    if (seen.has(key)) continue;

    seen.add(key);
    const description =
      typeof item.description === 'string'
        ? item.description.replace(/\s+/g, ' ').trim().slice(0, 120)
        : '';

    const rawIcon = typeof item.icon === 'string' ? item.icon.trim() : '';
    const icon = rawIcon && isValidCatalogIcon(rawIcon) ? rawIcon : undefined;

    cleaned.push({
      id: createId(),
      name: normalizedName,
      description,
      ...(icon ? { icon } : {}),
    });

    if (cleaned.length >= maxCount) break;
  }

  return cleaned;
}
