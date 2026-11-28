import type { CSSProperties } from 'react';
import { toast } from 'sonner';
import { playDelete, playDrop } from '@/lib/audio/foley';
import { stashRepo } from '@/lib/storage/repo';

/**
 * Deletes a collection (archiving it into 7-Day Trash) and displays a
 * 6-second Undo toast with a draining progress bar that restores the
 * collection and all of its links in one click.
 */
export async function deleteCollectionWithUndo(
  collectionId: string,
  collectionName: string,
): Promise<boolean> {
  const ok = await stashRepo.deleteCollection(collectionId);
  if (!ok) return false;
  playDelete();
  let undone = false;
  toast(`Deleted "${collectionName}"`, {
    duration: 6000,
    className: 'stash-undo-toast',
    style: { '--stash-toast-duration': '6000ms' } as CSSProperties,
    action: {
      label: 'Undo',
      onClick: () => {
        if (undone) return;
        undone = true;
        void stashRepo.getTrash().then((entries) => {
          const match = entries.find(
            (entry) =>
              entry.kind === 'collection' &&
              entry.collection.id === collectionId,
          );
          if (!match) return;
          void stashRepo.restoreTrashEntry(match.id).then((restored) => {
            if (restored) {
              playDrop();
              toast.success(`Restored "${restored.label}"`);
            }
          });
        });
      },
    },
  });
  return true;
}
