import {
  parseCollection,
  parseLink,
  parseRule,
  parseSettings,
} from '@/lib/import-export/bundle-parsers';
import type { StashSnapshot } from '@/lib/storage/repo-types';
import { BUILT_IN_THEMES } from '@/lib/themes/built-in-themes';
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
  type ThemeDefinition,
} from '@/lib/types/stash';
import { sortByOrder } from '@/lib/utils/ordering';
import { normalizeUrlForComparison } from '@/lib/utils/url';

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
