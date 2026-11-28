import {
  type DragEndEvent,
  type DragOverEvent,
  KeyboardSensor,
  PointerSensor,
} from '@dnd-kit/react';

export const WORKBENCH_SENSORS = [
  PointerSensor.configure({
    preventActivation: (event, source) => {
      const { target } = event;
      if (!(target instanceof Element)) return false;
      if (target.closest('[data-dnd-no-drag="true"]')) return true;
      if (target.closest('input, textarea, select')) return true;
      if (source.handle?.contains(target)) return false;
      return false;
    },
  }),
  KeyboardSensor,
];

import { isSortable } from '@dnd-kit/react/sortable';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { getPreferredScrollBehavior } from '@/hooks/use-workbench-shortcuts';
import { playDrop, playError, playPickup } from '@/lib/audio/foley';
import { isDragItemData, isDropTargetData } from '@/lib/dnd/types';
import { stashRepo } from '@/lib/storage/repo';
import type { OpenTabInfo } from '@/lib/tabs/session-filter';
import { triggerAutoTagSingleLink } from '@/lib/tagging/trigger-auto-tag';
import {
  type Collection,
  DEFAULT_SPACE_ID,
  type LinkItem,
  type MotionMode,
} from '@/lib/types/stash';
import {
  moveOrReorderLinkInList,
  reorderCollectionsList,
} from '@/lib/utils/ordering';
import { spawnSlamForElement } from '@/lib/vfx/engine';
import { useFxStore } from '@/store/fx-store';
import { useUiStore } from '@/store/ui-store';

interface UseWorkbenchDndOptions {
  soundEffects: boolean;
  motionMode: MotionMode;
  fxDeskJolt?: boolean;
  onSwitchSpace: (spaceId: string) => void;
  onOptimisticCollections?: (
    updater: (prev: Collection[]) => Collection[],
  ) => void;
  onOptimisticLinks?: (updater: (prev: LinkItem[]) => LinkItem[]) => void;
}

/**
 * Encapsulates drag-and-drop & quick-stash handlers for the New Tab workbench.
 */
