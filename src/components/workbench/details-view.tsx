import { ArrowDown, ArrowUp, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DetailsCollectionSection } from '@/components/workbench/details-collection-section';
import {
  type DetailsSortColumn,
  type DetailsSortState,
  DetailsStoreSection,
  type StoreGroupSummary,
  sortDetailsLinks,
} from '@/components/workbench/details-store-section';
import {
  openLinksInNamedTabGroup,
  wakeUpCollectionInTabGroup,
} from '@/lib/tabs/tab-actions';
import {
  type Collection,
  DEFAULT_SPACE_ID,
  type LinkItem,
  type MotionMode,
  type Space,
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
  const activeSpaceName = activeSpace?.name ?? 'Main';
  const spaceById = useMemo(
    () => new Map(spaces.map((s) => [s.id, s])),
    [spaces],
  );
  const collectionNameById = useMemo(
    () => new Map(groups.map((g) => [g.collection.id, g.collection.name])),
    [groups],
  );
  const contextMode: 'store' | 'collection' =
    groupBy === 'store' ? 'collection' : 'store';

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

  // Column 1 is 44px to house the left drag handle (16px) + star toggle (24px) cleanly
  const gridTemplateClass = showPriceColumn
    ? 'grid-cols-[44px_minmax(180px,2.2fr)_minmax(100px,1.2fr)_minmax(96px,0.9fr)_minmax(88px,1fr)_76px_96px_56px] max-lg:grid-cols-[44px_minmax(160px,2fr)_minmax(96px,1.1fr)_minmax(88px,0.9fr)_72px_92px_56px] max-md:grid-cols-[44px_minmax(130px,1.8fr)_minmax(76px,0.8fr)_70px_86px_52px]'
    : 'grid-cols-[44px_minmax(180px,2.2fr)_minmax(110px,1.4fr)_minmax(96px,0.95fr)_minmax(90px,1.1fr)_56px] max-lg:grid-cols-[44px_minmax(160px,2fr)_minmax(100px,1.3fr)_minmax(90px,0.95fr)_56px] max-md:grid-cols-[44px_minmax(140px,1.8fr)_90px_52px]';

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
        'grid items-center gap-3.5 border-b border-border bg-panel/85 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted select-none',
        gridTemplateClass,
      )}
    >
      <div className="flex items-center justify-end pr-1">
        <button
          type="button"
          onClick={() => cycleSort('starred')}
          title="Sort by Starred"
          className="inline-flex items-center justify-center gap-0.5 hover:text-fg cursor-pointer"
        >
          <Star className="h-3 w-3" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => cycleSort('title')}
        className="inline-flex items-center gap-1 text-left hover:text-fg cursor-pointer"
      >
        <span>Item</span>
        {renderSortIcon('title')}
      </button>
      <span className="hidden md:block">Spec / Note</span>
      <button
        type="button"
        onClick={() => cycleSort('context')}
        className="inline-flex items-center gap-1 text-left hover:text-fg cursor-pointer"
      >
        <span>{contextMode === 'collection' ? 'Collection' : 'Store'}</span>
        {renderSortIcon('context')}
      </button>
      <span className="hidden lg:block">Tags</span>
      {showPriceColumn && <span className="text-center">Qty</span>}
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
      <span aria-hidden="true" />
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
          items: sortDetailsLinks(items, sort, {
            contextMode: 'collection',
            collectionNameById,
          }),
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
  }, [allLinks, collectionNameById, defaultCurrency, groupBy, sort]);

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
                activeSpaceId={activeSpaceId}
                activeSpaceName={activeSpaceName}
                collectionNameById={collectionNameById}
                dragDisabled={isFiltering}
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
        : groups.map(({ collection, links: colLinks }, colIndex) => {
            const isCollapsed = collection.collapsed && !isFiltering;
            const sortedLinks = sortDetailsLinks(colLinks, sort, {
              contextMode: 'store',
            });
            const colSpaceId = collection.spaceId ?? DEFAULT_SPACE_ID;
            const outsideSpace =
              isFiltering && searchAllSpaces && colSpaceId !== activeSpaceId
                ? spaceById.get(colSpaceId)
                : undefined;

            return (
              <DetailsCollectionSection
                key={collection.id}
                collection={collection}
                colIndex={colIndex}
                sortedLinks={sortedLinks}
                isCollapsed={isCollapsed}
                outsideSpace={outsideSpace}
                dragDisabled={isFiltering}
                sortActive={sort !== null}
                showPriceColumn={showPriceColumn}
                defaultCurrency={defaultCurrency}
                openInNewTab={openInNewTab}
                motionMode={motionMode}
                soundEffects={soundEffects}
                hoverPreviews={hoverPreviews}
                gridTemplateClass={gridTemplateClass}
                renderTableHeader={renderTableHeader}
                onSwitchSpace={onSwitchSpace}
                onWakeCollection={(col, items) =>
                  void handleWakeCollection(col, items)
                }
                onAddLink={openCreateLink}
              />
            );
          })}

      {/* Details Space Summary Footer (aligned directly under the Price column) */}
      {showPriceColumn && spaceTotalText && (
        <footer
          className={cn(
            'grid items-center gap-3.5 rounded-card border border-border bg-panel/90 px-3 py-2 font-mono text-[11px]',
            gridTemplateClass,
          )}
        >
          <div className="col-span-5 flex flex-wrap items-center gap-3 max-lg:col-span-4 max-md:col-span-3">
            {starredAll.length > 0 && (
              <div className="flex items-center gap-1.5 text-accent">
                <Star className="h-3 w-3 fill-accent" />
                <span>
                  Starred ({starredAll.length}):{' '}
                  <strong>{starredTotalText || '—'}</strong>
                </span>
              </div>
            )}
            {unpricedCount > 0 && (
              <span className="text-[10px] text-fg-muted/85">
                + {unpricedCount} unpriced
              </span>
            )}
          </div>

          <div className="col-span-2 flex items-center justify-end gap-2.5 whitespace-nowrap">
            <span className="text-[10px] uppercase tracking-wider text-fg-muted">
              Space Total
            </span>
            <strong className="font-semibold text-fg tabular-nums">
              {spaceTotalText}
            </strong>
          </div>

          <span aria-hidden="true" />
        </footer>
      )}
    </div>
  );
}
