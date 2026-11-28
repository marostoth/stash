export interface SortableLike {
  readonly id: unknown;
  index: number;
  readonly initialIndex: number;
  group?: unknown;
  readonly initialGroup?: unknown;
  readonly element?: Element | null;
}

/**
 * Computes the DOM child sequence required to restore a list of displaced
 * sortable elements back to their pre-drag `initialIndex` order after an
 * out-of-bounds release (where `@dnd-kit` fires `dragend` with `canceled: false`
 * and `OptimisticSortingPlugin` leaves the DOM displaced).
 */
export function computeInitialSortableOrder<T extends SortableLike>(
  sortables: readonly T[],
): T[] {
  return [...sortables].sort((a, b) => a.initialIndex - b.initialIndex);
}

/**
 * Restores a group of displaced `@dnd-kit` sortables back to their `initialIndex`
 * DOM positions inside their shared grid/list parent, resets `sortable.index`
 * back to `initialIndex`, and clears any leftover inline drag geometry styles.
 */
export function revertDisplacedSortableGroup(
  sortables: readonly SortableLike[],
): boolean {
  const displaced = sortables.some(
    (s) => s.index !== s.initialIndex || s.group !== s.initialGroup,
  );
  if (!displaced) return false;

  const ordered = computeInitialSortableOrder(sortables);
  const parent = ordered.find((s) => s.element?.parentElement)?.element
    ?.parentElement;

  if (parent) {
    for (const sortable of ordered) {
      const el = sortable.element;
      if (el && el.parentElement === parent) {
        parent.appendChild(el);
      }
      if (el instanceof HTMLElement) {
        el.style.removeProperty('transform');
        el.style.removeProperty('translate');
        el.style.removeProperty('height');
        el.style.removeProperty('width');
      }
    }
  }

  for (const sortable of ordered) {
    sortable.index = sortable.initialIndex;
  }
  return true;
}