export function useWorkbenchDnd({
  soundEffects,
  motionMode,
  fxDeskJolt = true,
  onSwitchSpace,
  onOptimisticCollections,
  onOptimisticLinks,
}: UseWorkbenchDndOptions) {
  const pulseLink = useUiStore((s) => s.pulseLink);
  const settleLink = useUiStore((s) => s.settleLink);
  const dismissPreview = useUiStore((s) => s.dismissPreview);
  const triggerSettledImpact = useFxStore((s) => s.triggerSettledImpact);
  const triggerSpaceSwallow = useFxStore((s) => s.triggerSpaceSwallow);
  const setDragInsertTarget = useFxStore((s) => s.setDragInsertTarget);
  const triggerContainerShake = useFxStore((s) => s.triggerContainerShake);

  const fireDropImpactLockstep = useCallback(
    (linkId: string, collectionId: string, waitForNewMount = false) => {
      const fireAll = (el: Element | null) => {
        playDrop(soundEffects, motionMode);
        settleLink(linkId);
        triggerSettledImpact(linkId, collectionId);
        if (motionMode === 'arcade') {
          if (fxDeskJolt) {
            triggerContainerShake('combo');
          }
          spawnSlamForElement(el);
        }
      };

      if (
        typeof document === 'undefined' ||
        typeof requestAnimationFrame !== 'function'
      ) {
        fireAll(null);
        return;
      }

      const selector = `[data-link-id="${CSS.escape(linkId)}"]`;

      if (waitForNewMount) {
        // Brand-new card (Open Tab stash): fire on the very first painted frame
        // the card appears in the destination collection (zero dead gap).
        let attempts = 0;
        const pollMount = () => {
          const el = document.querySelector(selector);
          if (el && el.getBoundingClientRect().width > 0) {
            fireAll(el);
            return;
          }
          attempts += 1;
          if (attempts < 15) {
            requestAnimationFrame(pollMount);
          } else {
            fireAll(null);
          }
        };
        requestAnimationFrame(pollMount);
        return;
      }

      // Existing card reorder/move: wait 2 frames so @dnd-kit flips isDragging -> false
      // and LinkCard mounts its resting DOM before isSettling transitions true.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fireAll(document.querySelector(selector));
        });
      });
    },
    [
      fxDeskJolt,
      motionMode,
      settleLink,
      soundEffects,
      triggerContainerShake,
      triggerSettledImpact,
    ],
  );

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
        el?.scrollIntoView({
          behavior: getPreferredScrollBehavior(),
          block: 'center',
        });
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
        if (result.reason === 'duplicate') {
          await revealDuplicate(result.existingLink.id, collectionId);
        }
        return;
      }

      // Never block the drop impact behind expanding or auto-tagging;
      // fire lockstep slam on the very first frame the new card mounts.
      fireDropImpactLockstep(result.link.id, collectionId, true);
      void stashRepo.updateCollection(collectionId, { collapsed: false });
      toast.success(`Stashed "${result.link.title}"`);
      void triggerAutoTagSingleLink(result.link.id);
    },
    [revealDuplicate, fireDropImpactLockstep],
  );

  const handleDragStart = useCallback(() => {
    dismissPreview();
    playPickup(soundEffects);
  }, [dismissPreview, soundEffects]);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { source, target } = event.operation;
      if (!source || !target) {
        setDragInsertTarget(null);
        return;
      }
      if (
        isSortable(source) &&
        isSortable(target) &&
        source.group !== target.group
      ) {
        // Prevent @dnd-kit OptimisticSortingPlugin from physically reparenting
        // React-owned DOM nodes across different collection containers, which
        // causes React reconciliation to throw NotFoundError on removeChild.
        event.preventDefault();
      }

      const sourceData = source.data;
      const targetData = target.data;
      if (!isDragItemData(sourceData) || !isDropTargetData(targetData)) {
        setDragInsertTarget(null);
        return;
      }

      const isExternalInsertion =
        sourceData.kind === 'open-tab' ||
        (sourceData.kind === 'link' &&
          ((targetData.kind === 'link' &&
            sourceData.collectionId !== targetData.collectionId) ||
            (targetData.kind === 'collection-drop' &&
              sourceData.collectionId !== targetData.collectionId)));

      if (!isExternalInsertion) {
        setDragInsertTarget(null);
        return;
      }

      if (targetData.kind === 'link') {
        setDragInsertTarget({
          collectionId: targetData.collectionId,
          index: targetData.index,
        });
      } else if (targetData.kind === 'collection-drop') {
        setDragInsertTarget({
          collectionId: targetData.collectionId,
          index: -1,
        });
      } else {
        setDragInsertTarget(null);
      }
    },
    [setDragInsertTarget],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDragInsertTarget(null);
      if (event.canceled) return;
      const { source, target } = event.operation;
      if (!source) return;

      const sourceData = source.data;
      if (!isDragItemData(sourceData)) return;

      const playCardLanding = (linkId: string, collectionId: string) => {
        fireDropImpactLockstep(linkId, collectionId);
      };

      const targetData = target?.data;
      if (!target || !isDropTargetData(targetData)) {
        // Silence invalid / outside-zone drops cleanly (no audio or VFX impact)
        return;
      }

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
              playDrop(soundEffects, motionMode);
              triggerSpaceSwallow(spaceId, '+1 col');
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
            triggerSpaceSwallow(spaceId, '+1');
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
              triggerSpaceSwallow(spaceId, '+1');
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

      // 1. Reorder collections vertically within the active Space's slice
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
          const scopeSpaceId =
            sourceData.collection.spaceId ?? DEFAULT_SPACE_ID;
          const ts = new Date().toISOString();
          onOptimisticCollections?.((prev) =>
            reorderCollectionsList(
              prev,
              sourceData.collection.id,
              nextIndex,
              ts,
              scopeSpaceId,
            ),
          );
          void stashRepo.reorderCollections(
            sourceData.collection.id,
            nextIndex,
            scopeSpaceId,
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
          const ts = new Date().toISOString();
          onOptimisticLinks?.((prev) => {
            const optimistic = moveOrReorderLinkInList(
              prev,
              sourceData.link.id,
              targetCollectionId,
              targetIndex,
              ts,
            );
            return optimistic.ok ? optimistic.links : prev;
          });
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
            playCardLanding(sourceData.link.id, targetCollectionId);
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
          } else {
            playCardLanding(sourceData.link.id, sourceData.collectionId);
          }
          return;
        }

        if (targetData.kind === 'collection-drop') {
          if (sourceData.collectionId !== targetData.collectionId) {
            void moveLink(targetData.collectionId);
          } else if (isSortable(source) && source.index !== sourceData.index) {
            void moveLink(sourceData.collectionId, source.index);
          } else {
            playCardLanding(sourceData.link.id, sourceData.collectionId);
          }
        }
      }
    },
    [
      handleQuickStashTab,
      revealDuplicate,
      fireDropImpactLockstep,
      soundEffects,
      motionMode,
      settleLink,
      triggerSpaceSwallow,
      setDragInsertTarget,
      onSwitchSpace,
      onOptimisticCollections,
      onOptimisticLinks,
    ],
  );

  return {
    handleQuickStashTab,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
