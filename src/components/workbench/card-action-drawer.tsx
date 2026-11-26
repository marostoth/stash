import { Check, Pencil, Star, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isTactileMotion } from '@/lib/motion/presets';
import type { MotionMode } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

/** 28px square tile shifted by 27px so adjacent 1px borders overlap into one hairline */
const SLOT_STEP_PX = 27;

/** Invisible proximity cushion around the top-right Star trigger (no click-stealing div) */
const STAR_HALO_PX = 52;
/** Expanded L-shape safe bounding box so diagonal aim toward Delete never collapses */
const EXPANDED_ZONE_X_PX = 96;
const EXPANDED_ZONE_Y_PX = 72;
const CLOSE_GRACE_MS = 110;

const OPEN_EASE = [0.22, 0.9, 0.3, 1] as const;
const CLOSE_EASE = [0.4, 0, 0.2, 1] as const;

export function useActionDrawerHover(onOpen: () => void) {
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overButtonRef = useRef(false);
  const focusInsideRef = useRef(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const setExpandedSync = useCallback(
    (next: boolean) => {
      if (next === expandedRef.current) return;
      expandedRef.current = next;
      setExpanded(next);
      if (next) onOpen();
    },
    [onOpen],
  );

  const scheduleClose = useCallback(() => {
    if (overButtonRef.current || focusInsideRef.current) return;
    if (closeTimerRef.current) return;
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      if (!overButtonRef.current && !focusInsideRef.current) {
        setExpandedSync(false);
      }
    }, CLOSE_GRACE_MS);
  }, [setExpandedSync]);

  const handleCardPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const distRight = rect.right - event.clientX;
      const distTop = event.clientY - rect.top;

      if (!expandedRef.current) {
        if (
          distRight >= 0 &&
          distRight <= STAR_HALO_PX &&
          distTop >= 0 &&
          distTop <= STAR_HALO_PX
        ) {
          clearCloseTimer();
          setExpandedSync(true);
        }
        return;
      }

      const insideSafeZone =
        distRight >= -6 &&
        distRight <= EXPANDED_ZONE_X_PX &&
        distTop >= -6 &&
        distTop <= EXPANDED_ZONE_Y_PX;

      if (insideSafeZone) {
        clearCloseTimer();
      } else {
        scheduleClose();
      }
    },
    [clearCloseTimer, scheduleClose, setExpandedSync],
  );

  const handleCardPointerLeave = useCallback(() => {
    clearCloseTimer();
    overButtonRef.current = false;
    if (!focusInsideRef.current) {
      setExpandedSync(false);
    }
  }, [clearCloseTimer, setExpandedSync]);

  const handleEnterButton = useCallback(() => {
    overButtonRef.current = true;
    clearCloseTimer();
    setExpandedSync(true);
  }, [clearCloseTimer, setExpandedSync]);

  const handleLeaveButton = useCallback(() => {
    overButtonRef.current = false;
    scheduleClose();
  }, [scheduleClose]);

  const handleFocusWithin = useCallback(() => {
    focusInsideRef.current = true;
    clearCloseTimer();
    setExpandedSync(true);
  }, [clearCloseTimer, setExpandedSync]);

  const handleBlurWithin = useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
        return;
      }
      focusInsideRef.current = false;
      clearCloseTimer();
      if (!overButtonRef.current) {
        setExpandedSync(false);
      }
    },
    [clearCloseTimer, setExpandedSync],
  );

  const collapseNow = useCallback(() => {
    clearCloseTimer();
    overButtonRef.current = false;
    focusInsideRef.current = false;
    setExpandedSync(false);
  }, [clearCloseTimer, setExpandedSync]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  return {
    expanded,
    handleCardPointerMove,
    handleCardPointerLeave,
    handleEnterButton,
    handleLeaveButton,
    handleFocusWithin,
    handleBlurWithin,
    collapseNow,
  };
}

export type ActionDrawerHoverController = ReturnType<
  typeof useActionDrawerHover
>;

