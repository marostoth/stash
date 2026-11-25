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
