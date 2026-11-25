import { Command, ExternalLink, Globe, Layers, Search } from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useState } from 'react';
import { SettingsSectionCard } from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import {
  detectPlatform,
  FALLBACK_GLOBAL_COMMANDS,
  formatShortcutTokens,
  type GlobalChromeCommandInfo,
  SHORTCUT_GROUPS,
  type ShortcutGroup,
} from '@/lib/shortcuts/shortcut-catalog';

interface ShortcutsPanelProps {
  settingsOpen: boolean;
}

const GROUP_ICON: Record<ShortcutGroup['id'], ReactNode> = {
  'board-search': <Search className="h-4 w-4" />,
  'cards-previews': <Layers className="h-4 w-4" />,
  'chrome-native': <Globe className="h-4 w-4" />,
};

function Keycap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[22px] items-center justify-center rounded border border-border bg-canvas/80 px-1.5 py-0.5 font-mono text-[11px] leading-tight text-fg shadow-[inset_0_-1px_0_rgba(0,0,0,0.35)]">
      {children}
    </kbd>
  );
}

function KeyChord({
  tokens,
  joiner = '+',
}: {
  tokens: readonly string[];
  joiner?: '+' | '/' | ' ';
}) {
  const seen = new Map<string, number>();
  const keyedTokens = tokens.map((token) => {
    const count = (seen.get(token) ?? 0) + 1;
    seen.set(token, count);
    return { token, key: `${token}:${count}` };
  });

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {keyedTokens.map((entry, idx) => (
        <Fragment key={entry.key}>
          {idx > 0 && joiner !== ' ' ? (
            <span className="font-mono text-[10px] text-fg-muted">
              {joiner}
            </span>
          ) : null}
          <Keycap>{entry.token}</Keycap>
        </Fragment>
      ))}
    </span>
  );
}

export function ShortcutsPanel({ settingsOpen }: ShortcutsPanelProps) {
  const [commands, setCommands] = useState<GlobalChromeCommandInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const platform = detectPlatform();

  useEffect(() => {
    if (!settingsOpen) return;
    let active = true;

    const loadCommands = async () => {
      try {
        if (typeof browser !== 'undefined' && browser.commands?.getAll) {
          const raw = await browser.commands.getAll();
          const filtered = raw
            .filter(
              (cmd) =>
                typeof cmd.name === 'string' &&
                cmd.name.length > 0 &&
                cmd.name !== '_execute_action',
            )
            .map((cmd) => ({
              name: cmd.name ?? '',
              description: cmd.description?.trim() || cmd.name || '',
              shortcut: cmd.shortcut?.trim() ?? '',
            }));
          if (active) {
            setCommands(
              filtered.length > 0 ? filtered : [...FALLBACK_GLOBAL_COMMANDS],
            );
            setLoaded(true);
          }
          return;
        }
      } catch {
        // Fallback outside Chrome extension runtime
      }

      if (active) {
        setCommands([...FALLBACK_GLOBAL_COMMANDS]);
        setLoaded(true);
      }
    };

    void loadCommands();
    return () => {
      active = false;
    };
  }, [settingsOpen]);

  const handleOpenChromeShortcuts = () => {
    if (typeof browser !== 'undefined' && browser.tabs?.create) {
      void browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Live Global Chrome Commands */}
      <SettingsSectionCard
        icon={<Command className="h-4 w-4" />}
        title="Global Chrome Shortcuts"
        subtitle="Active system-wide bindings registered with Chrome. Remap or resolve conflicts directly in Chrome's extension shortcuts page."
        headerAction={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleOpenChromeShortcuts}
            className="h-7 gap-1.5 px-2.5 text-[11px]"
          >
            <span>Customize in Chrome</span>
            <ExternalLink className="h-3 w-3 text-accent" />
          </Button>
        }
      >
        <div className="divide-y divide-border/70">
          {!loaded ? (
            <div className="py-2 font-mono text-[11px] text-fg-muted">
              Loading Chrome shortcuts...
            </div>
          ) : (
            commands.map((cmd) => {
              const tokens = formatShortcutTokens(cmd.shortcut, platform);
              return (
                <div
                  key={cmd.name}
                  className="flex items-center justify-between gap-3 py-2 first:pt-0.5 last:pb-0.5"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-fg">
                      {cmd.description}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {tokens.length > 0 ? (
                      <KeyChord tokens={tokens} joiner="+" />
                    ) : (
                      <span className="rounded-pill border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] text-amber-400">
                        Unassigned
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SettingsSectionCard>

      {/* Static In-App & Chrome-Native Shortcut Groups */}
      {SHORTCUT_GROUPS.map((group) => (
        <SettingsSectionCard
          key={group.id}
          icon={GROUP_ICON[group.id]}
          title={group.title}
          subtitle={group.subtitle}
        >
          <div className="divide-y divide-border/70">
            {group.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0.5 last:pb-0.5"
              >
                <span className="text-xs text-fg">{item.label}</span>
                <span className="inline-flex shrink-0 items-center gap-1.5">
                  <KeyChord tokens={item.keys} joiner={item.joiner ?? '+'} />
                  {item.qualifier ? (
                    <span className="font-mono text-[10px] text-fg-muted">
                      ({item.qualifier})
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </SettingsSectionCard>
      ))}
    </div>
  );
}
