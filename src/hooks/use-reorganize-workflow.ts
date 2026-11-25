import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
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
  type ReorganizeScope,
} from '@/lib/reorganize/plan';
import { stashRepo } from '@/lib/storage/repo';
import type { Collection, LinkItem, StashSettings } from '@/lib/types/stash';
import { extractDomain } from '@/lib/utils/url';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';
import { useUiStore } from '@/store/ui-store';

export type WizardStep = 'scope' | 'checkpoint' | 'sorting' | 'preview';

export function useReorganizeWorkflow(
  collections: readonly Collection[],
  links: readonly LinkItem[],
  settings: StashSettings,
) {
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
      ),
    [collections, links, scope, categories, assignments, removeEmptySources],
  );

  const handleExportBackup = async () => {
    const snapshot = await stashRepo.getSnapshot();
    const bundle = buildExportBundle(snapshot);
    const filename = formatBackupFilename();
    triggerFileDownload(filename, `${JSON.stringify(bundle, null, 2)}\n`);
    toast.success(`Exported backup: ${filename}`);
  };

  const runPass1 = async () => {
    if (scopedLinks.length === 0) return;
    const jobsStore = useBackgroundJobsStore.getState();
    if (jobsStore.hasActiveNanoJob('reorganize')) {
      toast.info('Another on-device AI task is already running.');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setProposing(true);
    setErrorMessage(null);
    jobsStore.upsertJob({
      id: 'reorganize',
      title: 'Smart Reorganize',
      detail: `Proposing categories for ${scopedLinks.length} links...`,
      status: 'running',
      progress: null,
      usesNano: true,
      onReopen: openReorganize,
      onCancel: () => controller.abort(),
    });

    try {
      const result = await proposeCategories(scopedLinks, {
        existingCollectionNames: untouchedCollectionNames,
        signal: controller.signal,
      });

      if (result.status === 'canceled') {
        useBackgroundJobsStore.getState().removeJob('reorganize');
        return;
      }
      if (result.status !== 'ok') {
        setErrorMessage(result.reason);
        useBackgroundJobsStore.getState().removeJob('reorganize');
        return;
      }

      setCategories(result.categories);
      setStep('checkpoint');
      if (!openRef.current) {
        useBackgroundJobsStore.getState().upsertJob({
          id: 'reorganize',
          title: 'Smart Reorganize ready',
          detail: `${result.categories.length} categories proposed · Click to review`,
          status: 'ready',
          reopenLabel: 'Review',
          onReopen: openReorganize,
        });
      } else {
        useBackgroundJobsStore.getState().removeJob('reorganize');
      }
    } finally {
      setProposing(false);
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

    const jobsStore = useBackgroundJobsStore.getState();
    if (jobsStore.hasActiveNanoJob('reorganize')) {
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
    jobsStore.upsertJob({
      id: 'reorganize',
      title: 'Smart Reorganize',
      detail: `Sorting 0 / ${scopedLinks.length} links`,
      status: 'running',
      progress: { current: 0, total: scopedLinks.length },
      usesNano: true,
      onReopen: openReorganize,
      onCancel: () => controller.abort(),
    });

    const result = await sortLinksIntoCategories(scopedLinks, sortingBuckets, {
      signal: controller.signal,
      onProgress: (p) => {
        setSortProgress(p);
        useBackgroundJobsStore.getState().upsertJob({
          id: 'reorganize',
          title: 'Smart Reorganize',
          detail: `Sorting ${p.completed} / ${p.total} · ${p.currentTitle}`,
          status: 'running',
          progress: { current: p.completed, total: p.total },
          usesNano: true,
          onReopen: openReorganize,
          onCancel: () => controller.abort(),
        });
      },
    });

    if (result.status === 'canceled') {
      setSortProgress(null);
      setStep('checkpoint');
      useBackgroundJobsStore.getState().removeJob('reorganize');
      return;
    }
    if (result.status === 'unavailable' || result.status === 'error') {
      setErrorMessage(result.reason);
      setSortProgress(null);
      setStep('checkpoint');
      useBackgroundJobsStore.getState().removeJob('reorganize');
      return;
    }

    setAssignments(result.assignments);
    setSortProgress(null);
    setStep('preview');
    if (!openRef.current) {
      useBackgroundJobsStore.getState().upsertJob({
        id: 'reorganize',
        title: 'Smart Reorganize ready',
        detail: `${scopedLinks.length} links sorted · Review & apply`,
        status: 'ready',
        reopenLabel: 'Review',
        onReopen: openReorganize,
      });
    } else {
      useBackgroundJobsStore.getState().removeJob('reorganize');
    }
  };

  const handleApply = async () => {
    if (applying) return;
    setApplying(true);
    try {
      const plan = buildReorganizationPlan(
        { collections: [...collections], links: [...links] },
        scope,
        categories,
        assignments,
        removeEmptySources,
      );
      const previousSnapshot = await stashRepo.applyReorganization(
        plan.nextState,
      );

      playSessionFreeze(settings.soundEffects, settings.motionMode);
      useBackgroundJobsStore.getState().removeJob('reorganize');
      setStep('scope');
      setCategories([]);
      setAssignments({});
      closeReorganize();

      const { movedLinks, targetCollectionsCount } = plan.summary;
      toast(
        `Reorganized ${movedLinks} link${movedLinks === 1 ? '' : 's'} into ${targetCollectionsCount} collection${targetCollectionsCount === 1 ? '' : 's'}`,
        {
          duration: 10_000,
          action: {
            label: 'Undo',
            onClick: () => {
              void stashRepo
                .restoreLibrarySnapshot(previousSnapshot)
                .then(() => {
                  toast.success('Restored previous board layout');
                });
            },
          },
        },
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
