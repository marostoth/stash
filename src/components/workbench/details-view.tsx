import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Layers,
  Plus,
  Star,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DetailsRow } from '@/components/workbench/details-row';
import {
  type DetailsSortColumn,
  type DetailsSortState,
  DetailsStoreSection,
  type StoreGroupSummary,
  sortDetailsLinks,
} from '@/components/workbench/details-store-section';
import { stashRepo } from '@/lib/storage/repo';
import {
  openLinksInNamedTabGroup,
  wakeUpCollectionInTabGroup,
} from '@/lib/tabs/tab-actions';
import { getCuratedCollectionIcon } from '@/lib/themes/collection-icons';
import {
  type Collection,
  DEFAULT_SPACE_ID,
  type LinkItem,
  type MotionMode,
  type Space,
  TAB_GROUP_COLOR_SWATCH,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import {
  formatCurrencySummaries,
  summarizePrices,
} from '@/lib/utils/price-math';
import { normalizeStoreName } from '@/lib/utils/product-url';
import type { FilteredCollectionGroup } from '@/lib/utils/search';
import { useUiStore } from '@/store/ui-store';

interface DetailsViewProps {
  activeSpace: Space | undefined;
  groups: readonly FilteredCollectionGroup[];
  spaces: readonly Space[];
  isFiltering: boolean;
  searchAllSpaces: boolean;
  openInNewTab: boolean;
  defaultCurrency: string;
  motionMode: MotionMode;
  soundEffects: boolean;
  hoverPreviews: boolean;
  onSwitchSpace: (spaceId: string) => void;
}

export function DetailsView({
  activeSpace,
  groups,
  spaces,
  isFiltering,
  searchAllSpaces,
  openInNewTab,
  defaultCurrency,
  motionMode,
  soundEffects,
  hoverPreviews,
  onSwitchSpace,
}: DetailsViewProps) {
  const openCreateLink = useUiStore((s) => s.openCreateLink);
  const [sort, setSort] = useState<DetailsSortState | null>(null);
  const [collapsedStores, setCollapsedStores] = useState<
    Record<string, boolean>
  >({});

  const groupBy = activeSpace?.groupBy ?? 'collection';
  const activeSpaceId = activeSpace?.id ?? DEFAULT_SPACE_ID;
  const spaceById = useMemo(
    () => new Map(spaces.map((s) => [s.id, s])),
    [spaces],
  );

  const allLinks = useMemo(() => groups.flatMap((g) => g.links), [groups]);
  const showPriceColumn = useMemo(
    () =>
      allLinks.some(
        (link) =>
          typeof link.product?.price === 'number' &&
          Number.isFinite(link.product.price),
      ),
    [allLinks],
  );

  const gridTemplateClass = showPriceColumn
    ? 'grid-cols-[26px_minmax(180px,2.1fr)_minmax(96px,0.9fr)_94px_minmax(0,1.4fr)_minmax(0,1fr)_124px] max-lg:grid-cols-[26px_minmax(160px,2fr)_minmax(90px,0.9fr)_90px_minmax(0,1.2fr)_118px] max-md:grid-cols-[26px_minmax(140px,1.8fr)_88px_84px_110px]'
    : 'grid-cols-[26px_minmax(180px,2.2fr)_minmax(100px,0.95fr)_minmax(0,1.5fr)_minmax(0,1.1fr)_64px] max-lg:grid-cols-[26px_minmax(160px,2fr)_minmax(96px,0.95fr)_minmax(0,1.3fr)_60px] max-md:grid-cols-[26px_minmax(140px,1.8fr)_90px_56px]';

  const cycleSort = (column: DetailsSortColumn) => {
    setSort((prev) => {
      if (!prev || prev.column !== column) return { column, dir: 'asc' };
      if (prev.dir === 'asc') return { column, dir: 'desc' };
      return null;
    });
  };

  const renderSortIcon = (column: DetailsSortColumn) => {
    if (sort?.column !== column) return null;
    return sort.dir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-accent" />
    ) : (
      <ArrowDown className="h-3 w-3 text-accent" />
    );
  };

  const renderTableHeader = () => (
    <div
      className={cn(
        'grid items-center gap-2 border-b border-border bg-panel/85 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted select-none',
        gridTemplateClass,
      )}
    >
      <button
        type="button"
        onClick={() => cycleSort('starred')}
        title="Sort by Starred"
        className="inline-flex items-center justify-center gap-0.5 hover:text-fg cursor-pointer"
      >
        <Star className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => cycleSort('title')}
        className="inline-flex items-center gap-1 text-left hover:text-fg cursor-pointer"
      >
        <span>Item</span>
        {renderSortIcon('title')}
      </button>
      <button
        type="button"
        onClick={() => cycleSort('store')}
        className="inline-flex items-center gap-1 text-left hover:text-fg cursor-pointer"
      >
        <span>Store</span>
        {renderSortIcon('store')}
      </button>
      {showPriceColumn && (
        <button
          type="button"
          onClick={() => cycleSort('price')}
          className="inline-flex items-center justify-end gap-1 text-right hover:text-fg cursor-pointer"
        >
          <span>Price</span>
          {renderSortIcon('price')}
        </button>
      )}
      <span className="hidden md:block">Spec / Note</span>
      <span className="hidden lg:block">Tags</span>
      <span className="text-right">
        {showPriceColumn ? 'Qty / Act' : 'Act'}
      </span>
    </div>
  );

  const storeGroups: StoreGroupSummary[] = useMemo(() => {
    if (groupBy !== 'store') return [];
    const map = new Map<string, LinkItem[]>();
    for (const link of allLinks) {
      const store = normalizeStoreName(link.url, link.product?.store);
      const bucket = map.get(store);
      if (bucket) bucket.push(link);
      else map.set(store, [link]);
    }
    return Array.from(map.entries())
      .map(([storeName, items]) => {
        const starredItems = items.filter((l) => l.starred === true);
        return {
          storeName,
          items: sortDetailsLinks(items, sort),
          starredItems,
          totalText: formatCurrencySummaries(
            summarizePrices(items, defaultCurrency),
          ),
          starredTotalText: formatCurrencySummaries(
            summarizePrices(starredItems, defaultCurrency),
          ),
        };
      })
      .sort((a, b) => {
        const aHasStar = a.starredItems.length > 0 ? 1 : 0;
        const bHasStar = b.starredItems.length > 0 ? 1 : 0;
        if (aHasStar !== bHasStar) return bHasStar - aHasStar;
        return a.storeName.localeCompare(b.storeName);
      });
  }, [allLinks, defaultCurrency, groupBy, sort]);

  const spaceTotals = useMemo(
    () => summarizePrices(allLinks, defaultCurrency),
    [allLinks, defaultCurrency],
  );
  const spaceTotalText = formatCurrencySummaries(spaceTotals);
  const starredAll = useMemo(
    () => allLinks.filter((l) => l.starred === true),
    [allLinks],
  );
  const starredTotalText = formatCurrencySummaries(
    summarizePrices(starredAll, defaultCurrency),
  );
  const pricedCount = spaceTotals.reduce((acc, s) => acc + s.pricedCount, 0);
  const unpricedCount = Math.max(0, allLinks.length - pricedCount);

  const handleOpenStoreStarred = async (
    storeName: string,
    starredItems: readonly LinkItem[],
  ) => {
    const opened = await openLinksInNamedTabGroup(storeName, starredItems);
    if (opened > 0) {
      toast.success(
        `Opened ${opened} starred tab${opened === 1 ? '' : 's'} for ${storeName}`,
      );
    }
  };

  const handleWakeCollection = async (
    collection: Collection,
    items: readonly LinkItem[],
  ) => {
    const opened = await wakeUpCollectionInTabGroup(collection, items);
    if (opened > 0) {
      toast.success(`Opened ${opened} tabs in "${collection.name}"`);
    }
  };

  return (
    <div className="space-y-5">
      {groupBy === 'store'
        ? storeGroups.map((group) => {
            const collapsed = Boolean(collapsedStores[group.storeName]);
            return (
              <DetailsStoreSection
                key={group.storeName}
                group={group}
                collapsed={collapsed}
                onToggleCollapse={() =>
                  setCollapsedStores((prev) => ({
                    ...prev,
                    [group.storeName]: !collapsed,
                  }))
                }
                onOpenStoreStarred={() =>
                  void handleOpenStoreStarred(
                    group.storeName,
                    group.starredItems,
                  )
                }
                renderTableHeader={renderTableHeader}
                showPriceColumn={showPriceColumn}
                defaultCurrency={defaultCurrency}
                openInNewTab={openInNewTab}
                motionMode={motionMode}
                soundEffects={soundEffects}
                hoverPreviews={hoverPreviews}
                gridTemplateClass={gridTemplateClass}
              />
            );
          })
        : groups.map(({ collection, links: colLinks }) => {
            const isCollapsed = collection.collapsed && !isFiltering;
            const sortedLinks = sortDetailsLinks(colLinks, sort);
            const CuratedIcon = getCuratedCollectionIcon(collection.icon);
            const colorHex =
              collection.tintColor ?? TAB_GROUP_COLOR_SWATCH[collection.color];
            const totalText = formatCurrencySummaries(
              summarizePrices(colLinks, defaultCurrency),
            );
            const colStarred = colLinks.filter((l) => l.starred === true);
            const starredText = formatCurrencySummaries(
              summarizePrices(colStarred, defaultCurrency),
            );
            const colSpaceId = collection.spaceId ?? DEFAULT_SPACE_ID;
            const outsideSpace =
              isFiltering && searchAllSpaces && colSpaceId !== activeSpaceId
                ? spaceById.get(colSpaceId)
                : undefined;

            return (
              <section
                key={collection.id}
                className="overflow-hidden rounded-card border border-border bg-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-panel/70 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
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
                        ({colLinks.length})
                      </span>
                    </button>

                    {totalText && (
                      <span className="rounded-pill border border-border bg-canvas px-2 py-0.25 font-mono text-[10px] text-fg">
                        {totalText}
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
                    {colLinks.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void handleWakeCollection(collection, colLinks)
                        }
                        className="h-7 gap-1 px-2 text-[11px]"
                      >
                        <span>Wake Up</span>
                        <ArrowUpRight className="h-3 w-3 text-accent" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openCreateLink(collection.id)}
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
                        <div>
                          {sortedLinks.map((link) => (
                            <DetailsRow
                              key={link.id}
                              link={link}
                              showPriceColumn={showPriceColumn}
                              defaultCurrency={defaultCurrency}
                              openInNewTab={openInNewTab}
                              motionMode={motionMode}
                              soundEffects={soundEffects}
                              hoverPreviews={hoverPreviews}
                              gridTemplateClass={gridTemplateClass}
                            />
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="px-3 py-4 text-center text-xs text-fg-muted">
                        No links in this collection yet.
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}

      {/* Details Space Summary Footer */}
      {showPriceColumn && spaceTotalText && (
        <footer className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-panel/90 px-3.5 py-2 font-mono text-[11px]">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-fg-muted">
              Space Total:{' '}
              <strong className="font-semibold text-fg">
                {spaceTotalText}
              </strong>
            </span>
            {unpricedCount > 0 && (
              <span className="text-[10px] text-fg-muted/85">
                + {unpricedCount} unpriced
              </span>
            )}
          </div>

          {starredAll.length > 0 && (
            <div className="flex items-center gap-1.5 text-accent">
              <Star className="h-3 w-3 fill-accent" />
              <span>
                Starred Total ({starredAll.length}):{' '}
                <strong>{starredTotalText || '—'}</strong>
              </span>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
