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
  scaleX: [1, 1.05, 0.98, 1],
  scaleY: [1, 0.94, 1.02, 1],
};

export const ARCADE_SQUASH_TRANSITION = {
  duration: 0.24,
  ease: 'easeOut' as const,
};

export const ARCADE_HEADSHAKE_KEYFRAMES = {
  x: [0, -8, 8, -5, 5, -2, 0],
};

export const ARCADE_HEADSHAKE_TRANSITION = {
  duration: 0.36,
  ease: 'easeInOut' as const,
};
