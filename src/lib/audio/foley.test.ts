import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  playDelete,
  playDrop,
  playError,
  playHoverRiffle,
  playPickup,
  playSessionFreeze,
  playTagPop,
  resetFoleyContextForTests,
  setSoundEffectsEnabled,
  setSoundPack,
  setSoundVolume,
} from '@/lib/audio/foley';
import type { SoundPack } from '@/lib/types/stash';

const globalWithAudio = globalThis as {
  AudioContext?: unknown;
  webkitAudioContext?: unknown;
};

const originalAudioContext = globalWithAudio.AudioContext;
const originalWebkitAudioContext = globalWithAudio.webkitAudioContext;

function createMockAudioContextClass() {
  const oscStartMock = vi.fn();
  const oscStopMock = vi.fn();
  const noiseStartMock = vi.fn();
  const noiseStopMock = vi.fn();
  const resumeMock = vi.fn().mockResolvedValue(undefined);
  const ctorSpy = vi.fn();
  const gainSetValues: number[] = [];

  class MockAudioContext {
    state: AudioContextState = 'suspended';
    currentTime = 1.0;
    sampleRate = 44_100;
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
        start: oscStartMock,
        stop: oscStopMock,
      };
    }

    createGain() {
      return {
        gain: {
          setValueAtTime: vi.fn((val: number) => {
            gainSetValues.push(val);
          }),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };
    }

    createDynamicsCompressor() {
      return {
        threshold: { setValueAtTime: vi.fn() },
        knee: { setValueAtTime: vi.fn() },
        ratio: { setValueAtTime: vi.fn() },
        attack: { setValueAtTime: vi.fn() },
        release: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      };
    }

    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length);
      return {
        getChannelData: () => data,
      };
    }

    createBufferSource() {
      return {
        buffer: null,
        connect: vi.fn(),
        start: noiseStartMock,
        stop: noiseStopMock,
      };
    }

    createBiquadFilter() {
      return {
        type: 'lowpass' as BiquadFilterType,
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        gain: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      };
    }

    createConvolver() {
      return {
        buffer: null,
        connect: vi.fn(),
      };
    }

    createWaveShaper() {
      return {
        curve: null,
        oversample: 'none' as OverSampleType,
        connect: vi.fn(),
      };
    }

    createStereoPanner() {
      return {
        pan: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
      };
    }
  }

  return {
    MockAudioContext,
    ctorSpy,
    oscStartMock,
    oscStopMock,
    noiseStartMock,
    noiseStopMock,
    resumeMock,
    gainSetValues,
  };
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

describe('Web Audio layered mechanical foley', () => {
  it('fails silently when AudioContext is absent', () => {
    expect(() => playPickup(true)).not.toThrow();
    expect(() => playDrop(true)).not.toThrow();
    expect(() => playSessionFreeze(true)).not.toThrow();
    expect(() => playError(true)).not.toThrow();
  });

  it('does not initialize AudioContext when disabled or volume is 0%', () => {
    const { MockAudioContext, ctorSpy, oscStartMock, noiseStartMock } =
      createMockAudioContextClass();
    globalWithAudio.AudioContext = MockAudioContext;

    playPickup(false);
    playDrop(false);
    playSessionFreeze(false);
    playError(false);

    setSoundEffectsEnabled(false);
    playPickup();
    playDrop();

    setSoundEffectsEnabled(true);
    setSoundVolume(0);
    playDrop(true, 'arcade');

    expect(ctorSpy).not.toHaveBeenCalled();
    expect(oscStartMock).not.toHaveBeenCalled();
    expect(noiseStartMock).not.toHaveBeenCalled();
  });

  it('lazily creates one shared AudioContext, applies volume, and schedules layered tones + filtered noise', () => {
    const {
      MockAudioContext,
      ctorSpy,
      oscStartMock,
      oscStopMock,
      noiseStartMock,
      noiseStopMock,
      resumeMock,
      gainSetValues,
    } = createMockAudioContextClass();
    globalWithAudio.AudioContext = MockAudioContext;

    setSoundVolume(90);
    playPickup(true);
    playDrop(true, 'arcade');
    playSessionFreeze(true, 'tactile');
    playError(true);
    expect(playHoverRiffle(true, 'arcade', 1000)).toBe(true);

    expect(ctorSpy).toHaveBeenCalledTimes(1);
    expect(resumeMock).toHaveBeenCalled();
    expect(gainSetValues).toContain(0.9);
    expect(oscStartMock).toHaveBeenCalledTimes(8);
    expect(oscStopMock).toHaveBeenCalledTimes(8);
    expect(noiseStartMock).toHaveBeenCalledTimes(7);
    expect(noiseStopMock).toHaveBeenCalledTimes(7);
  });

  it('plays every event cleanly across all 5 synthesized sound packs including ARPG Heavy', () => {
    const { MockAudioContext, oscStartMock, noiseStartMock } =
      createMockAudioContextClass();
    globalWithAudio.AudioContext = MockAudioContext;

    const packs: SoundPack[] = [
      'arpg-heavy',
      'studio-desk',
      'mechanical-thock',
      'retro-synth',
      'glass-ceramic',
    ];

    packs.forEach((pack, idx) => {
      setSoundPack(pack);
      playPickup(true);
      playDrop(true, 'arcade');
      playSessionFreeze(true, 'arcade');
      playTagPop(true, 'arcade');
      expect(playHoverRiffle(true, 'arcade', 2000 + idx * 500)).toBe(true);
      playDelete(true);
      playError(true);
    });

    expect(oscStartMock.mock.calls.length).toBeGreaterThan(20);
    expect(noiseStartMock.mock.calls.length).toBeGreaterThan(10);
  });
});
