import { normalizeHexColor } from '@/lib/themes/contrast';
import {
  buildThemeFromCoreTokens,
  extractCoreThemeColors,
  inferCardRadiusPreset,
} from '@/lib/themes/presets';
import {
  normalizeImportedCustomTheme,
  validateThemeDefinition,
} from '@/lib/themes/theme-validator';
import type {
  BackdropStyle,
  CardRadiusPreset,
  CoreThemeColors,
  ThemeDefinition,
} from '@/lib/types/stash';

export const THEME_SHARE_PREFIX = 'stash-theme:';

const VALID_RADIUS_PRESETS = new Set<CardRadiusPreset>([
  'sharp',
  'standard',
  'rounded',
]);
const VALID_BACKDROP_STYLES = new Set<BackdropStyle>([
  'flat',
  'dot-matrix',
  'grid',
  'ambient-glow',
  'vignette',
  'mesh-glow',
  'noise-grain',
]);

export interface CompactThemeSharePayload {
  v: 1;
  name: string;
  colors: CoreThemeColors;
  cardRadius: CardRadiusPreset;
  backdropStyle: BackdropStyle;
}

export type ThemeShareImportResult =
  | { ok: true; theme: ThemeDefinition }
  | { ok: false; error: string };

export function toCompactSharePayload(
  theme: ThemeDefinition,
): CompactThemeSharePayload {
  return {
    v: 1,
    name: theme.name.trim().slice(0, 48) || 'Shared Theme',
    colors: extractCoreThemeColors(theme),
    cardRadius: theme.cardRadius ?? inferCardRadiusPreset(theme.radius.card),
    backdropStyle: theme.backdropStyle ?? 'flat',
  };
}

function encodeUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeUtf8Base64(encoded: string): string {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Serializes a theme into a compact copyable share code (`stash-theme:<base64>`).
 */
export function encodeThemeShareCode(theme: ThemeDefinition): string {
  const json = JSON.stringify(toCompactSharePayload(theme));
  return `${THEME_SHARE_PREFIX}${encodeUtf8Base64(json)}`;
}

function validateCompactPayload(
  obj: Record<string, unknown>,
  createId: () => string,
): ThemeShareImportResult {
  const rawName = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (!rawName || rawName.length > 48) {
    return {
      ok: false,
      error: 'Theme name must be between 1 and 48 characters.',
    };
  }

  if (
    !obj.colors ||
    typeof obj.colors !== 'object' ||
    Array.isArray(obj.colors)
  ) {
    return { ok: false, error: 'Theme code is missing a "colors" object.' };
  }
  const rawColors = obj.colors as Record<string, unknown>;
  const canvas = normalizeHexColor(rawColors.canvas);
  const surface = normalizeHexColor(rawColors.surface ?? rawColors.card);
  const accent = normalizeHexColor(rawColors.accent);
  const text = normalizeHexColor(rawColors.text);
  const border = normalizeHexColor(rawColors.border);

  if (!canvas || !surface || !accent || !text || !border) {
    return {
      ok: false,
      error:
        'All 5 theme colors (canvas, surface, accent, text, border) must be valid hex codes like #0E1013.',
    };
  }

  const cardRadius = obj.cardRadius;
  if (
    typeof cardRadius !== 'string' ||
    !VALID_RADIUS_PRESETS.has(cardRadius as CardRadiusPreset)
  ) {
    return {
      ok: false,
      error: 'Theme "cardRadius" must be "sharp", "standard", or "rounded".',
    };
  }

  const backdropStyle = obj.backdropStyle;
  if (
    typeof backdropStyle !== 'string' ||
    !VALID_BACKDROP_STYLES.has(backdropStyle as BackdropStyle)
  ) {
    return {
      ok: false,
      error:
        'Theme "backdropStyle" must be "flat", "dot-matrix", "grid", or "ambient-glow".',
    };
  }

  const theme = buildThemeFromCoreTokens({
    id: `custom-${createId()}`,
    name: rawName,
    isBuiltIn: false,
    core: { canvas, surface, accent, text, border },
    cardRadius: cardRadius as CardRadiusPreset,
    backdropStyle: backdropStyle as BackdropStyle,
  });

  return { ok: true, theme };
}

/**
 * Parses and strictly validates a pasted share code (`stash-theme:...`),
 * raw base64 JSON, compact theme JSON, or full `.stash-theme.json` object,
 * always assigning a fresh unique custom theme ID.
 */
export function parseAndValidateThemeShareInput(
  rawInput: string,
  createId: () => string = () => crypto.randomUUID().slice(0, 8),
): ThemeShareImportResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: 'Paste a theme share code or JSON first.' };
  }

  let jsonText = trimmed;
  if (trimmed.startsWith(THEME_SHARE_PREFIX)) {
    try {
      jsonText = decodeUtf8Base64(trimmed.slice(THEME_SHARE_PREFIX.length));
    } catch {
      return { ok: false, error: 'Invalid base64 theme share code.' };
    }
  } else if (!trimmed.startsWith('{')) {
    try {
      jsonText = decodeUtf8Base64(trimmed);
    } catch {
      return {
        ok: false,
        error: 'Input must be a stash-theme share code or valid JSON object.',
      };
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'Could not parse theme JSON.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Theme payload must be a JSON object.' };
  }

  const obj = parsed as Record<string, unknown>;

  // Compact v1 share payload (has v: 1 or cardRadius / backdropStyle)
  if (
    obj.v === 1 ||
    'cardRadius' in obj ||
    'backdropStyle' in obj ||
    (obj.colors &&
      typeof obj.colors === 'object' &&
      'surface' in (obj.colors as Record<string, unknown>))
  ) {
    return validateCompactPayload(obj, createId);
  }

  // Fallback: legacy full `.stash-theme.json` format
  const fullResult = validateThemeDefinition(obj);
  if (!fullResult.ok) {
    return fullResult;
  }

  const normalized = normalizeImportedCustomTheme({
    ...fullResult.theme,
    id: `custom-${createId()}`,
    cardRadius: inferCardRadiusPreset(fullResult.theme.radius.card),
    backdropStyle: 'flat',
  });
  return { ok: true, theme: normalized };
}
