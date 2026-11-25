import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { validateExportBundle } from '@/lib/import-export/bundle';
import {
  CASCADE_MAX_STAGGER_INDEX,
  CASCADE_STAGGER_STEP_SEC,
  computeCascadeDelay,
  computeDragTilt,
  computeFoilTilt,
  FOIL_MAX_TILT_DEGREES,
  isArcadeMotion,
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

  it('maps motionMode cleanly to arcade, tactile, and reducedMotion policies', () => {
    expect(isArcadeMotion('arcade')).toBe(true);
    expect(isArcadeMotion('tactile')).toBe(false);

    expect(isTactileMotion('arcade')).toBe(true);
    expect(isTactileMotion('tactile')).toBe(true);
    expect(isTactileMotion('reduced')).toBe(false);
    expect(isTactileMotion('off')).toBe(false);

    expect(resolveReducedMotionPolicy('arcade')).toBe('user');
    expect(resolveReducedMotionPolicy('tactile')).toBe('user');
    expect(resolveReducedMotionPolicy('reduced')).toBe('always');
    expect(resolveReducedMotionPolicy('off')).toBe('always');
  });

  it('clamps 3D foil pointer-to-tilt math to ±7deg and caps cascade stagger at 12 cards', () => {
    expect(computeFoilTilt(0.5, 0.5)).toEqual({
      rotateX: 0,
      rotateY: 0,
      glareX: 50,
      glareY: 50,
    });

    // Top-right corner tilts smoothly to +7deg/+7deg
    expect(computeFoilTilt(1, 0)).toEqual({
      rotateX: FOIL_MAX_TILT_DEGREES,
      rotateY: FOIL_MAX_TILT_DEGREES,
      glareX: 100,
      glareY: 0,
    });

    // Out-of-bounds and NaN coordinates clamp cleanly
    expect(computeFoilTilt(-3, 5)).toEqual({
      rotateX: -FOIL_MAX_TILT_DEGREES,
      rotateY: -FOIL_MAX_TILT_DEGREES,
      glareX: 0,
      glareY: 100,
    });
    expect(computeFoilTilt(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      rotateX: 0,
      rotateY: 0,
      glareX: 50,
      glareY: 50,
    });

    // Cascade stagger: 25ms per card, capped at index 12 (300ms)
    expect(computeCascadeDelay(0)).toBe(0);
    expect(computeCascadeDelay(4)).toBeCloseTo(4 * CASCADE_STAGGER_STEP_SEC, 5);
    expect(computeCascadeDelay(12)).toBeCloseTo(
      CASCADE_MAX_STAGGER_INDEX * CASCADE_STAGGER_STEP_SEC,
      5,
    );
    expect(computeCascadeDelay(150)).toBeCloseTo(0.3, 5);
    expect(computeCascadeDelay(-5)).toBe(0);
  });

  it('persists and validates "arcade" motionMode across storage and export bundles', async () => {
    const saved = await stashRepo.updateSettings({ motionMode: 'arcade' });
    expect(saved.motionMode).toBe('arcade');
    expect((await stashRepo.getSettings()).motionMode).toBe('arcade');

    const validated = validateExportBundle({
      app: 'stash',
      schemaVersion: 1,
      exportedAt: '2026-11-25T12:20:00.000Z',
      collections: [],
      links: [],
      rules: [],
      settings: saved,
      customThemes: [],
    });
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.bundle.settings.motionMode).toBe('arcade');
    }
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
