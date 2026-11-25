import { Loader2, Minimize2, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

const SKELETON_ROW_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6'] as const;

interface AiActivityPanelProps {
  title: string;
  subtitle?: string;
  progress?: { current: number; total: number } | null;
  showElapsed?: boolean;
  skeletonRows?: number;
  cancelLabel?: string;
  onCancel?: () => void;
  onMinimize?: () => void;
  className?: string;
}

/**
 * Theme-matched AI & scanning activity panel with either a determinate progress
 * bar or an indeterminate phosphor sweep, optional elapsed-seconds counter,
 * pulsing skeleton rows, and clean Minimize / Cancel controls.
 */
export function AiActivityPanel({
  title,
  subtitle,
  progress,
  showElapsed = false,
  skeletonRows = 0,
  cancelLabel = 'Cancel',
  onCancel,
  onMinimize,
  className,
}: AiActivityPanelProps) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!showElapsed) return;
    setElapsedSec(0);
    const id = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [showElapsed]);

  const hasDeterminate =
    progress !== null && progress !== undefined && progress.total > 0;
  const pct = hasDeterminate
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative overflow-hidden rounded-card border border-accent/40 bg-canvas p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-accent/35 bg-accent/10 text-accent">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-fg">{title}</span>
              {showElapsed && elapsedSec > 0 ? (
                <span className="rounded-pill border border-border bg-panel px-1.5 py-0.25 font-mono text-[10px] text-fg-muted">
                  {elapsedSec}s
                </span>
              ) : null}
            </div>
            {subtitle ? (
              <p className="truncate font-mono text-[11px] text-fg-muted">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hasDeterminate ? (
            <span className="font-mono text-[11px] font-medium text-accent">
              {pct}%
            </span>
          ) : (
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-accent" />
          )}
          {onMinimize ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMinimize}
              title="Minimize to bottom-right activity tray"
              className="h-7 gap-1 px-2 text-[11px] text-fg-muted hover:text-fg"
            >
              <Minimize2 className="h-3 w-3" />
              Minimize
            </Button>
          ) : null}
          {onCancel ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-7 gap-1 px-2 text-[11px] text-fg-muted hover:text-danger"
            >
              <X className="h-3 w-3" />
              {cancelLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Progress / Indeterminate Sweep Bar */}
      <div className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-panel">
        {hasDeterminate ? (
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-150"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="stash-indeterminate-bar h-full rounded-full" />
        )}
      </div>

      {/* Optional Skeleton Preview Rows */}
      {skeletonRows > 0 ? (
        <div className="mt-3.5 space-y-2" aria-hidden="true">
          {SKELETON_ROW_KEYS.slice(0, skeletonRows).map((rowKey, idx) => (
            <div
              key={rowKey}
              style={{ animationDelay: `${idx * 140}ms` }}
              className="stash-skeleton-row flex items-center gap-3 rounded-control border border-border/60 bg-panel/60 px-3 py-2"
            >
              <div className="h-4 w-4 shrink-0 rounded bg-border/80" />
              <div className="h-2.5 w-28 rounded bg-border/80" />
              <div className="h-2 flex-1 rounded bg-border/50" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface InlineProgressPillProps {
  label: string;
  current: number;
  total: number;
  onCancel: () => void;
  className?: string;
}

/**
 * Compact spinning progress pill with bottom accent bar for Auto-Tag sweeps.
 */
export function InlineProgressPill({
  label,
  current,
  total,
  onCancel,
  className,
}: InlineProgressPillProps) {
  const pct =
    total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'relative inline-flex h-7 items-center gap-1.5 overflow-hidden rounded-control border border-accent/45 bg-panel px-2 font-mono text-[11px] text-fg',
        className,
      )}
    >
      <Loader2 className="h-3 w-3 shrink-0 animate-spin text-accent" />
      <span>{label}</span>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel operation"
        title="Cancel"
        className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-fg-muted transition-colors hover:bg-card hover:text-danger cursor-pointer"
      >
        <X className="h-3 w-3" />
        Cancel
      </button>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-border/40"
      >
        <div
          className="h-full bg-accent transition-[width] duration-150"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
