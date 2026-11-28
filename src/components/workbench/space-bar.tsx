import { useDroppable } from '@dnd-kit/react';
import { Layers, Plus, SlidersHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { SpaceBarControls } from '@/components/workbench/space-bar-controls';
import {
  CreateSpacePopover,
  EditSpacePopover,
} from '@/components/workbench/space-bar-popovers';
import { isTactileMotion } from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import { getCuratedCollectionIcon } from '@/lib/themes/collection-icons';
import {
  type Collection,
  DEFAULT_SPACE_ID,
  type MotionMode,
  type Space,
  type SpaceGroupBy,
  type SpaceViewMode,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { useFxStore } from '@/store/fx-store';

interface DroppableSpacePillProps {
  space: Space;
  index: number;
  isActive: boolean;
  colCount: number;
  motionMode: MotionMode;
  fxAmbientWaves: boolean;
  onSelect: () => void;
  onToggleEdit: () => void;
}

function DroppableSpacePill({
  space,
  index,
  isActive,
  colCount,
  motionMode,
  fxAmbientWaves,
  onSelect,
  onToggleEdit,
}: DroppableSpacePillProps) {
  const SpaceIcon = getCuratedCollectionIcon(space.icon) ?? Layers;
  const swallowedSpace = useFxStore((s) => s.swallowedSpace);
  const tactile = isTactileMotion(motionMode);
  const isSwallowing =
    tactile && fxAmbientWaves && swallowedSpace?.spaceId === space.id;

  const { ref, isDropTarget } = useDroppable({
    id: `space-drop:${space.id}`,
    accept: ['link', 'open-tab', 'collection'],
    collisionPriority: 3,
    data: {
      kind: 'space-drop',
      spaceId: space.id,
      spaceName: space.name,
    },
  });

  return (
    <div ref={ref} className="relative shrink-0">
      <AnimatePresence>
        {isSwallowing && swallowedSpace && (
          <>
            <motion.span
              key={`ring-${swallowedSpace.seq}`}
              aria-hidden="true"
              initial={{ scale: 0.96, opacity: 0.85 }}
              animate={{ scale: 1.32, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.72, ease: [0.18, 0.78, 0.28, 1] }}
              className="pointer-events-none absolute inset-0 rounded-control border-2 border-accent"
            />
            <motion.span
              key={`badge-${swallowedSpace.seq}`}
              aria-hidden="true"
              initial={{ y: 2, opacity: 0, scale: 0.7 }}
              animate={{ y: -26, opacity: [0, 1, 1, 0], scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.88, ease: 'easeOut' }}
              className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 rounded-pill bg-accent px-1.5 py-0.25 font-mono text-[10px] font-bold text-accent-fg shadow-md"
            >
              {swallowedSpace.label}
            </motion.span>
          </>
        )}
      </AnimatePresence>

      <motion.div
        animate={
          isSwallowing
            ? { scale: [1, 1.14, 0.94, 1.03, 1] }
            : isDropTarget && tactile
              ? { scale: 1.04, y: -1 }
              : { scale: 1, y: 0 }
        }
        transition={
          isSwallowing
            ? { duration: 0.52, ease: [0.22, 1, 0.36, 1] }
            : { duration: 0.14 }
        }
        className={cn(
          'group relative inline-flex shrink-0 items-center rounded-control border transition-colors',
          isDropTarget
            ? 'border-accent/65 bg-elevated text-fg ring-1 ring-accent/40'
            : isActive
              ? 'border-hairline bg-elevated text-fg'
              : 'border-transparent text-fg-muted hover:border-hairline hover:bg-card/60 hover:text-fg',
        )}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-current={isActive ? 'page' : undefined}
          title={
            index < 9
              ? `${space.name} (press ${index + 1} · drag cards, tabs, or collections here)`
              : `${space.name} (drag cards, tabs, or collections here)`
          }
          className={cn(
            'inline-flex h-7 items-center gap-1.5 px-2.5 text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-control',
            isActive && 'pr-1.5',
          )}
        >
          <SpaceIcon
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              isDropTarget
                ? 'text-accent'
                : isActive
                  ? 'text-fg'
                  : 'text-fg-muted',
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
            onClick={onToggleEdit}
            aria-label={`Edit ${space.name} space`}
            title="Rename, icon, density, or delete Space"
            className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded text-fg-muted transition-colors hover:bg-panel hover:text-fg cursor-pointer"
          >
            <SlidersHorizontal className="h-3 w-3" />
          </button>
        )}

        {isActive && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-2.5 -bottom-[8px] h-[2px] rounded-full bg-accent/90"
          />
        )}
      </motion.div>
    </div>
  );
}

