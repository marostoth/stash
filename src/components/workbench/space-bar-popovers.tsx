import { Check, Layers, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { filterIconCatalog } from '@/lib/icons/catalog';
import { getCuratedCollectionIcon } from '@/lib/themes/collection-icons';
import type { CardDensity, Space } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

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

interface CreateSpacePopoverProps {
  wideBoard: boolean;
  onCreate: (name: string, icon: string) => Promise<void>;
  onCancel: () => void;
}

export function CreateSpacePopover({
  wideBoard,
  onCreate,
  onCancel,
}: CreateSpacePopoverProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('shopping-bag');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    await onCreate(name.trim(), icon);
  };

  return (
    <div className="border-t border-border bg-panel/95 px-5 py-3 shadow-lg sm:px-8">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className={cn(
          'mx-auto flex flex-wrap items-center gap-2.5',
          wideBoard ? 'max-w-[1720px]' : 'max-w-[1320px]',
        )}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Space name (e.g. Reorders, Work, Homelab)..."
          className="h-8 w-56 text-xs"
          autoFocus
          required
        />
        <div className="flex flex-wrap items-center gap-1">
          {QUICK_SPACE_ICONS.map((key) => {
            const IconComp = getCuratedCollectionIcon(key) ?? Layers;
            const selected = icon === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setIcon(key)}
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
            disabled={!name.trim()}
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
            onClick={onCancel}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </form>
    </div>
  );
}

interface EditSpacePopoverProps {
  space: Space;
  canDelete: boolean;
  collectionCount: number;
  wideBoard: boolean;
  onSave: (patch: {
    name: string;
    icon: string | null;
    densityOverride: CardDensity | null;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

export function EditSpacePopover({
  space,
  canDelete,
  collectionCount,
  wideBoard,
  onSave,
  onDelete,
  onClose,
}: EditSpacePopoverProps) {
  const [name, setName] = useState(space.name);
  const [icon, setIcon] = useState(space.icon ?? '');
  const [density, setDensity] = useState<string>(space.densityOverride ?? '');
  const [iconQuery, setIconQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const filteredIcons = useMemo(
    () => filterIconCatalog(iconQuery).slice(0, 16),
    [iconQuery],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    await onSave({
      name: name.trim(),
      icon: icon || null,
      densityOverride: density ? (density as CardDensity) : null,
    });
  };

  const handleDeleteClick = async () => {
    if (!canDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete();
  };

  return (
    <div className="border-t border-border bg-panel/95 px-5 py-3 shadow-lg sm:px-8">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className={cn(
          'mx-auto space-y-2.5',
          wideBoard ? 'max-w-[1720px]' : 'max-w-[1320px]',
        )}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
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
              value={density}
              onChange={(e) => setDensity(e.target.value)}
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
            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleDeleteClick()}
                className="h-8 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmDelete
                  ? collectionCount > 0
                    ? `Move ${collectionCount} to Main & Delete`
                    : 'Confirm Delete'
                  : 'Delete Space'}
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!name.trim()}
              className="h-8"
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Close space editor"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {filteredIcons.map((entry) => {
            const IconComp = entry.Icon;
            const selected = icon === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => setIcon(entry.key)}
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
  );
}
