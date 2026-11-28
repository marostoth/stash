import {
  Check,
  Clock,
  Filter,
  Flame,
  Globe,
  Palette,
  PanelRight,
  Plus,
  Search,
  Settings,
  Star,
  Tag,
  X,
} from 'lucide-react';
import type * as React from 'react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { OdometerCounter } from '@/components/ui/odometer-counter';
import { stashRepo } from '@/lib/storage/repo';
import { applyThemeToDocument } from '@/lib/themes/theme-engine';
import type { StashSettings, ThemeDefinition } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import type { SmartFilter } from '@/lib/utils/search';
import { useOpenTabsStore } from '@/store/open-tabs-store';
import { useUiStore } from '@/store/ui-store';

const SMART_FILTER_LABELS: Record<SmartFilter, string> = {
  all: 'Views',
  recent: 'Recent 7d',
  frequent: 'Opened',
  untagged: 'Untagged',
};

interface TopBarProps {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  allThemes: readonly ThemeDefinition[];
  activeTheme: ThemeDefinition;
  settings: StashSettings;
  totalLinks: number;
  starredCount: number;
  starredSubtotal?: string;
  spacesCount: number;
}

export function TopBar({
  searchInputRef,
  allThemes,
  activeTheme,
  settings,
  totalLinks,
  starredCount,
  starredSubtotal,
  spacesCount,
}: TopBarProps) {
  const openTabsCount = useOpenTabsStore((s) => s.tabs.length);
  const searchQuery = useUiStore((s) => s.searchQuery);
  const setSearchQuery = useUiStore((s) => s.setSearchQuery);
  const starredOnly = useUiStore((s) => s.starredOnly);
  const toggleStarredOnly = useUiStore((s) => s.toggleStarredOnly);
  const smartFilter = useUiStore((s) => s.smartFilter);
  const setSmartFilter = useUiStore((s) => s.setSmartFilter);
  const searchAllSpaces = useUiStore((s) => s.searchAllSpaces);
  const toggleSearchAllSpaces = useUiStore((s) => s.toggleSearchAllSpaces);
  const openCreateCollection = useUiStore((s) => s.openCreateCollection);
  const openSettings = useUiStore((s) => s.openSettings);
  const justSelectedThemeRef = useRef<string | null>(null);
  const previewingRef = useRef(false);

  const previewTheme = (theme: ThemeDefinition) => {
    previewingRef.current = true;
    applyThemeToDocument(
      theme,
      document.documentElement,
      settings.backdropOverride,
    );
  };

  const revertThemePreview = () => {
    if (!previewingRef.current) return;
    previewingRef.current = false;
    applyThemeToDocument(
      activeTheme,
      document.documentElement,
      settings.backdropOverride,
    );
  };

  const handleSelectTheme = (theme: ThemeDefinition) => {
    justSelectedThemeRef.current = theme.id;
    previewingRef.current = false;
    applyThemeToDocument(
      theme,
      document.documentElement,
      settings.backdropOverride,
    );
    void stashRepo.updateSettings({ activeThemeId: theme.id });
  };

  const handleToggleSidebar = () => {
    void stashRepo.updateSettings({
      openTabsSidebarVisible: !settings.openTabsSidebarVisible,
    });
  };

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-hairline bg-panel/95 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between gap-3 px-5 sm:px-7">
        {/* Brand */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-control border border-border bg-card"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="14" height="4" rx="1" />
              <rect x="3" y="10" width="9" height="6" rx="1" />
              <path d="M15 11.5v3M13.5 13h3" />
            </svg>
          </div>
          <span className="font-mono text-sm font-semibold tracking-[0.14em] text-fg">
            STASH
          </span>
          {totalLinks > 0 && (
            <span className="hidden rounded-pill border border-border bg-canvas px-2 py-0.5 font-mono text-[10px] text-fg-muted md:inline-block">
              <OdometerCounter
                value={totalLinks}
                motionMode={settings.motionMode}
              />
            </span>
          )}
        </div>

        {/* Live Search + Starred Quick Filter */}
        <div className="flex flex-1 max-w-xl items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search links, tags, notes..."
              aria-label="Search links, tags, and notes"
              className="h-8 w-full rounded-control border border-border bg-canvas pl-8 pr-16 text-xs text-fg placeholder:text-fg-muted/75 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-fg-muted hover:bg-card hover:text-fg cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-panel px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
                Ctrl+K
              </kbd>
            )}
          </div>

          {spacesCount > 1 && (
            <button
              type="button"
              onClick={toggleSearchAllSpaces}
              aria-pressed={searchAllSpaces}
              aria-label={
                searchAllSpaces
                  ? 'Search active Space only'
                  : 'Search across all Spaces'
              }
              title={
                searchAllSpaces
                  ? 'Searching across all Spaces'
                  : 'Search active Space only (click to search all Spaces)'
              }
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                searchAllSpaces
                  ? 'border-accent/65 bg-accent/15 text-accent'
                  : 'border-border bg-canvas text-fg-muted/80 hover:border-accent/45 hover:text-fg',
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden md:inline">All Spaces</span>
            </button>
          )}

          {(starredCount > 0 || starredOnly) && (
            <button
              type="button"
              onClick={toggleStarredOnly}
              aria-pressed={starredOnly}
              aria-label={
                starredOnly
                  ? 'Show all links (clear Starred filter)'
                  : `Filter to ${starredCount} starred link${starredCount === 1 ? '' : 's'}`
              }
              title={
                starredOnly
                  ? 'Showing starred links only (Esc to clear)'
                  : 'Filter starred links'
              }
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                starredOnly
                  ? 'border-accent/65 bg-accent/15 text-accent'
                  : 'border-border bg-canvas text-fg-muted hover:border-accent/45 hover:text-fg',
              )}
            >
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              <span className="hidden sm:inline">Starred</span>
              <span className="font-mono text-[11px]">{starredCount}</span>
              {starredSubtotal && (
                <span className="hidden font-mono text-[11px] text-accent md:inline">
                  · {starredSubtotal}
                </span>
              )}
            </button>
          )}

          {/* Smart Filter Views Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Smart filter view (${SMART_FILTER_LABELS[smartFilter]})`}
                title="Smart Views: Recently Added, Most Opened, Untagged"
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  smartFilter !== 'all'
                    ? 'border-accent/65 bg-accent/15 text-accent'
                    : 'border-border bg-canvas text-fg-muted hover:border-accent/45 hover:text-fg',
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">
                  {SMART_FILTER_LABELS[smartFilter]}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Smart Views</DropdownMenuLabel>
              {(
                [
                  { id: 'all', label: 'All Links', Icon: Filter },
                  { id: 'recent', label: 'Recently Added (7d)', Icon: Clock },
                  { id: 'frequent', label: 'Recently Opened', Icon: Flame },
                  { id: 'untagged', label: 'Untagged Links', Icon: Tag },
                ] as const
              ).map(({ id, label, Icon }) => (
                <DropdownMenuItem
                  key={id}
                  onSelect={() => setSmartFilter(id)}
                  className="justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-fg-muted" />
                    <span>{label}</span>
                  </span>
                  {smartFilter === id && (
                    <Check className="h-3.5 w-3.5 text-accent" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={openCreateCollection}
            className="gap-1 border-accent/45 text-accent hover:bg-accent/10"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Collection</span>
          </Button>

          {/* Theme Quick-Switcher (with live hover/keyboard preview) */}
          <DropdownMenu
            onOpenChange={(open) => {
              if (!open) {
                if (justSelectedThemeRef.current) {
                  justSelectedThemeRef.current = null;
                } else {
                  revertThemePreview();
                }
              }
            }}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                aria-label={`Switch theme (${activeTheme.name})`}
                title={`Theme: ${activeTheme.name}`}
                className="gap-1.5 px-2"
              >
                <Palette className="h-3.5 w-3.5 text-fg-muted" />
                <span
                  className="h-2.5 w-2.5 rounded-full border border-border"
                  style={{ backgroundColor: activeTheme.colors.accent }}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onPointerLeave={revertThemePreview}
              className="max-h-[70vh] w-56 overflow-y-auto"
            >
              <DropdownMenuLabel>Theme (hover to preview)</DropdownMenuLabel>
              {allThemes.map((theme) => {
                const isSelected = theme.id === activeTheme.id;
                return (
                  <DropdownMenuItem
                    key={theme.id}
                    onPointerEnter={() => previewTheme(theme)}
                    onFocus={() => previewTheme(theme)}
                    onSelect={() => handleSelectTheme(theme)}
                    className="justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex items-center overflow-hidden rounded-full border border-border">
                        <span
                          className="h-3 w-2"
                          style={{ backgroundColor: theme.colors.canvas }}
                        />
                        <span
                          className="h-3 w-2"
                          style={{ backgroundColor: theme.colors.accent }}
                        />
                      </span>
                      <span>{theme.name}</span>
                    </span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-accent" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Open Tabs Sidebar Toggle */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleToggleSidebar}
            aria-pressed={settings.openTabsSidebarVisible}
            aria-label={
              settings.openTabsSidebarVisible
                ? 'Hide Open Tabs sidebar'
                : 'Show Open Tabs sidebar'
            }
            title={
              settings.openTabsSidebarVisible
                ? 'Hide Open Tabs sidebar'
                : 'Show Open Tabs sidebar'
            }
            className={cn(
              'gap-1.5 px-2',
              settings.openTabsSidebarVisible && 'border-accent/50 text-accent',
            )}
          >
            <PanelRight className="h-3.5 w-3.5" />
            <span className="hidden font-mono text-[11px] sm:inline">
              {openTabsCount}
            </span>
          </Button>

          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openSettings()}
            aria-label="Settings"
            title="Settings & Auto-Rules"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
