import { useDroppable } from '@dnd-kit/react';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Star,
  Store,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RollingCurrency } from '@/components/ui/rolling-currency';
import { CopyListButton } from '@/components/workbench/details-inline-cells';
import { DetailsRow } from '@/components/workbench/details-row';
import { isTactileMotion } from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import type { DropEffectStyle, LinkItem, MotionMode } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import {
  formatCurrencySummaries,
  formatPrice,
  summarizeRemainingPrices,
} from '@/lib/utils/price-math';
import { normalizeStoreName } from '@/lib/utils/product-url';
import { formatShoppingListMarkdown } from '@/lib/utils/shopping-export';

export type DetailsSortColumn = 'starred' | 'title' | 'context' | 'price';

export interface DetailsSortState {
  column: DetailsSortColumn;
  dir: 'asc' | 'desc';
}

export function sortDetailsLinks(
  items: readonly LinkItem[],
  sort: DetailsSortState | null,
  options?: {
    contextMode?: 'store' | 'collection';
    collectionNameById?: ReadonlyMap<string, string>;
  },
): LinkItem[] {
  if (!sort) return [...items];
  const factor = sort.dir === 'asc' ? 1 : -1;
  const contextMode = options?.contextMode ?? 'store';
  const collectionNameById = options?.collectionNameById;

  return [...items].sort((a, b) => {
    switch (sort.column) {
      case 'starred': {
        const av = a.starred ? 1 : 0;
        const bv = b.starred ? 1 : 0;
        if (av !== bv) return (bv - av) * factor;
        return a.title.localeCompare(b.title);
      }
      case 'title':
        return a.title.localeCompare(b.title) * factor;
      case 'context': {
        const ac =
          contextMode === 'collection'
            ? (collectionNameById?.get(a.collectionId) ?? '')
            : normalizeStoreName(a.url, a.product?.store);
        const bc =
          contextMode === 'collection'
            ? (collectionNameById?.get(b.collectionId) ?? '')
            : normalizeStoreName(b.url, b.product?.store);
        return ac.localeCompare(bc) * factor;
      }
      case 'price': {
        const ap = a.product?.price;
        const bp = b.product?.price;
        if (ap === undefined && bp === undefined) return 0;
        if (ap === undefined) return 1;
        if (bp === undefined) return -1;
        const aq =
          typeof a.product?.orderQty === 'number' && a.product.orderQty >= 1
            ? Math.floor(a.product.orderQty)
            : 1;
        const bq =
          typeof b.product?.orderQty === 'number' && b.product.orderQty >= 1
            ? Math.floor(b.product.orderQty)
            : 1;
        return (ap * aq - bp * bq) * factor;
      }
      default:
        return 0;
    }
  });
}

function StoreClearStarredButton({
  storeName,
  starredLinks,
}: {
  storeName: string;
  starredLinks: readonly LinkItem[];
}) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const disarm = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setArmed(false);
  };

  const handleClick = async () => {
    if (!armed) {
      setArmed(true);
      timerRef.current = setTimeout(() => {
        setArmed(false);
        timerRef.current = null;
      }, 3000);
      return;
    }

    disarm();
    const ids = starredLinks.map((l) => l.id);
    const changedIds = await stashRepo.setLinksStarred(ids, false);
    if (changedIds.length === 0) return;
    toast(`Cleared ${changedIds.length} starred in ${storeName}`, {
      duration: 5000,
      className: 'stash-undo-toast',
      action: {
        label: 'Undo',
        onClick: () => {
          void stashRepo.setLinksStarred(changedIds, true);
        },
      },
    });
  };

  return (
    <Button
      variant={armed ? 'danger' : 'ghost'}
      size="sm"
      onClick={() => void handleClick()}
      onBlur={disarm}
      onKeyDown={(e) => {
        if (e.key === 'Escape') disarm();
      }}
      className="h-7 gap-1 px-2 text-[11px]"
    >
      <X className="h-3 w-3" />
      <span>{armed ? `Unstar ${starredLinks.length}?` : 'Clear Starred'}</span>
    </Button>
  );
}

export interface StoreGroupSummary {
  storeName: string;
  items: LinkItem[];
  starredItems: LinkItem[];
  totalText: string;
  starredTotalText: string;
}

