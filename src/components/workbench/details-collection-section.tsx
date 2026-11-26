import { useDroppable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layers,
  Plus,
  Star,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { RollingCurrency } from '@/components/ui/rolling-currency';
import { CollectionSortMenu } from '@/components/workbench/collection-sort-menu';
import { CopyListButton } from '@/components/workbench/details-inline-cells';
import { DetailsRow } from '@/components/workbench/details-row';
import { isTactileMotion } from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import { getCuratedCollectionIcon } from '@/lib/themes/collection-icons';
import {
  type Collection,
  type DropEffectStyle,
  type LinkItem,
  type MotionMode,
  type Space,
  TAB_GROUP_COLOR_SWATCH,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import {
  formatCurrencySummaries,
  formatPrice,
  summarizePrices,
  summarizeRemainingPrices,
} from '@/lib/utils/price-math';
import { formatShoppingListMarkdown } from '@/lib/utils/shopping-export';

interface DetailsCollectionSectionProps {
  collection: Collection;
  colIndex: number;
  sortedLinks: readonly LinkItem[];
  isCollapsed: boolean;
  outsideSpace?: Space;
  dragDisabled: boolean;
  hideChecked?: boolean;
  sortActive: boolean;
  showPriceColumn: boolean;
  defaultCurrency: string;
  openInNewTab: boolean;
  motionMode: MotionMode;
  dropEffectStyle?: DropEffectStyle;
  fxAmbientWaves?: boolean;
  soundEffects: boolean;
  hoverPreviews: boolean;
  gridTemplateClass: string;
  renderTableHeader: () => ReactNode;
  onSwitchSpace: (spaceId: string) => void;
  onWakeCollection: (
    collection: Collection,
    items: readonly LinkItem[],
  ) => void;
  onAddLink: (collectionId: string) => void;
}

export function DetailsCollectionSection({
  collection,
  colIndex,
  sortedLinks,
  isCollapsed,
  outsideSpace,
  dragDisabled,
  hideChecked = false,
  sortActive,
  showPriceColumn,
  defaultCurrency,
  openInNewTab,
  motionMode,
  dropEffectStyle = 'dust',
  fxAmbientWaves = true,
  soundEffects,
  hoverPreviews,
  gridTemplateClass,
  renderTableHeader,
  onSwitchSpace,
  onWakeCollection,
  onAddLink,
}: DetailsCollectionSectionProps) {
  const {
    ref: sortableRef,
    handleRef,
    isDragging,
  } = useSortable({
    id: `collection:${collection.id}`,
    type: 'collection',
    accept: 'collection',
    index: colIndex,
    disabled: dragDisabled,
    data: {
      kind: 'collection',
      collection,
      index: colIndex,
    },
  });

  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `collection-drop:${collection.id}`,
    accept: ['link', 'open-tab'],
    collisionPriority: 1,
    data: {
      kind: 'collection-drop',
      collectionId: collection.id,
    },
  });

  const CuratedIcon = getCuratedCollectionIcon(collection.icon);
  const colorHex =
    collection.tintColor ?? TAB_GROUP_COLOR_SWATCH[collection.color];
  const totalText = formatCurrencySummaries(
    summarizePrices(sortedLinks, defaultCurrency),
  );
  const checkedCount = sortedLinks.filter((l) => l.checked === true).length;
  const remainingText = formatCurrencySummaries(
    summarizeRemainingPrices(sortedLinks, defaultCurrency),
  );
  const visibleRows = hideChecked
    ? sortedLinks.filter((l) => l.checked !== true)
    : sortedLinks;
  const colStarred = sortedLinks.filter((l) => l.starred === true);
  const starredText = formatCurrencySummaries(
    summarizePrices(colStarred, defaultCurrency),
  );

  const hasCollectionSort = Boolean(
    collection.sortMode && collection.sortMode !== 'manual',
  );
  const rowDragMode = dragDisabled
    ? 'none'
    : sortActive || hasCollectionSort
      ? 'cross-only'
      : 'collection';

  const tactile = isTactileMotion(motionMode);

  return (
    <section
      ref={sortableRef}
      className={cn(
        'rounded-card transition-opacity',
        isDragging && 'opacity-40',
      )}
    >
      <div
        ref={dropRef}
        className={cn(
          'overflow-hidden rounded-card border border-border bg-card transition-colors',
          isDropTarget &&
            cn(
              'border-accent ring-2 ring-accent/55',
              tactile && 'stash-dropzone-breathe',
            ),
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-panel/70 px-3 py-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {!dragDisabled && (
              <button
                ref={handleRef}
                type="button"
                aria-label={`Drag ${collection.name} collection`}
                title="Drag to reorder collection or move to another Space"
                className="inline-flex h-6 w-5 shrink-0 items-center justify-center rounded text-fg-muted/60 transition-colors hover:bg-card hover:text-fg cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                void stashRepo.toggleCollectionCollapsed(collection.id)
              }
              className="flex min-w-0 items-center gap-2 text-left cursor-pointer"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-fg-muted" />
              ) : (
                <ChevronDown className="h-4 w-4 text-fg-muted" />
              )}
              {CuratedIcon ? (
                <CuratedIcon
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: colorHex }}
                />
              ) : (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorHex }}
                />
              )}
              <span className="truncate text-xs font-semibold text-fg">
                {collection.name}
              </span>
              <span className="font-mono text-[10px] text-fg-muted">
                ({sortedLinks.length})
              </span>
            </button>

            {collection.isAutoInbox && (
              <span
                title="Temporary Space Inbox — auto-removes once empty; rename to keep permanently"
                className="hidden rounded-pill border border-border bg-canvas px-2 py-0.25 font-mono text-[10px] text-fg-muted sm:inline-block"
              >
                AUTO-CLEANS
              </span>
            )}
            {isCollapsed && totalText && (
              <span className="rounded-pill border border-border bg-canvas px-2 py-0.25 font-mono text-[10px] text-fg">
                Total {totalText}
              </span>
            )}
            {totalText && colStarred.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-pill border border-accent/45 bg-accent/12 px-2 py-0.25 font-mono text-[10px] text-accent">
                <Star className="h-2.5 w-2.5 fill-accent" />
                {colStarred.length}
                {starredText ? ` · ${starredText}` : ''}
              </span>
            )}
            {outsideSpace && (
              <button
                type="button"
                onClick={() => onSwitchSpace(outsideSpace.id)}
                className="inline-flex items-center gap-1 rounded-pill border border-border bg-canvas px-2 py-0.25 font-mono text-[10px] text-fg-muted hover:border-accent/50 hover:text-accent cursor-pointer"
              >
                <Layers className="h-2.5 w-2.5" />
                {outsideSpace.name}
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {sortedLinks.length > 0 && (
              <CollectionSortMenu collection={collection} />
            )}
            {sortedLinks.length > 0 && (
              <CopyListButton
                label="Copy"
                title={`Copy ${collection.name} list`}
                onBuildText={() =>
                  formatShoppingListMarkdown({
                    title: collection.name,
                    groups: [{ name: collection.name, links: sortedLinks }],
                    defaultCurrency,
                    includeChecked: !hideChecked,
                  })
                }
              />
            )}
            {sortedLinks.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onWakeCollection(collection, sortedLinks)}
                className="h-7 gap-1 px-2 text-[11px]"
              >
                <span>Wake Up</span>
                <ArrowUpRight className="h-3 w-3 text-accent" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddLink(collection.id)}
              className="h-7 gap-1 px-2 text-[11px]"
            >
              <Plus className="h-3 w-3" />
              <span>Add</span>
            </Button>
          </div>
        </div>

        {!isCollapsed && (
          <div>
            {sortedLinks.length > 0 ? (
              <>
                {renderTableHeader()}
                {visibleRows.length > 0 ? (
                  <div>
                    {visibleRows.map((link, idx) => (
                      <DetailsRow
                        key={link.id}
                        link={link}
                        index={idx}
                        dragMode={rowDragMode}
                        showPriceColumn={showPriceColumn}
                        defaultCurrency={defaultCurrency}
                        openInNewTab={openInNewTab}
                        motionMode={motionMode}
                        dropEffectStyle={dropEffectStyle}
                        soundEffects={soundEffects}
                        hoverPreviews={hoverPreviews}
                        gridTemplateClass={gridTemplateClass}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-3 text-center font-mono text-[11px] text-fg-muted">
                    All {sortedLinks.length} item
                    {sortedLinks.length === 1 ? '' : 's'} checked off ✓
                  </div>
                )}
                {showPriceColumn && totalText && (
                  <div
                    className={cn(
                      'grid items-center gap-3.5 border-t border-border/80 bg-panel/45 px-3 py-1.5 font-mono text-[11px]',
                      gridTemplateClass,
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="col-span-5 max-lg:col-span-4 max-md:col-span-3"
                    />
                    <div className="col-span-2 flex items-center justify-end gap-2 whitespace-nowrap">
                      <span className="text-[10px] uppercase tracking-wider text-fg-muted">
                        {checkedCount > 0 ? 'Remaining' : 'Subtotal'}
                      </span>
                      <strong className="font-semibold text-fg tabular-nums">
                        <RollingCurrency
                          value={
                            checkedCount > 0
                              ? remainingText || formatPrice(0, defaultCurrency)
                              : totalText
                          }
                          motionMode={motionMode}
                          enabled={fxAmbientWaves}
                        />
                      </strong>
                      {checkedCount > 0 && (
                        <span className="hidden text-[10px] text-fg-muted sm:inline">
                          / {totalText}
                        </span>
                      )}
                    </div>
                    <span aria-hidden="true" />
                  </div>
                )}
              </>
            ) : (
              <div className="px-3 py-4 text-center text-xs text-fg-muted">
                No links in this collection yet — drop a row or tab here.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
