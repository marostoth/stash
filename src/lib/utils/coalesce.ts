export interface VisibilityCoalescer {
  trigger: () => void;
  setHidden: (hidden: boolean) => void;
  cancel: () => void;
  isPending: () => boolean;
  isDirtyWhileHidden: () => boolean;
}

/**
 * Coalesces rapid bursts of events into a single trailing callback after
 * `delayMs` quiet time, and pauses execution while the document is hidden
 * (running once immediately upon becoming visible if anything changed).
 */
export function createVisibilityCoalescer(
  callback: () => void,
  delayMs = 200,
  initiallyHidden = false,
): VisibilityCoalescer {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hidden = initiallyHidden;
  let dirtyWhileHidden = false;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    trigger() {
      if (hidden) {
        clearTimer();
        dirtyWhileHidden = true;
        return;
      }

      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        if (hidden) {
          dirtyWhileHidden = true;
          return;
        }
        callback();
      }, delayMs);
    },

    setHidden(nextHidden: boolean) {
      if (hidden === nextHidden) return;
      hidden = nextHidden;

      if (hidden) {
        if (timer !== null) {
          clearTimer();
          dirtyWhileHidden = true;
        }
        return;
      }

      if (dirtyWhileHidden) {
        dirtyWhileHidden = false;
        clearTimer();
        callback();
      }
    },

    cancel() {
      clearTimer();
      dirtyWhileHidden = false;
    },

    isPending() {
      return timer !== null;
    },

    isDirtyWhileHidden() {
      return dirtyWhileHidden;
    },
  };
}

export interface DebouncedWriter<T> {
  schedule: (value: T) => void;
  flush: () => void;
  cancel: () => void;
  hasPending: () => boolean;
}

/**
 * Debounces rapid state writes (e.g. slider drags or stepper clicks) and
 * supports flushing the latest pending value immediately on unmount.
 */
export function createDebouncedWriter<T>(
  write: (value: T) => void,
  delayMs: number,
): DebouncedWriter<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hasValue = false;
  let pendingValue: T | undefined;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const flush = () => {
    clearTimer();
    if (!hasValue) return;
    const value = pendingValue as T;
    hasValue = false;
    pendingValue = undefined;
    write(value);
  };

  return {
    schedule(value: T) {
      pendingValue = value;
      hasValue = true;
      clearTimer();
      timer = setTimeout(flush, delayMs);
    },

    flush,

    cancel() {
      clearTimer();
      hasValue = false;
      pendingValue = undefined;
    },

    hasPending() {
      return hasValue;
    },
  };
}
