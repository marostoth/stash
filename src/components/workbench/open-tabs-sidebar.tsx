import { useDraggable } from '@dnd-kit/react';
import {
  Archive,
  FolderPlus,
  Layers,
  Loader2,
  Pin,
  Plus,
  Volume2,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LinkFavicon } from '@/components/LinkFavicon';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ClearTabsButton } from '@/components/workbench/clear-tabs-button';
import { playSessionFreeze } from '@/lib/audio/foley';
import { isTactileMotion } from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import {
  type OpenTabInfo,
  selectTabsForSession,
} from '@/lib/tabs/session-filter';
import { closeTabs, switchToTab } from '@/lib/tabs/tab-actions';
import {
  type Collection,
  type StashSettings,
  TAB_GROUP_COLOR_SWATCH,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { extractDomain } from '@/lib/utils/url';
import { useFxStore } from '@/store/fx-store';
import { useUiStore } from '@/store/ui-store';

interface OpenTabsSidebarProps {
  tabs: readonly OpenTabInfo[];
  pinnedTabs: readonly OpenTabInfo[];
  regularTabs: readonly OpenTabInfo[];
  clearableCount: number;
  collections: readonly Collection[];
  activeSpaceId: string;
  settings: StashSettings;
  onQuickStashTab: (tab: OpenTabInfo, collectionId: string) => Promise<void>;
}

interface TabRowProps {
  tab: OpenTabInfo;
  index: number;
  dimmed: boolean;
  sweeping: boolean;
  hoverPreviews: boolean;
  collections: readonly Collection[];
  onQuickStashTab: (tab: OpenTabInfo, collectionId: string) => Promise<void>;
}

function OpenTabRow({
  tab,
  index,
  dimmed,
  sweeping,
  hoverPreviews,
  collections,
  onQuickStashTab,
}: TabRowProps) {
  const openCreateCollection = useUiStore((s) => s.openCreateCollection);
  const schedulePreview = useUiStore((s) => s.schedulePreview);
  const dismissPreview = useUiStore((s) => s.dismissPreview);

  const { ref, isDragging } = useDraggable({
    id: `tab:${tab.id}`,
    type: 'open-tab',
    data: { kind: 'open-tab', tab },
  });

  const domain = extractDomain(tab.url);

  const handleCloseTab = (event: React.MouseEvent) => {
    event.stopPropagation();
    void closeTabs([tab.id]);
  };

  return (
    <motion.div
      ref={ref}
      animate={
        sweeping
          ? { x: -54, y: 14, scale: 0.88, opacity: 0.12 }
          : { x: 0, y: 0, scale: 1, opacity: 1 }
      }
      transition={{
        duration: 0.22,
        delay: sweeping ? Math.min(index, 10) * 0.022 : 0,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(
        'group relative flex items-center gap-2 rounded-control border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-card cursor-grab active:cursor-grabbing',
        dimmed && 'opacity-65 hover:opacity-95',
        isDragging && 'opacity-35',
      )}
    >
      <button
        type="button"
        onClick={() => {
          dismissPreview();
          void switchToTab(tab.id);
        }}
        onPointerEnter={(event) => {
          if (!hoverPreviews || isDragging) return;
          const rect = event.currentTarget.getBoundingClientRect();
          schedulePreview({
            id: `tab:${tab.id}`,
            url: tab.url,
            title: tab.title,
            faviconUrl: tab.favIconUrl,
            anchor: {
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            },
            preferredSide: 'left',
          });
        }}
        onPointerLeave={dismissPreview}
        title={`${tab.title}\n${tab.url}`}
        className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded cursor-pointer"
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-canvas">
          <LinkFavicon url={tab.url} faviconUrl={tab.favIconUrl} size="sm" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            {tab.pinned && (
              <Pin
                className="h-2.5 w-2.5 shrink-0 text-fg-muted"
                aria-label="Pinned tab"
              />
            )}
            {tab.audible && (
              <Volume2
                className="h-2.5 w-2.5 shrink-0 text-accent"
                aria-label="Playing audio"
              />
            )}
            <span
              title={tab.title}
              className="truncate text-xs font-medium text-fg"
            >
              {tab.title}
            </span>
          </div>
          <div className="truncate font-mono text-[10px] text-fg-muted">
            {domain}
          </div>
        </div>
      </button>

      {/* Hover quick actions: 1-click stash + close */}
      <div
        data-dnd-no-drag="true"
        onPointerEnter={dismissPreview}
        className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
      >
        {collections.length === 1 && collections[0] ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              const target = collections[0];
              if (target) {
                void onQuickStashTab(tab, target.id);
              }
            }}
            aria-label={`Stash to ${collections[0].name}`}
            title={`Stash to ${collections[0].name}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-panel hover:text-accent cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(event) => event.stopPropagation()}
                aria-label="Stash tab to collection"
                title="Stash to collection"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-panel hover:text-accent cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Stash to...</DropdownMenuLabel>
              {collections.map((col) => (
                <DropdownMenuItem
                  key={col.id}
                  onSelect={() => void onQuickStashTab(tab, col.id)}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: TAB_GROUP_COLOR_SWATCH[col.color],
                    }}
                  />
                  <span className="truncate">{col.name}</span>
                </DropdownMenuItem>
              ))}
              {collections.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem onSelect={openCreateCollection}>
                <FolderPlus className="h-3.5 w-3.5 text-fg-muted" />
                New collection...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <button
          type="button"
          onClick={handleCloseTab}
          aria-label={`Close ${tab.title}`}
          title="Close tab"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-panel hover:text-danger cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

export function OpenTabsSidebar({
  tabs,
  pinnedTabs,
  regularTabs,
  clearableCount,
  collections,
  activeSpaceId,
  settings,
  onQuickStashTab,
}: OpenTabsSidebarProps) {
  const [saving, setSaving] = useState(false);
  const triggerCollectionCascade = useUiStore(
    (s) => s.triggerCollectionCascade,
  );
  const dismissPreview = useUiStore((s) => s.dismissPreview);
  const sessionSweeping = useFxStore((s) => s.sessionSweeping);
  const setSessionSweeping = useFxStore((s) => s.setSessionSweeping);
  const triggerCollectionSlam = useFxStore((s) => s.triggerCollectionSlam);
  const sweepEnabled =
    isTactileMotion(settings.motionMode) && settings.fxAmbientWaves !== false;

  const eligibleTabs = selectTabsForSession(tabs, {
    includePinned: settings.includePinnedInSessions,
  });

  const handleSaveSession = async (closeAfterSave: boolean) => {
    if (eligibleTabs.length === 0) {
      toast.info('No stashable open tabs to save.');
      return;
    }

    setSaving(true);
    try {
      if (sweepEnabled) {
        setSessionSweeping(true);
        await new Promise((resolve) => setTimeout(resolve, 230));
      }
      const saved = await stashRepo.saveSessionCollection(tabs, {
        includePinned: settings.includePinnedInSessions,
        spaceId: activeSpaceId,
      });
      if (!saved) {
        toast.info('No stashable open tabs to save.');
        return;
      }

      triggerCollectionCascade(saved.collection.id);
      if (sweepEnabled) {
        triggerCollectionSlam(saved.collection.id);
      }

      if (closeAfterSave) {
        await closeTabs(saved.closableTabs.map((t) => t.id));
        playSessionFreeze(settings.soundEffects, settings.motionMode);
        const collapsedDuplicates =
          saved.closableTabs.length - saved.links.length;
        if (collapsedDuplicates > 0) {
          toast.success(
            `Saved ${saved.links.length} link${saved.links.length === 1 ? '' : 's'} & closed ${saved.closableTabs.length} tabs (${collapsedDuplicates} duplicate${collapsedDuplicates === 1 ? '' : 's'} collapsed)`,
          );
        } else {
          toast.success(
            `Saved & closed ${saved.links.length} tab${saved.links.length === 1 ? '' : 's'} into "${saved.collection.name}"`,
          );
        }
      } else {
        playSessionFreeze(settings.soundEffects, settings.motionMode);
        toast.success(
          `Saved ${saved.links.length} tab${saved.links.length === 1 ? '' : 's'} into "${saved.collection.name}"`,
        );
      }
    } finally {
      setSessionSweeping(false);
      setSaving(false);
    }
  };

  const handleToggleIncludePinned = () => {
    void stashRepo.updateSettings({
      includePinnedInSessions: !settings.includePinnedInSessions,
    });
  };

  return (
    <aside
      aria-label="Open tabs"
      className="flex w-[280px] shrink-0 flex-col border-l border-border bg-panel/70"
    >
      {/* Sidebar Header & Session Controls */}
      <div className="space-y-2.5 border-b border-border p-3.5">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 shrink-0 text-accent" />
            <h2 className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-fg">
              Open Tabs
            </h2>
            <span
              className="shrink-0 rounded-pill border border-border bg-canvas px-1.5 py-0.5 font-mono text-[10px] text-fg-muted"
              title={
                pinnedTabs.length > 0
                  ? `${regularTabs.length} regular + ${pinnedTabs.length} pinned`
                  : `${regularTabs.length} open`
              }
            >
              {regularTabs.length}
              {pinnedTabs.length > 0 ? `+${pinnedTabs.length}p` : ''}
            </span>
          </div>
          <ClearTabsButton
            clearableCount={clearableCount}
            soundEffects={settings.soundEffects}
            motionMode={settings.motionMode}
            disabled={saving}
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="primary"
            size="sm"
            disabled={saving || eligibleTabs.length === 0}
            onClick={() => void handleSaveSession(false)}
            className="w-full px-2 text-xs"
            title="Save open tabs into a dated session collection and leave them open"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
            {saving ? 'Saving...' : 'Save Session'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={saving || eligibleTabs.length === 0}
            onClick={() => void handleSaveSession(true)}
            className="w-full px-2 text-xs"
            title="Save open tabs into a dated session collection and close them"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save &amp; Close
          </Button>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-fg-muted select-none hover:text-fg">
          <input
            type="checkbox"
            checked={settings.includePinnedInSessions}
            onChange={handleToggleIncludePinned}
            className="h-3.5 w-3.5 rounded border-border accent-[var(--stash-accent)] cursor-pointer"
          />
          <span>Include pinned tabs</span>
        </label>
      </div>

      {/* Scrollable Tabs List */}
      <div
        onScroll={dismissPreview}
        className="flex-1 space-y-3 overflow-y-auto p-2.5"
      >
        {tabs.length === 0 ? (
          <div className="rounded-card border border-dashed border-border px-3 py-6 text-center text-xs text-fg-muted">
            No other web tabs open in this window. Open a few sites to drag or
            save a session.
          </div>
        ) : (
          <>
            {pinnedTabs.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                  <span className="flex items-center gap-1">
                    <Pin className="h-2.5 w-2.5" />
                    Pinned
                  </span>
                  <span>
                    {settings.includePinnedInSessions ? 'included' : 'skipped'}
                  </span>
                </div>
                {pinnedTabs.map((tab, idx) => (
                  <OpenTabRow
                    key={tab.id}
                    tab={tab}
                    index={idx}
                    dimmed={!settings.includePinnedInSessions}
                    sweeping={
                      sessionSweeping && settings.includePinnedInSessions
                    }
                    hoverPreviews={settings.hoverPreviews}
                    collections={collections}
                    onQuickStashTab={onQuickStashTab}
                  />
                ))}
              </div>
            )}

            {regularTabs.length > 0 && (
              <div className="space-y-1">
                {pinnedTabs.length > 0 && (
                  <div className="px-2 pt-1 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                    Tabs ({regularTabs.length})
                  </div>
                )}
                {regularTabs.map((tab, idx) => (
                  <OpenTabRow
                    key={tab.id}
                    tab={tab}
                    index={
                      settings.includePinnedInSessions
                        ? pinnedTabs.length + idx
                        : idx
                    }
                    dimmed={false}
                    sweeping={sessionSweeping}
                    hoverPreviews={settings.hoverPreviews}
                    collections={collections}
                    onQuickStashTab={onQuickStashTab}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Hint Footer */}
      <div className="border-t border-border px-3.5 py-2 font-mono text-[10px] text-fg-muted">
        Drag any tab onto a collection
      </div>
    </aside>
  );
}
