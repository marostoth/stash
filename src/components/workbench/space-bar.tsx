import {
  Check,
  Layers,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { filterIconCatalog } from '@/lib/icons/catalog';
import { stashRepo } from '@/lib/storage/repo';
import { getCuratedCollectionIcon } from '@/lib/themes/collection-icons';
import {
  type CardDensity,
  type Collection,
  DEFAULT_SPACE_ID,
  type Space,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface SpaceBarProps {
  spaces: readonly Space[];
  collections: readonly Collection[];
  activeSpaceId: string;
  wideBoard: boolean;
  onSelectSpace: (spaceId: string) => void;
}

const QUICK_SPACE_ICONS = [
  'layers',
  'shopping-bag',
  'briefcase',
  'code',
  'book-open',
  'home',
  'sparkles',
  'bookmark',
  'flame',
  'rocket',
  'wallet',
  'wrench',
] as const;

export function SpaceBar({
  spaces,
  collections,
  activeSpaceId,
  wideBoard,
  onSelectSpace,
}: SpaceBarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('shopping-bag');

  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editDensity, setEditDensity] = useState<string>('');
  const [iconQuery, setIconQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const filteredIcons = useMemo(
    () => filterIconCatalog(iconQuery).slice(0, 16),
    [iconQuery],
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
        setConfirmDelete(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCreating(false);
        setEditingSpaceId(null);
        setConfirmDelete(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [creating, editingSpaceId]);

  const openEditor = (space: Space) => {
    setCreating(false);
    setEditingSpaceId(space.id);
    setEditName(space.name);
    setEditIcon(space.icon ?? '');
    setEditDensity(space.densityOverride ?? '');
    setIconQuery('');
    setConfirmDelete(false);
  };

  const handleCreateSpace = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    const created = await stashRepo.createSpace({
      name: trimmed,
      icon: newIcon || undefined,
    });
    setCreating(false);
    setNewName('');
    onSelectSpace(created.id);
    toast.success(`Created Space "${created.name}"`);
  };

  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingSpace) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    await stashRepo.updateSpace(editingSpace.id, {
      name: trimmed,
      icon: editIcon || null,
      densityOverride: editDensity ? (editDensity as CardDensity) : null,
    });
    setEditingSpaceId(null);
    setConfirmDelete(false);
    toast.success(`Updated Space "${trimmed}"`);
  };

  const handleDeleteSpace = async () => {
    if (!editingSpace || spaces.length <= 1) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const name = editingSpace.name;
    const res = await stashRepo.deleteSpace(editingSpace.id);
    if (!res.deleted) return;
    setEditingSpaceId(null);
    setConfirmDelete(false);
    if (res.fallbackSpaceId) {
      onSelectSpace(res.fallbackSpaceId);
    }
    toast.success(
      res.migratedCollections > 0
        ? `Deleted "${name}" · moved ${res.migratedCollections} collection${res.migratedCollections === 1 ? '' : 's'} to Main`
        : `Deleted Space "${name}"`,
    );
  };

  const editingColCount = editingSpace
    ? (collectionCountBySpace.get(editingSpace.id) ?? 0)
    : 0;

  return (
    <div
      ref={popoverRef}
      className="relative z-20 border-b border-border/80 bg-panel/75 backdrop-blur-xs"
    >
      <div className="px-4 sm:px-6">
        <div
          className={cn(
            'mx-auto flex items-center gap-1 overflow-x-auto py-1.5',
            wideBoard ? 'max-w-[1720px]' : 'max-w-[1320px]',
          )}
        >
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
                    onClick={() =>
                      editingSpaceId === space.id
                        ? setEditingSpaceId(null)
                        : openEditor(space)
                    }
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
              setConfirmDelete(false);
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
      </div>

      {/* Inline Popover: Create Space */}
      {creating && (
        <div className="border-t border-border bg-panel/95 px-4 py-3 shadow-lg sm:px-6">
          <form
            onSubmit={(e) => void handleCreateSpace(e)}
            className={cn(
              'mx-auto flex flex-wrap items-center gap-2.5',
              wideBoard ? 'max-w-[1720px]' : 'max-w-[1320px]',
            )}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Space name (e.g. Reorders, Work, Homelab)..."
              className="h-8 w-56 text-xs"
              autoFocus
              required
            />
            <div className="flex flex-wrap items-center gap-1">
              {QUICK_SPACE_ICONS.map((key) => {
                const IconComp = getCuratedCollectionIcon(key) ?? Layers;
                const selected = newIcon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setNewIcon(key)}
                    aria-label={`Icon ${key}`}
                    aria-pressed={selected}
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-control border transition-colors cursor-pointer',
                      selected
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border bg-canvas text-fg-muted hover:text-fg',
                    )}
                  >
                    <IconComp className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!newName.trim()}
                className="h-8"
              >
                <Check className="h-3.5 w-3.5" />
                Create Space
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Cancel creating space"
                onClick={() => setCreating(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Inline Popover: Edit Active Space */}
      {editingSpace && (
        <div className="border-t border-border bg-panel/95 px-4 py-3 shadow-lg sm:px-6">
          <form
            onSubmit={(e) => void handleSaveEdit(e)}
            className={cn(
              'mx-auto space-y-2.5',
              wideBoard ? 'max-w-[1720px]' : 'max-w-[1320px]',
            )}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                aria-label="Space name"
                placeholder="Space name"
                className="h-8 w-48 text-xs"
                autoFocus
                required
              />
              <div className="flex items-center gap-1.5">
                <label
                  htmlFor="space-density-override"
                  className="font-mono text-[10px] uppercase text-fg-muted"
                >
                  Density
                </label>
                <Select
                  id="space-density-override"
                  value={editDensity}
                  onChange={(e) => setEditDensity(e.target.value)}
                  className="h-8 w-36 text-xs"
                >
                  <option value="">Default</option>
                  <option value="micro">Micro</option>
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                </Select>
              </div>
              <Input
                value={iconQuery}
                onChange={(e) => setIconQuery(e.target.value)}
                placeholder="Filter icons..."
                aria-label="Filter space icons"
                className="h-8 w-36 text-xs"
              />
              <div className="ml-auto flex items-center gap-1.5">
                {spaces.length > 1 && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void handleDeleteSpace()}
                    className="h-8 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {confirmDelete
                      ? editingColCount > 0
                        ? `Move ${editingColCount} to Main & Delete`
                        : 'Confirm Delete'
                      : 'Delete Space'}
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!editName.trim()}
                  className="h-8"
                >
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Close space editor"
                  onClick={() => {
                    setEditingSpaceId(null);
                    setConfirmDelete(false);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {filteredIcons.map((entry) => {
                const IconComp = entry.Icon;
                const selected = editIcon === entry.key;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setEditIcon(entry.key)}
                    title={entry.label}
                    aria-label={entry.label}
                    aria-pressed={selected}
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-control border transition-colors cursor-pointer',
                      selected
                        ? 'border-accent bg-accent/15 text-accent'
                        : 'border-border bg-canvas text-fg-muted hover:text-fg',
                    )}
                  >
                    <IconComp className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
