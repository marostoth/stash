import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { isTactileMotion, TACTILE_SPRING } from '@/lib/motion/presets';
import type { MotionMode } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface OdometerCounterProps {
  value: number;
  motionMode: MotionMode;
  className?: string;
}

export function OdometerCounter({
  value,
  motionMode,
  className,
}: OdometerCounterProps) {
  const prevValueRef = useRef(value);
  const direction = value >= prevValueRef.current ? 1 : -1;

  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  const formatted = String(value);

  if (!isTactileMotion(motionMode)) {
    return <span className={cn('tabular-nums', className)}>{formatted}</span>;
  }

  const chars = formatted.split('');

  return (
    <span
      className={cn(
        'inline-flex items-baseline overflow-hidden tabular-nums leading-none',
        className,
      )}
    >
      {chars.map((char, positionFromLeft) => {
        const placeKey = `place-${chars.length - positionFromLeft}`;
        return (
          <span
            key={placeKey}
            className="relative inline-flex h-[1.15em] w-[0.65em] items-center justify-center overflow-hidden"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={`${placeKey}-${char}`}
                initial={{ y: direction > 0 ? '90%' : '-90%', opacity: 0.2 }}
                animate={{ y: '0%', opacity: 1 }}
                exit={{ y: direction > 0 ? '-90%' : '90%', opacity: 0 }}
                transition={TACTILE_SPRING}
                className="inline-block will-change-transform"
              >
                {char}
              </motion.span>
            </AnimatePresence>
          </span>
        );
      })}
    </span>
  );
}
