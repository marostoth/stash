const SAFE_RASTER_DATA_IMAGE_RE =
  /^data:image\/(png|jpeg|jpg|webp|gif|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/=]+$/i;
const MAX_DATA_FAVICON_LENGTH = 32_768;

/**
 * Returns true strictly for valid `http:` or `https:` URLs with a non-empty host.
 */
export function isSafeHttpUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Returns a trimmed `http:` / `https:` URL safe for `<a href>` and navigation
 * sinks, or `undefined` if the URL uses an unsafe/malformed scheme (e.g.
 * `javascript:`, `data:`, `file:`, `chrome:`).
 */
export function toSafeHref(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return isSafeHttpUrl(trimmed) ? trimmed : undefined;
}

/**
 * Restricts favicon URLs to valid `http:` / `https:` URLs or bounded raster
 * `data:image/(png|jpeg|webp|gif|x-icon);base64,` URIs (blocking SVG scripts,
 * `javascript:`, `chrome-extension:`, `chrome:`, and `file:` schemes).
 */
export function sanitizeFaviconUrl(
  raw: string | undefined,
): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (isSafeHttpUrl(trimmed)) return trimmed;
  if (
    trimmed.length <= MAX_DATA_FAVICON_LENGTH &&
    SAFE_RASTER_DATA_IMAGE_RE.test(trimmed)
  ) {
    return trimmed;
  }
  return undefined;
}

/**
 * Ensures a user-entered URL has an explicit scheme (defaults to https://).
 * Returns null if the resulting string is not a valid http(s) URL.
 */
export function normalizeInputUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.hostname) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Lightly normalizes a URL for Duplicate URL Guard comparisons:
 * - Lowercases protocol and hostname
 * - Strips default ports (:80 / :443)
 * - Removes trailing slashes on the path so `https://a.com` === `https://a.com/`
 *   and `https://a.com/docs/` === `https://a.com/docs`
 */
export function normalizeUrlForComparison(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    const port =
      (protocol === 'http:' && parsed.port === '80') ||
      (protocol === 'https:' && parsed.port === '443')
        ? ''
        : parsed.port
          ? `:${parsed.port}`
          : '';
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${protocol}//${hostname}${port}${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return trimmed.replace(/\/+$/, '').toLowerCase();
  }
}

export function extractDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return rawUrl;
  }
}

export function getMonogram(title: string, url: string): string {
  const source = title.trim() || extractDomain(url);
  const match = source.match(/[a-zA-Z0-9]/);
  return match ? match[0].toUpperCase() : '?';
}

export function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const cleaned = raw.trim().replace(/^#+/, '').toLowerCase();
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned);
      result.push(cleaned);
    }
  }
  return result;
}

export function parseTagsInput(raw: string): string[] {
  return normalizeTags(raw.split(/[\s,]+/));
}
