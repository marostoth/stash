import { Archive, Layers, Loader2, Pin } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ClearTabsButton } from '@/components/workbench/clear-tabs-button';
import { OpenTabRow } from '@/components/workbench/open-tab-row';
import { playSessionFreeze } from '@/lib/audio/foley';
import { isArcadeMotion, isTactileMotion } from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import {
  type OpenTabInfo,
  selectTabsForSession,
} from '@/lib/tabs/session-filter';
import { closeTabs } from '@/lib/tabs/tab-actions';
import type { Collection, StashSettings } from '@/lib/types/stash';
import { spawnBulkPulseForSelector } from '@/lib/vfx/engine';
import { useFxStore } from '@/store/fx-store';
import { useOpenTabsStore } from '@/store/open-tabs-store';
import { useUiStore } from '@/store/ui-store';

interface OpenTabsSidebarProps {
  collections: readonly Collection[];
  activeSpaceId: string;
  settings: StashSettings;
  onQuickStashTab: (tab: OpenTabInfo, collectionId: string) => Promise<void>;
}

export function OpenTabsSidebar({
  collections,
  activeSpaceId,
  settings,
  onQuickStashTab,
}: OpenTabsSidebarProps) {
  const tabs = useOpenTabsStore((s) => s.tabs);
  const pinnedTabs = useOpenTabsStore((s) => s.pinnedTabs);
  const regularTabs = useOpenTabsStore((s) => s.regularTabs);
  const clearableCount = useOpenTabsStore((s) => s.clearableCount);
  const [saving, setSaving] = useState(false);
  const triggerCollectionCascade = useUiStore(
    (s) => s.triggerCollectionCascade,
  );
  const dismissPreview = useUiStore((s) => s.dismissPreview);
  const sessionSweeping = useFxStore((s) => s.sessionSweeping);
  const setSessionSweeping = useFxStore((s) => s.setSessionSweeping);
  const triggerCollectionSlam = useFxStore((s) => s.triggerCollectionSlam);
  const triggerContainerShake = useFxStore((s) => s.triggerContainerShake);
  const triggerSidebarSweep = useFxStore((s) => s.triggerSidebarSweep);
  const sidebarSweepSeq = useFxStore((s) => s.sidebarSweepSeq);
  const arcade = isArcadeMotion(settings.motionMode);
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
      if (arcade && settings.fxDeskJolt !== false) {
        triggerContainerShake('heavy');
      }
      if (arcade && settings.fxAmbientWaves !== false) {
        triggerSidebarSweep();
        spawnBulkPulseForSelector('[data-stash-sidebar="open-tabs"]', 0);
      }

      if (closeAfterSave) {
        try {
          await closeTabs(saved.closableTabs.map((t) => t.id));
        } catch {
          // Session is already safely persisted; ignore closed-tab race errors
        }
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
    } catch {
      toast.error('Could not save tab session. Please try again.');
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
      data-stash-sidebar="open-tabs"
      aria-label="Open tabs"
      className="relative flex w-[280px] shrink-0 flex-col overflow-hidden border-l border-hairline bg-panel/70"
    >
      {arcade && settings.fxAmbientWaves !== false && sidebarSweepSeq > 0 && (
        <div
          key={`sidebar-sweep-${sidebarSweepSeq}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
        >
          <div className="stash-action-sweep absolute inset-y-0 w-2/3" />
        </div>
      )}
      {/* Sidebar Header & Session Controls */}
      <div className="space-y-2.5 border-b border-hairline p-3.5">
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
            fxDeskJolt={settings.fxDeskJolt ?? true}
            fxAmbientWaves={settings.fxAmbientWaves ?? true}
            disabled={saving}
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            disabled={saving || eligibleTabs.length === 0}
            onClick={() => void handleSaveSession(false)}
            className="w-full px-2 text-xs"
            title="Save open tabs into a dated session collection and leave them open"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Archive className="h-3.5 w-3.5 text-fg-muted" />
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
      <div className="border-t border-hairline px-3.5 py-2 font-mono text-[10px] text-fg-muted">
        Drag any tab onto a collection
      </div>
    </aside>
  );
}
