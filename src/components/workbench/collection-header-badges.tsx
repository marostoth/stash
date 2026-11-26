import { Layers, Star } from 'lucide-react';
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
