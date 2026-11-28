import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  showReorganizeUndoToast,
  upsertReorganizeBackgroundJob,
} from '@/components/reorganize/reorganize-undo-toast';
import { playSessionFreeze } from '@/lib/audio/foley';
import { checkNanoAvailability } from '@/lib/categorizer/nano-engine';
import {
  buildExportBundle,
  formatBackupFilename,
} from '@/lib/import-export/bundle';
import { triggerFileDownload } from '@/lib/import-export/chrome-bookmarks';
import {
  type ProposedCategory,
  UNCATEGORIZED_CATEGORY_NAME,
} from '@/lib/reorganize/digest';
import {
  proposeCategories,
  type SortLinksProgress,
  sortLinksIntoCategories,
} from '@/lib/reorganize/engine';
import {
  buildReorganizationPlan,
  mergeSpaceReorganization,
  type ReorganizeScope,
} from '@/lib/reorganize/plan';
import { cloneBoardState } from '@/lib/storage/reorganize-ops';
import { stashRepo } from '@/lib/storage/repo';
import {
  type Collection,
  DEFAULT_SPACE_ID,
  type LinkItem,
  type Space,
  type StashSettings,
} from '@/lib/types/stash';
import { extractDomain } from '@/lib/utils/url';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';
import { useFxStore } from '@/store/fx-store';
import { useUiStore } from '@/store/ui-store';

export type WizardStep = 'scope' | 'checkpoint' | 'sorting' | 'preview';

