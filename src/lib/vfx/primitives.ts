import {
  ASH_DRAG_60FPS,
  clamp01,
  easeOutCubic,
  lerpNumber,
  lerpRgb,
  MOLTEN_AMBER_RGB,
  type ParticleKinematics,
  rgbToCss,
  SPARK_AIR_DRAG_60FPS,
  SPARK_GRAVITY_PX_S2,
  sampleSparkHeatColor,
  stepParticleKinematics,
  WHITE_HOT_RGB,
} from '@/lib/vfx/math';
import type {
  RgbColor,
  VfxEntity,
  VfxRect,
  VfxSpriteSet,
  VfxThemeContext,
} from '@/lib/vfx/types';

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Picks a point along one of the 4 perimeter edges + its outward normal. */
export function sampleRectPerimeter(rect: VfxRect): {
  x: number;
  y: number;
  nx: number;
  ny: number;
} {
  const perimeter = Math.max(1, 2 * (rect.width + rect.height));
  let d = Math.random() * perimeter;

  if (d < rect.width) {
    return { x: rect.x + d, y: rect.y, nx: randRange(-0.35, 0.35), ny: -1 };
  }
  d -= rect.width;
  if (d < rect.height) {
    return {
      x: rect.x + rect.width,
      y: rect.y + d,
      nx: 1,
      ny: randRange(-0.35, 0.35),
    };
  }
  d -= rect.height;
  if (d < rect.width) {
    return {
      x: rect.x + rect.width - d,
      y: rect.y + rect.height,
      nx: randRange(-0.35, 0.35),
      ny: 1,
    };
  }
  d -= rect.width;
  return {
    x: rect.x,
    y: rect.y + rect.height - d,
    nx: -1,
    ny: randRange(-0.35, 0.35),
  };
}

export function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const cr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + cr, y);
  ctx.lineTo(x + w - cr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + cr);
  ctx.lineTo(x + w, y + h - cr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - cr, y + h);
  ctx.lineTo(x + cr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - cr);
  ctx.lineTo(x, y + cr);
  ctx.quadraticCurveTo(x, y, x + cr, y);
  ctx.closePath();
}

export function createShockwaveRing(
  rect: VfxRect,
  theme: VfxThemeContext,
  options: {
    durationSec: number;
    maxExpandPx: number;
    inward?: boolean;
    coreWidth?: number;
  },
): VfxEntity {
  const baseRadius = rect.radius ?? 10;
  const ringAccent = lerpRgb(
    MOLTEN_AMBER_RGB,
    theme.accentRgb,
    theme.dropStyle === 'accent' ? 0.85 : 0.45,
  );
  const coreWidth = options.coreWidth ?? 1.5;

  return {
    layer: 'air',
    ageSec: 0,
    lifetimeSec: options.durationSec,
    update(dtSec: number) {
      this.ageSec += dtSec;
      return this.ageSec < this.lifetimeSec;
    },
    render(ctx: CanvasRenderingContext2D) {
      const t = clamp01(this.ageSec / this.lifetimeSec);
      const eased = easeOutCubic(t);
      const expand = options.inward
        ? lerpNumber(options.maxExpandPx, -8, eased)
        : lerpNumber(0, options.maxExpandPx, eased);

      const x = rect.x - expand;
      const y = rect.y - expand;
      const w = Math.max(4, rect.width + expand * 2);
      const h = Math.max(4, rect.height + expand * 2);
      const r = Math.max(2, baseRadius + expand * 0.45);
      const alpha = (1 - t) ** 1.65;
      const strokeColor = lerpRgb(
        WHITE_HOT_RGB,
        ringAccent,
        Math.min(1, t * 2),
      );

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      traceRoundedRect(ctx, x, y, w, h, r);
      ctx.strokeStyle = rgbToCss(ringAccent, alpha * 0.28);
      ctx.lineWidth = coreWidth + 3.5;
      ctx.stroke();

      traceRoundedRect(ctx, x, y, w, h, r);
      ctx.strokeStyle = rgbToCss(strokeColor, alpha * 0.92);
      ctx.lineWidth = coreWidth;
      ctx.stroke();

      ctx.restore();
    },
  };
}

