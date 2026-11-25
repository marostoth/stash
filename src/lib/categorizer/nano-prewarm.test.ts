import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acquireWarmNanoSession,
  disposeWarmNanoSession,
  prewarmNanoCategorizer,
  releaseWarmNanoSession,
  WARM_SESSION_IDLE_MS,
} from '@/lib/categorizer/nano-prewarm';

interface FakeDocumentHarness {
  hidden: boolean;
  setHidden: (nextHidden: boolean) => void;
  listenerCount: () => number;
  restore: () => void;
}

function installFakeDocument(): FakeDocumentHarness {
  const original = (globalThis as Record<string, unknown>).document;
  const listeners = new Set<() => void>();
  const fakeDoc = {
    hidden: false,
    addEventListener(type: string, cb: () => void) {
      if (type === 'visibilitychange') listeners.add(cb);
    },
    removeEventListener(type: string, cb: () => void) {
      if (type === 'visibilitychange') listeners.delete(cb);
    },
  };

  Object.defineProperty(globalThis, 'document', {
    value: fakeDoc,
    configurable: true,
    writable: true,
  });

  return {
    get hidden() {
      return fakeDoc.hidden;
    },
    setHidden(nextHidden: boolean) {
      fakeDoc.hidden = nextHidden;
      for (const listener of Array.from(listeners)) {
        listener();
      }
    },
    listenerCount: () => listeners.size,
    restore() {
      if (original === undefined) {
        delete (globalThis as Record<string, unknown>).document;
      } else {
        Object.defineProperty(globalThis, 'document', {
          value: original,
          configurable: true,
          writable: true,
        });
      }
    },
  };
}

describe('nano-prewarm lifecycle & VRAM hygiene', () => {
  let docHarness: FakeDocumentHarness;
  let destroySpy: ReturnType<typeof vi.fn>;
  let createSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    docHarness = installFakeDocument();
    destroySpy = vi.fn();
    createSpy = vi.fn().mockImplementation(async () => ({
      prompt: vi.fn().mockResolvedValue('{}'),
      destroy: destroySpy,
    }));

    Object.defineProperty(globalThis, 'LanguageModel', {
      value: {
        availability: vi.fn().mockResolvedValue('available'),
        create: createSpy,
        params: vi.fn().mockResolvedValue({
          defaultTopK: 3,
          maxTopK: 128,
          defaultTemperature: 1,
          maxTemperature: 2,
        }),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    disposeWarmNanoSession();
    delete (globalThis as Record<string, unknown>).LanguageModel;
    docHarness.restore();
    vi.useRealTimers();
  });

  it('destroys an idle warm session automatically after 60s', async () => {
    const session = await prewarmNanoCategorizer(true);
    expect(session).not.toBeNull();
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(destroySpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(WARM_SESSION_IDLE_MS - 100);
    expect(destroySpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(docHarness.listenerCount()).toBe(0);
  });

  it('destroys an idle warm session immediately when the document becomes hidden', async () => {
    const session = await prewarmNanoCategorizer(true);
    expect(session).not.toBeNull();
    expect(docHarness.listenerCount()).toBe(1);

    docHarness.setHidden(true);
    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(docHarness.listenerCount()).toBe(0);

    // Pre-warming while hidden is a no-op
    const hiddenAttempt = await prewarmNanoCategorizer(true);
    expect(hiddenAttempt).toBeNull();
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('protects an actively borrowed session until released, then destroys if hidden', async () => {
    await prewarmNanoCategorizer(true);
    const borrowed = await acquireWarmNanoSession();
    expect(borrowed).not.toBeNull();

    // Going hidden or waiting past 60s does not destroy while borrowed
    docHarness.setHidden(true);
    vi.advanceTimersByTime(WARM_SESSION_IDLE_MS * 2);
    expect(destroySpy).not.toHaveBeenCalled();

    // Once released while document is hidden, it is destroyed immediately
    releaseWarmNanoSession(borrowed);
    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(docHarness.listenerCount()).toBe(0);
  });

  it('deduplicates concurrent pre-warm calls into a single session and disposes cleanly', async () => {
    const [first, second] = await Promise.all([
      prewarmNanoCategorizer(true),
      prewarmNanoCategorizer(true),
    ]);
    expect(first).toBe(second);
    expect(createSpy).toHaveBeenCalledTimes(1);

    disposeWarmNanoSession();
    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(docHarness.listenerCount()).toBe(0);
  });
});
