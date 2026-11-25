import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { LanguageModelAPI } from '@/lib/categorizer/types';
import { stashRepo } from '@/lib/storage/repo';
import {
  autoTagSingleLink,
  clampDeterministicParams,
  extractTopExistingTags,
  filterEligibleLinks,
  parseAutoTagResponse,
  runBatchAutoTagSweep,
  sanitizeGeneratedTags,
} from '@/lib/tagging/auto-tagger';
import { triggerAutoTagSingleLink } from '@/lib/tagging/trigger-auto-tag';
import type { LinkItem } from '@/lib/types/stash';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';
import { useUiStore } from '@/store/ui-store';

const globalWithLm = globalThis as { LanguageModel?: LanguageModelAPI };

const NOW = '2026-11-25T12:00:00.000Z';

function makeLink(overrides: Partial<LinkItem>): LinkItem {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    collectionId: overrides.collectionId ?? 'col-1',
    url: overrides.url ?? 'https://example.com',
    title: overrides.title ?? 'Example',
    note: '',
    tags: overrides.tags ?? [],
    tagsLocked: overrides.tagsLocked,
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

beforeEach(() => {
  fakeBrowser.reset();
});

afterEach(() => {
  delete globalWithLm.LanguageModel;
  vi.restoreAllMocks();
});

describe('auto-tagger pure helpers', () => {
  it('normalizes, deduplicates, caps at 3 tags, and strips exact collection name matches', () => {
    expect(
      sanitizeGeneratedTags(
        [
          '  #3D Printing ',
          '3dprinting',
          'Bambu Lab',
          '#bambu-lab',
          'STL',
          'FDM',
        ],
        '3D Printing',
      ),
    ).toEqual(['bambu-lab', 'stl', 'fdm']);

    expect(
      parseAutoTagResponse(
        '```json\n{"tags":["Dev","React","Hooks","Docs","Extra"]}\n```',
        'Dev',
      ),
    ).toEqual(['react', 'hooks', 'docs']);
  });

  it('extracts top existing tags sorted by usage frequency', () => {
    const links = [
      makeLink({ tags: ['react', 'docs'] }),
      makeLink({ tags: ['react', 'typescript'] }),
      makeLink({ tags: ['react', 'docs', 'vite'] }),
    ];

    expect(extractTopExistingTags(links, 3)).toEqual([
      'react',
      'docs',
      'typescript',
    ]);
  });

  it('filters only untagged, unlocked links and respects collection scope', () => {
    const links = [
      makeLink({ id: 'eligible-1', collectionId: 'c1', tags: [] }),
      makeLink({ id: 'already-tagged', collectionId: 'c1', tags: ['docs'] }),
      makeLink({
        id: 'manually-cleared-locked',
        collectionId: 'c1',
        tags: [],
        tagsLocked: true,
      }),
      makeLink({ id: 'eligible-2', collectionId: 'c2', tags: [] }),
    ];

    expect(filterEligibleLinks(links).map((l) => l.id)).toEqual([
      'eligible-1',
      'eligible-2',
    ]);
    expect(filterEligibleLinks(links, 'c1').map((l) => l.id)).toEqual([
      'eligible-1',
    ]);
  });

  it('clamps deterministic sampling params safely within LanguageModel.params() bounds', () => {
    expect(
      clampDeterministicParams({
        defaultTopK: 3,
        maxTopK: 8,
        defaultTemperature: 1,
        maxTemperature: 2,
      }),
    ).toEqual({ temperature: 0, topK: 1 });
    expect(clampDeterministicParams(undefined)).toEqual({
      temperature: 0,
      topK: 1,
    });
  });
});

describe('auto-tagger LanguageModel integration & tagsLocked protection', () => {
  it('gracefully no-ops when LanguageModel is unavailable without throwing', async () => {
    const col = await stashRepo.createCollection({ name: 'Dev' });
    const added = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://wxt.dev',
      title: 'WXT',
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    expect(await autoTagSingleLink(added.link.id)).toBeNull();

    const sweep = await runBatchAutoTagSweep();
    expect(sweep).toEqual({
      status: 'unavailable',
      tagged: 0,
      skipped: 0,
      total: 0,
    });
  });

  it('protects links with tagsLocked (manual edit/clear) from mid-flight or batch overwrites', async () => {
    const col = await stashRepo.createCollection({ name: 'Dev' });
    const added = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://react.dev',
      title: 'React Docs',
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const destroyMock = vi.fn();
    globalWithLm.LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      params: vi.fn().mockResolvedValue({
        defaultTopK: 3,
        maxTopK: 8,
        defaultTemperature: 1,
        maxTemperature: 2,
      }),
      create: vi.fn().mockResolvedValue({
        prompt: vi.fn().mockImplementation(async () => {
          // Simulate user clearing/locking tags mid-flight before Nano returns
          await stashRepo.updateLink(added.link.id, {
            tags: [],
            tagsLocked: true,
          });
          return JSON.stringify({ tags: ['react', 'docs'] });
        }),
        destroy: destroyMock,
      }),
    };

    const result = await autoTagSingleLink(added.link.id);
    expect(result).toBeNull();
    expect(destroyMock).toHaveBeenCalledTimes(1);

    const stored = (await stashRepo.getLinks()).find(
      (l) => l.id === added.link.id,
    );
    expect(stored?.tags).toEqual([]);
    expect(stored?.tagsLocked).toBe(true);
  });

  it('tags a single link on save when autoTagOnSave is enabled and respects setting when disabled', async () => {
    const col = await stashRepo.createCollection({ name: 'Dev' });
    const added = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://tailwindcss.com',
      title: 'Tailwind CSS',
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const destroyMock = vi.fn();
    const createMock = vi.fn().mockResolvedValue({
      prompt: vi
        .fn()
        .mockResolvedValue(JSON.stringify({ tags: ['Dev', 'CSS', 'Styling'] })),
      destroy: destroyMock,
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

    await stashRepo.updateSettings({ autoTagOnSave: false });
    expect(await autoTagSingleLink(added.link.id)).toBeNull();
    expect(createMock).not.toHaveBeenCalled();

    await stashRepo.updateSettings({ autoTagOnSave: true });
    const tags = await autoTagSingleLink(added.link.id);
    expect(tags).toEqual(['css', 'styling']);
    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0, topK: 1 }),
    );
  });

  it('uses one base session cloned per link in batch sweeps and cleans up on completion or cancel', async () => {
    const col = await stashRepo.createCollection({ name: 'Hardware' });
    const l1 = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://espressif.com',
      title: 'Espressif',
    });
    const l2 = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://digikey.com',
      title: 'DigiKey',
    });
    await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://locked.dev',
      title: 'Locked',
      tags: [],
      tagsLocked: true,
    });
    expect(l1.ok && l2.ok).toBe(true);

    const baseDestroy = vi.fn();
    const cloneDestroys: Array<ReturnType<typeof vi.fn>> = [];
    const cloneMock = vi.fn().mockImplementation(async () => {
      const cloneDestroy = vi.fn();
      cloneDestroys.push(cloneDestroy);
      return {
        prompt: vi
          .fn()
          .mockResolvedValue(
            JSON.stringify({ tags: ['esp32', 'electronics'] }),
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
      create: createMock,
    };

    const progressSteps: number[] = [];
    const sweep = await runBatchAutoTagSweep({
      collectionId: col.id,
      onProgress: (p) => progressSteps.push(p.current),
    });

    expect(sweep).toEqual({
      status: 'completed',
      tagged: 2,
      skipped: 0,
      total: 2,
    });
    expect(progressSteps).toEqual([1, 2]);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(cloneMock).toHaveBeenCalledTimes(2);
    expect(cloneDestroys).toHaveLength(2);
    for (const d of cloneDestroys) {
      expect(d).toHaveBeenCalledTimes(1);
    }
    expect(baseDestroy).toHaveBeenCalledTimes(1);
  });

  it('aborts hung autoTagSingleLink sessions on timeout and always invokes onLinkEnd cleanup', async () => {
    const col = await stashRepo.createCollection({ name: 'Reading' });
    const added = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://stalled.example',
      title: 'Stalled Article',
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const destroyMock = vi.fn();
    let capturedSignal: AbortSignal | undefined;

    globalWithLm.LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi
        .fn()
        .mockImplementation(async (opts?: { signal?: AbortSignal }) => {
          capturedSignal = opts?.signal;
          return {
            prompt: vi.fn().mockImplementation(
              () => new Promise<string>(() => {}), // Never resolves
            ),
            destroy: destroyMock,
          };
        }),
    };

    const onLinkStart = vi.fn();
    const onLinkEnd = vi.fn();

    const result = await autoTagSingleLink(added.link.id, {
      timeoutMs: 30,
      onLinkStart,
      onLinkEnd,
    });

    expect(result).toBeNull();
    expect(capturedSignal?.aborted).toBe(true);
    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(onLinkStart).toHaveBeenCalledWith(added.link.id);
    expect(onLinkEnd).toHaveBeenCalledWith(added.link.id, null);
  });

  it('skips triggerAutoTagSingleLink when another Nano background job is active and clears taggingLinkIds', async () => {
    useBackgroundJobsStore.getState().resetForTests();
    const col = await stashRepo.createCollection({ name: 'Dev' });
    const added = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://wxt.dev',
      title: 'WXT',
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const createMock = vi.fn();
    globalWithLm.LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: createMock,
    };

    useBackgroundJobsStore.getState().upsertJob({
      id: 'reorganize',
      title: 'Smart Reorganize',
      status: 'running',
      usesNano: true,
    });

    expect(await triggerAutoTagSingleLink(added.link.id)).toBeNull();
    expect(createMock).not.toHaveBeenCalled();
    expect(useUiStore.getState().taggingLinkIds).not.toContain(added.link.id);
    useBackgroundJobsStore.getState().resetForTests();
  });
});
