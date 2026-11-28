import { describe, expect, it, vi } from 'vitest';
import {
  BUILT_IN_THEMES,
  OSCILLOSCOPE_THEME,
} from '@/lib/themes/built-in-themes';
import { getContrastRatio } from '@/lib/themes/contrast';
import {
  applyThemeToDocument,
  getAllThemes,
  resolveTheme,
  resolveWarningColor,
  WARNING_COLOR_DARK,
  WARNING_COLOR_LIGHT,
} from '@/lib/themes/theme-engine';
import type { ThemeDefinition } from '@/lib/types/stash';

describe('theme-engine', () => {
  it('ships all twelve built-in themes with oscilloscope as default fallback and readable contrast', () => {
    expect(BUILT_IN_THEMES.map((t) => t.id)).toEqual([
      'oscilloscope',
      'clean-dark',
      'clean-light',
      'amber-phosphor',
      'midnight-indigo',
      'warm-paper',
      'nordic-frost',
      'catppuccin-mocha',
      'rose-pine',
      'tokyo-night',
      'gruvbox-warm',
      'sage-editorial',
    ]);
    expect(resolveTheme('non-existent-theme').id).toBe(OSCILLOSCOPE_THEME.id);
    expect(OSCILLOSCOPE_THEME.backdropStyle).toBe('ambient-glow');
    expect(resolveTheme('clean-light').mode).toBe('light');
    expect(resolveTheme('warm-paper').mode).toBe('light');
    expect(resolveTheme('sage-editorial').mode).toBe('light');
    expect(resolveTheme('amber-phosphor').backdropStyle).toBe('dot-matrix');
    expect(resolveTheme('nordic-frost').backdropStyle).toBe('vignette');
    expect(resolveTheme('catppuccin-mocha').backdropStyle).toBe('mesh-glow');
    expect(resolveTheme('gruvbox-warm').backdropStyle).toBe('noise-grain');

    for (const theme of BUILT_IN_THEMES) {
      expect(
        getContrastRatio(theme.colors.text, theme.colors.card),
      ).toBeGreaterThanOrEqual(7);
      expect(
        getContrastRatio(theme.colors.accentFg, theme.colors.accent),
      ).toBeGreaterThanOrEqual(4.4);
    }
  });

  it('applies theme default backdrop or honors an explicit backdrop override', () => {
    const props = new Map<string, string>();
    const fakeRoot = {
      dataset: {} as Record<string, string>,
      style: {
        colorScheme: '',
        setProperty: (key: string, value: string) => {
          props.set(key, value);
        },
      },
    } as unknown as HTMLElement;

    applyThemeToDocument(OSCILLOSCOPE_THEME, fakeRoot, 'theme');
    expect(fakeRoot.dataset.backdrop).toBe('ambient-glow');

    applyThemeToDocument(OSCILLOSCOPE_THEME, fakeRoot, 'mesh-glow');
    expect(fakeRoot.dataset.backdrop).toBe('mesh-glow');

    applyThemeToDocument(OSCILLOSCOPE_THEME, fakeRoot, 'flat');
    expect(fakeRoot.dataset.backdrop).toBe('flat');
  });

  it('merges custom themes without letting custom IDs override built-in themes', () => {
    const custom: ThemeDefinition = {
      ...OSCILLOSCOPE_THEME,
      id: 'amber-crt',
      name: 'Amber CRT',
      isBuiltIn: false,
    };
    const collision: ThemeDefinition = {
      ...OSCILLOSCOPE_THEME,
      id: 'oscilloscope',
      name: 'Hijacked',
      isBuiltIn: false,
    };

    const all = getAllThemes([custom, collision]);
    expect(all.map((t) => t.id)).toEqual([
      ...BUILT_IN_THEMES.map((t) => t.id),
      'amber-crt',
    ]);
    expect(resolveTheme('oscilloscope', [collision]).name).toBe('Oscilloscope');
    expect(resolveTheme('amber-crt', [custom]).name).toBe('Amber CRT');
  });

  it('derives mode-aware --stash-warning tokens and skips transition fade on cold-boot hydration', () => {
    expect(resolveWarningColor('light')).toBe(WARNING_COLOR_LIGHT);
    expect(resolveWarningColor('dark')).toBe(WARNING_COLOR_DARK);

    const lightTheme = resolveTheme('clean-light');
    expect(
      getContrastRatio(WARNING_COLOR_LIGHT, lightTheme.colors.card),
    ).toBeGreaterThanOrEqual(4.5);

    const props = new Map<string, string>();
    const fakeRoot = {
      dataset: {} as Record<string, string>,
      style: {
        colorScheme: '',
        setProperty: (key: string, value: string) => {
          props.set(key, value);
        },
      },
    } as unknown as HTMLElement;

    vi.stubGlobal('window', {});
    try {
      // Initial dark theme hydration
      applyThemeToDocument(OSCILLOSCOPE_THEME, fakeRoot, 'theme', {
        animate: false,
      });
      expect(props.get('--stash-warning')).toBe(WARNING_COLOR_DARK);
      expect(fakeRoot.dataset.themeTransition).toBeUndefined();

      // Hydrating to a stored light theme with animate: false must NOT pulse a cold-boot fade
      applyThemeToDocument(lightTheme, fakeRoot, 'theme', { animate: false });
      expect(props.get('--stash-warning')).toBe(WARNING_COLOR_LIGHT);
      expect(fakeRoot.dataset.themeTransition).toBeUndefined();

      // Interactive switch (default animate: true) arms the smooth transition flag
      applyThemeToDocument(OSCILLOSCOPE_THEME, fakeRoot, 'theme');
      expect(props.get('--stash-warning')).toBe(WARNING_COLOR_DARK);
      expect(fakeRoot.dataset.themeTransition).toBe('true');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
