import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Star,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { LinkFavicon } from '@/components/LinkFavicon';
import { playDelete, playDrop, playTagPop } from '@/lib/audio/foley';
import { stashRepo } from '@/lib/storage/repo';
import { wakeUpCollectionInTabGroup } from '@/lib/tabs/tab-actions';
import { getCuratedCollectionIcon } from '@/lib/themes/collection-icons';
import {
  type Collection,
  type LinkItem,
  type MotionMode,
  TAB_GROUP_COLOR_SWATCH,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { getCollectionSortMeta } from '@/lib/utils/collection-sort';
import { HighlightText } from '@/lib/utils/highlight-match';
import { formatPrice, normalizeCurrencyCode } from '@/lib/utils/price-math';
import type { FilteredCollectionGroup } from '@/lib/utils/search';
import { extractDomain } from '@/lib/utils/url';

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
    if (res.ok && nextChecked) {
      playTagPop(soundEffects, motionMode);
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
    toast('Link removed', {
      duration: 5000,
      className: 'stash-undo-toast',
      action: {
        label: 'Undo',
        onClick: () => {
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
      <div className="space-y-2 py-8 text-center text-xs text-fg-muted">
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
            className="rounded-pill border border-border bg-panel px-2.5 py-1 font-mono text-[10px] text-accent transition-colors hover:border-accent/50 cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
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

        return (
          <div
            key={collection.id}
            className="rounded-card border border-border bg-panel/70"
          >
            <div className="group/hdr flex items-center justify-between gap-1 px-2 py-1.5">
              <button
                type="button"
                onClick={() => onToggleCollection(collection.id, expanded)}
                aria-expanded={expanded}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-control px-1 py-0.5 text-left text-xs font-medium text-fg transition-colors hover:bg-card/60 cursor-pointer"
              >
                {expanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                )}
                {CuratedIcon ? (
                  <CuratedIcon
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: colorHex }}
                    aria-hidden="true"
                  />
                ) : collection.icon ? (
                  <span
                    className="shrink-0 text-xs leading-none"
                    aria-hidden="true"
                  >
                    {collection.icon}
                  </span>
                ) : (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorHex }}
                  />
                )}
                <span className="truncate">{collection.name}</span>
                {sortMeta && (
                  <span className="shrink-0 rounded-pill border border-accent/35 bg-accent/10 px-1.5 py-0.25 font-mono text-[9px] text-accent">
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
                    className="inline-flex h-6 items-center gap-0.5 rounded px-1.5 font-mono text-[10px] text-fg-muted opacity-0 transition-opacity hover:bg-card hover:text-accent group-hover/hdr:opacity-100 focus-visible:opacity-100 cursor-pointer"
                  >
                    <span>Wake</span>
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
                <span className="pr-1 font-mono text-[10px] text-fg-muted">
                  {colLinks.length}
                </span>
              </div>
            </div>

            {expanded && colLinks.length > 0 && (
              <div className="space-y-0.5 border-t border-border p-1.5">
                {colLinks.map((link) => {
                  const isStarred = link.starred === true;
                  const isChecked = link.checked === true;
                  const price =
                    typeof link.product?.price === 'number' &&
                    Number.isFinite(link.product.price)
                      ? formatPrice(
                          link.product.price *
                            Math.max(1, Math.floor(link.product.orderQty ?? 1)),
                          normalizeCurrencyCode(
                            link.product.currency,
                            defaultCurrency,
                          ),
                        )
                      : null;

                  return (
                    <div
                      key={link.id}
                      className={cn(
                        'group/row relative flex items-center gap-1 rounded-control transition-colors hover:bg-card',
                        isStarred && !isChecked && 'bg-accent/[0.06]',
                        isChecked && 'opacity-60 hover:opacity-90',
                      )}
                    >
                      {isStarred && !isChecked && (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-1 left-0 w-[2px] rounded-full bg-accent"
                        />
                      )}

                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => void stashRepo.markLinkOpened(link.id)}
                        className="flex min-w-0 flex-1 items-start gap-2 px-2 py-1.5"
                      >
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-canvas">
                          <LinkFavicon
                            url={link.url}
                            faviconUrl={link.faviconUrl}
                            size="sm"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                'truncate text-xs font-medium',
                                isChecked
                                  ? 'text-fg-muted line-through decoration-fg-muted/70'
                                  : 'text-fg',
                              )}
                            >
                              <HighlightText
                                text={link.title}
                                query={searchQuery}
                              />
                            </span>
                            {price && (
                              <span className="shrink-0 rounded border border-border/80 bg-canvas px-1 py-0.25 font-mono text-[9px] text-fg-muted tabular-nums">
                                {price}
                              </span>
                            )}
                          </div>
                          <div className="truncate font-mono text-[10px] text-fg-muted">
                            {extractDomain(link.url)}
                            {link.note ? ` · ${link.note}` : ''}
                          </div>
                        </div>
                      </a>

                      {/* Compact Hover Quick Actions */}
                      <div className="mr-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within/row:opacity-100 group-hover/row:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => void handleToggleChecked(e, link)}
                          aria-label={
                            isChecked
                              ? `Uncheck ${link.title}`
                              : `Mark ${link.title} done`
                          }
                          title={isChecked ? 'Unmark done' : 'Mark done'}
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-panel cursor-pointer',
                            isChecked
                              ? 'text-accent'
                              : 'text-fg-muted hover:text-accent',
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => void handleToggleStar(e, link)}
                          aria-label={
                            isStarred
                              ? `Unstar ${link.title}`
                              : `Star ${link.title}`
                          }
                          title={isStarred ? 'Remove star' : 'Star link'}
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-panel cursor-pointer',
                            isStarred
                              ? 'text-accent'
                              : 'text-fg-muted hover:text-accent',
                          )}
                        >
                          <Star
                            className={cn(
                              'h-3 w-3',
                              isStarred && 'fill-accent text-accent',
                            )}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => void handleCopyUrl(e, link.url)}
                          aria-label={`Copy URL for ${link.title}`}
                          title="Copy URL"
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-panel hover:text-fg cursor-pointer"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => void handleDelete(e, link)}
                          aria-label={`Delete ${link.title}`}
                          title="Delete (Undo available)"
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-danger/15 hover:text-danger cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
