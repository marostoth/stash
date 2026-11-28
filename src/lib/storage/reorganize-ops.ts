import { storage } from '#imports';
import {
  type LibraryBoardState,
  mergeSpaceReorganization,
} from '@/lib/reorganize/plan';
import { collectionsStorage, linksStorage } from '@/lib/storage/items';
import { sortByOrder } from '@/lib/utils/ordering';

export function cloneBoardState(state: LibraryBoardState): LibraryBoardState {
  return {
    collections: state.collections.map((c) => ({ ...c })),
    links: state.links.map((l) => ({
      ...l,
      tags: [...l.tags],
      ...(l.product ? { product: { ...l.product } } : {}),
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
 * Atomically restores a pre-reorganization board snapshot. When `spaceId` is
 * provided, re-reads current storage and restores ONLY that Space via
 * `mergeSpaceReorganization` so edits in other Spaces are never overwritten.
 */
export async function restoreLibrarySnapshotInStorage(
  snapshot: LibraryBoardState,
  spaceId?: string,
): Promise<void> {
  const restored = cloneBoardState(snapshot);

  if (spaceId) {
    const [currentCollections, currentLinks] = await Promise.all([
      collectionsStorage.getValue(),
      linksStorage.getValue(),
    ]);
    const merged = mergeSpaceReorganization(
      currentCollections,
      currentLinks,
      spaceId,
      restored,
    );
    await storage.setItems([
      { item: collectionsStorage, value: merged.collections },
      { item: linksStorage, value: merged.links },
    ]);
    return;
  }

  await storage.setItems([
    { item: collectionsStorage, value: restored.collections },
    { item: linksStorage, value: restored.links },
  ]);
}
