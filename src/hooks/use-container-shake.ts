import { useAnimate } from 'motion/react';
import { useEffect } from 'react';
import { useFxStore } from '@/store/fx-store';

/**
 * Imperatively fires a tight, downward vertical container punch
 * (`135ms`, `+4px` on card drop / `+5.5px` on bulk actions, `<= ±0.45px` horizontal drift)
 * without ever remounting children. Strictly gated to Arcade mode and suppressed
 * automatically when the OS requests `prefers-reduced-motion`.
 */
export function useContainerShake(enabled: boolean) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const containerShake = useFxStore((s) => s.containerShake);

  useEffect(() => {
    if (!enabled || !containerShake || !scope.current) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const isHeavy = containerShake.intensity === 'heavy';
    void animate(
      scope.current,
      isHeavy
        ? { y: [0, 5.5, -2, 0.6, 0], x: [0, 0.45, -0.3, 0, 0] }
        : { y: [0, 4, -1.8, 0.6, 0], x: [0, 0.35, -0.25, 0, 0] },
      { duration: 0.135, times: [0, 0.24, 0.58, 0.82, 1], ease: 'easeOut' },
    );
  }, [animate, containerShake, enabled, scope]);

  return scope;
}
