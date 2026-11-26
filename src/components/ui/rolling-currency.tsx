import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { isTactileMotion, TACTILE_SPRING } from '@/lib/motion/presets';
import type { MotionMode } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface RollingCurrencyProps {
  value: string;
  motionMode: MotionMode;
  enabled?: boolean;
  className?: string;
}

function parseLeadingNumber(text: string): number {
  const match = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

/**
 * Mechanical odometer-style rolling currency display. Digits roll vertically
 * in the direction of change while symbols/separators stay anchored, paired
 * with a brief accent highlight pulse on update.
 */
export function RollingCurrency({
  value,
  motionMode,
  enabled = true,
  className,
}: RollingCurrencyProps) {
  const prevValueRef = useRef(value);
  const [flashKey, setFlashKey] = useState(0);
  const prevNum = parseLeadingNumber(prevValueRef.current);
  const nextNum = parseLeadingNumber(value);
  const direction = nextNum >= prevNum ? 1 : -1;

  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setFlashKey((prev) => prev + 1);
    }
  }, [value]);

  const animateDigits = enabled && isTactileMotion(motionMode);

  if (!animateDigits) {
    return <span className={cn('tabular-nums', className)}>{value}</span>;
  }

  const chars = value.split('');

  return (
    <span
      key={flashKey > 0 ? `flash-${flashKey}` : 'initial'}
      className={cn(
        'inline-flex items-baseline tabular-nums leading-none',
        flashKey > 0 && 'stash-total-flash',
        className,
      )}
    >
      {chars.map((char, idx) => {
        const isDigit = char >= '0' && char <= '9';
        const slotKey = `slot-${chars.length - idx}`;
        if (!isDigit) {
          return (
            <span key={`${slotKey}-sym`} className="inline-block">
              {char === ' ' ? '\u00A0' : char}
            </span>
          );
        }
        return (
          <span
            key={slotKey}
            className="relative inline-flex h-[1.15em] w-[0.62em] items-center justify-center overflow-hidden"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={`${slotKey}-${char}`}
                initial={{ y: direction > 0 ? '95%' : '-95%', opacity: 0.2 }}
                animate={{ y: '0%', opacity: 1 }}
                exit={{ y: direction > 0 ? '-95%' : '95%', opacity: 0 }}
                transition={TACTILE_SPRING}
                className="inline-block"
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
