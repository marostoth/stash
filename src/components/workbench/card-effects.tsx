import { Star } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type RefObject, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { playDrop } from '@/lib/audio/foley';
import {
  ARCADE_HEADSHAKE_KEYFRAMES,
  ARCADE_HEADSHAKE_TRANSITION,
  ARCADE_SQUASH_KEYFRAMES,
  ARCADE_SQUASH_TRANSITION,
  ARCADE_TAG_POP_SPRING,
  computeCascadeDelay,
  computeNeighborJolt,
  type NeighborJoltVector,
  TACTILE_SETTLE_KEYFRAMES,
  TACTILE_SETTLE_TRANSITION,
  TACTILE_SPRING,
  TAG_POP_SPRING,
} from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import type {
  CollectionViewMode,
  LinkItem,
  MotionMode,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { spawnSlamForElement } from '@/lib/vfx/engine';
import { useFxStore } from '@/store/fx-store';
import { useUiStore } from '@/store/ui-store';

export function StarredCardAccents({
  viewMode,
}: {
  viewMode: CollectionViewMode;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute right-1.5 top-1.5 z-[12] flex h-7 w-7 items-center justify-center text-accent opacity-90 transition-opacity duration-150 group-focus-within:opacity-0 group-hover:opacity-0',
        viewMode === 'cover' && 'rounded-control bg-panel/95',
      )}
    >
      <Star className="h-3.5 w-3.5 fill-accent text-accent" />
    </span>
  );
}

export interface ActiveNeighborJolt extends NeighborJoltVector {
  seq: number;
}

export function resolveLinkCardMotion(params: {
  vaporizing: boolean;
  isHighlighted: boolean;
  isSettling: boolean;
  arcade: boolean;
  tactile: boolean;
  reduced: boolean;
  cascadeActive: boolean;
  index: number;
  neighborJolt: ActiveNeighborJolt | null;
}) {
  const {
    vaporizing,
    isHighlighted,
    isSettling,
    arcade,
    tactile,
    reduced,
    cascadeActive,
    index,
    neighborJolt,
  } = params;

  const animate = vaporizing
    ? reduced
      ? { opacity: 0, scale: 1, rotate: 0, y: 0, x: 0 }
      : arcade
        ? { opacity: 0, scale: 0.92, rotate: 0, y: 0, x: 0 }
        : { opacity: 0, scale: 0.96, rotate: 0, y: 0, x: 0 }
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
                x: [
                  0,
                  neighborJolt.dx,
                  Number((-neighborJolt.dx * 0.18).toFixed(2)),
                  0,
                ],
                y: [
                  0,
                  neighborJolt.dy,
                  Number((-neighborJolt.dy * 0.18).toFixed(2)),
                  0,
                ],
                scale: [1, 0.98, 1.006, 1],
                rotate: 0,
              }
            : { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 };

  const transition = vaporizing
    ? reduced
      ? { duration: 0.12, ease: 'easeOut' as const }
      : { duration: 0.15, ease: [0.32, 0, 0.67, 0] as const }
    : isHighlighted && arcade
      ? ARCADE_HEADSHAKE_TRANSITION
      : isSettling && arcade
        ? ARCADE_SQUASH_TRANSITION
        : isSettling
          ? TACTILE_SETTLE_TRANSITION
          : neighborJolt
            ? {
                duration: 0.24,
                delay: neighborJolt.delaySec,
                times: [0, 0.3, 0.7, 1],
                ease: [0.22, 0.85, 0.34, 1] as const,
              }
            : tactile && cascadeActive
              ? {
                  ...TACTILE_SPRING,
                  delay: computeCascadeDelay(index, arcade ? 0.055 : 0.038),
                }
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
  const settledImpact = useFxStore((s) =>
    enabled &&
    s.settledImpact &&
    s.settledImpact.collectionId === collectionId &&
    s.settledImpact.linkId !== linkId
      ? s.settledImpact
      : null,
  );
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

    const isVacuum = settledImpact.mode === 'vacuum';
    const vec = computeNeighborJolt(
      { x: settledImpact.cx, y: settledImpact.cy },
      { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      isVacuum ? 12 : 9,
      isVacuum ? 640 : 580,
      isVacuum ? -1 : 1,
    );
    if (!vec) {
      setJolt(null);
      return;
    }

    setJolt({ ...vec, seq: settledImpact.seq });
    const clearTimer = setTimeout(() => {
      setJolt((prev) => (prev?.seq === settledImpact.seq ? null : prev));
    }, 620);
    return () => clearTimeout(clearTimer);
  }, [cardRef, collectionId, enabled, linkId, settledImpact]);

  return jolt;
}

