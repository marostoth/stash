import { type ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

const COLLAPSE_DURATION_MS = 240;

interface SmoothCollapseProps {
  open: boolean;
  animated: boolean;
  children: ReactNode;
}

/**
 * Silky native CSS `grid-template-rows` accordion that avoids per-frame JS
 * height reflows, unmounts inner cards once closed (so collapsed items never
 * act as hidden drag targets), and switches back to `overflow-visible` when
 * settled open so shockwaves and hover rings are never clipped.
 */
export function SmoothCollapse({
  open,
  animated,
  children,
}: SmoothCollapseProps) {
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(open);
  const [overflowVisible, setOverflowVisible] = useState(open);

  useEffect(() => {
    if (!animated) {
      setMounted(open);
      setExpanded(open);
      setOverflowVisible(open);
      return;
    }

    if (open) {
      setMounted(true);
      setOverflowVisible(false);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setExpanded(true);
        });
      });
      const settleTimer = setTimeout(() => {
        setOverflowVisible(true);
      }, COLLAPSE_DURATION_MS + 30);
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
    }, COLLAPSE_DURATION_MS + 30);
    return () => clearTimeout(unmountTimer);
  }, [animated, open]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        'grid will-change-[grid-template-rows,opacity]',
        animated &&
          'transition-[grid-template-rows,opacity] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
        expanded
          ? 'grid-rows-[1fr] opacity-100'
          : 'grid-rows-[0fr] opacity-0 pointer-events-none',
      )}
    >
      <div className={overflowVisible ? 'overflow-visible' : 'overflow-hidden'}>
        {children}
      </div>
    </div>
  );
}
