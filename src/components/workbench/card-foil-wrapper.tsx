import { motion } from 'motion/react';
import type * as React from 'react';
import { useCardFoilTilt } from '@/hooks/use-card-foil-tilt';
import { FOIL_PERSPECTIVE_PX } from '@/lib/motion/presets';

interface LinkCardMotionShellProps {
  hoverTiltActive: boolean;
  arcade: boolean;
  isDragging: boolean;
  initial: React.ComponentProps<typeof motion.div>['initial'];
  animate: React.ComponentProps<typeof motion.div>['animate'];
  whileHover: React.ComponentProps<typeof motion.div>['whileHover'];
  whileTap: React.ComponentProps<typeof motion.div>['whileTap'];
  transition: React.ComponentProps<typeof motion.div>['transition'];
  className: string;
  onCardPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onCardPointerLeave: () => void;
  children: React.ReactNode;
}

/**
 * Only mounts `useCardFoilTilt` MotionValues + springs when `hoverTiltActive`
 * is enabled, saving 7 reactive motion primitives per card across large boards
 * in `Reduced`/`Off` modes or when 3D hover sheen is toggled off.
 */
function FoilEnabledCardShell({
  arcade,
  isDragging,
  initial,
  animate,
  whileHover,
  whileTap,
  transition,
  className,
  onCardPointerMove,
  onCardPointerLeave,
  children,
}: Omit<LinkCardMotionShellProps, 'hoverTiltActive'>) {
  const foil = useCardFoilTilt(true, arcade, isDragging);

  return (
    <motion.div
      initial={initial}
      animate={animate}
      whileHover={whileHover}
      whileTap={whileTap}
      transition={transition}
      style={{
        transformPerspective: FOIL_PERSPECTIVE_PX,
        rotateX: foil.rotateX,
        rotateY: foil.rotateY,
      }}
      onPointerEnter={foil.handlePointerEnter}
      onPointerMove={(event) => {
        foil.handlePointerMove(event);
        onCardPointerMove(event);
      }}
      onPointerLeave={() => {
        foil.handlePointerLeave();
        onCardPointerLeave();
      }}
      className={className}
    >
      <motion.div
        aria-hidden="true"
        style={{
          backgroundImage: foil.glareBackground,
          opacity: foil.glareOpacity,
        }}
        className="pointer-events-none absolute inset-0 z-10 rounded-card transition-opacity duration-150"
      />
      {children}
    </motion.div>
  );
}

export function LinkCardMotionShell({
  hoverTiltActive,
  arcade,
  isDragging,
  initial,
  animate,
  whileHover,
  whileTap,
  transition,
  className,
  onCardPointerMove,
  onCardPointerLeave,
  children,
}: LinkCardMotionShellProps) {
  if (hoverTiltActive) {
    return (
      <FoilEnabledCardShell
        arcade={arcade}
        isDragging={isDragging}
        initial={initial}
        animate={animate}
        whileHover={whileHover}
        whileTap={whileTap}
        transition={transition}
        className={className}
        onCardPointerMove={onCardPointerMove}
        onCardPointerLeave={onCardPointerLeave}
      >
        {children}
      </FoilEnabledCardShell>
    );
  }

  return (
    <motion.div
      initial={initial}
      animate={animate}
      whileHover={whileHover}
      whileTap={whileTap}
      transition={transition}
      onPointerMove={onCardPointerMove}
      onPointerLeave={onCardPointerLeave}
      className={className}
    >
      {children}
    </motion.div>
  );
}
