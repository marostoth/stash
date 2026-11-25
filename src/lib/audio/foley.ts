type AudioContextCtor = new () => AudioContext;

let sharedContext: AudioContext | null = null;
let globalSoundEnabled = true;

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

export function resetFoleyContextForTests(): void {
  sharedContext = null;
  globalSoundEnabled = true;
}

function shouldPlay(enabled?: boolean): boolean {
  return enabled ?? globalSoundEnabled;
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
  amp.gain.linearRampToValueAtTime(options.gain, now + 0.003);
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
 */
export function playDrop(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const ctx = getReadyContext();
  if (!ctx) return;

  try {
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 175,
      endFreq: 62,
      startOffsetSec: 0,
      durationSec: 0.046,
      gain: 0.095,
    });
    scheduleTone(ctx, {
      type: 'triangle',
      startFreq: 860,
      endFreq: 380,
      startOffsetSec: 0,
      durationSec: 0.018,
      gain: 0.042,
    });
  } catch {
    // Fail silently
  }
}

/**
 * Clean, subtle two-note ascending phosphor chime for Save Session or Auto-Tag completion.
 */
export function playSessionFreeze(enabled?: boolean): void {
  if (!shouldPlay(enabled)) return;
  const ctx = getReadyContext();
  if (!ctx) return;

  try {
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 659.25,
      endFreq: 659.25,
      startOffsetSec: 0,
      durationSec: 0.052,
      gain: 0.062,
    });
    scheduleTone(ctx, {
      type: 'sine',
      startFreq: 987.77,
      endFreq: 987.77,
      startOffsetSec: 0.042,
      durationSec: 0.06,
      gain: 0.068,
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
