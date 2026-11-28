import {
  computeJitter,
  VOICE_CHOKE_FADE_SEC,
  volumePercentToGain,
} from '@/lib/audio/audio-math';
import { resetNoiseBuffers } from '@/lib/audio/audio-synth';

export {
  scheduleFilteredNoise,
  scheduleFmClang,
  scheduleTone,
} from '@/lib/audio/audio-synth';

type AudioContextCtor = new () => AudioContext;

export interface ReadyAudioBus {
  ctx: AudioContext;
  destination: AudioNode;
  punch: AudioNode;
  reverb: AudioNode;
  isChoked?: () => boolean;
}

export interface ChokableVoiceBus {
  bus: ReadyAudioBus;
  choke: (nowSec: number) => void;
  dispose: () => void;
}

const DEFAULT_VOLUME_PERCENT = 75;
const SUB_HIGHPASS_HZ = 35;

let sharedContext: AudioContext | null = null;
let sharedMasterGain: GainNode | null = null;
let sharedBusInput: AudioNode | null = null;
let sharedPunchInput: AudioNode | null = null;
let sharedReverbInput: AudioNode | null = null;
let masterVolume = volumePercentToGain(DEFAULT_VOLUME_PERCENT);
const pendingGateCleanupTimers = new Set<ReturnType<typeof setTimeout>>();

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
export function jitter(amount = 0.025): number {
  return computeJitter(amount);
}

export function getMasterVolume(): number {
  return masterVolume;
}

export function setMasterVolumePercent(percent: number): void {
  masterVolume = volumePercentToGain(percent);
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
  for (const timer of pendingGateCleanupTimers) {
    clearTimeout(timer);
  }
  pendingGateCleanupTimers.clear();
  sharedContext = null;
  sharedMasterGain = null;
  sharedBusInput = null;
  sharedPunchInput = null;
  sharedReverbInput = null;
  resetNoiseBuffers();
  masterVolume = volumePercentToGain(DEFAULT_VOLUME_PERCENT);
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
      resetNoiseBuffers();

      const t0 = sharedContext.currentTime;

      // Master bus chain:
      // all voices -> 35Hz highpass -> soft-limiter compressor -> masterGain -> destination
      sharedMasterGain = sharedContext.createGain();
      sharedMasterGain.gain.setValueAtTime(masterVolume, t0);
      sharedMasterGain.connect(sharedContext.destination);

      let busEntry: AudioNode = sharedMasterGain;

      if (typeof sharedContext.createDynamicsCompressor === 'function') {
        const limiter = sharedContext.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-6, t0);
        limiter.knee.setValueAtTime(12, t0);
        limiter.ratio.setValueAtTime(8, t0);
        limiter.attack.setValueAtTime(0.003, t0);
        limiter.release.setValueAtTime(0.12, t0);
        limiter.connect(busEntry);
        busEntry = limiter;
      }

      if (typeof sharedContext.createBiquadFilter === 'function') {
        const highpass = sharedContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.setValueAtTime(SUB_HIGHPASS_HZ, t0);
        highpass.Q.setValueAtTime(Math.SQRT1_2, t0);
        highpass.connect(busEntry);
        busEntry = highpass;
      }

      sharedBusInput = busEntry;

      // Stereo Dark Stone Hall Convolver reverb bus -> feeds sharedBusInput
      if (typeof sharedContext.createConvolver === 'function') {
        const reverbIn = sharedContext.createGain();
        reverbIn.gain.setValueAtTime(1.15, t0);
        const convolver = sharedContext.createConvolver();
        const ir = buildDarkHallImpulse(sharedContext);
        if (ir) {
          convolver.buffer = ir;
          reverbIn.connect(convolver);
          convolver.connect(busEntry);
          sharedReverbInput = reverbIn;
        } else {
          sharedReverbInput = busEntry;
        }
      } else {
        sharedReverbInput = busEntry;
      }

      // Punch bus: high-drive WaveShaper saturator + warm low-shelf -> feeds sharedBusInput
      if (typeof sharedContext.createWaveShaper === 'function') {
        const punchIn = sharedContext.createGain();
        punchIn.gain.setValueAtTime(1.45, t0);
        const shaper = sharedContext.createWaveShaper();
        shaper.curve = buildSoftClipCurve(4.6);
        shaper.oversample = '2x';
        punchIn.connect(shaper);

        if (typeof sharedContext.createBiquadFilter === 'function') {
          const lowShelf = sharedContext.createBiquadFilter();
          lowShelf.type = 'lowshelf';
          lowShelf.frequency.setValueAtTime(118, t0);
          lowShelf.gain.setValueAtTime(6.0, t0);
          shaper.connect(lowShelf);
          lowShelf.connect(busEntry);
        } else {
          shaper.connect(busEntry);
        }
        sharedPunchInput = punchIn;
      } else {
        sharedPunchInput = busEntry;
      }
    }

    if (sharedContext.state === 'suspended') {
      void sharedContext.resume().catch(() => {
        // Ignore autoplay policy rejections outside user gestures
      });
    }

    // Never queue nodes while suspended (e.g. hovering cards before first user click),
    // otherwise all queued sounds blast simultaneously at t=0 on first click.
    if (sharedContext.state !== 'running') {
      return null;
    }

    if (sharedMasterGain) {
      sharedMasterGain.gain.setValueAtTime(
        masterVolume,
        sharedContext.currentTime,
      );
    }

    const dry = sharedBusInput ?? sharedMasterGain ?? sharedContext.destination;
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

