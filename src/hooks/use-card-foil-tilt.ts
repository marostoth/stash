import { useMotionTemplate, useMotionValue, useSpring } from 'motion/react';
import type * as React from 'react';
import { useEffect } from 'react';
import { playHoverRiffle } from '@/lib/audio/foley';
import { computeFoilTilt, FOIL_SPRING_CONFIG } from '@/lib/motion/presets';

/**
 * Arcade 3D foil tilt + specular glare MotionValues with zero React re-renders
 * on pointer move.
 */
export function useCardFoilTilt(arcade: boolean, isDragging: boolean) {
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const glareOpacity = useMotionValue(0);

  const rotateX = useSpring(rawRotateX, FOIL_SPRING_CONFIG);
  const rotateY = useSpring(rawRotateY, FOIL_SPRING_CONFIG);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, color-mix(in srgb, var(--stash-accent) 20%, transparent) 0%, color-mix(in srgb, var(--stash-accent) 6%, transparent) 38%, transparent 68%)`;

  useEffect(() => {
    if (!arcade || isDragging) {
      rawRotateX.set(0);
      rawRotateY.set(0);
      glareOpacity.set(0);
    }
  }, [arcade, isDragging, rawRotateX, rawRotateY, glareOpacity]);

  const handlePointerEnter = () => {
    if (!arcade) return;
    glareOpacity.set(1);
    playHoverRiffle();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!arcade) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const relX = (event.clientX - rect.left) / rect.width;
    const relY = (event.clientY - rect.top) / rect.height;
    const tilt = computeFoilTilt(relX, relY);
    rawRotateX.set(tilt.rotateX);
    rawRotateY.set(tilt.rotateY);
    glareX.set(tilt.glareX);
    glareY.set(tilt.glareY);
  };

  const handlePointerLeave = () => {
    if (!arcade) return;
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
