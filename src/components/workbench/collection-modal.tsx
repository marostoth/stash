import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { autoAssignCollectionIconIfEmpty } from '@/lib/icons/auto-assign-icon';
import { stashRepo } from '@/lib/storage/repo';
import {
  TAB_GROUP_COLOR_SWATCH,
  TAB_GROUP_COLORS,
  type TabGroupColor,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { useUiStore } from '@/store/ui-store';

export function CollectionModal() {
  const modal = useUiStore((s) => s.collectionModal);
  const closeCollectionModal = useUiStore((s) => s.closeCollectionModal);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<TabGroupColor>('green');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = modal?.mode === 'edit';

  useEffect(() => {
    if (!modal) return;
    setConfirmDelete(false);
    if (modal.mode === 'edit') {
      setName(modal.collection.name);
      setDescription(modal.collection.description ?? '');
      setColor(modal.collection.color);
    } else {
      setName('');
      setDescription('');
      setColor('green');
    }
  }, [modal]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    if (modal?.mode === 'edit') {
      await stashRepo.updateCollection(modal.collection.id, {
        name: trimmed,
        description,
        color,
      });
      toast.success(`Updated "${trimmed}"`);
    } else {
      const created = await stashRepo.createCollection({
        name: trimmed,
        description,
        color,
      });
      toast.success(`Created "${trimmed}"`);
      void autoAssignCollectionIconIfEmpty(created.id, created.name);
    }

    closeCollectionModal();
  };

  const handleDelete = async () => {
    if (modal?.mode !== 'edit') return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await stashRepo.deleteCollection(modal.collection.id);
    toast.success(`Deleted "${modal.collection.name}"`);
    closeCollectionModal();
  };

  return (
    <Dialog
      open={modal !== null}
      onOpenChange={(open) => {
        if (!open) closeCollectionModal();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Collection' : 'New Collection'}
          </DialogTitle>
          <DialogDescription>
            Group related links with a color that maps directly to Chrome Tab
            Groups.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="collection-name"
              className="block text-xs font-medium text-fg"
            >
              Name
            </label>
            <Input
              id="collection-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 3D Printing, Electronics, Reading"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="collection-desc"
              className="block text-xs font-medium text-fg"
            >
              Description{' '}
              <span className="font-normal text-fg-muted">(optional)</span>
            </label>
            <Input
              id="collection-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short context for this group of links"
            />
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-fg">
              Tab Group Color
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {TAB_GROUP_COLORS.map((swatchColor) => {
                const selected = color === swatchColor;
                return (
                  <button
                    key={swatchColor}
                    type="button"
                    aria-label={`Color ${swatchColor}`}
                    aria-pressed={selected}
                    onClick={() => setColor(swatchColor)}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full border transition-transform hover:scale-110 cursor-pointer',
                      selected
                        ? 'border-fg ring-2 ring-accent/50'
                        : 'border-border',
                    )}
                  >
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{
                        backgroundColor: TAB_GROUP_COLOR_SWATCH[swatchColor],
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="justify-between">
            {isEdit ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleDelete()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmDelete ? 'Confirm Delete' : 'Delete'}
              </Button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={closeCollectionModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!name.trim()}
              >
                {isEdit ? 'Save Changes' : 'Create Collection'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
