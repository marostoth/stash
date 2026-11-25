import {
  activeSpaceIdStorage,
  collectionsStorage,
  spacesStorage,
} from '@/lib/storage/items';
import type {
  CreateSpaceInput,
  DeleteSpaceResult,
  UpdateSpaceInput,
} from '@/lib/storage/repo-types';
import {
  type Collection,
  createDefaultSpace,
  DEFAULT_SPACE_ID,
  type Space,
} from '@/lib/types/stash';
import { sortByOrder } from '@/lib/utils/ordering';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Guarantees at least one Space exists (auto-seeding `Main`) and returns spaces
 * sorted by order.
 */
export function ensureSpacesList(
  rawSpaces: readonly Space[],
  timestamp: string = nowIso(),
): Space[] {
  if (rawSpaces.length === 0) {
    return [createDefaultSpace(timestamp)];
  }
  return sortByOrder(rawSpaces).map((space, idx) => ({
    ...space,
    order: idx,
  }));
}

/**
 * Maps any Collection with a missing or nonexistent `spaceId` onto the primary
 * Space (`spaces[0].id`, normally `Main`).
 */
export function normalizeCollectionsSpaceIds(
  collections: readonly Collection[],
  spaces: readonly Space[],
): Collection[] {
  const fallbackSpaceId = spaces[0]?.id ?? DEFAULT_SPACE_ID;
  const validSpaceIds = new Set(spaces.map((s) => s.id));
  return sortByOrder(collections).map((col) => {
    if (col.spaceId && validSpaceIds.has(col.spaceId)) {
      return col;
    }
    return { ...col, spaceId: fallbackSpaceId };
  });
}

export async function getSpacesFromStorage(): Promise<Space[]> {
  const stored = await spacesStorage.getValue();
  if (stored.length === 0) {
    const seeded = [createDefaultSpace(nowIso())];
    await spacesStorage.setValue(seeded);
    return seeded;
  }
  return sortByOrder(stored);
}

export function watchSpacesInStorage(
  cb: (spaces: Space[]) => void,
): () => void {
  return spacesStorage.watch((next) => cb(ensureSpacesList(next)));
}

export async function getActiveSpaceIdFromStorage(): Promise<string> {
  const [spaces, activeId] = await Promise.all([
    getSpacesFromStorage(),
    activeSpaceIdStorage.getValue(),
  ]);
  if (spaces.some((s) => s.id === activeId)) {
    return activeId;
  }
  return spaces[0]?.id ?? DEFAULT_SPACE_ID;
}

export async function setActiveSpaceIdInStorage(
  spaceId: string,
): Promise<void> {
  await activeSpaceIdStorage.setValue(spaceId);
}

export async function createSpaceInStorage(
  input: CreateSpaceInput,
): Promise<Space> {
  const existing = await getSpacesFromStorage();
  const maxOrder = existing.reduce((max, s) => Math.max(max, s.order), -1);
  const timestamp = nowIso();
  const created: Space = {
    id: crypto.randomUUID(),
    name: input.name.trim() || 'New Space',
    icon: input.icon?.trim() || undefined,
    order: maxOrder + 1,
    densityOverride: input.densityOverride,
    viewMode: input.viewMode,
    groupBy: input.groupBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await spacesStorage.setValue([...existing, created]);
  return created;
}

export async function updateSpaceInStorage(
  id: string,
  patch: UpdateSpaceInput,
): Promise<Space | null> {
  const existing = await getSpacesFromStorage();
  let updated: Space | null = null;
  const next = existing.map((space) => {
    if (space.id !== id) return space;
    updated = {
      ...space,
      ...(patch.name !== undefined
        ? { name: patch.name.trim() || space.name }
        : {}),
      ...(patch.icon !== undefined
        ? { icon: patch.icon?.trim() || undefined }
        : {}),
      ...(patch.order !== undefined ? { order: patch.order } : {}),
      ...(patch.densityOverride !== undefined
        ? { densityOverride: patch.densityOverride ?? undefined }
        : {}),
      ...(patch.viewMode !== undefined ? { viewMode: patch.viewMode } : {}),
      ...(patch.groupBy !== undefined ? { groupBy: patch.groupBy } : {}),
      updatedAt: nowIso(),
    };
    return updated;
  });

  if (!updated) return null;
  await spacesStorage.setValue(next);
  return updated;
}

/**
 * Deletes a Space and safely migrates all of its collections to the primary
 * fallback Space (`Main` or first remaining Space) without deleting any links.
 * Prevents deleting the last remaining Space.
 */
export async function deleteSpaceInStorage(
  id: string,
): Promise<DeleteSpaceResult> {
  const [existingSpaces, existingCollections] = await Promise.all([
    getSpacesFromStorage(),
    collectionsStorage.getValue(),
  ]);

  if (existingSpaces.length <= 1) {
    return {
      deleted: false,
      migratedCollections: 0,
      fallbackSpaceId: existingSpaces[0]?.id ?? null,
    };
  }

  const remainingSpaces = existingSpaces
    .filter((s) => s.id !== id)
    .map((s, idx) => ({ ...s, order: idx }));

  if (remainingSpaces.length === existingSpaces.length) {
    return {
      deleted: false,
      migratedCollections: 0,
      fallbackSpaceId: existingSpaces[0]?.id ?? null,
    };
  }

  const fallbackSpace =
    remainingSpaces.find((s) => s.id === DEFAULT_SPACE_ID) ??
    remainingSpaces[0];
  const fallbackSpaceId = fallbackSpace?.id ?? DEFAULT_SPACE_ID;
  const timestamp = nowIso();

  let migratedCollections = 0;
  const nextCollections = existingCollections.map((col) => {
    if (col.spaceId !== id) return col;
    migratedCollections += 1;
    return {
      ...col,
      spaceId: fallbackSpaceId,
      updatedAt: timestamp,
    };
  });

  await Promise.all([
    spacesStorage.setValue(remainingSpaces),
    collectionsStorage.setValue(nextCollections),
  ]);

  const currentActive = await activeSpaceIdStorage.getValue();
  if (currentActive === id) {
    await activeSpaceIdStorage.setValue(fallbackSpaceId);
  }

  return {
    deleted: true,
    migratedCollections,
    fallbackSpaceId,
  };
}

export async function moveCollectionToSpaceInStorage(
  collectionId: string,
  targetSpaceId: string,
): Promise<Collection | null> {
  const [spaces, existingCollections] = await Promise.all([
    getSpacesFromStorage(),
    collectionsStorage.getValue(),
  ]);

  if (!spaces.some((s) => s.id === targetSpaceId)) {
    return null;
  }

  let moved: Collection | null = null;
  const next = existingCollections.map((col) => {
    if (col.id !== collectionId) return col;
    moved = {
      ...col,
      spaceId: targetSpaceId,
      updatedAt: nowIso(),
    };
    return moved;
  });

  if (!moved) return null;
  await collectionsStorage.setValue(next);
  return moved;
}
