import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_THEMES,
  OSCILLOSCOPE_THEME,
} from '@/lib/themes/built-in-themes';
import { getAllThemes, resolveTheme } from '@/lib/themes/theme-engine';
import type { ThemeDefinition } from '@/lib/types/stash';

describe('theme-engine', () => {
  it('ships all six built-in themes with oscilloscope as default fallback', () => {
    expect(BUILT_IN_THEMES.map((t) => t.id)).toEqual([
      'oscilloscope',
      'clean-dark',
      'clean-light',
      'amber-phosphor',
      'midnight-indigo',
      'warm-paper',
    ]);
    expect(resolveTheme('non-existent-theme').id).toBe(OSCILLOSCOPE_THEME.id);
    expect(resolveTheme('clean-light').mode).toBe('light');
    expect(resolveTheme('warm-paper').mode).toBe('light');
    expect(resolveTheme('amber-phosphor').backdropStyle).toBe('dot-matrix');
    expect(resolveTheme('midnight-indigo').backdropStyle).toBe('ambient-glow');
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
      'oscilloscope',
      'clean-dark',
      'clean-light',
      'amber-phosphor',
      'midnight-indigo',
      'warm-paper',
      'amber-crt',
    ]);
    expect(resolveTheme('oscilloscope', [collision]).name).toBe('Oscilloscope');
    expect(resolveTheme('amber-crt', [custom]).name).toBe('Amber CRT');
  });
});
