import type { StashSnapshot } from '@/lib/storage/repo-types';
import { BUILT_IN_THEMES } from '@/lib/themes/built-in-themes';
import { normalizeHexColor } from '@/lib/themes/contrast';
import {
  normalizeImportedCustomTheme,
  validateThemeDefinition,
} from '@/lib/themes/theme-validator';
import {
  type CategorizationRule,
  type Collection,
  DEFAULT_SETTINGS,
  type LinkItem,
  type StashExportBundle,
  type StashSettings,
  TAB_GROUP_COLORS,
  type TabGroupColor,
  type ThemeDefinition,
} from '@/lib/types/stash';
import { sortByOrder } from '@/lib/utils/ordering';
import { normalizeTags, normalizeUrlForComparison } from '@/lib/utils/url';

const VALID_COLORS = new Set<string>(TAB_GROUP_COLORS);
const BUILT_IN_THEME_IDS = new Set(BUILT_IN_THEMES.map((t) => t.id));

export type BundleValidationResult =
  | { ok: true; bundle: StashExportBundle }
  | { ok: false; error: string };

export interface RestoreStats {
  addedCollections: number;
  skippedCollections: number;
  addedLinks: number;
  skippedLinks: number;
  addedRules: number;
  addedThemes: number;
}

export function buildExportBundle(
  snapshot: StashSnapshot,
  exportedAt: string = new Date().toISOString(),
): StashExportBundle {
  return {
    app: 'stash',
    schemaVersion: 1,
    exportedAt,
    collections: sortByOrder(snapshot.collections),
    links: sortByOrder(snapshot.links),
    rules: snapshot.rules,
    settings: { ...DEFAULT_SETTINGS, ...snapshot.settings },
    customThemes: snapshot.customThemes,
  };
}

export function formatBackupFilename(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `stash-backup-${year}-${month}-${day}.json`;
}

function parseCollection(
  raw: unknown,
  fallbackOrder: number,
): Collection | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id.trim()) return null;
  if (typeof obj.name !== 'string' || !obj.name.trim()) return null;

  const now = new Date().toISOString();
  const color: TabGroupColor =
    typeof obj.color === 'string' && VALID_COLORS.has(obj.color)
      ? (obj.color as TabGroupColor)
      : 'green';

  const tintColor = normalizeHexColor(obj.tintColor) ?? undefined;
  const viewMode =
    obj.viewMode === 'compact' || obj.viewMode === 'cover'
      ? obj.viewMode
      : undefined;

  return {
    id: obj.id.trim(),
    name: obj.name.trim(),
    description:
      typeof obj.description === 'string' && obj.description.trim()
        ? obj.description.trim()
        : undefined,
    color,
    tintColor,
    icon:
      typeof obj.icon === 'string' && obj.icon.trim()
        ? obj.icon.trim()
        : undefined,
    viewMode,
    order: typeof obj.order === 'number' ? obj.order : fallbackOrder,
    collapsed: Boolean(obj.collapsed),
    isSession: obj.isSession === true ? true : undefined,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : now,
  };
}

function parseLink(raw: unknown, fallbackOrder: number): LinkItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id.trim()) return null;
  if (typeof obj.collectionId !== 'string' || !obj.collectionId.trim()) {
    return null;
  }
  if (typeof obj.url !== 'string' || !obj.url.trim()) return null;

  const now = new Date().toISOString();
  const rawTags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === 'string')
    : [];

  return {
    id: obj.id.trim(),
    collectionId: obj.collectionId.trim(),
    url: obj.url.trim(),
    title:
      typeof obj.title === 'string' && obj.title.trim()
        ? obj.title.trim()
        : obj.url.trim(),
    note: typeof obj.note === 'string' ? obj.note : '',
    tags: normalizeTags(rawTags),
    tagsLocked: obj.tagsLocked === true ? true : undefined,
    faviconUrl:
      typeof obj.faviconUrl === 'string' && obj.faviconUrl.trim()
        ? obj.faviconUrl.trim()
        : undefined,
    order: typeof obj.order === 'number' ? obj.order : fallbackOrder,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : now,
    lastOpenedAt:
      typeof obj.lastOpenedAt === 'string' ? obj.lastOpenedAt : undefined,
  };
}

