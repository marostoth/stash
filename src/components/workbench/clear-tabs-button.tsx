import { Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { playDelete } from '@/lib/audio/foley';
import {
  isArcadeMotion,
  isTactileMotion,
  TACTILE_SPRING,
} from '@/lib/motion/physics';
import { formatClearTabsToast } from '@/lib/tabs/clearFilter';
import {
  executeClearWindowTabs,
  reopenTabSnapshots,
} from '@/lib/tabs/tab-actions';
import type { MotionMode } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { spawnBulkPulseForElement } from '@/lib/vfx/engine';
import { useFxStore } from '@/store/fx-store';

const ARM_DURATION_MS = 3000;
const REOPEN_TOAST_DURATION_MS = 8000;

interface ClearTabsButtonProps {
  clearableCount: number;
  soundEffects: boolean;
  motionMode: MotionMode;
  fxDeskJolt?: boolean;
  fxAmbientWaves?: boolean;
  disabled?: boolean;
}

export function ClearTabsButton({
  clearableCount,
  soundEffects,
  motionMode,
  fxDeskJolt = true,
  fxAmbientWaves = true,
  disabled = false,
}: ClearTabsButtonProps) {
  const triggerContainerShake = useFxStore((s) => s.triggerContainerShake);
  const triggerSidebarSweep = useFxStore((s) => s.triggerSidebarSweep);
  const [armed, setArmed] = useState(false);
  const [clearing, setClearing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarm = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setArmed(false);
  }, []);

  // Disarm automatically if no clearable tabs remain
  useEffect(() => {
    if (clearableCount === 0 && armed) {
      disarm();
    }
  }, [clearableCount, armed, disarm]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // Disarm on Escape or click-away while armed
  useEffect(() => {
    if (!armed) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        disarm();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !buttonRef.current?.contains(target)) {
        disarm();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [armed, disarm]);

  const handleClick = async () => {
    if (disabled || clearing || clearableCount === 0) return;

    if (!armed) {
      setArmed(true);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setArmed(false);
      }, ARM_DURATION_MS);
      return;
    }

    // Second click within arm window: execute clear immediately
    disarm();
    setClearing(true);
    try {
      const outcome = await executeClearWindowTabs();
      if (outcome.clearedCount === 0) {
        toast.info('No clearable tabs to close (pinned/audible kept).');
        return;
      }

      playDelete(soundEffects);
      if (isArcadeMotion(motionMode)) {
        if (fxDeskJolt) triggerContainerShake('heavy');
        if (fxAmbientWaves) {
          triggerSidebarSweep();
          spawnBulkPulseForElement(
            buttonRef.current?.closest('[data-stash-sidebar="open-tabs"]'),
            0,
          );
        }
      }

      const message = formatClearTabsToast(
        outcome.clearedCount,
        outcome.skippedPinnedCount,
        outcome.skippedAudibleCount,
      );
      const { restorableTabs } = outcome;

      const toastId = toast(message, {
        duration: REOPEN_TOAST_DURATION_MS,
        action:
          restorableTabs.length > 0
            ? {
                label: 'Reopen',
                onClick: () => {
                  toast.dismiss(toastId);
                  void reopenTabSnapshots(restorableTabs);
                },
              }
            : undefined,
      });
    } catch (error: unknown) {
      console.error('[Stash ClearTabs] Failed to clear tabs', error);
      toast.error('Could not clear open tabs.');
    } finally {
      setClearing(false);
    }
  };

  const isDisabled = disabled || clearing || clearableCount === 0;
  const tactile = isTactileMotion(motionMode);

  const tooltip =
    clearableCount === 0
      ? 'No clearable tabs (pinned and audible tabs are protected)'
      : armed
        ? `Click again to close ${clearableCount} ${clearableCount === 1 ? 'tab' : 'tabs'} (Esc to cancel)`
        : `Clear ${clearableCount} unpinned, silent ${clearableCount === 1 ? 'tab' : 'tabs'} (pinned and audible tabs are protected)`;

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      disabled={isDisabled}
      onClick={() => void handleClick()}
      onBlur={() => {
        if (armed) disarm();
      }}
      title={tooltip}
      aria-label={armed ? `Confirm clear ${clearableCount} tabs` : 'Clear Tabs'}
      animate={tactile ? { scale: armed ? 1.03 : 1 } : undefined}
      whileTap={tactile && !isDisabled ? { scale: 0.96 } : undefined}
      transition={tactile ? TACTILE_SPRING : { duration: 0 }}
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-control border px-1.5 font-mono text-[10px] font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-40 cursor-pointer',
        armed
          ? 'border-warning/70 bg-warning/15 text-danger hover:bg-warning/25'
          : 'border-transparent text-fg-muted hover:border-border hover:bg-card hover:text-fg',
      )}
    >
      <Trash2
        className={cn(
          'h-3 w-3 shrink-0',
          armed ? 'text-danger' : 'text-fg-muted',
        )}
      />
      <span>{armed ? `Clear ${clearableCount}?` : 'Clear Tabs'}</span>
    </motion.button>
  );
}
