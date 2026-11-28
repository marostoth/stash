import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import type { LibraryBoardState } from '@/lib/reorganize/plan';
import { stashRepo } from '@/lib/storage/repo';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';

export function upsertReorganizeBackgroundJob(
  detail: string,
  opts: {
    status: 'running' | 'ready';
    progress?: { current: number; total: number } | null;
    onReopen: () => void;
    onCancel?: () => void;
  },
): void {
  useBackgroundJobsStore.getState().upsertJob({
    id: 'reorganize',
    title:
      opts.status === 'ready' ? 'Smart Reorganize ready' : 'Smart Reorganize',
    detail,
    status: opts.status,
    ...(opts.status === 'ready'
      ? { reopenLabel: 'Review' }
      : { progress: opts.progress ?? null, usesNano: true }),
    onReopen: opts.onReopen,
    onCancel: opts.onCancel,
  });
}

/**
 * Displays the 10-second Undo toast after Smart Reorganize with a double-click
 * guard and Space-scoped restore so other Spaces are never overwritten.
 */
export function showReorganizeUndoToast(
  movedLinks: number,
  targetCollectionsCount: number,
  previousSpaceSnapshot: LibraryBoardState,
  activeSpaceId: string,
): void {
  let undone = false;
  toast(
    `Reorganized ${movedLinks} link${movedLinks === 1 ? '' : 's'} into ${targetCollectionsCount} collection${targetCollectionsCount === 1 ? '' : 's'}`,
    {
      duration: 10_000,
      className: 'stash-undo-toast',
      style: { '--stash-toast-duration': '10000ms' } as CSSProperties,
      action: {
        label: 'Undo',
        onClick: () => {
          if (undone) return;
          undone = true;
          void stashRepo
            .restoreLibrarySnapshot(previousSpaceSnapshot, activeSpaceId)
            .then(() => toast.success('Restored previous board layout'));
        },
      },
    },
  );
}
