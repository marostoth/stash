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

const RIPPLE_EASE = [0.16, 0.78, 0.28, 1] as const;
const DUST_EASE = [0.14, 0.84, 0.26, 1] as const;

/**
 * Heavy tile impact shockwave + edge-blasted dust plumes rendered BEHIND the
 * card (`z-0` underneath a `z-[1]` card surface).
 * Uses feathered radial glass-wavefront rings (never hard rectangular frames)
 * followed by displaced perimeter dust plumes.
 */
export function DropSparks({
  active,
  variant = 'dust',
  compact = false,
}: DropSparksProps) {
  const isAccent = variant === 'accent';
  const plumes = compact ? ROW_DUST_PLUMES : CARD_DUST_PLUMES;

  const dustFill = isAccent
    ? 'radial-gradient(ellipse at center, color-mix(in srgb, var(--stash-accent) 68%, transparent) 0%, color-mix(in srgb, var(--stash-accent) 24%, transparent) 56%, transparent 100%)'
    : 'radial-gradient(ellipse at center, color-mix(in srgb, var(--stash-text) 44%, transparent) 0%, color-mix(in srgb, var(--stash-text-muted) 24%, transparent) 58%, transparent 100%)';

  const primaryRippleBg = isAccent
    ? 'radial-gradient(ellipse at center, transparent 48%, color-mix(in srgb, var(--stash-accent) 52%, transparent) 63%, color-mix(in srgb, white 22%, var(--stash-accent) 78%) 68%, transparent 78%)'
    : 'radial-gradient(ellipse at center, transparent 50%, color-mix(in srgb, var(--stash-accent) 36%, transparent) 64%, color-mix(in srgb, var(--stash-text) 32%, transparent) 69%, transparent 78%)';

  const secondaryRippleBg = isAccent
    ? 'radial-gradient(ellipse at center, transparent 58%, color-mix(in srgb, var(--stash-accent) 36%, transparent) 69%, transparent 79%)'
    : 'radial-gradient(ellipse at center, transparent 60%, color-mix(in srgb, var(--stash-text-muted) 30%, transparent) 70%, transparent 80%)';

  const contactGlowBg = isAccent
    ? 'radial-gradient(ellipse at center, color-mix(in srgb, var(--stash-accent) 38%, transparent) 0%, transparent 72%)'
    : 'radial-gradient(ellipse at center, color-mix(in srgb, var(--stash-accent) 24%, transparent) 0%, transparent 70%)';

  const dustPeakOpacity = isAccent ? 0.85 : 0.76;

  return (
    <AnimatePresence>
      {active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-visible"
        >
          {/* 0. Soft contact flash grounding the slam underneath the tile */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: [0, 0.75, 0], scale: compact ? 1.15 : 1.25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
            style={{ background: contactGlowBg }}
            className="absolute -inset-x-6 -inset-y-4 rounded-full blur-[6px] will-change-transform"
          />

          {/* 1. Primary circular/elliptical glass shockwave ripple */}
          <motion.div
            initial={{ opacity: 0, scale: 0.58 }}
            animate={{
              opacity: [0, 0.95, 0.68, 0],
              scale: compact ? 1.38 : 1.62,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.48,
              delay: 0.03,
              opacity: {
                duration: 0.48,
                delay: 0.03,
                times: [0, 0.16, 0.52, 1],
              },
              ease: RIPPLE_EASE,
            }}
            style={{
              background: primaryRippleBg,
              filter: 'blur(1.5px)',
            }}
            className={
              compact
                ? 'absolute -inset-x-6 -inset-y-5 rounded-full will-change-transform'
                : 'absolute -inset-x-10 -inset-y-8 rounded-full will-change-transform'
            }
          />

          {/* 2. Secondary concentric displaced-air ripple trailing the wavefront */}
          <motion.div
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{
              opacity: [0, isAccent ? 0.68 : 0.52, 0],
              scale: compact ? 1.62 : 1.92,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.58,
              delay: 0.085,
              opacity: { duration: 0.58, delay: 0.085, times: [0, 0.24, 1] },
              ease: RIPPLE_EASE,
            }}
            style={{
              background: secondaryRippleBg,
              filter: 'blur(2.5px)',
            }}
            className={
              compact
                ? 'absolute -inset-x-6 -inset-y-5 rounded-full will-change-transform'
                : 'absolute -inset-x-10 -inset-y-8 rounded-full will-change-transform'
            }
          />

          {/* 3. Perimeter dust clouds erupting right behind the primary glass ripple */}
          {plumes.map((plume) => {
            const dustDelay = Number(
              (plume.delay + (compact ? 0.035 : 0.045)).toFixed(3),
            );
            const dustDuration = Number((plume.duration * 1.25).toFixed(3));
            return (
              <motion.span
                key={plume.id}
                initial={{
                  x: 0,
                  y: 0,
                  scale: 0.55,
                  opacity: 0,
                  rotate: plume.rotate,
                }}
                animate={{
                  x: plume.dx * 1.08,
                  y: plume.dy * 1.08,
                  scale: 1.95,
                  opacity: [0, dustPeakOpacity, dustPeakOpacity * 0.55, 0],
                  rotate: plume.rotate,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: dustDuration,
                  delay: dustDelay,
                  opacity: {
                    duration: dustDuration,
                    delay: dustDelay,
                    times: [0, 0.16, 0.52, 1],
                  },
                  ease: DUST_EASE,
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
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}
