import type * as React from 'react';
import { useEffect } from 'react';
import { stashRepo } from '@/lib/storage/repo';
import type { LinkItem, Space } from '@/lib/types/stash';
import { useUiStore } from '@/store/ui-store';

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

function isAnyModalOpen(): boolean {
  const ui = useUiStore.getState();
  return (
    ui.collectionModal !== null ||
    ui.linkModal !== null ||
    ui.settingsOpen ||
    ui.healthCheckOpen ||
    ui.reorganizeOpen ||
    ui.triageOpen
  );
}

function scrollLinkCardIntoView(linkId: string): void {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(
      `[data-link-id="${CSS.escape(linkId)}"]`,
    );
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

interface UseWorkbenchShortcutsOptions {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  hoverPreviews: boolean;
  visibleLinks: readonly LinkItem[];
  spaces: readonly Space[];
  openLinkInNewTab: boolean;
  onSelectSpace?: (spaceId: string) => void;
}

/**
 * Global keyboard shortcuts for the Stash New Tab workbench:
 * - Ctrl/Cmd+K or `/`: focus live search
 * - 1–9: switch active Space directly (with directional slide)
 * - ArrowDown / ArrowUp / ArrowLeft / ArrowRight: glide keyboard spotlight across visible links
 * - Enter: open the highlighted link card immediately
 * - Space: immediately open hovered link preview
 * - ?: toggle Keyboard Shortcuts panel
 * - Esc: dismiss preview, clear search/spotlight, or reset Starred & Smart Views
 */
export function useWorkbenchShortcuts({
  searchInputRef,
  hoverPreviews,
  visibleLinks,
  spaces,
  openLinkInNewTab,
  onSelectSpace,
}: UseWorkbenchShortcutsOptions): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (
        event.key === '?' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isEditableElement(event.target)
      ) {
        const ui = useUiStore.getState();
        const otherModalOpen =
          ui.collectionModal !== null ||
          ui.linkModal !== null ||
          ui.healthCheckOpen ||
          ui.reorganizeOpen ||
          ui.triageOpen;
        if (otherModalOpen) return;

        if (ui.settingsOpen && ui.settingsTab === 'shortcuts') {
          event.preventDefault();
          ui.closeSettings();
          return;
        }
        if (!ui.settingsOpen) {
          event.preventDefault();
          ui.openSettings('shortcuts');
          return;
        }
        return;
      }

      if (
        event.key === '/' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isEditableElement(event.target)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (
        event.key >= '1' &&
        event.key <= '9' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isEditableElement(event.target) &&
        !isAnyModalOpen()
      ) {
        const targetSpace = spaces[Number(event.key) - 1];
        if (targetSpace) {
          event.preventDefault();
          if (onSelectSpace) {
            onSelectSpace(targetSpace.id);
          } else {
            useUiStore.getState().setActiveSpaceId(targetSpace.id);
          }
          return;
        }
      }

      const ui = useUiStore.getState();
      const modalOpen = isAnyModalOpen();
      const searchFocused = document.activeElement === searchInputRef.current;
      const editableTarget = isEditableElement(event.target);

      if (!modalOpen && visibleLinks.length > 0) {
        const canCycleVertical =
          searchFocused ||
          ui.keyboardFocusedLinkId !== null ||
          (!editableTarget && event.key === 'ArrowDown');
        const canCycleHorizontal =
          !searchFocused &&
          !editableTarget &&
          ui.keyboardFocusedLinkId !== null;

        const moveForward =
          (canCycleVertical && event.key === 'ArrowDown') ||
          (canCycleHorizontal && event.key === 'ArrowRight');
        const moveBackward =
          (canCycleVertical && event.key === 'ArrowUp') ||
          (canCycleHorizontal && event.key === 'ArrowLeft');

        if (moveForward || moveBackward) {
          event.preventDefault();
          const currentIdx = ui.keyboardFocusedLinkId
            ? visibleLinks.findIndex((l) => l.id === ui.keyboardFocusedLinkId)
            : -1;
          const nextIdx = moveForward
            ? currentIdx < 0
              ? 0
              : (currentIdx + 1) % visibleLinks.length
            : currentIdx <= 0
              ? visibleLinks.length - 1
              : currentIdx - 1;
          const nextLink = visibleLinks[nextIdx];
          if (nextLink) {
            ui.setKeyboardFocusedLinkId(nextLink.id);
            scrollLinkCardIntoView(nextLink.id);
          }
          return;
        }

        if (
          event.key === 'Enter' &&
          ui.keyboardFocusedLinkId &&
          (searchFocused || !editableTarget)
        ) {
          const targetLink = visibleLinks.find(
            (l) => l.id === ui.keyboardFocusedLinkId,
          );
          if (targetLink) {
            event.preventDefault();
            ui.dismissPreview();
            void stashRepo.markLinkOpened(targetLink.id);
            if (openLinkInNewTab) {
              window.open(targetLink.url, '_blank', 'noopener,noreferrer');
            } else {
              window.location.assign(targetLink.url);
            }
            return;
          }
        }
      }

      if (
        event.key === ' ' &&
        hoverPreviews &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !editableTarget
      ) {
        if (!modalOpen && ui.hoveredPreviewCandidate) {
          event.preventDefault();
          ui.openPreviewImmediate(ui.hoveredPreviewCandidate);
          return;
        }
      }

      if (event.key === 'Escape') {
        if (ui.activePreview) {
          ui.dismissPreview();
          return;
        }
        if (searchFocused) {
          if (ui.searchQuery) {
            ui.setSearchQuery('');
            return;
          }
          searchInputRef.current?.blur();
          if (ui.keyboardFocusedLinkId) {
            ui.setKeyboardFocusedLinkId(null);
          }
          if (ui.starredOnly) {
            ui.setStarredOnly(false);
          }
          if (ui.smartFilter !== 'all') {
            ui.setSmartFilter('all');
          }
          return;
        }
        if (!modalOpen) {
          if (ui.keyboardFocusedLinkId) {
            ui.setKeyboardFocusedLinkId(null);
            return;
          }
          if (ui.starredOnly || ui.smartFilter !== 'all') {
            if (ui.starredOnly) ui.setStarredOnly(false);
            if (ui.smartFilter !== 'all') ui.setSmartFilter('all');
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    hoverPreviews,
    onSelectSpace,
    openLinkInNewTab,
    searchInputRef,
    spaces,
    visibleLinks,
  ]);
}
