import {
  jitter,
  scheduleFilteredNoise,
  scheduleFmClang,
  scheduleTone,
} from '@/lib/audio/audio-bus';
import type { SoundPackRecipe } from '@/lib/audio/sound-packs';

export const RETRO_SYNTH_PACK: SoundPackRecipe = {
  pickup({ ctx, destination }) {
    scheduleTone(ctx, destination, {
      type: 'square',
      startFreq: 280,
      endFreq: 560,
      startOffsetSec: 0,
      durationSec: 0.036,
      gain: 0.16,
    });
  },
  drop({ ctx, destination, punch, reverb, arcade, pitch }) {
    scheduleTone(ctx, punch, {
      type: 'sawtooth',
      startFreq: 205,
      endFreq: 42,
      startOffsetSec: 0,
      durationSec: 0.11,
      gain: 0.36,
      reverbNode: reverb,
      reverbSend: 0.22,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'bandpass',
      startFreq: 940,
      endFreq: 220,
      q: 1.5,
      startOffsetSec: 0,
      durationSec: 0.055,
      gain: 0.28,
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
  sessionFreeze({ ctx, destination, reverb, pitch }) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      scheduleTone(ctx, destination, {
        type: 'square',
        startFreq: freq * pitch,
        endFreq: freq * pitch,
        startOffsetSec: idx * 0.042,
        durationSec: idx === notes.length - 1 ? 0.13 : 0.046,
        gain: 0.14,
        reverbNode: reverb,
        reverbSend: 0.26,
      });
    });
  },
  tagPop({ ctx, destination, reverb, pitch }) {
    scheduleTone(ctx, destination, {
      type: 'square',
      startFreq: 987.77 * pitch,
      endFreq: 987.77 * pitch,
      startOffsetSec: 0,
      durationSec: 0.042,
      gain: 0.13,
      reverbNode: reverb,
      reverbSend: 0.22,
    });
    scheduleTone(ctx, destination, {
      type: 'square',
      startFreq: 1318.51 * pitch,
      endFreq: 1318.51 * pitch,
      startOffsetSec: 0.04,
      durationSec: 0.1,
      gain: 0.14,
      reverbNode: reverb,
      reverbSend: 0.28,
    });
  },
  hoverRiffle({ ctx, destination }) {
    scheduleTone(ctx, destination, {
      type: 'square',
      startFreq: 640,
      endFreq: 720,
      startOffsetSec: 0,
      durationSec: 0.012,
      gain: 0.06,
    });
  },
  delete({ ctx, punch, reverb }) {
    scheduleTone(ctx, punch, {
      type: 'sawtooth',
      startFreq: 440,
      endFreq: 82,
      startOffsetSec: 0,
      durationSec: 0.095,
      gain: 0.24,
      reverbNode: reverb,
      reverbSend: 0.22,
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
  pickup({ ctx, destination, reverb }) {
    const j = jitter(0.03);
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 1240 * j,
      endFreq: 1540 * j,
      startOffsetSec: 0,
      durationSec: 0.03,
      gain: 0.18,
      reverbNode: reverb,
      reverbSend: 0.42,
    });
  },
  drop({ ctx, destination, punch, reverb, arcade, pitch }) {
    const j = jitter(0.035);
    scheduleTone(ctx, punch, {
      type: 'sine',
      startFreq: 265 * j,
      endFreq: 76,
      startOffsetSec: 0,
      durationSec: 0.095,
      gain: 0.46,
      reverbNode: reverb,
      reverbSend: 0.36,
    });
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'bandpass',
      startFreq: 2200 * j,
      endFreq: 1100,
      q: 2.8,
      startOffsetSec: 0,
      durationSec: 0.018,
      gain: 0.22,
      reverbNode: reverb,
      reverbSend: 0.35,
    });
    scheduleFmClang(ctx, destination, {
      carrierFreq: (arcade ? 1174.66 : 987.77) * pitch * j,
      modRatio: 2.756,
      modIndex: arcade ? 180 : 95,
      startOffsetSec: 0.003,
      durationSec: arcade ? 0.22 : 0.11,
      gain: arcade ? 0.2 : 0.13,
      reverbNode: reverb,
      reverbSend: 0.62,
    });
  },
  sessionFreeze({ ctx, destination, reverb, pitch }) {
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 528 * pitch,
      endFreq: 528 * pitch,
      startOffsetSec: 0,
      durationSec: 0.22,
      gain: 0.2,
      reverbNode: reverb,
      reverbSend: 0.68,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 792 * pitch,
      endFreq: 792 * pitch,
      startOffsetSec: 0.04,
      durationSec: 0.24,
      gain: 0.18,
      reverbNode: reverb,
      reverbSend: 0.72,
    });
    scheduleFmClang(ctx, destination, {
      carrierFreq: 1056 * pitch,
      modRatio: 2.0,
      modIndex: 85,
      startOffsetSec: 0.08,
      durationSec: 0.24,
      gain: 0.14,
      reverbNode: reverb,
      reverbSend: 0.75,
    });
  },
  tagPop({ ctx, destination, reverb, pitch }) {
    scheduleFmClang(ctx, destination, {
      carrierFreq: 1046.5 * pitch,
      modRatio: 2.756,
      modIndex: 140,
      startOffsetSec: 0,
      durationSec: 0.16,
      gain: 0.19,
      reverbNode: reverb,
      reverbSend: 0.62,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 1567.98 * pitch,
      endFreq: 1567.98 * pitch,
      startOffsetSec: 0.025,
      durationSec: 0.18,
      gain: 0.15,
      reverbNode: reverb,
      reverbSend: 0.68,
    });
  },
  hoverRiffle({ ctx, destination, reverb }) {
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'highpass',
      startFreq: 4400,
      startOffsetSec: 0,
      durationSec: 0.008,
      gain: 0.1,
      reverbNode: reverb,
      reverbSend: 0.22,
    });
  },
  delete({ ctx, destination, reverb }) {
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 620,
      endFreq: 210,
      startOffsetSec: 0,
      durationSec: 0.085,
      gain: 0.24,
      reverbNode: reverb,
      reverbSend: 0.45,
    });
  },
  error({ ctx, destination, reverb }) {
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 315,
      endFreq: 295,
      startOffsetSec: 0,
      durationSec: 0.048,
      gain: 0.26,
      reverbNode: reverb,
      reverbSend: 0.35,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 245,
      endFreq: 230,
      startOffsetSec: 0.065,
      durationSec: 0.065,
      gain: 0.28,
      reverbNode: reverb,
      reverbSend: 0.38,
    });
  },
};
