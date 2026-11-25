import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { categorizeLink } from '@/lib/categorizer/categorizer';
import type { CategorizationSuggestion } from '@/lib/categorizer/types';
import { autoAssignCollectionIconIfEmpty } from '@/lib/icons/auto-assign-icon';
import { stashRepo } from '@/lib/storage/repo';
import type {
  CategorizationRule,
  Collection,
  LinkItem,
  StashSettings,
} from '@/lib/types/stash';
import { normalizeTags } from '@/lib/utils/url';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';
import { useUiStore } from '@/store/ui-store';

export interface TriageRow {
  link: LinkItem;
  suggestion: CategorizationSuggestion;
  destination: string; // '' = keep in session, '__new__:Name', or collectionId
}

export const TRIAGE_NEW_PREFIX = '__new__:';
export const TRIAGE_CREATE_CUSTOM_SENTINEL = '__create_custom__';

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
    useBackgroundJobsStore.getState().removeJob('triage');
    clearTriage();
  }, [clearTriage]);

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
      for (let i = 0; i < sessionLinks.length; i++) {
        const link = sessionLinks[i];
        if (!link || cancelAnalysisRef.current) break;
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
        const suggestion = await categorizeLink(
          { url: link.url, title: link.title },
          {
            rules,
            collections: destinationCollections,
            enableOnDeviceAi: settings.enableOnDeviceAi,
          },
        );
        if (cancelAnalysisRef.current) break;
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

      if (cancelAnalysisRef.current) {
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

  const assignedCount = rows.filter((row) => row.destination !== '').length;

  const handleChangeDestination = (linkId: string, value: string) => {
    if (value === TRIAGE_CREATE_CUSTOM_SENTINEL) {
      setEditingCustomRowId(linkId);
      setCustomDraft('');
      return;
    }
    setRows((prev) =>
      prev.map((row) =>
        row.link.id === linkId ? { ...row, destination: value } : row,
      ),
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
      const createdByName = new Map<
        string,
        { id: string; name: string; sampleTitles: string[] }
      >();
      let movedCount = 0;
      let skippedDuplicates = 0;

      for (const row of rows) {
        if (!row.destination) continue;

        let targetCollectionId = row.destination;
        if (targetCollectionId.startsWith(TRIAGE_NEW_PREFIX)) {
          const newName = targetCollectionId
            .slice(TRIAGE_NEW_PREFIX.length)
            .trim();
          const key = newName.toLowerCase();
          const existingNew = createdByName.get(key);
          if (existingNew) {
            targetCollectionId = existingNew.id;
            existingNew.sampleTitles.push(row.link.title);
          } else {
            const created = await stashRepo.createCollection({ name: newName });
            createdByName.set(key, {
              id: created.id,
              name: created.name,
              sampleTitles: [row.link.title],
            });
            targetCollectionId = created.id;
          }
        }

        const mergedTags = normalizeTags([
          ...row.link.tags,
          ...row.suggestion.tags,
        ]);
        const nextNote =
          row.link.note.trim() || row.suggestion.summaryNote || '';

        const moved = await stashRepo.moveOrReorderLink(
          row.link.id,
          targetCollectionId,
        );
        if (!moved.ok) {
          if (moved.reason === 'duplicate') {
            skippedDuplicates += 1;
          }
          continue;
        }

        if (
          mergedTags.length !== row.link.tags.length ||
          nextNote !== row.link.note
        ) {
          await stashRepo.updateLink(row.link.id, {
            tags: mergedTags,
            note: nextNote,
          });
        }
        movedCount += 1;
      }

      if (deleteEmptySession) {
        const remaining = (await stashRepo.getLinks()).filter(
          (l) => l.collectionId === triageCollectionId,
        );
        if (remaining.length === 0) {
          await stashRepo.deleteCollection(triageCollectionId);
        }
      }

      if (movedCount > 0) {
        toast.success(
          `Categorized ${movedCount} link${movedCount === 1 ? '' : 's'}${skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicate${skippedDuplicates === 1 ? '' : 's'} kept)` : ''}`,
        );
      } else if (skippedDuplicates > 0) {
        toast.info(
          `${skippedDuplicates} link${skippedDuplicates === 1 ? '' : 's'} already existed in the destination collection.`,
        );
      } else {
        toast.info('No links were moved.');
      }

      clearTriage();
      useBackgroundJobsStore.getState().removeJob('triage');

      for (const created of createdByName.values()) {
        void autoAssignCollectionIconIfEmpty(
          created.id,
          created.name,
          created.sampleTitles,
        );
      }
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
    handleChangeDestination,
    commitCustomCategory,
    handleApplyBulkOverride,
    handleAcceptAll,
  };
}