interface SpaceBarProps {
  spaces: readonly Space[];
  collections: readonly Collection[];
  activeSpaceId: string;
  checkedCountInSpace: number;
  wideBoard: boolean;
  motionMode: MotionMode;
  fxAmbientWaves: boolean;
  onSelectSpace: (spaceId: string) => void;
}

export function SpaceBar({
  spaces,
  collections,
  activeSpaceId,
  checkedCountInSpace,
  wideBoard,
  motionMode,
  fxAmbientWaves,
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
        event.preventDefault();
        event.stopPropagation();
        setCreating(false);
        setEditingSpaceId(null);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [creating, editingSpaceId]);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? spaces[0];
  const activeViewMode: SpaceViewMode = activeSpace?.viewMode ?? 'grid';
  const activeGroupBy: SpaceGroupBy = activeSpace?.groupBy ?? 'collection';
  const hideChecked = activeSpace?.hideChecked === true;

  const handleSetViewMode = (mode: SpaceViewMode) => {
    if (activeSpace && activeViewMode !== mode)
      void stashRepo.updateSpace(activeSpace.id, { viewMode: mode });
  };
  const handleSetGroupBy = (groupBy: SpaceGroupBy) => {
    if (activeSpace && activeGroupBy !== groupBy)
      void stashRepo.updateSpace(activeSpace.id, { groupBy });
  };
  const handleToggleHideChecked = () => {
    if (activeSpace)
      void stashRepo.updateSpace(activeSpace.id, { hideChecked: !hideChecked });
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

  const activeSpaceCollections = collections.filter(
    (col) => (col.spaceId ?? DEFAULT_SPACE_ID) === activeSpaceId,
  );
  const allSpaceCollectionsCollapsed =
    activeSpaceCollections.length > 0 &&
    activeSpaceCollections.every((col) => col.collapsed);
  const handleToggleAllCollapsed = () => {
    if (activeSpaceCollections.length === 0) return;
    void stashRepo.setCollectionsCollapsed(
      activeSpaceCollections.map((c) => c.id),
      !allSpaceCollectionsCollapsed,
    );
  };

  return (
    <div
      ref={popoverRef}
      className="sticky top-0 z-20 border-b border-hairline bg-panel/85 backdrop-blur-sm"
    >
      <div className="px-5 sm:px-8">
        <div
          className={cn(
            'mx-auto flex items-center justify-between gap-2',
            wideBoard ? 'max-w-[1720px]' : 'max-w-[1320px]',
          )}
        >
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden py-2.5">
            {spaces.map((space, idx) => (
              <DroppableSpacePill
                key={space.id}
                space={space}
                index={idx}
                isActive={space.id === activeSpaceId}
                colCount={collectionCountBySpace.get(space.id) ?? 0}
                motionMode={motionMode}
                fxAmbientWaves={fxAmbientWaves}
                onSelect={() => onSelectSpace(space.id)}
                onToggleEdit={() => {
                  setCreating(false);
                  setEditingSpaceId((prev) =>
                    prev === space.id ? null : space.id,
                  );
                }}
              />
            ))}

            <button
              type="button"
              onClick={() => {
                setEditingSpaceId(null);
                setCreating((prev) => !prev);
              }}
              className={cn(
                'ml-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-control border border-dashed px-2 text-[11px] font-medium transition-colors cursor-pointer',
                creating
                  ? 'border-border bg-elevated text-fg'
                  : 'border-hairline text-fg-muted hover:border-border hover:text-fg',
              )}
            >
              <Plus className="h-3 w-3" />
              <span>New Space</span>
            </button>
          </div>

          <SpaceBarControls
            activeViewMode={activeViewMode}
            activeGroupBy={activeGroupBy}
            hideChecked={hideChecked}
            checkedCountInSpace={checkedCountInSpace}
            collectionCount={activeSpaceCollections.length}
            allCollapsed={allSpaceCollectionsCollapsed}
            onSetViewMode={handleSetViewMode}
            onSetGroupBy={handleSetGroupBy}
            onToggleHideChecked={handleToggleHideChecked}
            onToggleAllCollapsed={handleToggleAllCollapsed}
          />
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
