import { BUILT_IN_THEMES } from '@/lib/themes/built-in-themes';
import type {
  ThemeColors,
  ThemeDefinition,
  ThemeFonts,
  ThemeRadius,
} from '@/lib/types/stash';

const BUILT_IN_IDS = new Set(BUILT_IN_THEMES.map((t) => t.id));
const UNSAFE_CSS_PATTERN = /[;{}<>]|url\s*\(|expression\s*\(|@import/i;

const COLOR_KEYS: readonly (keyof ThemeColors)[] = [
  'canvas',
  'panel',
  'card',
  'cardHover',
  'border',
  'accent',
  'accentFg',
  'text',
  'textMuted',
  'danger',
];

const RADIUS_KEYS: readonly (keyof ThemeRadius)[] = ['card', 'control', 'pill'];
const FONT_KEYS: readonly (keyof ThemeFonts)[] = ['sans', 'mono'];

export type ThemeValidationResult =
  | { ok: true; theme: ThemeDefinition }
  | { ok: false; error: string };

function isSafeTokenString(value: unknown, maxLength = 180): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return false;
  return !UNSAFE_CSS_PATTERN.test(trimmed);
}

export function validateThemeDefinition(raw: unknown): ThemeValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Theme file must be a JSON object.' };
  }

  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  const mode = obj.mode;

  if (!id || id.length > 64 || !/^[a-zA-Z0-9._-]+$/.test(id)) {
    return {
      ok: false,
      error:
        'Theme "id" must be 1–64 characters using letters, numbers, hyphens, dots, or underscores.',
    };
  }
  if (!name || name.length > 64) {
    return { ok: false, error: 'Theme "name" must be a non-empty string.' };
  }
  if (mode !== 'dark' && mode !== 'light') {
    return { ok: false, error: 'Theme "mode" must be "dark" or "light".' };
  }

  if (!obj.colors || typeof obj.colors !== 'object') {
    return { ok: false, error: 'Theme is missing the "colors" object.' };
  }
  const rawColors = obj.colors as Record<string, unknown>;
  const colors = {} as ThemeColors;
  for (const key of COLOR_KEYS) {
    const val = rawColors[key];
    if (!isSafeTokenString(val, 64)) {
      return { ok: false, error: `Invalid or missing "colors.${key}" token.` };
    }
    colors[key] = val.trim();
  }

  if (!obj.radius || typeof obj.radius !== 'object') {
    return { ok: false, error: 'Theme is missing the "radius" object.' };
  }
  const rawRadius = obj.radius as Record<string, unknown>;
  const radius = {} as ThemeRadius;
  for (const key of RADIUS_KEYS) {
    const val = rawRadius[key];
    if (!isSafeTokenString(val, 32)) {
      return { ok: false, error: `Invalid or missing "radius.${key}" token.` };
    }
    radius[key] = val.trim();
  }

  if (!obj.fonts || typeof obj.fonts !== 'object') {
    return { ok: false, error: 'Theme is missing the "fonts" object.' };
  }
  const rawFonts = obj.fonts as Record<string, unknown>;
  const fonts = {} as ThemeFonts;
  for (const key of FONT_KEYS) {
    const val = rawFonts[key];
    if (!isSafeTokenString(val, 220)) {
      return { ok: false, error: `Invalid or missing "fonts.${key}" token.` };
    }
    fonts[key] = val.trim();
  }

  return {
    ok: true,
    theme: {
      id,
      name,
      isBuiltIn: false,
      mode,
      colors,
      radius,
      fonts,
    },
  };
}

/**
 * Ensures an imported theme never collides with a built-in theme ID.
 */
export function normalizeImportedCustomTheme(
  theme: ThemeDefinition,
): ThemeDefinition {
  if (!BUILT_IN_IDS.has(theme.id)) {
    return { ...theme, isBuiltIn: false };
  }
  return {
    ...theme,
    id: `${theme.id}-custom`,
    name: theme.name.toLowerCase().includes('custom')
      ? theme.name
      : `${theme.name} (Custom)`,
    isBuiltIn: false,
  };
}

export function serializeThemeForExport(theme: ThemeDefinition): string {
  const exportable: ThemeDefinition = theme.isBuiltIn
    ? {
        ...theme,
        id: `${theme.id}-custom`,
        name: `${theme.name} Custom`,
        isBuiltIn: false,
      }
    : { ...theme, isBuiltIn: false };

  return `${JSON.stringify(exportable, null, 2)}\n`;
}
