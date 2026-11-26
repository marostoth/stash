import {
  getMasterVolume,
  getReadyAudioBus,
  resetAudioBusForTests,
  scheduleFilteredNoise,
  scheduleTone,
  setMasterVolumePercent,
} from '@/lib/audio/audio-bus';
import {
  createComboTracker,
  createCooldownGate,
  HOVER_RIFFLE_COOLDOWN_MS,
} from '@/lib/audio/combo';
import type { MotionMode } from '@/lib/types/stash';

let globalSoundEnabled = true;
let globalMotionMode: MotionMode = 'tactile';

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

export function resetFoleyContextForTests(): void {
  resetAudioBusForTests();
  globalSoundEnabled = true;
  globalMotionMode = 'tactile';
  comboTracker.reset();
  hoverRiffleGate.reset();
}

function shouldPlay(enabled?: boolean): boolean {
  return (enabled ?? globalSoundEnabled) && getMasterVolume() > 0;
}

function isArcade(mode?: MotionMode): boolean {
  return (mode ?? globalMotionMode) === 'arcade';
}

/**
 * Crisp mechanical switch lift when picking up a card, row, or tab to drag.
 */
export function playPickup(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;

  try {
    scheduleFilteredNoise(bus.ctx, bus.destination, {
      filterType: 'highpass',
      startFreq: 2100,
      startOffsetSec: 0,
      durationSec: 0.012,
      gain: 0.24,
      attackSec: 0.001,
    });
    scheduleTone(bus.ctx, bus.destination, {
      type: 'triangle',
      startFreq: 165,
      endFreq: 245,
      startOffsetSec: 0,
      durationSec: 0.032,
      gain: 0.28,
    });
  } catch {
    // Fail silently if Web Audio scheduling is blocked
  }
}

/**
 * Heavy matte tile slam on drop: sub-bass weight thump + desk impact knock +
 * displaced air/dust whoosh. In Arcade mode, layers a subtle pentatonic shimmer
 * that climbs on rapid consecutive drops while keeping the deep physical thud.
 */
