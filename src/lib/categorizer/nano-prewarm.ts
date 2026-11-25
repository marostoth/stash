import {
  checkNanoAvailability,
  createNanoCategorizerSession,
  type NanoCategorizerSession,
} from '@/lib/categorizer/nano-engine';

const WARM_SESSION_IDLE_MS = 60_000;

let warmSession: NanoCategorizerSession | null = null;
let inFlightWarmup: Promise<NanoCategorizerSession | null> | null = null;
let activeBorrowers = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function clearIdleTimer(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function scheduleIdleCleanup(): void {
  clearIdleTimer();
  if (!warmSession || activeBorrowers > 0) return;
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (activeBorrowers === 0 && warmSession) {
      warmSession.destroy();
      warmSession = null;
    }
  }, WARM_SESSION_IDLE_MS);
}

/**
 * Single-flight pre-warmer for Chrome's built-in Gemini Nano categorizer.
 * Quietly prepares ONE reusable base session when `enableOnDeviceAi` is on and
 * the model is already `'available'` (never triggers downloads outside gestures).
 */
export async function prewarmNanoCategorizer(
  enableOnDeviceAi: boolean,
): Promise<NanoCategorizerSession | null> {
  if (!enableOnDeviceAi) return null;
  if (warmSession) {
    scheduleIdleCleanup();
    return warmSession;
  }
  if (inFlightWarmup) {
    return inFlightWarmup;
  }

  inFlightWarmup = (async () => {
    try {
      const status = await checkNanoAvailability();
      if (status !== 'available') return null;
      const created = await createNanoCategorizerSession();
      if (!created) return null;
      warmSession = created;
      scheduleIdleCleanup();
      return created;
    } catch {
      return null;
    } finally {
      inFlightWarmup = null;
    }
  })();

  return inFlightWarmup;
}

/**
 * Borrows the pre-warmed base Nano session (awaiting an in-flight warmup if one
 * is running). Callers MUST pair every non-null result with `releaseWarmNanoSession`.
 */
export async function acquireWarmNanoSession(
  signal?: AbortSignal,
): Promise<NanoCategorizerSession | null> {
  if (signal?.aborted) return null;

  const session = warmSession ?? (inFlightWarmup ? await inFlightWarmup : null);
  if (!session || signal?.aborted || session !== warmSession) {
    return null;
  }

  clearIdleTimer();
  activeBorrowers += 1;
  return session;
}

/**
 * Releases a borrowed warm Nano session and arms the 60s idle cleanup timer
 * (or destroys immediately when `destroyIfIdle` is true).
 */
export function releaseWarmNanoSession(
  session: NanoCategorizerSession | null,
  destroyIfIdle = false,
): void {
  if (!session || session !== warmSession) return;
  activeBorrowers = Math.max(0, activeBorrowers - 1);

  if (activeBorrowers === 0) {
    if (destroyIfIdle) {
      clearIdleTimer();
      warmSession.destroy();
      warmSession = null;
    } else {
      scheduleIdleCleanup();
    }
  }
}

/**
 * Immediately destroys an idle pre-warmed Nano session (e.g. on view unmount).
 */
export function disposeWarmNanoSession(): void {
  clearIdleTimer();
  if (activeBorrowers === 0 && warmSession) {
    warmSession.destroy();
    warmSession = null;
  }
}
