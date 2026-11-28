const STORAGE_LOCK_NAME = 'stash_storage_write_lock';

let inProcessTail: Promise<void> = Promise.resolve();

/**
 * Serializes read-modify-write storage mutations across all extension contexts
 * (multiple New Tabs, Side Panel, and background service worker) using the Web
 * Locks API when available, falling back to an in-process promise queue in
 * test/non-browser environments.
 *
 * IMPORTANT: Only call from top-level `stashRepo` mutating entrypoints to avoid
 * nested re-entrant lock acquisition.
 */
export function withStorageLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (locks && typeof locks.request === 'function') {
    return locks.request(STORAGE_LOCK_NAME, () => task());
  }

  const run = inProcessTail.then(task, task);
  inProcessTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
