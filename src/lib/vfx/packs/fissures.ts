import { clamp01, easeOutCubic, lerpNumber, rgbToCss } from '@/lib/vfx/math';
import type { VfxEntity, VfxRect, VfxThemeContext } from '@/lib/vfx/types';

export interface FissureSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  distStart: number;
  distEnd: number;
}

export interface FissureBranch {
  segments: FissureSegment[];
  totalLength: number;
  isOffshoot: boolean;
  /** Distance along the parent crack where this offshoot attaches (0 for primary). */
  parentAttachDist: number;
  /** Primary cracks radiate outward from this anchor on `rect`'s perimeter. */
  originX: number;
  originY: number;
}

const DEG_TO_RAD = Math.PI / 180;
const PRIMARY_JITTER_RAD = 22 * DEG_TO_RAD;
const OFFSHOOT_MIN_ANGLE_RAD = 25 * DEG_TO_RAD;
const OFFSHOOT_MAX_ANGLE_RAD = 50 * DEG_TO_RAD;
const PROPAGATION_SEC = 0.06;
const FISSURE_LIFETIME_SEC = 0.65;

function randIn(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

interface PerimeterAnchor {
  x: number;
  y: number;
  angle: number;
}

function sampleEdgeAnchors(
  rect: VfxRect,
  count: number,
  rng: () => number,
): PerimeterAnchor[] {
  // Distribute primary cracks across all 4 sides (top, right, bottom, left)
  // radiating outward along the vector from the card center (authentic radial fracture).
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const anchors: PerimeterAnchor[] = [];
  for (let i = 0; i < count; i++) {
    const side = i % 4;
    const t = randIn(rng, 0.14, 0.86);
    let x: number;
    let y: number;
    if (side === 0) {
      x = rect.x + rect.width * t;
      y = rect.y;
    } else if (side === 1) {
      x = rect.x + rect.width;
      y = rect.y + rect.height * t;
    } else if (side === 2) {
      x = rect.x + rect.width * t;
      y = rect.y + rect.height;
    } else {
      x = rect.x;
      y = rect.y + rect.height * t;
    }
    const radialAngle = Math.atan2(y - centerY, x - centerX);
    anchors.push({
      x,
      y,
      angle: radialAngle + randIn(rng, -0.22, 0.22),
    });
  }
  return anchors;
}

function buildJaggedPolyline(
  startX: number,
  startY: number,
  baseAngle: number,
  targetLength: number,
  segmentCount: number,
  baseWidth: number,
  tipWidth: number,
  rng: () => number,
): FissureSegment[] {
  const segments: FissureSegment[] = [];
  let cx = startX;
  let cy = startY;
  let angle = baseAngle;
  let dist = 0;
  const rawWeights: number[] = [];
  let weightSum = 0;
  for (let s = 0; s < segmentCount; s++) {
    const w = randIn(rng, 0.82, 1.18);
    rawWeights.push(w);
    weightSum += w;
  }

  for (let s = 0; s < segmentCount; s++) {
    const segLen = ((rawWeights[s] ?? 1) / weightSum) * targetLength;
    if (s > 0) {
      // Controlled ±22deg jaggedness pulled gently back toward outward direction
      const jitter = randIn(rng, -PRIMARY_JITTER_RAD, PRIMARY_JITTER_RAD);
      angle = baseAngle + (angle - baseAngle) * 0.35 + jitter;
    }
    const nx = cx + Math.cos(angle) * segLen;
    const ny = cy + Math.sin(angle) * segLen;
    const frac = segmentCount <= 1 ? 1 : s / (segmentCount - 1);
    const width = Number(lerpNumber(baseWidth, tipWidth, frac).toFixed(3));
    const nextDist = dist + segLen;

    segments.push({
      x1: cx,
      y1: cy,
      x2: nx,
      y2: ny,
      width,
      distStart: dist,
      distEnd: nextDist,
    });
    cx = nx;
    cy = ny;
    dist = nextDist;
  }

  return segments;
}

/**
 * Pure procedural generator for `6–8` primary jagged fracture polylines radiating
 * outward `36–78px` around all 4 sides of `rect`, with ~60% spawning `1–2`
 * shorter hairline offshoots (`16–34px`, `25°–50°` angle) and monotonic width taper.
 */
export function generateFissureGeometry(
  rect: VfxRect,
  rng: () => number = Math.random,
): FissureBranch[] {
  const primaryCount = 6 + Math.floor(rng() * 3); // 6, 7, or 8
  const anchors = sampleEdgeAnchors(rect, primaryCount, rng);
  const branches: FissureBranch[] = [];

  for (const anchor of anchors) {
    const primaryLength = randIn(rng, 36, 78);
    const segCount = 4 + Math.floor(rng() * 3); // 4, 5, or 6
    const baseWidth = randIn(rng, 2.8, 3.2);
    const tipWidth = randIn(rng, 0.55, 0.7);

    const segments = buildJaggedPolyline(
      anchor.x,
      anchor.y,
      anchor.angle,
      primaryLength,
      segCount,
      baseWidth,
      tipWidth,
      rng,
    );
    const totalLength = segments[segments.length - 1]?.distEnd ?? primaryLength;

    branches.push({
      segments,
      totalLength,
      isOffshoot: false,
      parentAttachDist: 0,
      originX: anchor.x,
      originY: anchor.y,
    });

    // ~60% of primary cracks spawn 1–2 hairline offshoots
    if (rng() < 0.6 && segments.length >= 2) {
      const offshootCount = rng() < 0.45 ? 2 : 1;
      const firstSign = rng() < 0.5 ? 1 : -1;
      for (let k = 0; k < offshootCount; k++) {
        const attachSegIdx = Math.min(
          segments.length - 2,
          Math.max(0, Math.floor(rng() * (segments.length - 1))),
        );
        const parentSeg = segments[attachSegIdx];
        if (!parentSeg) continue;

        const parentAngle = Math.atan2(
          parentSeg.y2 - parentSeg.y1,
          parentSeg.x2 - parentSeg.x1,
        );
        const sideSign = k % 2 === 0 ? firstSign : -firstSign;
        const branchAngle =
          parentAngle +
          sideSign *
            randIn(rng, OFFSHOOT_MIN_ANGLE_RAD, OFFSHOOT_MAX_ANGLE_RAD);
        const offLength = randIn(rng, 16, 34);
        const offSegCount = 2 + Math.floor(rng() * 2); // 2 or 3
        const offBaseWidth = Math.max(
          0.85,
          Math.min(parentSeg.width * 0.72, 1.5),
        );
        const offSegments = buildJaggedPolyline(
          parentSeg.x2,
          parentSeg.y2,
          branchAngle,
          offLength,
          offSegCount,
          offBaseWidth,
          0.45,
          rng,
        );
        const offTotal =
          offSegments[offSegments.length - 1]?.distEnd ?? offLength;

        branches.push({
          segments: offSegments,
          totalLength: offTotal,
          isOffshoot: true,
          parentAttachDist: parentSeg.distEnd,
          originX: parentSeg.x2,
          originY: parentSeg.y2,
        });
      }
    }
  }

  return branches;
}

function strokeRevealedBranch(
  ctx: CanvasRenderingContext2D,
  branch: FissureBranch,
  revealedLength: number,
  widthTransform: (segWidth: number) => number,
  maxDistanceLimit?: number,
): void {
  const limit =
    maxDistanceLimit !== undefined
      ? Math.min(revealedLength, maxDistanceLimit)
      : revealedLength;
  if (limit <= 0.5) return;

  for (const seg of branch.segments) {
    if (seg.distStart >= limit) break;
    const frac =
      seg.distEnd <= limit
        ? 1
        : clamp01(
            (limit - seg.distStart) /
              Math.max(0.001, seg.distEnd - seg.distStart),
          );
    const endX = seg.x1 + (seg.x2 - seg.x1) * frac;
    const endY = seg.y1 + (seg.y2 - seg.y1) * frac;

    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(endX, endY);
    ctx.lineWidth = Math.max(0.4, widthTransform(seg.width));
    ctx.stroke();
  }
}

/**
 * Floor-layer branching ground fissures rendered cleanly outside `rect` via the
 * engine's rounded `evenodd` exclusion clip. Uses 3 Light- & Dark-mode-safe
 * `'source-over'` passes (zero `ctx.shadowBlur`):
 *  1. Dark charcoal trench (physical depth, fades t=0.45 -> 1.0)
 *  2. Theme `--stash-accent` seam (cools t=0.15 -> 0.70, + faint dark-mode bloom)
 *  3. White-hot 1px impact spine near the card perimeter (cools t=0 -> 0.22)
 */
export function createGroundFissureEntity(
  rect: VfxRect,
  theme: VfxThemeContext,
): VfxEntity {
  const branches = generateFissureGeometry(rect);
  const maxPrimaryLen = branches.reduce(
    (max, b) => (b.isOffshoot ? max : Math.max(max, b.totalLength)),
    64,
  );

  return {
    layer: 'floor',
    excludeRects: [rect],
    ageSec: 0,
    lifetimeSec: FISSURE_LIFETIME_SEC,
    update(dtSec: number) {
      this.ageSec += dtSec;
      return this.ageSec < this.lifetimeSec;
    },
    render(ctx: CanvasRenderingContext2D) {
      const t = clamp01(this.ageSec / this.lifetimeSec);
      const revealProgress = easeOutCubic(
        clamp01(this.ageSec / PROPAGATION_SEC),
      );
      const globalRevealDist = revealProgress * maxPrimaryLen;

      // Alpha curves for each cooling pass
      const trenchAlpha =
        t < 0.45 ? 0.86 : 0.86 * (1 - clamp01((t - 0.45) / 0.55)) ** 1.3;
      const seamAlpha =
        t < 0.15
          ? 0.94
          : t < 0.7
            ? 0.94 * (1 - clamp01((t - 0.15) / 0.55)) ** 1.25
            : 0;
      const spineAlpha = t < 0.22 ? 0.95 * (1 - clamp01(t / 0.22)) ** 1.4 : 0;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';

      // Pass 1: Dark trench groove (visible depth on both Dark and Light themes)
      if (trenchAlpha > 0.01) {
        ctx.strokeStyle = theme.isDark
          ? `rgba(5, 7, 10, ${trenchAlpha.toFixed(3)})`
          : `rgba(22, 24, 28, ${(trenchAlpha * 0.72).toFixed(3)})`;
        for (const branch of branches) {
          const revealed = branch.isOffshoot
            ? Math.max(0, globalRevealDist - branch.parentAttachDist)
            : globalRevealDist;
          strokeRevealedBranch(ctx, branch, revealed, (w) => w + 1.5);
        }
      }

      // Pass 2: Theme `--stash-accent` core seam in 'source-over' (crisp in Light & Dark)
      if (seamAlpha > 0.01) {
        if (theme.isDark) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = rgbToCss(theme.accentRgb, seamAlpha * 0.26);
          for (const branch of branches) {
            const revealed = branch.isOffshoot
              ? Math.max(0, globalRevealDist - branch.parentAttachDist)
              : globalRevealDist;
            strokeRevealedBranch(ctx, branch, revealed, (w) => w * 2.1);
          }
          ctx.restore();
        }

        ctx.strokeStyle = rgbToCss(theme.accentRgb, seamAlpha);
        for (const branch of branches) {
          const revealed = branch.isOffshoot
            ? Math.max(0, globalRevealDist - branch.parentAttachDist)
            : globalRevealDist;
          strokeRevealedBranch(ctx, branch, revealed, (w) => w * 0.75);
        }
      }

      // Pass 3: Razor-thin 1px white-hot impact spine near the card perimeter
      if (spineAlpha > 0.01) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${spineAlpha.toFixed(3)})`;
        for (const branch of branches) {
          if (branch.isOffshoot) continue;
          strokeRevealedBranch(
            ctx,
            branch,
            globalRevealDist,
            () => 1,
            branch.totalLength * 0.45,
          );
        }
      }

      ctx.restore();
    },
  };
}
