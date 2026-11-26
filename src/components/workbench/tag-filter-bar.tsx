import { Hash, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LinkItem } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { collectSpaceTagStats } from '@/lib/utils/collection-sort';
import { useUiStore } from '@/store/ui-store';

const INITIAL_VISIBLE_TAGS = 12;

interface TagFilterBarProps {
  links: readonly LinkItem[];
  activeSpaceCollectionIds: ReadonlySet<string>;
  searchAllSpaces: boolean;
  wideBoard: boolean;
}

/**
 * Compact 1-click tag chip strip for slicing the active Space (or all Spaces
 * when "All Spaces" search scope is active). Renders nothing when no links
 * carry tags so untagged Spaces stay visually clean.
 */
export function TagFilterBar({
  links,
  activeSpaceCollectionIds,
  searchAllSpaces,
  wideBoard,
}: TagFilterBarProps) {
  const selectedTags = useUiStore((s) => s.selectedTags);
  const toggleSelectedTag = useUiStore((s) => s.toggleSelectedTag);
  const clearSelectedTags = useUiStore((s) => s.clearSelectedTags);
  const [expanded, setExpanded] = useState(false);

  const tagStats = useMemo(
    () =>
      collectSpaceTagStats(
        links,
        searchAllSpaces ? undefined : activeSpaceCollectionIds,
      ),
    [activeSpaceCollectionIds, links, searchAllSpaces],
  );

  if (tagStats.length === 0 && selectedTags.length === 0) {
    return null;
  }

  const selectedSet = new Set(selectedTags);
  const visibleStats = expanded
    ? tagStats
    : tagStats.filter(
        (stat, idx) => idx < INITIAL_VISIBLE_TAGS || selectedSet.has(stat.tag),
      );
  const hiddenCount = Math.max(0, tagStats.length - visibleStats.length);

  return (
    <div className="border-b border-border/60 bg-canvas/35 px-4 py-1.5 sm:px-6">
      <div
        className={cn(
          'mx-auto flex flex-wrap items-center gap-1.5',
          wideBoard ? 'max-w-[1720px]' : 'max-w-[1320px]',
        )}
      >
        <span className="inline-flex shrink-0 items-center gap-1 pr-0.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted/80 select-none">
          <Hash className="h-3 w-3 text-accent/80" />
          <span className="hidden sm:inline">Tags</span>
        </span>

        {visibleStats.map(({ tag, count }) => {
          const active = selectedSet.has(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={active}
              onClick={() => toggleSelectedTag(tag)}
              className={cn(
                'inline-flex h-6 items-center gap-1 rounded-pill border px-2 font-mono text-[11px] transition-colors cursor-pointer',
                active
                  ? 'border-accent/65 bg-accent/15 text-accent'
                  : 'border-border/75 bg-panel/65 text-fg-muted hover:border-accent/45 hover:bg-card hover:text-fg',
              )}
            >
              <span>#{tag}</span>
              <span
                className={cn(
                  'text-[10px] tabular-nums',
                  active ? 'text-accent/85' : 'text-fg-muted/70',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex h-6 items-center rounded-pill border border-dashed border-border/80 px-2 font-mono text-[10px] text-fg-muted transition-colors hover:border-accent/50 hover:text-fg cursor-pointer"
          >
            +{hiddenCount} more
          </button>
        )}

        {expanded && tagStats.length > INITIAL_VISIBLE_TAGS && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex h-6 items-center rounded-pill border border-border/75 px-2 font-mono text-[10px] text-fg-muted transition-colors hover:text-fg cursor-pointer"
          >
            Show less
          </button>
        )}

        {selectedTags.length > 0 && (
          <button
            type="button"
            onClick={clearSelectedTags}
            className="ml-auto inline-flex h-6 items-center gap-1 rounded-pill border border-accent/40 bg-accent/10 px-2 font-mono text-[10px] text-accent transition-colors hover:bg-accent/20 cursor-pointer"
          >
            <X className="h-3 w-3" />
            <span>
              Clear {selectedTags.length > 1 ? `(${selectedTags.length})` : ''}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
