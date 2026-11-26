type AudioContextCtor = new () => AudioContext;

export interface ReadyAudioBus {
  ctx: AudioContext;
  destination: AudioNode;
  punch: AudioNode;
  reverb: AudioNode;
}

let sharedContext: AudioContext | null = null;
let sharedMasterGain: GainNode | null = null;
let sharedPunchInput: AudioNode | null = null;
let sharedReverbInput: AudioNode | null = null;
let sharedWhiteNoise: AudioBuffer | null = null;
let sharedBrownNoise: AudioBuffer | null = null;
let masterVolume = 0.75; // Normalized 0..1 (matches DEFAULT_SETTINGS.soundVolume = 75)

function getAudioContextConstructor(): AudioContextCtor | undefined {
  const g = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext;
}

/**
 * Returns a subtle ±amount pitch/filter multiplier so consecutive impacts
 * sound organic rather than identical.
 */
export function jitter(amount = 0.045): number {
  return 1 + (Math.random() * 2 - 1) * amount;
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
  sharedPunchInput = null;
  sharedReverbInput = null;
  sharedWhiteNoise = null;
  sharedBrownNoise = null;
  masterVolume = 0.75;
}

function buildSoftClipCurve(drive = 4.6): Float32Array<ArrayBuffer> {
  const samples = 512;
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Slight asymmetry adds warm even-order harmonics that punch on small speakers
    curve[i] = Math.tanh((x + 0.08 * x * x) * drive) / norm;
  }
  return curve;
}

function buildDarkHallImpulse(ctx: AudioContext): AudioBuffer | null {
  if (typeof ctx.createBuffer !== 'function') return null;
  const sampleRate = ctx.sampleRate || 44_100;
  const durationSec = 1.15;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  const earlyTapsLeft = [0.011, 0.023, 0.041, 0.067];
  const earlyTapsRight = [0.014, 0.029, 0.049, 0.074];

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const decay = (1 - t) ** 2.35;
      const white = Math.random() * 2 - 1;
      const alpha = 0.1 + 0.34 * (1 - t);
      lp = lp + alpha * (white - lp);
      data[i] = lp * decay * 0.88;
    }
    const taps = ch === 0 ? earlyTapsLeft : earlyTapsRight;
    taps.forEach((sec, idx) => {
      const sampleIdx = Math.floor(sampleRate * sec);
      if (sampleIdx < length) {
        const amp = 0.46 * (1 - idx * 0.18);
        data[sampleIdx] = (data[sampleIdx] ?? 0) + (idx % 2 === 0 ? amp : -amp);
      }
    });
  }
  return buffer;
}

export function getReadyAudioBus(): ReadyAudioBus | null {
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;

  try {
    if (!sharedContext || sharedContext.state === 'closed') {
      sharedContext = new Ctor();
      sharedWhiteNoise = null;
      sharedBrownNoise = null;

      sharedMasterGain = sharedContext.createGain();
      sharedMasterGain.gain.setValueAtTime(
        masterVolume,
        sharedContext.currentTime,
      );

      // 14ms compressor attack lets explosive impact transients punch straight through
      let masterOut: AudioNode = sharedContext.destination;
      if (typeof sharedContext.createDynamicsCompressor === 'function') {
        const comp = sharedContext.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-7, sharedContext.currentTime);
        comp.knee.setValueAtTime(10, sharedContext.currentTime);
        comp.ratio.setValueAtTime(4.5, sharedContext.currentTime);
        comp.attack.setValueAtTime(0.014, sharedContext.currentTime);
        comp.release.setValueAtTime(0.11, sharedContext.currentTime);
        comp.connect(sharedContext.destination);
        masterOut = comp;
      }
      sharedMasterGain.connect(masterOut);

      // Stereo Dark Stone Hall Convolver reverb bus
      if (typeof sharedContext.createConvolver === 'function') {
        const reverbIn = sharedContext.createGain();
        reverbIn.gain.setValueAtTime(1.15, sharedContext.currentTime);
        const convolver = sharedContext.createConvolver();
        const ir = buildDarkHallImpulse(sharedContext);
        if (ir) {
          convolver.buffer = ir;
          reverbIn.connect(convolver);
          convolver.connect(sharedMasterGain);
          sharedReverbInput = reverbIn;
        } else {
          sharedReverbInput = sharedMasterGain;
        }
      } else {
        sharedReverbInput = sharedMasterGain;
      }

      // Punch bus: high-drive WaveShaper saturator + warm low-shelf bass boost
      if (typeof sharedContext.createWaveShaper === 'function') {
        const punchIn = sharedContext.createGain();
        punchIn.gain.setValueAtTime(1.45, sharedContext.currentTime);
        const shaper = sharedContext.createWaveShaper();
        shaper.curve = buildSoftClipCurve(4.6);
        shaper.oversample = '2x';
        punchIn.connect(shaper);

        if (typeof sharedContext.createBiquadFilter === 'function') {
          const lowShelf = sharedContext.createBiquadFilter();
          lowShelf.type = 'lowshelf';
          lowShelf.frequency.setValueAtTime(118, sharedContext.currentTime);
          lowShelf.gain.setValueAtTime(6.0, sharedContext.currentTime);
          shaper.connect(lowShelf);
          lowShelf.connect(sharedMasterGain);
        } else {
          shaper.connect(sharedMasterGain);
        }
        sharedPunchInput = punchIn;
      } else {
        sharedPunchInput = sharedMasterGain;
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

    const dry = sharedMasterGain ?? sharedContext.destination;
    return {
      ctx: sharedContext,
      destination: dry,
      punch: sharedPunchInput ?? dry,
      reverb: sharedReverbInput ?? dry,
    };
  } catch {
    return null;
  }
}

function getNoiseBuffer(
  ctx: AudioContext,
  color: 'white' | 'brown' = 'white',
): AudioBuffer | null {
  if (color === 'white' && sharedWhiteNoise) return sharedWhiteNoise;
  if (color === 'brown' && sharedBrownNoise) return sharedBrownNoise;
  if (typeof ctx.createBuffer !== 'function') return null;

  const sampleRate = ctx.sampleRate || 44_100;
  const length = Math.floor(sampleRate * (color === 'brown' ? 0.85 : 0.45));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (color === 'brown') {
    let acc = 0;
    let peak = 0.001;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      acc = (acc + 0.052 * white) / 1.052;
      data[i] = acc;
      const abs = Math.abs(acc);
      if (abs > peak) peak = abs;
    }
    const scale = 0.96 / peak;
    for (let i = 0; i < length; i++) {
      data[i] = (data[i] ?? 0) * scale;
    }
    sharedBrownNoise = buffer;
    return buffer;
  }

  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.2 + white * 0.8;
    data[i] = last;
  }
  sharedWhiteNoise = buffer;
  return buffer;
}