function parseRule(
  raw: unknown,
  fallbackPriority: number,
): CategorizationRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id.trim()) return null;
  if (!obj.match || typeof obj.match !== 'object') return null;
  if (!obj.action || typeof obj.action !== 'object') return null;

  const matchObj = obj.match as Record<string, unknown>;
  const actionObj = obj.action as Record<string, unknown>;
  if (
    typeof actionObj.targetCollectionId !== 'string' ||
    !actionObj.targetCollectionId.trim()
  ) {
    return null;
  }

  const readStringArray = (val: unknown): string[] | undefined => {
    if (!Array.isArray(val)) return undefined;
    const cleaned = val
      .filter((item): item is string => typeof item === 'string')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  };

  return {
    id: obj.id.trim(),
    name:
      typeof obj.name === 'string' && obj.name.trim()
        ? obj.name.trim()
        : 'Imported Rule',
    enabled: obj.enabled !== false,
    priority:
      typeof obj.priority === 'number' ? obj.priority : fallbackPriority,
    match: {
      domainContains: readStringArray(matchObj.domainContains),
      titleKeywords: readStringArray(matchObj.titleKeywords),
      urlContains: readStringArray(matchObj.urlContains),
    },
    action: {
      targetCollectionId: actionObj.targetCollectionId.trim(),
      addTags: readStringArray(actionObj.addTags),
    },
  };
}

function parseSettings(raw: unknown): StashSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_SETTINGS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    activeThemeId:
      typeof obj.activeThemeId === 'string' && obj.activeThemeId.trim()
        ? obj.activeThemeId.trim()
        : DEFAULT_SETTINGS.activeThemeId,
    openLinkInNewTab:
      typeof obj.openLinkInNewTab === 'boolean'
        ? obj.openLinkInNewTab
        : DEFAULT_SETTINGS.openLinkInNewTab,
    includePinnedInSessions:
      typeof obj.includePinnedInSessions === 'boolean'
        ? obj.includePinnedInSessions
        : DEFAULT_SETTINGS.includePinnedInSessions,
    closeTabOnQuickStash:
      typeof obj.closeTabOnQuickStash === 'boolean'
        ? obj.closeTabOnQuickStash
        : DEFAULT_SETTINGS.closeTabOnQuickStash,
    openTabsSidebarVisible:
      typeof obj.openTabsSidebarVisible === 'boolean'
        ? obj.openTabsSidebarVisible
        : DEFAULT_SETTINGS.openTabsSidebarVisible,
    enableOnDeviceAi:
      typeof obj.enableOnDeviceAi === 'boolean'
        ? obj.enableOnDeviceAi
        : DEFAULT_SETTINGS.enableOnDeviceAi,
    autoTagOnSave:
      typeof obj.autoTagOnSave === 'boolean'
        ? obj.autoTagOnSave
        : DEFAULT_SETTINGS.autoTagOnSave,
    motionMode:
      obj.motionMode === 'arcade' ||
      obj.motionMode === 'tactile' ||
      obj.motionMode === 'reduced' ||
      obj.motionMode === 'off'
        ? obj.motionMode
        : DEFAULT_SETTINGS.motionMode,
    soundEffects:
      typeof obj.soundEffects === 'boolean'
        ? obj.soundEffects
        : DEFAULT_SETTINGS.soundEffects,
    hoverPreviews:
      typeof obj.hoverPreviews === 'boolean'
        ? obj.hoverPreviews
        : DEFAULT_SETTINGS.hoverPreviews,
    visualPreviewsEnabled:
      typeof obj.visualPreviewsEnabled === 'boolean'
        ? obj.visualPreviewsEnabled
        : DEFAULT_SETTINGS.visualPreviewsEnabled,
    density:
      obj.density === 'compact' || obj.density === 'comfortable'
        ? obj.density
        : DEFAULT_SETTINGS.density,
    customThemes: [],
  };
}

