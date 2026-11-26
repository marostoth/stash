import { Pencil, Star, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { isTactileMotion } from '@/lib/motion/presets';
import type { MotionMode } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface CardActionDrawerProps {
  linkTitle: string;
  starred: boolean;
  motionMode: MotionMode;
  onToggleStar: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEnterDrawer: () => void;
}

const DRAWER_SPRING = {
  type: 'spring' as const,
  stiffness: 560,
  damping: 32,
  mass: 0.6,
};

/**
 * Continuous hover drawer: hovering the card reveals the horizontal
 * [Star][Edit] pill; moving onto the pill smoothly springs Delete directly
 * underneath while suppressing the card preview popover.
 */
export function CardActionDrawer({
  linkTitle,
  starred,
  motionMode,
  onToggleStar,
  onEdit,
  onDelete,
  onEnterDrawer,
}: CardActionDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const tactile = isTactileMotion(motionMode);

  return (
    <div
      data-dnd-no-drag="true"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerEnter={() => {
        onEnterDrawer();
        setExpanded(true);
      }}
      onPointerLeave={() => setExpanded(false)}
      className="absolute right-1.5 top-1.5 z-20 flex flex-col items-end opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
    >
      <div className="flex flex-col overflow-hidden rounded-control border border-border/80 bg-panel/95 shadow-md">
        <div className="flex items-center">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleStar();
            }}
            aria-pressed={starred}
            aria-label={starred ? `Unstar ${linkTitle}` : `Star ${linkTitle}`}
            title={starred ? 'Remove star' : 'Star link'}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center border-r border-border/70 transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 cursor-pointer',
              starred ? 'text-accent' : 'text-fg-muted hover:text-accent',
            )}
          >
            <motion.span
              key={starred ? 'starred' : 'unstarred'}
              initial={
                tactile && starred ? { scale: 0.55, rotate: -32 } : false
              }
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
                className={cn(
                  'h-3.5 w-3.5',
                  starred && 'fill-accent text-accent',
                )}
              />
            </motion.span>
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEdit();
            }}
            aria-label={`Edit ${linkTitle}`}
            title="Quick edit (or right-click card)"
            className="inline-flex h-7 w-7 items-center justify-center text-fg-muted transition-colors hover:bg-card hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="delete-slot"
              initial={
                tactile
                  ? { height: 0, opacity: 0, y: -4 }
                  : { height: 'auto', opacity: 1 }
              }
              animate={{ height: 'auto', opacity: 1, y: 0 }}
              exit={
                tactile
                  ? { height: 0, opacity: 0, y: -4 }
                  : { height: 0, opacity: 0 }
              }
              transition={tactile ? DRAWER_SPRING : { duration: 0.05 }}
              className="overflow-hidden border-t border-border/70"
            >
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setExpanded(false);
                  onDelete();
                }}
                aria-label={`Delete ${linkTitle}`}
                title="Delete link (Undo available)"
                className="inline-flex h-7 w-full items-center justify-center text-fg-muted transition-colors hover:bg-danger/15 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