export function createIncandescentSpark(
  x: number,
  y: number,
  vx: number,
  vy: number,
  theme: VfxThemeContext,
  options?: {
    lifetimeSec?: number;
    gravityY?: number;
    width?: number;
    stretch?: number;
  },
): VfxEntity {
  const kin: ParticleKinematics = {
    x,
    y,
    prevX: x - vx * 0.014,
    prevY: y - vy * 0.014,
    vx,
    vy,
    gravityY: options?.gravityY ?? SPARK_GRAVITY_PX_S2,
    drag60: SPARK_AIR_DRAG_60FPS,
  };
  const baseWidth = options?.width ?? randRange(1.4, 2.3);
  const stretch = options?.stretch ?? 1.65;

  return {
    layer: 'air',
    ageSec: 0,
    lifetimeSec: options?.lifetimeSec ?? randRange(0.28, 0.46),
    update(dtSec: number) {
      this.ageSec += dtSec;
      stepParticleKinematics(kin, dtSec);
      return this.ageSec < this.lifetimeSec;
    },
    render(ctx: CanvasRenderingContext2D, sprites: VfxSpriteSet) {
      const t = clamp01(this.ageSec / this.lifetimeSec);
      const alpha = t < 0.72 ? 1 : (1 - t) / 0.28;
      const color = sampleSparkHeatColor(t, theme.accentRgb, theme.dropStyle);

      const dx = kin.x - kin.prevX;
      const dy = kin.y - kin.prevY;
      const tailX = kin.x - dx * stretch;
      const tailY = kin.y - dy * stretch;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(kin.x, kin.y);
      ctx.strokeStyle = rgbToCss(color, alpha * 0.34);
      ctx.lineWidth = baseWidth * 3.1;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(kin.x, kin.y);
      ctx.strokeStyle = rgbToCss(t < 0.2 ? WHITE_HOT_RGB : color, alpha * 0.96);
      ctx.lineWidth = Math.max(0.8, baseWidth * (1 - t * 0.45));
      ctx.stroke();

      if (t < 0.38 && sprites.glowDot) {
        const dotSize = baseWidth * 4.5 * (1 - t);
        ctx.globalAlpha = alpha * 0.55;
        ctx.drawImage(
          sprites.glowDot,
          kin.x - dotSize / 2,
          kin.y - dotSize / 2,
          dotSize,
          dotSize,
        );
      }

      ctx.restore();
    },
  };
}

export function createAshPuff(
  x: number,
  y: number,
  vx: number,
  vy: number,
  options?: {
    lifetimeSec?: number;
    startSize?: number;
    endSize?: number;
    driftY?: number;
    peakAlpha?: number;
    tint?: RgbColor;
  },
): VfxEntity {
  const kin: ParticleKinematics = {
    x,
    y,
    prevX: x,
    prevY: y,
    vx,
    vy,
    gravityY: options?.driftY ?? -42,
    drag60: ASH_DRAG_60FPS,
  };
  const startSize = options?.startSize ?? randRange(26, 38);
  const endSize = options?.endSize ?? randRange(56, 78);
  const peakAlpha = options?.peakAlpha ?? randRange(0.36, 0.52);

  return {
    layer: 'air',
    ageSec: 0,
    lifetimeSec: options?.lifetimeSec ?? randRange(0.5, 0.65),
    update(dtSec: number) {
      this.ageSec += dtSec;
      stepParticleKinematics(kin, dtSec);
      return this.ageSec < this.lifetimeSec;
    },
    render(ctx: CanvasRenderingContext2D, sprites: VfxSpriteSet) {
      const t = clamp01(this.ageSec / this.lifetimeSec);
      const size = lerpNumber(startSize, endSize, easeOutCubic(t));
      const fadeIn = Math.min(1, t / 0.14);
      const fadeOut = (1 - t) ** 1.45;
      const alpha = peakAlpha * fadeIn * fadeOut;
      if (alpha <= 0.005) return;

      ctx.save();
      ctx.globalAlpha = alpha;
      if (sprites.ashPuff) {
        ctx.drawImage(
          sprites.ashPuff,
          kin.x - size / 2,
          kin.y - size / 2,
          size,
          size,
        );
      } else {
        ctx.fillStyle = rgbToCss(
          options?.tint ?? { r: 196, g: 192, b: 186 },
          alpha,
        );
        ctx.beginPath();
        ctx.arc(kin.x, kin.y, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
  };
}
