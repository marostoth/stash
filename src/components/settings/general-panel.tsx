import { SlidersHorizontal } from 'lucide-react';
import { PreviewsSettingsCard } from '@/components/settings/previews-settings-card';
import {
  SettingsSectionCard,
  SettingsToggleRow,
} from '@/components/settings/settings-section-card';
import { Select } from '@/components/ui/input';
import { stashRepo } from '@/lib/storage/repo';
import type { BoardWidthMode, StashSettings } from '@/lib/types/stash';

interface GeneralPanelProps {
  settings: StashSettings;
  settingsOpen: boolean;
}

export function GeneralPanel({ settings, settingsOpen }: GeneralPanelProps) {
  return (
    <div className="space-y-4">
      <SettingsSectionCard
        icon={<SlidersHorizontal className="h-4 w-4" />}
        title="Workspace Behavior"
      >
        <div className="space-y-1">
          <SettingsToggleRow
            id="settings-open-new-tab"
            label="Open saved links in a new tab"
            checked={settings.openLinkInNewTab}
            onCheckedChange={(checked) =>
              void stashRepo.updateSettings({ openLinkInNewTab: checked })
            }
          />

          <SettingsToggleRow
            id="settings-compact-density"
            label="Compact card density"
            checked={settings.density === 'compact'}
            onCheckedChange={(checked) =>
              void stashRepo.updateSettings({
                density: checked ? 'compact' : 'comfortable',
              })
            }
          />

          <div className="flex items-center justify-between gap-3 py-1">
            <label
              htmlFor="settings-board-width"
              className="text-xs text-fg select-none"
            >
              Board width
            </label>
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

          <SettingsToggleRow
            id="settings-include-pinned"
            label="Include pinned tabs when saving sessions"
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
            checked={settings.closeTabOnQuickStash}
            onCheckedChange={(checked) =>
              void stashRepo.updateSettings({
                closeTabOnQuickStash: checked,
              })
            }
          />
        </div>
      </SettingsSectionCard>

      <PreviewsSettingsCard settings={settings} settingsOpen={settingsOpen} />
    </div>
  );
}
