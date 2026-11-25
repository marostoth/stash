import {
  createComboTracker,
  createCooldownGate,
  HOVER_RIFFLE_COOLDOWN_MS,
} from '@/lib/audio/combo';
import type { MotionMode } from '@/lib/types/stash';

type AudioContextCtor = new () => AudioContext;

let sharedContext: AudioContext | null = null;
let globalSoundEnabled = true;
let globalMotionMode: MotionMode = 'tactile';

const comboTracker = createComboTracker();
const hoverRiffleGate = createCooldownGate(HOVER_RIFFLE_COOLDOWN_MS);

function getAudioContextConstructor(): AudioContextCtor | undefined {
  const g = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext;
}

function getReadyContext(): AudioContext | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;

  try {
    if (!sharedContext || sharedContext.state === 'closed') {
      sharedContext = new Ctor();
    }
    if (sharedContext.state === 'suspended') {
      void sharedContext.resume().catch(() => {
        // Ignore autoplay policy rejections outside user gestures
      });
    }
    return sharedContext;
  } catch {
    return null;
  }
}

export function setSoundEffectsEnabled(enabled: boolean): void {
  globalSoundEnabled = enabled;
}

export function setFoleyMotionMode(mode: MotionMode): void {
  globalMotionMode = mode;
}

export function resetFoleyContextForTests(): void {
  sharedContext = null;
  globalSoundEnabled = true;
  globalMotionMode = 'tactile';
  comboTracker.reset();
  hoverRiffleGate.reset();
}

function shouldPlay(enabled?: boolean): boolean {
  return enabled ?? globalSoundEnabled;
}

function isArcade(mode?: MotionMode): boolean {
  return (mode ?? globalMotionMode) === 'arcade';
}

function scheduleTone(
  ctx: AudioContext,
  options: {
    type: OscillatorType;
    startFreq: number;
    endFreq: number;
    startOffsetSec: number;
    durationSec: number;
    gain: number;
  },
): void {
  const now = ctx.currentTime + options.startOffsetSec;
  const end = now + options.durationSec;

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = options.type;
  osc.frequency.setValueAtTime(options.startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(20, options.endFreq),
    end,
  );

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(options.gain, now + 0.0025);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(amp);
  amp.connect(ctx.destination);

  osc.start(now);
  osc.stop(end + 0.004);
}

/**
 * Soft, low mechanical switch click when picking up a card or tab to drag.
 */
export function playPickup(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const ctx = getReadyContext();
  if (!ctx) return;

  try {
    scheduleTone(ctx, {
      type: 'triangle',
      startFreq: 230,
      endFreq: 95,
      startOffsetSec: 0,
      durationSec: 0.024,
      gain: 0.075,
    });
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 1180,
      endFreq: 520,
      startOffsetSec: 0,
      durationSec: 0.014,
      gain: 0.028,
    });
  } catch {
    // Fail silently if Web Audio scheduling is blocked
  }
}

/**
 * Crisp, muted card-snap / thud on successful drop or manual link save.
 * In Arcade mode, rapid consecutive drops escalate musically up a pentatonic scale.
 */
export function playDrop(enabled?: boolean, mode?: MotionMode): void {
  if (!shouldPlay(enabled)) return;
  const ctx = getReadyContext();
  if (!ctx) return;

  const pitch = isArcade(mode) ? comboTracker.next().multiplier : 1;

  try {
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 175 * pitch,
      endFreq: 62 * pitch,
      startOffsetSec: 0,
      durationSec: 0.046,
      gain: 0.095,
    });
    scheduleTone(ctx, {
      type: 'triangle',
      startFreq: 860 * pitch,
      endFreq: 380 * pitch,
      startOffsetSec: 0,
      durationSec: 0.018,
      gain: 0.042,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Clean, subtle ascending phosphor chime for Save Session or Auto-Tag completion.
 * In Arcade mode, scales musically with the active combo tracker.
 */
export function playSessionFreeze(enabled?: boolean, mode?: MotionMode): void {
  if (!shouldPlay(enabled)) return;
  const ctx = getReadyContext();
  if (!ctx) return;

  const pitch = isArcade(mode) ? comboTracker.next().multiplier : 1;

  try {
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 659.25 * pitch,
      endFreq: 659.25 * pitch,
      startOffsetSec: 0,
      durationSec: 0.052,
      gain: 0.062,
    });
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 987.77 * pitch,
      endFreq: 987.77 * pitch,
      startOffsetSec: 0.042,
      durationSec: 0.06,
      gain: 0.068,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Crisp phosphor combo ping when AI auto-tags land on a card in Arcade mode.
 */
export function playTagPop(enabled?: boolean, mode?: MotionMode): void {
  if (!shouldPlay(enabled) || !isArcade(mode)) return;
  const ctx = getReadyContext();
  if (!ctx) return;

  const pitch = comboTracker.next().multiplier;

  try {
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 740 * pitch,
      endFreq: 880 * pitch,
      startOffsetSec: 0,
      durationSec: 0.04,
      gain: 0.048,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Whisper-quiet (~10ms envelope, 45ms cooldown) card-riffle tick on pointer-enter.
 * Strictly gated to Arcade mode + soundEffects enabled.
 */
export function playHoverRiffle(
  enabled?: boolean,
  mode?: MotionMode,
  nowMs?: number,
): boolean {
  if (!shouldPlay(enabled) || !isArcade(mode)) return false;
  if (!hoverRiffleGate.tryAcquire(nowMs)) return false;

  const ctx = getReadyContext();
  if (!ctx) return false;

  try {
    scheduleTone(ctx, {
      type: 'triangle',
      startFreq: 940,
      endFreq: 460,
      startOffsetSec: 0,
      durationSec: 0.01,
      gain: 0.03,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Subtle muted mechanical discard click when deleting a link via the action drawer.
 */
export function playDelete(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const ctx = getReadyContext();
  if (!ctx) return;

  try {
    scheduleTone(ctx, {
      type: 'triangle',
      startFreq: 190,
      endFreq: 58,
      startOffsetSec: 0,
      durationSec: 0.038,
      gain: 0.072,
    });
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 320,
      endFreq: 140,
      startOffsetSec: 0.008,
      durationSec: 0.022,
      gain: 0.035,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Soft muted low double-thump for duplicate-URL guard blocks.
 */
export function playError(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const ctx = getReadyContext();
  if (!ctx) return;

  try {
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 132,
      endFreq: 88,
      startOffsetSec: 0,
      durationSec: 0.036,
      gain: 0.08,
    });
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 112,
      endFreq: 76,
      startOffsetSec: 0.054,
      durationSec: 0.042,
      gain: 0.085,
    });
  } catch {
    // Fail silently
  }
}
