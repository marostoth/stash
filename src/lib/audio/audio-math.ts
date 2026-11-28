import type { MotionMode } from '@/lib/types/stash';

export const DEFAULT_PITCH_JITTER = 0.025; // ±2.5% (within ±2% to ±3%)
export const DEFAULT_GAIN_JITTER = 0.04; // ±4%
export const VOICE_CHOKE_FADE_SEC = 0.018; // 18ms click-free fade-out
export const TACTILE_TAIL_SCALE = 0.7; // ~30% tighter decay/reverb tails in Tactile

export type ChokedSoundKey = 'drop' | 'sessionFreeze' | 'delete';

export interface VoicePoolPolicy {
  maxConcurrent: number;
  tailSec: number;
}

export const VOICE_POOL_POLICIES: Record<ChokedSoundKey, VoicePoolPolicy> = {
  drop: { maxConcurrent: 2, tailSec: 0.55 },
  sessionFreeze: { maxConcurrent: 1, tailSec: 0.65 },
  delete: { maxConcurrent: 2, tailSec: 0.25 },
};

/**
 * Maps a 0–100% UI slider value to an exponential (squared) master gain in
 * [0, 1] so the 20–50% desk-volume sweet spot has smooth, fine-grained control.
 */
export function volumePercentToGain(percent: number): number {
  const clamped = Number.isFinite(percent)
    ? Math.max(0, Math.min(100, percent))
    : 75;
  const normalized = clamped / 100;
  return Math.max(0, Math.min(1, normalized * normalized));
}

/**
 * Pure symmetric jitter multiplier centered on 1.0:
 * randomUnit in [0, 1] maps linearly to [1 - amount, 1 + amount].
 */
export function computeJitter(
  amount: number,
  randomUnit = Math.random(),
): number {
  const safeAmount = Number.isFinite(amount)
    ? Math.max(0, Math.min(0.5, amount))
    : 0;
  const clampedUnit = Number.isFinite(randomUnit)
    ? Math.max(0, Math.min(1, randomUnit))
    : 0.5;
  return 1 + (clampedUnit * 2 - 1) * safeAmount;
}

export function pitchJitter(
  amount = DEFAULT_PITCH_JITTER,
  randomUnit?: number,
): number {
  return computeJitter(amount, randomUnit);
}

export function gainJitter(
  amount = DEFAULT_GAIN_JITTER,
  randomUnit?: number,
): number {
  return computeJitter(amount, randomUnit);
}

/**
 * Keeps full decay & reverb tails in Arcade while tightening tails by ~30%
 * in Tactile / calmer tiers.
 */
export function getTailScale(mode: MotionMode): number {
  return mode === 'arcade' ? 1 : TACTILE_TAIL_SCALE;
}

export interface TrackedVoice {
  expiresAtSec: number;
  choke: (nowSec: number) => void;
}

export interface VoiceLimiter<K extends string = ChokedSoundKey> {
  register(
    key: K,
    nowSec: number,
    policy: VoicePoolPolicy,
    choke: (nowSec: number) => void,
  ): number;
  activeCount(key: K, nowSec: number): number;
  reset(): void;
}

/**
 * Caps overlapping heavy-tail voices per sound key. When a rapid re-trigger
 * exceeds `maxConcurrent`, the oldest active voice(s) are choked immediately
 * (typically faded out over 15–20ms) so fast combos stay punchy and clean.
 */
export function createVoiceLimiter<
  K extends string = ChokedSoundKey,
>(): VoiceLimiter<K> {
  const buckets = new Map<K, TrackedVoice[]>();

  function prune(key: K, nowSec: number): TrackedVoice[] {
    const list = buckets.get(key);
    if (!list || list.length === 0) return [];
    const live = list.filter((entry) => entry.expiresAtSec > nowSec);
    if (live.length === 0) {
      buckets.delete(key);
    } else if (live.length !== list.length) {
      buckets.set(key, live);
    }
    return live;
  }

  function pruneAll(nowSec: number): void {
    for (const key of Array.from(buckets.keys())) {
      prune(key, nowSec);
    }
  }

  return {
    register(
      key: K,
      nowSec: number,
      policy: VoicePoolPolicy,
      choke: (nowSec: number) => void,
    ): number {
      const limit = Math.max(1, Math.floor(policy.maxConcurrent));
      pruneAll(nowSec);
      const live = prune(key, nowSec);
      let choked = 0;

      while (live.length >= limit) {
        const oldest = live.shift();
        if (oldest) {
          oldest.choke(nowSec);
          choked += 1;
        }
      }

      live.push({
        expiresAtSec: nowSec + Math.max(0.02, policy.tailSec),
        choke,
      });
      buckets.set(key, live);
      return choked;
    },

    activeCount(key: K, nowSec: number): number {
      return prune(key, nowSec).length;
    },

    reset(): void {
      buckets.clear();
    },
  };
}
