import {
  scheduleFilteredNoise,
  scheduleFmClang,
  scheduleTone,
} from '@/lib/audio/audio-bus';
import { gainJitter, pitchJitter } from '@/lib/audio/audio-math';
import type { SoundPackRecipe } from '@/lib/audio/sound-packs';

export const RETRO_SYNTH_PACK: SoundPackRecipe = {
  pickup({ ctx, destination }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleTone(ctx, destination, {
      type: 'square',
      startFreq: 280 * pj,
      endFreq: 560 * pj,
      startOffsetSec: 0,
      durationSec: 0.036,
      gain: 0.16 * gj,
    });
  },
  drop({ ctx, destination, punch, reverb, arcade, pitch, tailScale }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleTone(ctx, punch, {
      type: 'sawtooth',
      startFreq: 205 * pj,
      endFreq: 42,
      startOffsetSec: 0,
      durationSec: 0.11 * tailScale,
      gain: 0.36 * gj,
      reverbNode: reverb,
      reverbSend: 0.22 * tailScale,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'bandpass',
      startFreq: 940 * pj,
      endFreq: 220 * pj,
      q: 1.5,
      startOffsetSec: 0,
      durationSec: 0.055 * tailScale,
      gain: 0.28 * gj,
    });
    if (arcade) {
      scheduleTone(ctx, destination, {
        type: 'square',
        startFreq: 440 * pitch,
        endFreq: 440 * pitch,
        startOffsetSec: 0.012,
        durationSec: 0.044,
        gain: 0.12,
        reverbNode: reverb,
        reverbSend: 0.2,
      });
      scheduleTone(ctx, destination, {
        type: 'square',
        startFreq: 659.25 * pitch,
        endFreq: 659.25 * pitch,
        startOffsetSec: 0.045,
        durationSec: 0.06,
        gain: 0.12,
        reverbNode: reverb,
        reverbSend: 0.24,
      });
    }
  },
  sessionFreeze({ ctx, destination, reverb, pitch, tailScale }) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      scheduleTone(ctx, destination, {
        type: 'square',
        startFreq: freq * pitch,
        endFreq: freq * pitch,
        startOffsetSec: idx * 0.042,
        durationSec: (idx === notes.length - 1 ? 0.13 : 0.046) * tailScale,
        gain: 0.14,
        reverbNode: reverb,
        reverbSend: 0.26 * tailScale,
      });
    });
  },
  tagPop({ ctx, destination, reverb, pitch, tailScale }) {
    scheduleTone(ctx, destination, {
      type: 'square',
      startFreq: 987.77 * pitch,
      endFreq: 987.77 * pitch,
      startOffsetSec: 0,
      durationSec: 0.042 * tailScale,
      gain: 0.13,
      reverbNode: reverb,
      reverbSend: 0.22 * tailScale,
    });
    scheduleTone(ctx, destination, {
      type: 'square',
      startFreq: 1318.51 * pitch,
      endFreq: 1318.51 * pitch,
      startOffsetSec: 0.04,
      durationSec: 0.1 * tailScale,
      gain: 0.14,
      reverbNode: reverb,
      reverbSend: 0.28 * tailScale,
    });
  },
  uncheck({ ctx, destination }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1500 * pj,
      endFreq: 850 * pj,
      q: 2.3,
      startOffsetSec: 0,
      durationSec: 0.014,
      gain: 0.3 * gj,
      attackSec: 0.0008,
    });
    scheduleTone(ctx, destination, {
      type: 'square',
      startFreq: 420 * pj,
      endFreq: 310 * pj,
      startOffsetSec: 0,
      durationSec: 0.018,
      gain: 0.14 * gj,
    });
  },
  hoverRiffle({ ctx, destination }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    // Crisp 7ms bandpass noise burst clearly audible at 35% desk volume (no pitched clash)
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 3400 * pj,
      endFreq: 2650 * pj,
      q: 2.3,
      startOffsetSec: 0,
      durationSec: 0.007,
      gain: 0.22 * gj,
      attackSec: 0.0006,
    });
  },
  delete({ ctx, punch }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleFilteredNoise(ctx, punch, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1700 * pj,
      endFreq: 520 * pj,
      q: 1.8,
      startOffsetSec: 0,
      durationSec: 0.018,
      gain: 0.4 * gj,
      attackSec: 0.0008,
    });
    scheduleTone(ctx, punch, {
      type: 'triangle',
      startFreq: 320 * pj,
      endFreq: 160 * pj,
      startOffsetSec: 0,
      durationSec: 0.022,
      gain: 0.2 * gj,
    });
  },
  error({ ctx, punch }) {
    scheduleTone(ctx, punch, {
      type: 'square',
      startFreq: 155,
      endFreq: 135,
      startOffsetSec: 0,
      durationSec: 0.055,
      gain: 0.18,
    });
    scheduleTone(ctx, punch, {
      type: 'square',
      startFreq: 112,
      endFreq: 94,
      startOffsetSec: 0.068,
      durationSec: 0.08,
      gain: 0.2,
    });
  },
};

