import {
  FolderSync,
  Keyboard,
  Palette,
  SlidersHorizontal,
  Sparkles,
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
  label: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
}

const NAV_ITEMS: readonly NavItemSpec[] = [
  {
    id: 'general',
    label: 'General',
    description:
      'Workspace behavior, board width, sessions, and hover previews.',
    Icon: SlidersHorizontal,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description:
      'Built-in skins, Theme Studio, canvas backdrops, and wallpaper.',
    Icon: Palette,
  },
  {
    id: 'effects',
    label: 'Effects',
    description:
      'Motion physics, drop shockwaves, mechanical foley, and effect volume.',
    Icon: Zap,
  },
  {
    id: 'ai-rules',
    label: 'AI & Rules',
    description: 'Chrome Gemini Nano on-device AI and priority-ordered rules.',
    Icon: Sparkles,
  },
  {
    id: 'library-tools',
    label: 'Library Tools',
    description:
      'Health Check, Smart Reorganize, batch Auto-Icon, and Auto-Tag.',
    Icon: Wrench,
  },
  {
    id: 'shortcuts',
    label: 'Shortcuts',
    description:
      'Live Chrome global bindings, board navigation, and quick-capture tricks.',
    Icon: Keyboard,
  },
  {
    id: 'backup',
    label: 'Backup & Import',
    description: 'Portable JSON backups and Chrome or Netscape HTML imports.',
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
  return 'v1.16.1';
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
            dotClass: 'bg-amber-400',
            pillClass: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
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
      <DialogContent className="flex h-[min(86vh,640px)] w-[min(94vw,860px)] flex-col overflow-hidden p-0 md:flex-row">
        {/* Left Navigation Rail (collapses to horizontal strip on < md) */}
        <aside className="flex shrink-0 flex-col border-b border-border bg-canvas/60 md:w-[200px] md:border-b-0 md:border-r">
          <div className="px-4 pt-4 pb-2.5 pr-12 md:pr-4">
            <DialogTitle className="text-sm font-semibold tracking-tight text-fg">
              Stash Settings
            </DialogTitle>
            <DialogDescription className="sr-only">
              Configure workspace behavior, appearance, on-device AI, library
              tools, and backups.
            </DialogDescription>
          </div>

          <nav
            aria-label="Settings sections"
            className="flex gap-1 overflow-x-auto px-2.5 pb-2.5 md:flex-1 md:flex-col md:overflow-x-visible md:overflow-y-auto md:px-2.5 md:py-1"
          >
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const active = activeTab === id;
              const badgeCount =
                id === 'ai-rules' && rules.length > 0 ? rules.length : null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center justify-between gap-2 rounded-control px-2.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer md:w-full',
                    active
                      ? 'bg-accent text-accent-fg'
                      : 'text-fg-muted hover:bg-card hover:text-fg',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{label}</span>
                  </span>
                  {badgeCount !== null ? (
                    <span
                      className={cn(
                        'rounded-pill px-1.5 py-0.25 font-mono text-[10px]',
                        active
                          ? 'bg-black/20 text-accent-fg'
                          : 'border border-border bg-panel text-fg-muted',
                      )}
                    >
                      {badgeCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {/* Anchored Left-Rail Footer (desktop) */}
          <div className="hidden items-center justify-between gap-2 border-t border-border px-3.5 py-2.5 md:flex">
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

        {/* Scrollable Right Content Pane */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {currentNav ? (
            <div className="mb-4 pr-8">
              <h2 className="text-sm font-semibold tracking-tight text-fg">
                {currentNav.label}
              </h2>
              <p className="mt-0.5 text-xs text-fg-muted">
                {currentNav.description}
              </p>
            </div>
          ) : null}

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
      </DialogContent>
    </Dialog>
  );
}
