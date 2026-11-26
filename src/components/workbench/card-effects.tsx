import { AnimatePresence, motion } from 'motion/react';
import { type RefObject, useEffect, useState } from 'react';
import {
  ARCADE_HEADSHAKE_KEYFRAMES,
  ARCADE_HEADSHAKE_TRANSITION,
  ARCADE_SQUASH_KEYFRAMES,
  ARCADE_SQUASH_TRANSITION,
  computeCascadeDelay,
  computeNeighborJolt,
  type NeighborJoltVector,
  TACTILE_SETTLE_KEYFRAMES,
  TACTILE_SETTLE_TRANSITION,
  TACTILE_SPRING,
} from '@/lib/motion/presets';
import { cn } from '@/lib/utils/cn';
import { useFxStore } from '@/store/fx-store';

export interface ActiveNeighborJolt extends NeighborJoltVector {
  seq: number;
}

export function resolveLinkCardMotion(params: {
  vaporizing: boolean;
  isHighlighted: boolean;
  isSettling: boolean;
  arcade: boolean;
  cascadeActive: boolean;
  index: number;
  neighborJolt: ActiveNeighborJolt | null;
}) {
  const {
    vaporizing,
    isHighlighted,
    isSettling,
    arcade,
    cascadeActive,
    index,
    neighborJolt,
  } = params;

  const animate = vaporizing
    ? {
        opacity: 0,
        scale: arcade ? 0.82 : 0.92,
        rotate: arcade ? -2.5 : 0,
        y: arcade ? 4 : 0,
        x: 0,
      }
    : isHighlighted && arcade
      ? {
          ...ARCADE_HEADSHAKE_KEYFRAMES,
          opacity: 1,
          y: 0,
          rotate: 0,
          scale: 1,
        }
      : isSettling && arcade
        ? { ...ARCADE_SQUASH_KEYFRAMES, opacity: 1, x: 0, rotate: 0 }
        : isSettling
          ? { ...TACTILE_SETTLE_KEYFRAMES, opacity: 1, x: 0, rotate: 0 }
          : neighborJolt
            ? {
                opacity: 1,
                x: [0, neighborJolt.dx, 0],
                y: [0, neighborJolt.dy, 0],
                scale: [1, 0.988, 1],
                rotate: 0,
              }
            : { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 };

  const transition = vaporizing
    ? { duration: arcade ? 0.17 : 0.11, ease: 'easeIn' as const }
    : isHighlighted && arcade
      ? ARCADE_HEADSHAKE_TRANSITION
      : isSettling && arcade
        ? ARCADE_SQUASH_TRANSITION
        : isSettling
          ? TACTILE_SETTLE_TRANSITION
          : neighborJolt
            ? {
                duration: 0.28,
                delay: neighborJolt.delaySec,
                times: [0, 0.32, 1],
                ease: [0.22, 1, 0.36, 1] as const,
              }
            : arcade && cascadeActive
              ? { ...TACTILE_SPRING, delay: computeCascadeDelay(index) }
              : TACTILE_SPRING;

  return { animate, transition };
}

/**
 * Computes a short-lived radial desk-jolt displacement whenever a sibling card
 * in the same collection slams down nearby.
 */
export function useNeighborJolt(
  cardRef: RefObject<HTMLDivElement | null>,
  linkId: string,
  collectionId: string,
  enabled: boolean,
): ActiveNeighborJolt | null {
  const settledImpact = useFxStore((s) => s.settledImpact);
  const [jolt, setJolt] = useState<ActiveNeighborJolt | null>(null);

  useEffect(() => {
    if (
      !enabled ||
      !settledImpact ||
      settledImpact.collectionId !== collectionId ||
      settledImpact.linkId === linkId
    ) {
      setJolt(null);
      return;
    }

    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const vec = computeNeighborJolt(
      { x: settledImpact.cx, y: settledImpact.cy },
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    );
    if (!vec) {
      setJolt(null);
      return;
    }

    setJolt({ ...vec, seq: settledImpact.seq });
    const clearTimer = setTimeout(() => {
      setJolt((prev) => (prev?.seq === settledImpact.seq ? null : prev));
    }, 340);
    return () => clearTimeout(clearTimer);
  }, [cardRef, collectionId, enabled, linkId, settledImpact]);

  return jolt;
}

