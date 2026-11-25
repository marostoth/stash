import { storage } from '#imports';
import type { LibraryBoardState } from '@/lib/reorganize/plan';
import { collectionsStorage, linksStorage } from '@/lib/storage/items';
import { sortByOrder } from '@/lib/utils/ordering';

function cloneBoardState(state: LibraryBoardState): LibraryBoardState {
  return {
    collections: state.collections.map((c) => ({ ...c })),
    links: state.links.map((l) => ({
      ...l,
      tags: [...l.tags],
    })),
  };
}

/**
 * Snapshots the pre-reorganization collections and links, then writes the
 * reorganized board atomically in a single chrome.storage.local update.
 */
export async function applyReorganizationInStorage(
  nextState: LibraryBoardState,
): Promise<LibraryBoardState> {
  const [prevCollections, prevLinks] = await Promise.all([
    collectionsStorage.getValue(),
    linksStorage.getValue(),
  ]);

  const previousSnapshot = cloneBoardState({
    collections: sortByOrder(prevCollections),
    links: sortByOrder(prevLinks),
  });

  const normalizedNext = cloneBoardState(nextState);

  await storage.setItems([
    { item: collectionsStorage, value: normalizedNext.collections },
    { item: linksStorage, value: normalizedNext.links },
  ]);

  return previousSnapshot;
}

/**
 * Atomically restores a pre-reorganization board snapshot (collections + links)
 * in a single chrome.storage.local update for full-board Undo.
 */
export async function restoreLibrarySnapshotInStorage(
  snapshot: LibraryBoardState,
): Promise<void> {
  const restored = cloneBoardState(snapshot);
  await storage.setItems([
    { item: collectionsStorage, value: restored.collections },
    { item: linksStorage, value: restored.links },
  ]);
}
