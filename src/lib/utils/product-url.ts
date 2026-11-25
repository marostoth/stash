const TRACKING_EXACT_PARAMS = new Set([
  'fbclid',
  'gclid',
  'ref',
  'ref_',
  'qid',
  'sr',
  'dib',
  'dib_tag',
  'keywords',
  'sprefix',
  'crid',
]);

const TRACKING_PREFIXES = ['utm_', 'pd_rd_', 'pf_rd_'];

const AMAZON_HOST_PATTERN = /(^|\.)amazon\.[a-z.]+$/i;
const AMAZON_ASIN_PATTERN = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?#]|$)/i;

const KNOWN_STORE_RULES: ReadonlyArray<{
  match: (host: string) => boolean;
  name: string;
}> = [
  { match: (h) => /(^|\.)amazon\.co\.uk$/i.test(h), name: 'Amazon UK' },
  { match: (h) => /(^|\.)amazon\.com$/i.test(h), name: 'Amazon US' },
  { match: (h) => /(^|\.)amazon\.de$/i.test(h), name: 'Amazon DE' },
  { match: (h) => /(^|\.)bambulab\.com$/i.test(h), name: 'Bambu Lab' },
  { match: (h) => /(^|\.)screwfix\.com$/i.test(h), name: 'Screwfix' },
  { match: (h) => /(^|\.)aliexpress\.com$/i.test(h), name: 'AliExpress' },
  { match: (h) => /(^|\.)jlcpcb\.com$/i.test(h), name: 'JLCPCB' },
  { match: (h) => /(^|\.)jlc3dp\.com$/i.test(h), name: 'JLC3DP' },
  { match: (h) => /(^|\.)ebay\.co\.uk$/i.test(h), name: 'eBay UK' },
  { match: (h) => /(^|\.)ebay\.com$/i.test(h), name: 'eBay' },
  { match: (h) => /(^|\.)ikea\.com$/i.test(h), name: 'IKEA' },
];

const STRIP_SUBDOMAIN_PREFIXES = new Set([
  'www',
  'uk',
  'us',
  'eu',
  'store',
  'shop',
  'm',
]);

/**
 * Strips common tracking/session query parameters and canonicalizes Amazon
 * product URLs to `https://<host>/dp/<ASIN>` when a 10-char ASIN is present.
 */
export function cleanProductUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return trimmed;
  }

  // Canonicalize Amazon product pages cleanly to https://<host>/dp/<ASIN>
  if (AMAZON_HOST_PATTERN.test(parsed.hostname)) {
    const asinMatch = parsed.pathname.match(AMAZON_ASIN_PATTERN);
    if (asinMatch?.[1]) {
      return `https://${parsed.hostname.toLowerCase()}/dp/${asinMatch[1].toUpperCase()}`;
    }
  }

  const keysToDelete: string[] = [];
  for (const key of parsed.searchParams.keys()) {
    const lower = key.toLowerCase();
    if (
      TRACKING_EXACT_PARAMS.has(lower) ||
      TRACKING_PREFIXES.some((prefix) => lower.startsWith(prefix))
    ) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    parsed.searchParams.delete(key);
  }

  return parsed.toString();
}

function titleCaseLabel(label: string): string {
  return label
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalizes a store display name from an explicit override or the link's URL.
 */
export function normalizeStoreName(rawUrl: string, override?: string): string {
  const trimmedOverride = override?.trim();
  if (trimmedOverride) return trimmedOverride;

  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return rawUrl.trim() || 'Unknown Store';
  }

  for (const rule of KNOWN_STORE_RULES) {
    if (rule.match(host)) return rule.name;
  }

  const parts = host.split('.').filter(Boolean);
  let cursor = 0;
  while (
    cursor < parts.length - 2 &&
    STRIP_SUBDOMAIN_PREFIXES.has(parts[cursor] ?? '')
  ) {
    cursor += 1;
  }
  const remaining = parts.slice(cursor);
  const primary = remaining[0] ?? host;
  return titleCaseLabel(primary);
}
