import { afterEach, describe, expect, it, vi } from 'vitest';
import { categorizeLink } from '@/lib/categorizer/categorizer';
import { matchFromLibraryMemory } from '@/lib/categorizer/library-matcher';
import type { LanguageModelAPI } from '@/lib/categorizer/types';
import type { Collection, LinkItem, Space } from '@/lib/types/stash';

const NOW = '2026-11-25T21:00:00.000Z';

const spaces: Space[] = [
  {
    id: 'space-main',
    name: 'Main',
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'space-shop',
    name: 'Shopping List',
    order: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

const collections: Collection[] = [
  {
    id: 'col-hw',
    name: 'Hardware & 3D Printing',
    spaceId: 'space-main',
    color: 'orange',
    order: 0,
    collapsed: false,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'col-autoglym',
    name: 'Autoglym',
    spaceId: 'space-shop',
    color: 'green',
    order: 1,
    collapsed: false,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'col-trading',
    name: 'Trading & Finance',
    spaceId: 'space-main',
    color: 'blue',
    order: 2,
    collapsed: false,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

const globalWithLm = globalThis as { LanguageModel?: LanguageModelAPI };

afterEach(() => {
  delete globalWithLm.LanguageModel;
  vi.restoreAllMocks();
});

describe('Tier 1.5 library-matcher', () => {
  it('matches a non-generic domain to the collection where its links already live', () => {
    const existingLinks: LinkItem[] = [
      {
        id: 'l1',
        collectionId: 'col-autoglym',
        url: 'https://www.autoglym.com/odour-eliminator',
        title: 'Odour Eliminator',
        note: '',
        tags: [],
        order: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'l2',
        collectionId: 'col-autoglym',
        url: 'https://www.autoglym.com/de-icer',
        title: 'De-Icer',
        note: '',
        tags: [],
        order: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];

    const match = matchFromLibraryMemory(
      {
        url: 'https://www.autoglym.com/vinyl-rubber-care',
        title: 'Vinyl & Rubber Care 500ml',
      },
      collections,
      existingLinks,
    );

    expect(match).toEqual({
      collectionId: 'col-autoglym',
      collectionName: 'Autoglym',
      reason: 'domain',
    });
  });

  it('does not lock generic multi-topic hosts like youtube.com or amazon.co.uk', () => {
    const existingLinks: LinkItem[] = [
      {
        id: 'l1',
        collectionId: 'col-trading',
        url: 'https://www.youtube.com/watch?v=abc',
        title: 'Order Flow Video',
        note: '',
        tags: [],
        order: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'l2',
        collectionId: 'col-hw',
        url: 'https://www.amazon.co.uk/dp/B001',
        title: 'Filament',
        note: '',
        tags: [],
        order: 1,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];

    expect(
      matchFromLibraryMemory(
        {
          url: 'https://www.youtube.com/watch?v=xyz',
          title: 'How to bake sourdough',
        },
        collections,
        existingLinks,
      ),
    ).toBeNull();

    expect(
      matchFromLibraryMemory(
        {
          url: 'https://www.amazon.co.uk/dp/B002',
          title: 'Coffee Beans 1kg',
        },
        collections,
        existingLinks,
      ),
    ).toBeNull();
  });

  it('matches collection name directly against store/domain even with zero existing links', () => {
    const match = matchFromLibraryMemory(
      {
        url: 'https://www.autoglym.com/vinyl-rubber-care',
        title: 'Autoglym | Vinyl & Rubber Care 500ml',
      },
      collections,
      [],
    );

    expect(match).toEqual({
      collectionId: 'col-autoglym',
      collectionName: 'Autoglym',
      reason: 'name',
    });
  });

  it('locks library collection while allowing Nano to enrich tags/note and sends Space context to Nano', async () => {
    const promptMock = vi.fn().mockResolvedValue(
      JSON.stringify({
        tags: ['car-care', 'vinyl', 'rubber'],
        summaryNote: 'Autoglym vinyl & rubber care product page',
        idealCategory: 'Hardware & 3D Printing',
        matchesExisting: true,
        existingCollection: 'Hardware & 3D Printing',
      }),
    );
    const destroyMock = vi.fn();

    globalWithLm.LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({
        prompt: promptMock,
        destroy: destroyMock,
      }),
    };

    const result = await categorizeLink(
      {
        url: 'https://www.autoglym.com/vinyl-rubber-care',
        title: 'Autoglym | Vinyl & Rubber Care 500ml',
      },
      {
        rules: [],
        collections,
        links: [],
        spaces,
        enableOnDeviceAi: true,
        enrichLibraryMatchWithNano: true,
      },
    );

    expect(result.source).toBe('library');
    expect(result.collectionId).toBe('col-autoglym');
    expect(result.tags).toEqual(['car-care', 'vinyl', 'rubber']);
    expect(result.summaryNote).toBe(
      'Autoglym vinyl & rubber care product page',
    );
    expect(destroyMock).toHaveBeenCalledTimes(1);

    const sentPayload = JSON.parse(promptMock.mock.calls[0]?.[0] as string) as {
      existingCollections: Array<{ name: string; space?: string }>;
    };
    expect(sentPayload.existingCollections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Autoglym', space: 'Shopping List' }),
        expect.objectContaining({
          name: 'Hardware & 3D Printing',
          space: 'Main',
        }),
      ]),
    );
  });
});
