export const PENTATONIC_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16] as const;
export const COMBO_RESET_MS = 2500;
export const HOVER_RIFFLE_COOLDOWN_MS = 45;

export type ComboTier = 1 | 2 | 3;

export function resolveComboTier(count: number): ComboTier {
  if (count >= 5) return 3;
  if (count >= 3) return 2;
  return 1;
}

export interface ComboStep {
  step: number;
  count: number;
  tier: ComboTier;
  semitones: number;
  multiplier: number;
}

export interface ComboTracker {
  next(nowMs?: number): ComboStep;
  peekStep(nowMs?: number): number;
  reset(): void;
}

export interface CooldownGate {
  tryAcquire(nowMs?: number): boolean;
  reset(): void;
}

export function semitonesToMultiplier(semitones: number): number {
  return 2 ** (semitones / 12);
}

/**
 * Steps up a pentatonic scale on rapid consecutive events and resets to step 0
 * after `resetMs` (default 2500ms) of inactivity.
 */
export function createComboTracker(
  resetMs = COMBO_RESET_MS,
  scale: readonly number[] = PENTATONIC_SEMITONES,
): ComboTracker {
  let step = -1;
  let count = 0;
  let lastEventMs: number | null = null;

  return {
    next(nowMs = Date.now()): ComboStep {
      const expired = lastEventMs === null || nowMs - lastEventMs > resetMs;
      if (expired) {
        step = 0;
        count = 1;
      } else {
        step = Math.min(step + 1, Math.max(0, scale.length - 1));
        count += 1;
      }
      lastEventMs = nowMs;

      const semitones = scale[step] ?? 0;
      return {
        step,
        count,
        tier: resolveComboTier(count),
        semitones,
        multiplier: semitonesToMultiplier(semitones),
      };
    },

    peekStep(nowMs = Date.now()): number {
      if (lastEventMs === null || nowMs - lastEventMs > resetMs) {
        return 0;
      }
      return Math.max(0, step);
    },

    reset(): void {
      step = -1;
      count = 0;
      lastEventMs = null;
    },
  };
}

/**
 * Enforces a minimum cooldown (default 45ms) between rapid hover-riffle ticks.
 */
export function createCooldownGate(
  cooldownMs = HOVER_RIFFLE_COOLDOWN_MS,
): CooldownGate {
  let lastAllowedMs: number | null = null;

  return {
    tryAcquire(nowMs = Date.now()): boolean {
      if (lastAllowedMs !== null && nowMs - lastAllowedMs < cooldownMs) {
        return false;
      }
      lastAllowedMs = nowMs;
      return true;
    },

    reset(): void {
      lastAllowedMs = null;
    },
  };
}
