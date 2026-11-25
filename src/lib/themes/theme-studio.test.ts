import { describe, expect, it } from 'vitest';
import {
  evaluateThemeContrast,
  getContrastRatio,
  normalizeHexColor,
  relativeLuminance,
} from '@/lib/themes/contrast';
import {
  AMBER_PHOSPHOR_THEME,
  MIDNIGHT_INDIGO_THEME,
  WARM_PAPER_THEME,
} from '@/lib/themes/presets';
import {
  encodeThemeShareCode,
  parseAndValidateThemeShareInput,
  THEME_SHARE_PREFIX,
} from '@/lib/themes/share';

describe('themes/contrast (WCAG 2.1)', () => {
  it('computes exact luminance and contrast ratios for black/white and detects low contrast < 4.5', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 6);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 6);
    expect(getContrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(getContrastRatio('#000000', '#000000')).toBeCloseTo(1, 5);
    expect(normalizeHexColor('#0f8')).toBe('#00FF88');
    expect(normalizeHexColor('not-a-color')).toBeNull();

    const highContrast = evaluateThemeContrast({
      canvas: '#0E1013',
      surface: '#1D2128',
      text: '#ECEFF4',
    });
    expect(highContrast.passesAA).toBe(true);
    expect(highContrast.minRatio).toBeGreaterThan(10);

    const lowContrast = evaluateThemeContrast({
      canvas: '#222222',
      surface: '#333333',
      text: '#666666',
    });
    expect(lowContrast.passesAA).toBe(false);
    expect(lowContrast.minRatio).toBeLessThan(4.5);
  });
});

describe('themes/share', () => {
  it('round-trips a theme via share code and assigns a fresh custom ID on import', () => {
    const code = encodeThemeShareCode(MIDNIGHT_INDIGO_THEME);
    expect(code.startsWith(THEME_SHARE_PREFIX)).toBe(true);

    let seq = 0;
    const imported1 = parseAndValidateThemeShareInput(code, () => `id${++seq}`);
    const imported2 = parseAndValidateThemeShareInput(code, () => `id${++seq}`);

    expect(imported1.ok).toBe(true);
    expect(imported2.ok).toBe(true);
    if (!imported1.ok || !imported2.ok) return;

    expect(imported1.theme.id).toBe('custom-id1');
    expect(imported2.theme.id).toBe('custom-id2');
    expect(imported1.theme.isBuiltIn).toBe(false);
    expect(imported1.theme.name).toBe('Midnight Indigo');
    expect(imported1.theme.colors.accent).toBe('#6366F1');
    expect(imported1.theme.cardRadius).toBe('rounded');
    expect(imported1.theme.backdropStyle).toBe('ambient-glow');
  });

  it('rejects invalid hex values, bad enums, empty names, and malformed payloads', () => {
    expect(parseAndValidateThemeShareInput('').ok).toBe(false);
    expect(
      parseAndValidateThemeShareInput('stash-theme:%%%invalid%%%').ok,
    ).toBe(false);

    // Invalid hex color
    expect(
      parseAndValidateThemeShareInput(
        JSON.stringify({
          v: 1,
          name: 'Bad Hex',
          colors: {
            canvas: '#0E1013',
            surface: '#1D2128',
            accent: 'rgb(0,255,0)',
            text: '#ECEFF4',
            border: '#262B34',
          },
          cardRadius: 'standard',
          backdropStyle: 'flat',
        }),
      ).ok,
    ).toBe(false);

    // Invalid backdropStyle enum
    expect(
      parseAndValidateThemeShareInput(
        JSON.stringify({
          v: 1,
          name: 'Bad Backdrop',
          colors: {
            canvas: '#0E1013',
            surface: '#1D2128',
            accent: '#00D68F',
            text: '#ECEFF4',
            border: '#262B34',
          },
          cardRadius: 'standard',
          backdropStyle: 'matrix-rain',
        }),
      ).ok,
    ).toBe(false);

    // Invalid cardRadius enum
    expect(
      parseAndValidateThemeShareInput(
        JSON.stringify({
          v: 1,
          name: 'Bad Radius',
          colors: {
            canvas: '#0E1013',
            surface: '#1D2128',
            accent: '#00D68F',
            text: '#ECEFF4',
            border: '#262B34',
          },
          cardRadius: 'pill',
          backdropStyle: 'flat',
        }),
      ).ok,
    ).toBe(false);

    // Confirm built-in new presets meet WCAG AA contrast
    for (const preset of [
      AMBER_PHOSPHOR_THEME,
      MIDNIGHT_INDIGO_THEME,
      WARM_PAPER_THEME,
    ]) {
      const report = evaluateThemeContrast({
        canvas: preset.colors.canvas,
        surface: preset.colors.card,
        text: preset.colors.text,
      });
      expect(report.passesAA).toBe(true);
    }
  });
});
