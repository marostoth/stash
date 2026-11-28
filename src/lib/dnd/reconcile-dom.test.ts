import { describe, expect, it } from 'vitest';
import {
  computeInitialSortableOrder,
  revertDisplacedSortableGroup,
  type SortableLike,
} from '@/lib/dnd/reconcile-dom';

function createFakeCardEl(
  id: string,
  parent: { children: FakeCardEl[]; appendChild: (el: FakeCardEl) => void },
) {
  const removedProps: string[] = [];
  const el = {
    id,
    parentElement: parent,
    removedProps,
    style: {
      removeProperty(prop: string) {
        removedProps.push(prop);
        return '';
      },
    },
  };
  return el;
}

type FakeCardEl = ReturnType<typeof createFakeCardEl>;

describe('DnD DOM reconciliation for displaced sortable grids', () => {
  it('returns false without touching DOM when sortables are not displaced', () => {
    const sortables: SortableLike[] = [
      {
        id: 'a',
        index: 0,
        initialIndex: 0,
        group: 'col-1',
        initialGroup: 'col-1',
      },
      {
        id: 'b',
        index: 1,
        initialIndex: 1,
        group: 'col-1',
        initialGroup: 'col-1',
      },
    ];
    expect(revertDisplacedSortableGroup(sortables)).toBe(false);
    expect(computeInitialSortableOrder(sortables).map((s) => s.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('restores exact initial DOM child order, resets indices, and clears stale inline styles after an out-of-bounds drop', () => {
    const parent = {
      children: [] as FakeCardEl[],
      appendChild(el: FakeCardEl) {
        this.children = this.children.filter((c) => c !== el);
        this.children.push(el);
      },
    };

    const elA = createFakeCardEl('a', parent);
    const elB = createFakeCardEl('b', parent);
    const elC = createFakeCardEl('c', parent);
    // Simulate OptimisticSortingPlugin having moved `a` to the end during drag: [b, c, a]
    parent.children = [elB, elC, elA];

    // Simulate HTMLElement prototype check in Node test environment
    const origHTMLElement = globalThis.HTMLElement;
    class FakeHTMLElement {}
    Object.setPrototypeOf(elA, FakeHTMLElement.prototype);
    Object.setPrototypeOf(elB, FakeHTMLElement.prototype);
    Object.setPrototypeOf(elC, FakeHTMLElement.prototype);
    globalThis.HTMLElement = FakeHTMLElement as unknown as typeof HTMLElement;

    try {
      const sortables: SortableLike[] = [
        {
          id: 'link:b',
          index: 0,
          initialIndex: 1,
          group: 'col-1',
          initialGroup: 'col-1',
          element: elB as unknown as Element,
        },
        {
          id: 'link:c',
          index: 1,
          initialIndex: 2,
          group: 'col-1',
          initialGroup: 'col-1',
          element: elC as unknown as Element,
        },
        {
          id: 'link:a',
          index: 2,
          initialIndex: 0,
          group: 'col-1',
          initialGroup: 'col-1',
          element: elA as unknown as Element,
        },
      ];

      expect(revertDisplacedSortableGroup(sortables)).toBe(true);

      // DOM child order inside the grid parent is restored to [a, b, c]
      expect(parent.children.map((c) => c.id)).toEqual(['a', 'b', 'c']);

      // Every sortable's mutated index is restored to its initialIndex
      expect(sortables.map((s) => [s.id, s.index])).toEqual([
        ['link:b', 1],
        ['link:c', 2],
        ['link:a', 0],
      ]);

      // Any leftover transform / translate / height / width inline styles are cleared
      for (const el of [elA, elB, elC]) {
        expect(el.removedProps).toEqual([
          'transform',
          'translate',
          'height',
          'width',
        ]);
      }
    } finally {
      globalThis.HTMLElement = origHTMLElement;
    }
  });
});
