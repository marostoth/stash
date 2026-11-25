import { useCallback } from 'react';
import { startAutoTagSweep } from '@/lib/jobs/background-sweeps';
import type { AutoTagProgress } from '@/lib/tagging/auto-tagger';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';

export interface AutoTagSweepController {
  running: boolean;
  progress: AutoTagProgress | null;
  start: () => Promise<void>;
  cancel: () => void;
}

export function useAutoTagSweep(collectionId?: string): AutoTagSweepController {
  const job = useBackgroundJobsStore((s) =>
    s.jobs.find((item) => item.id === 'auto-tag'),
  );
  const cancelJob = useBackgroundJobsStore((s) => s.cancelJob);

  const matchesScope =
    job?.status === 'running' &&
    (collectionId === undefined
      ? job.scopeId === undefined
      : job.scopeId === collectionId);

  const progress: AutoTagProgress | null =
    matchesScope && job.progress
      ? {
          current: job.progress.current,
          total: job.progress.total,
          tagged: 0,
        }
      : null;

  const start = useCallback(async () => {
    await startAutoTagSweep(collectionId);
  }, [collectionId]);

  const cancel = useCallback(() => {
    cancelJob('auto-tag');
  }, [cancelJob]);

  return {
    running: Boolean(matchesScope),
    progress,
    start,
    cancel,
  };
}
