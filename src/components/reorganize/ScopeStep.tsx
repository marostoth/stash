import {
  Download,
  FolderKanban,
  Layers,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { AiActivityPanel } from '@/components/ui/ai-activity-panel';
import { Button } from '@/components/ui/button';
import type { Collection } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface ScopeStepProps {
  collections: readonly Collection[];
  linkCountByCollection: ReadonlyMap<string, number>;
  totalLinksCount: number;
  mode: 'collections' | 'full';
  selectedCollectionIds: ReadonlySet<string>;
  removeEmptySources: boolean;
  keepExistingTargets: boolean;
  scopedLinksCount: number;
  scopedDomainsCount: number;
  nanoReady: boolean;
  proposing: boolean;
  errorMessage: string | null;
  onChangeMode: (mode: 'collections' | 'full') => void;
  onToggleCollection: (collectionId: string) => void;
  onSelectAllCollections: () => void;
  onClearCollections: () => void;
  onToggleRemoveEmpty: () => void;
  onToggleKeepExistingTargets: () => void;
  onExportBackup: () => void;
  onPropose: () => void;
  onMinimizePropose?: () => void;
  onCancelPropose: () => void;
}

export function ScopeStep({
  collections,
  linkCountByCollection,
  totalLinksCount,
  mode,
  selectedCollectionIds,
  removeEmptySources,
  keepExistingTargets,
  scopedLinksCount,
  scopedDomainsCount,
  nanoReady,
  proposing,
  errorMessage,
  onChangeMode,
  onToggleCollection,
  onSelectAllCollections,
  onClearCollections,
  onToggleRemoveEmpty,
  onToggleKeepExistingTargets,
  onExportBackup,
  onPropose,
  onMinimizePropose,
  onCancelPropose,
}: ScopeStepProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onChangeMode('collections')}
          className={cn(
            'flex flex-col items-start gap-1 rounded-card border p-3.5 text-left transition-colors cursor-pointer',
            mode === 'collections'
              ? 'border-accent bg-accent/10'
              : 'border-border bg-canvas hover:border-fg-muted/40',
          )}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-fg">
            <FolderKanban className="h-3.5 w-3.5 text-accent" />
            Selected Collection(s) Only
          </div>
          <p className="text-[11px] leading-relaxed text-fg-muted">
            Target messy folders like Imported Bookmarks while leaving curated
            collections untouched.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeMode('full')}
          className={cn(
            'flex flex-col items-start gap-1 rounded-card border p-3.5 text-left transition-colors cursor-pointer',
            mode === 'full'
              ? 'border-accent bg-accent/10'
              : 'border-border bg-canvas hover:border-fg-muted/40',
          )}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-fg">
            <Layers className="h-3.5 w-3.5 text-accent" />
            Entire Library (Fresh Start)
          </div>
          <p className="text-[11px] leading-relaxed text-fg-muted">
            Re-evaluate all {totalLinksCount} saved links across every
            collection into clean high-level categories.
          </p>
        </button>
      </div>

      {mode === 'collections' ? (
        <div className="rounded-card border border-border bg-canvas">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
              Choose Collections to Reorganize
            </span>
            <div className="flex items-center gap-1.5 font-mono text-[10px]">
              <button
                type="button"
                onClick={onSelectAllCollections}
                className="text-fg-muted hover:text-fg cursor-pointer"
              >
                All
              </button>
              <span className="text-border">·</span>
              <button
                type="button"
                onClick={onClearCollections}
                className="text-fg-muted hover:text-fg cursor-pointer"
              >
                None
              </button>
            </div>
          </div>

          <div className="max-h-48 divide-y divide-border/60 overflow-y-auto">
            {collections.length === 0 ? (
              <p className="px-3.5 py-4 text-xs text-fg-muted">
                No collections available yet.
              </p>
            ) : (
              collections.map((col) => {
                const count = linkCountByCollection.get(col.id) ?? 0;
                const checked = selectedCollectionIds.has(col.id);
                return (
                  <label
                    key={col.id}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2 text-xs transition-colors',
                      checked ? 'bg-accent/5' : 'hover:bg-panel/40',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleCollection(col.id)}
                        className="h-3.5 w-3.5 shrink-0 accent-[var(--stash-accent)] cursor-pointer"
                      />
                      <span className="truncate font-medium text-fg">
                        {col.name}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-pill border border-border bg-panel px-2 py-0.5 font-mono text-[10px] text-fg-muted">
                      {count} {count === 1 ? 'link' : 'links'}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      <div className="space-y-2 rounded-card border border-border bg-canvas p-3.5">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-fg">
          <span>Remove source collections that become empty</span>
          <input
            type="checkbox"
            checked={removeEmptySources}
            onChange={onToggleRemoveEmpty}
            className="h-4 w-4 accent-[var(--stash-accent)] cursor-pointer"
          />
        </label>

        {mode === 'collections' ? (
          <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-fg">
            <span>Allow untouched existing collections as valid targets</span>
            <input
              type="checkbox"
              checked={keepExistingTargets}
              onChange={onToggleKeepExistingTargets}
              className="h-4 w-4 accent-[var(--stash-accent)] cursor-pointer"
            />
          </label>
        ) : null}
      </div>

      {!nanoReady ? (
        <p className="rounded-control border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Chrome&apos;s on-device Gemini Nano model is not ready yet. Open
          Settings → General &amp; AI to check availability or download the
          model.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-control border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {errorMessage}
        </p>
      ) : null}

      {proposing ? (
        <AiActivityPanel
          title="Gemini Nano is designing categories..."
          subtitle={`Analyzing ${scopedLinksCount} ${scopedLinksCount === 1 ? 'link' : 'links'} across ${scopedDomainsCount} ${scopedDomainsCount === 1 ? 'domain' : 'domains'} locally on-device`}
          showElapsed
          skeletonRows={4}
          onMinimize={onMinimizePropose}
          onCancel={onCancelPropose}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button
          variant="secondary"
          size="sm"
          disabled={proposing}
          onClick={onExportBackup}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5 text-accent" />
          Export Backup First
        </Button>

        <Button
          variant="primary"
          size="sm"
          disabled={!nanoReady || proposing || scopedLinksCount === 0}
          onClick={onPropose}
          className="gap-1.5"
        >
          {proposing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {proposing
            ? 'Proposing Categories...'
            : `Propose Categories (${scopedLinksCount} ${scopedLinksCount === 1 ? 'link' : 'links'})`}
        </Button>
      </div>
    </div>
  );
}
