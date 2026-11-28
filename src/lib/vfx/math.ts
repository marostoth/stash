import type { DropEffectStyle } from '@/lib/types/stash';
import type { RgbColor, VfxRect } from '@/lib/vfx/types';

export const MAX_VFX_ENTITIES = 200;
export const MAX_VFX_DPR = 1.5;
export const DRAG_MOTE_THROTTLE_MS = 80;
export const SPARK_GRAVITY_PX_S2 = 1000;
export const SPARK_AIR_DRAG_60FPS = 0.95;
export const ASH_DRAG_60FPS = 0.86;
export const VFX_OCCLUDER_PADDING_PX = 96;

export function rectsIntersect(a: VfxRect, b: VfxRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function isSameRect(a: VfxRect, b: VfxRect, tolerancePx = 2): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerancePx &&
    Math.abs(a.y - b.y) <= tolerancePx &&
    Math.abs(a.width - b.width) <= tolerancePx &&
    Math.abs(a.height - b.height) <= tolerancePx
  );
}

/**
 * Collects the dropped card's `origin` rect plus any candidate neighbor rects
 * whose bounds intersect `origin` padded by `paddingPx`. Deduplicates matching
 * rects so `evenodd` canvas clipping never punches the same card cutout twice.
 */
export function collectNearbyOccluderRects(
  origin: VfxRect,
  candidates: readonly VfxRect[],
  paddingPx = VFX_OCCLUDER_PADDING_PX,
): VfxRect[] {
  const result: VfxRect[] = [origin];
  const padded: VfxRect = {
    x: origin.x - paddingPx,
    y: origin.y - paddingPx,
    width: origin.width + paddingPx * 2,
    height: origin.height + paddingPx * 2,
  };

  for (const candidate of candidates) {
    if (candidate.width <= 0 || candidate.height <= 0) continue;
    if (!rectsIntersect(padded, candidate)) continue;
    if (result.some((existing) => isSameRect(existing, candidate))) continue;
    result.push(candidate);
  }

  return result;
}

export const WHITE_HOT_RGB: RgbColor = { r: 255, g: 255, b: 255 };
export const MOLTEN_AMBER_RGB: RgbColor = { r: 255, g: 158, b: 68 };
export const DARK_EMBER_RGB: RgbColor = { r: 158, g: 42, b: 14 };
export const CHAR_CINDER_RGB: RgbColor = { r: 64, g: 20, b: 10 };

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function easeOutCubic(t: number): number {
  const c = clamp01(t);
  return 1 - (1 - c) ** 3;
}

export function lerpNumber(a: number, b: number, t: number): number {
  const c = clamp01(t);
  return a + (b - a) * c;
}

export function lerpRgb(a: RgbColor, b: RgbColor, t: number): RgbColor {
  const c = clamp01(t);
  return {
    r: Math.round(a.r + (b.r - a.r) * c),
    g: Math.round(a.g + (b.g - a.g) * c),
    b: Math.round(a.b + (b.b - a.b) * c),
  };
}

export function rgbToCss(color: RgbColor, alpha = 1): string {
  const a = Number(clamp01(alpha).toFixed(3));
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${a})`;
}

/**
 * Parses hex (`#rgb` / `#rrggbb`) or `rgb()` / `rgba()` strings into RgbColor.
 */
export function parseCssColorToRgb(
  input: string | null | undefined,
  fallback: RgbColor = MOLTEN_AMBER_RGB,
): RgbColor {
  if (!input) return fallback;
  const trimmed = input.trim();

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = Number.parseInt((hex[0] ?? 'f').repeat(2), 16);
      const g = Number.parseInt((hex[1] ?? 'f').repeat(2), 16);
      const b = Number.parseInt((hex[2] ?? 'f').repeat(2), 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return { r, g, b };
      }
    } else if (hex.length >= 6) {
      const r = Number.parseInt(hex.slice(0, 2), 16);
      const g = Number.parseInt(hex.slice(2, 4), 16);
      const b = Number.parseInt(hex.slice(4, 6), 16);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return { r, g, b };
      }
    }
    return fallback;
  }

  const match = trimmed.match(
    /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i,
  );
  if (match) {
    const r = Math.max(0, Math.min(255, Math.round(Number(match[1]))));
    const g = Math.max(0, Math.min(255, Math.round(Number(match[2]))));
    const b = Math.max(0, Math.min(255, Math.round(Number(match[3]))));
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      return { r, g, b };
    }
  }

  return fallback;
}

/**
 * Cools an incandescent spark across its normalized lifetime `progress` [0..1]:
 * pure white (t=0) -> bright molten amber / theme accent (t=0.25) ->
 * dark ember cinder (t=0.8) -> deep char fade (t=1.0).
 */
export function sampleSparkHeatColor(
  progress: number,
  accentRgb: RgbColor,
  dropStyle: DropEffectStyle = 'dust',
): RgbColor {
  const t = clamp01(progress);
  const accentMix = dropStyle === 'accent' ? 0.72 : 0.34;
  const midColor = lerpRgb(MOLTEN_AMBER_RGB, accentRgb, accentMix);
  const emberColor = lerpRgb(
    DARK_EMBER_RGB,
    {
      r: Math.round(accentRgb.r * 0.42),
      g: Math.round(accentRgb.g * 0.35),
      b: Math.round(accentRgb.b * 0.32),
    },
    dropStyle === 'accent' ? 0.55 : 0.2,
  );

  if (t <= 0.25) {
    return lerpRgb(WHITE_HOT_RGB, midColor, t / 0.25);
  }
  if (t <= 0.8) {
    return lerpRgb(midColor, emberColor, (t - 0.25) / 0.55);
  }
  return lerpRgb(emberColor, CHAR_CINDER_RGB, (t - 0.8) / 0.2);
}

export interface ParticleKinematics {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  gravityY: number;
  drag60: number;
}

/**
 * Integrates one physics step with frame-rate-independent drag (`drag60 ** (dt * 60)`)
 * and vertical gravity while storing `(prevX, prevY)` for velocity-stretched strokes.
 */
export function stepParticleKinematics(
  state: ParticleKinematics,
  dtSec: number,
): void {
  const dt = Math.max(0, Math.min(0.05, dtSec));
  if (dt <= 0) return;

  state.prevX = state.x;
  state.prevY = state.y;

  const dragFactor = state.drag60 ** (dt * 60);
  state.vx *= dragFactor;
  state.vy = state.vy * dragFactor + state.gravityY * dt;

  state.x += state.vx * dt;
  state.y += state.vy * dt;
}

/**
 * Appends `incoming` entities onto `pool` while enforcing `maxCap` by recycling
 * the oldest entities first (keeping rapid drags locked at 60fps).
 */
export function appendEntitiesWithCap<T>(
  pool: T[],
  incoming: readonly T[],
  maxCap = MAX_VFX_ENTITIES,
): T[] {
  const safeCap = Math.max(1, Math.floor(maxCap));
  const combined =
    incoming.length >= safeCap
      ? incoming.slice(incoming.length - safeCap)
      : [...pool, ...incoming];
  if (combined.length > safeCap) {
    return combined.slice(combined.length - safeCap);
  }
  return combined;
}

export function domRectToVfxRect(
  rect: Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>,
  radius = 10,
): VfxRect {
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    radius,
  };
}
