import {
  getMasterVolume,
  getReadyAudioBus,
  resetAudioBusForTests,
  setMasterVolumePercent,
} from '@/lib/audio/audio-bus';
import {
  createComboTracker,
  createCooldownGate,
  HOVER_RIFFLE_COOLDOWN_MS,
} from '@/lib/audio/combo';
import { SOUND_PACK_RECIPES } from '@/lib/audio/sound-packs';
import type { MotionMode, SoundPack } from '@/lib/types/stash';

let globalSoundEnabled = true;
let globalMotionMode: MotionMode = 'tactile';
let globalSoundPack: SoundPack = 'studio-desk';

const comboTracker = createComboTracker();
const hoverRiffleGate = createCooldownGate(HOVER_RIFFLE_COOLDOWN_MS);

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
  globalSoundEnabled = true;
  globalMotionMode = 'tactile';
  globalSoundPack = 'studio-desk';
  comboTracker.reset();
  hoverRiffleGate.reset();
}

function shouldPlay(enabled?: boolean): boolean {
  return (enabled ?? globalSoundEnabled) && getMasterVolume() > 0;
}

function isArcade(mode?: MotionMode): boolean {
  return (mode ?? globalMotionMode) === 'arcade';
}

function getActiveRecipe() {
  return (
    SOUND_PACK_RECIPES[globalSoundPack] ?? SOUND_PACK_RECIPES['studio-desk']
  );
}

export function playPickup(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;
  try {
    getActiveRecipe().pickup({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade: isArcade(),
      pitch: 1,
    });
  } catch {
    // Fail silently if Web Audio scheduling is blocked
  }
}

export function playDrop(enabled?: boolean, mode?: MotionMode): void {
  if (!shouldPlay(enabled)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;
  const arcade = isArcade(mode);
  const pitch = arcade ? comboTracker.next().multiplier : 1;
  try {
    getActiveRecipe().drop({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade,
      pitch,
    });
  } catch {
    // Fail silently
  }
}

export function playSessionFreeze(enabled?: boolean, mode?: MotionMode): void {
  if (!shouldPlay(enabled)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;
  const arcade = isArcade(mode);
  const pitch = arcade ? comboTracker.next().multiplier : 1;
  try {
    getActiveRecipe().sessionFreeze({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade,
      pitch,
    });
  } catch {
    // Fail silently
  }
}

export function playTagPop(enabled?: boolean, mode?: MotionMode): void {
  if (!shouldPlay(enabled) || !isArcade(mode)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;
  const pitch = comboTracker.next().multiplier;
  try {
    getActiveRecipe().tagPop({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade: true,
      pitch,
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
  try {
    getActiveRecipe().hoverRiffle({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade: true,
      pitch: 1,
    });
    return true;
  } catch {
    return false;
  }
}

export function playDelete(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;
  try {
    getActiveRecipe().delete({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade: isArcade(),
      pitch: 1,
    });
  } catch {
    // Fail silently
  }
}

export function playError(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;
  try {
    getActiveRecipe().error({
      ctx: bus.ctx,
      destination: bus.destination,
      punch: bus.punch,
      reverb: bus.reverb,
      arcade: isArcade(),
      pitch: 1,
    });
  } catch {
    // Fail silently
  }
}
