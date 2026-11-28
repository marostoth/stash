import { ArrowUpRight, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { SidePanelLinkRow } from '@/components/sidepanel/side-panel-link-row';
import { SmoothCollapse } from '@/components/workbench/smooth-collapse';
import {
  playDelete,
  playDrop,
  playSessionFreeze,
  playTagPop,
  playUncheck,
} from '@/lib/audio/foley';
import { stashRepo } from '@/lib/storage/repo';
import { wakeUpCollectionInTabGroup } from '@/lib/tabs/tab-actions';
import { getCuratedCollectionIcon } from '@/lib/themes/collection-icons';
import {
  type Collection,
  type LinkItem,
  type MotionMode,
  TAB_GROUP_COLOR_SWATCH,
} from '@/lib/types/stash';
import { getCollectionSortMeta } from '@/lib/utils/collection-sort';
import {
  formatCurrencySummaries,
  summarizePrices,
} from '@/lib/utils/price-math';
import type { FilteredCollectionGroup } from '@/lib/utils/search';

interface SidePanelCollectionListProps {
  groups: readonly FilteredCollectionGroup[];
  searchQuery: string;
  isFiltering: boolean;
  defaultCurrency: string;
  soundEffects: boolean;
  motionMode: MotionMode;
  expandedIds: Readonly<Record<string, boolean>>;
  onToggleCollection: (id: string, currentlyOpen: boolean) => void;
  onClearFilters: () => void;
}

/**
 * Premium Side Panel library list with `color-mix()` tinted collection headers,
 * smooth accordion collapse, hover-revealed `Wake Up`, and breathable mini-cards.
 */
export function SidePanelCollectionList({
  groups,
  searchQuery,
  isFiltering,
  defaultCurrency,
  soundEffects,
  motionMode,
  expandedIds,
  onToggleCollection,
  onClearFilters,
}: SidePanelCollectionListProps) {
  const isCollectionOpen = (id: string, defaultCollapsed: boolean) => {
    if (isFiltering) return true;
    const override = expandedIds[id];
    return override !== undefined ? override : !defaultCollapsed;
  };

  const handleWakeUp = async (
    event: React.MouseEvent,
    collection: Collection,
    colLinks: readonly LinkItem[],
  ) => {
    event.stopPropagation();
    if (colLinks.length === 0) return;
    playSessionFreeze(soundEffects, motionMode);
    const opened = await wakeUpCollectionInTabGroup(collection, colLinks);
    if (opened > 0) {
      toast.success(
        `Opened ${opened} tab${opened === 1 ? '' : 's'} in "${collection.name}"`,
      );
    }
  };

  const handleToggleStar = async (event: React.MouseEvent, link: LinkItem) => {
    event.preventDefault();
    event.stopPropagation();
    const nextStarred = link.starred !== true;
    const res = await stashRepo.updateLink(link.id, { starred: nextStarred });
    if (res.ok && nextStarred) {
      playTagPop(soundEffects, motionMode);
    }
  };

  const handleToggleChecked = async (
    event: React.MouseEvent,
    link: LinkItem,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const nextChecked = link.checked !== true;
    const res = await stashRepo.updateLink(link.id, { checked: nextChecked });
    if (res.ok) {
      if (nextChecked) {
        playTagPop(soundEffects, motionMode);
      } else {
        playUncheck(soundEffects);
      }
    }
  };

  const handleCopyUrl = async (event: React.MouseEvent, url: string) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Copied link URL');
    } catch {
      toast.error('Could not copy URL');
    }
  };

  const handleDelete = async (event: React.MouseEvent, link: LinkItem) => {
    event.preventDefault();
    event.stopPropagation();
    const snapshot: LinkItem = {
      ...link,
      tags: [...link.tags],
      ...(link.product ? { product: { ...link.product } } : {}),
    };
    const deleted = await stashRepo.deleteLink(snapshot.id);
    if (!deleted) return;
    playDelete(soundEffects);
    let undone = false;
    toast('Link removed', {
      duration: 5000,
      className: 'stash-undo-toast',
      action: {
        label: 'Undo',
        onClick: () => {
          if (undone) return;
          undone = true;
          void stashRepo.restoreLink(snapshot).then((restored) => {
            if (restored) {
              playDrop(soundEffects, motionMode);
            }
          });
        },
      },
    });
  };

  if (groups.length === 0) {
    return (
      <div className="space-y-2.5 rounded-card border border-dashed border-hairline bg-[var(--stash-panel)]/45 px-4 py-8 text-center text-xs text-fg-muted">
        <p>
          {isFiltering
            ? searchQuery.trim()
              ? `No matches for "${searchQuery.trim()}"`
              : 'No links match the active filters'
            : 'No collections in this Space yet.'}
        </p>
        {isFiltering && (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-pill border border-border bg-[var(--stash-card)] px-3 py-1 font-mono text-[10px] text-accent transition-colors hover:border-accent/50 cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-2.5">
      {groups.map(({ collection, links: colLinks }) => {
        const expanded = isCollectionOpen(collection.id, collection.collapsed);
        const CuratedIcon = getCuratedCollectionIcon(collection.icon);
        const colorHex =
          collection.tintColor ?? TAB_GROUP_COLOR_SWATCH[collection.color];
        const isSorted =
          collection.sortMode !== undefined && collection.sortMode !== 'manual';
        const sortMeta = isSorted
          ? getCollectionSortMeta(collection.sortMode)
          : null;
        const priceSummaries = summarizePrices(colLinks, defaultCurrency);
        const subtotalText =
          priceSummaries.length > 0
            ? formatCurrencySummaries(priceSummaries)
            : null;

        return (
          <section
            key={collection.id}
            className="min-w-0 overflow-hidden rounded-card border border-hairline bg-[var(--stash-panel)]/70 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--stash-text)_4%,transparent)]"
          >
            {/* Tinted Collapsible Header */}
            <div
              className="group/hdr relative flex items-center justify-between gap-1.5 px-2.5 py-2"
              style={{
                background: `linear-gradient(90deg, color-mix(in srgb, ${colorHex} 12%, transparent) 0%, color-mix(in srgb, ${colorHex} 3%, transparent) 55%, transparent 100%)`,
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-1.5 left-0 w-[2.5px] rounded-r-full"
                style={{ backgroundColor: colorHex }}
              />

              <button
                type="button"
                onClick={() => onToggleCollection(collection.id, expanded)}
                aria-expanded={expanded}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-control px-1 py-0.5 text-left text-xs font-semibold tracking-tight text-fg transition-colors hover:bg-[var(--stash-card)]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 cursor-pointer"
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                )}

                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border border-hairline"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${colorHex} 14%, var(--stash-canvas))`,
                  }}
                  aria-hidden="true"
                >
                  {CuratedIcon ? (
                    <CuratedIcon
                      className="h-3 w-3"
                      style={{ color: colorHex }}
                    />
                  ) : collection.icon ? (
                    <span className="text-[11px] leading-none">
                      {collection.icon}
                    </span>
                  ) : (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: colorHex }}
                    />
                  )}
                </span>

                <span className="truncate">{collection.name}</span>

                {sortMeta && (
                  <span className="shrink-0 rounded-pill border border-accent/35 bg-accent/10 px-1.5 py-0.25 font-mono text-[9px] font-normal text-accent">
                    {sortMeta.shortLabel}
                  </span>
                )}
              </button>

              <div className="flex shrink-0 items-center gap-1">
                {colLinks.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => void handleWakeUp(e, collection, colLinks)}
                    title={`Wake Up "${collection.name}" in a Chrome Tab Group`}
                    aria-label={`Wake Up ${collection.name}`}
                    className="inline-flex h-6 items-center gap-0.5 rounded-control border border-transparent px-1.5 font-mono text-[10px] font-medium text-fg-muted opacity-0 transition-[opacity,background-color,border-color,color] hover:border-accent/40 hover:bg-[var(--stash-card)] hover:text-accent group-hover/hdr:opacity-100 focus-visible:opacity-100 cursor-pointer"
                  >
                    <span className="hidden min-[360px]:inline">Wake Up</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
                {subtotalText && (
                  <span
                    title={`Collection subtotal: ${subtotalText}`}
                    className="max-w-[92px] truncate rounded-pill border border-hairline bg-canvas/75 px-1.5 py-0.25 font-mono text-[10px] text-fg-muted tabular-nums"
                  >
                    {subtotalText}
                  </span>
                )}
                <span className="rounded-pill border border-hairline bg-canvas/75 px-1.5 py-0.25 font-mono text-[10px] text-fg-muted tabular-nums">
                  {colLinks.length}
                </span>
              </div>
            </div>

            {/* Smoothly Collapsible Spaced Mini-Card List */}
            <SmoothCollapse
              open={expanded && colLinks.length > 0}
              motionMode={motionMode}
            >
              <div className="min-w-0 space-y-1.5 overflow-hidden border-t border-hairline bg-canvas/30 p-2">
                {colLinks.map((link) => (
                  <SidePanelLinkRow
                    key={link.id}
                    link={link}
                    searchQuery={searchQuery}
                    defaultCurrency={defaultCurrency}
                    motionMode={motionMode}
                    onToggleChecked={(e, item) =>
                      void handleToggleChecked(e, item)
                    }
                    onToggleStar={(e, item) => void handleToggleStar(e, item)}
                    onCopyUrl={(e, url) => void handleCopyUrl(e, url)}
                    onDelete={(e, item) => void handleDelete(e, item)}
                  />
                ))}
              </div>
            </SmoothCollapse>
          </section>
        );
      })}
    </div>
  );
}
