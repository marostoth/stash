import { ChevronsDownUp, ChevronsUpDown, Search, Star, X } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Toaster } from 'sonner';
import { QuickStashCard } from '@/components/sidepanel/quick-stash-card';
import { SidePanelCollectionList } from '@/components/sidepanel/side-panel-collection-list';
import { SidePanelHeader } from '@/components/sidepanel/side-panel-header';
import {
  SIDE_PANEL_ALL_SPACES,
  SidePanelSpaceBar,
} from '@/components/sidepanel/side-panel-space-bar';
import { SmoothCollapse } from '@/components/workbench/smooth-collapse';
import { useActiveTab } from '@/hooks/use-active-tab';
import { useStashData } from '@/hooks/use-stash-data';
import {
  disposeWarmNanoSession,
  prewarmNanoCategorizer,
} from '@/lib/categorizer/nano-engine';
import { resolveReducedMotionPolicy } from '@/lib/motion/physics';
import { stashRepo } from '@/lib/storage/repo';
import { DEFAULT_SPACE_ID } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { collectSpaceTagStats } from '@/lib/utils/collection-sort';
import { groupAndFilterCollections } from '@/lib/utils/search';
import { normalizeUrlForComparison } from '@/lib/utils/url';

export function SidePanelApp() {
  const {
    loading: loadingData,
    spaces,
    collections,
    links,
    rules,
    settings,
    activeTheme,
  } = useStashData();
  const { activeTab, loading: loadingTab } = useActiveTab();
  const [activeSpaceId, setActiveSpaceId] = useState<string>(DEFAULT_SPACE_ID);
  const [searchQuery, setSearchQuery] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [captureExpanded, setCaptureExpanded] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    void stashRepo.getActiveSpaceId().then((savedId) => {
      if (active && savedId) {
        setActiveSpaceId(savedId);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (settings.enableOnDeviceAi) {
      void prewarmNanoCategorizer(true);
    }
    return () => {
      disposeWarmNanoSession();
    };
  }, [settings.enableOnDeviceAi]);

  // Global Side Panel keyboard shortcuts: Ctrl/Cmd+K or / focuses search, Esc clears
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      const editable =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (event.key === '/' && !editable && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (event.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
        } else if (starredOnly || selectedTag) {
          setStarredOnly(false);
          setSelectedTag(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchQuery, selectedTag, starredOnly]);

  const resolvedSpaceId = useMemo(() => {
    if (activeSpaceId === SIDE_PANEL_ALL_SPACES) return SIDE_PANEL_ALL_SPACES;
    if (spaces.some((s) => s.id === activeSpaceId)) return activeSpaceId;
    return spaces[0]?.id ?? DEFAULT_SPACE_ID;
  }, [activeSpaceId, spaces]);

  const handleSelectSpace = (nextSpaceId: string) => {
    setActiveSpaceId(nextSpaceId);
    setSelectedTag(null);
    if (nextSpaceId !== SIDE_PANEL_ALL_SPACES) {
      void stashRepo.setActiveSpaceId(nextSpaceId).catch(() => undefined);
    }
  };

  const activeSpaceCollectionIds = useMemo(() => {
    if (resolvedSpaceId === SIDE_PANEL_ALL_SPACES) return undefined;
    return new Set(
      collections
        .filter((c) => (c.spaceId ?? DEFAULT_SPACE_ID) === resolvedSpaceId)
        .map((c) => c.id),
    );
  }, [collections, resolvedSpaceId]);

  const topTags = useMemo(
    () => collectSpaceTagStats(links, activeSpaceCollectionIds).slice(0, 8),
    [activeSpaceCollectionIds, links],
  );

  const activeTabSaved = useMemo(() => {
    if (!activeTab?.url) return false;
    const norm = normalizeUrlForComparison(activeTab.url);
    return links.some((l) => normalizeUrlForComparison(l.url) === norm);
  }, [activeTab?.url, links]);

  const isFiltering =
    searchQuery.trim().length > 0 || starredOnly || selectedTag !== null;

  const groups = useMemo(
    () =>
      groupAndFilterCollections(collections, links, searchQuery, {
        starredOnly,
        selectedTags: selectedTag ? [selectedTag] : undefined,
        activeSpaceId:
          resolvedSpaceId === SIDE_PANEL_ALL_SPACES
            ? undefined
            : resolvedSpaceId,
        searchAllSpaces: resolvedSpaceId === SIDE_PANEL_ALL_SPACES,
      }),
    [
      collections,
      links,
      resolvedSpaceId,
      searchQuery,
      selectedTag,
      starredOnly,
    ],
  );

  const toggleCollection = (id: string, currentlyOpen: boolean) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !currentlyOpen }));
  };

  const allCollectionsCollapsed = useMemo(() => {
    if (groups.length === 0) return false;
    return groups.every(({ collection }) => {
      const override = expandedIds[collection.id];
      const isOpen = override !== undefined ? override : !collection.collapsed;
      return !isOpen;
    });
  }, [expandedIds, groups]);

  const handleToggleAllCollections = () => {
    if (groups.length === 0 || isFiltering) return;
    const nextOpen = allCollectionsCollapsed;
    setExpandedIds((prev) => {
      const updated = { ...prev };
      for (const { collection } of groups) {
        updated[collection.id] = nextOpen;
      }
      return updated;
    });
  };

  const handleOpenNewTab = () => {
    if (typeof browser !== 'undefined' && browser.tabs?.create) {
      void browser.tabs.create({});
    }
  };

  const defaultCurrency = settings.defaultCurrency ?? 'GBP';
  const targetSpaceId =
    resolvedSpaceId === SIDE_PANEL_ALL_SPACES ? undefined : resolvedSpaceId;
  const showQuickStashPanel = activeTab ? captureExpanded : true;

  return (
    <MotionConfig
      reducedMotion={resolveReducedMotionPolicy(settings.motionMode)}
      transition={settings.motionMode === 'off' ? { duration: 0 } : undefined}
    >
      <div className="stash-backdrop flex h-screen min-w-0 flex-col overflow-hidden text-fg">
        <SidePanelHeader
          totalLinks={links.length}
          hasStashableTab={Boolean(activeTab)}
          activeTabSaved={activeTabSaved}
          captureExpanded={captureExpanded}
          onToggleCapture={() => setCaptureExpanded((prev) => !prev)}
          onOpenBoard={handleOpenNewTab}
          activeSpaceId={targetSpaceId}
          motionMode={settings.motionMode}
          soundEffects={settings.soundEffects}
        />

        {/* Progressive-Disclosure Quick Stash (slim strip on chrome:// pages) */}
        <SmoothCollapse
          open={showQuickStashPanel}
          motionMode={settings.motionMode}
        >
          <div
            className={cn(
              'shrink-0 border-b border-hairline',
              activeTab ? 'bg-[var(--stash-panel)]/45 p-2.5' : 'px-3 py-1.5',
            )}
          >
            <QuickStashCard
              activeTab={activeTab}
              loadingTab={loadingTab}
              loadingData={loadingData}
              activeSpaceId={targetSpaceId}
              spaces={spaces}
              collections={collections}
              links={links}
              rules={rules}
              settings={settings}
            />
          </div>
        </SmoothCollapse>

        {/* Machined Space Switcher */}
        <SidePanelSpaceBar
          spaces={spaces}
          collections={collections}
          links={links}
          activeSpaceId={resolvedSpaceId}
          onSelectSpace={handleSelectSpace}
        />

        {/* Recessed Live Search + Starred Filter + Quick Tags */}
        <div className="shrink-0 space-y-2 px-3 pt-2.5 pb-2">
          <div className="flex items-center gap-1.5">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved links..."
                aria-label="Search saved links"
                className="h-8 w-full rounded-control border border-hairline bg-[var(--stash-panel)] pl-8 pr-7 text-xs text-fg shadow-[inset_0_1px_2px_color-mix(in_srgb,var(--stash-canvas)_35%,transparent)] placeholder:text-fg-muted/70 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted transition-colors hover:text-fg cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-hairline bg-canvas/75 px-1 py-0.25 font-mono text-[9px] text-fg-muted">
                  /
                </kbd>
              )}
            </div>

            <button
              type="button"
              aria-pressed={starredOnly}
              onClick={() => setStarredOnly((prev) => !prev)}
              title={
                starredOnly ? 'Showing Starred only' : 'Filter Starred links'
              }
              className={cn(
                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                starredOnly
                  ? 'border-accent/55 bg-accent/15 text-accent'
                  : 'border-hairline bg-[var(--stash-panel)] text-fg-muted hover:border-border hover:text-accent',
              )}
            >
              <Star
                className={cn(
                  'h-3.5 w-3.5',
                  starredOnly && 'fill-accent text-accent',
                )}
              />
            </button>

            {groups.length > 0 && (
              <button
                type="button"
                disabled={isFiltering}
                onClick={handleToggleAllCollections}
                aria-label={
                  allCollectionsCollapsed ? 'Expand all' : 'Collapse all'
                }
                title={
                  isFiltering
                    ? 'All matching collections stay open while filtering'
                    : allCollectionsCollapsed
                      ? 'Expand all'
                      : 'Collapse all'
                }
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-hairline bg-[var(--stash-panel)] text-fg-muted transition-colors hover:border-border hover:text-fg disabled:pointer-events-none disabled:opacity-45 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
              >
                {allCollectionsCollapsed ? (
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>

          {settings.tagBarVisible === true && topTags.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {topTags.map(({ tag }) => {
                const active = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedTag(active ? null : tag)}
                    className={cn(
                      'inline-flex h-5.5 shrink-0 items-center rounded-pill border px-2 font-mono text-[10px] transition-colors cursor-pointer',
                      active
                        ? 'border-accent/55 bg-accent/15 text-accent'
                        : 'border-hairline bg-[var(--stash-panel)]/75 text-fg-muted hover:border-border hover:text-fg',
                    )}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Scrollable Interactive Collections List */}
        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4">
          <SidePanelCollectionList
            groups={groups}
            searchQuery={searchQuery}
            isFiltering={isFiltering}
            defaultCurrency={defaultCurrency}
            soundEffects={settings.soundEffects}
            motionMode={settings.motionMode}
            expandedIds={expandedIds}
            onToggleCollection={toggleCollection}
            onClearFilters={() => {
              setSearchQuery('');
              setStarredOnly(false);
              setSelectedTag(null);
            }}
          />
        </div>

        <Toaster
          position="bottom-center"
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
    </MotionConfig>
  );
}
