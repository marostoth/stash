import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { playDelete } from '@/lib/audio/foley';
import { categorizeLink } from '@/lib/categorizer/categorizer';
import {
  createNanoCategorizerSession,
  type NanoCategorizerSession,
} from '@/lib/categorizer/nano-engine';
import { evaluateTier1Rules } from '@/lib/categorizer/rules-engine';
import type { CategorizationSuggestion } from '@/lib/categorizer/types';
import { applyTriageRows } from '@/lib/tabs/triage-apply';
import type {
  CategorizationRule,
  Collection,
  LinkItem,
  StashSettings,
} from '@/lib/types/stash';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';
import { useUiStore } from '@/store/ui-store';

export interface TriageRow {
  link: LinkItem;
  suggestion: CategorizationSuggestion;
  destination: string; // '' = keep in session, '__delete__', '__new__:Name', or collectionId
}

export const TRIAGE_NEW_PREFIX = '__new__:';
export const TRIAGE_CREATE_CUSTOM_SENTINEL = '__create_custom__';
export const TRIAGE_DELETE_SENTINEL = '__delete__';

export function useTriageWorkflow(
  collections: readonly Collection[],
  links: readonly LinkItem[],
  rules: readonly CategorizationRule[],
  settings: StashSettings,
) {
  const triageCollectionId = useUiStore((s) => s.triageCollectionId);
  const triageOpen = useUiStore((s) => s.triageOpen);
  const reopenTriage = useUiStore((s) => s.reopenTriage);
  const closeTriage = useUiStore((s) => s.closeTriage);
  const clearTriage = useUiStore((s) => s.clearTriage);

  const [rows, setRows] = useState<TriageRow[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<{
    current: number;
    total: number;
    title: string;
  } | null>(null);
  const [applying, setApplying] = useState(false);
  const [deleteEmptySession, setDeleteEmptySession] = useState(true);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [editingCustomRowId, setEditingCustomRowId] = useState<string | null>(
    null,
  );
  const [customDraft, setCustomDraft] = useState('');
  const [bulkDestination, setBulkDestination] = useState('');

  const cancelAnalysisRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previousDestRef = useRef<Map<string, string>>(new Map());
  const analyzedCollectionIdRef = useRef<string | null>(null);
  const openRef = useRef(triageOpen);
  openRef.current = triageOpen;

  const sessionCollection = useMemo(
    () => collections.find((c) => c.id === triageCollectionId) ?? null,
    [collections, triageCollectionId],
  );

  const destinationCollections = useMemo(
    () => collections.filter((c) => c.id !== triageCollectionId),
    [collections, triageCollectionId],
  );

  const sessionLinks = useMemo(
    () =>
      links
        .filter((l) => l.collectionId === triageCollectionId)
        .sort((a, b) => a.order - b.order),
    [links, triageCollectionId],
  );

  const cancelAndClear = useCallback(() => {
    cancelAnalysisRef.current = true;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    useBackgroundJobsStore.getState().removeJob('triage');
    clearTriage();
  }, [clearTriage]);

  useEffect(() => {
    return () => {
      cancelAnalysisRef.current = true;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!triageOpen) return;
    const job = useBackgroundJobsStore
      .getState()
      .jobs.find((j) => j.id === 'triage');
    if (job?.status === 'ready') {
      useBackgroundJobsStore.getState().removeJob('triage');
    }
  }, [triageOpen]);

  useEffect(() => {
    if (!triageCollectionId || !sessionCollection) {
      analyzedCollectionIdRef.current = null;
      setRows([]);
      setCustomCategories([]);
      setEditingCustomRowId(null);
      setBulkDestination('');
      useBackgroundJobsStore.getState().removeJob('triage');
      return;
    }

    if (analyzedCollectionIdRef.current === triageCollectionId) {
      return;
    }

    analyzedCollectionIdRef.current = triageCollectionId;
    cancelAnalysisRef.current = false;
    previousDestRef.current.clear();
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setAnalyzing(true);
    setAnalyzeProgress({
      current: 0,
      total: sessionLinks.length,
      title: sessionLinks[0]?.title ?? '',
    });

    useBackgroundJobsStore.getState().upsertJob({
      id: 'triage',
      title: 'Auto-Categorize',
      detail: `0 / ${sessionLinks.length} · ${sessionCollection.name}`,
      status: 'running',
      progress: { current: 0, total: sessionLinks.length },
      usesNano: settings.enableOnDeviceAi,
      onReopen: reopenTriage,
      onCancel: cancelAndClear,
    });

    const runCategorization = async () => {
      const nextRows: TriageRow[] = [];
      const validDestIds = new Set(destinationCollections.map((c) => c.id));
      let nanoSession: NanoCategorizerSession | null = null;
      let triedCreateNano = false;

      try {
        for (let i = 0; i < sessionLinks.length; i++) {
          const link = sessionLinks[i];
          if (!link || cancelAnalysisRef.current || controller.signal.aborted) {
            break;
          }
          setAnalyzeProgress({
            current: i,
            total: sessionLinks.length,
            title: link.title,
          });
          useBackgroundJobsStore.getState().upsertJob({
            id: 'triage',
            title: 'Auto-Categorize',
            detail: `${i} / ${sessionLinks.length} · ${link.title}`,
            status: 'running',
            progress: { current: i, total: sessionLinks.length },
            usesNano: settings.enableOnDeviceAi,
            onReopen: reopenTriage,
            onCancel: cancelAndClear,
          });

          // Tier 1 rules run instantly (0ms); lazily create ONE base Nano session
          // only on the first link that misses all Tier 1 rules.
          const ruleHit = evaluateTier1Rules(
            { url: link.url, title: link.title },
            rules,
            validDestIds,
          );
          let suggestion: CategorizationSuggestion;
          if (ruleHit) {
            suggestion = ruleHit;
          } else {
            if (settings.enableOnDeviceAi && !triedCreateNano) {
              triedCreateNano = true;
              nanoSession = await createNanoCategorizerSession(
                controller.signal,
              );
            }
            if (cancelAnalysisRef.current || controller.signal.aborted) break;
            suggestion = await categorizeLink(
              { url: link.url, title: link.title },
              {
                rules,
                collections: destinationCollections,
                enableOnDeviceAi: Boolean(nanoSession),
                nanoSession,
                signal: controller.signal,
              },
            );
          }

          if (cancelAnalysisRef.current || controller.signal.aborted) break;
          const defaultDest =
            suggestion.collectionId ??
            (suggestion.suggestedNewCollection
              ? `${TRIAGE_NEW_PREFIX}${suggestion.suggestedNewCollection}`
              : '');
          nextRows.push({ link, suggestion, destination: defaultDest });
          setAnalyzeProgress({
            current: i + 1,
            total: sessionLinks.length,
            title: link.title,
          });
        }
      } finally {
        nanoSession?.destroy();
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }

      if (cancelAnalysisRef.current || controller.signal.aborted) {
        setAnalyzing(false);
        setAnalyzeProgress(null);
        useBackgroundJobsStore.getState().removeJob('triage');
        return;
      }

      setRows(nextRows);
      setAnalyzing(false);
      setAnalyzeProgress(null);

      if (!openRef.current) {
        useBackgroundJobsStore.getState().upsertJob({
          id: 'triage',
          title: 'Auto-Categorize ready',
          detail: `${nextRows.length} ${nextRows.length === 1 ? 'link' : 'links'} analyzed · Click to review`,
          status: 'ready',
          reopenLabel: 'Review',
          onReopen: reopenTriage,
          onCancel: clearTriage,
        });
      } else {
        useBackgroundJobsStore.getState().removeJob('triage');
      }
    };

    void runCategorization();
  }, [
    triageCollectionId,
    sessionCollection,
    sessionLinks,
    rules,
    destinationCollections,
    settings.enableOnDeviceAi,
    reopenTriage,
    clearTriage,
    cancelAndClear,
  ]);

  const availableNewCategories = useMemo(() => {
    const existingLower = new Set(
      destinationCollections.map((c) => c.name.trim().toLowerCase()),
    );
    const byLower = new Map<string, string>();
    for (const row of rows) {
      const name = row.suggestion.suggestedNewCollection?.trim();
      if (name && !existingLower.has(name.toLowerCase())) {
        byLower.set(name.toLowerCase(), name);
      }
    }
    for (const name of customCategories) {
      const trimmed = name.trim();
      if (trimmed && !existingLower.has(trimmed.toLowerCase())) {
        byLower.set(trimmed.toLowerCase(), trimmed);
      }
    }
    return Array.from(byLower.values());
  }, [rows, customCategories, destinationCollections]);

  const deleteCount = rows.filter(
    (row) => row.destination === TRIAGE_DELETE_SENTINEL,
  ).length;
  const moveCount = rows.filter(
    (row) =>
      row.destination !== '' && row.destination !== TRIAGE_DELETE_SENTINEL,
  ).length;
  const assignedCount = moveCount + deleteCount;

  const handleChangeDestination = (linkId: string, value: string) => {
    if (value === TRIAGE_CREATE_CUSTOM_SENTINEL) {
      setEditingCustomRowId(linkId);
      setCustomDraft('');
      return;
    }
    if (value !== TRIAGE_DELETE_SENTINEL) {
      previousDestRef.current.set(linkId, value);
    }
    setRows((prev) =>
      prev.map((row) =>
        row.link.id === linkId ? { ...row, destination: value } : row,
      ),
    );
  };

  const toggleDiscardRow = (linkId: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.link.id !== linkId) return row;
        if (row.destination === TRIAGE_DELETE_SENTINEL) {
          const restored = previousDestRef.current.get(linkId) ?? '';
          return { ...row, destination: restored };
        }
        previousDestRef.current.set(linkId, row.destination);
        return { ...row, destination: TRIAGE_DELETE_SENTINEL };
      }),
    );
  };

  const commitCustomCategory = (linkId: string) => {
    const trimmed = customDraft.trim();
    setEditingCustomRowId(null);
    setCustomDraft('');
    if (!trimmed) return;

    const existing = destinationCollections.find(
      (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) {
      handleChangeDestination(linkId, existing.id);
      return;
    }

    setCustomCategories((prev) =>
      prev.some((c) => c.toLowerCase() === trimmed.toLowerCase())
        ? prev
        : [...prev, trimmed],
    );
    handleChangeDestination(linkId, `${TRIAGE_NEW_PREFIX}${trimmed}`);
  };

  const handleApplyBulkOverride = () => {
    setRows((prev) =>
      prev.map((row) => ({ ...row, destination: bulkDestination })),
    );
  };

  const handleAcceptAll = async () => {
    if (!triageCollectionId || applying) return;
    setApplying(true);

    try {
      const { movedCount, deletedCount, skippedDuplicates } =
        await applyTriageRows({
          triageCollectionId,
          rows: rows.map((row) => ({
            link: row.link,
            destination: row.destination,
            suggestionTags: row.suggestion.tags,
            suggestionSummaryNote: row.suggestion.summaryNote,
          })),
          newPrefix: TRIAGE_NEW_PREFIX,
          deleteSentinel: TRIAGE_DELETE_SENTINEL,
          deleteEmptySession,
        });

      if (deletedCount > 0 && movedCount === 0) {
        playDelete(settings.soundEffects);
      }

      if (movedCount > 0 && deletedCount > 0) {
        toast.success(
          `Categorized ${movedCount} link${movedCount === 1 ? '' : 's'} · deleted ${deletedCount}${skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicate${skippedDuplicates === 1 ? '' : 's'} kept)` : ''}`,
        );
      } else if (movedCount > 0) {
        toast.success(
          `Categorized ${movedCount} link${movedCount === 1 ? '' : 's'}${skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicate${skippedDuplicates === 1 ? '' : 's'} kept)` : ''}`,
        );
      } else if (deletedCount > 0) {
        toast.success(
          `Deleted ${deletedCount} link${deletedCount === 1 ? '' : 's'} from session`,
        );
      } else if (skippedDuplicates > 0) {
        toast.info(
          `${skippedDuplicates} link${skippedDuplicates === 1 ? '' : 's'} already existed in the destination collection.`,
        );
      } else {
        toast.info('No links were changed.');
      }

      clearTriage();
      useBackgroundJobsStore.getState().removeJob('triage');
    } finally {
      setApplying(false);
    }
  };

  return {
    triageCollectionId,
    triageOpen,
    closeTriage,
    cancelAndClear,
    sessionCollection,
    destinationCollections,
    sessionLinks,
    rows,
    analyzing,
    analyzeProgress,
    applying,
    deleteEmptySession,
    setDeleteEmptySession,
    editingCustomRowId,
    setEditingCustomRowId,
    customDraft,
    setCustomDraft,
    bulkDestination,
    setBulkDestination,
    availableNewCategories,
    assignedCount,
    moveCount,
    deleteCount,
    handleChangeDestination,
    toggleDiscardRow,
    commitCustomCategory,
    handleApplyBulkOverride,
    handleAcceptAll,
  };
}
