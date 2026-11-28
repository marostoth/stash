import { scheduleFilteredNoise, scheduleTone } from '@/lib/audio/audio-bus';
import { gainJitter, pitchJitter } from '@/lib/audio/audio-math';
import { ARPG_HEAVY_PACK } from '@/lib/audio/sound-packs-arpg';
import { MECHANICAL_THOCK_PACK } from '@/lib/audio/sound-packs-mechanical';
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
  /** 1.0 in Arcade, 0.7 (~30% trimmed decay/reverb tails) in Tactile/calmer tiers */
  tailScale: number;
}

export interface SoundPackRecipe {
  pickup: (c: SoundPackContext) => void;
  drop: (c: SoundPackContext) => void;
  sessionFreeze: (c: SoundPackContext) => void;
  tagPop: (c: SoundPackContext) => void;
  uncheck: (c: SoundPackContext) => void;
  hoverRiffle: (c: SoundPackContext) => void;
  delete: (c: SoundPackContext) => void;
  error: (c: SoundPackContext) => void;
}

const STUDIO_DESK_PACK: SoundPackRecipe = {
  pickup({ ctx, destination }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    // Dry anodized hardware micro-click (10-16ms transient, zero low sine bloop)
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'highpass',
      startFreq: 2800 * pj,
      startOffsetSec: 0,
      durationSec: 0.011,
      gain: 0.34 * gj,
      attackSec: 0.0008,
    });
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1350 * pj,
      endFreq: 860 * pj,
      q: 2.6,
      startOffsetSec: 0.001,
      durationSec: 0.016,
      gain: 0.28 * gj,
      attackSec: 0.0008,
    });
  },
  drop({ ctx, destination, punch, reverb, arcade, pitch, tailScale }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    // Crisp matte mechanical settle click (15-25ms dry hardware contact)
    scheduleFilteredNoise(ctx, punch, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1950 * pj,
      endFreq: 780 * pj,
      q: 1.9,
      startOffsetSec: 0,
      durationSec: 0.015,
      gain: (arcade ? 0.56 : 0.44) * gj,
      attackSec: 0.0008,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'lowpass',
      startFreq: (arcade ? 720 : 540) * pj,
      endFreq: 140,
      q: 1.1,
      startOffsetSec: 0,
      durationSec: arcade ? 0.025 : 0.018,
      gain: (arcade ? 0.62 : 0.46) * gj,
      attackSec: 0.0008,
      reverbNode: reverb,
      reverbSend: (arcade ? 0.14 : 0.08) * tailScale,
    });
    if (arcade) {
      // Pure tuned pentatonic harmonic confirmation tick in Arcade mode
      scheduleTone(ctx, destination, {
        type: 'triangle',
        startFreq: 523.25 * pitch,
        endFreq: 523.25 * pitch,
        startOffsetSec: 0.006,
        durationSec: 0.048,
        gain: 0.13,
        reverbNode: reverb,
        reverbSend: 0.18 * tailScale,
      });
    }
  },
  sessionFreeze({ ctx, destination, punch, reverb, arcade, pitch, tailScale }) {
    // Crisp mechanical latch + exact ascending pentatonic harmonic chord
    scheduleFilteredNoise(ctx, punch, {
      color: 'white',
      filterType: 'highpass',
      startFreq: 2600,
      startOffsetSec: 0,
      durationSec: 0.012,
      gain: 0.3,
      attackSec: 0.0008,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 587.33 * pitch,
      endFreq: 587.33 * pitch,
      startOffsetSec: 0.004,
      durationSec: 0.09 * tailScale,
      gain: 0.24,
      reverbNode: reverb,
      reverbSend: 0.28 * tailScale,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 880 * pitch,
      endFreq: 880 * pitch,
      startOffsetSec: 0.044,
      durationSec: 0.115 * tailScale,
      gain: 0.26,
      reverbNode: reverb,
      reverbSend: 0.34 * tailScale,
    });
    if (arcade) {
      scheduleTone(ctx, destination, {
        type: 'triangle',
        startFreq: 1174.66 * pitch,
        endFreq: 1174.66 * pitch,
        startOffsetSec: 0.082,
        durationSec: 0.145 * tailScale,
        gain: 0.2,
        reverbNode: reverb,
        reverbSend: 0.42 * tailScale,
      });
    }
  },
  tagPop({ ctx, destination, reverb, pitch, tailScale }) {
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'highpass',
      startFreq: 2800,
      startOffsetSec: 0,
      durationSec: 0.009,
      gain: 0.2,
      attackSec: 0.0008,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 523.25 * pitch,
      endFreq: 528 * pitch,
      startOffsetSec: 0,
      durationSec: 0.072 * tailScale,
      gain: 0.24,
      reverbNode: reverb,
      reverbSend: 0.28 * tailScale,
    });
    scheduleTone(ctx, destination, {
      type: 'triangle',
      startFreq: 1046.5 * pitch,
      endFreq: 1046.5 * pitch,
      startOffsetSec: 0.008,
      durationSec: 0.06 * tailScale,
      gain: 0.11,
      reverbNode: reverb,
      reverbSend: 0.3 * tailScale,
    });
  },
  uncheck({ ctx, destination }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    // Crisp 8ms high-mid attack transient + boosted non-musical release (~+4 dB)
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 3300 * pj,
      endFreq: 2250 * pj,
      q: 2.0,
      startOffsetSec: 0,
      durationSec: 0.008,
      gain: 0.52 * gj,
      attackSec: 0.0006,
    });
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1480 * pj,
      endFreq: 800 * pj,
      q: 2.2,
      startOffsetSec: 0,
      durationSec: 0.015,
      gain: 0.55 * gj,
      attackSec: 0.0008,
    });
    scheduleTone(ctx, destination, {
      type: 'triangle',
      startFreq: 310 * pj,
      endFreq: 195 * pj,
      startOffsetSec: 0,
      durationSec: 0.014,
      gain: 0.32 * gj,
      attackSec: 0.0008,
    });
  },
  hoverRiffle({ ctx, destination }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    // Crisp 7ms bandpass matte card brush clearly audible at 35% desk volume
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 3100 * pj,
      endFreq: 2500 * pj,
      q: 2.2,
      startOffsetSec: 0,
      durationSec: 0.007,
      gain: 0.28 * gj,
      attackSec: 0.0006,
    });
  },
  delete({ ctx, punch }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    // Dry 16-22ms mechanical latch release (no rubbery sine sweep)
    scheduleFilteredNoise(ctx, punch, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1850 * pj,
      endFreq: 560 * pj,
      q: 1.7,
      startOffsetSec: 0,
      durationSec: 0.016,
      gain: 0.48 * gj,
      attackSec: 0.0008,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'lowpass',
      startFreq: 540 * pj,
      endFreq: 150,
      startOffsetSec: 0.003,
      durationSec: 0.022,
      gain: 0.44 * gj,
      attackSec: 0.001,
    });
  },
  error({ ctx, punch }) {
    for (const [idx, offset] of [0, 0.058].entries()) {
      scheduleFilteredNoise(ctx, punch, {
        color: 'brown',
        filterType: 'bandpass',
        startFreq: idx === 0 ? 520 : 380,
        endFreq: 180,
        q: 1.8,
        startOffsetSec: offset,
        durationSec: 0.02,
        gain: 0.48,
        attackSec: 0.0008,
      });
      scheduleFilteredNoise(ctx, punch, {
        color: 'white',
        filterType: 'bandpass',
        startFreq: idx === 0 ? 1280 : 940,
        q: 2.4,
        startOffsetSec: offset,
        durationSec: 0.012,
        gain: 0.3,
        attackSec: 0.0008,
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
