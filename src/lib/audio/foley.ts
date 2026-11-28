import {
  createChokableVoiceBus,
  getMasterVolume,
  getReadyAudioBus,
  type ReadyAudioBus,
  resetAudioBusForTests,
  scheduleTone,
  setMasterVolumePercent,
} from '@/lib/audio/audio-bus';
import {
  type ChokedSoundKey,
  createVoiceLimiter,
  getTailScale,
  VOICE_POOL_POLICIES,
} from '@/lib/audio/audio-math';
import {
  createComboTracker,
  createCooldownGate,
  HOVER_RIFFLE_COOLDOWN_MS,
} from '@/lib/audio/combo';
import {
  resetCustomSfxCacheForTests,
  setCustomSfxClips,
  setCustomSoundsEnabled,
  tryPlayCustomSfx,
} from '@/lib/audio/custom-sfx-player';
import { SOUND_PACK_RECIPES } from '@/lib/audio/sound-packs';
import type { MotionMode, SoundPack } from '@/lib/types/stash';

export { setCustomSfxClips, setCustomSoundsEnabled };

let globalSoundEnabled = true;
let globalMotionMode: MotionMode = 'tactile';
let globalSoundPack: SoundPack = 'studio-desk';

const comboTracker = createComboTracker();
const hoverRiffleGate = createCooldownGate(HOVER_RIFFLE_COOLDOWN_MS);
const voiceLimiter = createVoiceLimiter<ChokedSoundKey>();

export function setSoundEffectsEnabled(enabled: boolean): void {
  globalSoundEnabled = enabled;
}

export function setSoundVolume(percent: number): void {
  setMasterVolumePercent(percent);
}

export function setFoleyMotionMode(mode: MotionMode): void {
  globalMotionMode = mode;
}

export function setSoundPack(pack: SoundPack): void {
  globalSoundPack = pack in SOUND_PACK_RECIPES ? pack : 'studio-desk';
}

export function resetFoleyContextForTests(): void {
  resetAudioBusForTests();
  resetCustomSfxCacheForTests();
  globalSoundEnabled = true;
  globalMotionMode = 'tactile';
  globalSoundPack = 'studio-desk';
  comboTracker.reset();
  hoverRiffleGate.reset();
  voiceLimiter.reset();
}

function shouldPlay(enabled?: boolean): boolean {
  return (enabled ?? globalSoundEnabled) && getMasterVolume() > 0;
}

function resolveMode(mode?: MotionMode): MotionMode {
  return mode ?? globalMotionMode;
}

function isArcade(mode?: MotionMode): boolean {
  return resolveMode(mode) === 'arcade';
}

function getActiveRecipe() {
  return (
    SOUND_PACK_RECIPES[globalSoundPack] ?? SOUND_PACK_RECIPES['studio-desk']
  );
}

const DROP_SLAM_GAIN_TRIM = 0.88; // ~12% quieter so Drop Slam balances cleanly with other triggers

function acquireChokedBus(
  bus: ReadyAudioBus,
  key: ChokedSoundKey,
  initialGain = 1,
): ReadyAudioBus {
  const policy = VOICE_POOL_POLICIES[key];
  const voice = createChokableVoiceBus(bus, initialGain, policy.tailSec);
  voiceLimiter.register(key, bus.ctx.currentTime, policy, voice.choke);
  return voice.bus;
}

export function playPickup(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;
  if (tryPlayCustomSfx(bus, 'pickup', { gain: 0.9 })) return;
  const mode = resolveMode();
  try {
    getActiveRecipe().pickup({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade: mode === 'arcade',
      pitch: 1,
      tailScale: getTailScale(mode),
    });
  } catch {
    // Fail silently if Web Audio scheduling is blocked
  }
}

function schedulePeakComboShimmer(bus: ReadyAudioBus, pitch: number): void {
  scheduleTone(bus.ctx, bus.destination, {
    type: 'sine',
    startFreq: 1046.5 * pitch,
    endFreq: 1046.5 * pitch,
    startOffsetSec: 0.014,
    durationSec: 0.09,
    gain: 0.14,
    reverbNode: bus.reverb,
    reverbSend: 0.42,
  });
  scheduleTone(bus.ctx, bus.destination, {
    type: 'triangle',
    startFreq: 1567.98 * pitch,
    endFreq: 1567.98 * pitch,
    startOffsetSec: 0.036,
    durationSec: 0.11,
    gain: 0.11,
    reverbNode: bus.reverb,
    reverbSend: 0.48,
  });
}