function fadeOutGainNode(node: GainNode, nowSec: number): void {
  try {
    const param = node.gain;
    if (typeof param.cancelScheduledValues === 'function') {
      param.cancelScheduledValues(nowSec);
    }
    const startVal =
      typeof param.value === 'number' &&
      Number.isFinite(param.value) &&
      param.value > 0.0001
        ? param.value
        : 1;
    param.setValueAtTime(startVal, nowSec);
    param.linearRampToValueAtTime(0.0001, nowSec + VOICE_CHOKE_FADE_SEC);
    param.linearRampToValueAtTime(0, nowSec + VOICE_CHOKE_FADE_SEC + 0.003);
  } catch {
    // Ignore audio param errors in restricted contexts
  }
}

function disconnectNodeSafe(node: AudioNode): void {
  try {
    if (typeof node.disconnect === 'function') {
      node.disconnect();
    }
  } catch {
    // Ignore already-disconnected node errors
  }
}

/**
 * Wraps the shared bus in per-voice gain gates so rapid re-triggers of heavy
 * tails can smoothly choke the oldest active voice over 18ms without clicking,
 * and disconnects gates once choked or after natural tail expiry so persistent
 * master bus nodes never accumulate orphaned GainNodes.
 */
export function createChokableVoiceBus(
  bus: ReadyAudioBus,
  initialGain = 1,
  tailSec = 0.65,
): ChokableVoiceBus {
  const t0 = bus.ctx.currentTime;
  const safeGain = Math.max(0.0001, Math.min(2, initialGain));
  const gates: GainNode[] = [];
  let choked = false;
  let disposed = false;
  let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  const makeGate = (target: AudioNode): GainNode => {
    const gate = bus.ctx.createGain();
    gate.gain.setValueAtTime(safeGain, t0);
    gate.connect(target);
    gates.push(gate);
    return gate;
  };

  const dryGate = makeGate(bus.destination);
  const punchGate =
    bus.punch === bus.destination ? dryGate : makeGate(bus.punch);
  const reverbGate =
    bus.reverb === bus.destination ? dryGate : makeGate(bus.reverb);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    choked = true;
    if (cleanupTimer !== null) {
      clearTimeout(cleanupTimer);
      pendingGateCleanupTimers.delete(cleanupTimer);
      cleanupTimer = null;
    }
    for (const gate of gates) {
      disconnectNodeSafe(gate);
    }
  };

  const scheduleDisconnect = (delaySec: number) => {
    if (cleanupTimer !== null) {
      clearTimeout(cleanupTimer);
      pendingGateCleanupTimers.delete(cleanupTimer);
    }
    const timer = setTimeout(
      () => {
        pendingGateCleanupTimers.delete(timer);
        cleanupTimer = null;
        dispose();
      },
      Math.max(10, Math.ceil(delaySec * 1000)),
    );
    cleanupTimer = timer;
    pendingGateCleanupTimers.add(timer);
  };

  // Auto-disconnect voice gates after the voice's natural tail expires
  scheduleDisconnect(Math.max(0.05, tailSec) + 0.15);

  return {
    bus: {
      ctx: bus.ctx,
      destination: dryGate,
      punch: punchGate,
      reverb: reverbGate,
      isChoked: () => choked || disposed,
    },
    choke(nowSec: number) {
      if (choked) return;
      choked = true;
      for (const gate of gates) {
        fadeOutGainNode(gate, nowSec);
      }
      scheduleDisconnect(VOICE_CHOKE_FADE_SEC + 0.04);
    },
    dispose,
  };
}
