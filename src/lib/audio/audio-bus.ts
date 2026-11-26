type AudioContextCtor = new () => AudioContext;

let sharedContext: AudioContext | null = null;
let sharedMasterGain: GainNode | null = null;
let sharedNoiseBuffer: AudioBuffer | null = null;
let masterVolume = 0.75; // Normalized 0..1 (matches DEFAULT_SETTINGS.soundVolume = 75)

function getAudioContextConstructor(): AudioContextCtor | undefined {
  const g = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext;
}

export function getMasterVolume(): number {
  return masterVolume;
}

export function setMasterVolumePercent(percent: number): void {
  const clamped = Number.isFinite(percent)
    ? Math.max(0, Math.min(100, percent))
    : 75;
  masterVolume = clamped / 100;
  if (sharedContext && sharedMasterGain && sharedContext.state !== 'closed') {
    try {
      sharedMasterGain.gain.setValueAtTime(
        masterVolume,
        sharedContext.currentTime,
      );
    } catch {
      // Ignore audio param errors in restricted contexts
    }
  }
}

export function resetAudioBusForTests(): void {
  sharedContext = null;
  sharedMasterGain = null;
  sharedNoiseBuffer = null;
  masterVolume = 0.75;
}

export function getReadyAudioBus(): {
  ctx: AudioContext;
  destination: AudioNode;
} | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;

  try {
    if (!sharedContext || sharedContext.state === 'closed') {
      sharedContext = new Ctor();
      sharedNoiseBuffer = null;
      sharedMasterGain = sharedContext.createGain();
      sharedMasterGain.gain.setValueAtTime(
        masterVolume,
        sharedContext.currentTime,
      );

      if (typeof sharedContext.createDynamicsCompressor === 'function') {
        const comp = sharedContext.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-12, sharedContext.currentTime);
        comp.knee.setValueAtTime(14, sharedContext.currentTime);
        comp.ratio.setValueAtTime(5, sharedContext.currentTime);
        comp.attack.setValueAtTime(0.002, sharedContext.currentTime);
        comp.release.setValueAtTime(0.08, sharedContext.currentTime);
        sharedMasterGain.connect(comp);
        comp.connect(sharedContext.destination);
      } else {
        sharedMasterGain.connect(sharedContext.destination);
      }
    }

    if (sharedContext.state === 'suspended') {
      void sharedContext.resume().catch(() => {
        // Ignore autoplay policy rejections outside user gestures
      });
    }

    if (sharedMasterGain) {
      sharedMasterGain.gain.setValueAtTime(
        masterVolume,
        sharedContext.currentTime,
      );
    }

    return {
      ctx: sharedContext,
      destination: sharedMasterGain ?? sharedContext.destination,
    };
  } catch {
    return null;
  }
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer | null {
  if (sharedNoiseBuffer) return sharedNoiseBuffer;
  if (typeof ctx.createBuffer !== 'function') return null;

  const sampleRate = ctx.sampleRate || 44_100;
  const length = Math.floor(sampleRate * 0.35);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.25 + white * 0.75;
    data[i] = last;
  }
  sharedNoiseBuffer = buffer;
  return buffer;
}

export function scheduleTone(
  ctx: AudioContext,
  destination: AudioNode,
  options: {
    type: OscillatorType;
    startFreq: number;
    endFreq: number;
    startOffsetSec: number;
    durationSec: number;
    gain: number;
    attackSec?: number;
  },
): void {
  const now = ctx.currentTime + options.startOffsetSec;
  const end = now + options.durationSec;
  const attack = options.attackSec ?? 0.002;

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = options.type;
  osc.frequency.setValueAtTime(options.startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(20, options.endFreq),
    end,
  );

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(options.gain, now + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(amp);
  amp.connect(destination);

  osc.start(now);
  osc.stop(end + 0.005);
}

export function scheduleFilteredNoise(
  ctx: AudioContext,
  destination: AudioNode,
  options: {
    filterType: BiquadFilterType;
    startFreq: number;
    endFreq?: number;
    q?: number;
    startOffsetSec: number;
    durationSec: number;
    gain: number;
    attackSec?: number;
  },
): void {
  if (
    typeof ctx.createBufferSource !== 'function' ||
    typeof ctx.createBiquadFilter !== 'function'
  ) {
    return;
  }
  const buffer = getNoiseBuffer(ctx);
  if (!buffer) return;

  const now = ctx.currentTime + options.startOffsetSec;
  const end = now + options.durationSec;
  const attack = options.attackSec ?? 0.0015;

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = options.filterType;
  filter.frequency.setValueAtTime(options.startFreq, now);
  if (options.endFreq !== undefined && options.endFreq !== options.startFreq) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, options.endFreq),
      end,
    );
  }
  if (options.q !== undefined) {
    filter.Q.setValueAtTime(options.q, now);
  }

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(options.gain, now + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);

  src.connect(filter);
  filter.connect(amp);
  amp.connect(destination);

  src.start(now);
  src.stop(end + 0.006);
}
