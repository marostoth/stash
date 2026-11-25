import { Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CategoryCheckpoint } from '@/components/reorganize/CategoryCheckpoint';
import { PreviewPlanStep } from '@/components/reorganize/PreviewPlanStep';
import { ScopeStep } from '@/components/reorganize/ScopeStep';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils/cn';
import { useUiStore } from '@/store/ui-store';

interface ReorganizeModalProps {
  collections: readonly Collection[];
  links: readonly LinkItem[];
  settings: StashSettings;
}

type WizardStep = 'scope' | 'checkpoint' | 'sorting' | 'preview';

const STEP_LABELS: ReadonlyArray<{ id: WizardStep; label: string }> = [
  { id: 'scope', label: '1. Scope' },
  { id: 'checkpoint', label: '2. Categories' },
  { id: 'sorting', label: '3. Sorting' },
  { id: 'preview', label: '4. Preview' },
];

export function ReorganizeModal({
  collections,
  links,
  settings,
}: ReorganizeModalProps) {
  const open = useUiStore((s) => s.reorganizeOpen);
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

  const linkCountByCollection = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of links) {
      counts.set(link.collectionId, (counts.get(link.collectionId) ?? 0) + 1);
    }
    return counts;
  }, [links]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    setStep('scope');
    setErrorMessage(null);
    setProposing(false);
    setSortProgress(null);

    // Default-select the largest/imported collection if nothing is selected
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
      abortRef.current?.abort();
      abortRef.current = null;
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
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setProposing(true);
    setErrorMessage(null);

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

    // Include untouched existing collections as valid targets when enabled in subset mode
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

    const result = await sortLinksIntoCategories(scopedLinks, sortingBuckets, {
      signal: controller.signal,
      onProgress: (p) => setSortProgress(p),
    });

    if (result.status === 'canceled') {
      setSortProgress(null);
      setStep('checkpoint');
      return;
    }

    if (result.status === 'unavailable' || result.status === 'error') {
      setErrorMessage(result.reason);
      setSortProgress(null);
      setStep('checkpoint');
      return;
    }

    setAssignments(result.assignments);
    setSortProgress(null);
    setStep('preview');
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

  const sortPct =
    sortProgress && sortProgress.total > 0
      ? Math.min(
          100,
          Math.round((sortProgress.completed / sortProgress.total) * 100),
        )
      : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          abortRef.current?.abort();
          closeReorganize();
        }
      }}
    >
      <DialogContent className="flex max-h-[88vh] w-[min(95vw,760px)] flex-col overflow-hidden">
        <DialogHeader className="mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <DialogTitle>Smart Reorganize (On-Device AI)</DialogTitle>
          </div>
          <DialogDescription>
            2-pass Gemini Nano workflow with a human category checkpoint, full
            preview, and 1-click Undo.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="mb-4 flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border pb-3">
          {STEP_LABELS.map((item) => (
            <span
              key={item.id}
              className={cn(
                'rounded-pill border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide',
                step === item.id
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-canvas text-fg-muted',
              )}
            >
              {item.label}
            </span>
          ))}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {step === 'scope' ? (
            <ScopeStep
              collections={collections}
              linkCountByCollection={linkCountByCollection}
              totalLinksCount={links.length}
              mode={mode}
              selectedCollectionIds={selectedCollectionIds}
              removeEmptySources={removeEmptySources}
              keepExistingTargets={keepExistingTargets}
              scopedLinksCount={scopedLinks.length}
              nanoReady={nanoReady}
              proposing={proposing}
              errorMessage={errorMessage}
              onChangeMode={setMode}
              onToggleCollection={(id) =>
                setSelectedCollectionIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onSelectAllCollections={() =>
                setSelectedCollectionIds(new Set(collections.map((c) => c.id)))
              }
              onClearCollections={() => setSelectedCollectionIds(new Set())}
              onToggleRemoveEmpty={() => setRemoveEmptySources((v) => !v)}
              onToggleKeepExistingTargets={() =>
                setKeepExistingTargets((v) => !v)
              }
              onExportBackup={() => void handleExportBackup()}
              onPropose={() => void runPass1()}
            />
          ) : step === 'checkpoint' ? (
            <CategoryCheckpoint
              categories={categories}
              scopedLinksCount={scopedLinks.length}
              regenerating={proposing}
              errorMessage={errorMessage}
              onUpdateCategory={(id, patch) =>
                setCategories((prev) =>
                  prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
                )
              }
              onDeleteCategory={(id) =>
                setCategories((prev) => prev.filter((c) => c.id !== id))
              }
              onAddCategory={() =>
                setCategories((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), name: '', description: '' },
                ])
              }
              onRegenerate={() => void runPass1()}
              onBack={() => setStep('scope')}
              onStartSort={() => void runPass2()}
            />
          ) : step === 'sorting' ? (
            <div className="flex flex-col items-center justify-center space-y-4 py-10 text-center">
              <Sparkles className="h-7 w-7 animate-pulse text-accent" />
              <div className="space-y-1">
                <p className="font-mono text-sm font-semibold text-fg">
                  Sorting {sortProgress?.completed ?? 0} /{' '}
                  {sortProgress?.total ?? scopedLinks.length}...
                </p>
                <p className="max-w-md truncate text-xs text-fg-muted">
                  {sortProgress?.currentTitle || 'Preparing Gemini Nano...'}
                </p>
              </div>
              <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-canvas">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-150"
                  style={{ width: `${sortPct}%` }}
                />
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => abortRef.current?.abort()}
                className="gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Cancel Sorting
              </Button>
            </div>
          ) : (
            <PreviewPlanStep
              scopedLinks={scopedLinks}
              assignments={assignments}
              targetCategoryOptions={targetCategoryOptions}
              summary={previewPlan.summary}
              applying={applying}
              onOverrideAssignment={(linkId, categoryName) =>
                setAssignments((prev) => ({ ...prev, [linkId]: categoryName }))
              }
              onBackToCategories={() => setStep('checkpoint')}
              onApply={() => void handleApply()}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
