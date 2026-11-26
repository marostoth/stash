import {
  jitter,
  scheduleFilteredNoise,
  scheduleTone,
} from '@/lib/audio/audio-bus';
import { ARPG_HEAVY_PACK } from '@/lib/audio/sound-packs-arpg';
import {
  GLASS_CERAMIC_PACK,
  RETRO_SYNTH_PACK,
} from '@/lib/audio/sound-packs-tonal';
import type { SoundPack } from '@/lib/types/stash';

export interface SoundPackContext {
  ctx: AudioContext;
  destination: AudioNode;
  punch: AudioNode;
  reverb: AudioNode;
  arcade: boolean;
  pitch: number;
}

export interface SoundPackRecipe {
  pickup: (c: SoundPackContext) => void;
  drop: (c: SoundPackContext) => void;
  sessionFreeze: (c: SoundPackContext) => void;
  tagPop: (c: SoundPackContext) => void;
  hoverRiffle: (c: SoundPackContext) => void;
  delete: (c: SoundPackContext) => void;
  error: (c: SoundPackContext) => void;
}

const STUDIO_DESK_PACK: SoundPackRecipe = {
  pickup({ ctx, destination, reverb }) {
    const j = jitter(0.04);
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'highpass',
      startFreq: 2100 * j,
      startOffsetSec: 0,
      durationSec: 0.012,
      gain: 0.24,
      attackSec: 0.001,
    });
    scheduleTone(ctx, destination, {
      type: 'triangle',
      startFreq: 165 * j,
      endFreq: 245 * j,
      startOffsetSec: 0,
      durationSec: 0.032,
      gain: 0.28,
      reverbNode: reverb,
      reverbSend: 0.14,
    });
  },
  drop({ ctx, destination, punch, reverb, arcade, pitch }) {
    const j = jitter(0.045);
    scheduleTone(ctx, punch, {
      type: 'sine',
      startFreq: (arcade ? 142 : 128) * j,
      endFreq: 32,
      startOffsetSec: 0,
      durationSec: arcade ? 0.14 : 0.095,
      gain: arcade ? 0.68 : 0.5,
      attackSec: 0.0015,
      reverbNode: reverb,
      reverbSend: arcade ? 0.28 : 0.16,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'lowpass',
      startFreq: 560 * j,
      endFreq: 140,
      q: 1.2,
      startOffsetSec: 0,
      durationSec: arcade ? 0.065 : 0.038,
      gain: arcade ? 0.54 : 0.38,
      attackSec: 0.001,
      reverbNode: reverb,
      reverbSend: 0.22,
    });
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1150 * j,
      endFreq: 310,
      q: 1.1,
      startOffsetSec: 0.006,
      durationSec: arcade ? 0.115 : 0.06,
      gain: arcade ? 0.24 : 0.11,
      attackSec: 0.004,
      reverbNode: reverb,
      reverbSend: 0.2,
    });
    if (arcade) {
      scheduleTone(ctx, destination, {
        type: 'triangle',
        startFreq: 330 * pitch,
        endFreq: 318 * pitch,
        startOffsetSec: 0.005,
        durationSec: 0.09,
        gain: 0.14,
        reverbNode: reverb,
        reverbSend: 0.26,
      });
    }
  },
  sessionFreeze({ ctx, destination, punch, reverb, pitch }) {
    scheduleTone(ctx, punch, {
      type: 'sine',
      startFreq: 120,
      endFreq: 42,
      startOffsetSec: 0,
      durationSec: 0.12,
      gain: 0.42,
      reverbNode: reverb,
      reverbSend: 0.25,
    });
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'highpass',
      startFreq: 2400,
      startOffsetSec: 0,
      durationSec: 0.01,
      gain: 0.14,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 587.33 * pitch,
      endFreq: 587.33 * pitch,
      startOffsetSec: 0,
      durationSec: 0.085,
      gain: 0.24,
      reverbNode: reverb,
      reverbSend: 0.32,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 880 * pitch,
      endFreq: 880 * pitch,
      startOffsetSec: 0.048,
      durationSec: 0.11,
      gain: 0.26,
      reverbNode: reverb,
      reverbSend: 0.38,
    });
  },
  tagPop({ ctx, destination, reverb, pitch }) {
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'highpass',
      startFreq: 2600,
      startOffsetSec: 0,
      durationSec: 0.008,
      gain: 0.14,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 523.25 * pitch,
      endFreq: 530 * pitch,
      startOffsetSec: 0,
      durationSec: 0.075,
      gain: 0.22,
      reverbNode: reverb,
      reverbSend: 0.32,
    });
    scheduleTone(ctx, destination, {
      type: 'triangle',
      startFreq: 1046.5 * pitch,
      endFreq: 1046.5 * pitch,
      startOffsetSec: 0.008,
      durationSec: 0.065,
      gain: 0.1,
      reverbNode: reverb,
      reverbSend: 0.36,
    });
  },
  hoverRiffle({ ctx, destination }) {
    const j = jitter(0.06);
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'bandpass',
      startFreq: 1850 * j,
      endFreq: 1200 * j,
      q: 2.2,
      startOffsetSec: 0,
      durationSec: 0.011,
      gain: 0.14,
      attackSec: 0.001,
    });
  },
  delete({ ctx, punch, reverb }) {
    const j = jitter(0.04);
    scheduleTone(ctx, punch, {
      type: 'triangle',
      startFreq: 195 * j,
      endFreq: 48,
      startOffsetSec: 0,
      durationSec: 0.07,
      gain: 0.4,
      reverbNode: reverb,
      reverbSend: 0.2,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'lowpass',
      startFreq: 680 * j,
      endFreq: 170,
      startOffsetSec: 0.006,
      durationSec: 0.06,
      gain: 0.32,
      reverbNode: reverb,
      reverbSend: 0.22,
    });
  },
  error({ ctx, punch, reverb }) {
    for (const [idx, offset] of [0, 0.066].entries()) {
      scheduleTone(ctx, punch, {
        type: 'sine',
        startFreq: idx === 0 ? 118 : 96,
        endFreq: 54,
        startOffsetSec: offset,
        durationSec: 0.056,
        gain: 0.42,
        reverbNode: reverb,
        reverbSend: 0.18,
      });
      scheduleFilteredNoise(ctx, punch, {
        color: 'brown',
        filterType: 'lowpass',
        startFreq: idx === 0 ? 390 : 320,
        startOffsetSec: offset,
        durationSec: 0.025,
        gain: 0.28,
      });
    }
  },
};

