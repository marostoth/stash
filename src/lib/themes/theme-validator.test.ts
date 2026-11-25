import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { stashRepo } from '@/lib/storage/repo';
import { OSCILLOSCOPE_THEME } from '@/lib/themes/built-in-themes';
import {
  normalizeImportedCustomTheme,
  serializeThemeForExport,
  validateThemeDefinition,
} from '@/lib/themes/theme-validator';

describe('theme-validator & custom theme storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('validates valid .stash-theme.json and rejects malformed or unsafe CSS tokens', () => {
    const exportedJson = serializeThemeForExport(OSCILLOSCOPE_THEME);
    const parsed: unknown = JSON.parse(exportedJson);
    const valid = validateThemeDefinition(parsed);
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.theme.id).toBe('oscilloscope-custom');
      expect(valid.theme.isBuiltIn).toBe(false);
    }

    // Invalid mode
    expect(
      validateThemeDefinition({ ...OSCILLOSCOPE_THEME, mode: 'neon' }).ok,
    ).toBe(false);

    // Missing color token
    expect(
      validateThemeDefinition({
        ...OSCILLOSCOPE_THEME,
        colors: { ...OSCILLOSCOPE_THEME.colors, accent: '' },
      }).ok,
    ).toBe(false);

    // CSS injection attempt
    expect(
      validateThemeDefinition({
        ...OSCILLOSCOPE_THEME,
        colors: {
          ...OSCILLOSCOPE_THEME.colors,
          accent: '#00ff00; background: url(https://evil.example)',
        },
      }).ok,
    ).toBe(false);
  });

  it('remaps built-in IDs safely and resets activeThemeId when active custom theme is deleted', async () => {
    const remapped = normalizeImportedCustomTheme(OSCILLOSCOPE_THEME);
    expect(remapped.id).toBe('oscilloscope-custom');
    expect(remapped.isBuiltIn).toBe(false);

    const saved = await stashRepo.saveCustomTheme({
      ...OSCILLOSCOPE_THEME,
      id: 'amber-crt',
      name: 'Amber CRT',
      isBuiltIn: false,
      colors: { ...OSCILLOSCOPE_THEME.colors, accent: '#F59E0B' },
    });
    await stashRepo.updateSettings({ activeThemeId: saved.id });

    expect((await stashRepo.getCustomThemes()).map((t) => t.id)).toEqual([
      'amber-crt',
    ]);
    expect((await stashRepo.getSettings()).activeThemeId).toBe('amber-crt');

    await stashRepo.deleteCustomTheme('amber-crt');
    expect(await stashRepo.getCustomThemes()).toEqual([]);
    expect((await stashRepo.getSettings()).activeThemeId).toBe('oscilloscope');
  });
});
