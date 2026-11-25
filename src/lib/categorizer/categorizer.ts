import { matchFromLibraryMemory } from '@/lib/categorizer/library-matcher';
import {
  categorizeWithNano,
  type NanoCategorizerSession,
} from '@/lib/categorizer/nano-engine';
import { evaluateTier1Rules } from '@/lib/categorizer/rules-engine';
import type {
  CategorizationSuggestion,
  CategorizationTarget,
} from '@/lib/categorizer/types';
import type {
  CategorizationRule,
  Collection,
  LinkItem,
  Space,
} from '@/lib/types/stash';

export interface CategorizeLinkOptions {
  rules: readonly CategorizationRule[];
  collections: readonly Collection[];
  links?: readonly LinkItem[];
  spaces?: readonly Space[];
  enableOnDeviceAi: boolean;
  /** When true, still ask Nano for tags/summary even on a Library Memory match, keeping collectionId locked */
  enrichLibraryMatchWithNano?: boolean;
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

  const spaceNamesById =
    options.spaces && options.spaces.length > 0
      ? new Map(options.spaces.map((s) => [s.id, s.name]))
      : undefined;

  // Tier 1.5: Instant Library Memory (existing domain affinity + collection name match)
  const libraryHit = matchFromLibraryMemory(
    target,
    options.collections,
    options.links ?? [],
  );
  if (libraryHit) {
    let tags: string[] = [];
    let summaryNote: string | undefined;

    if (
      options.enrichLibraryMatchWithNano &&
      options.enableOnDeviceAi &&
      !options.signal?.aborted
    ) {
      const nanoEnrich = options.nanoSession
        ? await options.nanoSession.categorize(
            target,
            options.collections,
            options.signal,
            spaceNamesById,
          )
        : await categorizeWithNano(
            target,
            options.collections,
            options.signal,
            spaceNamesById,
          );
      if (nanoEnrich) {
        tags = nanoEnrich.tags;
        summaryNote = nanoEnrich.summaryNote;
      }
    }

    return {
      source: 'library',
      collectionId: libraryHit.collectionId,
      matchedLibraryReason: libraryHit.reason,
      tags,
      summaryNote,
    };
  }

  // Tier 2: Optional Chrome On-Device AI (Gemini Nano)
  if (options.enableOnDeviceAi && !options.signal?.aborted) {
    const nanoSuggestion = options.nanoSession
      ? await options.nanoSession.categorize(
          target,
          options.collections,
          options.signal,
          spaceNamesById,
        )
      : await categorizeWithNano(
          target,
          options.collections,
          options.signal,
          spaceNamesById,
        );
    if (nanoSuggestion) {
      return nanoSuggestion;
    }
  }

  return {
    source: 'none',
    tags: [],
  };
}