const STAR_SPARK_RAYS = [
  { angle: -155, dist: 18 },
  { angle: -120, dist: 22 },
  { angle: -75, dist: 20 },
  { angle: -25, dist: 16 },
  { angle: 135, dist: 16 },
  { angle: 175, dist: 20 },
] as const;

/**
 * Diagonal glass-sheen sweep across a freshly starred card, plus a crisp
 * 6-ray star micro-burst at the star corner in Arcade mode.
 */
export function StarShimmerOverlay({
  active,
  arcade,
}: {
  active: boolean;
  arcade: boolean;
}) {
  return (
    <AnimatePresence>
      {active && (
        <>
          <div
            key="star-sheen"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[14] overflow-hidden rounded-card"
          >
            <div className="stash-star-sheen absolute inset-y-0 w-1/2" />
          </div>
          {arcade && (
            <div
              key="star-burst"
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-3 z-[15]"
            >
              {STAR_SPARK_RAYS.map((ray) => {
                const rad = (ray.angle * Math.PI) / 180;
                const tx = Math.cos(rad) * ray.dist;
                const ty = Math.sin(rad) * ray.dist;
                return (
                  <motion.span
                    key={ray.angle}
                    initial={{ x: 0, y: 0, scale: 0.4, opacity: 0.95 }}
                    animate={{ x: tx, y: ty, scale: 0, opacity: 0 }}
                    transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                    style={{
                      boxShadow:
                        '0 0 6px color-mix(in srgb, var(--stash-accent) 80%, transparent)',
                    }}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}

const VAPOR_MOTES = [
  { x: -34, y: -16, size: 7 },
  { x: 0, y: -22, size: 6 },
  { x: 34, y: -14, size: 7 },
  { x: -42, y: 8, size: 6 },
  { x: 40, y: 10, size: 6 },
  { x: -18, y: 20, size: 5 },
  { x: 20, y: 18, size: 5 },
] as const;

/**
 * Brief ash/spark puff when a card vaporizes on quick delete (Arcade).
 */
export function DeleteVaporPuff({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-visible"
        >
          {VAPOR_MOTES.map((mote, i) => (
            <motion.span
              key={`${mote.x}-${mote.y}`}
              initial={{ x: 0, y: 0, scale: 0.9, opacity: 0.78 }}
              animate={{
                x: mote.x,
                y: mote.y,
                scale: 0.1,
                opacity: 0,
              }}
              transition={{
                duration: 0.2,
                delay: i * 0.008,
                ease: 'easeOut',
              }}
              style={{
                width: mote.size,
                height: mote.size,
                backgroundColor:
                  i % 2 === 0
                    ? 'var(--stash-danger)'
                    : 'var(--stash-text-muted)',
              }}
              className="absolute rounded-full blur-[1px]"
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

interface LinkCardDragPlaceholderProps {
  title: string;
  domain: string;
  note: string;
  visibleTags: readonly string[];
  isMicro: boolean;
  showNote: boolean;
  showTags: boolean;
  cardPadding: string;
}

export function LinkCardDragPlaceholder({
  title,
  domain,
  note,
  visibleTags,
  isMicro,
  showNote,
  showTags,
  cardPadding,
}: LinkCardDragPlaceholderProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex h-full flex-col rounded-card border border-dashed border-accent/55 bg-panel/35',
        cardPadding,
      )}
    >
      <div className="invisible flex items-start gap-2.5 pr-6">
        <div
          className={cn('mt-0.5 shrink-0', isMicro ? 'h-6 w-6' : 'h-7 w-7')}
        />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'font-medium leading-snug',
              isMicro ? 'truncate text-[13px]' : 'line-clamp-2 text-sm',
            )}
          >
            {title}
          </div>
          <div
            className={cn(
              'mt-0.5 truncate font-mono',
              isMicro ? 'text-[10px]' : 'text-[11px]',
            )}
          >
            {domain}
          </div>
        </div>
      </div>
      {showNote && <p className="invisible line-clamp-1 text-xs">{note}</p>}
      {showTags && (
        <div className="invisible mt-auto flex flex-wrap items-center gap-1 pt-0.5">
          {visibleTags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 font-mono text-[10px]">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
