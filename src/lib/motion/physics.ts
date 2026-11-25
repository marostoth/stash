export {
  ARCADE_DRAG_TILT_MAX_DEGREES,
  ARCADE_DRAG_TILT_VELOCITY_SCALE,
  ARCADE_HEADSHAKE_KEYFRAMES,
  ARCADE_HEADSHAKE_TRANSITION,
  ARCADE_SQUASH_KEYFRAMES,
  ARCADE_SQUASH_TRANSITION,
  ARCADE_TAG_POP_SPRING,
  ARCADE_TILT_SPRING_CONFIG,
  CASCADE_MAX_STAGGER_INDEX,
  CASCADE_STAGGER_STEP_SEC,
  COLLAPSE_SPRING,
  computeCascadeDelay,
  computeFoilTilt,
  FOIL_MAX_TILT_DEGREES,
  FOIL_PERSPECTIVE_PX,
  FOIL_SPRING_CONFIG,
  type FoilTiltResult,
  isArcadeMotion,
  isTactileMotion,
  MODAL_SPRING,
  resolveReducedMotionPolicy,
  TACTILE_SPRING,
  TAG_POP_SPRING,
  TILT_SPRING_CONFIG,
} from '@/lib/motion/presets';

export const MAX_DRAG_TILT_DEGREES = 12;
export const DRAG_TILT_VELOCITY_SCALE = 0.012;
export const DRAG_TILT_DEADZONE_DEGREES = 0.2;

/**
 * Maps horizontal pointer velocity (px/s) to a clamped card tilt angle in
 * degrees (default -12deg .. +12deg, or ±18deg in Arcade mode), with a tiny
 * deadzone around zero so stationary cards settle cleanly to 0deg.
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
