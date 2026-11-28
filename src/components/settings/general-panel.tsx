import { AppWindow, LayoutGrid } from 'lucide-react';
import { PreviewsSettingsCard } from '@/components/settings/previews-settings-card';
import {
  SettingsControlRow,
  SettingsSectionCard,
  SettingsToggleRow,
} from '@/components/settings/settings-section-card';
import { Select } from '@/components/ui/input';
import { stashRepo } from '@/lib/storage/repo';
import type {
  BoardWidthMode,
  CardDensity,
  StashSettings,
} from '@/lib/types/stash';
import { COMMON_CURRENCIES } from '@/lib/utils/price-math';
import { useUiStore } from '@/store/ui-store';

interface GeneralPanelProps {
  settings: StashSettings;
  settingsOpen: boolean;
}

export function GeneralPanel({ settings, settingsOpen }: GeneralPanelProps) {
  return (
    <div className="space-y-6">
      {/* 1. Board & Layout */}
      <SettingsSectionCard
        icon={<LayoutGrid className="h-4 w-4" />}
        title="Board & Layout"
        subtitle="Control card spacing, canvas width, and optional floating strips above your collections."
      >
        <div className="divide-y divide-border/55">
          <SettingsControlRow
            htmlFor="settings-card-density"
            label="Card density"
            hint="Choose how much metadata and breathing room each link card shows."
            control={
              <Select
                id="settings-card-density"
                value={settings.density}
                onChange={(e) =>
                  void stashRepo.updateSettings({
                    density: e.target.value as CardDensity,
                  })
                }
                className="h-8 w-40 text-xs"
              >
                <option value="micro">Micro</option>
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
              </Select>
            }
          />

          <SettingsControlRow
            htmlFor="settings-board-width"
            label="Board width"
            hint="Standard keeps a focused reading measure; Ultrawide expands for large monitors."
            control={
              <Select
                id="settings-board-width"
                value={settings.boardWidth}
                onChange={(e) =>
                  void stashRepo.updateSettings({
                    boardWidth: e.target.value as BoardWidthMode,
                  })
                }
                className="h-8 w-40 text-xs"
              >
                <option value="standard">Standard</option>
                <option value="wide">Ultrawide</option>
              </Select>
            }
          />

          <SettingsToggleRow
            id="settings-quick-launch-bar"
            label="Show Quick Links strip"
            hint="Optional 1-click Quick Launch row at the top of the board for pinned or starred sites."
            checked={settings.quickLaunchVisible === true}
            onCheckedChange={(checked) =>
              void stashRepo.updateSettings({ quickLaunchVisible: checked })
            }
          />

          <SettingsToggleRow
            id="settings-tag-filter-bar"
            label="Show Quick Tag filter bar"
            hint="Optional clickable #tag chips above your collections (and in the Side Panel) for 1-click slicing."
            checked={settings.tagBarVisible === true}
            onCheckedChange={(checked) => {
              if (!checked) {
                useUiStore.getState().clearSelectedTags();
              }
              void stashRepo.updateSettings({ tagBarVisible: checked });
            }}
          />
        </div>
      </SettingsSectionCard>

      {/* 2. Links, Tabs & Shopping */}
      <SettingsSectionCard
        icon={<AppWindow className="h-4 w-4" />}
        title="Links, Tabs & Shopping"
        subtitle="How links launch, how open browser sessions are saved, and your default Shopping List currency."
      >
        <div className="divide-y divide-border/55">
          <SettingsToggleRow
            id="settings-open-new-tab"
            label="Open saved links in a new tab"
            hint="Keep your Stash board open in the background when launching a link."
            checked={settings.openLinkInNewTab}
            onCheckedChange={(checked) =>
              void stashRepo.updateSettings({ openLinkInNewTab: checked })
            }
          />

          <SettingsToggleRow
            id="settings-include-pinned"
            label="Include pinned tabs when saving sessions"
            hint="By default, Save Session skips Chrome pinned tabs so your daily anchors stay put."
            checked={settings.includePinnedInSessions}
            onCheckedChange={(checked) =>
              void stashRepo.updateSettings({
                includePinnedInSessions: checked,
              })
            }
          />

          <SettingsToggleRow
            id="settings-close-on-quick-stash"
            label="Close tab after Side Panel quick-stash"
            hint="Automatically close the current browser tab once it is saved from the Side Panel."
            checked={settings.closeTabOnQuickStash}
            onCheckedChange={(checked) =>
              void stashRepo.updateSettings({
                closeTabOnQuickStash: checked,
              })
            }
          />

          <SettingsControlRow
            htmlFor="settings-default-currency"
            label="Default currency"
            hint="Used for new price entries and Shopping List totals."
            control={
              <Select
                id="settings-default-currency"
                value={settings.defaultCurrency ?? 'GBP'}
                onChange={(e) =>
                  void stashRepo.updateSettings({
                    defaultCurrency: e.target.value,
                  })
                }
                className="h-8 w-40 text-xs"
              >
                {COMMON_CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.label}
                  </option>
                ))}
              </Select>
            }
          />
        </div>
      </SettingsSectionCard>

      {/* 3. Previews */}
      <PreviewsSettingsCard settings={settings} settingsOpen={settingsOpen} />
    </div>
  );
}
