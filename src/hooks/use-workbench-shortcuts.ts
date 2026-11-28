import type * as React from 'react';
import { useEffect } from 'react';
import { stashRepo } from '@/lib/storage/repo';
import type { LinkItem, Space } from '@/lib/types/stash';
import { toSafeHref } from '@/lib/utils/url';
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

export function isAnyModalOpen(): boolean {
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

export function getPreferredScrollBehavior(): ScrollBehavior {
  if (typeof document !== 'undefined') {
    const mode = document.documentElement.dataset.motion;
    if (mode === 'off' || mode === 'reduced') return 'auto';
  }
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 'auto';
  }
  return 'smooth';
}

function scrollLinkCardIntoView(linkId: string): void {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(
      `[data-link-id="${CSS.escape(linkId)}"]`,
    );
    el?.scrollIntoView({
      behavior: getPreferredScrollBehavior(),
      block: 'nearest',
    });
  });
}

export function useOmniboxSearchHydration(
  searchInputRef: React.RefObject<HTMLInputElement | null>,
): void {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get('q')?.trim();
    if (!initialQuery) return;
    useUiStore.getState().setSearchQuery(initialQuery);
    params.delete('q');
    const cleanSearch = params.toString();
    const nextUrl = `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
    searchInputRef.current?.focus();
  }, [searchInputRef]);
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
      // Respect capture-phase Escape handlers (popovers, drags, Clear Tabs) and
      // @dnd-kit keyboard sensor keys that already handled this keydown event.
      if (event.defaultPrevented) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        if (isAnyModalOpen()) return;
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
        !isEditableElement(event.target) &&
        !isAnyModalOpen()
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
            const safeUrl = toSafeHref(targetLink.url);
            if (!safeUrl) return;
            ui.dismissPreview();
            void stashRepo.markLinkOpened(targetLink.id);
            if (openLinkInNewTab) {
              window.open(safeUrl, '_blank', 'noopener,noreferrer');
            } else {
              window.location.assign(safeUrl);
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
          if (ui.selectedTags.length > 0) {
            ui.clearSelectedTags();
          }
          return;
        }
        if (!modalOpen) {
          if (ui.keyboardFocusedLinkId) {
            ui.setKeyboardFocusedLinkId(null);
            return;
          }
          if (
            ui.starredOnly ||
            ui.smartFilter !== 'all' ||
            ui.selectedTags.length > 0
          ) {
            if (ui.starredOnly) ui.setStarredOnly(false);
            if (ui.smartFilter !== 'all') ui.setSmartFilter('all');
            if (ui.selectedTags.length > 0) ui.clearSelectedTags();
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
