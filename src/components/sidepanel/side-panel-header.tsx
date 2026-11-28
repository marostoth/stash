import {
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FolderPlus,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { SmoothCollapse } from '@/components/workbench/smooth-collapse';
import { playDrop, playTagPop } from '@/lib/audio/foley';
import { stashRepo } from '@/lib/storage/repo';
import type { MotionMode } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface SidePanelHeaderProps {
  totalLinks: number;
  hasStashableTab: boolean;
  activeTabSaved: boolean;
  captureExpanded: boolean;
  onToggleCapture: () => void;
  onOpenBoard: () => void;
  activeSpaceId?: string;
  motionMode: MotionMode;
  soundEffects: boolean;
}

/**
 * Machined Side Panel header obeying single-CTA discipline:
 * `+ Collection`, `Capture`, and `Board` stay refined ghost/surface controls so
 * `Stash Tab` remains the sole high-contrast accent button in the panel.
 */
export function SidePanelHeader({
  totalLinks,
  hasStashableTab,
  activeTabSaved,
  captureExpanded,
  onToggleCapture,
  onOpenBoard,
  activeSpaceId,
  motionMode,
  soundEffects,
}: SidePanelHeaderProps) {
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCreateCollection = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = collectionName.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const created = await stashRepo.createCollection({
        name: trimmed,
        ...(activeSpaceId ? { spaceId: activeSpaceId } : {}),
      });
      playDrop(soundEffects, motionMode);
      toast.success(`Created "${created.name}"`);
      setCollectionName('');
      setCreatingCollection(false);
    } catch {
      toast.error('Could not create collection');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shrink-0 border-b border-hairline bg-[var(--stash-panel)]/95 backdrop-blur-sm">
      <header className="flex h-11 items-center justify-between gap-1.5 px-2.5 min-[360px]:px-3">
        {/* Brand + Total Counter */}
        <div className="flex min-w-0 items-center gap-1.5 min-[360px]:gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control border border-hairline bg-[var(--stash-card)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--stash-text)_7%,transparent)]"
            aria-hidden="true"
          >
            <span className="h-2 w-2 rounded-[2px] bg-accent" />
          </div>
          <span className="font-mono text-[11px] font-semibold tracking-[0.16em] text-fg">
            STASH
          </span>
          <span className="rounded-pill border border-hairline bg-canvas/80 px-1.5 py-0.5 font-mono text-[10px] text-fg-muted tabular-nums">
            {totalLinks}
          </span>
        </div>

        {/* Unified Subtle/Ghost Header Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const next = !creatingCollection;
              setCreatingCollection(next);
              if (next) playTagPop(soundEffects, motionMode);
            }}
            aria-expanded={creatingCollection}
            aria-label="New collection"
            title="New collection"
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-control border px-2 text-[11px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
              creatingCollection
                ? 'border-accent/45 bg-elevated text-fg'
                : 'border-hairline bg-[var(--stash-card)]/65 text-fg-muted hover:border-border hover:bg-card-hover hover:text-fg',
            )}
          >
            <FolderPlus className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden min-[365px]:inline">Collection</span>
          </button>

          {hasStashableTab && (
            <button
              type="button"
              onClick={onToggleCapture}
              aria-expanded={captureExpanded}
              aria-label={
                captureExpanded
                  ? 'Collapse Quick Stash drawer'
                  : 'Expand Quick Stash drawer'
              }
              title={
                captureExpanded
                  ? 'Collapse Quick Stash drawer'
                  : 'Expand Quick Stash drawer'
              }
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-control border px-2 text-[11px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                captureExpanded
                  ? 'border-accent/40 bg-accent/10 text-accent hover:border-accent/55'
                  : 'border-hairline bg-[var(--stash-card)]/65 text-fg-muted hover:border-border hover:bg-card-hover hover:text-fg',
              )}
            >
              <BookmarkPlus className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden min-[425px]:inline">Capture</span>
              {activeTabSaved && (
                <span
                  aria-hidden="true"
                  title="This tab is already in Stash"
                  className="h-1.5 w-1.5 rounded-full bg-accent"
                />
              )}
              {captureExpanded ? (
                <ChevronUp className="h-3 w-3 shrink-0 opacity-75" />
              ) : (
                <ChevronDown className="h-3 w-3 shrink-0 opacity-75" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenBoard}
            title="Open Stash New Tab workbench"
            aria-label="Open Stash New Tab workbench"
            className="inline-flex h-7 items-center gap-1 rounded-control border border-hairline bg-[var(--stash-card)]/65 px-2 text-[11px] font-medium text-fg-muted transition-colors hover:border-border hover:bg-card-hover hover:text-fg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <span className="hidden min-[345px]:inline">Board</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </button>
        </div>
      </header>

      {/* Inline New Collection Bar (no modal jump) */}
      <SmoothCollapse open={creatingCollection} motionMode={motionMode}>
        <form
          onSubmit={(e) => void handleCreateCollection(e)}
          className="flex items-center gap-1.5 border-t border-hairline bg-canvas/55 px-3 py-2"
        >
          <Input
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setCreatingCollection(false);
                setCollectionName('');
              }
            }}
            placeholder="New collection name..."
            aria-label="New collection name"
            className="h-7 flex-1 text-xs"
            autoFocus
          />
          <button
            type="submit"
            disabled={!collectionName.trim() || submitting}
            className="inline-flex h-7 shrink-0 items-center rounded-control border border-border bg-elevated px-2.5 text-[11px] font-medium text-fg transition-colors hover:border-accent/50 hover:text-accent disabled:pointer-events-none disabled:opacity-45 cursor-pointer"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatingCollection(false);
              setCollectionName('');
            }}
            aria-label="Cancel new collection"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-card-hover hover:text-fg cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      </SmoothCollapse>
    </div>
  );
}
