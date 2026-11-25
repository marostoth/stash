import {
  checkNanoAvailability,
  createNanoCategorizerSession,
  type NanoCategorizerSession,
} from '@/lib/categorizer/nano-engine';

export const WARM_SESSION_IDLE_MS = 60_000;

let warmSession: NanoCategorizerSession | null = null;
let inFlightWarmup: Promise<NanoCategorizerSession | null> | null = null;
let activeBorrowers = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let visibilityListenerAttached = false;

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden === true;
}

function clearIdleTimer(): void {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function handleVisibilityChange(): void {
  if (isDocumentHidden() && activeBorrowers === 0) {
    destroyWarmSessionNow();
  }
}

function attachVisibilityListener(): void {
  if (visibilityListenerAttached || typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', handleVisibilityChange);
  visibilityListenerAttached = true;
}

function detachVisibilityListener(): void {
  if (!visibilityListenerAttached || typeof document === 'undefined') return;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  visibilityListenerAttached = false;
}

function destroyWarmSessionNow(): void {
  clearIdleTimer();
  detachVisibilityListener();
  if (warmSession) {
    const target = warmSession;
    warmSession = null;
    target.destroy();
  }
}

function scheduleIdleCleanup(): void {
  clearIdleTimer();
  if (!warmSession || activeBorrowers > 0) return;
  if (isDocumentHidden()) {
    destroyWarmSessionNow();
    return;
  }
  attachVisibilityListener();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (activeBorrowers === 0 && warmSession) {
      destroyWarmSessionNow();
    }
  }, WARM_SESSION_IDLE_MS);
}

/**
 * Single-flight pre-warmer for Chrome's built-in Gemini Nano categorizer.
 * Quietly prepares ONE reusable base session when `enableOnDeviceAi` is on and
 * the model is already `'available'` (never triggers downloads outside gestures
 * and never pre-warms while the document is hidden).
 */
export async function prewarmNanoCategorizer(
  enableOnDeviceAi: boolean,
): Promise<NanoCategorizerSession | null> {
  if (!enableOnDeviceAi || isDocumentHidden()) return null;
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
      if (status !== 'available' || isDocumentHidden()) return null;
      const created = await createNanoCategorizerSession();
      if (!created) return null;
      if (isDocumentHidden() && activeBorrowers === 0) {
        created.destroy();
        return null;
      }
      warmSession = created;
      attachVisibilityListener();
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
 * (or destroys immediately when `destroyIfIdle` is true or the page is hidden).
 */
export function releaseWarmNanoSession(
  session: NanoCategorizerSession | null,
  destroyIfIdle = false,
): void {
  if (!session || session !== warmSession) return;
  activeBorrowers = Math.max(0, activeBorrowers - 1);

  if (activeBorrowers === 0) {
    if (destroyIfIdle || isDocumentHidden()) {
      destroyWarmSessionNow();
    } else {
      scheduleIdleCleanup();
    }
  }
}

/**
 * Immediately destroys an idle pre-warmed Nano session (e.g. on view unmount
 * or modal close).
 */
export function disposeWarmNanoSession(): void {
  clearIdleTimer();
  if (activeBorrowers === 0) {
    destroyWarmSessionNow();
  }
}
