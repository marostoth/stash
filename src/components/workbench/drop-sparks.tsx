import { AnimatePresence, motion } from 'motion/react';
import type { DropEffectStyle } from '@/lib/types/stash';

interface DropSparksProps {
  active: boolean;
  variant?: DropEffectStyle;
  /** Compact horizontal variant for thin Details view rows */
  compact?: boolean;
}

interface DustPlume {
  id: string;
  /** Anchor position around the card's outer perimeter (%) */
  leftPct: number;
  topPct: number;
  /** Outward blast vector perpendicular to the edge (px) */
  dx: number;
  dy: number;
  /** Initial puff dimensions (px) */
  width: number;
  height: number;
  rotate: number;
  delay: number;
  duration: number;
}

/**
 * 14 edge & corner-anchored dust puffs radiating strictly outward from
 * UNDERNEATH the card perimeter (never spawning on top of the card center).
 */
const CARD_DUST_PLUMES: readonly DustPlume[] = [
  // Top edge blasting upward
  {
    id: 't1',
    leftPct: 20,
    topPct: 4,
    dx: -10,
    dy: -26,
    width: 24,
    height: 11,
    rotate: -10,
    delay: 0.045,
    duration: 0.38,
  },
  {
    id: 't2',
    leftPct: 50,
    topPct: 2,
    dx: 0,
    dy: -32,
    width: 32,
    height: 12,
    rotate: 0,
    delay: 0.04,
    duration: 0.42,
  },
  {
    id: 't3',
    leftPct: 80,
    topPct: 4,
    dx: 10,
    dy: -26,
    width: 24,
    height: 11,
    rotate: 10,
    delay: 0.05,
    duration: 0.39,
  },
  // Bottom edge blasting downward (heavier impact plume)
  {
    id: 'b1',
    leftPct: 18,
    topPct: 96,
    dx: -12,
    dy: 30,
    width: 28,
    height: 12,
    rotate: 10,
    delay: 0.045,
    duration: 0.42,
  },
  {
    id: 'b2',
    leftPct: 42,
    topPct: 98,
    dx: -4,
    dy: 36,
    width: 34,
    height: 13,
    rotate: 3,
    delay: 0.04,
    duration: 0.45,
  },
  {
    id: 'b3',
    leftPct: 62,
    topPct: 98,
    dx: 5,
    dy: 35,
    width: 32,
    height: 13,
    rotate: -4,
    delay: 0.048,
    duration: 0.44,
  },
  {
    id: 'b4',
    leftPct: 84,
    topPct: 96,
    dx: 12,
    dy: 28,
    width: 26,
    height: 12,
    rotate: -12,
    delay: 0.052,
    duration: 0.41,
  },
  // Left & Right flanks blasting sideways
  {
    id: 'l1',
    leftPct: 2,
    topPct: 34,
    dx: -34,
    dy: -4,
    width: 14,
    height: 24,
    rotate: -6,
    delay: 0.046,
    duration: 0.4,
  },
  {
    id: 'l2',
    leftPct: 2,
    topPct: 68,
    dx: -36,
    dy: 5,
    width: 14,
    height: 24,
    rotate: 6,
    delay: 0.052,
    duration: 0.41,
  },
  {
    id: 'r1',
    leftPct: 98,
    topPct: 34,
    dx: 34,
    dy: -4,
    width: 14,
    height: 24,
    rotate: 6,
    delay: 0.046,
    duration: 0.4,
  },
  {
    id: 'r2',
    leftPct: 98,
    topPct: 68,
    dx: 36,
    dy: 5,
    width: 14,
    height: 24,
    rotate: -6,
    delay: 0.052,
    duration: 0.41,
  },
  // 4 corners blasting diagonally
  {
    id: 'c1',
    leftPct: 4,
    topPct: 6,
    dx: -28,
    dy: -22,
    width: 20,
    height: 13,
    rotate: 32,
    delay: 0.05,
    duration: 0.39,
  },
  {
    id: 'c2',
    leftPct: 96,
    topPct: 6,
    dx: 28,
    dy: -22,
    width: 20,
    height: 13,
    rotate: -32,
    delay: 0.05,
    duration: 0.39,
  },
  {
    id: 'c3',
    leftPct: 4,
    topPct: 94,
    dx: -30,
    dy: 24,
    width: 22,
    height: 14,
    rotate: -32,
    delay: 0.044,
    duration: 0.43,
  },
  {
    id: 'c4',
    leftPct: 96,
    topPct: 94,
    dx: 30,
    dy: 24,
    width: 22,
    height: 14,
    rotate: 32,
    delay: 0.044,
    duration: 0.43,
  },
] as const;

