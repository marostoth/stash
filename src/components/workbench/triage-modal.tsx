import { Check, CheckCircle2, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { categorizeLink } from '@/lib/categorizer/categorizer';
import type { CategorizationSuggestion } from '@/lib/categorizer/types';
import { stashRepo } from '@/lib/storage/repo';
import type {
  CategorizationRule,
  Collection,
  LinkItem,
  StashSettings,
} from '@/lib/types/stash';
import { extractDomain, getMonogram, normalizeTags } from '@/lib/utils/url';
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
  const [applying, setApplying] = useState(false);
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

    let cancelled = false;
    setAnalyzing(true);

    const runCategorization = async () => {
      const nextRows: TriageRow[] = [];
      for (const link of sessionLinks) {
        if (cancelled) return;
        const suggestion = await categorizeLink(
          { url: link.url, title: link.title },
          {
            rules,
            collections: destinationCollections,
            enableOnDeviceAi: settings.enableOnDeviceAi,
          },
        );
        const defaultDest =
          suggestion.collectionId ??
          (suggestion.suggestedNewCollection
            ? `${NEW_PREFIX}${suggestion.suggestedNewCollection}`
            : '');
        nextRows.push({ link, suggestion, destination: defaultDest });
      }
      if (!cancelled) {
        setRows(nextRows);
        setAnalyzing(false);
      }
    };

    void runCategorization();
    return () => {
      cancelled = true;
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
      const createdByName = new Map<string, string>();
      let movedCount = 0;
      let skippedDuplicates = 0;

      for (const row of rows) {
        if (!row.destination) continue;

        let targetCollectionId = row.destination;
        if (targetCollectionId.startsWith(NEW_PREFIX)) {
          const newName = targetCollectionId.slice(NEW_PREFIX.length).trim();
          const key = newName.toLowerCase();
          const existingNewId = createdByName.get(key);
          if (existingNewId) {
            targetCollectionId = existingNewId;
          } else {
            const created = await stashRepo.createCollection({ name: newName });
            createdByName.set(key, created.id);
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
            <div className="py-12 text-center font-mono text-xs text-fg-muted">
              Categorizing {sessionLinks.length} saved tab
              {sessionLinks.length === 1 ? '' : 's'}...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-xs text-fg-muted">
              This session has no links to categorize.
            </div>
          ) : (
            rows.map(({ link, suggestion, destination }) => {
              const isCreatingCustom = editingCustomRowId === link.id;
              const isNewDest = destination.startsWith(NEW_PREFIX);
              return (
                <div
                  key={link.id}
                  className="flex flex-col gap-2.5 rounded-card border border-border bg-canvas p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-panel font-mono text-[10px] font-semibold text-accent">
                      {link.faviconUrl ? (
                        <img
                          src={link.faviconUrl}
                          alt=""
                          width={14}
                          height={14}
                          className="h-3.5 w-3.5 object-contain"
                        />
                      ) : (
                        <span>{getMonogram(link.title, link.url)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-fg">
                        {link.title}
                      </div>
                      <div className="truncate font-mono text-[10px] text-fg-muted">
                        {extractDomain(link.url)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {suggestion.source === 'rule' && (
                          <span className="rounded-pill border border-accent/35 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                            Rule: {suggestion.matchedRuleName}
                          </span>
                        )}
                        {suggestion.source === 'nano' && (
                          <span className="rounded-pill border border-accent/35 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                            On-Device AI
                          </span>
                        )}
                        {isNewDest && (
                          <span className="rounded-pill border border-accent/40 bg-panel px-1.5 py-0.5 font-mono text-[10px] text-accent">
                            New category
                          </span>
                        )}
                        {suggestion.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-pill border border-border bg-panel px-1.5 py-0.5 font-mono text-[10px] text-fg-muted"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="w-full shrink-0 sm:w-56">
                    {isCreatingCustom ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={customDraft}
                          onChange={(e) => setCustomDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitCustomCategory(link.id);
                            } else if (e.key === 'Escape') {
                              setEditingCustomRowId(null);
                            }
                          }}
                          placeholder="Category name..."
                          className="h-8 text-xs"
                          autoFocus
                        />
                        <Button
                          variant="primary"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          aria-label="Confirm new category"
                          onClick={() => commitCustomCategory(link.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          aria-label="Cancel new category"
                          onClick={() => setEditingCustomRowId(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Select
                        aria-label={`Destination for ${link.title}`}
                        value={destination}
                        onChange={(e) =>
                          handleChangeDestination(link.id, e.target.value)
                        }
                        className="h-8 text-xs"
                      >
                        <option value="">Keep in session</option>
                        {availableNewCategories.map((name) => (
                          <option key={name} value={`${NEW_PREFIX}${name}`}>
                            + Create &ldquo;{name}&rdquo;
                          </option>
                        ))}
                        {destinationCollections.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name}
                          </option>
                        ))}
                        <option value={CREATE_CUSTOM_SENTINEL}>
                          + Custom new category...
                        </option>
                      </Select>
                    )}
                  </div>
                </div>
              );
            })
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
              <CheckCircle2 className="h-3.5 w-3.5" />
              Accept All ({assignedCount})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
