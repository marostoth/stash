import { describe, expect, it } from 'vitest';
import { resolveSpaceBarControlState } from '@/components/workbench/space-bar-controls';

describe('resolveSpaceBarControlState', () => {
  it('hides Group-by toggle in Grid mode and shows it only in Details mode', () => {
    const grid = resolveSpaceBarControlState({
      activeViewMode: 'grid',
      activeGroupBy: 'collection',
      collectionCount: 4,
      allCollapsed: false,
      checkedCountInSpace: 0,
      hideChecked: false,
    });
    expect(grid.showGroupByToggle).toBe(false);
    expect(grid.showCollapseToggle).toBe(true);
    expect(grid.collapseActionLabel).toBe('Collapse all');
    expect(grid.showHideCheckedToggle).toBe(false);

    const details = resolveSpaceBarControlState({
      activeViewMode: 'details',
      activeGroupBy: 'store',
      collectionCount: 4,
      allCollapsed: false,
      checkedCountInSpace: 0,
      hideChecked: false,
    });
    expect(details.showGroupByToggle).toBe(true);
    expect(details.showCollapseToggle).toBe(true);
  });

  it('hides Collapse/Expand all when the Space has no collections and flips label when all are collapsed', () => {
    const empty = resolveSpaceBarControlState({
      activeViewMode: 'grid',
      activeGroupBy: 'collection',
      collectionCount: 0,
      allCollapsed: false,
      checkedCountInSpace: 0,
      hideChecked: false,
    });
    expect(empty.showCollapseToggle).toBe(false);

    const collapsed = resolveSpaceBarControlState({
      activeViewMode: 'grid',
      activeGroupBy: 'collection',
      collectionCount: 3,
      allCollapsed: true,
      checkedCountInSpace: 0,
      hideChecked: false,
    });
    expect(collapsed.showCollapseToggle).toBe(true);
    expect(collapsed.collapseActionLabel).toBe('Expand all');
  });

  it('shows Hide done toggle only when checked items exist or hideChecked is already active', () => {
    expect(
      resolveSpaceBarControlState({
        activeViewMode: 'details',
        activeGroupBy: 'collection',
        collectionCount: 2,
        allCollapsed: false,
        checkedCountInSpace: 3,
        hideChecked: false,
      }).showHideCheckedToggle,
    ).toBe(true);

    expect(
      resolveSpaceBarControlState({
        activeViewMode: 'grid',
        activeGroupBy: 'collection',
        collectionCount: 2,
        allCollapsed: false,
        checkedCountInSpace: 0,
        hideChecked: true,
      }).showHideCheckedToggle,
    ).toBe(true);
  });
});
