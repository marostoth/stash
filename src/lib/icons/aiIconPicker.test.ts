import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  pickCollectionIcon,
  pickIconsForCollections,
} from '@/lib/icons/aiIconPicker';

const globalWithLm = globalThis as { LanguageModel?: unknown };

describe('icons/aiIconPicker', () => {
  afterEach(() => {
    delete globalWithLm.LanguageModel;
    vi.restoreAllMocks();
  });

  it('returns null / empty map silently when LanguageModel is unavailable', async () => {
    delete globalWithLm.LanguageModel;
    expect(await pickCollectionIcon('Dev Tools')).toBeNull();
    expect(
      await pickIconsForCollections([{ id: 'c1', title: 'Dev Tools' }]),
    ).toEqual({});

    globalWithLm.LanguageModel = {
      availability: vi.fn().mockResolvedValue('unavailable'),
      create: vi.fn(),
    };
    expect(await pickCollectionIcon('Dev Tools')).toBeNull();
    expect(
      await pickIconsForCollections([{ id: 'c1', title: 'Dev Tools' }]),
    ).toEqual({});
  });

  it('accepts whitelisted icons, rejects out-of-whitelist responses, and always destroys sessions', async () => {
    const destroy = vi.fn();
    const prompt = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ icon: 'terminal' }))
      .mockResolvedValueOnce(JSON.stringify({ icon: 'invented-unicorn-icon' }));

    globalWithLm.LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      params: vi.fn().mockResolvedValue({
        defaultTopK: 3,
        maxTopK: 8,
        defaultTemperature: 1,
        maxTemperature: 2,
      }),
      create: vi.fn().mockResolvedValue({ prompt, destroy }),
    };

    const valid = await pickCollectionIcon('CLI & Shells', ['Bash Guide']);
    expect(valid).toBe('terminal');
    expect(destroy).toHaveBeenCalledTimes(1);

    const rejected = await pickCollectionIcon('Weird Category');
    expect(rejected).toBeNull();
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  it('falls back gracefully if omitResponseConstraintInput is rejected', async () => {
    const destroy = vi.fn();
    const prompt = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Unsupported option'))
      .mockResolvedValueOnce(JSON.stringify({ icon: 'printer' }));

    globalWithLm.LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ prompt, destroy }),
    };

    const icon = await pickCollectionIcon('3D Printing');
    expect(icon).toBe('printer');
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('uses one base session cloned per collection and destroys every clone and base session', async () => {
    const baseDestroy = vi.fn();
    const cloneDestroys: Array<ReturnType<typeof vi.fn>> = [];
    const answers = [
      JSON.stringify({ icon: 'wallet' }),
      JSON.stringify({ icon: 'invalid-icon-key' }),
      JSON.stringify({ icon: 'book-open' }),
    ];
    let idx = 0;

    const clone = vi.fn().mockImplementation(async () => {
      const d = vi.fn();
      cloneDestroys.push(d);
      const reply = answers[idx++] ?? '{}';
      return {
        prompt: vi.fn().mockResolvedValue(reply),
        destroy: d,
      };
    });

    const create = vi.fn().mockResolvedValue({
      prompt: vi.fn(),
      clone,
      destroy: baseDestroy,
    });

    globalWithLm.LanguageModel = {
      availability: vi.fn().mockResolvedValue('available'),
      create,
    };

    const map = await pickIconsForCollections([
      { id: 'c1', title: 'Finance' },
      { id: 'c2', title: 'Unknown' },
      { id: 'c3', title: 'Reading' },
    ]);

    expect(create).toHaveBeenCalledTimes(1);
    expect(clone).toHaveBeenCalledTimes(3);
    expect(map).toEqual({ c1: 'wallet', c3: 'book-open' });
    for (const d of cloneDestroys) {
      expect(d).toHaveBeenCalledTimes(1);
    }
    expect(baseDestroy).toHaveBeenCalledTimes(1);
  });
});
