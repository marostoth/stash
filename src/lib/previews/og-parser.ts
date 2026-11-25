export interface ParsedOgMetadata {
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
}

const MAX_HTML_SCAN_BYTES = 65_536;

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    );
}

function parseAttributes(tagBody: string): Map<string, string> {
  const attrs = new Map<string, string>();
  const attrRegex =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

  for (const match of tagBody.matchAll(attrRegex)) {
    const key = match[1]?.toLowerCase();
    const rawValue = match[2] ?? match[3] ?? match[4] ?? '';
    if (key) {
      attrs.set(key, decodeEntities(rawValue).trim());
    }
  }
  return attrs;
}

export function resolveSafeHttpImageUrl(
  rawImage: string | undefined,
  pageUrl: string,
): string | undefined {
  if (!rawImage) return undefined;
  const trimmed = rawImage.trim();
  if (!trimmed) return undefined;

  try {
    const resolved = new URL(trimmed, pageUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return undefined;
    }
    return resolved.toString();
  } catch {
    return undefined;
  }
}

/**
 * Pure MV3-service-worker-safe Open Graph & meta parser (never uses DOMParser).
 * Scans only up to </head> (capped at ~64KB) and supports arbitrary attribute
 * ordering and single/double/unquoted HTML attributes.
 */
export function parseOgFromHtml(
  html: string,
  pageUrl: string,
): ParsedOgMetadata {
  const bounded = html.slice(0, MAX_HTML_SCAN_BYTES);
  const headCloseIdx = bounded.search(/<\/head\s*>/i);
  const headSlice = headCloseIdx > 0 ? bounded.slice(0, headCloseIdx) : bounded;

  const metaValues = new Map<string, string>();
  const metaTagRegex = /<meta\b([^>]*?)\/?\s*>/gi;

  for (const match of headSlice.matchAll(metaTagRegex)) {
    const attrs = parseAttributes(match[1] ?? '');
    const key = (attrs.get('property') ?? attrs.get('name'))?.toLowerCase();
    const content = attrs.get('content');
    if (key && content && !metaValues.has(key)) {
      metaValues.set(key, content);
    }
  }

  const titleMatch = headSlice.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const pageTitle = titleMatch?.[1]
    ? decodeEntities(titleMatch[1].replace(/\s+/g, ' ')).trim()
    : undefined;

  const rawTitle =
    metaValues.get('og:title') ?? metaValues.get('twitter:title') ?? pageTitle;
  const rawDescription =
    metaValues.get('og:description') ??
    metaValues.get('twitter:description') ??
    metaValues.get('description');
  const rawImage =
    metaValues.get('og:image') ??
    metaValues.get('og:image:secure_url') ??
    metaValues.get('twitter:image') ??
    metaValues.get('twitter:image:src');

  const ogTitle = rawTitle ? rawTitle.slice(0, 160) : undefined;
  const ogDescription = rawDescription
    ? rawDescription.replace(/\s+/g, ' ').trim().slice(0, 240)
    : undefined;
  const ogImageUrl = resolveSafeHttpImageUrl(rawImage, pageUrl);

  return {
    ...(ogTitle ? { ogTitle } : {}),
    ...(ogDescription ? { ogDescription } : {}),
    ...(ogImageUrl ? { ogImageUrl } : {}),
  };
}
