import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type AutoTagProgress,
  runBatchAutoTagSweep,
} from '@/lib/tagging/auto-tagger';

export interface AutoTagSweepController {
  running: boolean;
  progress: AutoTagProgress | null;
  start: () => Promise<void>;
  cancel: () => void;
}

export function useAutoTagSweep(collectionId?: string): AutoTagSweepController {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<AutoTagProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const start = useCallback(async () => {
    if (running) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setProgress(null);

    try {
      const result = await runBatchAutoTagSweep({
        collectionId,
        signal: controller.signal,
        onProgress: setProgress,
      });

      if (result.status === 'unavailable') {
        toast.info(
          'On-device Gemini Nano is unavailable in this browser right now.',
        );
        return;
      }

      if (result.status === 'canceled') {
        toast.info(
          result.tagged > 0
            ? `Auto-Tag canceled (${result.tagged} link${result.tagged === 1 ? '' : 's'} tagged)`
            : 'Auto-Tag canceled',
        );
        return;
      }

      if (result.tagged > 0) {
        toast.success(
          `Auto-tagged ${result.tagged} of ${result.total} link${result.total === 1 ? '' : 's'}`,
        );
      } else {
        toast.info('No new tags were added.');
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
      setProgress(null);
    }
  }, [collectionId, running]);

  return { running, progress, start, cancel };
}
