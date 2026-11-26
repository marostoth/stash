import {
  DragDropProvider,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
} from '@dnd-kit/react';
import { FolderPlus, SearchX } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';
import { Toaster } from 'sonner';
import { HealthCheckModal } from '@/components/HealthCheckModal';
import { ReorganizeModal } from '@/components/reorganize/ReorganizeModal';
import { SettingsModal } from '@/components/settings/settings-modal';
import { Button } from '@/components/ui/button';
import { StashErrorBoundary } from '@/components/ui/error-boundary';
import { BackgroundJobsTray } from '@/components/workbench/background-jobs-tray';
import { CollectionModal } from '@/components/workbench/collection-modal';
import { CollectionSection } from '@/components/workbench/collection-section';
import { DetailsView } from '@/components/workbench/details-view';
import { DragGhost } from '@/components/workbench/drag-ghost';
import { EmptyState } from '@/components/workbench/empty-state';
import { LinkPreviewPopover } from '@/components/workbench/link-preview-popover';
import { OpenTabsSidebar } from '@/components/workbench/open-tabs-sidebar';
import { QuickEditModal } from '@/components/workbench/quick-edit-modal';
import { SpaceBar } from '@/components/workbench/space-bar';
import { TopBar } from '@/components/workbench/top-bar';
import { TriageModal } from '@/components/workbench/triage-modal';
import { WallpaperLayer } from '@/components/workbench/wallpaper-layer';
import { useOpenTabs } from '@/hooks/use-open-tabs';
import { useStashData } from '@/hooks/use-stash-data';
import { useWorkbenchDnd } from '@/hooks/use-workbench-dnd';
import { useWorkbenchShortcuts } from '@/hooks/use-workbench-shortcuts';
import { isDragItemData } from '@/lib/dnd/types';
import { resolveReducedMotionPolicy } from '@/lib/motion/physics';
import { DEFAULT_SPACE_ID } from '@/lib/types/stash';
import {
  formatCurrencySummaries,
  summarizePrices,
} from '@/lib/utils/price-math';
import { groupAndFilterCollections } from '@/lib/utils/search';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';
import { useUiStore } from '@/store/ui-store';

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
    spaces,
    collections,
    links,
    rules,
    settings,
    allThemes,
    activeTheme,
  } = useStashData();
  const { tabs, pinnedTabs, regularTabs, clearableCount } = useOpenTabs();
  const activeSpaceId = useUiStore((s) => s.activeSpaceId);
  const setActiveSpaceId = useUiStore((s) => s.setActiveSpaceId);
  const searchQuery = useUiStore((s) => s.searchQuery);
  const setSearchQuery = useUiStore((s) => s.setSearchQuery);
  const starredOnly = useUiStore((s) => s.starredOnly);
  const setStarredOnly = useUiStore((s) => s.setStarredOnly);
  const searchAllSpaces = useUiStore((s) => s.searchAllSpaces);
  const openCreateCollection = useUiStore((s) => s.openCreateCollection);
  const dismissPreview = useUiStore((s) => s.dismissPreview);
  const trayHeightPx = useBackgroundJobsStore((s) => s.trayHeightPx);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const { handleQuickStashTab, handleDragStart, handleDragEnd } =
    useWorkbenchDnd({
      soundEffects: settings.soundEffects,
      motionMode: settings.motionMode,
      onSwitchSpace: setActiveSpaceId,
    });

  // Hydrate initial search query when opened from Chrome's `s <query>` omnibox
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get('q')?.trim();
    if (!initialQuery) return;
    setSearchQuery(initialQuery);
    params.delete('q');
    const cleanSearch = params.toString();
    const nextUrl = `${window.location.pathname}${cleanSearch ? `?${cleanSearch}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', nextUrl);
    searchInputRef.current?.focus();
  }, [setSearchQuery]);

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === activeSpaceId) ?? spaces[0],
    [spaces, activeSpaceId],
  );
  const resolvedSpaceId = activeSpace?.id ?? DEFAULT_SPACE_ID;
  const spaceById = useMemo(
    () => new Map(spaces.map((s) => [s.id, s])),
    [spaces],
  );

  const activeSpaceCollections = useMemo(
    () =>
      collections.filter(
        (col) => (col.spaceId ?? DEFAULT_SPACE_ID) === resolvedSpaceId,
      ),
    [collections, resolvedSpaceId],
  );

  const activeSpaceCollectionIds = useMemo(
    () => new Set(activeSpaceCollections.map((c) => c.id)),
    [activeSpaceCollections],
  );
  const defaultCurrency = settings.defaultCurrency ?? 'GBP';

  const scopedStarredLinks = useMemo(
    () =>
      links.filter(
        (link) =>
          link.starred === true &&
          (searchAllSpaces || activeSpaceCollectionIds.has(link.collectionId)),
      ),
    [links, searchAllSpaces, activeSpaceCollectionIds],
  );
  const starredCount = scopedStarredLinks.length;
  const starredSubtotal = useMemo(
    () =>
      formatCurrencySummaries(
        summarizePrices(scopedStarredLinks, defaultCurrency),
      ),
    [scopedStarredLinks, defaultCurrency],
  );

  const groups = useMemo(
    () =>
      groupAndFilterCollections(collections, links, searchQuery, {
        starredOnly,
        activeSpaceId: resolvedSpaceId,
        searchAllSpaces,
      }),
    [
      collections,
      links,
      searchQuery,
      starredOnly,
      resolvedSpaceId,
      searchAllSpaces,
    ],
  );

  const isFiltering = searchQuery.trim().length > 0 || starredOnly;
  const visibleLinks = useMemo(
    () =>
      groups.flatMap((group) =>
        !group.collection.collapsed || isFiltering ? group.links : [],
      ),
    [groups, isFiltering],
  );

  useWorkbenchShortcuts({
    searchInputRef,
    hoverPreviews: settings.hoverPreviews,
    visibleLinks,
    spaces,
    openLinkInNewTab: settings.openLinkInNewTab,
  });

  const effectiveDensity = activeSpace?.densityOverride ?? settings.density;
  const activeViewMode = activeSpace?.viewMode ?? 'grid';
  const wideBoard = settings.boardWidth === 'wide';

  return (
    <MotionConfig
      reducedMotion={resolveReducedMotionPolicy(settings.motionMode)}
    >
      <DragDropProvider
        sensors={WORKBENCH_SENSORS}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="stash-backdrop relative flex h-screen flex-col overflow-hidden text-fg">
          <WallpaperLayer settings={settings} />

          <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden">
            <TopBar
              searchInputRef={searchInputRef}
              allThemes={allThemes}
              activeTheme={activeTheme}
              settings={settings}
              totalLinks={links.length}
              starredCount={starredCount}
              starredSubtotal={starredSubtotal || undefined}
              spacesCount={spaces.length}
              openTabsCount={tabs.length}
            />

            <SpaceBar
              spaces={spaces}
              collections={collections}
              activeSpaceId={resolvedSpaceId}
              wideBoard={wideBoard}
              onSelectSpace={setActiveSpaceId}
            />

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <main
                onScroll={dismissPreview}
                className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"
              >
                <div
                  className={
                    wideBoard
                      ? 'mx-auto max-w-[1720px]'
                      : 'mx-auto max-w-[1320px]'
                  }
                >
                  {loading ? (
                    <div className="py-20 text-center font-mono text-xs text-fg-muted">
                      Loading workspace...
                    </div>
                  ) : collections.length === 0 ? (
                    <EmptyState />
                  ) : !isFiltering && activeSpaceCollections.length === 0 ? (
                    <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-card border border-dashed border-border bg-panel/70 px-6 py-12 text-center">
                      <FolderPlus className="mb-3 h-7 w-7 text-accent" />
                      <p className="text-sm font-medium text-fg">
                        No collections in {activeSpace?.name ?? 'this Space'}{' '}
                        yet
                      </p>
                      <p className="mt-1 text-xs text-fg-muted">
                        Create a collection here, or drag any card, tab, or
                        collection onto the {activeSpace?.name ?? 'Space'} tab
                        above.
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={openCreateCollection}
                        className="mt-4"
                      >
                        New Collection
                      </Button>
                    </div>
                  ) : groups.length === 0 ? (
                    <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-card border border-border bg-panel px-6 py-12 text-center">
                      <SearchX className="mb-3 h-7 w-7 text-fg-muted" />
                      <p className="text-sm font-medium text-fg">
                        {starredOnly && !searchQuery.trim()
                          ? 'No starred links yet'
                          : starredOnly
                            ? `No starred matches for "${searchQuery.trim()}"`
                            : `No matches for "${searchQuery.trim()}"`}
                      </p>
                      <p className="mt-1 text-xs text-fg-muted">
                        {starredOnly && !searchQuery.trim()
                          ? 'Star any link card to highlight it and filter it here.'
                          : !searchAllSpaces && spaces.length > 1
                            ? 'Searching active Space only. Enable "All Spaces" to search every board.'
                            : 'Try searching by domain, title, tag, or note.'}
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSearchQuery('');
                          setStarredOnly(false);
                        }}
                        className="mt-4"
                      >
                        {starredOnly && !searchQuery.trim()
                          ? 'Show All Links'
                          : starredOnly
                            ? 'Clear Filters'
                            : 'Clear Search'}
                      </Button>
                    </div>
                  ) : activeViewMode === 'details' ? (
                    <DetailsView
                      activeSpace={activeSpace}
                      groups={groups}
                      spaces={spaces}
                      isFiltering={isFiltering}
                      searchAllSpaces={searchAllSpaces}
                      openInNewTab={settings.openLinkInNewTab}
                      defaultCurrency={defaultCurrency}
                      motionMode={settings.motionMode}
                      soundEffects={settings.soundEffects}
                      hoverPreviews={settings.hoverPreviews}
                      onSwitchSpace={setActiveSpaceId}
                    />
                  ) : (
                    <div className="space-y-8">
                      {groups.map(
                        ({ collection, links: collectionLinks }, colIndex) => {
                          const colSpaceId =
                            collection.spaceId ?? DEFAULT_SPACE_ID;
                          const outsideActiveSpace =
                            isFiltering &&
                            searchAllSpaces &&
                            colSpaceId !== resolvedSpaceId
                              ? spaceById.get(colSpaceId)
                              : undefined;
                          return (
                            <CollectionSection
                              key={collection.id}
                              collection={collection}
                              index={colIndex}
                              links={collectionLinks}
                              spaces={spaces}
                              spaceBadge={outsideActiveSpace}
                              onSwitchSpace={setActiveSpaceId}
                              openInNewTab={settings.openLinkInNewTab}
                              defaultCurrency={defaultCurrency}
                              density={effectiveDensity}
                              wideBoard={wideBoard}
                              forceExpanded={isFiltering}
                              dragDisabled={isFiltering}
                              motionMode={settings.motionMode}
                              soundEffects={settings.soundEffects}
                              hoverPreviews={settings.hoverPreviews}
                            />
                          );
                        },
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
                  clearableCount={clearableCount}
                  collections={activeSpaceCollections}
                  activeSpaceId={resolvedSpaceId}
                  settings={settings}
                  onQuickStashTab={handleQuickStashTab}
                />
              )}
            </div>
          </div>

          <CollectionModal spaces={spaces} activeSpaceId={resolvedSpaceId} />
          <QuickEditModal
            collections={collections}
            spaces={spaces}
            defaultCurrency={defaultCurrency}
          />
          <StashErrorBoundary
            scope="Settings"
            compact
            onReset={() => useUiStore.getState().closeSettings()}
          >
            <SettingsModal
              spaces={spaces}
              collections={collections}
              links={links}
              rules={rules}
              settings={settings}
              allThemes={allThemes}
              activeTheme={activeTheme}
            />
          </StashErrorBoundary>
          <HealthCheckModal collections={collections} links={links} />
          <ReorganizeModal
            collections={collections}
            links={links}
            settings={settings}
            activeSpace={activeSpace}
          />
          <TriageModal
            spaces={spaces}
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

          <BackgroundJobsTray motionMode={settings.motionMode} />

          <Toaster
            position="bottom-right"
            offset={{
              bottom: trayHeightPx > 0 ? trayHeightPx + 60 : 48,
              right: 16,
            }}
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