interface DetailsStoreSectionProps {
  group: StoreGroupSummary;
  activeSpaceId: string;
  activeSpaceName: string;
  collectionNameById: ReadonlyMap<string, string>;
  dragDisabled: boolean;
  hideChecked?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenStoreStarred: () => void;
  renderTableHeader: () => ReactNode;
  showPriceColumn: boolean;
  defaultCurrency: string;
  openInNewTab: boolean;
  motionMode: MotionMode;
  dropEffectStyle?: DropEffectStyle;
  fxAmbientWaves?: boolean;
  soundEffects: boolean;
  hoverPreviews: boolean;
  gridTemplateClass: string;
}

export function DetailsStoreSection({
  group,
  activeSpaceId,
  activeSpaceName,
  collectionNameById,
  dragDisabled,
  hideChecked = false,
  collapsed,
  onToggleCollapse,
  onOpenStoreStarred,
  renderTableHeader,
  showPriceColumn,
  defaultCurrency,
  openInNewTab,
  motionMode,
  dropEffectStyle = 'dust',
  fxAmbientWaves = true,
  soundEffects,
  hoverPreviews,
  gridTemplateClass,
}: DetailsStoreSectionProps) {
  // Only accept open browser tabs (never cross-store link reassignments)
  const uniqueColIds = Array.from(
    new Set(group.items.map((item) => item.collectionId)),
  );
  const singleCollectionId =
    uniqueColIds.length === 1 ? uniqueColIds[0] : undefined;

  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `store-drop:${group.storeName}`,
    accept: 'open-tab',
    collisionPriority: 1,
    data: singleCollectionId
      ? {
          kind: 'collection-drop',
          collectionId: singleCollectionId,
        }
      : {
          kind: 'space-drop',
          spaceId: activeSpaceId,
          spaceName: activeSpaceName,
        },
  });

  const tactile = isTactileMotion(motionMode);
  const checkedCount = group.items.filter((l) => l.checked === true).length;
  const remainingText = formatCurrencySummaries(
    summarizeRemainingPrices(group.items, defaultCurrency),
  );
  const visibleItems = hideChecked
    ? group.items.filter((l) => l.checked !== true)
    : group.items;

  return (
    <section
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
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex min-w-0 items-center gap-2 text-left cursor-pointer"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-fg-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-fg-muted" />
          )}
          <Store className="h-3.5 w-3.5 text-accent" />
          <span className="text-xs font-semibold text-fg">
            {group.storeName}
          </span>
          <span className="font-mono text-[10px] text-fg-muted">
            · {group.items.length} item{group.items.length === 1 ? '' : 's'}
          </span>
          {collapsed && group.totalText && (
            <span className="rounded-pill border border-border bg-canvas px-2 py-0.25 font-mono text-[10px] text-fg">
              Total {group.totalText}
            </span>
          )}
          {group.starredItems.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-pill border border-accent/45 bg-accent/12 px-2 py-0.25 font-mono text-[10px] text-accent">
              <Star className="h-2.5 w-2.5 fill-accent" />
              {group.starredItems.length}
              {group.starredTotalText ? ` (${group.starredTotalText})` : ''}
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          <CopyListButton
            label="Copy"
            title={`Copy ${group.storeName} list`}
            onBuildText={() =>
              formatShoppingListMarkdown({
                title: group.storeName,
                groups: [{ name: group.storeName, links: group.items }],
                defaultCurrency,
                includeChecked: !hideChecked,
              })
            }
          />
          {group.starredItems.length > 0 && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenStoreStarred}
                className="h-7 gap-1 border-accent/45 px-2 text-[11px] text-accent hover:bg-accent/10"
              >
                <span>Open Starred ({group.starredItems.length})</span>
                <ArrowUpRight className="h-3 w-3" />
              </Button>
              <StoreClearStarredButton
                storeName={group.storeName}
                starredLinks={group.starredItems}
              />
            </>
          )}
        </div>
      </div>

      {!collapsed && (
        <div>
          {renderTableHeader()}
          {visibleItems.length > 0 ? (
            <div>
              {visibleItems.map((link, idx) => (
                <DetailsRow
                  key={link.id}
                  link={link}
                  index={idx}
                  dragMode={dragDisabled ? 'none' : 'cross-only'}
                  contextLabel={
                    collectionNameById.get(link.collectionId) ?? '—'
                  }
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
              All {group.items.length} item{group.items.length === 1 ? '' : 's'}{' '}
              checked off ✓
            </div>
          )}
          {showPriceColumn && group.totalText && (
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
                        : group.totalText
                    }
                    motionMode={motionMode}
                    enabled={fxAmbientWaves}
                  />
                </strong>
                {checkedCount > 0 && (
                  <span className="hidden text-[10px] text-fg-muted sm:inline">
                    / {group.totalText}
                  </span>
                )}
              </div>
              <span aria-hidden="true" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
