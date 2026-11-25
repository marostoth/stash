import type * as React from 'react';
import { useEffect } from 'react';
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

interface UseWorkbenchShortcutsOptions {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  hoverPreviews: boolean;
}

/**
 * Global keyboard shortcuts for the Stash New Tab workbench:
 * - Ctrl/Cmd+K or `/`: focus live search
 * - Space: immediately open hovered link preview
 * - Esc: dismiss preview, clear search, or clear active Starred filter
 */
export function useWorkbenchShortcuts({
  searchInputRef,
  hoverPreviews,
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

      if (
        event.key === ' ' &&
        hoverPreviews &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isEditableElement(event.target)
      ) {
        const ui = useUiStore.getState();
        const modalOpen =
          ui.collectionModal !== null ||
          ui.linkModal !== null ||
          ui.settingsOpen ||
          ui.healthCheckOpen ||
          ui.reorganizeOpen ||
          ui.triageOpen;
        if (!modalOpen && ui.hoveredPreviewCandidate) {
          event.preventDefault();
          ui.openPreviewImmediate(ui.hoveredPreviewCandidate);
          return;
        }
      }

      if (event.key === 'Escape') {
        const ui = useUiStore.getState();
        if (ui.activePreview) {
          ui.dismissPreview();
          return;
        }
        if (document.activeElement === searchInputRef.current) {
          if (ui.searchQuery) {
            ui.setSearchQuery('');
            return;
          }
          searchInputRef.current?.blur();
          if (ui.starredOnly) {
            ui.setStarredOnly(false);
          }
          return;
        }
        const modalOpen =
          ui.collectionModal !== null ||
          ui.linkModal !== null ||
          ui.settingsOpen ||
          ui.healthCheckOpen ||
          ui.reorganizeOpen ||
          ui.triageOpen;
        if (!modalOpen && ui.starredOnly) {
          ui.setStarredOnly(false);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hoverPreviews, searchInputRef]);
}
