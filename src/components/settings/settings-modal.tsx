import {
  Cpu,
  Download,
  FolderSync,
  Loader2,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { BackupImportPanel } from '@/components/settings/backup-import-panel';
import { MaintenanceCard } from '@/components/settings/maintenance-card';
import { PreviewsSettingsCard } from '@/components/settings/previews-settings-card';
import { RulesManager } from '@/components/settings/rules-manager';
import { ThemesPanel } from '@/components/settings/themes-panel';
import { InlineProgressPill } from '@/components/ui/ai-activity-panel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/input';
import { useAutoTagSweep } from '@/hooks/use-auto-tag-sweep';
import { playDrop } from '@/lib/audio/foley';
import { checkNanoAvailability } from '@/lib/categorizer/nano-engine';
import type { NanoAvailabilityStatus } from '@/lib/categorizer/types';
import { startNanoModelDownload } from '@/lib/jobs/background-sweeps';
import { stashRepo } from '@/lib/storage/repo';
import { filterEligibleLinks } from '@/lib/tagging/auto-tagger';
import type {
  BoardWidthMode,
  CategorizationRule,
  Collection,
  LinkItem,
  MotionMode,
  StashSettings,
  ThemeDefinition,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { useBackgroundJobsStore } from '@/store/background-jobs-store';
import { useUiStore } from '@/store/ui-store';

interface SettingsModalProps {
  collections: readonly Collection[];
  links: readonly LinkItem[];
  rules: readonly CategorizationRule[];
  settings: StashSettings;
  allThemes: readonly ThemeDefinition[];
  activeTheme: ThemeDefinition;
}

type SettingsTab = 'rules' | 'backup' | 'themes' | 'general';

export function SettingsModal({
  collections,
  links,
  rules,
  settings,
  allThemes,
  activeTheme,
}: SettingsModalProps) {
  const open = useUiStore((s) => s.settingsOpen);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const openHealthCheck = useUiStore((s) => s.openHealthCheck);
  const openReorganize = useUiStore((s) => s.openReorganize);

  const [activeTab, setActiveTab] = useState<SettingsTab>('rules');
  const [nanoStatus, setNanoStatus] =
    useState<NanoAvailabilityStatus>('unavailable');
  const downloadJob = useBackgroundJobsStore((s) =>
    s.jobs.find((job) => job.id === 'nano-download'),
  );
  const downloadProgress =
    downloadJob?.status === 'running'
      ? (downloadJob.progress?.current ?? 0)
      : null;
  const autoTagAll = useAutoTagSweep();
  const untaggedCount = filterEligibleLinks(links).length;

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    checkNanoAvailability()
      .then((status) => {
        if (mounted) setNanoStatus(status);
      })
      .catch(() => {
        if (mounted) setNanoStatus('unavailable');
      });
    return () => {
      mounted = false;
    };
  }, [open]);

  const handleDownloadModel = async () => {
    await startNanoModelDownload((refreshed) => setNanoStatus(refreshed));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeSettings();
      }}
    >
      <DialogContent className="flex max-h-[85vh] w-[min(94vw,720px)] flex-col overflow-hidden">
        <DialogHeader className="mb-3 shrink-0">
          <DialogTitle>Stash Settings</DialogTitle>
          <DialogDescription>
            Manage auto-categorization rules, backups, bookmark imports, custom
            themes, and preferences.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Bar */}
        <div className="mb-4 flex shrink-0 flex-wrap items-center gap-1 border-b border-border pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer',
              activeTab === 'rules'
                ? 'bg-accent text-accent-fg'
                : 'text-fg-muted hover:bg-card hover:text-fg',
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Auto-Rules ({rules.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer',
              activeTab === 'backup'
                ? 'bg-accent text-accent-fg'
                : 'text-fg-muted hover:bg-card hover:text-fg',
            )}
          >
            <FolderSync className="h-3.5 w-3.5" />
            Backup &amp; Import
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('themes')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer',
              activeTab === 'themes'
                ? 'bg-accent text-accent-fg'
                : 'text-fg-muted hover:bg-card hover:text-fg',
            )}
          >
            <Palette className="h-3.5 w-3.5" />
            Themes ({allThemes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer',
              activeTab === 'general'
                ? 'bg-accent text-accent-fg'
                : 'text-fg-muted hover:bg-card hover:text-fg',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            General &amp; AI
          </button>
        </div>

        {/* Tab Body */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {activeTab === 'rules' ? (
            <RulesManager rules={rules} collections={collections} />
          ) : activeTab === 'backup' ? (
            <BackupImportPanel />
          ) : activeTab === 'themes' ? (
            <ThemesPanel
              allThemes={allThemes}
              activeTheme={activeTheme}
              settings={settings}
            />
          ) : (
            <div className="space-y-4">
              {/* General Behavior */}
              <div className="space-y-2.5 rounded-card border border-border bg-canvas p-4">
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                  Workspace Behavior
                </h3>

                <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-xs text-fg">
                  <span>Open saved links in a new tab</span>
                  <input
                    type="checkbox"
                    checked={settings.openLinkInNewTab}
                    onChange={() =>
                      void stashRepo.updateSettings({
                        openLinkInNewTab: !settings.openLinkInNewTab,
                      })
                    }
                    className="h-4 w-4 accent-[var(--stash-accent)] cursor-pointer"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-xs text-fg">
                  <span>Compact card density</span>
                  <input
                    type="checkbox"
                    checked={settings.density === 'compact'}
                    onChange={() =>
                      void stashRepo.updateSettings({
                        density:
                          settings.density === 'compact'
                            ? 'comfortable'
                            : 'compact',
                      })
                    }
                    className="h-4 w-4 accent-[var(--stash-accent)] cursor-pointer"
                  />
                </label>

                <div className="flex items-center justify-between gap-3 py-1 text-xs text-fg">
                  <label htmlFor="settings-board-width">Board width</label>
                  <Select
                    id="settings-board-width"
                    value={settings.boardWidth}
                    onChange={(e) =>
                      void stashRepo.updateSettings({
                        boardWidth: e.target.value as BoardWidthMode,
                      })
                    }
                    className="h-8 w-36 text-xs"
                  >
                    <option value="standard">Standard</option>
                    <option value="wide">Ultrawide</option>
                  </Select>
                </div>

                <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-xs text-fg">
                  <span>Include pinned tabs when saving sessions</span>
                  <input
                    type="checkbox"
                    checked={settings.includePinnedInSessions}
                    onChange={() =>
                      void stashRepo.updateSettings({
                        includePinnedInSessions:
                          !settings.includePinnedInSessions,
                      })
                    }
                    className="h-4 w-4 accent-[var(--stash-accent)] cursor-pointer"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-xs text-fg">
                  <span>Close tab after Side Panel quick-stash</span>
                  <input
                    type="checkbox"
                    checked={settings.closeTabOnQuickStash}
                    onChange={() =>
                      void stashRepo.updateSettings({
                        closeTabOnQuickStash: !settings.closeTabOnQuickStash,
                      })
                    }
                    className="h-4 w-4 accent-[var(--stash-accent)] cursor-pointer"
                  />
                </label>
              </div>

              {/* Tactile Motion & Audio Foley */}
              <div className="space-y-2.5 rounded-card border border-border bg-canvas p-4">
                <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                  Motion &amp; Sound FX
                </h3>

                <div className="flex items-center justify-between gap-3 py-1 text-xs text-fg">
                  <label htmlFor="settings-motion-mode">Motion feel</label>
                  <Select
                    id="settings-motion-mode"
                    value={settings.motionMode}
                    onChange={(e) =>
                      void stashRepo.updateSettings({
                        motionMode: e.target.value as MotionMode,
                      })
                    }
                    className="h-8 w-36 text-xs"
                  >
                    <option value="arcade">Arcade</option>
                    <option value="tactile">Tactile</option>
                    <option value="reduced">Reduced</option>
                    <option value="off">Off</option>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-3 py-1 text-xs text-fg">
                  <label
                    htmlFor="settings-sound-fx"
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <span>Mechanical sound effects</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!settings.soundEffects}
                      onClick={() => playDrop(true)}
                      className="h-7 gap-1 px-2 text-[11px]"
                      title="Play test card-snap click"
                    >
                      <Volume2 className="h-3.5 w-3.5 text-accent" />
                      Test Sound
                    </Button>
                    <input
                      id="settings-sound-fx"
                      type="checkbox"
                      checked={settings.soundEffects}
                      onChange={() => {
                        const nextEnabled = !settings.soundEffects;
                        void stashRepo.updateSettings({
                          soundEffects: nextEnabled,
                        });
                        if (nextEnabled) {
                          playDrop(true);
                        }
                      }}
                      className="h-4 w-4 accent-[var(--stash-accent)] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Opt-in Hover & Visual Previews */}
              <PreviewsSettingsCard settings={settings} settingsOpen={open} />

              {/* Library Maintenance */}
              <MaintenanceCard
                collections={collections}
                links={links}
                nanoStatus={nanoStatus}
                onOpenHealthCheck={openHealthCheck}
                onOpenReorganize={openReorganize}
              />

              {/* Tier 2 On-Device AI */}
              <div className="space-y-3 rounded-card border border-border bg-canvas p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-accent" />
                    <h3 className="text-xs font-semibold text-fg">
                      On-Device AI (Chrome Gemini Nano)
                    </h3>
                  </div>
                  <span
                    className={cn(
                      'rounded-pill border px-2 py-0.5 font-mono text-[10px] uppercase',
                      nanoStatus === 'available'
                        ? 'border-accent/40 bg-accent/15 text-accent'
                        : 'border-border bg-panel text-fg-muted',
                    )}
                  >
                    {nanoStatus}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-fg-muted">
                  Runs locally inside Chrome when no Tier 1 rule matches to
                  suggest an existing collection or a new category, up to 3
                  tags, and a short summary note. Never sends your bookmarks to
                  external servers.
                </p>

                <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-fg">
                  <span>Use On-Device AI fallback when available</span>
                  <input
                    type="checkbox"
                    checked={settings.enableOnDeviceAi}
                    onChange={() =>
                      void stashRepo.updateSettings({
                        enableOnDeviceAi: !settings.enableOnDeviceAi,
                      })
                    }
                    className="h-4 w-4 accent-[var(--stash-accent)] cursor-pointer"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-fg">
                  <span>Auto-tag manually added links</span>
                  <input
                    type="checkbox"
                    checked={settings.autoTagOnSave}
                    onChange={() =>
                      void stashRepo.updateSettings({
                        autoTagOnSave: !settings.autoTagOnSave,
                      })
                    }
                    className="h-4 w-4 accent-[var(--stash-accent)] cursor-pointer"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {autoTagAll.running ? (
                    <InlineProgressPill
                      label={`Tagging ${autoTagAll.progress?.current ?? 1} / ${autoTagAll.progress?.total ?? untaggedCount}...`}
                      current={autoTagAll.progress?.current ?? 1}
                      total={autoTagAll.progress?.total ?? untaggedCount}
                      onCancel={autoTagAll.cancel}
                      className="h-8 px-2.5 text-xs"
                    />
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={
                        untaggedCount === 0 || nanoStatus !== 'available'
                      }
                      onClick={() => void autoTagAll.start()}
                      className="gap-1.5"
                    >
                      <Tag className="h-3.5 w-3.5 text-accent" />
                      Auto-Tag All Untagged ({untaggedCount})
                    </Button>
                  )}

                  {nanoStatus === 'downloadable' && (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={downloadProgress !== null}
                      onClick={() => void handleDownloadModel()}
                    >
                      {downloadProgress !== null ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {downloadProgress !== null
                        ? `Downloading model (${downloadProgress}%)...`
                        : 'Enable On-Device AI (Download Model)'}
                    </Button>
                  )}
                </div>

                {downloadProgress !== null ? (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between font-mono text-[10px] text-fg-muted">
                      <span>Downloading Chrome Gemini Nano model...</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel">
                      <div
                        className="h-full rounded-full bg-accent transition-[width] duration-150"
                        style={{ width: `${Math.min(100, downloadProgress)}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
