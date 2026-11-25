import { describe, expect, it } from 'vitest';
import type { Collection, LinkItem } from '@/lib/types/stash';
import { groupAndFilterCollections } from '@/lib/utils/search';

const now = '2026-11-25T10:00:00.000Z';

const collections: Collection[] = [
  {
    id: 'c1',
    name: '3D Printing',
    color: 'cyan',
    order: 0,
    collapsed: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'c2',
    name: 'Electronics',
    color: 'green',
    order: 1,
    collapsed: false,
    createdAt: now,
    updatedAt: now,
  },
];

const links: LinkItem[] = [
  {
    id: 'l1',
    collectionId: 'c1',
    url: 'https://printables.com/model/123',
    title: 'Voron Stealthburner',
    note: 'Toolhead STL files for build',
    tags: ['voron', 'stl'],
    order: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'l2',
    collectionId: 'c2',
    url: 'https://randomnerdtutorials.com/esp32',
    title: 'ESP32 Pinout Reference',
    note: 'ADC2 conflict note with WiFi',
    tags: ['esp32', 'gpio'],
    order: 0,
    createdAt: now,
    updatedAt: now,
  },
];

describe('groupAndFilterCollections', () => {
  it('returns all collections when query is empty', () => {
    const groups = groupAndFilterCollections(collections, links, '');
    expect(groups).toHaveLength(2);
  });

  it('matches across title, note, tags, and URL with multi-term queries', () => {
    const byNoteAndTag = groupAndFilterCollections(
      collections,
      links,
      'wifi esp32',
    );
    expect(byNoteAndTag).toHaveLength(1);
    expect(byNoteAndTag[0]?.collection.id).toBe('c2');
    expect(byNoteAndTag[0]?.links.map((l) => l.id)).toEqual(['l2']);

    const byDomain = groupAndFilterCollections(
      collections,
      links,
      'printables',
    );
    expect(byDomain).toHaveLength(1);
    expect(byDomain[0]?.links.map((l) => l.id)).toEqual(['l1']);
  });
});
