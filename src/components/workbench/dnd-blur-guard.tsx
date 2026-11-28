import { useDragDropManager } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { useEffect } from 'react';
import {
  revertDisplacedSortableGroup,
  type SortableLike,
} from '@/lib/dnd/reconcile-dom';
import { isDropTargetData } from '@/lib/dnd/types';
import { useFxStore } from '@/store/fx-store';

/**
 * Guards `@dnd-kit/react` against two real-world browser edge cases:
 * 1. Cancels in-flight drags on window `blur`, `visibilitychange`, or capture-phase `Escape`.
 * 2. Reverts `OptimisticSortingPlugin` DOM displacement when a sortable card is dragged
 *    across siblings and released outside any valid drop zone (`canceled: false, target: null`).
 */
export function DndBlurGuard() {
  const manager = useDragDropManager();

  useEffect(() => {
    if (!manager || typeof window === 'undefined') return;

    const cancelIfDragging = () => {
      if (manager.dragOperation.status.dragging) {
        manager.actions.stop({ canceled: true });
        useFxStore.getState().setDragInsertTarget(null);
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        cancelIfDragging();
      }
    };

    const handleEscapeCapture = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && manager.dragOperation.status.dragging) {
        event.preventDefault();
        event.stopPropagation();
        cancelIfDragging();
      }
    };

    const unsubscribeDragEnd = manager.monitor.addEventListener(
      'dragend',
      (event) => {
        if (event.canceled) return;
        const { source, target } = event.operation;
        if (!source || !isSortable(source)) return;
        if (target && isDropTargetData(target.data)) return;

        // Invalid / outside-zone drop: revert any mid-drag OptimisticSortingPlugin DOM move
        const groupId = source.initialGroup;
        const groupSortables: SortableLike[] = [];
        for (const droppable of manager.registry.droppables) {
          const maybeSortable = (
            droppable as unknown as { sortable?: SortableLike }
          ).sortable;
          if (maybeSortable && maybeSortable.initialGroup === groupId) {
            groupSortables.push(maybeSortable);
          }
        }
        if (groupSortables.length > 0) {
          queueMicrotask(() => {
            revertDisplacedSortableGroup(groupSortables);
          });
        }
      },
    );

    window.addEventListener('blur', cancelIfDragging);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleEscapeCapture, { capture: true });
    return () => {
      unsubscribeDragEnd();
      window.removeEventListener('blur', cancelIfDragging);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleEscapeCapture, {
        capture: true,
      });
    };
  }, [manager]);

  return null;
}
