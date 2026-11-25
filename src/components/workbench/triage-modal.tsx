import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AiActivityPanel } from '@/components/ui/ai-activity-panel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { TriageRowCard } from '@/components/workbench/triage-row-card';
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
import { useUiStore } from '@/store/ui-store';

interface TriageModalProps {
  collections: readonly Collection[];
  links: readonly LinkItem[];
  rules: readonly CategorizationRule[];
  settings: StashSettings;
}

interface TriageRow {
  link: LinkItem;
  suggestion: CategorizationSuggestion;
  destination: string; // '' = keep in session, '__new__:Name', or collectionId
}

const NEW_PREFIX = '__new__:';
const CREATE_CUSTOM_SENTINEL = '__create_custom__';

export function TriageModal({
  collections,
  links,
  rules,
  settings,
}: TriageModalProps) {
  const triageCollectionId = useUiStore((s) => s.triageCollectionId);
  const closeTriage = useUiStore((s) => s.closeTriage);

  const [rows, setRows] = useState<TriageRow[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<{
    current: number;
    total: number;
    title: string;
  } | null>(null);
  const [applying, setApplying] = useState(false);
  const cancelAnalysisRef = useRef(false);
  const [deleteEmptySession, setDeleteEmptySession] = useState(true);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [editingCustomRowId, setEditingCustomRowId] = useState<string | null>(
    null,
  );
  const [customDraft, setCustomDraft] = useState('');
  const [bulkDestination, setBulkDestination] = useState('');

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

  useEffect(() => {
    if (!triageCollectionId || !sessionCollection) {
      setRows([]);
      setCustomCategories([]);
      setEditingCustomRowId(null);
      setBulkDestination('');
      return;
    }

    cancelAnalysisRef.current = false;
    setAnalyzing(true);
    setAnalyzeProgress({
      current: 0,
      total: sessionLinks.length,
      title: sessionLinks[0]?.title ?? '',
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
            ? `${NEW_PREFIX}${suggestion.suggestedNewCollection}`
            : '');
        nextRows.push({ link, suggestion, destination: defaultDest });
        setAnalyzeProgress({
          current: i + 1,
          total: sessionLinks.length,
          title: link.title,
        });
      }
      setRows(nextRows);
      setAnalyzing(false);
      setAnalyzeProgress(null);
    };

    void runCategorization();
    return () => {
      cancelAnalysisRef.current = true;
    };
  }, [
    triageCollectionId,
    sessionCollection,
    sessionLinks,
    rules,
    destinationCollections,
    settings.enableOnDeviceAi,
  ]);

  // All proposed new category names (AI-suggested + user-typed), deduplicated
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
    if (value === CREATE_CUSTOM_SENTINEL) {
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
    handleChangeDestination(linkId, `${NEW_PREFIX}${trimmed}`);
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
        if (targetCollectionId.startsWith(NEW_PREFIX)) {
          const newName = targetCollectionId.slice(NEW_PREFIX.length).trim();
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

      closeTriage();

      // Fire-and-forget background AI icon assignment for newly created collections
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

  return (
    <Dialog
      open={triageCollectionId !== null}
      onOpenChange={(open) => {
        if (!open) closeTriage();
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-[min(94vw,740px)] flex-col overflow-hidden">
        <DialogHeader className="mb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Auto-Categorize: {sessionCollection?.name ?? 'Session'}
          </DialogTitle>
          <DialogDescription>
            Review suggested collections (including new category suggestions),
            override any or all links, then apply in one click.
          </DialogDescription>
        </DialogHeader>

        {/* Bulk Override Bar */}
        {!analyzing && rows.length > 0 && (
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-control border border-border bg-canvas px-3 py-2">
            <span className="font-mono text-[11px] text-fg-muted">
              Override all ({rows.length}):
            </span>
            <div className="flex flex-1 items-center justify-end gap-2">
              <Select
                aria-label="Override destination for all links"
                value={bulkDestination}
                onChange={(e) => setBulkDestination(e.target.value)}
                className="h-8 max-w-[230px] text-xs"
              >
                <option value="">Keep in session</option>
                {destinationCollections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
                {availableNewCategories.map((name) => (
                  <option key={name} value={`${NEW_PREFIX}${name}`}>
                    + Create &ldquo;{name}&rdquo;
                  </option>
                ))}
              </Select>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleApplyBulkOverride}
                className="h-8 shrink-0 text-xs"
              >
                Apply to All
              </Button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {analyzing ? (
            <div className="py-3">
              <AiActivityPanel
                title={`Categorizing ${analyzeProgress?.current ?? 0} / ${analyzeProgress?.total ?? sessionLinks.length} links...`}
                subtitle={
                  analyzeProgress?.title ||
                  'Checking local rules and on-device Gemini Nano...'
                }
                progress={
                  analyzeProgress
                    ? {
                        current: analyzeProgress.current,
                        total: analyzeProgress.total,
                      }
                    : null
                }
                showElapsed
                skeletonRows={Math.min(4, Math.max(2, sessionLinks.length))}
                onCancel={() => {
                  cancelAnalysisRef.current = true;
                }}
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-xs text-fg-muted">
              This session has no links to categorize.
            </div>
          ) : (
            rows.map(({ link, suggestion, destination }) => (
              <TriageRowCard
                key={link.id}
                link={link}
                suggestion={suggestion}
                destination={destination}
                newPrefix={NEW_PREFIX}
                createCustomSentinel={CREATE_CUSTOM_SENTINEL}
                isCreatingCustom={editingCustomRowId === link.id}
                customDraft={customDraft}
                availableNewCategories={availableNewCategories}
                destinationCollections={destinationCollections}
                onChangeCustomDraft={setCustomDraft}
                onCommitCustomCategory={() => commitCustomCategory(link.id)}
                onCancelCustomCategory={() => setEditingCustomRowId(null)}
                onChangeDestination={(value) =>
                  handleChangeDestination(link.id, value)
                }
              />
            ))
          )}
        </div>

        <DialogFooter className="mt-4 shrink-0 flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-muted select-none">
            <input
              type="checkbox"
              checked={deleteEmptySession}
              onChange={(e) => setDeleteEmptySession(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--stash-accent)] cursor-pointer"
            />
            <span>Remove session collection if emptied</span>
          </label>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={closeTriage}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={analyzing || applying || assignedCount === 0}
              onClick={() => void handleAcceptAll()}
              className="gap-1.5"
            >
              {applying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {applying ? 'Applying...' : `Accept All (${assignedCount})`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
