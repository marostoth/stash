import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  customSfxStore,
  MAX_CUSTOM_SFX_BYTES,
  validateCustomAudioFile,
} from '@/lib/audio/custom-sfx-store';
import {
  playDrop,
  playPickup,
  resetFoleyContextForTests,
  setCustomSfxClips,
  setCustomSoundsEnabled,
} from '@/lib/audio/foley';

const globalWithAudio = globalThis as {
  AudioContext?: unknown;
  webkitAudioContext?: unknown;
};
const originalAudioContext = globalWithAudio.AudioContext;

describe('custom audio pack validation & storage', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    resetFoleyContextForTests();
  });

  afterEach(() => {
    resetFoleyContextForTests();
    globalWithAudio.AudioContext = originalAudioContext;
    vi.restoreAllMocks();
  });

  it('validates file size and audio format cleanly', () => {
    expect(
      validateCustomAudioFile({
        name: 'slam.wav',
        type: 'audio/wav',
        size: 12_000,
      }),
    ).toEqual({ ok: true });

    expect(
      validateCustomAudioFile({
        name: 'notes.txt',
        type: 'text/plain',
        size: 500,
      }).ok,
    ).toBe(false);

    expect(
      validateCustomAudioFile({
        name: 'huge.mp3',
        type: 'audio/mpeg',
        size: MAX_CUSTOM_SFX_BYTES + 1,
      }).ok,
    ).toBe(false);
  });

  it('persists, removes, and clears custom clips in WXT local storage', async () => {
    const saved = await customSfxStore.setClip('drop', {
      name: 'stone-boom.wav',
      mimeType: 'audio/wav',
      sizeBytes: 4096,
      dataUrl: 'data:audio/wav;base64,UklGRg==',
      updatedAt: '2026-11-26T00:00:00.000Z',
    });
    expect(saved.drop?.name).toBe('stone-boom.wav');
    expect((await customSfxStore.getAll()).drop?.sizeBytes).toBe(4096);

    await customSfxStore.removeClip('drop');
    expect((await customSfxStore.getAll()).drop).toBeUndefined();
  });

  it('plays decoded custom clip for overridden slots and falls back to active pack for unfilled slots', async () => {
    const bufferStartSpy = vi.fn();
    const oscStartSpy = vi.fn();
    const fakeDecodedBuffer = { duration: 0.4 } as unknown as AudioBuffer;

    class MockAudioCtx {
      state: AudioContextState = 'running';
      currentTime = 1.0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      decodeAudioData = vi.fn().mockResolvedValue(fakeDecodedBuffer);
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
      createOscillator() {
        return {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          start: oscStartSpy,
          stop: vi.fn(),
        };
      }
      createBuffer(_channels: number, length: number) {
        const data = new Float32Array(length);
        return { getChannelData: () => data };
      }
      createBiquadFilter() {
        return {
          type: 'bandpass',
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          Q: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
      }
      createBufferSource() {
        return {
          buffer: null,
          playbackRate: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          start: bufferStartSpy,
          stop: vi.fn(),
        };
      }
    }

    globalWithAudio.AudioContext = MockAudioCtx;

    setCustomSoundsEnabled(true);
    setCustomSfxClips({
      drop: {
        name: 'custom-boom.wav',
        mimeType: 'audio/wav',
        sizeBytes: 2048,
        dataUrl: 'data:audio/wav;base64,UklGRg==',
        updatedAt: '2026-11-26T00:00:00.000Z',
      },
    });

    // Drop uses custom clip (0 oscillator calls, 1 decoded buffer playback)
    playDrop(true, 'arcade');
    await Promise.resolve();
    await Promise.resolve();
    expect(bufferStartSpy).toHaveBeenCalledTimes(1);
    expect(oscStartSpy).not.toHaveBeenCalled();

    // Pickup is unfilled -> falls back cleanly to built-in pack dry micro-transients
    playPickup(true);
    expect(bufferStartSpy.mock.calls.length).toBeGreaterThan(1);
    expect(oscStartSpy).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent cold decodes and skips playing into an already-choked voice gate', async () => {
    let resolveDecode!: (buf: AudioBuffer) => void;
    const decodePromise = new Promise<AudioBuffer>((resolve) => {
      resolveDecode = resolve;
    });
    const decodeSpy = vi.fn(() => decodePromise);
    const bufferStartSpy = vi.fn();

    class MockAudioCtx {
      state: AudioContextState = 'running';
      currentTime = 1.0;
      sampleRate = 44_100;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      decodeAudioData = decodeSpy;
      createGain() {
        return {
          gain: {
            value: 1,
            cancelScheduledValues: vi.fn(),
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
      }
      createBufferSource() {
        return {
          buffer: null,
          playbackRate: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
          disconnect: vi.fn(),
          onended: null as (() => void) | null,
          start: bufferStartSpy,
          stop: vi.fn(),
        };
      }
    }

    globalWithAudio.AudioContext = MockAudioCtx;
    setCustomSoundsEnabled(true);
    setCustomSfxClips({
      drop: {
        name: 'slow-boom.wav',
        mimeType: 'audio/wav',
        sizeBytes: 2048,
        dataUrl: 'data:audio/wav;base64,UklGRg==',
        updatedAt: '2026-11-26T00:00:00.000Z',
      },
    });

    // 3 rapid drops on a cold clip: drop policy maxConcurrent=2 chokes voice #1 immediately,
    // and all 3 triggers must share ONE deduplicated decodeAudioData call.
    playDrop(true, 'arcade');
    playDrop(true, 'arcade');
    playDrop(true, 'arcade');
    expect(decodeSpy).toHaveBeenCalledTimes(1);

    resolveDecode({ duration: 0.4 } as unknown as AudioBuffer);
    await Promise.resolve();
    await Promise.resolve();

    // Only the 2 un-choked voices play; the choked 1st voice is skipped
    expect(bufferStartSpy).toHaveBeenCalledTimes(2);
  });
});