export function playDrop(enabled?: boolean, mode?: MotionMode): void {
  if (!shouldPlay(enabled)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;

  const arcade = isArcade(mode);
  const pitch = arcade ? comboTracker.next().multiplier : 1;

  try {
    scheduleTone(bus.ctx, bus.destination, {
      type: 'sine',
      startFreq: arcade ? 142 : 128,
      endFreq: 36,
      startOffsetSec: 0,
      durationSec: arcade ? 0.115 : 0.082,
      gain: arcade ? 0.56 : 0.42,
      attackSec: 0.0015,
    });
    scheduleFilteredNoise(bus.ctx, bus.destination, {
      filterType: 'lowpass',
      startFreq: 540,
      endFreq: 180,
      q: 1.2,
      startOffsetSec: 0,
      durationSec: 0.03,
      gain: arcade ? 0.46 : 0.34,
      attackSec: 0.001,
    });
    scheduleFilteredNoise(bus.ctx, bus.destination, {
      filterType: 'bandpass',
      startFreq: 1150,
      endFreq: 310,
      q: 1.1,
      startOffsetSec: 0.006,
      durationSec: arcade ? 0.105 : 0.055,
      gain: arcade ? 0.2 : 0.09,
      attackSec: 0.004,
    });
    if (arcade) {
      scheduleTone(bus.ctx, bus.destination, {
        type: 'triangle',
        startFreq: 330 * pitch,
        endFreq: 318 * pitch,
        startOffsetSec: 0.005,
        durationSec: 0.08,
        gain: 0.14,
      });
    }
  } catch {
    // Fail silently
  }
}

/**
 * Crisp hardware lock-in fifth for Save Session or Auto-Tag completion.
 */
export function playSessionFreeze(enabled?: boolean, mode?: MotionMode): void {
  if (!shouldPlay(enabled)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;

  const pitch = isArcade(mode) ? comboTracker.next().multiplier : 1;

  try {
    scheduleFilteredNoise(bus.ctx, bus.destination, {
      filterType: 'highpass',
      startFreq: 2400,
      startOffsetSec: 0,
      durationSec: 0.01,
      gain: 0.14,
    });
    scheduleTone(bus.ctx, bus.destination, {
      type: 'sine',
      startFreq: 587.33 * pitch,
      endFreq: 587.33 * pitch,
      startOffsetSec: 0,
      durationSec: 0.075,
      gain: 0.24,
    });
    scheduleTone(bus.ctx, bus.destination, {
      type: 'sine',
      startFreq: 880 * pitch,
      endFreq: 880 * pitch,
      startOffsetSec: 0.048,
      durationSec: 0.095,
      gain: 0.26,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Crisp metallic latch + warm harmonic ping when starring or landing AI tags.
 */
export function playTagPop(enabled?: boolean, mode?: MotionMode): void {
  if (!shouldPlay(enabled) || !isArcade(mode)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;

  const pitch = comboTracker.next().multiplier;

  try {
    scheduleFilteredNoise(bus.ctx, bus.destination, {
      filterType: 'highpass',
      startFreq: 2600,
      startOffsetSec: 0,
      durationSec: 0.008,
      gain: 0.14,
    });
    scheduleTone(bus.ctx, bus.destination, {
      type: 'sine',
      startFreq: 523.25 * pitch,
      endFreq: 530 * pitch,
      startOffsetSec: 0,
      durationSec: 0.065,
      gain: 0.22,
    });
    scheduleTone(bus.ctx, bus.destination, {
      type: 'triangle',
      startFreq: 1046.5 * pitch,
      endFreq: 1046.5 * pitch,
      startOffsetSec: 0.008,
      durationSec: 0.055,
      gain: 0.1,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Subtle matte cardstock / precision rotary detent brush on card hover.
 */
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
    scheduleFilteredNoise(bus.ctx, bus.destination, {
      filterType: 'bandpass',
      startFreq: 1850,
      endFreq: 1200,
      q: 2.2,
      startOffsetSec: 0,
      durationSec: 0.011,
      gain: 0.14,
      attackSec: 0.001,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Damped mechanical eject / discard click when deleting a link.
 */
export function playDelete(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;

  try {
    scheduleTone(bus.ctx, bus.destination, {
      type: 'triangle',
      startFreq: 195,
      endFreq: 54,
      startOffsetSec: 0,
      durationSec: 0.058,
      gain: 0.34,
    });
    scheduleFilteredNoise(bus.ctx, bus.destination, {
      filterType: 'lowpass',
      startFreq: 640,
      endFreq: 200,
      startOffsetSec: 0.006,
      durationSec: 0.042,
      gain: 0.22,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Solid muted rubber-bumper double-knock for duplicate-URL guard blocks.
 */
export function playError(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const bus = getReadyAudioBus();
  if (!bus) return;

  try {
    scheduleTone(bus.ctx, bus.destination, {
      type: 'sine',
      startFreq: 118,
      endFreq: 68,
      startOffsetSec: 0,
      durationSec: 0.048,
      gain: 0.36,
    });
    scheduleFilteredNoise(bus.ctx, bus.destination, {
      filterType: 'lowpass',
      startFreq: 380,
      startOffsetSec: 0,
      durationSec: 0.02,
      gain: 0.22,
    });
    scheduleTone(bus.ctx, bus.destination, {
      type: 'sine',
      startFreq: 98,
      endFreq: 58,
      startOffsetSec: 0.064,
      durationSec: 0.058,
      gain: 0.38,
    });
    scheduleFilteredNoise(bus.ctx, bus.destination, {
      filterType: 'lowpass',
      startFreq: 320,
      startOffsetSec: 0.064,
      durationSec: 0.022,
      gain: 0.22,
    });
  } catch {
    // Fail silently
  }
}
