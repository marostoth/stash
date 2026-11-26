import { CustomAudioCard } from '@/components/settings/custom-audio-card';
import { EffectsSoundCard } from '@/components/settings/effects-sound-card';
import { playDrop } from '@/lib/audio/foley';
import type { StashSettings } from '@/lib/types/stash';

interface SoundsPanelProps {
  settings: StashSettings;
}

export function SoundsPanel({ settings }: SoundsPanelProps) {
  const triggerDropPreview = () => {
    playDrop(settings.soundEffects, settings.motionMode);
  };

  return (
    <div className="space-y-4">
      <EffectsSoundCard
        settings={settings}
        onTriggerTestSlam={triggerDropPreview}
      />
      <CustomAudioCard
        settings={settings}
        onTriggerTestSlam={triggerDropPreview}
      />
    </div>
  );
}
