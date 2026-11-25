import {
  DragDropProvider,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
} from '@dnd-kit/react';
import { isSortable } from '@dnd-kit/react/sortable';
import { SearchX } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Toaster, toast } from 'sonner';
import { HealthCheckModal } from '@/components/HealthCheckModal';
import { ReorganizeModal } from '@/components/reorganize/ReorganizeModal';
import { SettingsModal } from '@/components/settings/settings-modal';
import { Button } from '@/components/ui/button';
import { CollectionModal } from '@/components/workbench/collection-modal';
import { CollectionSection } from '@/components/workbench/collection-section';
import { DragGhost } from '@/components/workbench/drag-ghost';
import { EmptyState } from '@/components/workbench/empty-state';
import { LinkPreviewPopover } from '@/components/workbench/link-preview-popover';
import { OpenTabsSidebar } from '@/components/workbench/open-tabs-sidebar';
import { QuickEditModal } from '@/components/workbench/quick-edit-modal';
import { TopBar } from '@/components/workbench/top-bar';
import { TriageModal } from '@/components/workbench/triage-modal';
import { useOpenTabs } from '@/hooks/use-open-tabs';
import { useStashData } from '@/hooks/use-stash-data';
import { playDrop, playError, playPickup } from '@/lib/audio/foley';
import { isDragItemData, isDropTargetData } from '@/lib/dnd/types';
import { resolveReducedMotionPolicy } from '@/lib/motion/physics';
import { stashRepo } from '@/lib/storage/repo';
import type { OpenTabInfo } from '@/lib/tabs/session-filter';
import { triggerAutoTagSingleLink } from '@/lib/tagging/trigger-auto-tag';
import { groupAndFilterCollections } from '@/lib/utils/search';
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

