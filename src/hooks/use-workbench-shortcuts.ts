import type * as React from 'react';
import { useEffect } from 'react';
import { stashRepo } from '@/lib/storage/repo';
import type { LinkItem } from '@/lib/types/stash';
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
  openLinkInNewTab: boolean;
}

/**
 * Global keyboard shortcuts for the Stash New Tab workbench:
 * - Ctrl/Cmd+K or `/`: focus live search
 * - ArrowDown / ArrowUp: cycle keyboard focus across visible link cards
 * - Enter: open the highlighted link card immediately
 * - Space: immediately open hovered link preview
 * - Esc: dismiss preview, clear search/highlight, or clear active Starred filter
 */
export function useWorkbenchShortcuts({
  searchInputRef,
  hoverPreviews,
  visibleLinks,
  openLinkInNewTab,
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

      const ui = useUiStore.getState();
      const modalOpen = isAnyModalOpen();
      const searchFocused = document.activeElement === searchInputRef.current;

      if (
        !modalOpen &&
        visibleLinks.length > 0 &&
        (searchFocused || ui.keyboardFocusedLinkId !== null)
      ) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const currentIdx = ui.keyboardFocusedLinkId
            ? visibleLinks.findIndex((l) => l.id === ui.keyboardFocusedLinkId)
            : -1;
          const nextIdx =
            event.key === 'ArrowDown'
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

        if (event.key === 'Enter' && ui.keyboardFocusedLinkId) {
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
        !isEditableElement(event.target)
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
          return;
        }
        if (!modalOpen) {
          if (ui.keyboardFocusedLinkId) {
            ui.setKeyboardFocusedLinkId(null);
            return;
          }
          if (ui.starredOnly) {
            ui.setStarredOnly(false);
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hoverPreviews, openLinkInNewTab, searchInputRef, visibleLinks]);
}
