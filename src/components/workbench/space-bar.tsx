import {
  Layers,
  LayoutGrid,
  List,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CreateSpacePopover,
  EditSpacePopover,
} from '@/components/workbench/space-bar-popovers';
import { stashRepo } from '@/lib/storage/repo';
import { getCuratedCollectionIcon } from '@/lib/themes/collection-icons';
import {
  type Collection,
  DEFAULT_SPACE_ID,
  type Space,
  type SpaceGroupBy,
  type SpaceViewMode,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface SpaceBarProps {
  spaces: readonly Space[];
  collections: readonly Collection[];
  activeSpaceId: string;
  wideBoard: boolean;
  onSelectSpace: (spaceId: string) => void;
}

export function SpaceBar({
  spaces,
  collections,
  activeSpaceId,
  wideBoard,
  onSelectSpace,
}: SpaceBarProps) {
  const [creating, setCreating] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const collectionCountBySpace = useMemo(() => {
    const counts = new Map<string, number>();
    for (const col of collections) {
      const sid = col.spaceId ?? DEFAULT_SPACE_ID;
      counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }
    return counts;
  }, [collections]);

  const editingSpace = useMemo(
    () => spaces.find((s) => s.id === editingSpaceId) ?? null,
    [spaces, editingSpaceId],
  );

  useEffect(() => {
    if (!creating && !editingSpaceId) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        event.target instanceof Node &&
        !popoverRef.current.contains(event.target)
      ) {
        setCreating(false);
        setEditingSpaceId(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCreating(false);
        setEditingSpaceId(null);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [creating, editingSpaceId]);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? spaces[0];
  const activeViewMode: SpaceViewMode = activeSpace?.viewMode ?? 'grid';
  const activeGroupBy: SpaceGroupBy = activeSpace?.groupBy ?? 'collection';

  const handleSetViewMode = (mode: SpaceViewMode) => {
    if (!activeSpace || activeViewMode === mode) return;
    void stashRepo.updateSpace(activeSpace.id, { viewMode: mode });
  };

  const handleSetGroupBy = (groupBy: SpaceGroupBy) => {
    if (!activeSpace || activeGroupBy === groupBy) return;
    void stashRepo.updateSpace(activeSpace.id, { groupBy });
  };

  const handleCreateSpace = async (name: string, icon: string) => {
    const created = await stashRepo.createSpace({
      name,
      icon: icon || undefined,
    });
    setCreating(false);
    onSelectSpace(created.id);
    toast.success(`Created Space "${created.name}"`);
  };

  return (
    <div
      ref={popoverRef}
      className="relative z-20 border-b border-border/80 bg-panel/75 backdrop-blur-xs"
    >
      <div className="px-4 sm:px-6">
        <div
          className={cn(
            'mx-auto flex items-center justify-between gap-2 py-1.5',
            wideBoard ? 'max-w-[1720px]' : 'max-w-[1320px]',
          )}
        >
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {spaces.map((space, idx) => {
              const isActive = space.id === activeSpaceId;
              const SpaceIcon = getCuratedCollectionIcon(space.icon) ?? Layers;
              const colCount = collectionCountBySpace.get(space.id) ?? 0;

              return (
                <div
                  key={space.id}
                  className={cn(
                    'group relative inline-flex shrink-0 items-center rounded-control border transition-colors',
                    isActive
                      ? 'border-accent/55 bg-accent/12 text-fg'
                      : 'border-transparent text-fg-muted hover:border-border hover:bg-card/60 hover:text-fg',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectSpace(space.id)}
                    aria-current={isActive ? 'page' : undefined}
                    title={
                      idx < 9 ? `${space.name} (press ${idx + 1})` : space.name
                    }
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 px-2.5 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-control',
                      isActive && 'pr-1.5',
                    )}
                  >
                    <SpaceIcon
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        isActive ? 'text-accent' : 'text-fg-muted',
                      )}
                      aria-hidden="true"
                    />
                    <span className="max-w-[140px] truncate">{space.name}</span>
                    <span className="font-mono text-[10px] text-fg-muted/85">
                      {colCount}
                    </span>
                  </button>

                  {isActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(false);
                        setEditingSpaceId((prev) =>
                          prev === space.id ? null : space.id,
                        );
                      }}
                      aria-label={`Edit ${space.name} space`}
                      title="Rename, icon, density, or delete Space"
                      className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded text-fg-muted transition-colors hover:bg-panel hover:text-accent cursor-pointer"
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                    </button>
                  )}

                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-2 -bottom-[7px] h-[2px] rounded-full bg-accent"
                    />
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setEditingSpaceId(null);
                setCreating((prev) => !prev);
              }}
              className={cn(
                'ml-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-control border border-dashed px-2 text-[11px] font-medium transition-colors cursor-pointer',
                creating
                  ? 'border-accent/60 bg-accent/10 text-accent'
                  : 'border-border text-fg-muted hover:border-accent/50 hover:text-fg',
              )}
            >
              <Plus className="h-3 w-3" />
              <span>New Space</span>
            </button>
          </div>

          {/* Per-Space View & Group Controls */}
          <div className="flex shrink-0 items-center gap-1.5">
            {activeViewMode === 'details' && (
              <fieldset
                aria-label="Details grouping"
                className="inline-flex items-center rounded-control border border-border bg-canvas/80 p-0.5"
              >
                <span className="hidden px-1.5 font-mono text-[10px] text-fg-muted sm:inline">
                  Group
                </span>
                <button
                  type="button"
                  aria-pressed={activeGroupBy === 'collection'}
                  onClick={() => handleSetGroupBy('collection')}
                  className={cn(
                    'rounded-[calc(var(--stash-radius-control)-2px)] px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer',
                    activeGroupBy === 'collection'
                      ? 'bg-accent text-accent-fg'
                      : 'text-fg-muted hover:text-fg',
                  )}
                >
                  Collection
                </button>
                <button
                  type="button"
                  aria-pressed={activeGroupBy === 'store'}
                  onClick={() => handleSetGroupBy('store')}
                  className={cn(
                    'rounded-[calc(var(--stash-radius-control)-2px)] px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer',
                    activeGroupBy === 'store'
                      ? 'bg-accent text-accent-fg'
                      : 'text-fg-muted hover:text-fg',
                  )}
                >
                  Store
                </button>
              </fieldset>
            )}

            <fieldset
              aria-label="Space view mode"
              className="inline-flex items-center rounded-control border border-border bg-canvas/80 p-0.5"
            >
              <button
                type="button"
                aria-pressed={activeViewMode === 'grid'}
                onClick={() => handleSetViewMode('grid')}
                title="Grid card view"
                className={cn(
                  'inline-flex items-center gap-1 rounded-[calc(var(--stash-radius-control)-2px)] px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer',
                  activeViewMode === 'grid'
                    ? 'bg-accent text-accent-fg'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                <LayoutGrid className="h-3 w-3" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                aria-pressed={activeViewMode === 'details'}
                onClick={() => handleSetViewMode('details')}
                title="Details table view"
                className={cn(
                  'inline-flex items-center gap-1 rounded-[calc(var(--stash-radius-control)-2px)] px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer',
                  activeViewMode === 'details'
                    ? 'bg-accent text-accent-fg'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                <List className="h-3 w-3" />
                <span className="hidden sm:inline">Details</span>
              </button>
            </fieldset>
          </div>
        </div>
      </div>

      {creating && (
        <CreateSpacePopover
          wideBoard={wideBoard}
          onCreate={handleCreateSpace}
          onCancel={() => setCreating(false)}
        />
      )}

      {editingSpace && (
        <EditSpacePopover
          key={editingSpace.id}
          space={editingSpace}
          canDelete={spaces.length > 1}
          collectionCount={collectionCountBySpace.get(editingSpace.id) ?? 0}
          wideBoard={wideBoard}
          onSave={async (patch) => {
            await stashRepo.updateSpace(editingSpace.id, patch);
            setEditingSpaceId(null);
            toast.success(`Updated Space "${patch.name}"`);
          }}
          onDelete={async () => {
            const name = editingSpace.name;
            const res = await stashRepo.deleteSpace(editingSpace.id);
            if (!res.deleted) return;
            setEditingSpaceId(null);
            if (res.fallbackSpaceId) onSelectSpace(res.fallbackSpaceId);
            toast.success(
              res.migratedCollections > 0
                ? `Deleted "${name}" · moved ${res.migratedCollections} collection${res.migratedCollections === 1 ? '' : 's'} to Main`
                : `Deleted Space "${name}"`,
            );
          }}
          onClose={() => setEditingSpaceId(null)}
        />
      )}
    </div>
  );
}
