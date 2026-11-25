import { linksStorage } from '@/lib/storage/items';
import type {
  AddLinkInput,
  AddLinkResult,
  MoveLinkResult,
  UpdateLinkInput,
  UpdateLinkResult,
} from '@/lib/storage/repo-types';
import type { LinkItem } from '@/lib/types/stash';
import {
  insertLinkAtIndexInList,
  type MoveLinkListResult,
  moveOrReorderLinkInList,
} from '@/lib/utils/ordering';
import {
  extractDomain,
  normalizeTags,
  normalizeUrlForComparison,
} from '@/lib/utils/url';

function nowIso(): string {
  return new Date().toISOString();
}

export function findDuplicateLinkInList(
  links: readonly LinkItem[],
  collectionId: string,
  url: string,
  excludeLinkId?: string,
): LinkItem | undefined {
  const normalized = normalizeUrlForComparison(url);
  return links.find(
    (item) =>
      item.collectionId === collectionId &&
      item.id !== excludeLinkId &&
      normalizeUrlForComparison(item.url) === normalized,
  );
}

export async function addLinkInStorage(
  input: AddLinkInput,
  targetIndex?: number,
): Promise<AddLinkResult> {
  const existing = await linksStorage.getValue();
  const duplicate = findDuplicateLinkInList(
    existing,
    input.collectionId,
    input.url,
  );
  if (duplicate) {
    return { ok: false, reason: 'duplicate', existingLink: duplicate };
  }

  const timestamp = nowIso();
  const trimmedUrl = input.url.trim();
  const created: LinkItem = {
    id: crypto.randomUUID(),
    collectionId: input.collectionId,
    url: trimmedUrl,
    title: input.title?.trim() || extractDomain(trimmedUrl),
    note: input.note?.trim() ?? '',
    tags: normalizeTags(input.tags ?? []),
    ...(input.tagsLocked === true ? { tagsLocked: true } : {}),
    ...(input.starred === true ? { starred: true } : {}),
    faviconUrl: input.faviconUrl?.trim() || undefined,
    order: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const nextLinks = insertLinkAtIndexInList(existing, created, targetIndex);
  const persisted = nextLinks.find((item) => item.id === created.id) ?? created;
  await linksStorage.setValue(nextLinks);
  return { ok: true, link: persisted };
}

export async function updateLinkInStorage(
  id: string,
  patch: UpdateLinkInput,
): Promise<UpdateLinkResult> {
  const existing = await linksStorage.getValue();
  const current = existing.find((item) => item.id === id);
  if (!current) return { ok: false, reason: 'not_found' };

  const targetCollectionId = patch.collectionId ?? current.collectionId;
  const targetUrl = patch.url !== undefined ? patch.url.trim() : current.url;

  const duplicate = findDuplicateLinkInList(
    existing,
    targetCollectionId,
    targetUrl,
    id,
  );
  if (duplicate) {
    return { ok: false, reason: 'duplicate', existingLink: duplicate };
  }

  let nextOrder = patch.order ?? current.order;
  if (
    patch.collectionId !== undefined &&
    patch.collectionId !== current.collectionId &&
    patch.order === undefined
  ) {
    const targetMax = existing
      .filter((item) => item.collectionId === targetCollectionId)
      .reduce((max, item) => Math.max(max, item.order), -1);
    nextOrder = targetMax + 1;
  }

  const nextTagsLocked =
    patch.tagsLocked !== undefined
      ? patch.tagsLocked
        ? true
        : undefined
      : current.tagsLocked;

  const nextStarred =
    patch.starred !== undefined
      ? patch.starred
        ? true
        : undefined
      : current.starred;

  const updated: LinkItem = {
    ...current,
    collectionId: targetCollectionId,
    url: targetUrl,
    title:
      patch.title !== undefined
        ? patch.title.trim() || extractDomain(targetUrl)
        : current.title,
    note: patch.note !== undefined ? patch.note.trim() : current.note,
    tags: patch.tags !== undefined ? normalizeTags(patch.tags) : current.tags,
    tagsLocked: nextTagsLocked,
    starred: nextStarred,
    faviconUrl:
      patch.faviconUrl !== undefined
        ? patch.faviconUrl.trim() || undefined
        : current.faviconUrl,
    order: nextOrder,
    updatedAt: nowIso(),
  };

  await linksStorage.setValue(
    existing.map((item) => (item.id === id ? updated : item)),
  );
  return { ok: true, link: updated };
}

export async function applyAutoTagsInStorage(
  id: string,
  tags: readonly string[],
): Promise<LinkItem | null> {
  const cleaned = normalizeTags(tags).slice(0, 3);
  if (cleaned.length === 0) return null;

  const existing = await linksStorage.getValue();
  const current = existing.find((item) => item.id === id);
  if (!current || current.tagsLocked || current.tags.length > 0) {
    return null;
  }

  const updated: LinkItem = {
    ...current,
    tags: cleaned,
    updatedAt: nowIso(),
  };
  await linksStorage.setValue(
    existing.map((item) => (item.id === id ? updated : item)),
  );
  return updated;
}

export async function moveOrReorderLinkInStorage(
  linkId: string,
  targetCollectionId: string,
  targetIndex?: number,
): Promise<MoveLinkResult> {
  const existing = await linksStorage.getValue();
  const result: MoveLinkListResult = moveOrReorderLinkInList(
    existing,
    linkId,
    targetCollectionId,
    targetIndex,
    nowIso(),
  );
  if (!result.ok) return result;
  await linksStorage.setValue(result.links);
  return { ok: true, link: result.link };
}

export async function markLinkOpenedInStorage(id: string): Promise<void> {
  const existing = await linksStorage.getValue();
  let changed = false;
  const timestamp = nowIso();
  const next = existing.map((item) => {
    if (item.id !== id) return item;
    changed = true;
    return { ...item, lastOpenedAt: timestamp };
  });
  if (changed) await linksStorage.setValue(next);
}
