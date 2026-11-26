import { describe, expect, it } from 'vitest';
import { validateExportBundle } from '@/lib/import-export/bundle';
import {
  type Collection,
  DEFAULT_SETTINGS,
  type LinkItem,
} from '@/lib/types/stash';
import {
  collectSpaceTagStats,
  sortCollectionLinks,
} from '@/lib/utils/collection-sort';
import { groupAndFilterCollections } from '@/lib/utils/search';

const NOW = '2026-11-26T12:00:00.000Z';

function makeLink(partial: Partial<LinkItem> & { id: string }): LinkItem {
  return {
    collectionId: 'col-1',
    url: `https://example.com/${partial.id}`,
    title: partial.id,
    note: '',
    tags: [],
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

describe('sortCollectionLinks', () => {
  const items: LinkItem[] = [
    makeLink({
      id: 'c',
      title: 'Zebra',
      order: 0,
      createdAt: '2026-11-01T10:00:00.000Z',
      lastOpenedAt: '2026-11-20T10:00:00.000Z',
      product: { price: 25, orderQty: 2, source: 'manual' }, // 50
    }),
    makeLink({
      id: 'a',
      title: 'alpha',
      order: 1,
      createdAt: '2026-11-25T10:00:00.000Z',
      product: { price: 12, source: 'manual' }, // 12
    }),
    makeLink({
      id: 'b',
      title: 'Beta',
      order: 2,
      createdAt: '2026-11-15T10:00:00.000Z',
      lastOpenedAt: '2026-11-26T09:00:00.000Z',
    }),
  ];

  it('sorts by manual order, title A-Z, newest, and last-opened cleanly', () => {
    expect(sortCollectionLinks(items, 'manual').map((l) => l.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
    expect(sortCollectionLinks(items, 'title-asc').map((l) => l.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(sortCollectionLinks(items, 'newest').map((l) => l.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(sortCollectionLinks(items, 'last-opened').map((l) => l.id)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('sorts by line price ascending/descending while keeping unpriced items last', () => {
    expect(sortCollectionLinks(items, 'price-asc').map((l) => l.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
    expect(sortCollectionLinks(items, 'price-desc').map((l) => l.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });
});

describe('collectSpaceTagStats & multi-tag filtering', () => {
  const cols: Collection[] = [
    {
      id: 'col-1',
      name: 'Desk',
      color: 'green',
      spaceId: 'space-main',
      sortMode: 'title-asc',
      order: 0,
      collapsed: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 'col-2',
      name: 'Other',
      color: 'blue',
      spaceId: 'space-work',
      order: 1,
      collapsed: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];

  const links: LinkItem[] = [
    makeLink({
      id: '1',
      collectionId: 'col-1',
      title: 'Zed Editor',
      tags: ['dev', 'tools'],
      order: 0,
    }),
    makeLink({
      id: '2',
      collectionId: 'col-1',
      title: 'Biome',
      tags: ['dev', 'lint'],
      order: 1,
    }),
    makeLink({
      id: '3',
      collectionId: 'col-2',
      title: 'Work Docs',
      tags: ['work'],
      order: 0,
    }),
  ];

  it('counts tags scoped to active Space sorted by frequency then alphabetically', () => {
    const stats = collectSpaceTagStats(links, new Set(['col-1']));
    expect(stats).toEqual([
      { tag: 'dev', count: 2 },
      { tag: 'lint', count: 1 },
      { tag: 'tools', count: 1 },
    ]);
  });

  it('applies collection sortMode and AND multi-tag filtering in groupAndFilterCollections', () => {
    const allMain = groupAndFilterCollections(cols, links, '', {
      activeSpaceId: 'space-main',
    });
    expect(allMain[0]?.links.map((l) => l.title)).toEqual([
      'Biome',
      'Zed Editor',
    ]);

    const filtered = groupAndFilterCollections(cols, links, '', {
      activeSpaceId: 'space-main',
      selectedTags: ['dev', 'tools'],
    });
    expect(filtered[0]?.links.map((l) => l.id)).toEqual(['1']);
  });

  it('preserves collection sortMode through export bundle validation', () => {
    const res = validateExportBundle({
      app: 'stash',
      schemaVersion: 1,
      exportedAt: NOW,
      collections: cols,
      links,
      rules: [],
      settings: DEFAULT_SETTINGS,
      customThemes: [],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.bundle.collections[0]?.sortMode).toBe('title-asc');
      expect(res.bundle.collections[1]?.sortMode).toBeUndefined();
    }
  });
});
