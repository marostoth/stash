import type { ThemeDefinition } from '@/lib/types/stash';

const DEFAULT_SANS =
  "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const DEFAULT_MONO =
  "'JetBrains Mono', 'Cascadia Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const OSCILLOSCOPE_THEME: ThemeDefinition = {
  id: 'oscilloscope',
  name: 'Oscilloscope',
  isBuiltIn: true,
  mode: 'dark',
  colors: {
    canvas: '#0E1013',
    panel: '#15181D',
    card: '#1D2128',
    cardHover: '#242A33',
    border: 'rgba(255, 255, 255, 0.08)',
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
    sans: DEFAULT_SANS,
    mono: DEFAULT_MONO,
  },
};

export const CLEAN_DARK_THEME: ThemeDefinition = {
  id: 'clean-dark',
  name: 'Clean Dark',
  isBuiltIn: true,
  mode: 'dark',
  colors: {
    canvas: '#121316',
    panel: '#181A1F',
    card: '#22252C',
    cardHover: '#2A2E37',
    border: 'rgba(255, 255, 255, 0.09)',
    accent: '#5E9EFF',
    accentFg: '#071326',
    text: '#F2F4F8',
    textMuted: '#9BA3B0',
    danger: '#F87171',
  },
  radius: {
    card: '10px',
    control: '8px',
    pill: '9999px',
  },
  fonts: {
    sans: DEFAULT_SANS,
    mono: DEFAULT_MONO,
  },
};

export const CLEAN_LIGHT_THEME: ThemeDefinition = {
  id: 'clean-light',
  name: 'Clean Light',
  isBuiltIn: true,
  mode: 'light',
  colors: {
    canvas: '#F6F7F9',
    panel: '#ECEFF3',
    card: '#FFFFFF',
    cardHover: '#F8FAFC',
    border: 'rgba(15, 23, 42, 0.10)',
    accent: '#0F766E',
    accentFg: '#FFFFFF',
    text: '#111827',
    textMuted: '#64748B',
    danger: '#DC2626',
  },
  radius: {
    card: '10px',
    control: '8px',
    pill: '9999px',
  },
  fonts: {
    sans: DEFAULT_SANS,
    mono: DEFAULT_MONO,
  },
};

export const BUILT_IN_THEMES: readonly ThemeDefinition[] = [
  OSCILLOSCOPE_THEME,
  CLEAN_DARK_THEME,
  CLEAN_LIGHT_THEME,
] as const;

export const DEFAULT_THEME_ID = OSCILLOSCOPE_THEME.id;
