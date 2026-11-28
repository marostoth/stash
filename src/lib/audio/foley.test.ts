import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReadyAudioBus } from '@/lib/audio/audio-bus';
import {
  playDelete,
  playDrop,
  playError,
  playHoverRiffle,
  playPickup,
  playSessionFreeze,
  playTagPop,
  playUncheck,
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

function createMockAudioContextClass(
  initialState: AudioContextState = 'running',
) {
  const oscStartMock = vi.fn();
  const oscStopMock = vi.fn();
  const noiseStartMock = vi.fn();
  const noiseStopMock = vi.fn();
  const resumeMock = vi.fn().mockResolvedValue(undefined);
  const ctorSpy = vi.fn();
  const gainSetValues: number[] = [];
  const gainLinearRamps: Array<{ value: number; time: number }> = [];
  const createdFilters: Array<{
    type: BiquadFilterType;
    freqSetValues: number[];
    connectTargets: unknown[];
  }> = [];
  const createdCompressors: Array<{
    threshold: number[];
    knee: number[];
    ratio: number[];
    attack: number[];
    release: number[];
    connectTargets: unknown[];
  }> = [];
  const createdGains: Array<{
    connectTargets: unknown[];
    setValues: number[];
    linearRamps: Array<{ value: number; time: number }>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];

  class MockAudioContext {
    state: AudioContextState = initialState;
    currentTime = 1.0;
    sampleRate = 44_100;
    destination = { kind: 'destination' };

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
        disconnect: vi.fn(),
        onended: null as (() => void) | null,
        start: oscStartMock,
        stop: oscStopMock,
      };
    }

    createGain() {
      const disconnect = vi.fn();
      const record = {
        connectTargets: [] as unknown[],
        setValues: [] as number[],
        linearRamps: [] as Array<{ value: number; time: number }>,
        disconnect,
      };
      createdGains.push(record);
      return {
        gain: {
          value: 1,
          cancelScheduledValues: vi.fn(),
          setValueAtTime: vi.fn((val: number) => {
            gainSetValues.push(val);
            record.setValues.push(val);
          }),
          linearRampToValueAtTime: vi.fn((val: number, time: number) => {
            gainLinearRamps.push({ value: val, time });
            record.linearRamps.push({ value: val, time });
          }),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn((target: unknown) => {
          record.connectTargets.push(target);
        }),
        disconnect,
      };
    }

    createDynamicsCompressor() {
      const record = {
        threshold: [] as number[],
        knee: [] as number[],
        ratio: [] as number[],
        attack: [] as number[],
        release: [] as number[],
        connectTargets: [] as unknown[],
      };
      createdCompressors.push(record);
      return {
        threshold: {
          setValueAtTime: vi.fn((v: number) => record.threshold.push(v)),
        },
        knee: { setValueAtTime: vi.fn((v: number) => record.knee.push(v)) },
        ratio: { setValueAtTime: vi.fn((v: number) => record.ratio.push(v)) },
        attack: { setValueAtTime: vi.fn((v: number) => record.attack.push(v)) },
        release: {
          setValueAtTime: vi.fn((v: number) => record.release.push(v)),
        },
        connect: vi.fn((target: unknown) => {
          record.connectTargets.push(target);
        }),
      };
    }

    createBuffer(_channels: number, length: number) {
      const data = new Float32Array(length);
      return {
        duration: length / 44_100,
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
      const record = {
        type: 'lowpass' as BiquadFilterType,
        freqSetValues: [] as number[],
        connectTargets: [] as unknown[],
      };
      createdFilters.push(record);
      return {
        get type() {
          return record.type;
        },
        set type(next: BiquadFilterType) {
          record.type = next;
        },
        frequency: {
          setValueAtTime: vi.fn((v: number) => record.freqSetValues.push(v)),
          exponentialRampToValueAtTime: vi.fn(),
        },
        gain: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
        connect: vi.fn((target: unknown) => {
          record.connectTargets.push(target);
        }),
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
    gainLinearRamps,
    createdFilters,
    createdCompressors,
    createdGains,
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

  it('routes through 35Hz highpass -> soft-limiter -> squared masterGain -> destination', () => {
    const {
      MockAudioContext,
      ctorSpy,
      oscStartMock,
      oscStopMock,
      noiseStartMock,
      noiseStopMock,
      gainSetValues,
      createdFilters,
      createdCompressors,
    } = createMockAudioContextClass();
    globalWithAudio.AudioContext = MockAudioContext;

    // 90% slider maps via squared curve to 0.81 gain
    setSoundVolume(90);
    playPickup(true);
    playDrop(true, 'arcade');
    playSessionFreeze(true, 'tactile');
    playUncheck(true);
    playError(true);
    expect(playHoverRiffle(true, 'arcade', 1000)).toBe(true);

    expect(ctorSpy).toHaveBeenCalledTimes(1);
    expect(gainSetValues).toContain(0.81);

    // Master bus protection: 35Hz highpass & soft-limiter configured
    const masterHp = createdFilters.find(
      (f) => f.type === 'highpass' && f.freqSetValues.includes(35),
    );
    expect(masterHp).toBeDefined();

    const limiter = createdCompressors[0];
    expect(limiter).toBeDefined();
    expect(limiter?.threshold[0]).toBe(-6);
    expect(limiter?.knee[0]).toBe(12);
    expect(limiter?.ratio[0]).toBe(8);
    expect(limiter?.attack[0]).toBe(0.003);
    expect(limiter?.release[0]).toBe(0.12);

    expect(oscStartMock.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(oscStopMock.mock.calls.length).toBe(oscStartMock.mock.calls.length);
    expect(noiseStartMock.mock.calls.length).toBeGreaterThanOrEqual(9);
    expect(noiseStopMock.mock.calls.length).toBe(
      noiseStartMock.mock.calls.length,
    );
  });

  it('uses bandpass filtered noise (zero oscillators) for Hover Riffle across all 5 packs', () => {
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
      expect(playHoverRiffle(true, 'arcade', 2000 + idx * 100)).toBe(true);
    });

    expect(oscStartMock).not.toHaveBeenCalled();
    expect(noiseStartMock).toHaveBeenCalledTimes(5);
  });

  it('chokes overlapping heavy voices on rapid re-trigger via smooth 18ms fade-out', () => {
    const { MockAudioContext, gainLinearRamps } = createMockAudioContextClass();
    globalWithAudio.AudioContext = MockAudioContext;

    setSoundPack('arpg-heavy');
    // Session Freeze has maxConcurrent = 1: second immediate trigger chokes first
    playSessionFreeze(true, 'arcade');
    const rampsBefore = gainLinearRamps.length;
    playSessionFreeze(true, 'arcade');
    const chokeRamps = gainLinearRamps
      .slice(rampsBefore)
      .filter((r) => r.value === 0.0001 && Math.abs(r.time - 1.018) < 0.001);

    expect(chokeRamps.length).toBeGreaterThanOrEqual(1);
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
      playTagPop(true, 'tactile');
      playUncheck(true);
      expect(playHoverRiffle(true, 'arcade', 2000 + idx * 500)).toBe(true);
      playDelete(true);
      playError(true);
    });

    expect(oscStartMock.mock.calls.length).toBeGreaterThan(20);
    expect(noiseStartMock.mock.calls.length).toBeGreaterThan(20);
  });

  it('refuses to queue audio nodes while AudioContext remains suspended (no fresh-tab hover blast)', () => {
    const { MockAudioContext, resumeMock, oscStartMock, noiseStartMock } =
      createMockAudioContextClass('suspended');
    globalWithAudio.AudioContext = MockAudioContext;

    expect(getReadyAudioBus()).toBeNull();
    expect(resumeMock).toHaveBeenCalledTimes(1);
    expect(playHoverRiffle(true, 'arcade', 1000)).toBe(false);
    playDrop(true, 'arcade');
    playPickup(true);

    expect(oscStartMock).not.toHaveBeenCalled();
    expect(noiseStartMock).not.toHaveBeenCalled();
  });

  it('disconnects choked and expired voice gates so master bus nodes do not leak GainNodes', () => {
    vi.useFakeTimers();
    try {
      const { MockAudioContext, createdGains } =
        createMockAudioContextClass('running');
      globalWithAudio.AudioContext = MockAudioContext;

      setSoundPack('arpg-heavy');
      // 1st trigger creates master bus gains + voice gates; 2nd chokes 1st voice immediately
      playSessionFreeze(true, 'arcade');
      const countAfterFirst = createdGains.length;
      playSessionFreeze(true, 'arcade');

      // Advance past choke fade + disconnect delay (~60ms)
      vi.advanceTimersByTime(100);
      const disconnectedAfterChoke = createdGains
        .slice(0, countAfterFirst)
        .filter((g) => g.disconnect.mock.calls.length > 0);
      expect(disconnectedAfterChoke.length).toBeGreaterThanOrEqual(1);

      // Advance past natural tail expiry (~800ms) -> 2nd voice gates also disconnect cleanly
      vi.advanceTimersByTime(1000);
      const disconnectedSecond = createdGains
        .slice(countAfterFirst)
        .filter((g) => g.disconnect.mock.calls.length > 0);
      expect(disconnectedSecond.length).toBeGreaterThanOrEqual(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
