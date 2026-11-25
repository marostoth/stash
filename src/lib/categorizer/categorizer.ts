import {
  categorizeWithNano,
  type NanoCategorizerSession,
} from '@/lib/categorizer/nano-engine';
import { evaluateTier1Rules } from '@/lib/categorizer/rules-engine';
import type {
  CategorizationSuggestion,
  CategorizationTarget,
} from '@/lib/categorizer/types';
import type { CategorizationRule, Collection } from '@/lib/types/stash';

export interface CategorizeLinkOptions {
  rules: readonly CategorizationRule[];
  collections: readonly Collection[];
  enableOnDeviceAi: boolean;
  /** Optional pre-warmed base Nano session for fast cloned batch triage */
  nanoSession?: NanoCategorizerSession | null;
  signal?: AbortSignal;
}

export async function categorizeLink(
  target: CategorizationTarget,
  options: CategorizeLinkOptions,
): Promise<CategorizationSuggestion> {
  const validCollectionIds = new Set(options.collections.map((c) => c.id));

  // Tier 1: Instant local rules (0ms, always available)
  const ruleSuggestion = evaluateTier1Rules(
    target,
    options.rules,
    validCollectionIds,
  );
  if (ruleSuggestion) {
    return ruleSuggestion;
  }

  // Tier 2: Optional Chrome On-Device AI (Gemini Nano)
  if (options.enableOnDeviceAi && !options.signal?.aborted) {
    const nanoSuggestion = options.nanoSession
      ? await options.nanoSession.categorize(
          target,
          options.collections,
          options.signal,
        )
      : await categorizeWithNano(target, options.collections, options.signal);
    if (nanoSuggestion) {
      return nanoSuggestion;
    }
  }

  return {
    source: 'none',
    tags: [],
  };
}
