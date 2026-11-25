import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { validateExportBundle } from '@/lib/import-export/bundle';
import {
  computeDragTilt,
  isTactileMotion,
  MAX_DRAG_TILT_DEGREES,
  resolveReducedMotionPolicy,
} from '@/lib/motion/physics';
import { settingsStorage } from '@/lib/storage/items';
import { stashRepo } from '@/lib/storage/repo';
import { DEFAULT_SETTINGS, type StashSettings } from '@/lib/types/stash';

describe('motion physics & settings backfill', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('clamps horizontal velocity smoothly to -12deg..+12deg with zero deadzone', () => {
    expect(computeDragTilt(0)).toBe(0);
    expect(computeDragTilt(5)).toBe(0);
    expect(computeDragTilt(-5)).toBe(0);

    expect(computeDragTilt(500)).toBeCloseTo(6, 5);
    expect(computeDragTilt(-500)).toBeCloseTo(-6, 5);

    expect(computeDragTilt(5000)).toBe(MAX_DRAG_TILT_DEGREES);
    expect(computeDragTilt(-5000)).toBe(-MAX_DRAG_TILT_DEGREES);

    expect(computeDragTilt(Number.NaN)).toBe(0);
    expect(computeDragTilt(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('maps motionMode cleanly to tactile and reducedMotion policies', () => {
    expect(isTactileMotion('tactile')).toBe(true);
    expect(isTactileMotion('reduced')).toBe(false);
    expect(isTactileMotion('off')).toBe(false);

    expect(resolveReducedMotionPolicy('tactile')).toBe('user');
    expect(resolveReducedMotionPolicy('reduced')).toBe('always');
    expect(resolveReducedMotionPolicy('off')).toBe('always');
  });

  it('backfills motionMode, soundEffects, and autoTagOnSave on legacy stored settings', async () => {
    const legacySettings = {
      activeThemeId: 'clean-dark',
      openLinkInNewTab: false,
      includePinnedInSessions: false,
      closeTabOnQuickStash: false,
      openTabsSidebarVisible: true,
      enableOnDeviceAi: true,
      density: 'compact',
    } as unknown as StashSettings;

    await settingsStorage.setValue(legacySettings);
    const loaded = await stashRepo.getSettings();

    expect(loaded.activeThemeId).toBe('clean-dark');
    expect(loaded.motionMode).toBe(DEFAULT_SETTINGS.motionMode);
    expect(loaded.soundEffects).toBe(DEFAULT_SETTINGS.soundEffects);
    expect(loaded.autoTagOnSave).toBe(DEFAULT_SETTINGS.autoTagOnSave);

    const validated = validateExportBundle({
      app: 'stash',
      schemaVersion: 1,
      exportedAt: '2026-11-25T12:00:00.000Z',
      collections: [],
      links: [],
      rules: [],
      settings: legacySettings,
      customThemes: [],
    });
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.bundle.settings.motionMode).toBe('tactile');
      expect(validated.bundle.settings.soundEffects).toBe(true);
      expect(validated.bundle.settings.autoTagOnSave).toBe(true);
    }
  });
});
