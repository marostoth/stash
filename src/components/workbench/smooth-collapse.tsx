import { type ReactNode, useEffect, useState } from 'react';
import type { MotionMode } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

const COLLAPSE_DURATION_MS = 160;
const REDUCED_FADE_MS = 120;

interface SmoothCollapseProps {
  open: boolean;
  motionMode?: MotionMode;
  /** Legacy boolean flag kept for callers without motionMode */
  animated?: boolean;
  children: ReactNode;
}

/**
 * Native CSS `grid-template-rows` accordion with tight 160ms fold in Tactile /
 * Arcade, simple 120ms opacity fade in Reduced, and instant snap in Off.
 * Unmounts closed cards so collapsed items never act as hidden drag targets,
 * and returns to `overflow-visible` when settled open.
 */
export function SmoothCollapse({
  open,
  motionMode,
  animated = true,
  children,
}: SmoothCollapseProps) {
  const mode: MotionMode = motionMode ?? (animated ? 'tactile' : 'off');
  const isOff = mode === 'off';
  const isReduced = mode === 'reduced';
  const durationMs = isReduced ? REDUCED_FADE_MS : COLLAPSE_DURATION_MS;

  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(open);
  const [overflowVisible, setOverflowVisible] = useState(open);

  useEffect(() => {
    if (isOff) {
      setMounted(open);
      setExpanded(open);
      setOverflowVisible(open);
      return;
    }

    if (open) {
      setMounted(true);
      setOverflowVisible(isReduced);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setExpanded(true);
        });
      });
      const settleTimer = setTimeout(() => {
        setOverflowVisible(true);
      }, durationMs + 24);
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
        clearTimeout(settleTimer);
      };
    }

    setOverflowVisible(false);
    setExpanded(false);
    const unmountTimer = setTimeout(() => {
      setMounted(false);
    }, durationMs + 24);
    return () => clearTimeout(unmountTimer);
  }, [durationMs, isOff, isReduced, open]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        'grid',
        !isOff &&
          (isReduced
            ? 'transition-opacity duration-[120ms] ease-out'
            : 'will-change-[grid-template-rows,opacity] transition-[grid-template-rows,opacity] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)]'),
        expanded
          ? 'grid-rows-[1fr] opacity-100'
          : isReduced
            ? 'grid-rows-[1fr] opacity-0 pointer-events-none'
            : 'grid-rows-[0fr] opacity-0 pointer-events-none',
      )}
    >
      <div className={overflowVisible ? 'overflow-visible' : 'overflow-hidden'}>
        {children}
      </div>
    </div>
  );
}
