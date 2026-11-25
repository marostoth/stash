import type { MotionMode } from '@/lib/types/stash';

export const MAX_DRAG_TILT_DEGREES = 12;
export const DRAG_TILT_VELOCITY_SCALE = 0.012;
export const DRAG_TILT_DEADZONE_DEGREES = 0.2;

/**
 * Maps horizontal pointer velocity (px/s) to a clamped card tilt angle in
 * degrees (default -12deg .. +12deg), with a tiny deadzone around zero so
 * stationary cards settle cleanly to 0deg.
 */
export function computeDragTilt(
  velocityPxPerSec: number,
  maxDegrees = MAX_DRAG_TILT_DEGREES,
  scale = DRAG_TILT_VELOCITY_SCALE,
): number {
  if (!Number.isFinite(velocityPxPerSec)) return 0;
  const raw = velocityPxPerSec * scale;
  if (Math.abs(raw) < DRAG_TILT_DEADZONE_DEGREES) return 0;
  return Math.max(-maxDegrees, Math.min(maxDegrees, raw));
}

export function isTactileMotion(mode: MotionMode): boolean {
  return mode === 'tactile';
}

export function resolveReducedMotionPolicy(
  mode: MotionMode,
): 'user' | 'always' {
  return mode === 'tactile' ? 'user' : 'always';
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

export const TAG_POP_SPRING = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 24,
  mass: 0.6,
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
