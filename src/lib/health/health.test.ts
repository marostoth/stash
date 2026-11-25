import { describe, expect, it } from 'vitest';
import {
  classifyLinkHealth,
  extractTitleAndSnippetFromHtml,
  isDeepPathToRootRedirect,
} from '@/lib/health/classifier';
import {
  detectClutter,
  isLocalDevUrl,
  isSearchResultUrl,
} from '@/lib/health/clutter';
import { buildUniqueScanTargets } from '@/lib/health/scanner';
import type { LinkItem } from '@/lib/types/stash';

function makeLink(
  overrides: Partial<LinkItem> & { id: string; url: string },
): LinkItem {
  return {
    collectionId: 'col-1',
    title: 'Sample Link',
    note: '',
    tags: [],
    order: 0,
    createdAt: '2026-11-25T12:00:00.000Z',
    updatedAt: '2026-11-25T12:00:00.000Z',
    ...overrides,
  };
}

describe('health/classifier', () => {
  it('marks 404, 410, and DNS/connection failures as dead', () => {
    expect(
      classifyLinkHealth({
        originalUrl: 'https://example.com/old',
        status: 404,
      }),
    ).toEqual({ status: 'dead', reason: '404 Not Found' });

    expect(
      classifyLinkHealth({
        originalUrl: 'https://example.com/gone',
        status: 410,
      }),
    ).toEqual({ status: 'dead', reason: '410 Gone' });

    expect(
      classifyLinkHealth({
        originalUrl: 'https://nonexistent.invalid',
        error: 'TypeError: Failed to fetch',
      }),
    ).toEqual({ status: 'dead', reason: 'Connection failed' });
  });

  it('detects parked domains, expired domains, account suspended, and soft-404s on HTTP 200', () => {
    expect(
      classifyLinkHealth({
        originalUrl: 'https://oldstartup.com',
        finalUrl: 'https://oldstartup.com/',
        status: 200,
        title: 'oldstartup.com - This domain is for sale',
        snippet: 'Buy this domain today.',
      }),
    ).toMatchObject({ status: 'dead', reason: 'Parked domain' });

    expect(
      classifyLinkHealth({
        originalUrl: 'https://expired-site.org',
        status: 200,
        title: 'Notice',
        snippet: 'This domain has expired. Contact your registrar.',
      }),
    ).toMatchObject({ status: 'dead', reason: 'Expired domain' });

    expect(
      classifyLinkHealth({
        originalUrl: 'https://suspended.example',
        status: 200,
        title: 'Account Suspended',
        snippet: 'This account has been suspended.',
      }),
    ).toMatchObject({ status: 'dead', reason: 'Account suspended' });

    expect(
      classifyLinkHealth({
        originalUrl: 'https://blog.example/missing-post',
        status: 200,
        title: 'Page Not Found | Blog',
        snippet: 'Sorry, we could not find what you were looking for.',
      }),
    ).toMatchObject({ status: 'dead', reason: 'Soft 404' });

    expect(
      classifyLinkHealth({
        originalUrl: 'https://docs.example/gone',
        status: 200,
        title: 'Docs',
        snippet: '404 Not Found — the requested URL was not found.',
      }),
    ).toMatchObject({ status: 'dead', reason: 'Soft 404' });
  });

  it('marks 403/401/429 bot-walls, 5xx errors, timeouts, and deep-path-to-root redirects as needs_review', () => {
    expect(
      classifyLinkHealth({
        originalUrl: 'https://cloudflare-protected.dev',
        status: 403,
      }),
    ).toEqual({ status: 'needs_review', reason: 'Blocked (403)' });

    expect(
      classifyLinkHealth({
        originalUrl: 'https://private.app/dashboard',
        status: 401,
      }),
    ).toEqual({ status: 'needs_review', reason: 'Auth required (401)' });

    expect(
      classifyLinkHealth({
        originalUrl: 'https://api.example.com',
        status: 429,
      }),
    ).toEqual({ status: 'needs_review', reason: 'Rate limited (429)' });

    expect(
      classifyLinkHealth({
        originalUrl: 'https://flaky.example.com',
        status: 503,
      }),
    ).toEqual({ status: 'needs_review', reason: 'Server error (503)' });

    expect(
      classifyLinkHealth({
        originalUrl: 'https://slow.example.com',
        error: 'timeout',
      }),
    ).toEqual({ status: 'needs_review', reason: 'Timed out' });

    expect(
      classifyLinkHealth({
        originalUrl: 'https://news.example.com/blog/2021/retired-article',
        finalUrl: 'https://news.example.com/',
        status: 200,
        title: 'News Example — Home',
        snippet: 'Welcome to our homepage.',
      }),
    ).toEqual({ status: 'needs_review', reason: 'Redirected to root' });
  });

  it('marks healthy 200 pages and normal root URLs as alive', () => {
    expect(
      classifyLinkHealth({
        originalUrl: 'https://react.dev/reference/react',
        finalUrl: 'https://react.dev/reference/react',
        status: 200,
        title: 'React Reference Overview – React',
        snippet: 'This section provides detailed reference documentation.',
      }),
    ).toEqual({ status: 'alive', reason: 'OK' });

    // Root-to-root redirect (e.g. http -> https or adding trailing slash) is healthy
    expect(
      isDeepPathToRootRedirect('https://react.dev', 'https://react.dev/'),
    ).toBe(false);
    expect(
      classifyLinkHealth({
        originalUrl: 'https://react.dev',
        finalUrl: 'https://react.dev/',
        status: 200,
        title: 'React',
        snippet: 'The library for web and native user interfaces.',
      }),
    ).toEqual({ status: 'alive', reason: 'OK' });
  });

  it('extracts title and clean text snippet without DOMParser', () => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <title>Buy &amp; Sell &mdash; Example</title>
          <style>.hidden { display: none; }</style>
        </head>
        <body>
          <script>window.__ignored = "404 Not Found";</script>
          <h1>Welcome to Example</h1>
          <p>Clean readable body snippet.</p>
        </body>
      </html>
    `;
    const extracted = extractTitleAndSnippetFromHtml(html);
    expect(extracted.title).toBe('Buy & Sell — Example');
    expect(extracted.snippet).toContain('Welcome to Example');
    expect(extracted.snippet).toContain('Clean readable body snippet.');
    expect(extracted.snippet).not.toContain('window.__ignored');
  });
});

describe('health/clutter', () => {
  it('flags cross-collection duplicates, local/dev URLs, and search-engine result pages', () => {
    const links: LinkItem[] = [
      makeLink({
        id: 'dup-1',
        collectionId: 'col-a',
        url: 'https://github.com/wxt-dev/wxt/',
      }),
      makeLink({
        id: 'dup-2',
        collectionId: 'col-b',
        url: 'https://GitHub.com:443/wxt-dev/wxt',
      }),
      makeLink({
        id: 'local-1',
        url: 'http://localhost:3000/dashboard',
      }),
      makeLink({
        id: 'local-2',
        url: 'http://127.0.0.1:8080/api',
      }),
      makeLink({
        id: 'local-3',
        url: 'http://printer.local/status',
      }),
      makeLink({
        id: 'search-google',
        url: 'https://www.google.com/search?q=chrome+mv3+permissions',
      }),
      makeLink({
        id: 'search-bing',
        url: 'https://www.bing.com/search?q=react+19',
      }),
      makeLink({
        id: 'search-ddg',
        url: 'https://duckduckgo.com/?q=vitest+config',
      }),
      makeLink({
        id: 'clean-1',
        url: 'https://developer.chrome.com/docs/extensions',
      }),
    ];

    const findings = detectClutter(links);
    const byId = new Map(findings.map((f) => [f.linkId, f]));

    expect(byId.get('dup-1')).toMatchObject({
      kind: 'duplicate',
      duplicateCount: 2,
    });
    expect(byId.get('dup-2')).toMatchObject({
      kind: 'duplicate',
      duplicateCount: 2,
    });
    expect(byId.get('dup-1')?.duplicateGroupKey).toBe(
      byId.get('dup-2')?.duplicateGroupKey,
    );

    expect(byId.get('local-1')?.kind).toBe('local');
    expect(byId.get('local-2')?.kind).toBe('local');
    expect(byId.get('local-3')?.kind).toBe('local');
    expect(isLocalDevUrl('http://0.0.0.0:5173')).toBe(true);
    expect(isLocalDevUrl('https://example.com')).toBe(false);

    expect(byId.get('search-google')?.kind).toBe('search');
    expect(byId.get('search-bing')?.kind).toBe('search');
    expect(byId.get('search-ddg')?.kind).toBe('search');
    expect(isSearchResultUrl('https://google.co.uk/search?q=test')).toBe(true);
    expect(isSearchResultUrl('https://docs.google.com/document/d/123')).toBe(
      false,
    );

    expect(byId.has('clean-1')).toBe(false);
  });

  it('deduplicates unique scan targets and skips local/non-http URLs', () => {
    const targets = buildUniqueScanTargets([
      'https://example.com/a/',
      'https://EXAMPLE.com:443/a',
      'http://localhost:5173',
      'chrome://extensions',
      'https://react.dev',
    ]);
    expect(targets.map((t) => t.normalizedUrl)).toEqual([
      'https://example.com/a',
      'https://react.dev',
    ]);
  });
});
