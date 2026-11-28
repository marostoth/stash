import { scheduleFilteredNoise, scheduleTone } from '@/lib/audio/audio-bus';
import { gainJitter, pitchJitter } from '@/lib/audio/audio-math';
import type { SoundPackRecipe } from '@/lib/audio/sound-packs';

/**
 * Layers a short 6–9ms PBT keycap switch-click transient directly under
 * tonal triggers so Mechanical Thock chimes feel mechanically actuated.
 */
function schedulePbtSwitchClick(
  ctx: AudioContext,
  destination: AudioNode,
  startOffsetSec = 0,
  intensity = 1,
): void {
  const pj = pitchJitter(0.02);
  const gj = gainJitter(0.03);
  scheduleFilteredNoise(ctx, destination, {
    color: 'white',
    filterType: 'bandpass',
    startFreq: 3650 * pj,
    endFreq: 2150 * pj,
    q: 2.3,
    startOffsetSec,
    durationSec: 0.007,
    gain: 0.42 * intensity * gj,
    attackSec: 0.0006,
  });
  scheduleFilteredNoise(ctx, destination, {
    color: 'brown',
    filterType: 'bandpass',
    startFreq: 760 * pj,
    endFreq: 320 * pj,
    q: 2.0,
    startOffsetSec,
    durationSec: 0.009,
    gain: 0.44 * intensity * gj,
    attackSec: 0.0006,
  });
}

export const MECHANICAL_THOCK_PACK: SoundPackRecipe = {
  pickup({ ctx, destination }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'highpass',
      startFreq: 3300 * pj,
      startOffsetSec: 0,
      durationSec: 0.01,
      gain: 0.34 * gj,
      attackSec: 0.0008,
    });
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1650 * pj,
      endFreq: 1100 * pj,
      q: 2.8,
      startOffsetSec: 0,
      durationSec: 0.014,
      gain: 0.28 * gj,
      attackSec: 0.0008,
    });
  },
  drop({ ctx, destination, punch, reverb, arcade, pitch, tailScale }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'bandpass',
      startFreq: 520 * pj,
      endFreq: 210 * pj,
      q: 2.1,
      startOffsetSec: 0,
      durationSec: 0.024,
      gain: 0.62 * gj,
      attackSec: 0.0008,
      reverbNode: reverb,
      reverbSend: 0.1 * tailScale,
    });
    scheduleFilteredNoise(ctx, destination, {
      filterType: 'highpass',
      startFreq: 2150 * pj,
      startOffsetSec: 0.001,
      durationSec: 0.012,
      gain: 0.36 * gj,
      attackSec: 0.0008,
    });
    if (arcade) {
      scheduleTone(ctx, destination, {
        type: 'sine',
        startFreq: 523.25 * pitch,
        endFreq: 523.25 * pitch,
        startOffsetSec: 0.005,
        durationSec: 0.042,
        gain: 0.14,
      });
    }
  },
  sessionFreeze({ ctx, destination, punch, reverb, pitch, tailScale }) {
    // Ground the chord with a crisp 0ms PBT switch-click actuation transient
    schedulePbtSwitchClick(ctx, punch, 0, 1.0);
    const freqs = [523.25, 659.25, 783.99];
    freqs.forEach((f, idx) => {
      const offset = idx * 0.036;
      if (idx > 0) {
        schedulePbtSwitchClick(ctx, punch, offset, 0.72);
      }
      scheduleTone(ctx, destination, {
        type: 'triangle',
        startFreq: f * pitch,
        endFreq: f * pitch,
        startOffsetSec: offset,
        durationSec: 0.06 * tailScale,
        gain: idx === 2 ? 0.26 : 0.18,
        reverbNode: reverb,
        reverbSend: 0.2 * tailScale,
      });
    });
  },
  tagPop({ ctx, destination, reverb, pitch, tailScale }) {
    // 0ms PBT keycap switch-click directly under the pentatonic chime attack
    schedulePbtSwitchClick(ctx, destination, 0, 0.95);
    scheduleTone(ctx, destination, {
      type: 'triangle',
      startFreq: 680 * pitch,
      endFreq: 680 * pitch,
      startOffsetSec: 0,
      durationSec: 0.036 * tailScale,
      gain: 0.22,
    });
    scheduleTone(ctx, destination, {
      type: 'sine',
      startFreq: 1046.5 * pitch,
      endFreq: 1046.5 * pitch,
      startOffsetSec: 0.01,
      durationSec: 0.055 * tailScale,
      gain: 0.16,
      reverbNode: reverb,
      reverbSend: 0.24 * tailScale,
    });
  },
  uncheck({ ctx, destination }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    // Sharp 7ms high-mid switch-release click + boosted mechanical body (~+4 dB)
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 3750 * pj,
      endFreq: 2550 * pj,
      q: 2.2,
      startOffsetSec: 0,
      durationSec: 0.007,
      gain: 0.54 * gj,
      attackSec: 0.0006,
    });
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1820 * pj,
      endFreq: 960 * pj,
      q: 2.4,
      startOffsetSec: 0,
      durationSec: 0.013,
      gain: 0.56 * gj,
      attackSec: 0.0008,
    });
    scheduleTone(ctx, destination, {
      type: 'triangle',
      startFreq: 350 * pj,
      endFreq: 215 * pj,
      startOffsetSec: 0,
      durationSec: 0.014,
      gain: 0.3 * gj,
      attackSec: 0.0008,
    });
  },
  hoverRiffle({ ctx, destination }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    // Crisp 7ms bandpass matte brush clearly audible at 35% desk volume
    scheduleFilteredNoise(ctx, destination, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 3500 * pj,
      endFreq: 2650 * pj,
      q: 2.4,
      startOffsetSec: 0,
      durationSec: 0.007,
      gain: 0.27 * gj,
      attackSec: 0.0006,
    });
  },
  delete({ ctx, punch }) {
    const pj = pitchJitter();
    const gj = gainJitter();
    scheduleFilteredNoise(ctx, punch, {
      color: 'white',
      filterType: 'bandpass',
      startFreq: 1450 * pj,
      endFreq: 480 * pj,
      q: 1.9,
      startOffsetSec: 0,
      durationSec: 0.018,
      gain: 0.46 * gj,
      attackSec: 0.0008,
    });
    scheduleFilteredNoise(ctx, punch, {
      color: 'brown',
      filterType: 'lowpass',
      startFreq: 480 * pj,
      endFreq: 160,
      startOffsetSec: 0.002,
      durationSec: 0.02,
      gain: 0.4 * gj,
      attackSec: 0.0008,
    });
  },
  error({ ctx, punch }) {
    for (const offset of [0, 0.056]) {
      scheduleFilteredNoise(ctx, punch, {
        color: 'brown',
        filterType: 'lowpass',
        startFreq: offset === 0 ? 520 : 390,
        endFreq: 170,
        startOffsetSec: offset,
        durationSec: 0.02,
        gain: 0.46,
        attackSec: 0.0008,
      });
      scheduleFilteredNoise(ctx, punch, {
        color: 'white',
        filterType: 'bandpass',
        startFreq: offset === 0 ? 1500 : 1120,
        q: 2.5,
        startOffsetSec: offset,
        durationSec: 0.011,
        gain: 0.3,
        attackSec: 0.0008,
      });
    }
  },
};
