import { useEffect, useRef, useState } from 'react';
import { categorizeLink } from '@/lib/categorizer/categorizer';
import { matchFromLibraryMemory } from '@/lib/categorizer/library-matcher';
import {
  acquireWarmNanoSession,
  type NanoCategorizerSession,
  releaseWarmNanoSession,
} from '@/lib/categorizer/nano-engine';
import { evaluateTier1Rules } from '@/lib/categorizer/rules-engine';
import type { CategorizationSuggestion } from '@/lib/categorizer/types';
import type {
  CategorizationRule,
  Collection,
  LinkItem,
  Space,
} from '@/lib/types/stash';

interface UseQuickStashCategorizerOptions {
  tabUrl: string;
  tabTitle: string;
  loadingData: boolean;
  enableOnDeviceAi: boolean;
  rules: readonly CategorizationRule[];
  collections: readonly Collection[];
  orderedCollections: readonly Collection[];
  links: readonly LinkItem[];
  spaces: readonly Space[];
  onResetTab: () => void;
  onSelectCollection: (collectionId: string) => void;
  onFillNote: (note: string) => void;
  onFillTags: (tagsRaw: string) => void;
  hasUserPickedCollection: () => boolean;
  hasUserEditedNote: () => boolean;
  hasUserEditedTags: () => boolean;
}

/**
 * Runs 0ms Tier 1 rule & Tier 1.5 Library Memory matching on frame 0, then
 * optional background Gemini Nano categorization/tag enrichment with AbortController
 * cancellation on tab switch.
 */
export function useQuickStashCategorizer({
  tabUrl,
  tabTitle,
  loadingData,
  enableOnDeviceAi,
  rules,
  collections,
  orderedCollections,
  links,
  spaces,
  onResetTab,
  onSelectCollection,
  onFillNote,
  onFillTags,
  hasUserPickedCollection,
  hasUserEditedNote,
  hasUserEditedTags,
}: UseQuickStashCategorizerOptions) {
  const [suggestion, setSuggestion] = useState<CategorizationSuggestion | null>(
    null,
  );
  const [categorizing, setCategorizing] = useState(false);
  const [enrichingTags, setEnrichingTags] = useState(false);

  const latestRef = useRef({
    rules,
    collections,
    orderedCollections,
    links,
    spaces,
    onResetTab,
    onSelectCollection,
    onFillNote,
    onFillTags,
    hasUserPickedCollection,
    hasUserEditedNote,
    hasUserEditedTags,
  });
  latestRef.current = {
    rules,
    collections,
    orderedCollections,
    links,
    spaces,
    onResetTab,
    onSelectCollection,
    onFillNote,
    onFillTags,
    hasUserPickedCollection,
    hasUserEditedNote,
    hasUserEditedTags,
  };

  useEffect(() => {
    const latest = latestRef.current;
    latest.onResetTab();
    setSuggestion(null);
    setCategorizing(false);
    setEnrichingTags(false);

    if (!tabUrl || loadingData) return;

    const target = { url: tabUrl, title: tabTitle };
    const validIds = new Set(latest.collections.map((c) => c.id));

    const instantRule = evaluateTier1Rules(target, latest.rules, validIds);
    if (instantRule) {
      setSuggestion(instantRule);
      if (instantRule.collectionId) {
        latest.onSelectCollection(instantRule.collectionId);
      }
      if (instantRule.tags.length > 0) {
        latest.onFillTags(instantRule.tags.join(', '));
      }
      return;
    }

    const instantLibrary = matchFromLibraryMemory(
      target,
      latest.collections,
      latest.links,
    );
    if (instantLibrary) {
      latest.onSelectCollection(instantLibrary.collectionId);
      setSuggestion({
        source: 'library',
        collectionId: instantLibrary.collectionId,
        matchedLibraryReason: instantLibrary.reason,
        tags: [],
      });
      if (!enableOnDeviceAi) return;
      setEnrichingTags(true);
    } else {
      if (!enableOnDeviceAi) {
        if (latest.orderedCollections[0]) {
          latest.onSelectCollection(latest.orderedCollections[0].id);
        }
        return;
      }
      setCategorizing(true);
    }

    const controller = new AbortController();

    const runSuggestion = async () => {
      let warmSession: NanoCategorizerSession | null = null;
      try {
        warmSession = await acquireWarmNanoSession(controller.signal);
        if (controller.signal.aborted) return;
        const result = await categorizeLink(target, {
          rules: latest.rules,
          collections: latest.collections,
          links: latest.links,
          spaces: latest.spaces,
          enableOnDeviceAi,
          enrichLibraryMatchWithNano: true,
          nanoSession: warmSession,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setSuggestion(result);
        if (!latestRef.current.hasUserPickedCollection()) {
          if (result.collectionId) {
            latestRef.current.onSelectCollection(result.collectionId);
          } else if (latest.orderedCollections[0]) {
            latestRef.current.onSelectCollection(
              latest.orderedCollections[0].id,
            );
          }
        }
        if (result.tags.length > 0 && !latestRef.current.hasUserEditedTags()) {
          latestRef.current.onFillTags(result.tags.join(', '));
        }
        if (result.summaryNote && !latestRef.current.hasUserEditedNote()) {
          latestRef.current.onFillNote(result.summaryNote);
        }
      } finally {
        releaseWarmNanoSession(warmSession);
        if (!controller.signal.aborted) {
          setCategorizing(false);
          setEnrichingTags(false);
        }
      }
    };

    void runSuggestion();

    return () => {
      controller.abort();
    };
  }, [tabUrl, tabTitle, loadingData, enableOnDeviceAi]);

  return { suggestion, categorizing, enrichingTags };
}
