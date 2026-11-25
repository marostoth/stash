import {
  inferThemeMode,
  normalizeHexColor,
  pickReadableForeground,
} from '@/lib/themes/contrast';
import type {
  BackdropStyle,
  CardRadiusPreset,
  CoreThemeColors,
  ThemeDefinition,
} from '@/lib/types/stash';

export const DEFAULT_THEME_SANS =
  "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
export const DEFAULT_THEME_MONO =
  "'JetBrains Mono', 'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const CARD_RADIUS_PRESETS: Record<
  CardRadiusPreset,
  { label: string; card: string; control: string }
> = {
  sharp: { label: 'Sharp', card: '2px', control: '2px' },
  standard: { label: 'Standard', card: '8px', control: '6px' },
  rounded: { label: 'Rounded', card: '14px', control: '10px' },
};

export const BACKDROP_STYLE_OPTIONS: ReadonlyArray<{
  id: BackdropStyle;
  label: string;
}> = [
  { id: 'flat', label: 'Flat' },
  { id: 'dot-matrix', label: 'Dot Matrix' },
  { id: 'grid', label: 'Subtle Grid' },
  { id: 'ambient-glow', label: 'Ambient Glow' },
  { id: 'vignette', label: 'Soft Vignette' },
  { id: 'mesh-glow', label: 'Mesh Glow' },
  { id: 'noise-grain', label: 'Fine Grain' },
];

export const VALID_BACKDROP_STYLE_SET = new Set<string>(
  BACKDROP_STYLE_OPTIONS.map((o) => o.id),
);

export function inferCardRadiusPreset(cardRadiusCss: string): CardRadiusPreset {
  const px = Number.parseFloat(cardRadiusCss);
  if (!Number.isFinite(px)) return 'standard';
  if (px <= 4) return 'sharp';
  if (px >= 12) return 'rounded';
  return 'standard';
}

export function extractCoreThemeColors(
  theme: ThemeDefinition,
): CoreThemeColors {
  const fallbackBorder = theme.mode === 'light' ? '#CBD5E1' : '#2A303B';
  return {
    canvas: normalizeHexColor(theme.colors.canvas) ?? '#0E1013',
    surface: normalizeHexColor(theme.colors.card) ?? '#1D2128',
    accent: normalizeHexColor(theme.colors.accent) ?? '#00D68F',
    text: normalizeHexColor(theme.colors.text) ?? '#ECEFF4',
    border: normalizeHexColor(theme.colors.border) ?? fallbackBorder,
  };
}

/**
 * Builds a complete ThemeDefinition from the 5 core editable hex colors,
 * deriving all secondary tokens coherently via CSS color-mix().
 */
export function buildThemeFromCoreTokens(input: {
  id: string;
  name: string;
  isBuiltIn: boolean;
  core: CoreThemeColors;
  cardRadius: CardRadiusPreset;
  backdropStyle: BackdropStyle;
}): ThemeDefinition {
  const canvas = normalizeHexColor(input.core.canvas) ?? '#0E1013';
  const surface = normalizeHexColor(input.core.surface) ?? '#1D2128';
  const accent = normalizeHexColor(input.core.accent) ?? '#00D68F';
  const text = normalizeHexColor(input.core.text) ?? '#ECEFF4';
  const mode = inferThemeMode(canvas);
  const border =
    normalizeHexColor(input.core.border) ??
    (mode === 'light' ? '#CBD5E1' : '#2A303B');

  const radiusSpec = CARD_RADIUS_PRESETS[input.cardRadius];
  const panel = `color-mix(in srgb, ${surface} 52%, ${canvas})`;
  const cardHover =
    mode === 'light'
      ? `color-mix(in srgb, ${surface} 92%, ${text})`
      : `color-mix(in srgb, ${surface} 88%, ${text})`;
  const textMuted = `color-mix(in srgb, ${text} 58%, ${canvas})`;

  return {
    id: input.id,
    name: input.name.trim() || 'Custom Theme',
    isBuiltIn: input.isBuiltIn,
    mode,
    cardRadius: input.cardRadius,
    backdropStyle: input.backdropStyle,
    colors: {
      canvas,
      panel,
      card: surface,
      cardHover,
      border,
      accent,
      accentFg: pickReadableForeground(accent),
      text,
      textMuted,
      danger: mode === 'light' ? '#DC2626' : '#F87171',
    },
    radius: {
      card: radiusSpec.card,
      control: radiusSpec.control,
      pill: '9999px',
    },
    fonts: {
      sans: DEFAULT_THEME_SANS,
      mono: DEFAULT_THEME_MONO,
    },
  };
}