function routeOutput(
  ctx: AudioContext,
  source: AudioNode,
  destination: AudioNode,
  options: {
    pan?: number;
    reverbNode?: AudioNode;
    reverbSend?: number;
  },
): void {
  let out: AudioNode = source;
  if (
    options.pan !== undefined &&
    options.pan !== 0 &&
    typeof ctx.createStereoPanner === 'function'
  ) {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(
      Math.max(-1, Math.min(1, options.pan)),
      ctx.currentTime,
    );
    source.connect(panner);
    out = panner;
  }

  out.connect(destination);

  if (
    options.reverbNode &&
    options.reverbSend &&
    options.reverbSend > 0 &&
    options.reverbNode !== destination
  ) {
    const sendGain = ctx.createGain();
    sendGain.gain.setValueAtTime(options.reverbSend, ctx.currentTime);
    out.connect(sendGain);
    sendGain.connect(options.reverbNode);
  }
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
    pan?: number;
    reverbNode?: AudioNode;
    reverbSend?: number;
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
    Math.max(18, options.endFreq),
    end,
  );

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(options.gain, now + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(amp);
  routeOutput(ctx, amp, destination, options);

  osc.start(now);
  osc.stop(end + 0.01);
}

export function scheduleFilteredNoise(
  ctx: AudioContext,
  destination: AudioNode,
  options: {
    color?: 'white' | 'brown';
    filterType: BiquadFilterType;
    startFreq: number;
    endFreq?: number;
    q?: number;
    startOffsetSec: number;
    durationSec: number;
    gain: number;
    attackSec?: number;
    pan?: number;
    reverbNode?: AudioNode;
    reverbSend?: number;
  },
): void {
  if (
    typeof ctx.createBufferSource !== 'function' ||
    typeof ctx.createBiquadFilter !== 'function'
  ) {
    return;
  }
  const buffer = getNoiseBuffer(ctx, options.color ?? 'white');
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
      Math.max(35, options.endFreq),
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
  routeOutput(ctx, amp, destination, options);

  src.start(now);
  src.stop(end + 0.01);
}

/**
 * 2-operator inharmonic FM synthesis for metallic iron latches, stone slabs,
 * forged armor clangs, and crystalline gem chimes.
 */
export function scheduleFmClang(
  ctx: AudioContext,
  destination: AudioNode,
  options: {
    carrierFreq: number;
    endCarrierFreq?: number;
    modRatio: number;
    modIndex: number;
    startOffsetSec: number;
    durationSec: number;
    gain: number;
    attackSec?: number;
    pan?: number;
    reverbNode?: AudioNode;
    reverbSend?: number;
  },
): void {
  const now = ctx.currentTime + options.startOffsetSec;
  const end = now + options.durationSec;
  const attack = options.attackSec ?? 0.0015;

  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const amp = ctx.createGain();

  carrier.type = 'sine';
  mod.type = 'sine';

  carrier.frequency.setValueAtTime(options.carrierFreq, now);
  if (
    options.endCarrierFreq !== undefined &&
    options.endCarrierFreq !== options.carrierFreq
  ) {
    carrier.frequency.exponentialRampToValueAtTime(
      Math.max(24, options.endCarrierFreq),
      end,
    );
  }

  mod.frequency.setValueAtTime(options.carrierFreq * options.modRatio, now);
  modGain.gain.setValueAtTime(options.modIndex, now);
  modGain.gain.exponentialRampToValueAtTime(
    Math.max(1, options.modIndex * 0.06),
    end,
  );

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(options.gain, now + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);

  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(amp);
  routeOutput(ctx, amp, destination, options);

  carrier.start(now);
  mod.start(now);
  carrier.stop(end + 0.01);
  mod.stop(end + 0.01);
}
