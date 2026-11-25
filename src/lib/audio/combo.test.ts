import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMBO_RESET_MS,
  createComboTracker,
  createCooldownGate,
  HOVER_RIFFLE_COOLDOWN_MS,
  PENTATONIC_SEMITONES,
  semitonesToMultiplier,
} from '@/lib/audio/combo';
import { playHoverRiffle, resetFoleyContextForTests } from '@/lib/audio/foley';

const globalWithAudio = globalThis as {
  AudioContext?: unknown;
  webkitAudioContext?: unknown;
};

const originalAudioContext = globalWithAudio.AudioContext;
const originalWebkitAudioContext = globalWithAudio.webkitAudioContext;

beforeEach(() => {
  resetFoleyContextForTests();
  delete globalWithAudio.AudioContext;
  delete globalWithAudio.webkitAudioContext;
});

afterEach(() => {
  resetFoleyContextForTests();
  globalWithAudio.AudioContext = originalAudioContext;
  globalWithAudio.webkitAudioContext = originalWebkitAudioContext;
  vi.restoreAllMocks();
});

describe('combo pitch tracker & hover-riffle cooldown', () => {
  it('escalates up the pentatonic scale, clamps at the ceiling, and resets after 2500ms', () => {
    const tracker = createComboTracker();
    let t = 1000;

    // Step through entire pentatonic scale
    for (let i = 0; i < PENTATONIC_SEMITONES.length; i++) {
      const hit = tracker.next(t);
      expect(hit.step).toBe(i);
      expect(hit.semitones).toBe(PENTATONIC_SEMITONES[i]);
      expect(hit.multiplier).toBeCloseTo(
        semitonesToMultiplier(PENTATONIC_SEMITONES[i] ?? 0),
        6,
      );
      t += 300;
    }

    // Additional rapid event clamps at upper bound (step 7 = 16 semitones)
    const clamped = tracker.next(t);
    expect(clamped.step).toBe(PENTATONIC_SEMITONES.length - 1);
    expect(clamped.semitones).toBe(16);

    // Waiting > 2500ms resets cleanly back to step 0
    const afterGap = tracker.next(t + COMBO_RESET_MS + 1);
    expect(afterGap.step).toBe(0);
    expect(afterGap.semitones).toBe(0);
    expect(afterGap.multiplier).toBe(1);
  });

  it('enforces the 45ms hover-riffle cooldown throttle', () => {
    const gate = createCooldownGate(HOVER_RIFFLE_COOLDOWN_MS);

    expect(gate.tryAcquire(100)).toBe(true);
    expect(gate.tryAcquire(110)).toBe(false);
    expect(gate.tryAcquire(144)).toBe(false);
    expect(gate.tryAcquire(145)).toBe(true);
    expect(gate.tryAcquire(180)).toBe(false);
    expect(gate.tryAcquire(190)).toBe(true);
  });

  it('strictly gates playHoverRiffle to Arcade mode with soundEffects enabled', () => {
    const ctorSpy = vi.fn();
    class MockAudioContext {
      state: AudioContextState = 'running';
      currentTime = 0;
      destination = {};
      constructor() {
        ctorSpy();
      }
      createOscillator() {
        return {
          type: 'triangle' as OscillatorType,
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      }
      createGain() {
        return {
          gain: {
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }
    }
    globalWithAudio.AudioContext = MockAudioContext;

    // Silent in Tactile / Reduced / Off / Muted
    expect(playHoverRiffle(true, 'tactile', 100)).toBe(false);
    expect(playHoverRiffle(true, 'reduced', 200)).toBe(false);
    expect(playHoverRiffle(true, 'off', 300)).toBe(false);
    expect(playHoverRiffle(false, 'arcade', 400)).toBe(false);
    expect(ctorSpy).not.toHaveBeenCalled();

    // Plays in Arcade + enabled, then respects 45ms cooldown
    expect(playHoverRiffle(true, 'arcade', 500)).toBe(true);
    expect(playHoverRiffle(true, 'arcade', 520)).toBe(false);
    expect(playHoverRiffle(true, 'arcade', 550)).toBe(true);
    expect(ctorSpy).toHaveBeenCalledTimes(1);
  });
});
