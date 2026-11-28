import {
  scheduleFilteredNoise,
  scheduleFmClang,
  scheduleTone,
} from '@/lib/audio/audio-bus';
import { gainJitter, pitchJitter } from '@/lib/audio/audio-math';
import type { SoundPackRecipe } from '@/lib/audio/sound-packs';

/**
 * Heavy Stone & Iron cinematic sound pack:
 * high-drive sub-bass shockwaves, wide stereo brown-noise concussion blasts,
 * inharmonic FM forged iron & crystal chimes, stereo scattering dust/stone grit,
 * and lush dark stone-hall reverb.
 */
export const ARPG_HEAVY_PACK: SoundPackRecipe = {
  pickup({ ctx, destination, punch, reverb, tailScale }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleFilteredNoise(ctx, destination, {
      color: 'brown',
      filterType: 'bandpass',
      startFreq: 340 * pj,
      endFreq: 1050 * pj,
      q: 1.5,
      startOffsetSec: 0,
      durationSec: 0.06 * tailScale,
      gain: 0.42 * gj,
      reverbNode: reverb,
      reverbSend: 0.35 * tailScale,
    });
    scheduleFmClang(ctx, punch, {
      carrierFreq: 320 * pj,
      endCarrierFreq: 510 * pj,
      modRatio: 2.38,
      modIndex: 150,
      startOffsetSec: 0.004,
      durationSec: 0.042 * tailScale,
      gain: 0.3 * gj,
      reverbNode: reverb,
      reverbSend: 0.3 * tailScale,
    });
  },

  drop({ ctx, destination, punch, reverb, arcade, pitch }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    const heavy = arcade ? 1 : 0.78;

    // 1. Stereo stone-fracture snap (instant tactile bite)
    scheduleFilteredNoise(ctx, punch, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 2100 * pj,
      endFreq: 380 * pj,
      q: 1.1,
      startOffsetSec: 0,
      durationSec: 0.024,
      gain: 0.72 * heavy * gj,
      attackSec: 0.0008,
      pan: -0.25,
      reverbNode: reverb,
      reverbSend: arcade ? 0.42 : 0.28,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1650 * pj,
      endFreq: 320 * pj,
      q: 1.2,
      startOffsetSec: 0.003,
      durationSec: 0.028,
      gain: 0.64 * heavy * gj,
      attackSec: 0.0008,
      pan: 0.25,
      reverbNode: reverb,
      reverbSend: arcade ? 0.42 : 0.28,
    });

    // 2. Massive seismic sub-drop (168 Hz -> 22 Hz driven hard through punch saturator)
    scheduleTone(ctx, punch, {
      type: 'sine',
      startFreq: (arcade ? 168 : 132) * pj,
      endFreq: 22,
      startOffsetSec: 0,
      durationSec: arcade ? 0.32 : 0.17,
      gain: 1.0 * heavy * gj,
      attackSec: 0.001,
      reverbNode: reverb,
      reverbSend: arcade ? 0.65 : 0.35,
    });

    // 3. Wide stereo concussion blast (brown noise resonant lowpass sweep)
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'lowpass',
      startFreq: (arcade ? 1150 : 620) * pj,
      endFreq: 48,
      q: 2.5,
      startOffsetSec: 0.001,
      durationSec: arcade ? 0.38 : 0.18,
      gain: 0.96 * heavy * gj,
      attackSec: 0.002,
      pan: -0.32,
      reverbNode: reverb,
      reverbSend: arcade ? 0.78 : 0.4,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'lowpass',
      startFreq: (arcade ? 980 : 540) * pj,
      endFreq: 44,
      q: 2.4,
      startOffsetSec: 0.006,
      durationSec: arcade ? 0.4 : 0.19,
      gain: 0.9 * heavy * gj,
      attackSec: 0.003,
      pan: 0.32,
      reverbNode: reverb,
      reverbSend: arcade ? 0.78 : 0.4,
    });

    // 4. Forged iron / heavy stone slab anvil resonance (inharmonic FM)
    scheduleFmClang(ctx, punch, {
      carrierFreq: 162 * pj,
      endCarrierFreq: 58 * pj,
      modRatio: 2.41,
      modIndex: 340,
      startOffsetSec: 0.003,
      durationSec: arcade ? 0.17 : 0.095,
      gain: 0.42 * heavy * gj,
      reverbNode: reverb,
      reverbSend: arcade ? 0.58 : 0.38,
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
          startFreq: grain.freq * pj,
          endFreq: grain.freq * 0.42 * pj,
          q: 1.9,
          startOffsetSec: grain.offset,
          durationSec: grain.dur,
          gain: grain.gain * gj,
          pan: grain.pan,
          reverbNode: reverb,
          reverbSend: 0.64,
        });
      }

      // 6. Dark resonant combo iron ring (tuned cleanly to combo pitch)
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

  sessionFreeze({ ctx, destination, punch, reverb, pitch, tailScale }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleTone(ctx, punch, {
      type: 'sine',
      startFreq: 138 * pj,
      endFreq: 24,
      startOffsetSec: 0,
      durationSec: 0.38 * tailScale,
      gain: 0.95 * gj,
      reverbNode: reverb,
      reverbSend: 0.78 * tailScale,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'lowpass',
      startFreq: 760 * pj,
      endFreq: 56,
      q: 2.2,
      startOffsetSec: 0,
      durationSec: 0.34 * tailScale,
      gain: 0.85 * gj,
      reverbNode: reverb,
      reverbSend: 0.75 * tailScale,
    });
    // Tuned iron chord — zero random pitch jitter on musical intervals
    scheduleFmClang(ctx, destination, {
      carrierFreq: 220 * pitch,
      endCarrierFreq: 214 * pitch,
      modRatio: 2.76,
      modIndex: 190,
      startOffsetSec: 0.022,
      durationSec: 0.36 * tailScale,
      gain: 0.28,
      pan: -0.25,
      reverbNode: reverb,
      reverbSend: 0.85 * tailScale,
    });
    scheduleFmClang(ctx, destination, {
      carrierFreq: 329.63 * pitch,
      endCarrierFreq: 329.63 * pitch,
      modRatio: 2.0,
      modIndex: 85,
      startOffsetSec: 0.072,
      durationSec: 0.44 * tailScale,
      gain: 0.24,
      pan: 0.25,
      reverbNode: reverb,
      reverbSend: 0.9 * tailScale,
    });
  },

  tagPop({ ctx, destination, reverb, pitch, tailScale }) {
    // Pure tuned pentatonic crystal chimes — no random pitch jitter
    scheduleFmClang(ctx, destination, {
      carrierFreq: 783.99 * pitch,
      modRatio: 2.756,
      modIndex: 380,
      startOffsetSec: 0,
      durationSec: 0.34 * tailScale,
      gain: 0.32,
      pan: -0.2,
      reverbNode: reverb,
      reverbSend: 0.88 * tailScale,
    });
    scheduleFmClang(ctx, destination, {
      carrierFreq: 1174.66 * pitch,
      modRatio: 1.995,
      modIndex: 220,
      startOffsetSec: 0.036,
      durationSec: 0.42 * tailScale,
      gain: 0.28,
      pan: 0.22,
      reverbNode: reverb,
      reverbSend: 0.92 * tailScale,
    });
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'highpass',
      startFreq: 4800,
      startOffsetSec: 0,
      durationSec: 0.018,
      gain: 0.2,
      reverbNode: reverb,
      reverbSend: 0.55 * tailScale,
    });
  },

  uncheck({ ctx, destination, reverb, tailScale }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    // Crisp 9ms high-mid iron latch attack + boosted non-musical release (~+4 dB)
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 3100 * pj,
      endFreq: 2100 * pj,
      q: 1.8,
      startOffsetSec: 0,
      durationSec: 0.009,
      gain: 0.54 * gj,
      attackSec: 0.0006,
    });
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1380 * pj,
      endFreq: 680 * pj,
      q: 2.0,
      startOffsetSec: 0,
      durationSec: 0.017,
      gain: 0.58 * gj,
      attackSec: 0.0008,
      reverbNode: reverb,
      reverbSend: 0.14 * tailScale,
    });
    scheduleTone(ctx, destination, {
      type: 'triangle',
      startFreq: 280 * pj,
      endFreq: 170 * pj,
      startOffsetSec: 0,
      durationSec: 0.015,
      gain: 0.34 * gj,
      attackSec: 0.0008,
    });
  },

  hoverRiffle({ ctx, destination, reverb, tailScale }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    // Crisp 7ms bandpass stone-grit brush clearly audible at 35% desk volume
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 2800 * pj,
      endFreq: 2350 * pj,
      q: 2.0,
      startOffsetSec: 0,
      durationSec: 0.007,
      gain: 0.3 * gj,
      attackSec: 0.0006,
      reverbNode: reverb,
      reverbSend: 0.16 * tailScale,
    });
  },

  delete({ ctx, punch, reverb, tailScale }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleFilteredNoise(ctx, punch, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 2100 * pj,
      endFreq: 520 * pj,
      q: 1.5,
      startOffsetSec: 0,
      durationSec: 0.018,
      gain: 0.56 * gj,
      attackSec: 0.0008,
      reverbNode: reverb,
      reverbSend: 0.25 * tailScale,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'lowpass',
      startFreq: 680 * pj,
      endFreq: 140,
      q: 1.4,
      startOffsetSec: 0.003,
      durationSec: 0.025,
      gain: 0.62 * gj,
      attackSec: 0.001,
      reverbNode: reverb,
      reverbSend: 0.3 * tailScale,
    });
  },

  error({ ctx, punch, reverb, tailScale }) {
    const pj = pitchJitter();
    for (const [idx, offset] of [0, 0.09].entries()) {
      const f = idx === 0 ? 142 : 104;
      scheduleTone(ctx, punch, {
        type: 'sine',
        startFreq: f * pj,
        endFreq: 28,
        startOffsetSec: offset,
        durationSec: 0.13 * tailScale,
        gain: 0.72,
        pan: idx === 0 ? -0.18 : 0.18,
        reverbNode: reverb,
        reverbSend: 0.58 * tailScale,
      });
      scheduleFmClang(ctx, punch, {
        carrierFreq: (idx === 0 ? 215 : 162) * pj,
        endCarrierFreq: 86,
        modRatio: 2.53,
        modIndex: 240,
        startOffsetSec: offset,
        durationSec: 0.095 * tailScale,
        gain: 0.36,
        reverbNode: reverb,
        reverbSend: 0.55 * tailScale,
      });
    }
  },
};
