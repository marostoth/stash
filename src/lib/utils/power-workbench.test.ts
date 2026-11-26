import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { stashRepo } from '@/lib/storage/repo';
import type { Collection, LinkItem, Space } from '@/lib/types/stash';
import { findCrossSpaceDuplicates } from '@/lib/utils/duplicates';
import { groupAndFilterCollections } from '@/lib/utils/search';

const NOW_ISO = '2026-11-26T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

function makeSpace(id: string, name: string): Space {
  return {
    id,
    name,
    order: 0,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };
}

function makeCollection(
  id: string,
  name: string,
  spaceId = 'space-main',
): Collection {
  return {
    id,
    name,
    color: 'green',
    spaceId,
    order: 0,
    collapsed: false,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  };
}

function makeLink(overrides: Partial<LinkItem>): LinkItem {
  return {
    id: overrides.id ?? 'l-1',
    collectionId: overrides.collectionId ?? 'c-1',
    url: overrides.url ?? 'https://example.com/page',
    title: overrides.title ?? 'Example',
    note: overrides.note ?? '',
    tags: overrides.tags ?? [],
    order: overrides.order ?? 0,
    createdAt: overrides.createdAt ?? NOW_ISO,
    updatedAt: NOW_ISO,
    ...overrides,
  };
}

describe('Smart Filter Views', () => {
  const cols = [makeCollection('c-1', 'Dev')];
  const links = [
    makeLink({
      id: 'recent',
      title: 'Fresh Link',
      createdAt: '2026-11-25T10:00:00.000Z',
      tags: ['dev'],
    }),
    makeLink({
      id: 'old-opened',
      title: 'Frequently Used',
      createdAt: '2026-09-01T10:00:00.000Z',
      lastOpenedAt: '2026-11-26T11:00:00.000Z',
      tags: [],
    }),
  ];

  it('filters recent (7d), frequent (opened), and untagged links accurately', () => {
    const recent = groupAndFilterCollections(cols, links, '', {
      smartFilter: 'recent',
      nowMs: NOW_MS,
    });
    expect(recent[0]?.links.map((l) => l.id)).toEqual(['recent']);

    const frequent = groupAndFilterCollections(cols, links, '', {
      smartFilter: 'frequent',
      nowMs: NOW_MS,
    });
    expect(frequent[0]?.links.map((l) => l.id)).toEqual(['old-opened']);

    const untagged = groupAndFilterCollections(cols, links, '', {
      smartFilter: 'untagged',
      nowMs: NOW_MS,
    });
    expect(untagged[0]?.links.map((l) => l.id)).toEqual(['old-opened']);
  });
});

describe('Cross-Space Duplicate Finder', () => {
  it('groups normalized duplicate URLs across Spaces and recommends keeping the richest copy', () => {
    const spaces = [
      makeSpace('space-main', 'Main'),
      makeSpace('space-shop', 'Shopping'),
    ];
    const cols = [
      makeCollection('c-1', 'Tools', 'space-main'),
      makeCollection('c-2', 'Wishlist', 'space-shop'),
    ];
    const links = [
      makeLink({
        id: 'plain',
        collectionId: 'c-1',
        url: 'https://example.com/item/',
        title: 'Item',
      }),
      makeLink({
        id: 'starred-copy',
        collectionId: 'c-2',
        url: 'https://example.com/item',
        title: 'Item Starred',
        starred: true,
      }),
    ];

    const dupes = findCrossSpaceDuplicates(links, cols, spaces);
    expect(dupes).toHaveLength(1);
    expect(dupes[0]?.entries[0]?.link.id).toBe('starred-copy');
    expect(dupes[0]?.entries[0]?.recommendedKeep).toBe(true);
    expect(dupes[0]?.entries[1]?.recommendedKeep).toBe(false);
  });
});

describe('Bulk link operations in repo', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('moves multiple links while skipping destination duplicates and merges bulk tags', async () => {
    const c1 = await stashRepo.createCollection({ name: 'Source' });
    const c2 = await stashRepo.createCollection({ name: 'Target' });

    const a = await stashRepo.addLink({
      collectionId: c1.id,
      url: 'https://a.example.com',
      title: 'A',
    });
    const b = await stashRepo.addLink({
      collectionId: c1.id,
      url: 'https://b.example.com',
      title: 'B',
    });
    await stashRepo.addLink({
      collectionId: c2.id,
      url: 'https://b.example.com',
      title: 'B already in Target',
    });

    if (!a.ok || !b.ok) throw new Error('Setup failed');

    const moved = await stashRepo.moveLinksToCollection(
      [a.link.id, b.link.id],
      c2.id,
    );
    expect(moved).toEqual({ movedCount: 1, skippedDuplicates: 1 });

    const tagged = await stashRepo.addTagsToLinks(
      [a.link.id, b.link.id],
      ['Focus', 'read'],
    );
    expect(tagged).toBe(2);

    const reloadedA = (await stashRepo.getLinks()).find(
      (l) => l.id === a.link.id,
    );
    expect(reloadedA?.collectionId).toBe(c2.id);
    expect(reloadedA?.tags).toEqual(['focus', 'read']);
  });
});
