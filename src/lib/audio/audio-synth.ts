let sharedWhiteNoise: AudioBuffer | null = null;
let sharedBrownNoise: AudioBuffer | null = null;

export function resetNoiseBuffers(): void {
  sharedWhiteNoise = null;
  sharedBrownNoise = null;
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

function disconnectNodes(...nodes: Array<AudioNode | null | undefined>): void {
  for (const node of nodes) {
    if (!node || typeof node.disconnect !== 'function') continue;
    try {
      node.disconnect();
    } catch {
      // Ignore already-disconnected node errors
    }
  }
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
): AudioNode[] {
  const created: AudioNode[] = [];
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
    created.push(panner);
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
    created.push(sendGain);
  }
  return created;
}

/**
 * Click-free ADSR-style decay envelope: ramps cleanly from 0.0001 -> peak ->
 * 0.0001 by `end`, then linearly to 0 before source `stop()` so DC pops never
 * occur on short bursts or steep low-end sweeps.
 */
function applyAntiPopEnvelope(
  amp: GainNode,
  now: number,
  durationSec: number,
  peakGain: number,
  requestedAttackSec: number,
): number {
  const safeDuration = Math.max(0.003, durationSec);
  const attack = Math.min(
    Math.max(0.0004, requestedAttackSec),
    safeDuration * 0.35,
  );
  const safeGain = Math.max(0.0002, peakGain);
  const end = now + safeDuration;

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.linearRampToValueAtTime(safeGain, now + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);
  amp.gain.linearRampToValueAtTime(0, end + 0.004);
  return end;
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
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  const end = applyAntiPopEnvelope(
    amp,
    now,
    options.durationSec,
    options.gain,
    options.attackSec ?? 0.002,
  );

  const safeStartFreq = Math.max(18, options.startFreq);
  const safeEndFreq = Math.max(18, options.endFreq);

  osc.type = options.type;
  osc.frequency.setValueAtTime(safeStartFreq, now);
  if (safeEndFreq !== safeStartFreq) {
    osc.frequency.exponentialRampToValueAtTime(safeEndFreq, end);
  }

  osc.connect(amp);
  const routed = routeOutput(ctx, amp, destination, options);
  osc.onended = () => {
    disconnectNodes(osc, amp, ...routed);
  };

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
  const amp = ctx.createGain();
  const end = applyAntiPopEnvelope(
    amp,
    now,
    options.durationSec,
    options.gain,
    options.attackSec ?? 0.0015,
  );

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = options.filterType;
  filter.frequency.setValueAtTime(Math.max(35, options.startFreq), now);
  if (options.endFreq !== undefined && options.endFreq !== options.startFreq) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(35, options.endFreq),
      end,
    );
  }
  if (options.q !== undefined) {
    filter.Q.setValueAtTime(options.q, now);
  }

  src.connect(filter);
  filter.connect(amp);
  const routed = routeOutput(ctx, amp, destination, options);
  src.onended = () => {
    disconnectNodes(src, filter, amp, ...routed);
  };

  // Randomize read phase into the shared noise buffer so rapid repeats never comb-filter
  const maxOffset =
    typeof buffer.duration === 'number'
      ? Math.max(0, buffer.duration - options.durationSec - 0.02)
      : 0;
  if (maxOffset > 0.01) {
    src.start(now, Math.random() * maxOffset);
  } else {
    src.start(now);
  }
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
  const carrier = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const amp = ctx.createGain();
  const end = applyAntiPopEnvelope(
    amp,
    now,
    options.durationSec,
    options.gain,
    options.attackSec ?? 0.0015,
  );

  carrier.type = 'sine';
  mod.type = 'sine';

  const safeCarrier = Math.max(24, options.carrierFreq);
  carrier.frequency.setValueAtTime(safeCarrier, now);
  if (
    options.endCarrierFreq !== undefined &&
    options.endCarrierFreq !== options.carrierFreq
  ) {
    carrier.frequency.exponentialRampToValueAtTime(
      Math.max(24, options.endCarrierFreq),
      end,
    );
  }

  mod.frequency.setValueAtTime(safeCarrier * options.modRatio, now);
  modGain.gain.setValueAtTime(Math.max(1, options.modIndex), now);
  modGain.gain.exponentialRampToValueAtTime(
    Math.max(1, options.modIndex * 0.06),
    end,
  );

  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(amp);
  const routed = routeOutput(ctx, amp, destination, options);
  carrier.onended = () => {
    disconnectNodes(carrier, mod, modGain, amp, ...routed);
  };

  carrier.start(now);
  mod.start(now);
  carrier.stop(end + 0.01);
  mod.stop(end + 0.01);
}
