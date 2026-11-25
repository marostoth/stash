import type { ThemeMode } from '@/lib/types/stash';

const HEX_6_RE = /^#([0-9a-fA-F]{6})$/;
const HEX_3_RE = /^#([0-9a-fA-F]{3})$/;

/**
 * Validates and normalizes a 3- or 6-digit hex color to uppercase `#RRGGBB`.
 * Returns null if the input is not a valid hex color.
 */
export function normalizeHexColor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const six = trimmed.match(HEX_6_RE);
  if (six?.[1]) {
    return `#${six[1].toUpperCase()}`;
  }
  const three = trimmed.match(HEX_3_RE);
  if (three?.[1]) {
    const [r, g, b] = three[1].toUpperCase().split('');
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

export function isValidHexColor(raw: unknown): boolean {
  return normalizeHexColor(raw) !== null;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  return [r, g, b];
}

function linearizeChannel(channel255: number): number {
  const srgb = channel255 / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/**
 * Computes WCAG 2.1 relative luminance in the range [0, 1].
 */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb;
  return (
    0.2126 * linearizeChannel(r) +
    0.7152 * linearizeChannel(g) +
    0.0722 * linearizeChannel(b)
  );
}

/**
 * Computes WCAG 2.1 contrast ratio in the range [1, 21].
 */
export function getContrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function inferThemeMode(canvasHex: string): ThemeMode {
  return relativeLuminance(canvasHex) > 0.35 ? 'light' : 'dark';
}

export function pickReadableForeground(backgroundHex: string): string {
  const darkInk = '#08120E';
  const lightInk = '#FFFFFF';
  return getContrastRatio(darkInk, backgroundHex) >=
    getContrastRatio(lightInk, backgroundHex)
    ? darkInk
    : lightInk;
}

export interface ThemeContrastReport {
  textOnSurface: number;
  textOnCanvas: number;
  minRatio: number;
  passesAA: boolean;
}

export const WCAG_AA_TEXT_RATIO = 4.5;

export function evaluateThemeContrast(colors: {
  canvas: string;
  surface: string;
  text: string;
}): ThemeContrastReport {
  const textOnSurface = getContrastRatio(colors.text, colors.surface);
  const textOnCanvas = getContrastRatio(colors.text, colors.canvas);
  const minRatio = Math.min(textOnSurface, textOnCanvas);
  return {
    textOnSurface,
    textOnCanvas,
    minRatio,
    passesAA: minRatio >= WCAG_AA_TEXT_RATIO,
  };
}
