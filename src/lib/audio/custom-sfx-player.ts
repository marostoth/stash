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
const pendingDecodes = new Set<SoundEventId>();

export function setCustomSoundsEnabled(enabled: boolean): void {
  customEnabled = enabled;
}

export function setCustomSfxClips(clips: CustomSfxMap): void {
  activeClips = clips;
  // Evict stale decoded buffers when a slot changed or was removed
  for (const [eventId, entry] of decodedCache.entries()) {
    const nextClip = clips[eventId];
    if (!nextClip || nextClip.dataUrl !== entry.dataUrl) {
      decodedCache.delete(eventId);
    }
  }
}

export function resetCustomSfxCacheForTests(): void {
  customEnabled = true;
  activeClips = {};
  decodedCache.clear();
  pendingDecodes.clear();
}

export function prewarmCustomSfx(
  ctx: AudioContext,
  eventId: SoundEventId,
): void {
  const clip = activeClips[eventId];
  if (!clip || typeof ctx.decodeAudioData !== 'function') return;
  if (decodedCache.get(eventId)?.dataUrl === clip.dataUrl) return;
  if (pendingDecodes.has(eventId)) return;

  const arrayBuffer = dataUrlToArrayBuffer(clip.dataUrl);
  if (!arrayBuffer) return;

  pendingDecodes.add(eventId);
  void ctx
    .decodeAudioData(arrayBuffer)
    .then((buffer) => {
      if (activeClips[eventId]?.dataUrl === clip.dataUrl) {
        decodedCache.set(eventId, { dataUrl: clip.dataUrl, buffer });
      }
    })
    .catch(() => {
      // Ignore corrupt clips; built-in sound pack will seamlessly take over
    })
    .finally(() => {
      pendingDecodes.delete(eventId);
    });
}

function playDecodedBuffer(
  bus: ReadyAudioBus,
  buffer: AudioBuffer,
  options: { pitchMultiplier: number; gain: number; jitterAmount: number },
): void {
  if (typeof bus.ctx.createBufferSource !== 'function') return;
  const src = bus.ctx.createBufferSource();
  src.buffer = buffer;

  if (
    src.playbackRate &&
    typeof src.playbackRate.setValueAtTime === 'function'
  ) {
    const rate = Math.max(
      0.7,
      Math.min(1.5, options.pitchMultiplier * jitter(options.jitterAmount)),
    );
    src.playbackRate.setValueAtTime(rate, bus.ctx.currentTime);
  }

  const amp = bus.ctx.createGain();
  amp.gain.setValueAtTime(options.gain, bus.ctx.currentTime);
  src.connect(amp);
  amp.connect(bus.destination);
  src.start(bus.ctx.currentTime);
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

  // First-time decode on demand: decode asynchronously and play once ready
  if (typeof bus.ctx.decodeAudioData !== 'function') return false;
  const arrayBuffer = dataUrlToArrayBuffer(clip.dataUrl);
  if (!arrayBuffer) return false;

  void bus.ctx
    .decodeAudioData(arrayBuffer)
    .then((buffer) => {
      if (activeClips[eventId]?.dataUrl !== clip.dataUrl) return;
      decodedCache.set(eventId, { dataUrl: clip.dataUrl, buffer });
      playDecodedBuffer(bus, buffer, playOpts);
    })
    .catch(() => {
      // Fail silently on decode error
    });

  return true;
}
