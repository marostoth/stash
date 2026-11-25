import { linksStorage } from '@/lib/storage/items';
import type {
  AddLinkInput,
  AddLinkResult,
  MoveLinkResult,
  UpdateLinkInput,
  UpdateLinkResult,
} from '@/lib/storage/repo-types';
import type { LinkItem, ProductMeta } from '@/lib/types/stash';
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

function normalizeProductMeta(
  raw: ProductMeta | null | undefined,
): ProductMeta | undefined {
  if (!raw) return undefined;
  const store = raw.store?.trim() || undefined;
  const spec = raw.spec?.trim() || undefined;
  const price =
    typeof raw.price === 'number' &&
    Number.isFinite(raw.price) &&
    raw.price >= 0
      ? Math.round(raw.price * 100) / 100
      : undefined;
  const currency =
    typeof raw.currency === 'string' &&
    /^[a-zA-Z]{3}$/.test(raw.currency.trim())
      ? raw.currency.trim().toUpperCase()
      : undefined;
  const orderQty =
    typeof raw.orderQty === 'number' &&
    Number.isFinite(raw.orderQty) &&
    raw.orderQty >= 1
      ? Math.floor(raw.orderQty)
      : undefined;
  const priceIsEstimate = raw.priceIsEstimate === true ? true : undefined;

  if (
    store === undefined &&
    spec === undefined &&
    price === undefined &&
    orderQty === undefined
  ) {
    return undefined;
  }

  return {
    ...(store !== undefined ? { store } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(currency !== undefined ? { currency } : {}),
    ...(priceIsEstimate ? { priceIsEstimate: true } : {}),
    ...(spec !== undefined ? { spec } : {}),
    ...(orderQty !== undefined ? { orderQty } : {}),
    source: raw.source,
    ...(raw.capturedAt ? { capturedAt: raw.capturedAt } : {}),
  };
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
  const product = normalizeProductMeta(input.product);
  const created: LinkItem = {
    id: crypto.randomUUID(),
    collectionId: input.collectionId,
    url: trimmedUrl,
    title: input.title?.trim() || extractDomain(trimmedUrl),
    note: input.note?.trim() ?? '',
    tags: normalizeTags(input.tags ?? []),
    ...(input.tagsLocked === true ? { tagsLocked: true } : {}),
    ...(input.starred === true ? { starred: true } : {}),
    ...(product ? { product } : {}),
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

  const nextProduct =
    patch.product !== undefined
      ? normalizeProductMeta(patch.product)
      : current.product;

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
    product: nextProduct,
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

/**
 * Batch-updates `starred` on multiple links in a single storage write while
 * preserving persistent `product.orderQty` counts.
 */
export async function setLinksStarredInStorage(
  ids: readonly string[],
  starred: boolean,
): Promise<string[]> {
  if (ids.length === 0) return [];
  const idSet = new Set(ids);
  const existing = await linksStorage.getValue();
  const changedIds: string[] = [];
  const timestamp = nowIso();

  const next = existing.map((item) => {
    if (!idSet.has(item.id)) return item;
    const currentlyStarred = item.starred === true;
    if (currentlyStarred === starred) return item;
    changedIds.push(item.id);
    return {
      ...item,
      starred: starred ? true : undefined,
      updatedAt: timestamp,
    };
  });

  if (changedIds.length > 0) {
    await linksStorage.setValue(next);
  }
  return changedIds;
}