export function useReorganizeWorkflow(
  allCollections: readonly Collection[],
  allLinks: readonly LinkItem[],
  settings: StashSettings,
  activeSpace?: Space,
) {
  const activeSpaceId = activeSpace?.id ?? DEFAULT_SPACE_ID;

  // Strictly scope Smart Reorganize to the active Space so AI never mixes Spaces
  const collections = useMemo(
    () =>
      allCollections.filter(
        (col) => (col.spaceId ?? DEFAULT_SPACE_ID) === activeSpaceId,
      ),
    [allCollections, activeSpaceId],
  );

  const spaceCollectionIds = useMemo(
    () => new Set(collections.map((c) => c.id)),
    [collections],
  );

  const links = useMemo(
    () => allLinks.filter((link) => spaceCollectionIds.has(link.collectionId)),
    [allLinks, spaceCollectionIds],
  );
  const open = useUiStore((s) => s.reorganizeOpen);
  const openReorganize = useUiStore((s) => s.openReorganize);
  const closeReorganize = useUiStore((s) => s.closeReorganize);

  const [step, setStep] = useState<WizardStep>('scope');
  const [nanoReady, setNanoReady] = useState(false);
  const [mode, setMode] = useState<'collections' | 'full'>('collections');
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<
    Set<string>
  >(() => new Set());
  const [removeEmptySources, setRemoveEmptySources] = useState(true);
  const [keepExistingTargets, setKeepExistingTargets] = useState(true);

  const [proposing, setProposing] = useState(false);
  const [categories, setCategories] = useState<ProposedCategory[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [sortProgress, setSortProgress] = useState<SortLinksProgress | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const stepRef = useRef(step);
  stepRef.current = step;
  const proposingRef = useRef(proposing);
  proposingRef.current = proposing;

  const linkCountByCollection = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of links) {
      counts.set(link.collectionId, (counts.get(link.collectionId) ?? 0) + 1);
    }
    return counts;
  }, [links]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      useBackgroundJobsStore.getState().removeJob('reorganize');
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const existingJob = useBackgroundJobsStore
      .getState()
      .jobs.find((j) => j.id === 'reorganize');
    if (existingJob?.status === 'ready') {
      useBackgroundJobsStore.getState().removeJob('reorganize');
    }

    if (!proposingRef.current && stepRef.current === 'scope') {
      setErrorMessage(null);
      setSortProgress(null);
      setSelectedCollectionIds((prev) => {
        const valid = Array.from(prev).filter((id) =>
          collections.some((c) => c.id === id),
        );
        if (valid.length > 0) return new Set(valid);
        const imported = collections.find((c) =>
          /import|bookmark|session/i.test(c.name),
        );
        const fallback = imported ?? collections[0];
        return fallback ? new Set([fallback.id]) : new Set();
      });
    }

    let active = true;
    void checkNanoAvailability()
      .then((status) => {
        if (active) setNanoReady(status === 'available');
      })
      .catch(() => {
        if (active) setNanoReady(false);
      });

    return () => {
      active = false;
    };
  }, [open, collections]);

  const scope: ReorganizeScope = useMemo(
    () =>
      mode === 'full'
        ? { mode: 'full' }
        : {
            mode: 'collections',
            collectionIds: Array.from(selectedCollectionIds),
            keepExistingTargets,
          },
    [mode, selectedCollectionIds, keepExistingTargets],
  );

  const scopedLinks = useMemo(() => {
    if (mode === 'full') return [...links];
    return links.filter((l) => selectedCollectionIds.has(l.collectionId));
  }, [mode, links, selectedCollectionIds]);

  const scopedDomainsCount = useMemo(() => {
    const domains = new Set<string>();
    for (const link of scopedLinks) {
      domains.add(extractDomain(link.url).toLowerCase());
    }
    return domains.size;
  }, [scopedLinks]);

  const untouchedCollectionNames = useMemo(() => {
    if (mode !== 'collections' || !keepExistingTargets) return [];
    return collections
      .filter((c) => !selectedCollectionIds.has(c.id))
      .map((c) => c.name);
  }, [mode, keepExistingTargets, collections, selectedCollectionIds]);

  const targetCategoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const cat of categories) {
      const trimmed = cat.name.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        options.push(trimmed);
      }
    }
    for (const name of untouchedCollectionNames) {
      const key = name.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        options.push(name.trim());
      }
    }
    if (!seen.has(UNCATEGORIZED_CATEGORY_NAME.toLowerCase())) {
      options.push(UNCATEGORIZED_CATEGORY_NAME);
    }
    return options;
  }, [categories, untouchedCollectionNames]);

  const previewPlan = useMemo(
    () =>
      buildReorganizationPlan(
        { collections: [...collections], links: [...links] },
        scope,
        categories,
        assignments,
        removeEmptySources,
        { spaceId: activeSpaceId },
      ),
    [
      collections,
      links,
      scope,
      categories,
      assignments,
      removeEmptySources,
      activeSpaceId,
    ],
  );

  const handleExportBackup = async () => {
    const snapshot = await stashRepo.getSnapshot();
    const bundle = buildExportBundle(snapshot);
    const filename = formatBackupFilename();
    triggerFileDownload(filename, `${JSON.stringify(bundle, null, 2)}\n`);
    toast.success(`Exported backup: ${filename}`);
  };

  const upsertReorganizeJob = (
    detail: string,
    opts: {
      status: 'running' | 'ready';
      progress?: { current: number; total: number } | null;
      onCancel?: () => void;
    },
  ) =>
    upsertReorganizeBackgroundJob(detail, {
      ...opts,
      onReopen: openReorganize,
    });

  const runPass1 = async () => {
    if (scopedLinks.length === 0) return;
    if (useBackgroundJobsStore.getState().hasActiveNanoJob('reorganize')) {
      toast.info('Another on-device AI task is already running.');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setProposing(true);
    setErrorMessage(null);
    upsertReorganizeJob(
      `Proposing categories for ${scopedLinks.length} links...`,
      { status: 'running', onCancel: () => controller.abort() },
    );

    let keepReadyJob = false;
    try {
      const result = await proposeCategories(scopedLinks, {
        existingCollectionNames: untouchedCollectionNames,
        signal: controller.signal,
      });

      if (result.status === 'canceled') return;
      if (result.status !== 'ok') {
        setErrorMessage(result.reason);
        return;
      }

      setCategories(result.categories);
      setStep('checkpoint');
      if (!openRef.current) {
        keepReadyJob = true;
        upsertReorganizeJob(
          `${result.categories.length} categories proposed · Click to review`,
          { status: 'ready' },
        );
      }
    } catch {
      setErrorMessage(
        'On-device AI failed to propose categories. Please try again.',
      );
    } finally {
      setProposing(false);
      if (!keepReadyJob) {
        useBackgroundJobsStore.getState().removeJob('reorganize');
      }
    }
  };

  const runPass2 = async () => {
    const cleanCategories = categories
      .map((c) => ({
        ...c,
        name: c.name.trim(),
        description: c.description.trim(),
      }))
      .filter((c) => c.name.length > 0);
    if (cleanCategories.length === 0) return;

    if (useBackgroundJobsStore.getState().hasActiveNanoJob('reorganize')) {
      toast.info('Another on-device AI task is already running.');
      return;
    }

    const seen = new Set(cleanCategories.map((c) => c.name.toLowerCase()));
    const sortingBuckets: ProposedCategory[] = [...cleanCategories];
    for (const col of collections) {
      if (
        mode === 'collections' &&
        keepExistingTargets &&
        !selectedCollectionIds.has(col.id) &&
        !seen.has(col.name.trim().toLowerCase())
      ) {
        seen.add(col.name.trim().toLowerCase());
        sortingBuckets.push({
          id: col.id,
          name: col.name.trim(),
          description: col.description ?? '',
        });
      }
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setErrorMessage(null);
    setSortProgress({
      completed: 0,
      total: scopedLinks.length,
      currentTitle: scopedLinks[0]?.title ?? '',
    });
    setStep('sorting');
    upsertReorganizeJob(`Sorting 0 / ${scopedLinks.length} links`, {
      status: 'running',
      progress: { current: 0, total: scopedLinks.length },
      onCancel: () => controller.abort(),
    });

    let keepReadyJob = false;
    try {
      const result = await sortLinksIntoCategories(
        scopedLinks,
        sortingBuckets,
        {
          signal: controller.signal,
          onProgress: (p) => {
            setSortProgress(p);
            upsertReorganizeJob(
              `Sorting ${p.completed} / ${p.total} · ${p.currentTitle}`,
              {
                status: 'running',
                progress: { current: p.completed, total: p.total },
                onCancel: () => controller.abort(),
              },
            );
          },
        },
      );

      if (result.status === 'canceled') {
        setStep('checkpoint');
        return;
      }
      if (result.status === 'unavailable' || result.status === 'error') {
        setErrorMessage(result.reason);
        setStep('checkpoint');
        return;
      }

      setAssignments(result.assignments);
      setStep('preview');
      if (!openRef.current) {
        keepReadyJob = true;
        upsertReorganizeJob(
          `${scopedLinks.length} links sorted · Review & apply`,
          { status: 'ready' },
        );
      }
    } catch {
      setErrorMessage(
        'On-device AI failed while sorting links. Please try again.',
      );
      setStep('checkpoint');
    } finally {
      setSortProgress(null);
      if (!keepReadyJob) {
        useBackgroundJobsStore.getState().removeJob('reorganize');
      }
    }
  };

  const handleApply = async () => {
    if (applying) return;
    setApplying(true);
    try {
      const previousSpaceSnapshot = cloneBoardState({
        collections: [...collections],
        links: [...links],
      });
      const plan = buildReorganizationPlan(
        { collections: [...collections], links: [...links] },
        scope,
        categories,
        assignments,
        removeEmptySources,
        { spaceId: activeSpaceId },
      );
      const mergedNextState = mergeSpaceReorganization(
        allCollections,
        allLinks,
        activeSpaceId,
        plan.nextState,
      );
      await stashRepo.applyReorganization(mergedNextState);

      playSessionFreeze(settings.soundEffects, settings.motionMode);
      if (settings.motionMode === 'arcade' && settings.fxDeskJolt !== false) {
        useFxStore.getState().triggerContainerShake('heavy');
      }
      useBackgroundJobsStore.getState().removeJob('reorganize');
      setStep('scope');
      setCategories([]);
      setAssignments({});
      closeReorganize();

      const { movedLinks, targetCollectionsCount } = plan.summary;
      showReorganizeUndoToast(
        movedLinks,
        targetCollectionsCount,
        previousSpaceSnapshot,
        activeSpaceId,
      );
    } finally {
      setApplying(false);
    }
  };

  const cancelActiveRun = () => {
    abortRef.current?.abort();
    setProposing(false);
    useBackgroundJobsStore.getState().removeJob('reorganize');
  };

  return {
    open,
    closeReorganize,
    spaceCollections: collections,
    spaceLinksCount: links.length,
    step,
    setStep,
    nanoReady,
    mode,
    setMode,
    selectedCollectionIds,
    setSelectedCollectionIds,
    removeEmptySources,
    setRemoveEmptySources,
    keepExistingTargets,
    setKeepExistingTargets,
    proposing,
    categories,
    setCategories,
    assignments,
    setAssignments,
    sortProgress,
    errorMessage,
    applying,
    linkCountByCollection,
    scopedLinks,
    scopedDomainsCount,
    targetCategoryOptions,
    previewPlan,
    handleExportBackup,
    runPass1,
    runPass2,
    handleApply,
    cancelActiveRun,
  };
}