const MECHANICAL_THOCK_PACK: SoundPackRecipe = {
  pickup({ ctx, destination }) {
    const j = jitter(0.045);
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'highpass',
      startFreq: 3300 * j,
      startOffsetSec: 0,
      durationSec: 0.009,
      gain: 0.3,
      attackSec: 0.001,
    });
    scheduleTone(ctx, destination, {
      type: 'triangle',
      startFreq: 420 * j,
      endFreq: 620 * j,
      startOffsetSec: 0,
      durationSec: 0.018,
      gain: 0.22,
    });
  },
  drop({ ctx, destination, punch, reverb, arcade, pitch }) {
    const j = jitter(0.045);
    scheduleTone(ctx, punch, {
      type: 'triangle',
      startFreq: 235 * j * (arcade ? 0.94 + pitch * 0.08 : 1),
      endFreq: 62,
      startOffsetSec: 0,
      durationSec: 0.08,
      gain: 0.6,
      attackSec: 0.001,
      reverbNode: reverb,
      reverbSend: 0.16,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'bandpass',
      startFreq: 460 * j,
      endFreq: 200,
      q: 2.0,
      startOffsetSec: 0,
      durationSec: 0.032,
      gain: 0.54,
      attackSec: 0.001,
      reverbNode: reverb,
      reverbSend: 0.14,
    });
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'highpass',
      startFreq: 1950 * j,
      startOffsetSec: 0.002,
      durationSec: 0.011,
      gain: 0.28,
      attackSec: 0.001,
    });
    if (arcade) {
      scheduleTone(ctx, destination, {
        type: 'sine',
        startFreq: 520 * pitch,
        endFreq: 310 * pitch,
        startOffsetSec: 0.004,
        durationSec: 0.048,
        gain: 0.14,
      });
    }
  },
  sessionFreeze({ ctx, destination, punch, reverb, pitch }) {
    const freqs = [240, 310, 420];
    freqs.forEach((f, idx) => {
      const offset = idx * 0.036;
      scheduleTone(ctx, punch, {
        type: 'triangle',
        startFreq: f * pitch,
        endFreq: f * 0.42 * pitch,
        startOffsetSec: offset,
        durationSec: 0.055,
        gain: idx === 2 ? 0.48 : 0.3,
        reverbNode: reverb,
        reverbSend: 0.18,
      });
      scheduleFilteredNoise(ctx, destination, {
        filterType: 'highpass',
        startFreq: 2400,
        startOffsetSec: offset,
        durationSec: 0.009,
        gain: 0.22,
      });
    });
  },
  tagPop({ ctx, destination, reverb, pitch }) {
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'highpass',
      startFreq: 3600,
      startOffsetSec: 0,
      durationSec: 0.008,
      gain: 0.26,
    });
    scheduleTone(ctx, destination, {
      type: 'triangle',
      startFreq: 680 * pitch,
      endFreq: 420 * pitch,
      startOffsetSec: 0,
      durationSec: 0.034,
      gain: 0.24,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 1120 * pitch,
      endFreq: 1120 * pitch,
      startOffsetSec: 0.012,
      durationSec: 0.055,
      gain: 0.15,
      reverbNode: reverb,
      reverbSend: 0.24,
    });
  },
  hoverRiffle({ ctx, destination }) {
    const j = jitter(0.06);
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'bandpass',
      startFreq: 2900 * j,
      endFreq: 2100 * j,
      q: 3.2,
      startOffsetSec: 0,
      durationSec: 0.008,
      gain: 0.16,
      attackSec: 0.001,
    });
  },
  delete({ ctx, punch, reverb }) {
    scheduleTone(ctx, punch, {
      type: 'triangle',
      startFreq: 260,
      endFreq: 82,
      startOffsetSec: 0,
      durationSec: 0.055,
      gain: 0.4,
      reverbNode: reverb,
      reverbSend: 0.14,
    });
    scheduleFilteredNoise(ctx, punch, {
      filterType: 'bandpass',
      startFreq: 1100,
      endFreq: 420,
      startOffsetSec: 0.004,
      durationSec: 0.028,
      gain: 0.26,
    });
  },
  error({ ctx, punch }) {
    for (const offset of [0, 0.06]) {
      scheduleTone(ctx, punch, {
        type: 'triangle',
        startFreq: offset === 0 ? 185 : 145,
        endFreq: 68,
        startOffsetSec: offset,
        durationSec: 0.048,
        gain: 0.42,
      });
      scheduleFilteredNoise(ctx, punch, {
        filterType: 'lowpass',
        startFreq: 520,
        startOffsetSec: offset,
        durationSec: 0.02,
        gain: 0.26,
      });
    }
  },
};

export const SOUND_PACK_RECIPES: Record<SoundPack, SoundPackRecipe> = {
  'arpg-heavy': ARPG_HEAVY_PACK,
  'studio-desk': STUDIO_DESK_PACK,
  'mechanical-thock': MECHANICAL_THOCK_PACK,
  'retro-synth': RETRO_SYNTH_PACK,
  'glass-ceramic': GLASS_CERAMIC_PACK,
};
