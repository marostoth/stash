import { Pencil, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { isTactileMotion } from '@/lib/motion/presets';
import type { MotionMode } from '@/lib/types/stash';

interface CardActionDrawerProps {
  linkTitle: string;
  motionMode: MotionMode;
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
 * Single continuous vertical hover container (zero dead gap between Edit and
 * Trash): hovering the card shows Edit; hovering Edit smoothly springs Trash
 * out directly underneath it while suppressing the card preview popover.
 */
export function CardActionDrawer({
  linkTitle,
  motionMode,
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
      className="absolute right-2 top-2 z-20 flex flex-col items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
    >
      <div className="flex flex-col overflow-hidden rounded-control border border-border/80 bg-panel/95 shadow-md backdrop-blur-xs">
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
                className="inline-flex h-7 w-7 items-center justify-center text-fg-muted transition-colors hover:bg-danger/15 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60 cursor-pointer"
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
