import type { MotionMode } from '@/lib/types/stash';

export const FOIL_MAX_TILT_DEGREES = 7;
export const FOIL_PERSPECTIVE_PX = 800;

export const ARCADE_DRAG_TILT_MAX_DEGREES = 18;
export const ARCADE_DRAG_TILT_VELOCITY_SCALE = 0.018;

export const CASCADE_STAGGER_STEP_SEC = 0.025;
export const CASCADE_MAX_STAGGER_INDEX = 12;

export function isArcadeMotion(mode: MotionMode): boolean {
  return mode === 'arcade';
}

export function isTactileMotion(mode: MotionMode): boolean {
  return mode === 'tactile' || mode === 'arcade';
}

export function resolveReducedMotionPolicy(
  mode: MotionMode,
): 'user' | 'always' {
  return isTactileMotion(mode) ? 'user' : 'always';
}

export interface FoilTiltResult {
  rotateX: number;
  rotateY: number;
  glareX: number;
  glareY: number;
}

/**
 * Converts normalized [0..1] pointer coordinates inside a card to clamped 3D
 * tilt angles (±7deg default) and glare percentage coordinates.
 */
export function computeFoilTilt(
  relX: number,
  relY: number,
  maxDegrees = FOIL_MAX_TILT_DEGREES,
): FoilTiltResult {
  const safeX = Number.isFinite(relX) ? Math.max(0, Math.min(1, relX)) : 0.5;
  const safeY = Number.isFinite(relY) ? Math.max(0, Math.min(1, relY)) : 0.5;

  const dx = (safeX - 0.5) * 2;
  const dy = (safeY - 0.5) * 2;

  const rotateY = Math.max(-maxDegrees, Math.min(maxDegrees, dx * maxDegrees));
  const rotateX = Math.max(-maxDegrees, Math.min(maxDegrees, -dy * maxDegrees));

  return {
    rotateX: Object.is(rotateX, -0) ? 0 : rotateX,
    rotateY: Object.is(rotateY, -0) ? 0 : rotateY,
    glareX: Math.round(safeX * 100),
    glareY: Math.round(safeY * 100),
  };
}

/**
 * Computes card-deal cascade delay in seconds (25ms per card, capped at index 12
 * so large collections finish dealing within ~300ms).
 */
export function computeCascadeDelay(
  index: number,
  stepSec = CASCADE_STAGGER_STEP_SEC,
  maxIndex = CASCADE_MAX_STAGGER_INDEX,
): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  const clampedIndex = Math.min(Math.floor(index), Math.max(0, maxIndex));
  return Number((clampedIndex * stepSec).toFixed(4));
}

export const TACTILE_SPRING = {
  type: 'spring' as const,
  stiffness: 450,
  damping: 28,
  mass: 0.7,
};

export const TILT_SPRING_CONFIG = {
  stiffness: 320,
  damping: 22,
  mass: 0.5,
};

export const ARCADE_TILT_SPRING_CONFIG = {
  stiffness: 260,
  damping: 14,
  mass: 0.7,
};

export const FOIL_SPRING_CONFIG = {
  stiffness: 340,
  damping: 24,
  mass: 0.5,
};

export const TAG_POP_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 24,
  mass: 0.6,
};

export const ARCADE_TAG_POP_SPRING = {
  type: 'spring' as const,
  stiffness: 580,
  damping: 16,
  mass: 0.65,
};

export const COLLAPSE_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

export const MODAL_SPRING = {
  type: 'spring' as const,
  stiffness: 480,
  damping: 32,
  mass: 0.75,
};

export const ARCADE_SQUASH_KEYFRAMES = {
  scale: [1.08, 0.952, 1.01, 1],
  y: [-7, 3, -0.8, 0],
};

export const ARCADE_SQUASH_TRANSITION = {
  duration: 0.37,
  times: [0, 0.22, 0.62, 1],
  ease: [0.22, 1, 0.36, 1] as const,
};

export const TACTILE_SETTLE_KEYFRAMES = {
  scale: [1.024, 0.99, 1],
  y: [-2.5, 0.6, 0],
};

export const TACTILE_SETTLE_TRANSITION = {
  duration: 0.26,
  times: [0, 0.42, 1],
  ease: 'easeOut' as const,
};

export const ARCADE_HEADSHAKE_KEYFRAMES = {
  x: [0, -8, 8, -5, 5, -2, 0],
};

export const ARCADE_HEADSHAKE_TRANSITION = {
  duration: 0.36,
  ease: 'easeInOut' as const,
};

export interface Point2D {
  x: number;
  y: number;
}

export interface NeighborJoltVector {
  dx: number;
  dy: number;
  delaySec: number;
}

/**
 * Computes a radial desk-jolt impulse pushing (direction = 1) or pulling via
 * vacuum implosion (direction = -1) a sibling card relative to an origin,
 * attenuated by distance. Returns null outside the radius or at the origin.
 */
export function computeNeighborJolt(
  impact: Point2D,
  neighbor: Point2D,
  maxDisplacementPx = 9,
  radiusPx = 580,
  direction: 1 | -1 = 1,
): NeighborJoltVector | null {
  const rawDx = neighbor.x - impact.x;
  const rawDy = neighbor.y - impact.y;
  const dist = Math.hypot(rawDx, rawDy);
  if (!Number.isFinite(dist) || dist < 12 || dist > radiusPx) {
    return null;
  }
  const falloff = (1 - dist / radiusPx) ** 1.35;
  const magnitude = Math.max(1.5, maxDisplacementPx * falloff);
  const dx = Number(((rawDx / dist) * magnitude * direction).toFixed(2));
  const dy = Number(((rawDy / dist) * magnitude * direction).toFixed(2));
  const delaySec = Number(
    Math.min(0.16, 0.025 + (dist / radiusPx) * 0.135).toFixed(3),
  );
  return { dx, dy, delaySec };
}

/**
 * Resolves directional slide sign (+1 moving right, -1 moving left, 0 same/unknown)
 * when switching between Spaces in the SpaceBar.
 */
export function computeSpaceSlideDirection(
  spaceIds: readonly string[],
  prevSpaceId: string,
  nextSpaceId: string,
): -1 | 0 | 1 {
  if (prevSpaceId === nextSpaceId) return 0;
  const prevIdx = spaceIds.indexOf(prevSpaceId);
  const nextIdx = spaceIds.indexOf(nextSpaceId);
  if (prevIdx < 0 || nextIdx < 0) return 0;
  return nextIdx > prevIdx ? 1 : -1;
}
