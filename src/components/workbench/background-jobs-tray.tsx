import { ArrowUpRight, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';
import { isTactileMotion, TACTILE_SPRING } from '@/lib/motion/physics';
import type { MotionMode } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import {
  type BackgroundJob,
  isJobVisibleInTray,
  useBackgroundJobsStore,
} from '@/store/background-jobs-store';
import { useUiStore } from '@/store/ui-store';

interface BackgroundJobsTrayProps {
  motionMode: MotionMode;
}

function JobTrayCard({
  job,
  tactile,
}: {
  job: BackgroundJob;
  tactile: boolean;
}) {
  const removeJob = useBackgroundJobsStore((s) => s.removeJob);
  const cancelJob = useBackgroundJobsStore((s) => s.cancelJob);

  const isReady = job.status === 'ready';
  const hasDeterminate =
    job.progress !== null &&
    job.progress !== undefined &&
    job.progress.total > 0;
  const pct =
    hasDeterminate && job.progress
      ? Math.min(
          100,
          Math.round((job.progress.current / job.progress.total) * 100),
        )
      : null;

  const handleOpen = () => {
    job.onReopen?.();
    if (isReady) {
      removeJob(job.id);
    }
  };

  const handleCloseOrCancel = () => {
    if (isReady) {
      removeJob(job.id);
    } else {
      cancelJob(job.id);
    }
  };

  return (
    <motion.div
      layout={tactile}
      initial={tactile ? { opacity: 0, y: 12, scale: 0.96 } : { opacity: 0 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={tactile ? { opacity: 0, y: 8, scale: 0.96 } : { opacity: 0 }}
      transition={tactile ? TACTILE_SPRING : { duration: 0.12 }}
      role="status"
      aria-live="polite"
      className={cn(
        'relative overflow-hidden rounded-card border bg-panel/95 px-3 py-2.5 shadow-xl backdrop-blur-md',
        isReady ? 'border-accent/65' : 'border-border',
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-border bg-canvas">
          {isReady ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
          ) : job.usesNano ? (
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-accent" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-semibold text-fg">
              {job.title}
            </span>
            {pct !== null && !isReady ? (
              <span className="shrink-0 font-mono text-[10px] text-accent">
                {pct}%
              </span>
            ) : null}
          </div>
          {job.detail ? (
            <p className="truncate font-mono text-[10px] text-fg-muted">
              {job.detail}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {job.onReopen ? (
            <button
              type="button"
              onClick={handleOpen}
              className={cn(
                'inline-flex h-6 items-center gap-0.5 rounded-control border px-2 font-mono text-[10px] font-medium transition-colors cursor-pointer',
                isReady
                  ? 'border-accent/60 bg-accent/15 text-accent hover:bg-accent/25'
                  : 'border-border bg-canvas text-fg-muted hover:border-accent/45 hover:text-fg',
              )}
              title={isReady ? 'Open results to review' : 'Expand window'}
            >
              <span>{job.reopenLabel ?? (isReady ? 'Review' : 'Open')}</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          ) : null}

          {job.onCancel || isReady ? (
            <button
              type="button"
              onClick={handleCloseOrCancel}
              aria-label={
                isReady ? `Dismiss ${job.title}` : `Cancel ${job.title}`
              }
              title={isReady ? 'Dismiss' : 'Cancel task'}
              className="inline-flex h-6 w-6 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-card hover:text-danger cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Bottom progress strip */}
      {!isReady ? (
        <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-border/60">
          {pct !== null ? (
            <div
              className="h-full bg-accent transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          ) : (
            <div className="stash-indeterminate-bar h-full rounded-full" />
          )}
        </div>
      ) : null}
    </motion.div>
  );
}

export function BackgroundJobsTray({ motionMode }: BackgroundJobsTrayProps) {
  const jobs = useBackgroundJobsStore((s) => s.jobs);
  const setTrayHeightPx = useBackgroundJobsStore((s) => s.setTrayHeightPx);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const healthCheckOpen = useUiStore((s) => s.healthCheckOpen);
  const reorganizeOpen = useUiStore((s) => s.reorganizeOpen);
  const triageOpen = useUiStore((s) => s.triageOpen);

  const trayRef = useRef<HTMLElement | null>(null);
  const tactile = isTactileMotion(motionMode);

  const visibleJobs = useMemo(
    () =>
      jobs.filter((job) =>
        isJobVisibleInTray(job, {
          settingsOpen,
          healthCheckOpen,
          reorganizeOpen,
          triageOpen,
        }),
      ),
    [jobs, settingsOpen, healthCheckOpen, reorganizeOpen, triageOpen],
  );

  useEffect(() => {
    const el = trayRef.current;
    if (!el || visibleJobs.length === 0) {
      setTrayHeightPx(0);
      return;
    }

    const measure = () => {
      setTrayHeightPx(Math.ceil(el.getBoundingClientRect().height));
    };
    measure();

    if (typeof ResizeObserver === 'undefined') {
      return () => setTrayHeightPx(0);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      setTrayHeightPx(0);
    };
  }, [visibleJobs.length, setTrayHeightPx]);

  if (visibleJobs.length === 0) {
    return null;
  }

  return (
    <section
      ref={trayRef}
      aria-label="Background activity"
      className="fixed bottom-12 right-4 z-40 flex w-[304px] max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {visibleJobs.map((job) => (
          <JobTrayCard key={job.id} job={job} tactile={tactile} />
        ))}
      </AnimatePresence>
    </section>
  );
}
