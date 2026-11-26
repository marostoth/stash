import {
  Check,
  ExternalLink,
  FolderInput,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type CSSProperties, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import {
  parseSpaceInboxValue,
  SpaceGroupedCollectionOptions,
} from '@/components/ui/space-grouped-collection-options';
import { playDelete, playDrop, playTagPop } from '@/lib/audio/foley';
import { isTactileMotion, TACTILE_SPRING } from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import { openLinksInNamedTabGroup } from '@/lib/tabs/tab-actions';
import type {
  Collection,
  LinkItem,
  MotionMode,
  Space,
} from '@/lib/types/stash';
import { parseTagsInput } from '@/lib/utils/url';
import { useSelectionStore } from '@/store/selection-store';

interface BulkActionBarProps {
  links: readonly LinkItem[];
  visibleLinkIds: readonly string[];
  collections: readonly Collection[];
  spaces: readonly Space[];
  motionMode: MotionMode;
  soundEffects: boolean;
}

export function BulkActionBar({
  links,
  visibleLinkIds,
  collections,
  spaces,
  motionMode,
  soundEffects,
}: BulkActionBarProps) {
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const selectAll = useSelectionStore((s) => s.selectAll);
  const clearSelection = useSelectionStore((s) => s.clearSelection);

  const [moveTarget, setMoveTarget] = useState('');
  const [tagInputOpen, setTagInputOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');

  useEffect(() => {
    if (selectedIds.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSelection();
        setTagInputOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelection, selectedIds.length]);

  const selectedSet = new Set(selectedIds);
  const selectedLinks = links.filter((l) => selectedSet.has(l.id));
  const count = selectedLinks.length;
  const tactile = isTactileMotion(motionMode);

  const allStarred =
    count > 0 && selectedLinks.every((l) => l.starred === true);
  const allChecked =
    count > 0 && selectedLinks.every((l) => l.checked === true);

  const handleBulkMove = async (rawValue: string) => {
    setMoveTarget('');
    if (!rawValue || count === 0) return;

    const spaceForInbox = parseSpaceInboxValue(rawValue);
    const targetCollectionId = spaceForInbox
      ? (await stashRepo.getOrCreateSpaceInbox(spaceForInbox)).id
      : rawValue;

    const { movedCount, skippedDuplicates } =
      await stashRepo.moveLinksToCollection(selectedIds, targetCollectionId);
    if (movedCount > 0) {
      playDrop(soundEffects, motionMode);
      toast.success(
        skippedDuplicates > 0
          ? `Moved ${movedCount} link${movedCount === 1 ? '' : 's'} (${skippedDuplicates} duplicate${skippedDuplicates === 1 ? '' : 's'} skipped)`
          : `Moved ${movedCount} link${movedCount === 1 ? '' : 's'}`,
      );
      clearSelection();
    } else if (skippedDuplicates > 0) {
      toast.info('Selected links already exist in that collection');
    }
  };

  const handleBulkTag = async (event: React.FormEvent) => {
    event.preventDefault();
    const tags = parseTagsInput(tagDraft);
    if (tags.length === 0) return;
    const updated = await stashRepo.addTagsToLinks(selectedIds, tags);
    setTagDraft('');
    setTagInputOpen(false);
    if (updated > 0) {
      playTagPop(soundEffects, motionMode);
      toast.success(
        `Tagged ${updated} link${updated === 1 ? '' : 's'} with ${tags.map((t) => `#${t}`).join(' ')}`,
      );
    }
  };

  const handleBulkStar = async () => {
    const nextStarred = !allStarred;
    const changed = await stashRepo.setLinksStarred(selectedIds, nextStarred);
    if (changed.length > 0 && nextStarred) {
      playTagPop(soundEffects, motionMode);
    }
    toast.success(
      nextStarred
        ? `Starred ${changed.length} link${changed.length === 1 ? '' : 's'}`
        : `Unstarred ${changed.length} link${changed.length === 1 ? '' : 's'}`,
    );
  };

  const handleBulkCheck = async () => {
    const nextChecked = !allChecked;
    const changed = await stashRepo.setLinksChecked(selectedIds, nextChecked);
    if (changed.length > 0 && nextChecked) {
      playTagPop(soundEffects, motionMode);
    }
    toast.success(
      nextChecked
        ? `Marked ${changed.length} done`
        : `Unchecked ${changed.length} link${changed.length === 1 ? '' : 's'}`,
    );
  };

  const handleBulkOpen = async () => {
    const opened = await openLinksInNamedTabGroup(
      `Selected (${count})`,
      selectedLinks,
    );
    if (opened > 0) {
      toast.success(`Opened ${opened} tab${opened === 1 ? '' : 's'}`);
      clearSelection();
    }
  };

  const handleBulkDelete = async () => {
    const removed = await stashRepo.deleteLinks(selectedIds);
    if (removed.length === 0) return;
    playDelete(soundEffects);
    clearSelection();
    toast(`Deleted ${removed.length} link${removed.length === 1 ? '' : 's'}`, {
      duration: 6000,
      className: 'stash-undo-toast',
      style: { '--stash-toast-duration': '6000ms' } as CSSProperties,
      action: {
        label: 'Undo',
        onClick: () => {
          void stashRepo.restoreLinks(removed).then((restored) => {
            if (restored.length > 0) playDrop(soundEffects, motionMode);
          });
        },
      },
    });
  };

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          key="bulk-action-bar"
          initial={
            tactile ? { y: 44, opacity: 0, scale: 0.96 } : { opacity: 0 }
          }
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={tactile ? { y: 36, opacity: 0, scale: 0.97 } : { opacity: 0 }}
          transition={tactile ? TACTILE_SPRING : { duration: 0.1 }}
          className="fixed bottom-5 left-1/2 z-40 flex max-w-[94vw] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-card border border-accent/60 bg-panel/95 px-3 py-2 shadow-2xl backdrop-blur-md"
        >
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-accent px-2 py-0.5 font-mono text-[11px] font-semibold text-accent-fg tabular-nums">
            {count} selected
          </span>

          {visibleLinkIds.length > count && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => selectAll(visibleLinkIds)}
              className="h-7 px-2 text-[11px] text-fg-muted hover:text-fg"
            >
              All ({visibleLinkIds.length})
            </Button>
          )}

          <div className="mx-0.5 h-4 w-px bg-border" />

          {/* Move to Collection / Space */}
          <div className="relative inline-flex items-center">
            <FolderInput className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-accent" />
            <Select
              aria-label="Move selected links to collection"
              value={moveTarget}
              onChange={(e) => void handleBulkMove(e.target.value)}
              className="h-7 w-36 pl-7 pr-2 text-[11px]"
            >
              <option value="">Move to...</option>
              <SpaceGroupedCollectionOptions
                spaces={spaces}
                collections={collections}
                allowSpaceInbox
              />
            </Select>
          </div>

          {/* Bulk Add Tag */}
          {tagInputOpen ? (
            <form
              onSubmit={(e) => void handleBulkTag(e)}
              className="flex items-center gap-1"
            >
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="tag1, tag2..."
                autoFocus
                className="h-7 w-28 font-mono text-[11px]"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="h-7 px-2 text-[11px]"
              >
                Add
              </Button>
            </form>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setTagInputOpen(true)}
              className="h-7 gap-1 px-2 text-[11px]"
            >
              <Tag className="h-3 w-3" />
              <span>Tag</span>
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleBulkStar()}
            className="h-7 gap-1 px-2 text-[11px]"
          >
            <Star
              className={
                allStarred ? 'h-3 w-3 fill-accent text-accent' : 'h-3 w-3'
              }
            />
            <span>{allStarred ? 'Unstar' : 'Star'}</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleBulkCheck()}
            className="h-7 gap-1 px-2 text-[11px]"
          >
            <Check className="h-3 w-3 text-accent" />
            <span>{allChecked ? 'Uncheck' : 'Done'}</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleBulkOpen()}
            className="h-7 gap-1 px-2 text-[11px]"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">Open</span>
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={() => void handleBulkDelete()}
            className="h-7 gap-1 px-2 text-[11px]"
          >
            <Trash2 className="h-3 w-3" />
            <span className="hidden sm:inline">Delete</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={clearSelection}
            aria-label="Clear selection"
            title="Clear selection (Esc)"
            className="h-7 w-7 text-fg-muted hover:text-fg"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
