import { isValidCatalogIcon } from '@/lib/icons/catalog';
import {
  type ProposedCategory,
  UNCATEGORIZED_CATEGORY_NAME,
} from '@/lib/reorganize/digest';
import {
  type Collection,
  type LinkItem,
  TAB_GROUP_COLORS,
} from '@/lib/types/stash';
import { sortByOrder } from '@/lib/utils/ordering';
import { normalizeUrlForComparison } from '@/lib/utils/url';

export type ReorganizeScope =
  | {
      mode: 'collections';
      collectionIds: string[];
      keepExistingTargets: boolean;
    }
  | {
      mode: 'full';
    };

export interface LibraryBoardState {
  collections: Collection[];
  links: LinkItem[];
}

export interface ReorganizeSummary {
  movedLinks: number;
  deduplicatedLinks: number;
  createdCollections: number;
  removedEmptyCollections: number;
  targetCollectionsCount: number;
  uncategorizedCount: number;
}

export interface ReorganizePlanResult {
  nextState: LibraryBoardState;
  summary: ReorganizeSummary;
}

export interface BuildPlanOptions {
  nowIso?: string;
  createId?: () => string;
}

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Pure planner taking current collections/links, chosen scope, user-approved
 * categories, per-link category assignments, and empty-source removal flag.
 *
 * Guarantees:
 * - Preserves every link's exact id, tags, tagsLocked, note, faviconUrl, and timestamps
 * - Enforces duplicate-URL guard inside every destination collection
 * - Never touches collections or links outside the chosen scope
 * - Creates "Uncategorized" only if at least one link actually routes there
 */
