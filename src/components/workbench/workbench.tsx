import {
  DragDropProvider,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
} from '@dnd-kit/react';
import { MotionConfig, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Toaster } from 'sonner';
import { BackgroundJobsTray } from '@/components/workbench/background-jobs-tray';
import { BulkActionBar } from '@/components/workbench/bulk-action-bar';
import { CollectionSection } from '@/components/workbench/collection-section';
import { DetailsView } from '@/components/workbench/details-view';
import { DragGhost } from '@/components/workbench/drag-ghost';
import { EmptyState } from '@/components/workbench/empty-state';
import { OpenTabsSidebar } from '@/components/workbench/open-tabs-sidebar';
import { QuickLaunchBar } from '@/components/workbench/quick-launch-bar';
import { SpaceBar } from '@/components/workbench/space-bar';
import { TagFilterBar } from '@/components/workbench/tag-filter-bar';
import { TopBar } from '@/components/workbench/top-bar';
import { WallpaperLayer } from '@/components/workbench/wallpaper-layer';
import {
  EmptySpaceNotice,
  NoFilterMatchesNotice,
} from '@/components/workbench/workbench-empty-states';
import { WorkbenchModals } from '@/components/workbench/workbench-modals';
import { useOpenTabs } from '@/hooks/use-open-tabs';
import { useStashData } from '@/hooks/use-stash-data';
import { useWorkbenchDnd } from '@/hooks/use-workbench-dnd';
import { useWorkbenchShortcuts } from '@/hooks/use-workbench-shortcuts';
import { isDragItemData } from '@/lib/dnd/types';
import {
  computeSpaceSlideDirection,
  isTactileMotion,
  resolveReducedMotionPolicy,
} from '@/lib/motion/presets';
import { DEFAULT_SPACE_ID } from '@/lib/types/stash';
import {
  formatCurrencySummaries,
  summarizePrices,
} from '@/lib/utils/price-math';
import { groupAndFilterCollections } from '@/lib/utils/search';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';
import { useFxStore } from '@/store/fx-store';
import { useSelectionStore } from '@/store/selection-store';
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
  const smartFilter = useUiStore((s) => s.smartFilter);
  const setSmartFilter = useUiStore((s) => s.setSmartFilter);
  const selectedTags = useUiStore((s) => s.selectedTags);
  const clearSelectedTags = useUiStore((s) => s.clearSelectedTags);
  const searchAllSpaces = useUiStore((s) => s.searchAllSpaces);
  const openCreateCollection = useUiStore((s) => s.openCreateCollection);
  const dismissPreview = useUiStore((s) => s.dismissPreview);
  const spaceSlideDirection = useFxStore((s) => s.spaceSlideDirection);
  const setSpaceSlideDirection = useFxStore((s) => s.setSpaceSlideDirection);
  const trayHeightPx = useBackgroundJobsStore((s) => s.trayHeightPx);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const activeSpace = useMemo(
    () => spaces.find((s) => s.id === activeSpaceId) ?? spaces[0],
    [spaces, activeSpaceId],
  );
  const resolvedSpaceId = activeSpace?.id ?? DEFAULT_SPACE_ID;

  const handleSelectSpace = useCallback(
    (nextSpaceId: string) => {
      const dir = computeSpaceSlideDirection(
        spaces.map((s) => s.id),
        resolvedSpaceId,
        nextSpaceId,
      );
      setSpaceSlideDirection(dir);
      setActiveSpaceId(nextSpaceId);
    },
    [resolvedSpaceId, setActiveSpaceId, setSpaceSlideDirection, spaces],
  );

  const {
    handleQuickStashTab,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useWorkbenchDnd({
    soundEffects: settings.soundEffects,
    motionMode: settings.motionMode,
    onSwitchSpace: handleSelectSpace,
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
        smartFilter,
        selectedTags,
        activeSpaceId: resolvedSpaceId,
        searchAllSpaces,
      }),
    [
      collections,
      links,
      searchQuery,
      starredOnly,
      smartFilter,
      selectedTags,
      resolvedSpaceId,
      searchAllSpaces,
    ],
  );

  const isFiltering =
    searchQuery.trim().length > 0 ||
    starredOnly ||
    smartFilter !== 'all' ||
    selectedTags.length > 0;
  const hideCheckedInSpace = activeSpace?.hideChecked === true && !isFiltering;
  const checkedCountInSpace = useMemo(
    () =>
      links.filter(
        (link) =>
          link.checked === true &&
          activeSpaceCollectionIds.has(link.collectionId),
      ).length,
    [links, activeSpaceCollectionIds],
  );
  const visibleLinks = useMemo(
    () =>
      groups.flatMap((group) => {
        if (group.collection.collapsed && !isFiltering) return [];
        return hideCheckedInSpace
          ? group.links.filter((l) => l.checked !== true)
          : group.links;
      }),
    [groups, isFiltering, hideCheckedInSpace],
  );

  const visibleLinkIds = useMemo(
    () => visibleLinks.map((l) => l.id),
    [visibleLinks],
  );
  const setOrderedVisibleIds = useSelectionStore((s) => s.setOrderedVisibleIds);
  const pruneMissingSelection = useSelectionStore((s) => s.pruneMissing);
  useEffect(() => {
    setOrderedVisibleIds(visibleLinkIds);
    pruneMissingSelection(new Set(links.map((l) => l.id)));
  }, [links, pruneMissingSelection, setOrderedVisibleIds, visibleLinkIds]);

  useWorkbenchShortcuts({
    searchInputRef,
    hoverPreviews: settings.hoverPreviews,
    visibleLinks,
    spaces,
    openLinkInNewTab: settings.openLinkInNewTab,
    onSelectSpace: handleSelectSpace,
  });

  const effectiveDensity = activeSpace?.densityOverride ?? settings.density;
  const activeViewMode = activeSpace?.viewMode ?? 'grid';
  const wideBoard = settings.boardWidth === 'wide';
  const fxDeskJolt = settings.fxDeskJolt ?? true;
  const fxDragTilt = settings.fxDragTilt ?? true;
  const fxHoverSheen = settings.fxHoverSheen ?? true;
  const fxAmbientWaves = settings.fxAmbientWaves ?? true;
  const spaceSlideActive =
    isTactileMotion(settings.motionMode) &&
    fxAmbientWaves &&
    spaceSlideDirection !== 0;

  return (
    <MotionConfig
      reducedMotion={resolveReducedMotionPolicy(settings.motionMode)}
    >
      <DragDropProvider
        sensors={WORKBENCH_SENSORS}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
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
              checkedCountInSpace={checkedCountInSpace}
              wideBoard={wideBoard}
              motionMode={settings.motionMode}
              fxAmbientWaves={fxAmbientWaves}
              onSelectSpace={handleSelectSpace}
            />

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <main
                onScroll={dismissPreview}
                className="min-w-0 flex-1 overflow-y-auto px-5 py-7 sm:px-8 sm:py-8"
              >
                <div
                  className={
                    wideBoard
                      ? 'mx-auto max-w-[1720px]'
                      : 'mx-auto max-w-[1320px]'
                  }
                >
                  {(settings.quickLaunchVisible !== false ||
                    settings.tagBarVisible !== false) && (
                    <div className="mb-7 space-y-2.5 empty:mb-0">
                      {settings.quickLaunchVisible !== false && (
                        <QuickLaunchBar
                          links={links}
                          activeSpaceCollectionIds={activeSpaceCollectionIds}
                          openInNewTab={settings.openLinkInNewTab}
                          wideBoard={wideBoard}
                        />
                      )}

                      {settings.tagBarVisible !== false && (
                        <TagFilterBar
                          links={links}
                          activeSpaceCollectionIds={activeSpaceCollectionIds}
                          searchAllSpaces={searchAllSpaces}
                          wideBoard={wideBoard}
                        />
                      )}
                    </div>
                  )}

                  <motion.div
                    key={resolvedSpaceId}
                    initial={
                      spaceSlideActive
                        ? { x: spaceSlideDirection * 42, opacity: 0.45 }
                        : false
                    }
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.36, ease: [0.22, 0.88, 0.32, 1] }}
                  >
                    {loading ? (
                      <div className="py-20 text-center font-mono text-xs text-fg-muted">
                        Loading workspace...
                      </div>
                    ) : collections.length === 0 ? (
                      <EmptyState />
                    ) : !isFiltering && activeSpaceCollections.length === 0 ? (
                      <EmptySpaceNotice
                        spaceName={activeSpace?.name ?? 'this Space'}
                        onCreateCollection={openCreateCollection}
                      />
                    ) : groups.length === 0 ? (
                      <NoFilterMatchesNotice
                        starredOnly={starredOnly}
                        searchQuery={searchQuery}
                        searchAllSpaces={searchAllSpaces}
                        spacesCount={spaces.length}
                        onClear={() => {
                          setSearchQuery('');
                          setStarredOnly(false);
                          setSmartFilter('all');
                          clearSelectedTags();
                        }}
                      />
                    ) : activeViewMode === 'details' ? (
                      <DetailsView
                        activeSpace={activeSpace}
                        groups={groups}
                        spaces={spaces}
                        isFiltering={isFiltering}
                        hideChecked={hideCheckedInSpace}
                        searchAllSpaces={searchAllSpaces}
                        openInNewTab={settings.openLinkInNewTab}
                        defaultCurrency={defaultCurrency}
                        motionMode={settings.motionMode}
                        dropEffectStyle={settings.dropEffectStyle}
                        fxAmbientWaves={fxAmbientWaves}
                        soundEffects={settings.soundEffects}
                        hoverPreviews={settings.hoverPreviews}
                        onSwitchSpace={handleSelectSpace}
                      />
                    ) : (
                      <div className="space-y-10">
                        {groups.map(
                          (
                            { collection, links: collectionLinks },
                            colIndex,
                          ) => {
                            const colSpaceId =
                              collection.spaceId ?? DEFAULT_SPACE_ID;
                            const outsideActiveSpace =
                              isFiltering &&
                              searchAllSpaces &&
                              colSpaceId !== resolvedSpaceId
                                ? spaceById.get(colSpaceId)
                                : undefined;
                            const displayedLinks = hideCheckedInSpace
                              ? collectionLinks.filter(
                                  (l) => l.checked !== true,
                                )
                              : collectionLinks;
                            return (
                              <CollectionSection
                                key={collection.id}
                                collection={collection}
                                index={colIndex}
                                links={displayedLinks}
                                spaces={spaces}
                                spaceBadge={outsideActiveSpace}
                                onSwitchSpace={handleSelectSpace}
                                openInNewTab={settings.openLinkInNewTab}
                                defaultCurrency={defaultCurrency}
                                density={effectiveDensity}
                                wideBoard={wideBoard}
                                forceExpanded={isFiltering}
                                dragDisabled={isFiltering}
                                motionMode={settings.motionMode}
                                dropEffectStyle={settings.dropEffectStyle}
                                fxDeskJolt={fxDeskJolt}
                                fxHoverSheen={fxHoverSheen}
                                fxAmbientWaves={fxAmbientWaves}
                                soundEffects={settings.soundEffects}
                                hoverPreviews={settings.hoverPreviews}
                              />
                            );
                          },
                        )}
                      </div>
                    )}
                  </motion.div>
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

          <WorkbenchModals
            spaces={spaces}
            collections={collections}
            links={links}
            rules={rules}
            settings={settings}
            allThemes={allThemes}
            activeTheme={activeTheme}
            activeSpace={activeSpace}
            resolvedSpaceId={resolvedSpaceId}
            defaultCurrency={defaultCurrency}
          />

          <DragOverlay dropAnimation={null}>
            {(source) =>
              isDragItemData(source.data) ? (
                <DragGhost
                  data={source.data}
                  motionMode={settings.motionMode}
                  dragTiltEnabled={fxDragTilt}
                />
              ) : null
            }
          </DragOverlay>

          <BulkActionBar
            links={links}
            visibleLinkIds={visibleLinkIds}
            collections={collections}
            spaces={spaces}
            motionMode={settings.motionMode}
            soundEffects={settings.soundEffects}
          />

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
