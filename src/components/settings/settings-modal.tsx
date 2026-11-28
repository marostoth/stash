import {
  FolderSync,
  Keyboard,
  Palette,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  Wrench,
  Zap,
} from 'lucide-react';
import { type ComponentType, useEffect, useState } from 'react';
import { AiRulesPanel } from '@/components/settings/ai-rules-panel';
import { AppearancePanel } from '@/components/settings/appearance-panel';
import { BackupImportPanel } from '@/components/settings/backup-import-panel';
import { EffectsPanel } from '@/components/settings/effects-panel';
import { GeneralPanel } from '@/components/settings/general-panel';
import { LibraryToolsPanel } from '@/components/settings/library-tools-panel';
import { ShortcutsPanel } from '@/components/settings/shortcuts-panel';
import { SoundsPanel } from '@/components/settings/sounds-panel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { checkNanoAvailability } from '@/lib/categorizer/nano-engine';
import type { NanoAvailabilityStatus } from '@/lib/categorizer/types';
import type {
  CategorizationRule,
  Collection,
  LinkItem,
  Space,
  StashSettings,
  ThemeDefinition,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { type SettingsTab, useUiStore } from '@/store/ui-store';

interface SettingsModalProps {
  spaces: readonly Space[];
  collections: readonly Collection[];
  links: readonly LinkItem[];
  rules: readonly CategorizationRule[];
  settings: StashSettings;
  allThemes: readonly ThemeDefinition[];
  activeTheme: ThemeDefinition;
}

interface NavItemSpec {
  id: SettingsTab;
  group: 'Preferences' | 'Look & Feel' | 'Library & Data';
  label: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
}

const NAV_GROUPS = ['Preferences', 'Look & Feel', 'Library & Data'] as const;

const NAV_ITEMS: readonly NavItemSpec[] = [
  {
    id: 'general',
    group: 'Preferences',
    label: 'General',
    description:
      'Board layout, link opening behavior, sessions, and hover previews.',
    Icon: SlidersHorizontal,
  },
  {
    id: 'shortcuts',
    group: 'Preferences',
    label: 'Shortcuts',
    description:
      'Live Chrome global bindings, board navigation, and quick-capture tricks.',
    Icon: Keyboard,
  },
  {
    id: 'appearance',
    group: 'Look & Feel',
    label: 'Appearance',
    description:
      'Built-in skins, Theme Studio, canvas backdrops, and wallpaper.',
    Icon: Palette,
  },
  {
    id: 'effects',
    group: 'Look & Feel',
    label: 'Effects',
    description:
      'Motion feel, perimeter drop shockwaves, hover sheen, and action waves.',
    Icon: Zap,
  },
  {
    id: 'sounds',
    group: 'Look & Feel',
    label: 'Sounds',
    description:
      'Synthesized sound packs, volume, audition board, and custom audio clips.',
    Icon: Volume2,
  },
  {
    id: 'ai-rules',
    group: 'Library & Data',
    label: 'AI & Rules',
    description: 'Chrome Gemini Nano on-device AI and priority-ordered rules.',
    Icon: Sparkles,
  },
  {
    id: 'library-tools',
    group: 'Library & Data',
    label: 'Library Tools',
    description:
      'Health Check, duplicates, AI maintenance sweeps, and 7-day Trash.',
    Icon: Wrench,
  },
  {
    id: 'backup',
    group: 'Library & Data',
    label: 'Backup & Import',
    description:
      'Portable JSON backups, Netscape HTML export, and bookmark importers.',
    Icon: FolderSync,
  },
] as const;

function readExtensionVersion(): string {
  try {
    const version = browser.runtime?.getManifest?.().version;
    if (typeof version === 'string' && version.trim()) {
      return `v${version.trim()}`;
    }
  } catch {
    // Fallback outside extension runtime
  }
  return 'v1.27.0';
}

export function SettingsModal({
  spaces,
  collections,
  links,
  rules,
  settings,
  allThemes,
  activeTheme,
}: SettingsModalProps) {
  const open = useUiStore((s) => s.settingsOpen);
  const activeTab = useUiStore((s) => s.settingsTab);
  const setActiveTab = useUiStore((s) => s.setSettingsTab);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const openHealthCheck = useUiStore((s) => s.openHealthCheck);
  const openReorganize = useUiStore((s) => s.openReorganize);

  const [nanoStatus, setNanoStatus] =
    useState<NanoAvailabilityStatus>('unavailable');

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

  const currentNav =
    NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];
  const CurrentNavIcon = currentNav?.Icon;
  const versionLabel = readExtensionVersion();

  const nanoPill =
    nanoStatus === 'available'
      ? {
          label: 'Nano Ready',
          dotClass: 'bg-accent',
          pillClass: 'border-accent/40 bg-accent/10 text-accent',
        }
      : nanoStatus === 'downloadable' || nanoStatus === 'downloading'
        ? {
            label: 'Nano Download',
            dotClass: 'bg-warning',
            pillClass: 'border-warning/40 bg-warning/10 text-warning',
          }
        : {
            label: 'Nano Off',
            dotClass: 'bg-fg-muted/60',
            pillClass: 'border-border bg-panel text-fg-muted',
          };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeSettings();
      }}
    >
      <DialogContent className="flex h-[min(88vh,820px)] w-[min(94vw,1120px)] flex-col overflow-hidden p-0 md:flex-row">
        {/* Left Navigation Rail (collapses to horizontal strip on < md) */}
        <aside className="flex shrink-0 flex-col border-b border-border bg-canvas/60 md:w-[232px] md:border-b-0 md:border-r">
          <div className="flex h-[68px] shrink-0 items-center border-b border-border/80 px-5 pr-12 md:pr-5">
            <DialogTitle className="text-[15px] font-semibold tracking-tight text-fg">
              Stash Settings
            </DialogTitle>
            <DialogDescription className="sr-only">
              Configure workspace behavior, appearance, on-device AI, library
              tools, and backups.
            </DialogDescription>
          </div>

          <nav
            aria-label="Settings sections"
            className="flex gap-1 overflow-x-auto px-3 py-2.5 md:flex-1 md:flex-col md:gap-4 md:overflow-x-visible md:overflow-y-auto md:px-3 md:py-4"
          >
            {NAV_GROUPS.map((group) => {
              const items = NAV_ITEMS.filter((item) => item.group === group);
              return (
                <div
                  key={group}
                  className="flex shrink-0 items-center gap-1 md:flex-col md:items-stretch md:gap-0.5"
                >
                  <div className="hidden px-2.5 pb-1 font-mono text-[10px] font-medium uppercase tracking-widest text-fg-muted/75 md:block">
                    {group}
                  </div>
                  {items.map(({ id, label, Icon }) => {
                    const active = activeTab === id;
                    const badgeCount =
                      id === 'ai-rules' && rules.length > 0
                        ? rules.length
                        : null;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveTab(id)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'relative flex shrink-0 items-center justify-between gap-2 rounded-control px-2.5 py-2 text-left text-[13px] font-medium transition-colors cursor-pointer md:w-full',
                          active
                            ? 'bg-elevated text-fg'
                            : 'text-fg-muted hover:bg-card/70 hover:text-fg',
                        )}
                      >
                        {active && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-1.5 left-0 hidden w-[2px] rounded-full bg-accent md:block"
                          />
                        )}
                        <span className="flex items-center gap-2.5">
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0',
                              active ? 'text-fg' : 'text-fg-muted',
                            )}
                          />
                          <span className="whitespace-nowrap">{label}</span>
                        </span>
                        {badgeCount !== null ? (
                          <span
                            className={cn(
                              'rounded-pill border px-1.5 py-0.25 font-mono text-[10px]',
                              active
                                ? 'border-hairline bg-panel text-fg'
                                : 'border-border bg-panel text-fg-muted',
                            )}
                          >
                            {badgeCount}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Anchored Left-Rail Footer (desktop) */}
          <div className="hidden items-center justify-between gap-2 border-t border-border/80 px-4 py-3 md:flex">
            <span className="font-mono text-[10px] text-fg-muted">
              {versionLabel}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-pill border px-2 py-0.5 font-mono text-[10px]',
                nanoPill.pillClass,
              )}
              title={`Chrome Gemini Nano status: ${nanoStatus}`}
            >
              <span
                aria-hidden="true"
                className={cn('h-1.5 w-1.5 rounded-full', nanoPill.dotClass)}
              />
              {nanoPill.label}
            </span>
          </div>
        </aside>

        {/* Right Content Column: Docked Header + Scroll-Faded Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {currentNav ? (
            <header className="flex h-[68px] shrink-0 items-center gap-3.5 border-b border-border/80 bg-panel/95 px-7 pr-14 sm:px-8 sm:pr-14">
              {CurrentNavIcon ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-border/80 bg-canvas/85 text-accent">
                  <CurrentNavIcon className="h-4 w-4" aria-hidden="true" />
                </div>
              ) : null}
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-semibold tracking-tight text-fg">
                  {currentNav.label}
                </h2>
                <p className="truncate text-xs text-fg-muted">
                  {currentNav.description}
                </p>
              </div>
            </header>
          ) : null}

          <div className="relative min-h-0 flex-1 overflow-hidden">
            {/* Soft top & bottom edge fades so scrolled cards glide cleanly under header */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-panel to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-panel to-transparent"
            />

            <div className="h-full overflow-y-auto px-7 py-6 sm:px-8 sm:py-7">
              {activeTab === 'general' ? (
                <GeneralPanel settings={settings} settingsOpen={open} />
              ) : activeTab === 'appearance' ? (
                <AppearancePanel
                  allThemes={allThemes}
                  activeTheme={activeTheme}
                  settings={settings}
                />
              ) : activeTab === 'effects' ? (
                <EffectsPanel settings={settings} />
              ) : activeTab === 'sounds' ? (
                <SoundsPanel settings={settings} />
              ) : activeTab === 'ai-rules' ? (
                <AiRulesPanel
                  collections={collections}
                  rules={rules}
                  settings={settings}
                  nanoStatus={nanoStatus}
                  onNanoStatusChange={setNanoStatus}
                />
              ) : activeTab === 'library-tools' ? (
                <LibraryToolsPanel
                  spaces={spaces}
                  collections={collections}
                  links={links}
                  nanoStatus={nanoStatus}
                  onOpenHealthCheck={openHealthCheck}
                  onOpenReorganize={openReorganize}
                />
              ) : activeTab === 'shortcuts' ? (
                <ShortcutsPanel settingsOpen={open} />
              ) : (
                <BackupImportPanel
                  settings={settings}
                  spaces={spaces}
                  linkCount={links.length}
                  collectionCount={collections.length}
                />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
