import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  playDrop,
  playError,
  playPickup,
  playSessionFreeze,
  resetFoleyContextForTests,
  setSoundEffectsEnabled,
} from '@/lib/audio/foley';

const globalWithAudio = globalThis as {
  AudioContext?: unknown;
  webkitAudioContext?: unknown;
};

const originalAudioContext = globalWithAudio.AudioContext;
const originalWebkitAudioContext = globalWithAudio.webkitAudioContext;

function createMockAudioContextClass() {
  const startMock = vi.fn();
  const stopMock = vi.fn();
  const resumeMock = vi.fn().mockResolvedValue(undefined);
  const ctorSpy = vi.fn();

  class MockAudioContext {
    state: AudioContextState = 'suspended';
    currentTime = 1.0;
    destination = {};

    constructor() {
      ctorSpy();
    }

    resume = resumeMock;

    createOscillator() {
      return {
        type: 'sine' as OscillatorType,
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: startMock,
        stop: stopMock,
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

  return { MockAudioContext, ctorSpy, startMock, stopMock, resumeMock };
}

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

describe('Web Audio mechanical foley', () => {
  it('fails silently when AudioContext is absent', () => {
    expect(() => playPickup(true)).not.toThrow();
    expect(() => playDrop(true)).not.toThrow();
    expect(() => playSessionFreeze(true)).not.toThrow();
    expect(() => playError(true)).not.toThrow();
  });

  it('does not initialize AudioContext or synthesize sound when soundEffects is disabled', () => {
    const { MockAudioContext, ctorSpy, startMock } =
      createMockAudioContextClass();
    globalWithAudio.AudioContext = MockAudioContext;

    playPickup(false);
    playDrop(false);
    playSessionFreeze(false);
    playError(false);

    setSoundEffectsEnabled(false);
    playPickup();
    playDrop();
    playSessionFreeze();
    playError();

    expect(ctorSpy).not.toHaveBeenCalled();
    expect(startMock).not.toHaveBeenCalled();
  });

  it('lazily creates one shared AudioContext, resumes it, and schedules tones when enabled', () => {
    const { MockAudioContext, ctorSpy, startMock, stopMock, resumeMock } =
      createMockAudioContextClass();
    globalWithAudio.AudioContext = MockAudioContext;

    playPickup(true);
    playDrop(true);
    playSessionFreeze(true);
    playError(true);

    expect(ctorSpy).toHaveBeenCalledTimes(1);
    expect(resumeMock).toHaveBeenCalled();
    expect(startMock).toHaveBeenCalledTimes(8);
    expect(stopMock).toHaveBeenCalledTimes(8);
  });
});
