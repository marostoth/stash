import {
  jitter,
  scheduleFilteredNoise,
  scheduleFmClang,
  scheduleTone,
} from '@/lib/audio/audio-bus';
import type { SoundPackRecipe } from '@/lib/audio/sound-packs';

/**
 * Heavy Stone & Iron cinematic sound pack:
 * high-drive sub-bass shockwaves, wide stereo brown-noise concussion blasts,
 * inharmonic FM forged iron & crystal chimes, stereo scattering dust/stone grit,
 * and lush dark stone-hall reverb.
 */
export const ARPG_HEAVY_PACK: SoundPackRecipe = {
  pickup({ ctx, destination, punch, reverb }) {
    const j = jitter(0.05);
    scheduleFilteredNoise(ctx, destination, {
      color: 'brown',
      filterType: 'bandpass',
      startFreq: 340 * j,
      endFreq: 1050 * j,
      q: 1.5,
      startOffsetSec: 0,
      durationSec: 0.06,
      gain: 0.42,
      reverbNode: reverb,
      reverbSend: 0.35,
    });
    scheduleFmClang(ctx, punch, {
      carrierFreq: 320 * j,
      endCarrierFreq: 510 * j,
      modRatio: 2.38,
      modIndex: 150,
      startOffsetSec: 0.004,
      durationSec: 0.042,
      gain: 0.3,
      reverbNode: reverb,
      reverbSend: 0.3,
    });
  },

  drop({ ctx, destination, punch, reverb, arcade, pitch }) {
    const j = jitter(0.055);
    const heavy = arcade ? 1 : 0.78;

    // 1. Stereo stone-fracture snap (instant tactile bite)
    scheduleFilteredNoise(ctx, punch, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 2100 * j,
      endFreq: 380 * j,
      q: 1.1,
      startOffsetSec: 0,
      durationSec: 0.024,
      gain: 0.72 * heavy,
      attackSec: 0.0008,
      pan: -0.25,
      reverbNode: reverb,
      reverbSend: 0.42,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1650 * j,
      endFreq: 320 * j,
      q: 1.2,
      startOffsetSec: 0.003,
      durationSec: 0.028,
      gain: 0.64 * heavy,
      attackSec: 0.0008,
      pan: 0.25,
      reverbNode: reverb,
      reverbSend: 0.42,
    });

    // 2. Massive seismic sub-drop (165 Hz -> 22 Hz driven hard through punch saturator)
    scheduleTone(ctx, punch, {
      type: 'sine',
      startFreq: (arcade ? 168 : 132) * j,
      endFreq: 22,
      startOffsetSec: 0,
      durationSec: arcade ? 0.32 : 0.17,
      gain: 1.0 * heavy,
      attackSec: 0.001,
      reverbNode: reverb,
      reverbSend: arcade ? 0.65 : 0.35,
    });

    // 3. Wide stereo concussion blast (brown noise resonant lowpass sweep)
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'lowpass',
      startFreq: (arcade ? 1150 : 620) * j,
      endFreq: 48,
      q: 2.5,
      startOffsetSec: 0.001,
      durationSec: arcade ? 0.38 : 0.18,
      gain: 0.96 * heavy,
      attackSec: 0.002,
      pan: -0.32,
      reverbNode: reverb,
      reverbSend: arcade ? 0.78 : 0.4,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'lowpass',
      startFreq: (arcade ? 980 : 540) * j,
      endFreq: 44,
      q: 2.4,
      startOffsetSec: 0.006,
      durationSec: arcade ? 0.4 : 0.19,
      gain: 0.9 * heavy,
      attackSec: 0.003,
      pan: 0.32,
      reverbNode: reverb,
      reverbSend: arcade ? 0.78 : 0.4,
    });

    // 4. Forged iron / heavy stone slab anvil resonance (inharmonic FM)
    scheduleFmClang(ctx, punch, {
      carrierFreq: 162 * j,
      endCarrierFreq: 58 * j,
      modRatio: 2.41,
      modIndex: 340,
      startOffsetSec: 0.003,
      durationSec: arcade ? 0.17 : 0.095,
      gain: 0.42 * heavy,
      reverbNode: reverb,
      reverbSend: 0.58,
    });

    if (arcade) {
      // 5. Stereo scattering dust plumes & stone grit trailing outward
      const grit = [
        { offset: 0.032, freq: 2700, dur: 0.034, gain: 0.28, pan: -0.65 },
        { offset: 0.058, freq: 1950, dur: 0.042, gain: 0.24, pan: 0.68 },
        { offset: 0.095, freq: 1320, dur: 0.054, gain: 0.2, pan: -0.48 },
        { offset: 0.138, freq: 880, dur: 0.068, gain: 0.16, pan: 0.52 },
      ];
      for (const grain of grit) {
        scheduleFilteredNoise(ctx, destination, {
          color: 'white',
          filterType: 'bandpass',
          startFreq: grain.freq * j,
          endFreq: grain.freq * 0.42 * j,
          q: 1.9,
          startOffsetSec: grain.offset,
          durationSec: grain.dur,
          gain: grain.gain,
          pan: grain.pan,
          reverbNode: reverb,
          reverbSend: 0.64,
        });
      }

      // 6. Dark resonant combo iron ring
      scheduleFmClang(ctx, destination, {
        carrierFreq: 293.66 * pitch,
        endCarrierFreq: 286 * pitch,
        modRatio: 2.0,
        modIndex: 75,
        startOffsetSec: 0.016,
        durationSec: 0.22,
        gain: 0.16,
        reverbNode: reverb,
        reverbSend: 0.72,
      });
    }
  },

  sessionFreeze({ ctx, destination, punch, reverb, pitch }) {
    const j = jitter(0.03);
    scheduleTone(ctx, punch, {
      type: 'sine',
      startFreq: 138 * j,
      endFreq: 24,
      startOffsetSec: 0,
      durationSec: 0.38,
      gain: 0.95,
      reverbNode: reverb,
      reverbSend: 0.78,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'lowpass',
      startFreq: 760,
      endFreq: 56,
      q: 2.2,
      startOffsetSec: 0,
      durationSec: 0.34,
      gain: 0.85,
      reverbNode: reverb,
      reverbSend: 0.75,
    });
    scheduleFmClang(ctx, destination, {
      carrierFreq: 220 * pitch,
      endCarrierFreq: 214 * pitch,
      modRatio: 2.76,
      modIndex: 190,
      startOffsetSec: 0.022,
      durationSec: 0.36,
      gain: 0.28,
      pan: -0.25,
      reverbNode: reverb,
      reverbSend: 0.85,
    });
    scheduleFmClang(ctx, destination, {
      carrierFreq: 329.63 * pitch,
      endCarrierFreq: 329.63 * pitch,
      modRatio: 2.0,
      modIndex: 85,
      startOffsetSec: 0.072,
      durationSec: 0.44,
      gain: 0.24,
      pan: 0.25,
      reverbNode: reverb,
      reverbSend: 0.9,
    });
  },

  tagPop({ ctx, destination, reverb, pitch }) {
    const j = jitter(0.025);
    scheduleFmClang(ctx, destination, {
      carrierFreq: 783.99 * pitch * j,
      modRatio: 2.756,
      modIndex: 380,
      startOffsetSec: 0,
      durationSec: 0.34,
      gain: 0.32,
      pan: -0.2,
      reverbNode: reverb,
      reverbSend: 0.88,
    });
    scheduleFmClang(ctx, destination, {
      carrierFreq: 1174.66 * pitch * j,
      modRatio: 1.995,
      modIndex: 220,
      startOffsetSec: 0.036,
      durationSec: 0.42,
      gain: 0.28,
      pan: 0.22,
      reverbNode: reverb,
      reverbSend: 0.92,
    });
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'highpass',
      startFreq: 4800,
      startOffsetSec: 0,
      durationSec: 0.018,
      gain: 0.2,
      reverbNode: reverb,
      reverbSend: 0.55,
    });
  },

  hoverRiffle({ ctx, destination, reverb }) {
    const j = jitter(0.08);
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1350 * j,
      endFreq: 780 * j,
      q: 2.1,
      startOffsetSec: 0,
      durationSec: 0.013,
      gain: 0.14,
      reverbNode: reverb,
      reverbSend: 0.22,
    });
  },

  delete({ ctx, punch, reverb }) {
    const j = jitter(0.05);
    scheduleFmClang(ctx, punch, {
      carrierFreq: 580 * j,
      endCarrierFreq: 98 * j,
      modRatio: 2.62,
      modIndex: 340,
      startOffsetSec: 0,
      durationSec: 0.14,
      gain: 0.42,
      reverbNode: reverb,
      reverbSend: 0.62,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'bandpass',
      startFreq: 1350 * j,
      endFreq: 110,
      q: 1.3,
      startOffsetSec: 0.006,
      durationSec: 0.25,
      gain: 0.78,
      attackSec: 0.003,
      reverbNode: reverb,
      reverbSend: 0.7,
    });
    scheduleTone(ctx, punch, {
      type: 'sine',
      startFreq: 136 * j,
      endFreq: 26,
      startOffsetSec: 0.003,
      durationSec: 0.2,
      gain: 0.68,
      reverbNode: reverb,
      reverbSend: 0.55,
    });
  },

  error({ ctx, punch, reverb }) {
    const j = jitter(0.04);
    for (const [idx, offset] of [0, 0.09].entries()) {
      const f = idx === 0 ? 142 : 104;
      scheduleTone(ctx, punch, {
        type: 'sine',
        startFreq: f * j,
        endFreq: 28,
        startOffsetSec: offset,
        durationSec: 0.13,
        gain: 0.72,
        pan: idx === 0 ? -0.18 : 0.18,
        reverbNode: reverb,
        reverbSend: 0.58,
      });
      scheduleFmClang(ctx, punch, {
        carrierFreq: (idx === 0 ? 215 : 162) * j,
        endCarrierFreq: 86,
        modRatio: 2.53,
        modIndex: 240,
        startOffsetSec: offset,
        durationSec: 0.095,
        gain: 0.36,
        reverbNode: reverb,
        reverbSend: 0.55,
      });
    }
  },
};
