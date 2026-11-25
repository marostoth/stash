import { describe, expect, it } from 'vitest';
import type { Collection, LinkItem } from '@/lib/types/stash';
import {
  insertLinkAtIndexInList,
  moveOrReorderLinkInList,
  reorderCollectionsList,
} from '@/lib/utils/ordering';

const T0 = '2026-11-25T10:00:00.000Z';
const T1 = '2026-11-25T10:05:00.000Z';

function makeCollection(id: string, order: number): Collection {
  return {
    id,
    name: `Col ${id}`,
    color: 'green',
    order,
    collapsed: false,
    createdAt: T0,
    updatedAt: T0,
  };
}

function makeLink(
  id: string,
  collectionId: string,
  url: string,
  order: number,
): LinkItem {
  return {
    id,
    collectionId,
    url,
    title: id,
    note: '',
    tags: [],
    order,
    createdAt: T0,
    updatedAt: T0,
  };
}

describe('ordering helpers', () => {
  it('reorders collections vertically and reindexes cleanly', () => {
    const cols = [
      makeCollection('a', 0),
      makeCollection('b', 1),
      makeCollection('c', 2),
    ];

    const movedDown = reorderCollectionsList(cols, 'a', 2, T1);
    expect(movedDown.map((c) => [c.id, c.order])).toEqual([
      ['b', 0],
      ['c', 1],
      ['a', 2],
    ]);

    const movedUp = reorderCollectionsList(movedDown, 'a', 0, T1);
    expect(movedUp.map((c) => [c.id, c.order])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
    ]);
  });

  it('reorders links within a collection and moves across collections with duplicate guard', () => {
    const links = [
      makeLink('l1', 'c1', 'https://one.dev', 0),
      makeLink('l2', 'c1', 'https://two.dev', 1),
      makeLink('l3', 'c1', 'https://three.dev', 2),
      makeLink('l4', 'c2', 'https://two.dev/', 0),
      makeLink('l5', 'c2', 'https://five.dev', 1),
    ];

    // Reorder inside c1: move l3 to index 0
    const reordered = moveOrReorderLinkInList(links, 'l3', 'c1', 0, T1);
    expect(reordered.ok).toBe(true);
    if (!reordered.ok) return;

    const c1After = reordered.links
      .filter((l) => l.collectionId === 'c1')
      .sort((a, b) => a.order - b.order);
    expect(c1After.map((l) => [l.id, l.order])).toEqual([
      ['l3', 0],
      ['l1', 1],
      ['l2', 2],
    ]);

    // Cross-collection duplicate (l2 has https://two.dev, c2 already has https://two.dev/)
    const dupMove = moveOrReorderLinkInList(reordered.links, 'l2', 'c2', 0, T1);
    expect(dupMove.ok).toBe(false);
    if (!dupMove.ok) {
      expect(dupMove.reason).toBe('duplicate');
    }

    // Valid cross-collection move: l1 from c1 -> c2 at index 1
    const moved = moveOrReorderLinkInList(reordered.links, 'l1', 'c2', 1, T1);
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;

    const c1Final = moved.links
      .filter((l) => l.collectionId === 'c1')
      .sort((a, b) => a.order - b.order);
    const c2Final = moved.links
      .filter((l) => l.collectionId === 'c2')
      .sort((a, b) => a.order - b.order);

    expect(c1Final.map((l) => [l.id, l.order])).toEqual([
      ['l3', 0],
      ['l2', 1],
    ]);
    expect(c2Final.map((l) => [l.id, l.order])).toEqual([
      ['l4', 0],
      ['l1', 1],
      ['l5', 2],
    ]);
  });

  it('inserts a newly stashed link at a specific card slot and reindexes', () => {
    const existing = [
      makeLink('l1', 'c1', 'https://one.dev', 0),
      makeLink('l2', 'c1', 'https://two.dev', 1),
    ];
    const incoming = makeLink('l-new', 'c1', 'https://new.dev', 0);

    const inserted = insertLinkAtIndexInList(existing, incoming, 1);
    const c1 = inserted
      .filter((l) => l.collectionId === 'c1')
      .sort((a, b) => a.order - b.order);

    expect(c1.map((l) => [l.id, l.order])).toEqual([
      ['l1', 0],
      ['l-new', 1],
      ['l2', 2],
    ]);
  });
});