export function validateExportBundle(raw: unknown): BundleValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Backup file must be a JSON object.' };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.app !== 'stash') {
    return {
      ok: false,
      error: 'Unrecognized backup file (expected "app": "stash").',
    };
  }
  if (obj.schemaVersion !== 1) {
    return {
      ok: false,
      error: `Unsupported schemaVersion "${String(obj.schemaVersion)}" (expected 1).`,
    };
  }
  if (!Array.isArray(obj.collections) || !Array.isArray(obj.links)) {
    return {
      ok: false,
      error: 'Backup is missing required "collections" or "links" arrays.',
    };
  }

  const collections: Collection[] = [];
  for (let i = 0; i < obj.collections.length; i++) {
    const parsed = parseCollection(obj.collections[i], i);
    if (!parsed) {
      return { ok: false, error: `Invalid collection entry at index ${i}.` };
    }
    collections.push(parsed);
  }

  const links: LinkItem[] = [];
  for (let i = 0; i < obj.links.length; i++) {
    const parsed = parseLink(obj.links[i], i);
    if (!parsed) {
      return { ok: false, error: `Invalid link entry at index ${i}.` };
    }
    links.push(parsed);
  }

  const rules: CategorizationRule[] = [];
  if (Array.isArray(obj.rules)) {
    for (let i = 0; i < obj.rules.length; i++) {
      const parsed = parseRule(obj.rules[i], i + 1);
      if (parsed) rules.push(parsed);
    }
  }

  const customThemes: ThemeDefinition[] = [];
  if (Array.isArray(obj.customThemes)) {
    for (const rawTheme of obj.customThemes) {
      const validated = validateThemeDefinition(rawTheme);
      if (validated.ok) {
        customThemes.push(normalizeImportedCustomTheme(validated.theme));
      }
    }
  }

  return {
    ok: true,
    bundle: {
      app: 'stash',
      schemaVersion: 1,
      exportedAt:
        typeof obj.exportedAt === 'string'
          ? obj.exportedAt
          : new Date().toISOString(),
      collections,
      links,
      rules,
      settings: parseSettings(obj.settings),
      customThemes,
    },
  };
}

export function prepareReplaceSnapshot(bundle: StashExportBundle): {
  snapshot: StashSnapshot;
  stats: RestoreStats;
} {
  const collections = sortByOrder(bundle.collections).map((col, idx) => ({
    ...col,
    order: idx,
  }));
  const validCollectionIds = new Set(collections.map((c) => c.id));

  // Keep valid links, deduplicating per collection by normalized URL
  const linksByCollection = new Map<string, LinkItem[]>();
  const seenUrlsByCollection = new Map<string, Set<string>>();
  let skippedLinks = 0;

  for (const link of sortByOrder(bundle.links)) {
    if (!validCollectionIds.has(link.collectionId)) {
      skippedLinks += 1;
      continue;
    }
    const urlSet =
      seenUrlsByCollection.get(link.collectionId) ?? new Set<string>();
    const normalized = normalizeUrlForComparison(link.url);
    if (urlSet.has(normalized)) {
      skippedLinks += 1;
      continue;
    }
    urlSet.add(normalized);
    seenUrlsByCollection.set(link.collectionId, urlSet);

    const bucket = linksByCollection.get(link.collectionId) ?? [];
    bucket.push({ ...link, order: bucket.length });
    linksByCollection.set(link.collectionId, bucket);
  }

  const links = Array.from(linksByCollection.values()).flat();
  const rules = bundle.rules
    .filter((r) => validCollectionIds.has(r.action.targetCollectionId))
    .map((r, idx) => ({ ...r, priority: idx + 1 }));

  return {
    snapshot: {
      collections,
      links,
      rules,
      settings: parseSettings(bundle.settings),
      customThemes: bundle.customThemes,
    },
    stats: {
      addedCollections: collections.length,
      skippedCollections: 0,
      addedLinks: links.length,
      skippedLinks,
      addedRules: rules.length,
      addedThemes: bundle.customThemes.length,
    },
  };
}

