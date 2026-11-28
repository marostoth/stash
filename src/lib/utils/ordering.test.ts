import { describe, expect, it } from 'vitest';
import type { Collection, LinkItem } from '@/lib/types/stash';
import {
  insertLinkAtIndexInList,
  mapVisibleIndexToFullIndex,
  moveOrReorderLinkInList,
  reorderCollectionsList,
} from '@/lib/utils/ordering';

const T0 = '2026-11-25T10:00:00.000Z';
const T1 = '2026-11-25T10:05:00.000Z';

function makeCollection(
  id: string,
  order: number,
  spaceId?: string,
): Collection {
  return {
    id,
    name: `Col ${id}`,
    color: 'green',
    ...(spaceId ? { spaceId } : {}),
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

  it('reorders collections strictly within the active Space slice without disturbing other Spaces', () => {
    const cols = [
      makeCollection('m1', 0, 'main'),
      makeCollection('m2', 1, 'main'),
      makeCollection('w1', 2, 'work'),
      makeCollection('s1', 3, 'shopping'),
      makeCollection('w2', 4, 'work'),
      makeCollection('w3', 5, 'work'),
    ];

    // In Space 'work', local order is [w1 (0), w2 (1), w3 (2)].
    // Dragging w3 to Space-local index 0 must move w3 ahead of w1/w2 while keeping
    // 'main' (slots 0,1) and 'shopping' (slot 3) at their exact global positions.
    const movedUp = reorderCollectionsList(cols, 'w3', 0, T1, 'work');
    expect(movedUp.map((c) => [c.id, c.order])).toEqual([
      ['m1', 0],
      ['m2', 1],
      ['w3', 2],
      ['s1', 3],
      ['w1', 4],
      ['w2', 5],
    ]);

    // Dragging w3 back to Space-local index 2 restores original Space order
    const movedDown = reorderCollectionsList(movedUp, 'w3', 2, T1, 'work');
    expect(movedDown.map((c) => [c.id, c.order])).toEqual([
      ['m1', 0],
      ['m2', 1],
      ['w1', 2],
      ['s1', 3],
      ['w2', 4],
      ['w3', 5],
    ]);
  });

  it('maps visible drop indices cleanly onto full collection order when hideChecked hides items', () => {
    const fullLinks: LinkItem[] = [
      { ...makeLink('c0', 'col', 'https://a.dev', 0), checked: true },
      makeLink('u1', 'col', 'https://b.dev', 1),
      { ...makeLink('c2', 'col', 'https://c.dev', 2), checked: true },
      makeLink('u3', 'col', 'https://d.dev', 3),
    ];
    const visibleLinks = fullLinks.filter((l) => l.checked !== true);

    // Dropping before visible[0] ('u1') targets full index 1 (leaving hidden 'c0' at 0)
    expect(mapVisibleIndexToFullIndex(fullLinks, visibleLinks, 0)).toBe(1);
    // Dropping before visible[1] ('u3') targets full index 3 (leaving hidden 'c2' at 2)
    expect(mapVisibleIndexToFullIndex(fullLinks, visibleLinks, 1)).toBe(3);
    // Dropping past the end appends cleanly at fullLinks.length (4)
    expect(mapVisibleIndexToFullIndex(fullLinks, visibleLinks, 2)).toBe(4);

    // Inserting at the mapped index preserves hidden checked items at their slots
    const incoming = makeLink('new', 'col', 'https://new.dev', 0);
    const fullTarget = mapVisibleIndexToFullIndex(fullLinks, visibleLinks, 1);
    const inserted = insertLinkAtIndexInList(fullLinks, incoming, fullTarget)
      .sort((a, b) => a.order - b.order)
      .map((l) => l.id);
    expect(inserted).toEqual(['c0', 'u1', 'c2', 'new', 'u3']);
  });
});