export const GLASS_CERAMIC_PACK: SoundPackRecipe = {
  pickup({ ctx, destination, reverb, tailScale }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 1240 * pj,
      endFreq: 1540 * pj,
      startOffsetSec: 0,
      durationSec: 0.03,
      gain: 0.18 * gj,
      reverbNode: reverb,
      reverbSend: 0.42 * tailScale,
    });
  },
  drop({ ctx, destination, punch, reverb, arcade, pitch, tailScale }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleTone(ctx, punch, {
      type: 'sine',
      startFreq: 265 * pj,
      endFreq: 76,
      startOffsetSec: 0,
      durationSec: 0.095 * tailScale,
      gain: 0.46 * gj,
      reverbNode: reverb,
      reverbSend: 0.36 * tailScale,
    });
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'bandpass',
      startFreq: 2200 * pj,
      endFreq: 1100 * pj,
      q: 2.8,
      startOffsetSec: 0,
      durationSec: 0.018,
      gain: 0.22 * gj,
      reverbNode: reverb,
      reverbSend: 0.35 * tailScale,
    });
    scheduleFmClang(ctx, destination, {
      carrierFreq: (arcade ? 1174.66 : 987.77) * pitch,
      modRatio: 2.756,
      modIndex: arcade ? 180 : 95,
      startOffsetSec: 0.003,
      durationSec: arcade ? 0.22 : 0.11,
      gain: arcade ? 0.2 : 0.13,
      reverbNode: reverb,
      reverbSend: 0.62 * tailScale,
    });
  },
  sessionFreeze({ ctx, destination, reverb, pitch, tailScale }) {
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 528 * pitch,
      endFreq: 528 * pitch,
      startOffsetSec: 0,
      durationSec: 0.22 * tailScale,
      gain: 0.2,
      reverbNode: reverb,
      reverbSend: 0.68 * tailScale,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 792 * pitch,
      endFreq: 792 * pitch,
      startOffsetSec: 0.04,
      durationSec: 0.24 * tailScale,
      gain: 0.18,
      reverbNode: reverb,
      reverbSend: 0.72 * tailScale,
    });
    scheduleFmClang(ctx, destination, {
      carrierFreq: 1056 * pitch,
      modRatio: 2.0,
      modIndex: 85,
      startOffsetSec: 0.08,
      durationSec: 0.24 * tailScale,
      gain: 0.14,
      reverbNode: reverb,
      reverbSend: 0.75 * tailScale,
    });
  },
  tagPop({ ctx, destination, reverb, pitch, tailScale }) {
    scheduleFmClang(ctx, destination, {
      carrierFreq: 1046.5 * pitch,
      modRatio: 2.756,
      modIndex: 140,
      startOffsetSec: 0,
      durationSec: 0.16 * tailScale,
      gain: 0.19,
      reverbNode: reverb,
      reverbSend: 0.62 * tailScale,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 1567.98 * pitch,
      endFreq: 1567.98 * pitch,
      startOffsetSec: 0.025,
      durationSec: 0.18 * tailScale,
      gain: 0.15,
      reverbNode: reverb,
      reverbSend: 0.68 * tailScale,
    });
  },
  uncheck({ ctx, destination, reverb, tailScale }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 2100 * pj,
      endFreq: 1200 * pj,
      q: 2.6,
      startOffsetSec: 0,
      durationSec: 0.014,
      gain: 0.3 * gj,
      attackSec: 0.0008,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 460 * pj,
      endFreq: 330 * pj,
      startOffsetSec: 0,
      durationSec: 0.02,
      gain: 0.2 * gj,
      reverbNode: reverb,
      reverbSend: 0.22 * tailScale,
    });
  },
  hoverRiffle({ ctx, destination, reverb, tailScale }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    // Crisp 7ms bandpass frosted brush clearly audible at 35% desk volume
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 3800 * pj,
      endFreq: 2950 * pj,
      q: 2.5,
      startOffsetSec: 0,
      durationSec: 0.007,
      gain: 0.24 * gj,
      attackSec: 0.0006,
      reverbNode: reverb,
      reverbSend: 0.14 * tailScale,
    });
  },
  delete({ ctx, destination }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 2200 * pj,
      endFreq: 820 * pj,
      q: 2.2,
      startOffsetSec: 0,
      durationSec: 0.018,
      gain: 0.38 * gj,
      attackSec: 0.0008,
    });
  },
  error({ ctx, destination, reverb, tailScale }) {
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 315,
      endFreq: 295,
      startOffsetSec: 0,
      durationSec: 0.048,
      gain: 0.26,
      reverbNode: reverb,
      reverbSend: 0.35 * tailScale,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 245,
      endFreq: 230,
      startOffsetSec: 0.065,
      durationSec: 0.065,
      gain: 0.28,
      reverbNode: reverb,
      reverbSend: 0.38 * tailScale,
    });
  },
};
