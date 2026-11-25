import { Sparkles, Volume2 } from 'lucide-react';
import { BackdropStudioCard } from '@/components/settings/backdrop-studio-card';
import {
  SettingsSectionCard,
  SettingsToggleRow,
} from '@/components/settings/settings-section-card';
import { ThemesPanel } from '@/components/settings/themes-panel';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { playDrop } from '@/lib/audio/foley';
import { stashRepo } from '@/lib/storage/repo';
import type {
  MotionMode,
  StashSettings,
  ThemeDefinition,
} from '@/lib/types/stash';

interface AppearancePanelProps {
  allThemes: readonly ThemeDefinition[];
  activeTheme: ThemeDefinition;
  settings: StashSettings;
}

export function AppearancePanel({
  allThemes,
  activeTheme,
  settings,
}: AppearancePanelProps) {
  return (
    <div className="space-y-4">
      <ThemesPanel
        allThemes={allThemes}
        activeTheme={activeTheme}
        settings={settings}
      />

      <BackdropStudioCard activeTheme={activeTheme} settings={settings} />

      <SettingsSectionCard
        icon={<Sparkles className="h-4 w-4" />}
        title="Motion & Sound FX"
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3 py-1">
            <label
              htmlFor="settings-motion-mode"
              className="text-xs text-fg select-none"
            >
              Motion feel
            </label>
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

          <SettingsToggleRow
            id="settings-sound-fx"
            label="Mechanical sound effects"
            checked={settings.soundEffects}
            onCheckedChange={(checked) => {
              void stashRepo.updateSettings({ soundEffects: checked });
              if (checked) {
                playDrop(true, settings.motionMode);
              }
            }}
            extraControl={
              <Button
                variant="ghost"
                size="sm"
                disabled={!settings.soundEffects}
                onClick={() => playDrop(true, settings.motionMode)}
                className="h-7 gap-1 px-2 text-[11px]"
                title="Play test card-snap click"
              >
                <Volume2 className="h-3.5 w-3.5 text-accent" />
                Test Sound
              </Button>
            }
          />
        </div>
      </SettingsSectionCard>
    </div>
  );
}