export function playDrop(enabled?: boolean, mode?: MotionMode): void {
  if (!shouldPlay(enabled)) return;
  const rawBus = getReadyAudioBus();
  if (!rawBus) return;
  const resolved = resolveMode(mode);
  const arcade = resolved === 'arcade';
  const combo = arcade ? comboTracker.next() : null;
  const pitch = combo ? combo.multiplier : 1;
  const bus = acquireChokedBus(rawBus, 'drop', DROP_SLAM_GAIN_TRIM);
  if (
    tryPlayCustomSfx(bus, 'drop', {
      pitchMultiplier: arcade ? 0.95 + (pitch - 1) * 0.25 : 1,
      gain: 1.0,
    })
  ) {
    return;
  }
  try {
    getActiveRecipe().drop({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade,
      pitch,
      tailScale: getTailScale(resolved),
    });
    if (arcade && combo && combo.tier === 3) {
      schedulePeakComboShimmer(bus, pitch);
    }
  } catch {
    // Fail silently
  }
}

export function playSessionFreeze(enabled?: boolean, mode?: MotionMode): void {
  if (!shouldPlay(enabled)) return;
  const rawBus = getReadyAudioBus();
  if (!rawBus) return;
  const resolved = resolveMode(mode);
  const arcade = resolved === 'arcade';
  const pitch = arcade ? comboTracker.next().multiplier : 1;
  const bus = acquireChokedBus(rawBus, 'sessionFreeze');
  if (tryPlayCustomSfx(bus, 'sessionFreeze', { gain: 1.0 })) return;
  try {
    getActiveRecipe().sessionFreeze({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade,
      pitch,
      tailScale: getTailScale(resolved),
    });
  } catch {
    // Fail silently
  }
}

export function playTagPop(enabled?: boolean, mode?: MotionMode): void {
  if (!shouldPlay(enabled)) return;
  const resolved = resolveMode(mode);
  if (resolved === 'off') return;
  const bus = getReadyAudioBus();
  if (!bus) return;
  const arcade = resolved === 'arcade';
  const combo = comboTracker.next();
  const pitch = combo.multiplier;
  if (
    tryPlayCustomSfx(bus, 'tagPop', {
      pitchMultiplier: 0.98 + (pitch - 1) * 0.3,
      gain: arcade ? 0.95 : 0.78,
    })
  ) {
    return;
  }
  try {
    getActiveRecipe().tagPop({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade,
      pitch,
      tailScale: getTailScale(resolved),
    });
    if (arcade && combo.tier === 3) {
      schedulePeakComboShimmer(bus, pitch);
    }
  } catch {
    // Fail silently
  }
}

export function playUncheck(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;
  if (tryPlayCustomSfx(bus, 'uncheck', { gain: 0.85 })) return;
  const mode = resolveMode();
  try {
    getActiveRecipe().uncheck({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade: mode === 'arcade',
      pitch: 1,
      tailScale: getTailScale(mode),
    });
  } catch {
    // Fail silently
  }
}

export function playHoverRiffle(
  enabled?: boolean,
  mode?: MotionMode,
  nowMs?: number,
): boolean {
  if (!shouldPlay(enabled) || !isArcade(mode)) return false;
  if (!hoverRiffleGate.tryAcquire(nowMs)) return false;

  const bus = getReadyAudioBus();
  if (!bus) return false;
  if (
    tryPlayCustomSfx(bus, 'hoverRiffle', { gain: 0.78, jitterAmount: 0.05 })
  ) {
    return true;
  }
  try {
    getActiveRecipe().hoverRiffle({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade: true,
      pitch: 1,
      tailScale: 1,
    });
    return true;
  } catch {
    return false;
  }
}

export function playDelete(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const rawBus = getReadyAudioBus();
  if (!rawBus) return;
  const bus = acquireChokedBus(rawBus, 'delete');
  if (tryPlayCustomSfx(bus, 'delete', { gain: 0.95 })) return;
  const mode = resolveMode();
  try {
    getActiveRecipe().delete({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade: mode === 'arcade',
      pitch: 1,
      tailScale: getTailScale(mode),
    });
  } catch {
    // Fail silently
  }
}

export function playError(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;
  if (tryPlayCustomSfx(bus, 'error', { gain: 0.95 })) return;
  const mode = resolveMode();
  try {
    getActiveRecipe().error({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade: mode === 'arcade',
      pitch: 1,
      tailScale: getTailScale(mode),
    });
  } catch {
    // Fail silently
  }
}
