import { GripVertical } from 'lucide-react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { useEffect } from 'react';
import type { DragItemData } from '@/lib/dnd/types';
import {
  ARCADE_DRAG_TILT_MAX_DEGREES,
  ARCADE_DRAG_TILT_VELOCITY_SCALE,
  ARCADE_TILT_SPRING_CONFIG,
  computeDragTilt,
  DRAG_TILT_VELOCITY_SCALE,
  isArcadeMotion,
  isTactileMotion,
  MAX_DRAG_TILT_DEGREES,
  TACTILE_SPRING,
  TILT_SPRING_CONFIG,
} from '@/lib/motion/physics';
import { type MotionMode, TAB_GROUP_COLOR_SWATCH } from '@/lib/types/stash';
import { extractDomain, getMonogram } from '@/lib/utils/url';

interface DragGhostProps {
  data: DragItemData;
  motionMode: MotionMode;
  dragTiltEnabled?: boolean;
}

export function DragGhost({
  data,
  motionMode,
  dragTiltEnabled = true,
}: DragGhostProps) {
  const arcade = isArcadeMotion(motionMode);
  const tactile = isTactileMotion(motionMode);
  const tiltActive = tactile && dragTiltEnabled;
  const targetTilt = useMotionValue(0);
  const smoothTilt = useSpring(
    targetTilt,
    arcade ? ARCADE_TILT_SPRING_CONFIG : TILT_SPRING_CONFIG,
  );

  useEffect(() => {
    if (!tiltActive) {
      targetTilt.set(0);
      return;
    }

    const maxTilt = arcade
      ? ARCADE_DRAG_TILT_MAX_DEGREES
      : MAX_DRAG_TILT_DEGREES;
    const velocityScale = arcade
      ? ARCADE_DRAG_TILT_VELOCITY_SCALE
      : DRAG_TILT_VELOCITY_SCALE;

    let lastX: number | null = null;
    let lastTime = 0;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const handlePointerMove = (event: PointerEvent) => {
      const now = performance.now();
      if (lastX !== null) {
        const dtSec = Math.max(0.008, (now - lastTime) / 1000);
        const velocityX = (event.clientX - lastX) / dtSec;
        targetTilt.set(computeDragTilt(velocityX, maxTilt, velocityScale));
      }
      lastX = event.clientX;
      lastTime = now;

      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        targetTilt.set(0);
      }, 65);
    };

    window.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (settleTimer) clearTimeout(settleTimer);
      targetTilt.set(0);
    };
  }, [arcade, tiltActive, targetTilt]);

  const glowStyle: React.CSSProperties = {
    boxShadow: arcade
      ? '0 26px 46px -12px rgba(0, 0, 0, 0.65), 0 0 30px -4px color-mix(in srgb, var(--stash-accent) 52%, transparent)'
      : tactile
        ? '0 22px 38px -12px rgba(0, 0, 0, 0.58), 0 0 24px -6px color-mix(in srgb, var(--stash-accent) 42%, transparent)'
        : '0 14px 28px -10px rgba(0, 0, 0, 0.45)',
  };

  if (data.kind === 'collection') {
    const colorHex = TAB_GROUP_COLOR_SWATCH[data.collection.color];
    return (
      <motion.div
        initial={tactile ? { scale: 1 } : false}
        animate={tactile ? { scale: arcade ? 1.04 : 1.03 } : { scale: 1 }}
        transition={TACTILE_SPRING}
        style={{
          ...glowStyle,
          rotate: tiltActive ? smoothTilt : 0,
        }}
        className="flex w-72 items-center gap-2 rounded-card border border-accent/75 bg-panel px-3.5 py-2.5 will-change-transform"
      >
        <GripVertical className="h-4 w-4 text-accent" />
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: colorHex }}
        />
        <span className="truncate text-sm font-semibold text-fg">
          {data.collection.name}
        </span>
      </motion.div>
    );
  }

  const title = data.kind === 'link' ? data.link.title : data.tab.title;
  const url = data.kind === 'link' ? data.link.url : data.tab.url;
  const faviconUrl =
    data.kind === 'link' ? data.link.faviconUrl : data.tab.favIconUrl;
  const domain = extractDomain(url);
  const monogram = getMonogram(title, url);

  return (
    <motion.div
      initial={tactile ? { scale: 1 } : false}
      animate={tactile ? { scale: arcade ? 1.06 : 1.04 } : { scale: 1 }}
      transition={TACTILE_SPRING}
      style={{
        ...glowStyle,
        rotate: tactile ? smoothTilt : 0,
      }}
      className="flex w-64 items-start gap-2.5 rounded-card border border-accent/80 bg-card p-3 will-change-transform"
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-control border border-border bg-panel font-mono text-xs font-semibold text-accent">
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            width={16}
            height={16}
            draggable={false}
            className="h-4 w-4 object-contain"
          />
        ) : (
          <span>{monogram}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-xs font-medium text-fg">{title}</div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-fg-muted">
          {domain}
        </div>
      </div>
    </motion.div>
  );
}
