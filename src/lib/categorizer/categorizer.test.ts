import { afterEach, describe, expect, it, vi } from 'vitest';
import { categorizeLink } from '@/lib/categorizer/categorizer';
import {
  categorizeWithNano,
  checkNanoAvailability,
  createNanoCategorizerSession,
  findBestExistingCollectionMatch,
  parseNanoResponse,
} from '@/lib/categorizer/nano-engine';
import { evaluateTier1Rules } from '@/lib/categorizer/rules-engine';
import type { LanguageModelAPI } from '@/lib/categorizer/types';
import type { CategorizationRule, Collection } from '@/lib/types/stash';

const NOW = '2026-11-25T11:00:00.000Z';

const collections: Collection[] = [
  {
    id: 'col-dev',
    name: 'Dev',
    color: 'blue',
    order: 0,
    collapsed: false,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'col-hw',
    name: 'Hardware',
    color: 'green',
    order: 1,
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

describe('Tier 1 rules engine', () => {
  it('evaluates rules in ascending priority order and ignores disabled rules', () => {
    const rules: CategorizationRule[] = [
      {
        id: 'r-low-priority',
        name: 'GitHub General',
        enabled: true,
        priority: 10,
        match: { domainContains: ['github.com'] },
        action: { targetCollectionId: 'col-dev', addTags: ['Code', '#GitHub'] },
      },
      {
        id: 'r-disabled',
        name: 'Disabled Top Rule',
        enabled: false,
        priority: 1,
        match: { domainContains: ['github.com'] },
        action: { targetCollectionId: 'col-hw', addTags: ['disabled'] },
      },
      {
        id: 'r-esp32',
        name: 'ESP32 Projects',
        enabled: true,
        priority: 2,
        match: { titleKeywords: ['esp32'] },
        action: { targetCollectionId: 'col-hw', addTags: ['ESP32', 'iot'] },
      },
    ];

    const validIds = new Set(collections.map((c) => c.id));

    // Both ESP32 (priority 2) and GitHub General (priority 10) match -> priority 2 wins
    const espMatch = evaluateTier1Rules(
      {
        url: 'https://github.com/espressif/arduino-esp32',
        title: 'ESP32 Core',
      },
      rules,
      validIds,
    );
    expect(espMatch).toEqual({
      source: 'rule',
      collectionId: 'col-hw',
      tags: ['esp32', 'iot'],
      matchedRuleId: 'r-esp32',
      matchedRuleName: 'ESP32 Projects',
    });

    // Disabled rule (priority 1) skipped -> GitHub General (priority 10) matches
    const ghMatch = evaluateTier1Rules(
      { url: 'https://github.com/wxt-dev/wxt', title: 'WXT Framework' },
      rules,
      validIds,
    );
    expect(ghMatch?.collectionId).toBe('col-dev');
    expect(ghMatch?.tags).toEqual(['code', 'github']);
  });

  it('skips rules with empty criteria or deleted target collections', () => {
    const rules: CategorizationRule[] = [
      {
        id: 'r-empty',
        name: 'Empty',
        enabled: true,
        priority: 1,
        match: {},
        action: { targetCollectionId: 'col-dev' },
      },
      {
        id: 'r-stale',
        name: 'Stale',
        enabled: true,
        priority: 2,
        match: { urlContains: ['/docs/'] },
        action: { targetCollectionId: 'col-deleted' },
      },
    ];

    const validIds = new Set(collections.map((c) => c.id));
    expect(
      evaluateTier1Rules(
        { url: 'https://example.com/docs/intro', title: 'Intro' },
        rules,
        validIds,
      ),
    ).toBeNull();
  });
});

describe('Tier 2 LanguageModel adapter & 2-tier orchestrator', () => {
  it('degrades silently when LanguageModel is missing or unavailable', async () => {
    expect(await checkNanoAvailability()).toBe('unavailable');

    const res = await categorizeLink(
      { url: 'https://example.com', title: 'Example' },
      { rules: [], collections, enableOnDeviceAi: true },
    );
    expect(res).toEqual({ source: 'none', tags: [] });
  });

  it('does not auto-create session when status is downloadable', async () => {
    const createMock = vi.fn();
    globalWithLm.LanguageModel = {
      availability: vi.fn().mockResolvedValue('downloadable'),
      create: createMock,
    };

    const result = await categorizeWithNano(
      { url: 'https://example.com', title: 'Example' },
      collections,
    );
    expect(result).toBeNull();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('parses valid structured JSON and always calls session.destroy()', async () => {
    const destroyMock = vi.fn();
    const promptMock = vi.fn().mockResolvedValue(
      JSON.stringify({
        tags: ['React', 'Docs', 'UI', 'ExtraIgnored'],
        summaryNote: 'Official React documentation reference',
        idealCategory: 'Dev',
        matchesExisting: true,
        existingCollection: 'Dev',
      }),
    );

    globalWithLm.LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({
        prompt: promptMock,
        destroy: destroyMock,
      }),
    };

    const result = await categorizeLink(
      { url: 'https://react.dev', title: 'React Docs' },
      { rules: [], collections, enableOnDeviceAi: true },
    );

    expect(result).toEqual({
      source: 'nano',
      collectionId: 'col-dev',
      suggestedNewCollection: undefined,
      tags: ['react', 'docs', 'ui'],
      summaryNote: 'Official React documentation reference',
    });
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it('destroys session and falls back gracefully when LanguageModel.prompt throws', async () => {
    const destroyMock = vi.fn();
    globalWithLm.LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({
        prompt: vi.fn().mockRejectedValue(new Error('Model OOM')),
        destroy: destroyMock,
      }),
    };

    const result = await categorizeLink(
      { url: 'https://example.com', title: 'Example' },
      { rules: [], collections, enableOnDeviceAi: true },
    );

    expect(result).toEqual({ source: 'none', tags: [] });
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it('short-circuits on Tier 1 rule match without invoking LanguageModel', async () => {
    const createMock = vi.fn();
    globalWithLm.LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: createMock,
    };

    const rules: CategorizationRule[] = [
      {
        id: 'r1',
        name: 'GitHub',
        enabled: true,
        priority: 1,
        match: { domainContains: ['github.com'] },
        action: { targetCollectionId: 'col-dev', addTags: ['git'] },
      },
    ];

    const result = await categorizeLink(
      { url: 'https://github.com/wxt-dev/wxt', title: 'WXT' },
      { rules, collections, enableOnDeviceAi: true },
    );

    expect(result.source).toBe('rule');
    expect(result.collectionId).toBe('col-dev');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('handles Nano edge cases: new categories, case-insensitive names, duplicate new name, fences, and multi-word tags', () => {
    // 1. New category recommendation + markdown fences + multi-word tags
    const suggestedNew = parseNanoResponse(
      '```json\n{"tags":["3D Printing","#Bambu Lab","printer"],"summaryNote":"3D printer page","idealCategory":"3D Printing","matchesExisting":false,"existingCollection":""}\n```',
      collections,
    );
    expect(suggestedNew).toEqual({
      source: 'nano',
      collectionId: undefined,
      suggestedNewCollection: '3D Printing',
      tags: ['3d-printing', 'bambu-lab', 'printer'],
      summaryNote: '3D printer page',
    });

    // 2. Case-insensitive existing collection name maps cleanly to real UUID
    const matchedExisting = parseNanoResponse(
      JSON.stringify({
        tags: ['code'],
        summaryNote: 'Dev tool',
        idealCategory: 'Coding',
        matchesExisting: true,
        existingCollection: 'dev',
      }),
      collections,
    );
    expect(matchedExisting?.collectionId).toBe('col-dev');
    expect(matchedExisting?.suggestedNewCollection).toBeUndefined();

    // 3. Model sets matchesExisting false when idealCategory matches an existing collection -> maps to existing ID
    const duplicateNew = parseNanoResponse(
      JSON.stringify({
        tags: ['esp32'],
        summaryNote: 'Board spec',
        idealCategory: 'Hardware',
        matchesExisting: false,
        existingCollection: '',
      }),
      collections,
    );
    expect(duplicateNew?.collectionId).toBe('col-hw');
    expect(duplicateNew?.suggestedNewCollection).toBeUndefined();

    // 4. Model hallucinates an unknown existingCollection -> falls back to idealCategory
    const hallucinatedExisting = parseNanoResponse(
      JSON.stringify({
        tags: ['grammar', 'writing'],
        summaryNote: 'Writing assistant',
        idealCategory: 'Writing',
        matchesExisting: true,
        existingCollection: 'NonExistent',
      }),
      collections,
    );
    expect(hallucinatedExisting?.collectionId).toBeUndefined();
    expect(hallucinatedExisting?.suggestedNewCollection).toBe('Writing');
  });

  it('reconciles token-subset collection names without false-matching unrelated or ambiguous collections', () => {
    const richCollections: Collection[] = [
      {
        id: 'col-webdev',
        name: 'Web Dev',
        color: 'blue',
        order: 0,
        collapsed: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'col-finance',
        name: 'Finance & Trading',
        color: 'green',
        order: 1,
        collapsed: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'col-maker',
        name: 'Hardware & 3D Printing',
        color: 'orange',
        order: 2,
        collapsed: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'col-ui-design',
        name: 'UI Design',
        color: 'pink',
        order: 3,
        collapsed: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: 'col-3d-design',
        name: '3D Design',
        color: 'purple',
        order: 4,
        collapsed: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ];

    expect(
      findBestExistingCollectionMatch('Trading', richCollections)?.id,
    ).toBe('col-finance');
    expect(findBestExistingCollectionMatch('Dev', richCollections)?.id).toBe(
      'col-webdev',
    );
    expect(
      findBestExistingCollectionMatch('3D Printing', richCollections)?.id,
    ).toBe('col-maker');

    // Unrelated candidate must NOT false-match
    expect(
      findBestExistingCollectionMatch('Cooking', richCollections),
    ).toBeUndefined();

    // Ambiguous tie ("Design" matches both "UI Design" and "3D Design") must NOT guess
    expect(
      findBestExistingCollectionMatch('Design', richCollections),
    ).toBeUndefined();

    // parseNanoResponse uses token-subset matching instead of proposing phantom duplicates
    const parsedTrading = parseNanoResponse(
      JSON.stringify({
        tags: ['futures'],
        summaryNote: 'Futures trading broker',
        idealCategory: 'Trading',
        matchesExisting: false,
        existingCollection: '',
      }),
      richCollections,
    );
    expect(parsedTrading?.collectionId).toBe('col-finance');
    expect(parsedTrading?.suggestedNewCollection).toBeUndefined();
  });

  it('leaves generic inbox/feed tabs unassigned when idealCategory is empty', () => {
    const generic = parseNanoResponse(
      JSON.stringify({
        tags: ['email', 'inbox'],
        summaryNote: 'Personal inbox',
        idealCategory: '',
        matchesExisting: false,
        existingCollection: '',
      }),
      collections,
    );
    expect(generic).toEqual({
      source: 'nano',
      collectionId: undefined,
      suggestedNewCollection: undefined,
      tags: ['email', 'inbox'],
      summaryNote: 'Personal inbox',
    });
  });

  it('clones ONE base session per link in batch categorization and destroys every clone and base session', async () => {
    const baseDestroy = vi.fn();
    const cloneDestroys: Array<ReturnType<typeof vi.fn>> = [];
    const cloneMock = vi.fn().mockImplementation(async () => {
      const cloneDestroy = vi.fn();
      cloneDestroys.push(cloneDestroy);
      return {
        prompt: vi.fn().mockResolvedValue(
          JSON.stringify({
            tags: ['react'],
            summaryNote: 'React docs',
            idealCategory: 'Dev',
            matchesExisting: true,
            existingCollection: 'Dev',
          }),
        ),
        destroy: cloneDestroy,
      };
    });

    const createMock = vi.fn().mockResolvedValue({
      prompt: vi.fn(),
      clone: cloneMock,
      destroy: baseDestroy,
    });

    globalWithLm.LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      params: vi.fn().mockResolvedValue({
        defaultTopK: 3,
        maxTopK: 8,
        defaultTemperature: 1,
        maxTemperature: 2,
      }),
      create: createMock,
    };

    const session = await createNanoCategorizerSession();
    expect(session).not.toBeNull();
    if (!session) return;

    try {
      const r1 = await categorizeLink(
        { url: 'https://react.dev', title: 'React' },
        {
          rules: [],
          collections,
          enableOnDeviceAi: true,
          nanoSession: session,
        },
      );
      const r2 = await categorizeLink(
        { url: 'https://vitejs.dev', title: 'Vite' },
        {
          rules: [],
          collections,
          enableOnDeviceAi: true,
          nanoSession: session,
        },
      );
      expect(r1.collectionId).toBe('col-dev');
      expect(r2.collectionId).toBe('col-dev');
    } finally {
      session.destroy();
    }

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0, topK: 1 }),
    );
    expect(cloneMock).toHaveBeenCalledTimes(2);
    expect(cloneDestroys).toHaveLength(2);
    for (const d of cloneDestroys) {
      expect(d).toHaveBeenCalledTimes(1);
    }
    expect(baseDestroy).toHaveBeenCalledTimes(1);
  });
});
