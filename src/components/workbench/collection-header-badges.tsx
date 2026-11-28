import { Layers, Plus, Star } from 'lucide-react';
import { OdometerCounter } from '@/components/ui/odometer-counter';
import { RollingCurrency } from '@/components/ui/rolling-currency';
import type {
  CardDensity,
  Collection,
  CollectionViewMode,
  MotionMode,
  Space,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

export function resolveCollectionGridClass(
  density: CardDensity,
  viewMode: CollectionViewMode,
  wideBoard: boolean,
): string {
  const cols =
    density === 'micro' && viewMode !== 'cover'
      ? wideBoard
        ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 min-[1900px]:grid-cols-7'
        : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5'
      : wideBoard
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1900px]:grid-cols-6'
        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';
  const gap =
    density === 'micro'
      ? 'gap-2.5'
      : density === 'compact'
        ? 'gap-3.5'
        : 'gap-4';
  return cn(cols, gap);
}

interface CollectionHeaderBadgesProps {
  collection: Collection;
  linkCount: number;
  collectionTotalText: string;
  starredCount: number;
  starredTotalText: string;
  spaceBadge?: Space;
  motionMode: MotionMode;
  fxAmbientWaves: boolean;
  onSwitchSpace?: (spaceId: string) => void;
}

export function CollectionHeaderBadges({
  collection,
  linkCount,
  collectionTotalText,
  starredCount,
  starredTotalText,
  spaceBadge,
  motionMode,
  fxAmbientWaves,
  onSwitchSpace,
}: CollectionHeaderBadgesProps) {
  return (
    <>
      <span className="shrink-0 rounded-pill border border-border bg-panel px-2 py-0.5 font-mono text-[10px] text-fg-muted">
        <OdometerCounter value={linkCount} motionMode={motionMode} />
      </span>
      {collection.isSession && (
        <span className="hidden shrink-0 rounded-pill border border-accent/55 bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent sm:inline-block">
          SESSION
        </span>
      )}
      {collection.isAutoInbox && (
        <span
          title="Temporary Space Inbox — auto-removes once empty; rename to keep permanently"
          className="hidden shrink-0 rounded-pill border border-border bg-canvas px-2 py-0.5 font-mono text-[10px] text-fg-muted sm:inline-block"
        >
          AUTO-CLEANS
        </span>
      )}
      {collectionTotalText && (
        <span className="shrink-0 rounded-pill border border-border bg-panel px-2 py-0.5 font-mono text-[10px] text-fg">
          <RollingCurrency
            value={collectionTotalText}
            motionMode={motionMode}
            enabled={fxAmbientWaves}
          />
        </span>
      )}
      {collectionTotalText && starredCount > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-accent/45 bg-accent/12 px-2 py-0.5 font-mono text-[10px] text-accent">
          <Star className="h-2.5 w-2.5 fill-accent" />
          {starredCount}
          {starredTotalText ? ` · ${starredTotalText}` : ''}
        </span>
      )}
      {collection.description && (
        <span className="hidden truncate text-xs text-fg-muted lg:inline">
          — {collection.description}
        </span>
      )}
      {spaceBadge && onSwitchSpace && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSwitchSpace(spaceBadge.id);
          }}
          title={`Switch to ${spaceBadge.name} Space`}
          className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-border bg-panel px-2 py-0.5 font-mono text-[10px] text-fg-muted transition-colors hover:border-accent/50 hover:text-accent cursor-pointer"
        >
          <Layers className="h-2.5 w-2.5" />
          <span>{spaceBadge.name}</span>
        </button>
      )}
    </>
  );
}

/**
 * Recessed matte insertion placeholder shown inside a collection grid at the
 * exact target index while dragging an Open Tab or cross-collection link.
 */
export function EmptyCollectionDropButton({
  collectionName,
  isDropTarget,
  onAddLink,
}: {
  collectionName: string;
  isDropTarget: boolean;
  onAddLink: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAddLink}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-border bg-panel/40 px-4 py-5 text-xs text-fg-muted transition-colors hover:border-accent/50 hover:bg-panel hover:text-fg cursor-pointer',
        isDropTarget && 'border-accent bg-accent/10 text-accent',
      )}
    >
      <Plus className="h-3.5 w-3.5 text-accent" />
      <span>
        {isDropTarget
          ? `Drop to stash into ${collectionName}`
          : `Drop an open tab here or add your first link to ${collectionName}`}
      </span>
    </button>
  );
}

export function DropSlotPlaceholder({ density }: { density: CardDensity }) {
  const heightClass =
    density === 'micro'
      ? 'min-h-[54px]'
      : density === 'compact'
        ? 'min-h-[82px]'
        : 'min-h-[104px]';
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center rounded-card border border-dashed border-accent/45 bg-panel/65 font-mono text-[10px] text-fg-muted shadow-inner ${heightClass}`}
    >
      Drop here
    </div>
  );
}
