import {
  BUILT_IN_THEMES,
  OSCILLOSCOPE_THEME,
} from '@/lib/themes/built-in-themes';
import { CARD_RADIUS_PRESETS } from '@/lib/themes/presets';
import type { BackdropOverride, ThemeDefinition } from '@/lib/types/stash';

export function getAllThemes(
  customThemes: readonly ThemeDefinition[] = [],
): ThemeDefinition[] {
  const byId = new Map<string, ThemeDefinition>();
  for (const theme of BUILT_IN_THEMES) {
    byId.set(theme.id, theme);
  }
  for (const theme of customThemes) {
    if (!byId.has(theme.id)) {
      byId.set(theme.id, theme);
    }
  }
  return Array.from(byId.values());
}

export function resolveTheme(
  themeId: string,
  customThemes: readonly ThemeDefinition[] = [],
): ThemeDefinition {
  const all = getAllThemes(customThemes);
  return all.find((theme) => theme.id === themeId) ?? OSCILLOSCOPE_THEME;
}

const THEME_TRANSITION_MS = 320;
let themeTransitionTimer: ReturnType<typeof setTimeout> | null = null;

function pulseThemeTransition(root: HTMLElement): void {
  if (typeof window === 'undefined' || root.dataset.motion === 'off') return;
  root.dataset.themeTransition = 'true';
  if (themeTransitionTimer) clearTimeout(themeTransitionTimer);
  themeTransitionTimer = setTimeout(() => {
    delete root.dataset.themeTransition;
    themeTransitionTimer = null;
  }, THEME_TRANSITION_MS);
}

export function applyThemeToDocument(
  theme: ThemeDefinition,
  root: HTMLElement = document.documentElement,
  backdropOverride: BackdropOverride = 'theme',
): void {
  const backdrop =
    backdropOverride !== 'theme'
      ? backdropOverride
      : (theme.backdropStyle ?? 'flat');
  const radiusSpec = theme.cardRadius
    ? CARD_RADIUS_PRESETS[theme.cardRadius]
    : null;

  const prevTheme = root.dataset.theme;
  const prevBackdrop = root.dataset.backdrop;
  if (
    prevTheme &&
    (prevTheme !== theme.id || (prevBackdrop && prevBackdrop !== backdrop))
  ) {
    pulseThemeTransition(root);
  }

  root.dataset.theme = theme.id;
  root.dataset.themeMode = theme.mode;
  root.dataset.backdrop = backdrop;
  root.style.colorScheme = theme.mode;

  const surface = theme.colors.card;
  const vars: Record<string, string> = {
    '--stash-canvas': theme.colors.canvas,
    '--stash-surface': surface,
    '--stash-panel':
      theme.colors.panel ||
      `color-mix(in srgb, ${surface} 52%, ${theme.colors.canvas})`,
    '--stash-card': surface,
    '--stash-card-hover':
      theme.colors.cardHover ||
      `color-mix(in srgb, ${surface} 90%, ${theme.colors.text})`,
    '--stash-border': theme.colors.border,
    '--stash-accent': theme.colors.accent,
    '--stash-accent-fg': theme.colors.accentFg,
    '--stash-text': theme.colors.text,
    '--stash-text-muted':
      theme.colors.textMuted ||
      `color-mix(in srgb, ${theme.colors.text} 58%, ${theme.colors.canvas})`,
    '--stash-danger': theme.colors.danger,
    '--stash-badge-bg': `color-mix(in srgb, ${theme.colors.accent} 14%, ${surface})`,
    '--stash-accent-border': `color-mix(in srgb, ${theme.colors.accent} 42%, ${theme.colors.border})`,
    '--stash-glow': `color-mix(in srgb, ${theme.colors.accent} 24%, transparent)`,
    '--stash-radius-card': radiusSpec?.card ?? theme.radius.card,
    '--stash-radius-control': radiusSpec?.control ?? theme.radius.control,
    '--stash-radius-pill': theme.radius.pill,
    '--stash-font-sans': theme.fonts.sans,
    '--stash-font-mono': theme.fonts.mono,
  };

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  if (typeof document !== 'undefined' && document.body) {
    document.body.style.backgroundColor = theme.colors.canvas;
    document.body.style.color = theme.colors.text;
  }
}