export const OSCILLOSCOPE_THEME: ThemeDefinition = {
  id: 'oscilloscope',
  name: 'Oscilloscope',
  isBuiltIn: true,
  mode: 'dark',
  cardRadius: 'standard',
  backdropStyle: 'ambient-glow',
  colors: {
    canvas: '#0E1013',
    panel: '#15181D',
    card: '#1D2128',
    cardHover: '#242A33',
    border: '#262B34',
    accent: '#00D68F',
    accentFg: '#06150F',
    text: '#ECEFF4',
    textMuted: '#8B949E',
    danger: '#F87171',
  },
  radius: {
    card: '6px',
    control: '6px',
    pill: '9999px',
  },
  fonts: {
    sans: DEFAULT_THEME_SANS,
    mono: DEFAULT_THEME_MONO,
  },
};

export const CLEAN_DARK_THEME: ThemeDefinition = {
  id: 'clean-dark',
  name: 'Clean Dark',
  isBuiltIn: true,
  mode: 'dark',
  cardRadius: 'standard',
  backdropStyle: 'flat',
  colors: {
    canvas: '#121316',
    panel: '#181A1F',
    card: '#22252C',
    cardHover: '#2A2E37',
    border: '#2E323C',
    accent: '#5E9EFF',
    accentFg: '#071326',
    text: '#F2F4F8',
    textMuted: '#9BA3B0',
    danger: '#F87171',
  },
  radius: {
    card: '8px',
    control: '6px',
    pill: '9999px',
  },
  fonts: {
    sans: DEFAULT_THEME_SANS,
    mono: DEFAULT_THEME_MONO,
  },
};

export const CLEAN_LIGHT_THEME: ThemeDefinition = {
  id: 'clean-light',
  name: 'Clean Light',
  isBuiltIn: true,
  mode: 'light',
  cardRadius: 'standard',
  backdropStyle: 'flat',
  colors: {
    canvas: '#F6F7F9',
    panel: '#ECEFF3',
    card: '#FFFFFF',
    cardHover: '#F8FAFC',
    border: '#DCE2EA',
    accent: '#0F766E',
    accentFg: '#FFFFFF',
    text: '#111827',
    textMuted: '#64748B',
    danger: '#DC2626',
  },
  radius: {
    card: '8px',
    control: '6px',
    pill: '9999px',
  },
  fonts: {
    sans: DEFAULT_THEME_SANS,
    mono: DEFAULT_THEME_MONO,
  },
};

export const AMBER_PHOSPHOR_THEME: ThemeDefinition = buildThemeFromCoreTokens({
  id: 'amber-phosphor',
  name: 'Amber Phosphor',
  isBuiltIn: true,
  core: {
    canvas: '#12100E',
    surface: '#1F1B17',
    accent: '#F59E0B',
    text: '#F6ECDC',
    border: '#382F26',
  },
  cardRadius: 'sharp',
  backdropStyle: 'dot-matrix',
});

export const MIDNIGHT_INDIGO_THEME: ThemeDefinition = buildThemeFromCoreTokens({
  id: 'midnight-indigo',
  name: 'Midnight Indigo',
  isBuiltIn: true,
  core: {
    canvas: '#0B1020',
    surface: '#151C33',
    accent: '#6366F1',
    text: '#EEF2FF',
    border: '#29345A',
  },
  cardRadius: 'rounded',
  backdropStyle: 'ambient-glow',
});

export const WARM_PAPER_THEME: ThemeDefinition = buildThemeFromCoreTokens({
  id: 'warm-paper',
  name: 'Warm Paper',
  isBuiltIn: true,
  core: {
    canvas: '#F5EFE6',
    surface: '#FFFDF9',
    accent: '#C25934',
    text: '#2A221C',
    border: '#DDD1C2',
  },
  cardRadius: 'rounded',
  backdropStyle: 'flat',
});

export const BUILT_IN_THEMES: readonly ThemeDefinition[] = [
  OSCILLOSCOPE_THEME,
  CLEAN_DARK_THEME,
  CLEAN_LIGHT_THEME,
  AMBER_PHOSPHOR_THEME,
  MIDNIGHT_INDIGO_THEME,
  WARM_PAPER_THEME,
] as const;

export const DEFAULT_THEME_ID = OSCILLOSCOPE_THEME.id;
