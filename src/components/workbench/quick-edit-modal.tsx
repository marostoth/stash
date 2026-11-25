import { Star, Trash2 } from 'lucide-react';
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
import { Input, Select, Textarea } from '@/components/ui/input';
import { SpaceGroupedCollectionOptions } from '@/components/ui/space-grouped-collection-options';
import { Switch } from '@/components/ui/switch';
import { playDrop, playError } from '@/lib/audio/foley';
import { stashRepo } from '@/lib/storage/repo';
import { triggerAutoTagSingleLink } from '@/lib/tagging/trigger-auto-tag';
import type { Collection, Space } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { normalizeInputUrl, parseTagsInput } from '@/lib/utils/url';
import { useUiStore } from '@/store/ui-store';

interface QuickEditModalProps {
  collections: readonly Collection[];
  spaces: readonly Space[];
}

export function QuickEditModal({ collections, spaces }: QuickEditModalProps) {
  const modal = useUiStore((s) => s.linkModal);
  const closeLinkModal = useUiStore((s) => s.closeLinkModal);
  const pulseLink = useUiStore((s) => s.pulseLink);
  const settleLink = useUiStore((s) => s.settleLink);

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [tagsTouched, setTagsTouched] = useState(false);
  const [collectionId, setCollectionId] = useState('');
  const [starred, setStarred] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const isEdit = modal?.mode === 'edit';

  useEffect(() => {
    if (!modal) return;
    setUrlError(null);
    setTagsTouched(false);
    if (modal.mode === 'edit') {
      setUrl(modal.link.url);
      setTitle(modal.link.title);
      setNote(modal.link.note);
      setTagsRaw(modal.link.tags.join(', '));
      setCollectionId(modal.link.collectionId);
      setStarred(Boolean(modal.link.starred));
    } else {
      setUrl('');
      setTitle('');
      setNote('');
      setTagsRaw('');
      setCollectionId(modal.defaultCollectionId || collections[0]?.id || '');
      setStarred(false);
    }
  }, [modal, collections]);

  const parsedTags = parseTagsInput(tagsRaw);

  const revealDuplicateCard = async (
    existingLinkId: string,
    targetCollectionId: string,
  ) => {
    await stashRepo.updateCollection(targetCollectionId, { collapsed: false });
    closeLinkModal();
    pulseLink(existingLinkId);
    playError();
    toast.info('Already in this collection');
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-link-id="${CSS.escape(existingLinkId)}"]`,
      );
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedUrl = normalizeInputUrl(url);
    if (!normalizedUrl) {
      setUrlError('Enter a valid http:// or https:// URL.');
      return;
    }
    if (!collectionId) return;

    if (modal?.mode === 'edit') {
      const tagsChanged =
        tagsTouched ||
        parsedTags.length !== modal.link.tags.length ||
        parsedTags.some((tag, idx) => tag !== modal.link.tags[idx]);

      const result = await stashRepo.updateLink(modal.link.id, {
        collectionId,
        url: normalizedUrl,
        title,
        note,
        tags: parsedTags,
        starred,
        ...(tagsChanged ? { tagsLocked: true } : {}),
      });

      if (!result.ok) {
        if (result.reason === 'duplicate') {
          await revealDuplicateCard(result.existingLink.id, collectionId);
          return;
        }
        toast.error('Could not update link');
        return;
      }

      toast.success('Link updated');
      closeLinkModal();
      return;
    }

    const hasManualTags = parsedTags.length > 0;
    const result = await stashRepo.addLink({
      collectionId,
      url: normalizedUrl,
      title,
      note,
      tags: parsedTags,
      ...(starred ? { starred: true } : {}),
      ...(hasManualTags ? { tagsLocked: true } : {}),
    });

    if (!result.ok) {
      await revealDuplicateCard(result.existingLink.id, collectionId);
      return;
    }

    playDrop();
    settleLink(result.link.id);
    toast.success('Link stashed');
    closeLinkModal();
    if (!hasManualTags) {
      void triggerAutoTagSingleLink(result.link.id);
    }
  };

  const handleDelete = async () => {
    if (modal?.mode !== 'edit') return;
    await stashRepo.deleteLink(modal.link.id);
    toast.success('Link removed');
    closeLinkModal();
  };

  return (
    <Dialog
      open={modal !== null}
      onOpenChange={(open) => {
        if (!open) closeLinkModal();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Quick Edit Link' : 'Add Link'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update title, note, tags, or move this link to another collection.'
              : 'Save a URL with optional context so you remember why it mattered.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
          <div className="space-y-1.5">
            <label
              htmlFor="link-url"
              className="block text-xs font-medium text-fg"
            >
              URL
            </label>
            <Input
              id="link-url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (urlError) setUrlError(null);
              }}
              placeholder="https://example.com/article"
              required
              autoFocus={!isEdit}
              className="font-mono text-xs"
            />
            {urlError && <p className="text-xs text-danger">{urlError}</p>}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="link-title"
              className="block text-xs font-medium text-fg"
            >
              Title{' '}
              <span className="font-normal text-fg-muted">
                (optional — defaults to domain)
              </span>
            </label>
            <Input
              id="link-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Readable title for this card"
              autoFocus={isEdit}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="link-note"
              className="block text-xs font-medium text-fg"
            >
              Why I saved this
            </label>
            <Textarea
              id="link-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Quick note or reminder..."
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="link-tags"
              className="block text-xs font-medium text-fg"
            >
              Tags{' '}
              <span className="font-normal text-fg-muted">
                (comma or space separated)
              </span>
            </label>
            <Input
              id="link-tags"
              value={tagsRaw}
              onChange={(e) => {
                setTagsRaw(e.target.value);
                setTagsTouched(true);
              }}
              placeholder="docs, hardware, reference"
              className="font-mono text-xs"
            />
            {parsedTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {parsedTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-pill border border-border bg-card px-2 py-0.5 font-mono text-[10px] text-fg-muted"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="link-collection"
              className="block text-xs font-medium text-fg"
            >
              Collection
            </label>
            <Select
              id="link-collection"
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              required
            >
              <SpaceGroupedCollectionOptions
                collections={collections}
                spaces={spaces}
              />
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-panel/60 px-3 py-2">
            <label
              htmlFor="link-starred"
              className="flex items-center gap-2 text-xs text-fg select-none cursor-pointer"
            >
              <Star
                className={cn(
                  'h-3.5 w-3.5',
                  starred ? 'fill-accent text-accent' : 'text-fg-muted',
                )}
              />
              <span>Starred / Highlighted</span>
            </label>
            <Switch
              id="link-starred"
              checked={starred}
              onCheckedChange={setStarred}
            />
          </div>

          <DialogFooter className="justify-between">
            {isEdit ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => void handleDelete()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={closeLinkModal}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!url.trim() || !collectionId}
              >
                {isEdit ? 'Save Changes' : 'Add Link'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