interface CardActionDrawerProps {
  linkTitle: string;
  starred: boolean;
  checked: boolean;
  motionMode: MotionMode;
  drawer: ActionDrawerHoverController;
  onToggleChecked: () => void;
  onToggleStar: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Mechanical L-shaped card action drawer:
 * - Card hover reveals only the anchored top-right Star button.
 * - Entering Star's proximity halo cascades Edit → Done outward to the left
 *   from underneath Star/each other, then drops Delete straight below Star.
 * - Leaving reverses the fold cleanly (Delete up first, then Done/Edit under Star).
 */
export function CardActionDrawer({
  linkTitle,
  starred,
  checked,
  motionMode,
  drawer,
  onToggleChecked,
  onToggleStar,
  onEdit,
  onDelete,
}: CardActionDrawerProps) {
  const {
    expanded,
    handleEnterButton: onEnterButton,
    handleLeaveButton: onLeaveButton,
    handleFocusWithin: onFocusWithin,
    handleBlurWithin: onBlurWithin,
    collapseNow: onCollapse,
  } = drawer;
  const tactile = isTactileMotion(motionMode);

  const editTransition = tactile
    ? expanded
      ? { duration: 0.18, delay: 0, ease: OPEN_EASE }
      : { duration: 0.14, delay: 0.085, ease: CLOSE_EASE }
    : { duration: 0.05 };

  const doneTransition = tactile
    ? expanded
      ? { duration: 0.19, delay: 0.075, ease: OPEN_EASE }
      : { duration: 0.14, delay: 0.05, ease: CLOSE_EASE }
    : { duration: 0.05 };

  const deleteTransition = tactile
    ? expanded
      ? { duration: 0.19, delay: 0.22, ease: OPEN_EASE }
      : { duration: 0.12, delay: 0, ease: CLOSE_EASE }
    : { duration: 0.05 };

  const hiddenButtonClass = expanded
    ? 'pointer-events-auto'
    : 'pointer-events-none';

  return (
    <div
      role="toolbar"
      aria-label={`Actions for ${linkTitle}`}
      data-dnd-no-drag="true"
      onPointerDown={(event) => event.stopPropagation()}
      onFocus={onFocusWithin}
      onBlur={onBlurWithin}
      className={cn(
        'pointer-events-none absolute right-1.5 top-1.5 z-20 h-7 w-7 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100',
        expanded && 'opacity-100',
      )}
    >
      {/* Stage 1b: Done — slides furthest left from underneath Edit */}
      <motion.button
        type="button"
        initial={false}
        animate={
          expanded
            ? { x: -SLOT_STEP_PX * 2, opacity: 1, scale: 1 }
            : { x: 0, opacity: 0, scale: 0.88 }
        }
        transition={doneTransition}
        tabIndex={expanded ? 0 : -1}
        onPointerEnter={onEnterButton}
        onPointerLeave={onLeaveButton}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleChecked();
        }}
        aria-pressed={checked}
        aria-label={
          checked
            ? `Uncheck ${linkTitle}`
            : `Mark ${linkTitle} as done / bought`
        }
        title={checked ? 'Unmark done / bought' : 'Mark as done / bought'}
        className={cn(
          'absolute right-0 top-0 z-10 inline-flex h-7 w-7 items-center justify-center rounded-l-control border border-border/85 bg-panel/95 shadow-md transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 cursor-pointer will-change-transform',
          checked ? 'text-accent' : 'text-fg-muted hover:text-accent',
          hiddenButtonClass,
        )}
      >
        <Check
          className={cn('h-3.5 w-3.5', checked && 'stroke-[2.8] text-accent')}
        />
      </motion.button>

      {/* Stage 1a: Edit — slides left directly from underneath Star */}
      <motion.button
        type="button"
        initial={false}
        animate={
          expanded
            ? { x: -SLOT_STEP_PX, opacity: 1, scale: 1 }
            : { x: 0, opacity: 0, scale: 0.9 }
        }
        transition={editTransition}
        tabIndex={expanded ? 0 : -1}
        onPointerEnter={onEnterButton}
        onPointerLeave={onLeaveButton}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onEdit();
        }}
        aria-label={`Edit ${linkTitle}`}
        title="Quick edit (or right-click card)"
        className={cn(
          'absolute right-0 top-0 z-20 inline-flex h-7 w-7 items-center justify-center border border-border/85 bg-panel/95 text-fg-muted shadow-md transition-colors hover:bg-card hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 cursor-pointer will-change-transform',
          hiddenButtonClass,
        )}
      >
        <Pencil className="h-3.5 w-3.5" />
      </motion.button>

      {/* Stage 2: Delete — drops straight down under Star once horizontal cascade finishes */}
      <motion.button
        type="button"
        initial={false}
        animate={
          expanded
            ? { y: SLOT_STEP_PX, opacity: 1, scale: 1 }
            : { y: 0, opacity: 0, scale: 0.88 }
        }
        transition={deleteTransition}
        tabIndex={expanded ? 0 : -1}
        onPointerEnter={onEnterButton}
        onPointerLeave={onLeaveButton}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onCollapse();
          onDelete();
        }}
        aria-label={`Delete ${linkTitle}`}
        title="Delete link (Undo available)"
        className={cn(
          'absolute right-0 top-0 z-10 inline-flex h-7 w-7 items-center justify-center rounded-b-control border border-border/85 bg-panel/95 text-fg-muted shadow-md transition-colors hover:bg-danger/15 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60 cursor-pointer will-change-transform',
          hiddenButtonClass,
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </motion.button>

      {/* Anchor: Star — always on top (z-30), sole icon visible on initial card hover */}
      <button
        type="button"
        onPointerEnter={onEnterButton}
        onPointerLeave={onLeaveButton}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleStar();
        }}
        aria-pressed={starred}
        aria-label={starred ? `Unstar ${linkTitle}` : `Star ${linkTitle}`}
        title={starred ? 'Remove star' : 'Star link'}
        className={cn(
          'pointer-events-auto relative z-30 inline-flex h-7 w-7 items-center justify-center border border-border/85 bg-panel/95 shadow-md transition-[color,background-color,border-radius] duration-150 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 cursor-pointer',
          expanded ? 'rounded-tr-control' : 'rounded-control',
          starred ? 'text-accent' : 'text-fg-muted hover:text-accent',
        )}
      >
        <motion.span
          key={starred ? 'starred' : 'unstarred'}
          initial={tactile && starred ? { scale: 0.55, rotate: -32 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={
            tactile
              ? {
                  type: 'spring',
                  stiffness: 620,
                  damping: 16,
                  mass: 0.55,
                }
              : { duration: 0.05 }
          }
          className="inline-flex items-center justify-center"
        >
          <Star
            className={cn('h-3.5 w-3.5', starred && 'fill-accent text-accent')}
          />
        </motion.span>
      </button>
    </div>
  );
}