const WORKBENCH_SENSORS = [
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

export function Workbench() {
  const {
    loading,
    collections,
    links,
    rules,
    settings,
    allThemes,
    activeTheme,
  } = useStashData();
  const { tabs, pinnedTabs, regularTabs } = useOpenTabs();
  const searchQuery = useUiStore((s) => s.searchQuery);
  const setSearchQuery = useUiStore((s) => s.setSearchQuery);
  const pulseLink = useUiStore((s) => s.pulseLink);
  const settleLink = useUiStore((s) => s.settleLink);
  const dismissPreview = useUiStore((s) => s.dismissPreview);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
        settings.hoverPreviews &&
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
          ui.triageCollectionId !== null;
        if (!modalOpen && ui.hoveredPreviewCandidate) {
          event.preventDefault();
          ui.openPreviewImmediate(ui.hoveredPreviewCandidate);
          return;
        }
      }

      if (event.key === 'Escape') {
        if (useUiStore.getState().activePreview) {
          dismissPreview();
          return;
        }
        if (document.activeElement === searchInputRef.current) {
          if (searchQuery) {
            setSearchQuery('');
          } else {
            searchInputRef.current?.blur();
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dismissPreview, searchQuery, setSearchQuery, settings.hoverPreviews]);

  const revealDuplicate = useCallback(
    async (existingLinkId: string, targetCollectionId: string) => {
      await stashRepo.updateCollection(targetCollectionId, {
        collapsed: false,
      });
      pulseLink(existingLinkId);
      playError(settings.soundEffects);
      toast.info('Already in this collection');
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(
          `[data-link-id="${CSS.escape(existingLinkId)}"]`,
        );
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
    [pulseLink, settings.soundEffects],
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
      playDrop(settings.soundEffects, settings.motionMode);
      settleLink(result.link.id);
      toast.success(`Stashed "${result.link.title}"`);
      void triggerAutoTagSingleLink(result.link.id);
    },
    [revealDuplicate, settings.motionMode, settings.soundEffects, settleLink],
  );

  const handleDragStart = useCallback(() => {
    dismissPreview();
    playPickup(settings.soundEffects);
  }, [dismissPreview, settings.soundEffects]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (event.canceled) return;
      const { source, target } = event.operation;
      if (!source || !target) return;

      const sourceData = source.data;
      const targetData = target.data;
      if (!isDragItemData(sourceData) || !isDropTargetData(targetData)) return;

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
          playDrop(settings.soundEffects);
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
            playDrop(settings.soundEffects);
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
    [handleQuickStashTab, revealDuplicate, settings.soundEffects, settleLink],
  );

  const groups = useMemo(
    () => groupAndFilterCollections(collections, links, searchQuery),
    [collections, links, searchQuery],
  );

  const isSearching = searchQuery.trim().length > 0;
  const compact = settings.density === 'compact';

  return (
    <MotionConfig
      reducedMotion={resolveReducedMotionPolicy(settings.motionMode)}
    >
      <DragDropProvider
        sensors={WORKBENCH_SENSORS}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="stash-backdrop flex h-screen flex-col overflow-hidden text-fg">
          <TopBar
            searchInputRef={searchInputRef}
            allThemes={allThemes}
            activeTheme={activeTheme}
            settings={settings}
            totalLinks={links.length}
            openTabsCount={tabs.length}
          />

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <main
              onScroll={dismissPreview}
              className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"
            >
              <div className="mx-auto max-w-[1320px]">
                {loading ? (
                  <div className="py-20 text-center font-mono text-xs text-fg-muted">
                    Loading workspace...
                  </div>
                ) : collections.length === 0 ? (
                  <EmptyState />
                ) : groups.length === 0 ? (
                  <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-card border border-border bg-panel px-6 py-12 text-center">
                    <SearchX className="mb-3 h-7 w-7 text-fg-muted" />
                    <p className="text-sm font-medium text-fg">
                      No matches for "{searchQuery.trim()}"
                    </p>
                    <p className="mt-1 text-xs text-fg-muted">
                      Try searching by domain, title, tag, or note.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSearchQuery('')}
                      className="mt-4"
                    >
                      Clear Search
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {groups.map(
                      ({ collection, links: collectionLinks }, colIndex) => (
                        <CollectionSection
                          key={collection.id}
                          collection={collection}
                          index={colIndex}
                          links={collectionLinks}
                          openInNewTab={settings.openLinkInNewTab}
                          compact={compact}
                          forceExpanded={isSearching}
                          dragDisabled={isSearching}
                          motionMode={settings.motionMode}
                          hoverPreviews={settings.hoverPreviews}
                        />
                      ),
                    )}
                  </div>
                )}
              </div>
            </main>

            {settings.openTabsSidebarVisible && (
              <OpenTabsSidebar
                tabs={tabs}
                pinnedTabs={pinnedTabs}
                regularTabs={regularTabs}
                collections={collections}
                settings={settings}
                onQuickStashTab={handleQuickStashTab}
              />
            )}
          </div>

          <CollectionModal />
          <QuickEditModal collections={collections} />
          <SettingsModal
            collections={collections}
            links={links}
            rules={rules}
            settings={settings}
            allThemes={allThemes}
            activeTheme={activeTheme}
          />
          <HealthCheckModal collections={collections} links={links} />
          <ReorganizeModal
            collections={collections}
            links={links}
            settings={settings}
          />
          <TriageModal
            collections={collections}
            links={links}
            rules={rules}
            settings={settings}
          />
          <LinkPreviewPopover
            hoverPreviews={settings.hoverPreviews}
            visualPreviewsEnabled={settings.visualPreviewsEnabled}
            motionMode={settings.motionMode}
          />

          <DragOverlay dropAnimation={null}>
            {(source) =>
              isDragItemData(source.data) ? (
                <DragGhost
                  data={source.data}
                  motionMode={settings.motionMode}
                />
              ) : null
            }
          </DragOverlay>

          <Toaster
            position="bottom-right"
            theme={activeTheme.mode}
            toastOptions={{
              style: {
                background: 'var(--stash-panel)',
                color: 'var(--stash-text)',
                border: '1px solid var(--stash-border)',
                borderRadius: 'var(--stash-radius-card)',
              },
            }}
          />
        </div>
      </DragDropProvider>
    </MotionConfig>
  );
}
