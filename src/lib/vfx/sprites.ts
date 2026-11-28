import type { VfxSpriteSet } from '@/lib/vfx/types';

function createOffscreenCanvas(size: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

/**
 * Soft multi-stop radial ash puff stamp generated once offscreen.
 * Eliminates expensive per-frame `ctx.shadowBlur` / gradient creation.
 */
function buildAshPuffStamp(size = 96): HTMLCanvasElement | null {
  const canvas = createOffscreenCanvas(size);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 2, half, half, half);
  grad.addColorStop(0, 'rgba(214, 210, 204, 0.56)');
  grad.addColorStop(0.32, 'rgba(176, 172, 168, 0.34)');
  grad.addColorStop(0.68, 'rgba(128, 126, 124, 0.12)');
  grad.addColorStop(1, 'rgba(110, 108, 106, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Add 3 subtle offset lobes so puffs look organic rather than geometric circles
  const lobes = [
    { ox: -0.14, oy: -0.08, r: 0.34, a: 0.18 },
    { ox: 0.15, oy: 0.06, r: 0.32, a: 0.16 },
    { ox: 0.02, oy: -0.15, r: 0.28, a: 0.14 },
  ];
  for (const lobe of lobes) {
    const cx = half + lobe.ox * size;
    const cy = half + lobe.oy * size;
    const lr = lobe.r * size;
    const lGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, lr);
    lGrad.addColorStop(0, `rgba(222, 218, 212, ${lobe.a})`);
    lGrad.addColorStop(1, 'rgba(160, 156, 152, 0)');
    ctx.fillStyle = lGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, lr, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

/**
 * Additive radial glow dot stamp used with `globalCompositeOperation = 'lighter'`
 * for incandescent spark cores and flash peaks.
 */
function buildGlowDotStamp(size = 64): HTMLCanvasElement | null {
  const canvas = createOffscreenCanvas(size);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(0.22, 'rgba(255, 214, 150, 0.65)');
  grad.addColorStop(0.55, 'rgba(255, 146, 56, 0.22)');
  grad.addColorStop(1, 'rgba(255, 120, 32, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function createVfxSpriteSet(): VfxSpriteSet {
  return {
    ashPuff: buildAshPuffStamp(96),
    glowDot: buildGlowDotStamp(64),
  };
}
