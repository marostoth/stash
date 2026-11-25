import { describe, expect, it } from 'vitest';
import { selectLruEvictionKeys } from '@/lib/previews/cache';
import {
  isPreviewableUrl,
  shouldCaptureTab,
} from '@/lib/previews/capture-guard';
import {
  parseOgFromHtml,
  resolveSafeHttpImageUrl,
} from '@/lib/previews/og-parser';

describe('captureGuard', () => {
  it('skips internal schemes, incognito tabs, auth/checkout paths, and password managers', () => {
    expect(isPreviewableUrl('chrome://extensions')).toBe(false);
    expect(isPreviewableUrl('chrome-extension://abc/newtab.html')).toBe(false);
    expect(isPreviewableUrl('about:blank')).toBe(false);
    expect(isPreviewableUrl('file:///C:/secret.html')).toBe(false);
    expect(isPreviewableUrl('')).toBe(false);

    expect(
      shouldCaptureTab({
        url: 'https://github.com/wxt-dev/wxt',
        incognito: true,
      }),
    ).toBe(false);

    expect(isPreviewableUrl('https://example.com/login')).toBe(false);
    expect(isPreviewableUrl('https://example.com/auth/signin')).toBe(false);
    expect(isPreviewableUrl('https://example.com/oauth2/authorize')).toBe(
      false,
    );
    expect(isPreviewableUrl('https://shop.example.com/checkout/step-2')).toBe(
      false,
    );
    expect(isPreviewableUrl('https://app.example.com/billing')).toBe(false);
    expect(isPreviewableUrl('https://example.com/reset-password')).toBe(false);

    expect(isPreviewableUrl('https://vault.bitwarden.com/#/vault')).toBe(false);
    expect(isPreviewableUrl('https://my.1password.com/home')).toBe(false);
    expect(isPreviewableUrl('https://accounts.google.com/v3/signin')).toBe(
      false,
    );
  });

  it('permits standard public web pages in normal windows', () => {
    expect(
      shouldCaptureTab({
        url: 'https://github.com/wxt-dev/wxt',
        incognito: false,
      }),
    ).toBe(true);
    expect(isPreviewableUrl('https://bambulab.com/en/a1')).toBe(true);
    expect(isPreviewableUrl('http://localhost:3000/dashboard')).toBe(true);
  });
});

describe('ogParser', () => {
  it('extracts OG and Twitter metadata regardless of attribute order or quote style', () => {
    const html = `<!doctype html>
      <html>
        <head>
          <title>Fallback Title</title>
          <meta content='Bambu Lab A1 &amp; AMS' property='og:title' />
          <meta name="description" content="Fallback description" />
          <meta content="Multi-color 3D printer for &#39;makers&#39;" property="og:description">
          <meta content="/assets/a1-hero.webp" property="og:image" />
        </head>
        <body><p>Body</p></body>
      </html>`;

    const parsed = parseOgFromHtml(html, 'https://bambulab.com/en/a1');
    expect(parsed).toEqual({
      ogTitle: 'Bambu Lab A1 & AMS',
      ogDescription: "Multi-color 3D printer for 'makers'",
      ogImageUrl: 'https://bambulab.com/assets/a1-hero.webp',
    });
  });

  it('falls back to twitter:image / meta description / <title> and blocks unsafe image schemes', () => {
    const html = `
      <head>
        <title>WXT Docs</title>
        <meta name="description" content="Next-gen web extension framework" />
        <meta property="og:image" content="javascript:alert(1)" />
      </head>`;
    const unsafeParsed = parseOgFromHtml(html, 'https://wxt.dev/guide');
    expect(unsafeParsed.ogTitle).toBe('WXT Docs');
    expect(unsafeParsed.ogDescription).toBe('Next-gen web extension framework');
    expect(unsafeParsed.ogImageUrl).toBeUndefined();

    const twitterHtml = `
      <head>
        <meta content="//cdn.wxt.dev/social.png" name="twitter:image" />
      </head>`;
    expect(parseOgFromHtml(twitterHtml, 'https://wxt.dev').ogImageUrl).toBe(
      'https://cdn.wxt.dev/social.png',
    );

    expect(
      resolveSafeHttpImageUrl('data:image/png;base64,AAAA', 'https://wxt.dev'),
    ).toBeUndefined();
    expect(
      resolveSafeHttpImageUrl('javascript:void(0)', 'https://wxt.dev'),
    ).toBeUndefined();
  });
});

describe('preview cache LRU eviction helper', () => {
  it('evicts only the oldest lastAccessedAt entries beyond maxEntries', () => {
    const entries = [
      { url: 'https://a.dev', lastAccessedAt: 300 },
      { url: 'https://b.dev', lastAccessedAt: 100 },
      { url: 'https://c.dev', lastAccessedAt: 400 },
      { url: 'https://d.dev', lastAccessedAt: 200 },
    ];

    expect(selectLruEvictionKeys(entries, 4)).toEqual([]);
    expect(selectLruEvictionKeys(entries, 10)).toEqual([]);
    expect(selectLruEvictionKeys(entries, 2)).toEqual([
      'https://b.dev',
      'https://d.dev',
    ]);
  });
});
