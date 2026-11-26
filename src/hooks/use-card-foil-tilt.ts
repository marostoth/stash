import { useMotionTemplate, useMotionValue, useSpring } from 'motion/react';
import type * as React from 'react';
import { useEffect } from 'react';
import { playHoverRiffle } from '@/lib/audio/foley';
import {
  computeFoilTilt,
  FOIL_MAX_TILT_DEGREES,
  FOIL_SPRING_CONFIG,
} from '@/lib/motion/presets';

const TACTILE_MICRO_TILT_DEGREES = 2.4;

/**
 * 3D micro-tilt + cursor-following specular sheen MotionValues with zero React
 * re-renders on pointer move. Arcade gets full 7deg foil tilt + accent glare;
 * Tactile gets a refined 2.4deg matte sheen when hover sheen is enabled.
 */
export function useCardFoilTilt(
  enabled: boolean,
  arcade: boolean,
  isDragging: boolean,
) {
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const glareOpacity = useMotionValue(0);

  const rotateX = useSpring(rawRotateX, FOIL_SPRING_CONFIG);
  const rotateY = useSpring(rawRotateY, FOIL_SPRING_CONFIG);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, color-mix(in srgb, ${
    arcade ? 'var(--stash-accent)' : 'var(--stash-text)'
  } ${arcade ? '22%' : '11%'}, transparent) 0%, color-mix(in srgb, ${
    arcade ? 'var(--stash-accent)' : 'var(--stash-text)'
  } ${arcade ? '7%' : '4%'}, transparent) 38%, transparent 68%)`;

  useEffect(() => {
    if (!enabled || isDragging) {
      rawRotateX.set(0);
      rawRotateY.set(0);
      glareOpacity.set(0);
    }
  }, [enabled, isDragging, rawRotateX, rawRotateY, glareOpacity]);

  const handlePointerEnter = () => {
    if (!enabled || isDragging) return;
    glareOpacity.set(1);
    if (arcade) {
      playHoverRiffle();
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || isDragging) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const maxDeg = arcade ? FOIL_MAX_TILT_DEGREES : TACTILE_MICRO_TILT_DEGREES;
    const tilt = computeFoilTilt(relX, relY, maxDeg);
    rawRotateX.set(tilt.rotateX);
    rawRotateY.set(tilt.rotateY);
    glareX.set(tilt.glareX);
    glareY.set(tilt.glareY);
  };

  const handlePointerLeave = () => {
    if (!enabled) return;
    rawRotateX.set(0);
    rawRotateY.set(0);
    glareOpacity.set(0);
  };

  return {
    rotateX,
    rotateY,
    glareOpacity,
    glareBackground,
    handlePointerEnter,
    handlePointerMove,
    handlePointerLeave,
  };
}
