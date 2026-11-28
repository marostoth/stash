import { jitter, type ReadyAudioBus } from '@/lib/audio/audio-bus';
import {
  type CustomSfxMap,
  dataUrlToArrayBuffer,
  type SoundEventId,
} from '@/lib/audio/custom-sfx-store';

let customEnabled = true;
let activeClips: CustomSfxMap = {};
const decodedCache = new Map<
  SoundEventId,
  { dataUrl: string; buffer: AudioBuffer }
>();
const pendingDecodes = new Map<
  SoundEventId,
  { dataUrl: string; promise: Promise<AudioBuffer | null> }
>();

export function setCustomSoundsEnabled(enabled: boolean): void {
  customEnabled = enabled;
}

export function setCustomSfxClips(clips: CustomSfxMap): void {
  activeClips = clips;
  // Evict stale decoded buffers and in-flight decodes when a slot changed or was removed
  for (const [eventId, entry] of decodedCache.entries()) {
    const nextClip = clips[eventId];
    if (!nextClip || nextClip.dataUrl !== entry.dataUrl) {
      decodedCache.delete(eventId);
    }
  }
  for (const [eventId, entry] of pendingDecodes.entries()) {
    const nextClip = clips[eventId];
    if (!nextClip || nextClip.dataUrl !== entry.dataUrl) {
      pendingDecodes.delete(eventId);
    }
  }
}

export function resetCustomSfxCacheForTests(): void {
  customEnabled = true;
  activeClips = {};
  decodedCache.clear();
  pendingDecodes.clear();
}

function getOrStartDecode(
  ctx: AudioContext,
  eventId: SoundEventId,
  dataUrl: string,
): Promise<AudioBuffer | null> | null {
  if (typeof ctx.decodeAudioData !== 'function') return null;

  const existing = pendingDecodes.get(eventId);
  if (existing && existing.dataUrl === dataUrl) {
    return existing.promise;
  }

  const arrayBuffer = dataUrlToArrayBuffer(dataUrl);
  if (!arrayBuffer) return null;

  const promise = ctx.decodeAudioData(arrayBuffer).then(
    (buffer) => {
      if (pendingDecodes.get(eventId)?.promise === promise) {
        pendingDecodes.delete(eventId);
      }
      if (activeClips[eventId]?.dataUrl === dataUrl) {
        decodedCache.set(eventId, { dataUrl, buffer });
        return buffer;
      }
      return null;
    },
    () => {
      if (pendingDecodes.get(eventId)?.promise === promise) {
        pendingDecodes.delete(eventId);
      }
      return null;
    },
  );

  pendingDecodes.set(eventId, { dataUrl, promise });
  return promise;
}

export function prewarmCustomSfx(
  ctx: AudioContext,
  eventId: SoundEventId,
): void {
  const clip = activeClips[eventId];
  if (!clip) return;
  if (decodedCache.get(eventId)?.dataUrl === clip.dataUrl) return;
  void getOrStartDecode(ctx, eventId, clip.dataUrl);
}

function playDecodedBuffer(
  bus: ReadyAudioBus,
  buffer: AudioBuffer,
  options: { pitchMultiplier: number; gain: number; jitterAmount: number },
): void {
  if (typeof bus.ctx.createBufferSource !== 'function') return;
  if (bus.ctx.state !== 'running' || bus.isChoked?.()) return;

  const src = bus.ctx.createBufferSource();
  src.buffer = buffer;

  const now = bus.ctx.currentTime;
  const appliedRate = Math.max(
    0.7,
    Math.min(1.5, options.pitchMultiplier * jitter(options.jitterAmount)),
  );
  if (
    src.playbackRate &&
    typeof src.playbackRate.setValueAtTime === 'function'
  ) {
    src.playbackRate.setValueAtTime(appliedRate, now);
  }

  const amp = bus.ctx.createGain();
  const safeGain = Math.max(0.0002, options.gain);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(safeGain, now + 0.002);

  if (
    typeof buffer.duration === 'number' &&
    Number.isFinite(buffer.duration) &&
    buffer.duration > 0.02
  ) {
    const end = now + buffer.duration / appliedRate;
    const fadeStart = Math.max(now + 0.004, end - 0.008);
    amp.gain.setValueAtTime(safeGain, fadeStart);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    amp.gain.linearRampToValueAtTime(0, end + 0.004);
  }

  src.connect(amp);
  amp.connect(bus.destination);
  src.onended = () => {
    try {
      if (typeof src.disconnect === 'function') src.disconnect();
      if (typeof amp.disconnect === 'function') amp.disconnect();
    } catch {
      // Ignore already-disconnected node errors
    }
  };
  src.start(now);
}

/**
 * Plays a user-uploaded custom audio clip for `eventId` through the shared DSP
 * master bus if one is configured and enabled. Returns `true` when handled
 * (suppressing the built-in pack), or `false` to fall back to the active pack.
 */
export function tryPlayCustomSfx(
  bus: ReadyAudioBus,
  eventId: SoundEventId,
  options?: { pitchMultiplier?: number; gain?: number; jitterAmount?: number },
): boolean {
  if (!customEnabled) return false;
  const clip = activeClips[eventId];
  if (!clip) return false;

  const playOpts = {
    pitchMultiplier: options?.pitchMultiplier ?? 1,
    gain: options?.gain ?? 1.0,
    jitterAmount: options?.jitterAmount ?? 0.035,
  };

  const cached = decodedCache.get(eventId);
  if (cached && cached.dataUrl === clip.dataUrl) {
    try {
      playDecodedBuffer(bus, cached.buffer, playOpts);
      return true;
    } catch {
      return false;
    }
  }

  // Deduplicated first-time cold decode: guard against choked gates or stale clips on resolve
  const decodePromise = getOrStartDecode(bus.ctx, eventId, clip.dataUrl);
  if (!decodePromise) return false;

  void decodePromise.then((buffer) => {
    if (!buffer) return;
    if (activeClips[eventId]?.dataUrl !== clip.dataUrl) return;
    if (bus.ctx.state !== 'running' || bus.isChoked?.()) return;
    try {
      playDecodedBuffer(bus, buffer, playOpts);
    } catch {
      // Fail silently on playback error
    }
  });

  return true;
}
