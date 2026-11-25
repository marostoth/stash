import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { validateExportBundle } from '@/lib/import-export/bundle';
import {
  buildPanicExportBundleFromRaw,
  readRawStashStorage,
} from '@/lib/import-export/panic-backup';
import { stashRepo } from '@/lib/storage/repo';
import { DEFAULT_SPACE_ID } from '@/lib/types/stash';

describe('panic-backup raw storage serializer', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('builds a valid schemaVersion 1 bundle directly from raw storage entries', () => {
    const raw: Record<string, unknown> = {
      stash_spaces: [
        {
          id: DEFAULT_SPACE_ID,
          name: 'Main',
          order: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'space-reorders',
          name: 'Reorders',
          viewMode: 'details',
          groupBy: 'store',
          order: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      stash_collections: [
        {
          id: 'col-1',
          name: 'Filament',
          spaceId: 'space-reorders',
          order: 0,
          isSession: false,
          collapsed: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      stash_links: [
        {
          id: 'link-1',
          collectionId: 'col-1',
          url: 'https://www.amazon.co.uk/dp/B07PGZNM34',
          title: 'eSUN PLA+ Black',
          tags: ['pla'],
          starred: true,
          product: {
            store: 'Amazon',
            price: 18.99,
            currency: 'GBP',
            orderQty: 3,
            source: 'extracted',
          },
          order: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      stash_rules: [
        {
          id: 'rule-1',
          name: 'Amazon',
          enabled: true,
          priority: 1,
          match: { domainContains: 'amazon.co.uk' },
          action: { targetCollectionId: 'col-1', addTags: ['shop'] },
        },
      ],
      stash_settings: {
        density: 'micro',
        defaultCurrency: 'GBP',
      },
      stash_custom_themes: [],
    };

    const bundle = buildPanicExportBundleFromRaw(
      raw,
      '2026-11-25T12:00:00.000Z',
    );
    const validation = validateExportBundle(bundle);

    expect(validation.ok).toBe(true);
    expect(bundle.app).toBe('stash');
    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.spaces).toHaveLength(2);
    expect(bundle.collections).toHaveLength(1);
    expect(bundle.links).toHaveLength(1);
    expect(bundle.links[0]?.product?.orderQty).toBe(3);
    expect(bundle.settings.density).toBe('micro');
  });

  it('salvages valid items and seeds Main space when raw storage is partially corrupted or legacy', () => {
    const corrupted: Record<string, unknown> = {
      stash_spaces: 'not-an-array',
      stash_collections: [
        null,
        { bad: true },
        {
          id: 'col-legacy',
          name: 'Legacy Bookmarks',
          order: 0,
          isSession: false,
          collapsed: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      stash_links: [
        { id: 'broken-no-url', title: 'Missing URL' },
        {
          id: 'link-good',
          collectionId: 'col-legacy',
          url: 'https://example.com/docs',
          title: 'Docs',
          tags: [],
          order: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      stash_settings: 12345,
    };

    const bundle = buildPanicExportBundleFromRaw(corrupted);
    expect(validateExportBundle(bundle).ok).toBe(true);
    expect(bundle.spaces).toHaveLength(1);
    expect(bundle.spaces?.[0]?.id).toBe(DEFAULT_SPACE_ID);
    expect(bundle.collections).toHaveLength(1);
    expect(bundle.collections[0]?.spaceId).toBe(DEFAULT_SPACE_ID);
    expect(bundle.links).toHaveLength(1);
    expect(bundle.links[0]?.id).toBe('link-good');
  });

  it('reads live WXT chrome.storage.local keys directly via readRawStashStorage', async () => {
    const col = await stashRepo.createCollection({ name: 'Workbench' });
    await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://github.com/wxt-dev/wxt',
      title: 'WXT Framework',
    });

    const raw = await readRawStashStorage();
    const bundle = buildPanicExportBundleFromRaw(raw);

    expect(validateExportBundle(bundle).ok).toBe(true);
    expect(bundle.collections.some((c) => c.id === col.id)).toBe(true);
    expect(
      bundle.links.some((l) => l.url === 'https://github.com/wxt-dev/wxt'),
    ).toBe(true);
  });
});
