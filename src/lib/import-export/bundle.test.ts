import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  buildExportBundle,
  formatBackupFilename,
  mergeBundleIntoSnapshot,
  prepareReplaceSnapshot,
  validateExportBundle,
} from '@/lib/import-export/bundle';
import { stashRepo } from '@/lib/storage/repo';
import { OSCILLOSCOPE_THEME } from '@/lib/themes/built-in-themes';
import {
  createDefaultSpace,
  DEFAULT_SETTINGS,
  DEFAULT_SPACE_ID,
  type StashExportBundle,
} from '@/lib/types/stash';

const NOW = '2026-11-25T11:30:00.000Z';

function makeValidBundle(): StashExportBundle {
  return {
    app: 'stash',
    schemaVersion: 1,
    exportedAt: NOW,
    collections: [
      {
        id: 'col-1',
        name: '3D Printing',
        color: 'cyan',
        order: 0,
        collapsed: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'col-2',
        name: 'Dev',
        color: 'blue',
        order: 1,
        collapsed: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    links: [
      {
        id: 'link-1',
        collectionId: 'col-1',
        url: 'https://printables.com',
        title: 'Printables',
        note: 'STL models',
        tags: ['3d-printing'],
        order: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'link-2',
        collectionId: 'col-2',
        url: 'https://wxt.dev/',
        title: 'WXT',
        note: '',
        tags: ['chrome'],
        order: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    rules: [
      {
        id: 'rule-1',
        name: 'Printables',
        enabled: true,
        priority: 1,
        match: { domainContains: ['printables.com'] },
        action: { targetCollectionId: 'col-1', addTags: ['stl'] },
      },
    ],
    settings: { ...DEFAULT_SETTINGS, activeThemeId: 'clean-light' },
    customThemes: [
      {
        ...OSCILLOSCOPE_THEME,
        id: 'amber-crt',
        name: 'Amber CRT',
        isBuiltIn: false,
      },
    ],
  };
}

describe('StashExportBundle validation & restore', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('validates schemaVersion 1 bundles and rejects malformed files', () => {
    const valid = validateExportBundle(makeValidBundle());
    expect(valid.ok).toBe(true);

    expect(validateExportBundle(null).ok).toBe(false);
    expect(validateExportBundle({ app: 'other', schemaVersion: 1 }).ok).toBe(
      false,
    );
    expect(
      validateExportBundle({
        app: 'stash',
        schemaVersion: 2,
        collections: [],
        links: [],
      }).ok,
    ).toBe(false);
    expect(
      validateExportBundle({
        app: 'stash',
        schemaVersion: 1,
        collections: [{ id: '', name: 'Bad' }],
        links: [],
      }).ok,
    ).toBe(false);

    expect(formatBackupFilename(new Date(2026, 10, 25))).toBe(
      'stash-backup-2026-11-25.json',
    );
  });

  it('merges bundles without duplicating IDs or normalized URLs and keeps current settings', () => {
    const bundle = makeValidBundle();
    const firstCol = bundle.collections[0];
    expect(firstCol).toBeDefined();
    if (!firstCol) return;

    const current = {
      spaces: [createDefaultSpace(NOW)],
      collections: [firstCol],
      links: [
        {
          id: 'existing-different-id',
          collectionId: 'col-1',
          url: 'https://PRINTABLES.com/',
          title: 'Existing Printables',
          note: 'Local note',
          tags: [],
          order: 0,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      rules: [],
      settings: { ...DEFAULT_SETTINGS, activeThemeId: 'oscilloscope' },
      customThemes: [],
    };

    const { snapshot, stats } = mergeBundleIntoSnapshot(current, bundle);
    expect(stats.addedCollections).toBe(1);
    expect(stats.skippedCollections).toBe(1);
    expect(stats.addedLinks).toBe(1);
    expect(stats.skippedLinks).toBe(1);
    expect(stats.addedRules).toBe(1);
    expect(stats.addedThemes).toBe(1);
    expect(snapshot.collections).toHaveLength(2);
    expect(snapshot.links).toHaveLength(2);
    expect(snapshot.settings.activeThemeId).toBe('oscilloscope');
  });

  it('replaces storage identically and drops orphan links cleanly', async () => {
    await stashRepo.createCollection({ name: 'Old Local Collection' });

    const incoming = makeValidBundle();
    incoming.links.push({
      id: 'orphan-link',
      collectionId: 'missing-col',
      url: 'https://orphan.example.com',
      title: 'Orphan',
      note: '',
      tags: [],
      order: 0,
      createdAt: NOW,
      updatedAt: NOW,
    });

    const preview = prepareReplaceSnapshot(incoming);
    expect(preview.stats.skippedLinks).toBe(1);

    await stashRepo.restoreBundle(incoming, 'replace');
    const restored = await stashRepo.getSnapshot();
    const reExported = buildExportBundle(restored, NOW);

    expect(reExported.collections.map((c) => c.id)).toEqual(['col-1', 'col-2']);
    expect(reExported.links.map((l) => l.id)).toEqual(['link-1', 'link-2']);
    expect(reExported.rules).toHaveLength(1);
    expect(reExported.settings.activeThemeId).toBe('clean-light');
    expect(reExported.customThemes.map((t) => t.id)).toEqual(['amber-crt']);
  });

  it('preserves starred links and micro card density across JSON backup validation and restore', async () => {
    const incoming = makeValidBundle();
    const firstLink = incoming.links[0];
    expect(firstLink).toBeDefined();
    if (!firstLink) return;
    incoming.links[0] = { ...firstLink, starred: true };
    incoming.settings = { ...incoming.settings, density: 'micro' };

    const validated = validateExportBundle(incoming);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    expect(validated.bundle.links[0]?.starred).toBe(true);
    expect(validated.bundle.links[1]?.starred).toBeUndefined();
    expect(validated.bundle.settings.density).toBe('micro');

    await stashRepo.restoreBundle(validated.bundle, 'replace');
    const restored = await stashRepo.getSnapshot();
    const reExported = buildExportBundle(restored, NOW);

    expect(reExported.links.find((l) => l.id === 'link-1')?.starred).toBe(true);
    expect(
      reExported.links.find((l) => l.id === 'link-2')?.starred,
    ).toBeUndefined();
    expect(reExported.settings.density).toBe('micro');
  });

  it('migrates legacy schemaVersion 1 JSON without spaces/spaceId to Main and round-trips multi-Space backups', async () => {
    // Legacy bundle has no `spaces` array and collections have no `spaceId`
    const legacyRaw = makeValidBundle();
    const validatedLegacy = validateExportBundle(legacyRaw);
    expect(validatedLegacy.ok).toBe(true);
    if (!validatedLegacy.ok) return;

    expect(validatedLegacy.bundle.spaces).toHaveLength(1);
    expect(validatedLegacy.bundle.spaces?.[0]?.id).toBe(DEFAULT_SPACE_ID);
    expect(validatedLegacy.bundle.spaces?.[0]?.name).toBe('Main');
    expect(
      validatedLegacy.bundle.collections.every(
        (c) => c.spaceId === DEFAULT_SPACE_ID,
      ),
    ).toBe(true);

    // Multi-Space modern backup round-trip
    const reordersSpace = {
      id: 'space-reorders',
      name: 'Reorders',
      icon: 'shopping-bag',
      order: 1,
      densityOverride: 'micro' as const,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const [col0, col1] = legacyRaw.collections;
    expect(col0).toBeDefined();
    expect(col1).toBeDefined();
    if (!col0 || !col1) return;

    const multiSpaceIncoming: StashExportBundle = {
      ...makeValidBundle(),
      spaces: [createDefaultSpace(NOW), reordersSpace],
      collections: [
        { ...col0, spaceId: DEFAULT_SPACE_ID },
        { ...col1, spaceId: reordersSpace.id },
      ],
    };

    const validatedMulti = validateExportBundle(multiSpaceIncoming);
    expect(validatedMulti.ok).toBe(true);
    if (!validatedMulti.ok) return;

    await stashRepo.restoreBundle(validatedMulti.bundle, 'replace');
    const restored = await stashRepo.getSnapshot();
    const reExported = buildExportBundle(restored, NOW);

    expect(reExported.spaces?.map((s) => s.id)).toEqual([
      DEFAULT_SPACE_ID,
      'space-reorders',
    ]);
    expect(reExported.spaces?.[1]?.densityOverride).toBe('micro');
    expect(reExported.collections.find((c) => c.id === 'col-2')?.spaceId).toBe(
      'space-reorders',
    );
  });
});
