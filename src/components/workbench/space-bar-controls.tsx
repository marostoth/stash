import {
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  EyeOff,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { SpaceGroupBy, SpaceViewMode } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

export interface SpaceBarControlStateInput {
  activeViewMode: SpaceViewMode;
  activeGroupBy: SpaceGroupBy;
  collectionCount: number;
  allCollapsed: boolean;
  checkedCountInSpace: number;
  hideChecked: boolean;
}

export interface SpaceBarControlState {
  showGroupByToggle: boolean;
  showCollapseToggle: boolean;
  collapseActionLabel: 'Expand all' | 'Collapse all';
  showHideCheckedToggle: boolean;
}

/**
 * Pure visibility & label rules for the inline right-hand Space bar controls:
 * - `Collection | Retailer` grouping appears strictly in `Details` layout.
 * - `Collapse / Expand all` hides cleanly when the Space has zero collections.
 * - `Hide done` appears strictly when the Space has checked items (or active hide).
 */
export function resolveSpaceBarControlState({
  activeViewMode,
  collectionCount,
  allCollapsed,
  checkedCountInSpace,
  hideChecked,
}: SpaceBarControlStateInput): SpaceBarControlState {
  return {
    showGroupByToggle: activeViewMode === 'details',
    showCollapseToggle: collectionCount > 0,
    collapseActionLabel: allCollapsed ? 'Expand all' : 'Collapse all',
    showHideCheckedToggle: checkedCountInSpace > 0 || hideChecked,
  };
}

interface SpaceBarControlsProps {
  activeViewMode: SpaceViewMode;
  activeGroupBy: SpaceGroupBy;
  hideChecked: boolean;
  checkedCountInSpace: number;
  collectionCount: number;
  allCollapsed: boolean;
  onSetViewMode: (mode: SpaceViewMode) => void;
  onSetGroupBy: (groupBy: SpaceGroupBy) => void;
  onToggleHideChecked: () => void;
  onToggleAllCollapsed: () => void;
}

/**
 * Compact, single-click inline view controls anchored to the right side of the
 * Space bar (Grid | Details, contextual Collection | Retailer, Collapse/Expand all,
 * and contextual Hide Done when items are checked off).
 */
export function SpaceBarControls({
  activeViewMode,
  activeGroupBy,
  hideChecked,
  checkedCountInSpace,
  collectionCount,
  allCollapsed,
  onSetViewMode,
  onSetGroupBy,
  onToggleHideChecked,
  onToggleAllCollapsed,
}: SpaceBarControlsProps) {
  const state = resolveSpaceBarControlState({
    activeViewMode,
    activeGroupBy,
    collectionCount,
    allCollapsed,
    checkedCountInSpace,
    hideChecked,
  });

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {/* Contextual Hide Done chip (only shown when Shopping / checklist items are checked) */}
      {state.showHideCheckedToggle && (
        <button
          type="button"
          aria-pressed={hideChecked}
          onClick={onToggleHideChecked}
          title={
            hideChecked
              ? `Show ${checkedCountInSpace} hidden done item${checkedCountInSpace === 1 ? '' : 's'}`
              : `Hide ${checkedCountInSpace} done item${checkedCountInSpace === 1 ? '' : 's'}`
          }
          className={cn(
            'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-control border px-2 text-[11px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
            hideChecked
              ? 'border-accent/55 bg-accent/12 text-accent'
              : 'border-hairline bg-card/70 text-fg-muted hover:border-border hover:bg-card hover:text-fg',
          )}
        >
          {hideChecked ? (
            <EyeOff className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Check className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="hidden md:inline">
            {hideChecked ? `Hidden (${checkedCountInSpace})` : 'Hide done'}
          </span>
        </button>
      )}

      {/* Contextual Group-By Segmented Switch (Details mode only) */}
      {state.showGroupByToggle && (
        <fieldset
          aria-label="Group Details rows by"
          className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-control border border-hairline bg-canvas/85 p-0.5"
        >
          <button
            type="button"
            aria-pressed={activeGroupBy === 'collection'}
            onClick={() => onSetGroupBy('collection')}
            title="Group rows by Collection"
            className={cn(
              'inline-flex h-full items-center justify-center rounded-[calc(var(--stash-radius-control)-2px)] px-2 text-[11px] font-medium transition-colors cursor-pointer',
              activeGroupBy === 'collection'
                ? 'bg-elevated text-fg shadow-xs'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            Collection
          </button>
          <button
            type="button"
            aria-pressed={activeGroupBy === 'store'}
            onClick={() => onSetGroupBy('store')}
            title="Group rows by Retailer"
            className={cn(
              'inline-flex h-full items-center justify-center rounded-[calc(var(--stash-radius-control)-2px)] px-2 text-[11px] font-medium transition-colors cursor-pointer',
              activeGroupBy === 'store'
                ? 'bg-elevated text-fg shadow-xs'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            Retailer
          </button>
        </fieldset>
      )}

      {/* Layout Segmented Switch (Grid | Details) */}
      <fieldset
        aria-label="Board layout"
        className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-control border border-hairline bg-canvas/85 p-0.5"
      >
        <button
          type="button"
          aria-pressed={activeViewMode === 'grid'}
          onClick={() => onSetViewMode('grid')}
          aria-label="Grid layout"
          title="Grid view"
          className={cn(
            'inline-flex h-full items-center justify-center gap-1.5 rounded-[calc(var(--stash-radius-control)-2px)] px-2 text-[11px] font-medium transition-colors cursor-pointer',
            activeViewMode === 'grid'
              ? 'bg-elevated text-fg shadow-xs'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Grid</span>
        </button>
        <button
          type="button"
          aria-pressed={activeViewMode === 'details'}
          onClick={() => onSetViewMode('details')}
          aria-label="Details layout"
          title="Details table view"
          className={cn(
            'inline-flex h-full items-center justify-center gap-1.5 rounded-[calc(var(--stash-radius-control)-2px)] px-2 text-[11px] font-medium transition-colors cursor-pointer',
            activeViewMode === 'details'
              ? 'bg-elevated text-fg shadow-xs'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          <List className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Details</span>
        </button>
      </fieldset>

      {/* One-Click Collapse / Expand All Collections */}
      {state.showCollapseToggle && (
        <button
          type="button"
          onClick={onToggleAllCollapsed}
          aria-label={`${state.collapseActionLabel} collections`}
          title={`${state.collapseActionLabel} collections (${collectionCount})`}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-hairline bg-card/70 text-fg-muted transition-colors hover:border-border hover:bg-card hover:text-fg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          {allCollapsed ? (
            <ChevronsUpDown className="h-3.5 w-3.5 text-accent" />
          ) : (
            <ChevronsDownUp className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
}
