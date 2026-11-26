import { Sliders } from 'lucide-react';
import {
  SettingsSectionCard,
  SettingsToggleRow,
} from '@/components/settings/settings-section-card';
import { isArcadeMotion, isTactileMotion } from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import type { StashSettings } from '@/lib/types/stash';

interface EffectsTogglesCardProps {
  settings: StashSettings;
}

export function EffectsTogglesCard({ settings }: EffectsTogglesCardProps) {
  const arcade = isArcadeMotion(settings.motionMode);
  const tactile = isTactileMotion(settings.motionMode);
  const enabledCount = [
    settings.fxDeskJolt ?? true,
    settings.fxDragTilt ?? true,
    settings.fxHoverSheen ?? true,
    settings.fxAmbientWaves ?? true,
  ].filter(Boolean).length;

  return (
    <SettingsSectionCard
      icon={<Sliders className="h-4 w-4" />}
      title="Fine-Tune Physics & Waves"
      subtitle="Toggle individual tactile layers while keeping your selected Motion Feel."
      badge={{
        label: tactile ? `${enabledCount} / 4 on` : 'Paused',
        tone: tactile && enabledCount > 0 ? 'accent' : 'neutral',
      }}
    >
      <div className="divide-y divide-border/55">
        <SettingsToggleRow
          id="fx-desk-jolt"
          label="Neighbor ripple / desk jolt"
          hint={
            arcade
              ? 'Nearby cards flinch outward radially when you slam a card down.'
              : 'Arcade mode only — nearby cards flinch outward on heavy drops.'
          }
          checked={settings.fxDeskJolt ?? true}
          onCheckedChange={(checked) =>
            void stashRepo.updateSettings({ fxDeskJolt: checked })
          }
        />

        <SettingsToggleRow
          id="fx-drag-tilt"
          label="Velocity drag tilt"
          hint="Cards, tabs, and collections lean naturally into your cursor direction while dragging."
          checked={settings.fxDragTilt ?? true}
          onCheckedChange={(checked) =>
            void stashRepo.updateSettings({ fxDragTilt: checked })
          }
        />

        <SettingsToggleRow
          id="fx-hover-sheen"
          label="3D hover tilt & specular sheen"
          hint="Cursor-following light reflection and subtle 3D perspective tilt on link cards (full foil in Arcade, soft matte in Tactile)."
          checked={settings.fxHoverSheen ?? true}
          onCheckedChange={(checked) =>
            void stashRepo.updateSettings({ fxHoverSheen: checked })
          }
        />

        <SettingsToggleRow
          id="fx-ambient-waves"
          label="Action waves & rolling totals"
          hint="Star shimmer burst, Wake Up ignition wave, Save Session deck sweep, Space pill +1 swallow, directional Space slide, Quick Stash stamp, and odometer totals."
          checked={settings.fxAmbientWaves ?? true}
          onCheckedChange={(checked) =>
            void stashRepo.updateSettings({ fxAmbientWaves: checked })
          }
        />
      </div>
    </SettingsSectionCard>
  );
}
