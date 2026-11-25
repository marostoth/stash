export type LinkHealthStatus = 'alive' | 'dead' | 'needs_review';

export interface FetchProbeResult {
  originalUrl: string;
  finalUrl?: string;
  status?: number;
  title?: string;
  snippet?: string;
  error?: string;
}

export interface HealthClassification {
  status: LinkHealthStatus;
  reason: string;
  suspiciousForAi?: boolean;
}

const PARKED_OR_EXPIRED_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  reason: string;
}> = [
  { pattern: /\bdomain\s+is\s+for\s+sale\b/i, reason: 'Parked domain' },
  { pattern: /\bthis\s+domain\s+is\s+for\s+sale\b/i, reason: 'Parked domain' },
  { pattern: /\bbuy\s+this\s+domain\b/i, reason: 'Parked domain' },
  { pattern: /\binquire\s+about\s+this\s+domain\b/i, reason: 'Parked domain' },
  { pattern: /\bdomain\s+for\s+sale\b/i, reason: 'Parked domain' },
  { pattern: /\bsedo\s+domain\s+parking\b/i, reason: 'Parked domain' },
  { pattern: /\bhugedomains\b/i, reason: 'Parked domain' },
  { pattern: /\bparked\s+free\b/i, reason: 'Parked domain' },
  { pattern: /\bthis\s+domain\s+has\s+expired\b/i, reason: 'Expired domain' },
  { pattern: /\bdomain\s+has\s+expired\b/i, reason: 'Expired domain' },
  { pattern: /\bdomain\s+expired\b/i, reason: 'Expired domain' },
  { pattern: /\baccount\s+suspended\b/i, reason: 'Account suspended' },
  {
    pattern: /\bthis\s+account\s+has\s+been\s+suspended\b/i,
    reason: 'Account suspended',
  },
];

const SOFT_404_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b404\s*[-:|–—]?\s*not\s+found\b/i, reason: 'Soft 404' },
  { pattern: /\bpage\s+not\s+found\b/i, reason: 'Soft 404' },
  { pattern: /\berror\s+404\b/i, reason: 'Soft 404' },
  { pattern: /\b404\s+error\b/i, reason: 'Soft 404' },
  { pattern: /\bfile\s+not\s+found\b/i, reason: 'Soft 404' },
  {
    pattern: /\bthe\s+requested\s+url\s+was\s+not\s+found\b/i,
    reason: 'Soft 404',
  },
  {
    pattern:
      /\bpage\s+you\s+(?:are\s+looking\s+for|requested)\s+(?:could\s+not|cannot)\s+be\s+found\b/i,
    reason: 'Soft 404',
  },
  { pattern: /\bthis\s+page\s+no\s+longer\s+exists\b/i, reason: 'Soft 404' },
];

const SUSPICIOUS_HINT_PATTERN =
  /\b(for\s+sale|parked|coming\s+soon|under\s+construction|expired|suspended|not\s+found|404)\b/i;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

/**
 * Pure MV3-service-worker-safe HTML title & short head/body snippet extractor.
 * Never uses DOMParser.
 */
export function extractTitleAndSnippetFromHtml(html: string): {
  title: string;
  snippet: string;
} {
  const bounded = html.slice(0, 16_384);
  const titleMatch = bounded.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  const title = titleMatch?.[1]
    ? decodeHtmlEntities(titleMatch[1])
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180)
    : '';

  const withoutIgnoredBlocks = bounded
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi, ' ');

  const bodyStartIdx = withoutIgnoredBlocks.search(/<body\b[^>]*>/i);
  const textRegion =
    bodyStartIdx >= 0
      ? withoutIgnoredBlocks.slice(bodyStartIdx)
      : withoutIgnoredBlocks;

  const snippet = decodeHtmlEntities(textRegion.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);

  return { title, snippet };
}

/**
 * Detects when a deep URL path (e.g. /blog/post-name) redirected straight
 * to the domain root (/), a common signal of silent content removal.
 */
export function isDeepPathToRootRedirect(
  originalUrl: string,
  finalUrl: string | undefined,
): boolean {
  if (!finalUrl) return false;
  try {
    const orig = new URL(originalUrl);
    const dest = new URL(finalUrl);

    const origPath = orig.pathname.replace(/\/+$/, '');
    const destPath = dest.pathname.replace(/\/+$/, '');

    // Original must have a meaningful non-root path
    if (!origPath || origPath === '/index.html' || origPath === '/index.htm') {
      return false;
    }

    // Destination must land at the root with no query string
    const destIsRoot =
      destPath === '' ||
      destPath === '/index.html' ||
      destPath === '/index.htm';
    if (!destIsRoot || dest.search.length > 0) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function matchSoftDeadSignal(title: string, snippet: string): string | null {
  const combined = `${title}\n${snippet}`;

  for (const { pattern, reason } of PARKED_OR_EXPIRED_PATTERNS) {
    if (pattern.test(combined)) {
      return reason;
    }
  }

  for (const { pattern, reason } of SOFT_404_PATTERNS) {
    if (pattern.test(combined)) {
      return reason;
    }
  }

  return null;
}

/**
 * Pure classifier mapping a fetched URL probe into alive / dead / needs_review
 * with a short human-readable reason.
 */
export function classifyLinkHealth(
  probe: FetchProbeResult,
): HealthClassification {
  if (probe.error) {
    const lowerErr = probe.error.toLowerCase();
    if (
      lowerErr.includes('timeout') ||
      lowerErr.includes('abort') ||
      lowerErr.includes('timed out')
    ) {
      return { status: 'needs_review', reason: 'Timed out' };
    }
    return { status: 'dead', reason: 'Connection failed' };
  }

  const status = probe.status;
  if (typeof status !== 'number') {
    return { status: 'dead', reason: 'No response' };
  }

  if (status === 404) {
    return { status: 'dead', reason: '404 Not Found' };
  }
  if (status === 410) {
    return { status: 'dead', reason: '410 Gone' };
  }
  if (status === 401) {
    return { status: 'needs_review', reason: 'Auth required (401)' };
  }
  if (status === 403) {
    return { status: 'needs_review', reason: 'Blocked (403)' };
  }
  if (status === 429) {
    return { status: 'needs_review', reason: 'Rate limited (429)' };
  }
  if (status >= 500 && status <= 599) {
    return { status: 'needs_review', reason: `Server error (${status})` };
  }
  if (status >= 400 && status < 500) {
    return { status: 'needs_review', reason: `HTTP ${status}` };
  }

  // 2xx / 3xx responses
  const title = (probe.title ?? '').trim();
  const snippet = (probe.snippet ?? '').trim();

  if (status === 200) {
    const softDeadReason = matchSoftDeadSignal(title, snippet);
    if (softDeadReason) {
      return { status: 'dead', reason: softDeadReason };
    }
  }

  if (isDeepPathToRootRedirect(probe.originalUrl, probe.finalUrl)) {
    return { status: 'needs_review', reason: 'Redirected to root' };
  }

  if (
    status === 200 &&
    ((title === '' && snippet.length > 0) ||
      SUSPICIOUS_HINT_PATTERN.test(`${title}\n${snippet}`))
  ) {
    return { status: 'alive', reason: 'OK', suspiciousForAi: true };
  }

  return { status: 'alive', reason: 'OK' };
}
