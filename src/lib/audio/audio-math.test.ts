import { describe, expect, it, vi } from 'vitest';
import {
  computeJitter,
  createVoiceLimiter,
  DEFAULT_GAIN_JITTER,
  DEFAULT_PITCH_JITTER,
  gainJitter,
  getTailScale,
  pitchJitter,
  TACTILE_TAIL_SCALE,
  VOICE_POOL_POLICIES,
  volumePercentToGain,
} from '@/lib/audio/audio-math';

describe('audio-math pure helpers', () => {
  it('maps 0-100% volume via a clamped squared exponential curve', () => {
    expect(volumePercentToGain(0)).toBe(0);
    expect(volumePercentToGain(30)).toBeCloseTo(0.09, 6);
    expect(volumePercentToGain(35)).toBeCloseTo(0.1225, 6);
    expect(volumePercentToGain(50)).toBeCloseTo(0.25, 6);
    expect(volumePercentToGain(75)).toBeCloseTo(0.5625, 6);
    expect(volumePercentToGain(90)).toBeCloseTo(0.81, 6);
    expect(volumePercentToGain(100)).toBe(1);

    // Out-of-bounds and non-finite inputs clamp cleanly
    expect(volumePercentToGain(-25)).toBe(0);
    expect(volumePercentToGain(250)).toBe(1);
    expect(volumePercentToGain(Number.NaN)).toBeCloseTo(0.5625, 6);
  });

  it('bounds organic pitch (±2.5%) and gain (±4%) micro-jitter strictly', () => {
    expect(pitchJitter(DEFAULT_PITCH_JITTER, 0)).toBeCloseTo(0.975, 6);
    expect(pitchJitter(DEFAULT_PITCH_JITTER, 0.5)).toBeCloseTo(1.0, 6);
    expect(pitchJitter(DEFAULT_PITCH_JITTER, 1)).toBeCloseTo(1.025, 6);

    expect(gainJitter(DEFAULT_GAIN_JITTER, 0)).toBeCloseTo(0.96, 6);
    expect(gainJitter(DEFAULT_GAIN_JITTER, 0.5)).toBeCloseTo(1.0, 6);
    expect(gainJitter(DEFAULT_GAIN_JITTER, 1)).toBeCloseTo(1.04, 6);

    // Clamps extreme/invalid random or amount inputs safely
    expect(computeJitter(0.03, -5)).toBeCloseTo(0.97, 6);
    expect(computeJitter(0.03, 5)).toBeCloseTo(1.03, 6);
    expect(computeJitter(Number.NaN, 0.9)).toBe(1);
  });

  it('scales decay/reverb tails by 1.0 in Arcade and ~0.7 in Tactile/calmer modes', () => {
    expect(getTailScale('arcade')).toBe(1);
    expect(getTailScale('tactile')).toBe(TACTILE_TAIL_SCALE);
    expect(getTailScale('reduced')).toBe(TACTILE_TAIL_SCALE);
    expect(getTailScale('off')).toBe(TACTILE_TAIL_SCALE);
  });

  it('caps concurrent heavy voices per sound key, chokes oldest on rapid re-trigger, and prunes expired tails', () => {
    const limiter = createVoiceLimiter();
    const choke1 = vi.fn();
    const choke2 = vi.fn();
    const choke3 = vi.fn();
    const choke4 = vi.fn();

    // Drop policy allows 2 concurrent voices
    expect(
      limiter.register('drop', 1.0, VOICE_POOL_POLICIES.drop, choke1),
    ).toBe(0);
    expect(
      limiter.register('drop', 1.1, VOICE_POOL_POLICIES.drop, choke2),
    ).toBe(0);
    expect(limiter.activeCount('drop', 1.1)).toBe(2);
    expect(choke1).not.toHaveBeenCalled();

    // 3rd rapid hit chokes oldest (choke1) immediately at t=1.2
    expect(
      limiter.register('drop', 1.2, VOICE_POOL_POLICIES.drop, choke3),
    ).toBe(1);
    expect(choke1).toHaveBeenCalledTimes(1);
    expect(choke1).toHaveBeenCalledWith(1.2);
    expect(choke2).not.toHaveBeenCalled();
    expect(limiter.activeCount('drop', 1.2)).toBe(2);

    // After tailSec (0.55s) elapses, older voices expire without choking
    expect(
      limiter.register('drop', 2.5, VOICE_POOL_POLICIES.drop, choke4),
    ).toBe(0);
    expect(choke2).not.toHaveBeenCalled();
    expect(choke3).not.toHaveBeenCalled();
    expect(limiter.activeCount('drop', 2.5)).toBe(1);

    // Session Lock policy (maxConcurrent = 1) isolates from 'drop' and chokes immediately on overlap
    const lock1 = vi.fn();
    const lock2 = vi.fn();
    expect(
      limiter.register(
        'sessionFreeze',
        2.5,
        VOICE_POOL_POLICIES.sessionFreeze,
        lock1,
      ),
    ).toBe(0);
    expect(
      limiter.register(
        'sessionFreeze',
        2.6,
        VOICE_POOL_POLICIES.sessionFreeze,
        lock2,
      ),
    ).toBe(1);
    expect(lock1).toHaveBeenCalledWith(2.6);
    expect(limiter.activeCount('drop', 2.6)).toBe(1);

    limiter.reset();
    expect(limiter.activeCount('drop', 2.6)).toBe(0);
    expect(limiter.activeCount('sessionFreeze', 2.6)).toBe(0);
  });
});