const STAR_SPARK_RAYS = [
  { angle: -155, dist: 24 },
  { angle: -120, dist: 28 },
  { angle: -75, dist: 26 },
  { angle: -25, dist: 22 },
  { angle: 135, dist: 22 },
  { angle: 175, dist: 26 },
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
                    initial={{ x: 0, y: 0, scale: 0.45, opacity: 0.95 }}
                    animate={{ x: tx, y: ty, scale: 0, opacity: 0 }}
                    transition={{ duration: 0.62, ease: [0.16, 0.84, 0.3, 1] }}
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

/**
 * Clipped delete contact rim flash (Arcade cinder shards & falling ash render
 * on the fixed 2D `<VfxCanvas />`).
 */
export function DeleteVaporPuff({
  active,
  arcade = false,
}: {
  active: boolean;
  arcade?: boolean;
}) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="delete-rim"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.92, 0] }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.14,
            times: [0, 0.22, 1],
            ease: 'easeOut',
          }}
          style={{
            backgroundColor: arcade ? 'rgba(255, 255, 255, 0.24)' : undefined,
            boxShadow: arcade
              ? 'inset 0 0 0 1px #FFFFFF'
              : 'inset 0 0 0 1px color-mix(in srgb, var(--stash-text) 42%, transparent)',
          }}
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-card"
        />
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

export function CardTagsRow({
  visibleTags,
  hiddenTagCount,
  seenTags,
  tactile,
  arcade,
}: {
  visibleTags: readonly string[];
  hiddenTagCount: number;
  seenTags: ReadonlySet<string>;
  tactile: boolean;
  arcade: boolean;
  isCompact: boolean;
}) {
  return (
    <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-1 font-mono text-[10.5px] text-fg-muted/75">
      {visibleTags.map((tag, idx) => {
        const isNewlyAdded = !seenTags.has(tag);
        return (
          <motion.span
            key={tag}
            initial={
              isNewlyAdded && tactile ? { scale: 0.85, opacity: 0 } : false
            }
            animate={{ scale: 1, opacity: 1 }}
            transition={arcade ? ARCADE_TAG_POP_SPRING : TAG_POP_SPRING}
            className="inline-flex items-center gap-1.5"
          >
            {idx > 0 && (
              <span aria-hidden="true" className="opacity-45">
                ·
              </span>
            )}
            <span>{tag}</span>
          </motion.span>
        );
      })}
      {hiddenTagCount > 0 && (
        <span className="opacity-65">+{hiddenTagCount}</span>
      )}
    </div>
  );
}

function fireRestoredLinkImpact(
  restored: LinkItem,
  options: {
    soundEffects: boolean;
    motionMode: MotionMode;
    fxDeskJolt: boolean;
  },
): void {
  const { soundEffects, motionMode, fxDeskJolt } = options;
  const triggerImpact = (el: Element | null) => {
    playDrop(soundEffects, motionMode);
    if (motionMode === 'off') return;
    useUiStore.getState().settleLink(restored.id);
    const fx = useFxStore.getState();
    fx.triggerSettledImpact(restored.id, restored.collectionId);
    if (motionMode === 'arcade') {
      if (fxDeskJolt) fx.triggerContainerShake('combo');
      spawnSlamForElement(el);
    }
  };

  if (
    typeof document === 'undefined' ||
    typeof requestAnimationFrame !== 'function'
  ) {
    triggerImpact(null);
    return;
  }

  const selector = `[data-link-id="${CSS.escape(restored.id)}"]`;
  let attempts = 0;
  const waitForMount = () => {
    const el = document.querySelector(selector);
    if (el && el.getBoundingClientRect().width > 0) {
      // Wait 1 extra frame so Motion's initial={false} card mounts at rest first
      requestAnimationFrame(() => triggerImpact(el));
      return;
    }
    attempts += 1;
    if (attempts < 15) {
      requestAnimationFrame(waitForMount);
    } else {
      triggerImpact(null);
    }
  };
  requestAnimationFrame(waitForMount);
}

export function showDeletedLinkToast(
  snapshot: LinkItem,
  options: {
    soundEffects: boolean;
    motionMode: MotionMode;
    fxDeskJolt?: boolean;
  },
): void {
  let undone = false;
  toast('Link removed', {
    duration: 5000,
    className: 'stash-undo-toast',
    action: {
      label: 'Undo',
      onClick: () => {
        if (undone) return;
        undone = true;
        void stashRepo.restoreLink(snapshot).then((restored) => {
          if (restored) {
            fireRestoredLinkImpact(restored, {
              soundEffects: options.soundEffects,
              motionMode: options.motionMode,
              fxDeskJolt: options.fxDeskJolt ?? true,
            });
          }
        });
      },
    },
  });
}
