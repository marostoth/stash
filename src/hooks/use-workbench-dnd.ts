import type { DragEndEvent } from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { playDrop, playError, playPickup } from '@/lib/audio/foley';
import { isDragItemData, isDropTargetData } from '@/lib/dnd/types';
import { stashRepo } from '@/lib/storage/repo';
import type { OpenTabInfo } from '@/lib/tabs/session-filter';
import { triggerAutoTagSingleLink } from '@/lib/tagging/trigger-auto-tag';
import { DEFAULT_SPACE_ID, type MotionMode } from '@/lib/types/stash';
import { useUiStore } from '@/store/ui-store';

interface UseWorkbenchDndOptions {
  soundEffects: boolean;
  motionMode: MotionMode;
  onSwitchSpace: (spaceId: string) => void;
}

/**
 * Encapsulates drag-and-drop & quick-stash handlers for the New Tab workbench.
 */
export function useWorkbenchDnd({
  soundEffects,
  motionMode,
  onSwitchSpace,
}: UseWorkbenchDndOptions) {
  const pulseLink = useUiStore((s) => s.pulseLink);
  const settleLink = useUiStore((s) => s.settleLink);
  const dismissPreview = useUiStore((s) => s.dismissPreview);

  const revealDuplicate = useCallback(
    async (existingLinkId: string, targetCollectionId: string) => {
      await stashRepo.updateCollection(targetCollectionId, {
        collapsed: false,
      });
      pulseLink(existingLinkId);
      playError(soundEffects);
      toast.info('Already in this collection');
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-link-id="${CSS.escape(existingLinkId)}"]`,
        );
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
    [pulseLink, soundEffects],
  );

  const handleQuickStashTab = useCallback(
    async (tab: OpenTabInfo, collectionId: string, targetIndex?: number) => {
      const result = await stashRepo.addLink(
        {
          collectionId,
          url: tab.url,
          title: tab.title,
          faviconUrl: tab.favIconUrl,
        },
        targetIndex,
      );

      if (!result.ok) {
        await revealDuplicate(result.existingLink.id, collectionId);
        return;
      }

      await stashRepo.updateCollection(collectionId, { collapsed: false });
      playDrop(soundEffects, motionMode);
      settleLink(result.link.id);
      toast.success(`Stashed "${result.link.title}"`);
      void triggerAutoTagSingleLink(result.link.id);
    },
    [revealDuplicate, motionMode, soundEffects, settleLink],
  );

  const handleDragStart = useCallback(() => {
    dismissPreview();
    playPickup(soundEffects);
  }, [dismissPreview, soundEffects]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.canceled) return;
      const { source, target } = event.operation;
      if (!source || !target) return;

      const sourceData = source.data;
      const targetData = target.data;
      if (!isDragItemData(sourceData) || !isDropTargetData(targetData)) return;

      // 0. Drop link, open tab, or collection directly onto a Space pill
      if (targetData.kind === 'space-drop') {
        const { spaceId, spaceName } = targetData;

        if (sourceData.kind === 'collection') {
          const currentSpaceId =
            sourceData.collection.spaceId ?? DEFAULT_SPACE_ID;
          if (currentSpaceId === spaceId) return;
          void stashRepo
            .moveCollectionToSpace(sourceData.collection.id, spaceId)
            .then((moved) => {
              if (!moved) return;
              playDrop(soundEffects);
              toast.success(`Moved "${moved.name}" to ${spaceName}`, {
                action: {
                  label: 'Open Space',
                  onClick: () => onSwitchSpace(spaceId),
                },
              });
            });
          return;
        }

        if (sourceData.kind === 'open-tab') {
          void (async () => {
            const inbox = await stashRepo.getOrCreateSpaceInbox(spaceId);
            const result = await stashRepo.addLink({
              collectionId: inbox.id,
              url: sourceData.tab.url,
              title: sourceData.tab.title,
              faviconUrl: sourceData.tab.favIconUrl,
            });
            if (!result.ok) {
              playError(soundEffects);
              toast.info(`Already in ${spaceName} → ${inbox.name}`);
              return;
            }
            playDrop(soundEffects, motionMode);
            settleLink(result.link.id);
            toast.success(`Stashed to ${spaceName} → ${inbox.name}`, {
              action: {
                label: 'Open Space',
                onClick: () => onSwitchSpace(spaceId),
              },
            });
            void triggerAutoTagSingleLink(result.link.id);
          })();
          return;
        }

        if (sourceData.kind === 'link') {
          void (async () => {
            const inbox = await stashRepo.getOrCreateSpaceInbox(spaceId);
            if (sourceData.collectionId === inbox.id) return;
            const result = await stashRepo.moveOrReorderLink(
              sourceData.link.id,
              inbox.id,
            );
            if (!result.ok && result.reason === 'duplicate') {
              playError(soundEffects);
              toast.info(`Already in ${spaceName} → ${inbox.name}`);
              return;
            }
            if (result.ok) {
              playDrop(soundEffects, motionMode);
              settleLink(sourceData.link.id);
              toast.success(`Moved to ${spaceName} → ${inbox.name}`, {
                action: {
                  label: 'Open Space',
                  onClick: () => onSwitchSpace(spaceId),
                },
              });
            }
          })();
          return;
        }
      }

      // 1. Reorder collections vertically
      if (
        sourceData.kind === 'collection' &&
        targetData.kind === 'collection'
      ) {
        const nextIndex =
          isSortable(source) && source.index !== source.initialIndex
            ? source.index
            : targetData.index;
        if (nextIndex !== sourceData.index) {
          playDrop(soundEffects);
          void stashRepo.reorderCollections(
            sourceData.collection.id,
            nextIndex,
          );
        }
        return;
      }

      // 2. Drop open browser tab onto a specific link card or collection container
      if (sourceData.kind === 'open-tab') {
        if (targetData.kind === 'link') {
          void handleQuickStashTab(
            sourceData.tab,
            targetData.collectionId,
            targetData.index,
          );
          return;
        }
        if (targetData.kind === 'collection-drop') {
          void handleQuickStashTab(sourceData.tab, targetData.collectionId);
        }
        return;
      }

      // 3. Reorder or move a link card within or across collections
      if (sourceData.kind === 'link') {
        const moveLink = async (
          targetCollectionId: string,
          targetIndex?: number,
        ) => {
          const result = await stashRepo.moveOrReorderLink(
            sourceData.link.id,
            targetCollectionId,
            targetIndex,
          );
          if (!result.ok && result.reason === 'duplicate') {
            await revealDuplicate(result.existingLink.id, targetCollectionId);
            return;
          }
          if (result.ok) {
            playDrop(soundEffects);
            settleLink(sourceData.link.id);
          }
        };

        if (targetData.kind === 'link') {
          const isSelfAfterOptimisticMove =
            target.id === source.id && isSortable(source);
          const destCollectionId =
            isSelfAfterOptimisticMove && typeof source.group === 'string'
              ? source.group
              : targetData.collectionId;
          const destIndex = isSelfAfterOptimisticMove
            ? source.index
            : targetData.index;

          const sameCollection = sourceData.collectionId === destCollectionId;
          if (!sameCollection || destIndex !== sourceData.index) {
            void moveLink(destCollectionId, destIndex);
          }
          return;
        }

        if (targetData.kind === 'collection-drop') {
          if (sourceData.collectionId !== targetData.collectionId) {
            void moveLink(targetData.collectionId);
          } else if (isSortable(source) && source.index !== sourceData.index) {
            void moveLink(sourceData.collectionId, source.index);
          }
        }
      }
    },
    [
      handleQuickStashTab,
      revealDuplicate,
      soundEffects,
      motionMode,
      settleLink,
      onSwitchSpace,
    ],
  );

  return { handleQuickStashTab, handleDragStart, handleDragEnd };
}
