import { describe, expect, it } from 'vitest';
import {
  CATALOG_ICON_KEYS,
  filterIconCatalog,
  getCatalogIcon,
  ICON_CATALOG,
  isValidCatalogIcon,
  matchFallbackLinkIcon,
} from '@/lib/icons/catalog';

describe('icons/catalog', () => {
  it('provides a deduplicated curated whitelist of 48 everyday icons', () => {
    expect(ICON_CATALOG.length).toBe(48);
    expect(new Set(CATALOG_ICON_KEYS).size).toBe(ICON_CATALOG.length);
    expect(isValidCatalogIcon('terminal')).toBe(true);
    expect(isValidCatalogIcon('gamepad-2')).toBe(true);
    expect(isValidCatalogIcon('bar-chart-2')).toBe(true);
    expect(isValidCatalogIcon('not-a-real-icon')).toBe(false);
    expect(isValidCatalogIcon('🔥')).toBe(false);
    expect(isValidCatalogIcon('')).toBe(false);
    expect(getCatalogIcon('printer')).not.toBeNull();
    expect(getCatalogIcon('unknown')).toBeNull();
  });

  it('filters catalog icons case-insensitively across key, label, and keywords', () => {
    expect(filterIconCatalog('')).toHaveLength(ICON_CATALOG.length);
    expect(filterIconCatalog('   ')).toHaveLength(ICON_CATALOG.length);

    const byKey = filterIconCatalog('gamepad-2');
    expect(byKey.map((i) => i.key)).toEqual(['gamepad-2']);

    const byKeyword = filterIconCatalog('CAD');
    expect(byKeyword.some((i) => i.key === 'printer')).toBe(true);

    const byLabel = filterIconCatalog('Investing');
    expect(byLabel.some((i) => i.key === 'trending-up')).toBe(true);

    const multiToken = filterIconCatalog('ai robot');
    expect(multiToken.map((i) => i.key)).toEqual(['bot']);

    expect(filterIconCatalog('zzznomatchzzz')).toEqual([]);
  });

  it('matches crisp fallback link icons for common domains and PDF URLs', () => {
    expect(matchFallbackLinkIcon('https://github.com/wxt-dev/wxt')).toBe(
      'code',
    );
    expect(matchFallbackLinkIcon('https://gitlab.com/org/repo')).toBe('code');
    expect(matchFallbackLinkIcon('https://www.youtube.com/watch?v=123')).toBe(
      'play-circle',
    );
    expect(matchFallbackLinkIcon('https://youtu.be/abc')).toBe('play-circle');
    expect(matchFallbackLinkIcon('https://vimeo.com/12345')).toBe(
      'play-circle',
    );
    expect(
      matchFallbackLinkIcon('https://arxiv.org/pdf/2401.12345.pdf?download=1'),
    ).toBe('file-text');
    expect(
      matchFallbackLinkIcon('https://example.org/files/Manual.PDF#page=2'),
    ).toBe('file-text');
    expect(matchFallbackLinkIcon('https://www.reddit.com/r/typescript')).toBe(
      'message-square',
    );
    expect(
      matchFallbackLinkIcon('https://news.ycombinator.com/item?id=1'),
    ).toBe('message-square');
    expect(matchFallbackLinkIcon('https://x.com/chrome')).toBe('at-sign');
    expect(matchFallbackLinkIcon('https://twitter.com/chrome')).toBe('at-sign');
    expect(matchFallbackLinkIcon('https://unknown-blog.example.net')).toBe(
      'globe',
    );
    expect(matchFallbackLinkIcon('not a url')).toBe('globe');
  });
});
