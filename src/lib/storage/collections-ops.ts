import { collectionsStorage } from '@/lib/storage/items';
import {
  buildStarterCollections,
  type CreateCollectionInput,
  type UpdateCollectionInput,
} from '@/lib/storage/repo-types';
import { getSpacesFromStorage } from '@/lib/storage/spaces-ops';
import { type Collection, DEFAULT_SPACE_ID } from '@/lib/types/stash';
import { reorderCollectionsList, sortByOrder } from '@/lib/utils/ordering';

function nowIso(): string {
  return new Date().toISOString();
}

export async function createCollectionInStorage(
  input: CreateCollectionInput,
): Promise<Collection> {
  const [spaces, existing] = await Promise.all([
    getSpacesFromStorage(),
    collectionsStorage.getValue(),
  ]);
  const fallbackSpaceId = spaces[0]?.id ?? DEFAULT_SPACE_ID;
  const resolvedSpaceId =
    input.spaceId && spaces.some((s) => s.id === input.spaceId)
      ? input.spaceId
      : fallbackSpaceId;
  const maxOrder = existing.reduce(
    (max, item) => Math.max(max, item.order),
    -1,
  );
  const timestamp = nowIso();
  const created: Collection = {
    id: crypto.randomUUID(),
    name: input.name.trim() || 'Untitled Collection',
    description: input.description?.trim() || undefined,
    color: input.color ?? 'green',
    tintColor: input.tintColor?.trim() || undefined,
    icon: input.icon?.trim() || undefined,
    viewMode: input.viewMode,
    ...(input.sortMode && input.sortMode !== 'manual'
      ? { sortMode: input.sortMode }
      : {}),
    spaceId: resolvedSpaceId,
    order: maxOrder + 1,
    collapsed: false,
    isSession: input.isSession,
    ...(input.isAutoInbox ? { isAutoInbox: true } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await collectionsStorage.setValue([...existing, created]);
  return created;
}

export async function updateCollectionInStorage(
  id: string,
  patch: UpdateCollectionInput,
): Promise<Collection | null> {
  const existing = await collectionsStorage.getValue();
  const current = existing.find((item) => item.id === id);
  if (!current) return null;

  // Fast-path no-op when only toggling `collapsed` to its existing value
  // (avoids unnecessary storage writes & watcher re-renders on Open Tab drops).
  const patchKeys = Object.keys(patch);
  if (
    patchKeys.length === 1 &&
    patch.collapsed !== undefined &&
    current.collapsed === patch.collapsed
  ) {
    return current;
  }

  let updated: Collection | null = null;
  const next = existing.map((item) => {
    if (item.id !== id) return item;
    const nextName =
      patch.name !== undefined ? patch.name.trim() || item.name : item.name;
    const renamedAwayFromInbox =
      patch.name !== undefined &&
      nextName.toLowerCase() !== 'inbox' &&
      item.isAutoInbox === true;
    updated = {
      ...item,
      name: nextName,
      ...(renamedAwayFromInbox ? { isAutoInbox: undefined } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description.trim() || undefined }
        : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.tintColor !== undefined
        ? { tintColor: patch.tintColor?.trim() || undefined }
        : {}),
      ...(patch.icon !== undefined
        ? { icon: patch.icon?.trim() || undefined }
        : {}),
      ...(patch.viewMode !== undefined ? { viewMode: patch.viewMode } : {}),
      ...(patch.sortMode !== undefined
        ? {
            sortMode: patch.sortMode === 'manual' ? undefined : patch.sortMode,
          }
        : {}),
      ...(patch.spaceId !== undefined ? { spaceId: patch.spaceId } : {}),
      ...(patch.collapsed !== undefined ? { collapsed: patch.collapsed } : {}),
      ...(patch.order !== undefined ? { order: patch.order } : {}),
      updatedAt: nowIso(),
    };
    return updated;
  });

  if (!updated) return null;
  await collectionsStorage.setValue(next);
  return updated;
}

export async function reorderCollectionsInStorage(
  sourceId: string,
  targetIndex: number,
  scopeSpaceId?: string,
): Promise<Collection[]> {
  const existing = await collectionsStorage.getValue();
  const next = reorderCollectionsList(
    existing,
    sourceId,
    targetIndex,
    nowIso(),
    scopeSpaceId,
  );
  await collectionsStorage.setValue(next);
  return next;
}

export async function toggleCollectionCollapsedInStorage(
  id: string,
): Promise<Collection | null> {
  const existing = await collectionsStorage.getValue();
  const target = existing.find((item) => item.id === id);
  if (!target) return null;
  return updateCollectionInStorage(id, { collapsed: !target.collapsed });
}

export async function setCollectionsCollapsedInStorage(
  ids: readonly string[],
  collapsed: boolean,
): Promise<number> {
  if (ids.length === 0) return 0;
  const idSet = new Set(ids);
  const existing = await collectionsStorage.getValue();
  const timestamp = nowIso();
  let changed = 0;
  const next = existing.map((item) => {
    if (!idSet.has(item.id) || item.collapsed === collapsed) return item;
    changed += 1;
    return { ...item, collapsed, updatedAt: timestamp };
  });
  if (changed > 0) {
    await collectionsStorage.setValue(next);
  }
  return changed;
}

export async function seedStarterCollectionsInStorage(): Promise<Collection[]> {
  const existing = await collectionsStorage.getValue();
  if (existing.length > 0) return sortByOrder(existing);

  const starters = buildStarterCollections(nowIso());
  await collectionsStorage.setValue(starters);
  return starters;
}
