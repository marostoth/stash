import { formatBackupFilename } from '@/lib/import-export/bundle';
import {
  parseCollection,
  parseLink,
  parseRule,
  parseSettings,
  parseSpace,
} from '@/lib/import-export/bundle-parsers';
import {
  ensureSpacesList,
  normalizeCollectionsSpaceIds,
} from '@/lib/storage/spaces-ops';
import {
  normalizeImportedCustomTheme,
  validateThemeDefinition,
} from '@/lib/themes/theme-validator';
import type {
  CategorizationRule,
  Collection,
  LinkItem,
  Space,
  StashExportBundle,
  ThemeDefinition,
} from '@/lib/types/stash';
import { sortByOrder } from '@/lib/utils/ordering';

export const PANIC_STORAGE_KEYS = [
  'stash_spaces',
  'stash_collections',
  'stash_links',
  'stash_rules',
  'stash_settings',
  'stash_custom_themes',
] as const;

export type PanicExportOutcome =
  | {
      ok: true;
      filename: string;
      collectionCount: number;
      linkCount: number;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Assembles a valid `schemaVersion: 1` Stash JSON backup directly from raw
 * `chrome.storage.local` key/value data, salvaging every valid item even if
 * individual entries or React/Zustand state are corrupted.
 */
export function buildPanicExportBundleFromRaw(
  raw: Record<string, unknown>,
  exportedAt: string = new Date().toISOString(),
): StashExportBundle {
  const parsedSpaces: Space[] = [];
  if (Array.isArray(raw.stash_spaces)) {
    const seenSpaceIds = new Set<string>();
    for (let i = 0; i < raw.stash_spaces.length; i++) {
      const space = parseSpace(raw.stash_spaces[i], i);
      if (space && !seenSpaceIds.has(space.id)) {
        seenSpaceIds.add(space.id);
        parsedSpaces.push(space);
      }
    }
  }
  const spaces = ensureSpacesList(parsedSpaces, exportedAt);

  const parsedCollections: Collection[] = [];
  if (Array.isArray(raw.stash_collections)) {
    const seenColIds = new Set<string>();
    for (let i = 0; i < raw.stash_collections.length; i++) {
      const col = parseCollection(raw.stash_collections[i], i);
      if (col && !seenColIds.has(col.id)) {
        seenColIds.add(col.id);
        parsedCollections.push(col);
      }
    }
  }
  const collections = normalizeCollectionsSpaceIds(parsedCollections, spaces);

  const parsedLinks: LinkItem[] = [];
  if (Array.isArray(raw.stash_links)) {
    const seenLinkIds = new Set<string>();
    for (let i = 0; i < raw.stash_links.length; i++) {
      const link = parseLink(raw.stash_links[i], i);
      if (link && !seenLinkIds.has(link.id)) {
        seenLinkIds.add(link.id);
        parsedLinks.push(link);
      }
    }
  }

  const parsedRules: CategorizationRule[] = [];
  if (Array.isArray(raw.stash_rules)) {
    for (let i = 0; i < raw.stash_rules.length; i++) {
      const rule = parseRule(raw.stash_rules[i], i + 1);
      if (rule) parsedRules.push(rule);
    }
  }

  const parsedThemes: ThemeDefinition[] = [];
  if (Array.isArray(raw.stash_custom_themes)) {
    for (const rawTheme of raw.stash_custom_themes) {
      const validated = validateThemeDefinition(rawTheme);
      if (validated.ok) {
        parsedThemes.push(normalizeImportedCustomTheme(validated.theme));
      }
    }
  }

  return {
    app: 'stash',
    schemaVersion: 1,
    exportedAt,
    spaces,
    collections,
    links: sortByOrder(parsedLinks),
    rules: parsedRules,
    settings: parseSettings(raw.stash_settings),
    customThemes: parsedThemes,
  };
}

/**
 * Reads Stash keys directly from `browser.storage.local` bypassing React,
 * Zustand, and repository layers.
 */
export async function readRawStashStorage(): Promise<Record<string, unknown>> {
  if (typeof browser === 'undefined' || !browser.storage?.local?.get) {
    return {};
  }
  const raw = await browser.storage.local.get([...PANIC_STORAGE_KEYS]);
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

/**
 * Emergency JSON backup download directly from raw `chrome.storage.local`.
 */
export async function exportPanicJsonBackup(): Promise<PanicExportOutcome> {
  try {
    const raw = await readRawStashStorage();
    const bundle = buildPanicExportBundleFromRaw(raw);
    const filename = formatBackupFilename(new Date());
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } finally {
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    }

    return {
      ok: true,
      filename,
      collectionCount: bundle.collections.length,
      linkCount: bundle.links.length,
    };
  } catch (error: unknown) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Could not read local browser storage.',
    };
  }
}
