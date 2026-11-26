import {
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Search,
  Star,
  X,
} from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Toaster } from 'sonner';
import { QuickStashCard } from '@/components/sidepanel/quick-stash-card';
import { SidePanelCollectionList } from '@/components/sidepanel/side-panel-collection-list';
import {
  SIDE_PANEL_ALL_SPACES,
  SidePanelSpaceBar,
} from '@/components/sidepanel/side-panel-space-bar';
import { Button } from '@/components/ui/button';
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

  // Hydrate initial Space from saved active Space
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

  // Quietly pre-warm Gemini Nano when Side Panel mounts so quick-stash AI feels instant
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

  const handleOpenNewTab = () => {
    if (typeof browser !== 'undefined' && browser.tabs?.create) {
      void browser.tabs.create({});
    }
  };

  const defaultCurrency = settings.defaultCurrency ?? 'GBP';

  return (
    <MotionConfig
      reducedMotion={resolveReducedMotionPolicy(settings.motionMode)}
    >
      <div className="stash-backdrop flex h-screen flex-col overflow-hidden text-fg">
        {/* Compact Header */}
        <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border bg-panel px-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold tracking-[0.14em] text-fg">
              STASH
            </span>
            <span className="rounded-pill border border-border bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
              {links.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCaptureExpanded((prev) => !prev)}
              aria-expanded={captureExpanded}
              title={
                captureExpanded
                  ? 'Collapse Quick Stash card for more browsing room'
                  : 'Expand Quick Stash card'
              }
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-control border px-2 text-[11px] font-medium transition-colors cursor-pointer',
                captureExpanded
                  ? 'border-accent/45 bg-accent/12 text-accent'
                  : 'border-border bg-canvas/70 text-fg-muted hover:text-fg',
              )}
            >
              <BookmarkPlus className="h-3 w-3" />
              <span>Capture</span>
              {activeTabSaved && (
                <span
                  aria-hidden="true"
                  title="This tab is already in Stash"
                  className="h-1.5 w-1.5 rounded-full bg-accent"
                />
              )}
              {captureExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenNewTab}
              className="h-7 gap-1 px-2 text-[11px]"
              title="Open Stash New Tab workbench"
            >
              <span>Board</span>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </header>

        {/* Collapsible Quick-Stash Capture Card */}
        {captureExpanded && (
          <div className="shrink-0 border-b border-border p-3">
            <QuickStashCard
              activeTab={activeTab}
              loadingTab={loadingTab}
              loadingData={loadingData}
              activeSpaceId={
                resolvedSpaceId === SIDE_PANEL_ALL_SPACES
                  ? undefined
                  : resolvedSpaceId
              }
              spaces={spaces}
              collections={collections}
              links={links}
              rules={rules}
              settings={settings}
            />
          </div>
        )}

        {/* Compact Space Switcher */}
        <SidePanelSpaceBar
          spaces={spaces}
          collections={collections}
          links={links}
          activeSpaceId={resolvedSpaceId}
          onSelectSpace={handleSelectSpace}
        />

        {/* Compact Live Search + Starred Filter + Quick Tags */}
        <div className="shrink-0 space-y-2 px-3 pt-2.5 pb-2">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved links... (/)"
                aria-label="Search saved links"
                className="h-8 w-full rounded-control border border-border bg-panel pl-8 pr-7 text-xs text-fg placeholder:text-fg-muted/75 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
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
                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control border transition-colors cursor-pointer',
                starredOnly
                  ? 'border-accent/60 bg-accent/15 text-accent'
                  : 'border-border bg-panel text-fg-muted hover:border-accent/40 hover:text-accent',
              )}
            >
              <Star
                className={cn(
                  'h-3.5 w-3.5',
                  starredOnly && 'fill-accent text-accent',
                )}
              />
            </button>
          </div>

          {settings.tagBarVisible !== false && topTags.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {topTags.map(({ tag }) => {
                const active = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedTag(active ? null : tag)}
                    className={cn(
                      'inline-flex h-5 shrink-0 items-center rounded-pill border px-1.5 font-mono text-[10px] transition-colors cursor-pointer',
                      active
                        ? 'border-accent/60 bg-accent/15 text-accent'
                        : 'border-border/75 bg-panel/65 text-fg-muted hover:border-accent/45 hover:text-fg',
                    )}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Scrollable Compact Interactive Collections List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
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
