import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDebouncedWriter,
  createVisibilityCoalescer,
} from '@/lib/utils/coalesce';

describe('createVisibilityCoalescer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces a burst of tab events into a single trailing refresh', () => {
    const onRefresh = vi.fn();
    const coalescer = createVisibilityCoalescer(onRefresh, 200);

    for (let i = 0; i < 20; i++) {
      coalescer.trigger();
      vi.advanceTimersByTime(15);
    }

    expect(onRefresh).not.toHaveBeenCalled();
    expect(coalescer.isPending()).toBe(true);

    vi.advanceTimersByTime(200);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(coalescer.isPending()).toBe(false);
  });

  it('pauses refreshes while hidden and flushes once when visible again', () => {
    const onRefresh = vi.fn();
    const coalescer = createVisibilityCoalescer(onRefresh, 200);

    coalescer.setHidden(true);
    coalescer.trigger();
    coalescer.trigger();
    coalescer.trigger();

    vi.advanceTimersByTime(1000);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(coalescer.isDirtyWhileHidden()).toBe(true);

    coalescer.setHidden(false);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(coalescer.isDirtyWhileHidden()).toBe(false);

    // Returning to visible with no changes while hidden does not trigger extra calls
    coalescer.setHidden(true);
    coalescer.setHidden(false);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('pauses an already-pending timer when tab becomes hidden and flushes on return', () => {
    const onRefresh = vi.fn();
    const coalescer = createVisibilityCoalescer(onRefresh, 200);

    coalescer.trigger();
    vi.advanceTimersByTime(100);
    coalescer.setHidden(true);

    vi.advanceTimersByTime(500);
    expect(onRefresh).not.toHaveBeenCalled();
    expect(coalescer.isDirtyWhileHidden()).toBe(true);

    coalescer.setHidden(false);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('clears pending timers and dirty flags on cancel', () => {
    const onRefresh = vi.fn();
    const coalescer = createVisibilityCoalescer(onRefresh, 200);

    coalescer.trigger();
    coalescer.cancel();
    vi.advanceTimersByTime(500);
    expect(onRefresh).not.toHaveBeenCalled();

    coalescer.setHidden(true);
    coalescer.trigger();
    coalescer.cancel();
    coalescer.setHidden(false);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

describe('createDebouncedWriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid slider/stepper writes to the latest value', () => {
    const write = vi.fn();
    const writer = createDebouncedWriter<number>(write, 150);

    writer.schedule(10);
    vi.advanceTimersByTime(50);
    writer.schedule(25);
    vi.advanceTimersByTime(50);
    writer.schedule(40);

    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(40);
  });

  it('flushes immediately without double-writing after timeout', () => {
    const write = vi.fn();
    const writer = createDebouncedWriter<number>(write, 250);

    writer.schedule(5);
    writer.flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(5);

    vi.advanceTimersByTime(500);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('drops pending writes on cancel', () => {
    const write = vi.fn();
    const writer = createDebouncedWriter<number>(write, 250);

    writer.schedule(9);
    writer.cancel();
    vi.advanceTimersByTime(500);
    expect(write).not.toHaveBeenCalled();
  });
});
