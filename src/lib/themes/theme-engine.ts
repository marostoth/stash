import {
  BUILT_IN_THEMES,
  OSCILLOSCOPE_THEME,
} from '@/lib/themes/built-in-themes';
import type { ThemeDefinition } from '@/lib/types/stash';

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

export function applyThemeToDocument(
  theme: ThemeDefinition,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.theme = theme.id;
  root.dataset.themeMode = theme.mode;
  root.style.colorScheme = theme.mode;

  const vars: Record<string, string> = {
    '--stash-canvas': theme.colors.canvas,
    '--stash-panel': theme.colors.panel,
    '--stash-card': theme.colors.card,
    '--stash-card-hover': theme.colors.cardHover,
    '--stash-border': theme.colors.border,
    '--stash-accent': theme.colors.accent,
    '--stash-accent-fg': theme.colors.accentFg,
    '--stash-text': theme.colors.text,
    '--stash-text-muted': theme.colors.textMuted,
    '--stash-danger': theme.colors.danger,
    '--stash-radius-card': theme.radius.card,
    '--stash-radius-control': theme.radius.control,
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