const ROW_DUST_PLUMES: readonly DustPlume[] = [
  {
    id: 'rt1',
    leftPct: 22,
    topPct: 4,
    dx: -6,
    dy: -16,
    width: 34,
    height: 8,
    rotate: 0,
    delay: 0.03,
    duration: 0.32,
  },
  {
    id: 'rt2',
    leftPct: 55,
    topPct: 4,
    dx: 0,
    dy: -18,
    width: 42,
    height: 8,
    rotate: 0,
    delay: 0.025,
    duration: 0.34,
  },
  {
    id: 'rt3',
    leftPct: 84,
    topPct: 4,
    dx: 6,
    dy: -16,
    width: 34,
    height: 8,
    rotate: 0,
    delay: 0.035,
    duration: 0.32,
  },
  {
    id: 'rb1',
    leftPct: 24,
    topPct: 96,
    dx: -6,
    dy: 18,
    width: 36,
    height: 9,
    rotate: 0,
    delay: 0.03,
    duration: 0.35,
  },
  {
    id: 'rb2',
    leftPct: 56,
    topPct: 96,
    dx: 0,
    dy: 20,
    width: 44,
    height: 9,
    rotate: 0,
    delay: 0.025,
    duration: 0.36,
  },
  {
    id: 'rb3',
    leftPct: 82,
    topPct: 96,
    dx: 6,
    dy: 18,
    width: 36,
    height: 9,
    rotate: 0,
    delay: 0.035,
    duration: 0.34,
  },
] as const;

const BLAST_EASE = [0.1, 0.9, 0.22, 1] as const;

/**
 * Heavy tile impact shockwave + edge-blasted dust plumes rendered BEHIND the
 * card (`z-0` underneath a `z-[1]` card surface) so displaced dust & pressure
 * waves erupt outward from underneath the perimeter.
 */
export function DropSparks({
  active,
  variant = 'dust',
  compact = false,
}: DropSparksProps) {
  const isAccent = variant === 'accent';
  const plumes = compact ? ROW_DUST_PLUMES : CARD_DUST_PLUMES;

  const dustFill = isAccent
    ? 'radial-gradient(ellipse at center, color-mix(in srgb, var(--stash-accent) 70%, transparent) 0%, color-mix(in srgb, var(--stash-accent) 26%, transparent) 55%, transparent 100%)'
    : 'radial-gradient(ellipse at center, color-mix(in srgb, var(--stash-text) 46%, transparent) 0%, color-mix(in srgb, var(--stash-text-muted) 26%, transparent) 58%, transparent 100%)';

  const outerRingColor = isAccent
    ? 'color-mix(in srgb, var(--stash-accent) 75%, transparent)'
    : 'color-mix(in srgb, var(--stash-text-muted) 48%, transparent)';

  return (
    <AnimatePresence>
      {active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-visible"
        >
          {/* 1. Crisp inner pressure shockwave snapping out from card perimeter */}
          <motion.div
            initial={{ opacity: 0.9, scaleX: 0.98, scaleY: 0.96 }}
            animate={{
              opacity: 0,
              scaleX: compact ? 1.03 : 1.15,
              scaleY: compact ? 1.42 : 1.32,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.3,
              delay: 0.04,
              ease: BLAST_EASE,
            }}
            style={{
              borderColor: 'var(--stash-accent)',
              boxShadow: isAccent
                ? '0 0 22px 2px color-mix(in srgb, var(--stash-accent) 65%, transparent)'
                : '0 0 14px 0px color-mix(in srgb, var(--stash-accent) 45%, transparent)',
            }}
            className={
              compact
                ? 'absolute inset-0 rounded border-2 will-change-transform'
                : 'absolute inset-0 rounded-card border-2 will-change-transform'
            }
          />

          {/* 2. Wider displaced-air outer shockwave halo */}
          <motion.div
            initial={{ opacity: isAccent ? 0.65 : 0.48, scaleX: 1, scaleY: 1 }}
            animate={{
              opacity: 0,
              scaleX: compact ? 1.06 : 1.26,
              scaleY: compact ? 1.75 : 1.52,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.44,
              delay: 0.055,
              ease: BLAST_EASE,
            }}
            style={{
              borderColor: outerRingColor,
              filter: 'blur(2.5px)',
            }}
            className={
              compact
                ? 'absolute inset-0 rounded border-2 will-change-transform'
                : 'absolute inset-0 rounded-card border-2 will-change-transform'
            }
          />

          {/* 3. Edge & corner dust clouds blasting out from underneath */}
          {plumes.map((plume) => (
            <motion.span
              key={plume.id}
              initial={{
                x: 0,
                y: 0,
                scale: 0.55,
                opacity: isAccent ? 0.88 : 0.8,
                rotate: plume.rotate,
              }}
              animate={{
                x: plume.dx,
                y: plume.dy,
                scale: 1.95,
                opacity: 0,
                rotate: plume.rotate,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: plume.duration,
                delay: plume.delay,
                ease: BLAST_EASE,
              }}
              style={{
                left: `${plume.leftPct}%`,
                top: `${plume.topPct}%`,
                width: plume.width,
                height: plume.height,
                marginLeft: -plume.width / 2,
                marginTop: -plume.height / 2,
                background: dustFill,
                filter: 'blur(2.5px)',
              }}
              className="absolute rounded-full will-change-transform"
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