export function mergeBundleIntoSnapshot(
  current: StashSnapshot,
  incoming: StashExportBundle,
): { snapshot: StashSnapshot; stats: RestoreStats } {
  const existingCollections = sortByOrder(current.collections);
  const collectionIds = new Set(existingCollections.map((c) => c.id));
  const mergedCollections = [...existingCollections];
  let addedCollections = 0;
  let skippedCollections = 0;

  for (const col of sortByOrder(incoming.collections)) {
    if (collectionIds.has(col.id)) {
      skippedCollections += 1;
      continue;
    }
    collectionIds.add(col.id);
    mergedCollections.push({ ...col, order: mergedCollections.length });
    addedCollections += 1;
  }

  const linkIds = new Set(current.links.map((l) => l.id));
  const urlsByCollection = new Map<string, Set<string>>();
  const countByCollection = new Map<string, number>();

  for (const link of current.links) {
    const urlSet = urlsByCollection.get(link.collectionId) ?? new Set<string>();
    urlSet.add(normalizeUrlForComparison(link.url));
    urlsByCollection.set(link.collectionId, urlSet);
    countByCollection.set(
      link.collectionId,
      (countByCollection.get(link.collectionId) ?? 0) + 1,
    );
  }

  const mergedLinks = [...current.links];
  let addedLinks = 0;
  let skippedLinks = 0;

  for (const link of sortByOrder(incoming.links)) {
    if (!collectionIds.has(link.collectionId) || linkIds.has(link.id)) {
      skippedLinks += 1;
      continue;
    }
    const urlSet = urlsByCollection.get(link.collectionId) ?? new Set<string>();
    const normalized = normalizeUrlForComparison(link.url);
    if (urlSet.has(normalized)) {
      skippedLinks += 1;
      continue;
    }
    urlSet.add(normalized);
    urlsByCollection.set(link.collectionId, urlSet);
    linkIds.add(link.id);

    const nextOrder = countByCollection.get(link.collectionId) ?? 0;
    countByCollection.set(link.collectionId, nextOrder + 1);
    mergedLinks.push({ ...link, order: nextOrder });
    addedLinks += 1;
  }

  const ruleIds = new Set(current.rules.map((r) => r.id));
  const mergedRules = [...current.rules];
  let addedRules = 0;
  for (const rule of incoming.rules) {
    if (
      ruleIds.has(rule.id) ||
      !collectionIds.has(rule.action.targetCollectionId)
    ) {
      continue;
    }
    ruleIds.add(rule.id);
    mergedRules.push({ ...rule, priority: mergedRules.length + 1 });
    addedRules += 1;
  }

  const themeIds = new Set(current.customThemes.map((t) => t.id));
  const mergedThemes = [...current.customThemes];
  let addedThemes = 0;
  for (const theme of incoming.customThemes) {
    if (themeIds.has(theme.id) || BUILT_IN_THEME_IDS.has(theme.id)) {
      continue;
    }
    themeIds.add(theme.id);
    mergedThemes.push({ ...theme, isBuiltIn: false });
    addedThemes += 1;
  }

  return {
    snapshot: {
      collections: mergedCollections,
      links: mergedLinks,
      rules: mergedRules,
      settings: current.settings,
      customThemes: mergedThemes,
    },
    stats: {
      addedCollections,
      skippedCollections,
      addedLinks,
      skippedLinks,
      addedRules,
      addedThemes,
    },
  };
}
