import type { DropEffectStyle } from '@/lib/types/stash';

export interface VfxRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
}

export type VfxLayer = 'floor' | 'air';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface VfxThemeContext {
  accentRgb: RgbColor;
  textRgb: RgbColor;
  isDark: boolean;
  dropStyle: DropEffectStyle;
  dropDust: boolean;
  dropFissures: boolean;
}

export interface VfxSpriteSet {
  ashPuff: HTMLCanvasElement | null;
  glowDot: HTMLCanvasElement | null;
}

export interface VfxEntity {
  layer: VfxLayer;
  excludeRects?: VfxRect[];
  ageSec: number;
  lifetimeSec: number;
  /** Advances physics by `dtSec` and returns `true` while the entity remains alive. */
  update: (dtSec: number) => boolean;
  /** Draws the entity onto the 2D canvas (must never call `ctx.shadowBlur`). */
  render: (ctx: CanvasRenderingContext2D, sprites: VfxSpriteSet) => void;
}

export interface VfxPack {
  readonly id: string;
  spawnSlam: (rect: VfxRect, theme: VfxThemeContext) => VfxEntity[];
  spawnDelete: (rect: VfxRect, theme: VfxThemeContext) => VfxEntity[];
  spawnBulkPulse: (rect: VfxRect, theme: VfxThemeContext) => VfxEntity[];
  spawnDragMote: (x: number, y: number, theme: VfxThemeContext) => VfxEntity[];
}
