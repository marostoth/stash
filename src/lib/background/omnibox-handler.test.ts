import { describe, expect, it } from 'vitest';
import {
  escapeOmniboxXml,
  highlightOmniboxText,
  isSafeHttpUrl,
  rankAndBuildOmniboxSuggestions,
} from '@/lib/background/omnibox-handler';
import type { Collection, LinkItem } from '@/lib/types/stash';

const NOW = '2026-11-25T12:00:00.000Z';

const collections: Collection[] = [
  {
    id: 'c-finance',
    name: 'Finance & Trading',
    color: 'green',
    order: 0,
    collapsed: false,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'c-dev',
    name: 'Web Dev',
    color: 'blue',
    order: 1,
    collapsed: false,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

const links: LinkItem[] = [
  {
    id: 'l-plain',
    collectionId: 'c-dev',
    url: 'https://example.com/react-notes',
    title: 'General Notes',
    note: 'Contains react snippet',
    tags: ['notes'],
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'l-title',
    collectionId: 'c-dev',
    url: 'https://react.dev/learn',
    title: 'React Documentation',
    note: 'Official guide',
    tags: ['react', 'docs'],
    order: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'l-starred',
    collectionId: 'c-finance',
    url: 'https://tradingview.com/react-charts',
    title: 'Trading & Charts <Live>',
    note: 'React charting setup',
    tags: ['trading', 'react'],
    starred: true,
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'l-unsafe',
    collectionId: 'c-dev',
    url: 'javascript:alert(1)',
    title: 'React Unsafe',
    note: '',
    tags: ['react'],
    order: 2,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('omnibox-handler pure helpers', () => {
  it('strictly XML-escapes special characters before and during highlighting', () => {
    expect(escapeOmniboxXml(`Trading & <Finance> "Pro" '1'`)).toBe(
      'Trading &amp; &lt;Finance&gt; &quot;Pro&quot; &apos;1&apos;',
    );

    const highlighted = highlightOmniboxText('Trading & <Charts>', [
      'trading',
      '&',
    ]);
    expect(highlighted).toBe(
      '<match>Trading</match> <match>&amp;</match> &lt;Charts&gt;',
    );
    expect(highlighted).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it('validates only explicit http(s) URLs as safe', () => {
    expect(isSafeHttpUrl('https://react.dev/learn')).toBe(true);
    expect(isSafeHttpUrl('http://localhost:3000')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('chrome://settings')).toBe(false);
    expect(isSafeHttpUrl('react docs')).toBe(false);
    expect(isSafeHttpUrl('')).toBe(false);
  });

  it('ranks starred and title/domain matches ahead of note-only matches and escapes XML in output', () => {
    const results = rankAndBuildOmniboxSuggestions(
      collections,
      links,
      'react',
      6,
    );

    // Unsafe javascript: URL must be excluded
    expect(results.map((r) => r.content)).toEqual([
      'https://react.dev/learn',
      'https://tradingview.com/react-charts',
      'https://example.com/react-notes',
    ]);

    // Starred link with `&` and `<Live>` in title + `&` in collection name must be safely XML-escaped
    const tradingItem = results.find(
      (r) => r.content === 'https://tradingview.com/react-charts',
    );
    expect(tradingItem?.description).toContain('★ ');
    expect(tradingItem?.description).toContain(
      'Trading &amp; Charts &lt;Live&gt;',
    );
    expect(tradingItem?.description).toContain('Finance &amp; Trading');
    expect(tradingItem?.description).not.toMatch(
      /&(?!amp;|lt;|gt;|quot;|apos;)/,
    );
  });

  it('boosts starred links above equally matched non-starred links', () => {
    const tiedLinks: LinkItem[] = [
      {
        id: 'a',
        collectionId: 'c-dev',
        url: 'https://alpha.dev/guide',
        title: 'Alpha Guide',
        note: '',
        tags: ['guide'],
        order: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'b',
        collectionId: 'c-dev',
        url: 'https://beta.dev/guide',
        title: 'Beta Guide',
        note: '',
        tags: ['guide'],
        starred: true,
        order: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];

    const results = rankAndBuildOmniboxSuggestions(
      collections,
      tiedLinks,
      'guide',
      6,
    );
    expect(results[0]?.content).toBe('https://beta.dev/guide');
  });
});