export function buildReorganizationPlan(
  currentState: LibraryBoardState,
  scope: ReorganizeScope,
  approvedCategories: readonly ProposedCategory[],
  linkAssignments: Readonly<Record<string, string>>,
  removeEmptySources: boolean,
  options: BuildPlanOptions = {},
): ReorganizePlanResult {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const createId = options.createId ?? (() => crypto.randomUUID());

  const scopeCollectionIds =
    scope.mode === 'full'
      ? new Set(currentState.collections.map((c) => c.id))
      : new Set(scope.collectionIds);

  const inScopeLinks: LinkItem[] = [];
  const untouchedLinks: LinkItem[] = [];

  for (const link of sortByOrder(currentState.links)) {
    if (scopeCollectionIds.has(link.collectionId)) {
      inScopeLinks.push(link);
    } else {
      untouchedLinks.push(link);
    }
  }

  // Build mutable map of existing collections sorted by current order
  const workingCollections: Collection[] = sortByOrder(
    currentState.collections,
  ).map((c) => ({ ...c }));
  const collectionByNameKey = new Map<string, Collection>();
  for (const col of workingCollections) {
    const key = normalizeNameKey(col.name);
    if (!collectionByNameKey.has(key)) {
      collectionByNameKey.set(key, col);
    }
  }

  // Build lookup of allowed category names (approved + optional untouched existing collections)
  const approvedByKey = new Map<string, ProposedCategory>();
  for (const cat of approvedCategories) {
    const key = normalizeNameKey(cat.name);
    if (key && !approvedByKey.has(key)) {
      approvedByKey.set(key, cat);
    }
  }

  let createdCollections = 0;
  let colorCursor = workingCollections.length;

  const ensureCollectionForName = (
    rawName: string,
    description?: string,
    icon?: string,
  ): Collection => {
    const trimmed = rawName.trim() || UNCATEGORIZED_CATEGORY_NAME;
    const key = normalizeNameKey(trimmed);
    const validIcon =
      icon && isValidCatalogIcon(icon.trim()) ? icon.trim() : undefined;
    const existing = collectionByNameKey.get(key);
    if (existing) {
      if (!existing.description && description) {
        existing.description = description;
        existing.updatedAt = nowIso;
      }
      if (!existing.icon && validIcon) {
        existing.icon = validIcon;
        existing.updatedAt = nowIso;
      }
      return existing;
    }

    const color =
      key === normalizeNameKey(UNCATEGORIZED_CATEGORY_NAME)
        ? 'grey'
        : (TAB_GROUP_COLORS[colorCursor % TAB_GROUP_COLORS.length] ?? 'green');
    colorCursor += 1;

    const created: Collection = {
      id: createId(),
      name: trimmed,
      description: description?.trim() || undefined,
      icon: validIcon,
      color,
      order: workingCollections.length,
      collapsed: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    workingCollections.push(created);
    collectionByNameKey.set(key, created);
    createdCollections += 1;
    return created;
  };

  // Track normalized URLs per destination collection (pre-seeded with untouched links)
  const urlsByCollectionId = new Map<string, Set<string>>();
  const linksByCollectionId = new Map<string, LinkItem[]>();

  for (const link of untouchedLinks) {
    const normalized = normalizeUrlForComparison(link.url);
    const urlSet = urlsByCollectionId.get(link.collectionId) ?? new Set();
    urlSet.add(normalized);
    urlsByCollectionId.set(link.collectionId, urlSet);

    const bucket = linksByCollectionId.get(link.collectionId) ?? [];
    bucket.push({ ...link });
    linksByCollectionId.set(link.collectionId, bucket);
  }

  let movedLinks = 0;
  let deduplicatedLinks = 0;
  let uncategorizedCount = 0;
  const populatedTargetIds = new Set<string>();

  for (const link of inScopeLinks) {
    const assignedRaw = (linkAssignments[link.id] ?? '').trim();
    const assignedKey = normalizeNameKey(assignedRaw);

    let targetCollection: Collection;
    const approvedMatch = assignedKey
      ? approvedByKey.get(assignedKey)
      : undefined;
    const existingMatch =
      assignedKey && scope.mode === 'collections' && scope.keepExistingTargets
        ? collectionByNameKey.get(assignedKey)
        : undefined;

    if (approvedMatch) {
      targetCollection = ensureCollectionForName(
        approvedMatch.name,
        approvedMatch.description,
        approvedMatch.icon,
      );
    } else if (existingMatch) {
      targetCollection = existingMatch;
    } else {
      targetCollection = ensureCollectionForName(UNCATEGORIZED_CATEGORY_NAME);
      uncategorizedCount += 1;
    }

    const normalizedUrl = normalizeUrlForComparison(link.url);
    const urlSet = urlsByCollectionId.get(targetCollection.id) ?? new Set();
    if (urlSet.has(normalizedUrl)) {
      deduplicatedLinks += 1;
      continue;
    }

    urlSet.add(normalizedUrl);
    urlsByCollectionId.set(targetCollection.id, urlSet);
    populatedTargetIds.add(targetCollection.id);

    const bucket = linksByCollectionId.get(targetCollection.id) ?? [];
    bucket.push({
      ...link,
      collectionId: targetCollection.id,
      updatedAt:
        link.collectionId !== targetCollection.id ? nowIso : link.updatedAt,
    });
    linksByCollectionId.set(targetCollection.id, bucket);
    movedLinks += 1;
  }

  // Optionally remove source collections that became completely empty
  let removedEmptyCollections = 0;
  const survivingCollections: Collection[] = [];
  for (const col of workingCollections) {
    const colLinks = linksByCollectionId.get(col.id) ?? [];
    const isSourceCollection = scopeCollectionIds.has(col.id);
    if (removeEmptySources && isSourceCollection && colLinks.length === 0) {
      removedEmptyCollections += 1;
      continue;
    }
    survivingCollections.push(col);
  }

  // Re-index collection order and link order cleanly
  const finalCollections = survivingCollections.map((col, idx) => ({
    ...col,
    order: idx,
  }));

  const finalLinks: LinkItem[] = [];
  for (const col of finalCollections) {
    const bucket = linksByCollectionId.get(col.id) ?? [];
    for (let idx = 0; idx < bucket.length; idx++) {
      const item = bucket[idx];
      if (!item) continue;
      finalLinks.push({ ...item, order: idx });
    }
  }

  return {
    nextState: {
      collections: finalCollections,
      links: finalLinks,
    },
    summary: {
      movedLinks,
      deduplicatedLinks,
      createdCollections,
      removedEmptyCollections,
      targetCollectionsCount: populatedTargetIds.size,
      uncategorizedCount,
    },
  };
}
