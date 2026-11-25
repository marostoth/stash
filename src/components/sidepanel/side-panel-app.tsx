import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Toaster } from 'sonner';
import { QuickStashCard } from '@/components/sidepanel/quick-stash-card';
import { Button } from '@/components/ui/button';
import { useActiveTab } from '@/hooks/use-active-tab';
import { useStashData } from '@/hooks/use-stash-data';
import { stashRepo } from '@/lib/storage/repo';
import { TAB_GROUP_COLOR_SWATCH } from '@/lib/types/stash';
import { groupAndFilterCollections } from '@/lib/utils/search';
import { extractDomain, getMonogram } from '@/lib/utils/url';

export function SidePanelApp() {
  const { collections, links, rules, settings, activeTheme } = useStashData();
  const { activeTab, loading: loadingTab } = useActiveTab();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const groups = useMemo(
    () => groupAndFilterCollections(collections, links, searchQuery),
    [collections, links, searchQuery],
  );

  const isSearching = searchQuery.trim().length > 0;

  const isCollectionOpen = (id: string, defaultCollapsed: boolean) => {
    if (isSearching) return true;
    const override = expandedIds[id];
    return override !== undefined ? override : !defaultCollapsed;
  };

  const toggleCollection = (id: string, currentlyOpen: boolean) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !currentlyOpen }));
  };

  const handleOpenNewTab = () => {
    if (typeof browser !== 'undefined' && browser.tabs?.create) {
      void browser.tabs.create({});
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas text-fg">
      {/* Compact Header */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-panel px-3.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold tracking-[0.14em] text-fg">
            STASH
          </span>
          <span className="rounded-pill border border-border bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-fg-muted">
            {links.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenNewTab}
          className="h-7 gap-1 px-2 text-[11px]"
          title="Open Stash New Tab workbench"
        >
          <span>Workbench</span>
          <ExternalLink className="h-3 w-3" />
        </Button>
      </header>

      {/* Pinned Quick-Stash Card */}
      <div className="shrink-0 border-b border-border p-3">
        <QuickStashCard
          activeTab={activeTab}
          loadingTab={loadingTab}
          collections={collections}
          links={links}
          rules={rules}
          settings={settings}
        />
      </div>

      {/* Compact Live Search */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved links..."
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
      </div>

      {/* Scrollable Compact Collections List */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
        {groups.length === 0 ? (
          <div className="py-8 text-center text-xs text-fg-muted">
            {isSearching
              ? `No matches for "${searchQuery.trim()}"`
              : 'No collections yet. Stash this tab to create one.'}
          </div>
        ) : (
          groups.map(({ collection, links: colLinks }) => {
            const expanded = isCollectionOpen(
              collection.id,
              collection.collapsed,
            );
            return (
              <div
                key={collection.id}
                className="rounded-card border border-border bg-panel/70"
              >
                <button
                  type="button"
                  onClick={() => toggleCollection(collection.id, expanded)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-xs font-medium text-fg hover:bg-card/60 rounded-card cursor-pointer"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {expanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-fg-muted" />
                    )}
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          TAB_GROUP_COLOR_SWATCH[collection.color],
                      }}
                    />
                    <span className="truncate">{collection.name}</span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-fg-muted">
                    {colLinks.length}
                  </span>
                </button>

                {expanded && colLinks.length > 0 && (
                  <div className="space-y-0.5 border-t border-border p-1.5">
                    {colLinks.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => void stashRepo.markLinkOpened(link.id)}
                        className="flex items-start gap-2 rounded-control px-2 py-1.5 transition-colors hover:bg-card"
                      >
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-canvas font-mono text-[10px] font-semibold text-accent">
                          {link.faviconUrl ? (
                            <img
                              src={link.faviconUrl}
                              alt=""
                              width={14}
                              height={14}
                              className="h-3.5 w-3.5 object-contain"
                            />
                          ) : (
                            <span>{getMonogram(link.title, link.url)}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-fg">
                            {link.title}
                          </div>
                          <div className="truncate font-mono text-[10px] text-fg-muted">
                            {extractDomain(link.url)}
                            {link.note ? ` · ${link.note}` : ''}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
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
  );
}
