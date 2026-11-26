import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  SettingsSectionCard,
  SettingsToggleRow,
} from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import {
  playDelete,
  playDrop,
  playError,
  playPickup,
  playSessionFreeze,
  playTagPop,
  setSoundPack,
  setSoundVolume,
} from '@/lib/audio/foley';
import { stashRepo } from '@/lib/storage/repo';
import type { SoundPack, StashSettings } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import {
  createDebouncedWriter,
  type DebouncedWriter,
} from '@/lib/utils/coalesce';

interface EffectsSoundCardProps {
  settings: StashSettings;
  onTriggerTestSlam: () => void;
}

const SOUND_PACK_OPTIONS: ReadonlyArray<{
  id: SoundPack;
  label: string;
  badge?: string;
  description: string;
}> = [
  {
    id: 'arpg-heavy',
    label: 'Heavy Stone & Iron',
    badge: 'Cinematic',
    description:
      'Seismic shockwave slam, forged iron resonance, stereo dust grit, crystal chimes, and dark stone-hall reverb.',
  },
  {
    id: 'studio-desk',
    label: 'Studio Desk',
    description: 'Deep matte tile thud, desk knock, and displaced air puff.',
  },
  {
    id: 'mechanical-thock',
    label: 'Mechanical Thock',
    description: 'Creamy PBT keycap thock, switches, and rotary clicks.',
  },
  {
    id: 'retro-synth',
    label: 'Retro Synth',
    description: 'Warm 8-bit blips, coin star chime, and arcade arpeggios.',
  },
  {
    id: 'glass-ceramic',
    label: 'Glass & Ceramic',
    description: 'Frosted stone set-down, crystal chimes, and resonant bowls.',
  },
];

const VOLUME_DEBOUNCE_MS = 150;

export function EffectsSoundCard({
  settings,
  onTriggerTestSlam,
}: EffectsSoundCardProps) {
  const [volumeDraft, setVolumeDraft] = useState(settings.soundVolume ?? 75);
  const volumeWriterRef = useRef<DebouncedWriter<number> | null>(null);
  const activePack: SoundPack = settings.soundPack ?? 'studio-desk';

  useEffect(() => {
    setVolumeDraft(settings.soundVolume ?? 75);
  }, [settings.soundVolume]);

  useEffect(() => {
    const writer = createDebouncedWriter<number>((nextVol) => {
      void stashRepo.updateSettings({ soundVolume: nextVol });
    }, VOLUME_DEBOUNCE_MS);
    volumeWriterRef.current = writer;
    return () => {
      writer.flush();
      volumeWriterRef.current = null;
    };
  }, []);

  const handleSelectPack = (pack: SoundPack) => {
    setSoundPack(pack);
    void stashRepo.updateSettings({ soundPack: pack });
    if (settings.soundEffects && volumeDraft > 0) {
      onTriggerTestSlam();
    }
  };

  return (
    <SettingsSectionCard
      icon={
        settings.soundEffects && volumeDraft > 0 ? (
          <Volume2 className="h-4 w-4" />
        ) : (
          <VolumeX className="h-4 w-4" />
        )
      }
      title="Mechanical Foley & Sound Packs"
      badge={{
        label: settings.soundEffects ? `${volumeDraft}%` : 'Muted',
        tone: settings.soundEffects && volumeDraft > 0 ? 'accent' : 'neutral',
      }}
    >
      <div className="space-y-5">
        <SettingsToggleRow
          id="settings-sound-fx"
          label="Synthesized sound effects"
          hint="Generated live with Web Audio (zero external audio files)."
          checked={settings.soundEffects}
          onCheckedChange={(checked) => {
            void stashRepo.updateSettings({ soundEffects: checked });
            if (checked) {
              playDrop(true, settings.motionMode);
            }
          }}
        />

        {/* Sound Pack Selector */}
        <div
          className={cn(
            'space-y-2 border-t border-border/60 pt-4',
            !settings.soundEffects && 'pointer-events-none opacity-50',
          )}
        >
          <div className="font-mono text-[10px] font-medium uppercase tracking-widest text-fg-muted">
            Sound Pack
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {SOUND_PACK_OPTIONS.map((pack) => {
              const active = activePack === pack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSelectPack(pack.id)}
                  className={cn(
                    'rounded-control border p-3 text-left transition-colors cursor-pointer',
                    pack.id === 'arpg-heavy' && 'sm:col-span-2',
                    active
                      ? 'border-accent/70 bg-accent/12'
                      : 'border-border/80 bg-panel/60 hover:border-border hover:bg-card',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'text-[13px] font-semibold',
                        active ? 'text-accent' : 'text-fg',
                      )}
                    >
                      {pack.label}
                    </span>
                    {pack.badge ? (
                      <span className="rounded-pill border border-accent/40 bg-accent/10 px-1.5 py-0.25 font-mono text-[9px] text-accent">
                        {pack.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                    {pack.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Volume Slider */}
        <label
          className={cn(
            'block space-y-2 border-t border-border/60 pt-4 text-xs',
            !settings.soundEffects && 'opacity-50',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-fg">
              Effect volume
            </span>
            <span className="font-mono text-xs font-medium text-fg tabular-nums">
              {volumeDraft}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volumeDraft}
            disabled={!settings.soundEffects}
            onChange={(e) => {
              const nextVol = Number(e.target.value);
              setVolumeDraft(nextVol);
              setSoundVolume(nextVol);
              volumeWriterRef.current?.schedule(nextVol);
            }}
            onPointerUp={() => {
              if (settings.soundEffects && volumeDraft > 0) {
                playDrop(true, settings.motionMode);
              }
            }}
            className="w-full cursor-pointer accent-[var(--stash-accent)]"
          />
        </label>

        {/* Foley Soundboard */}
        <div className="border-t border-border/60 pt-4">
          <div className="mb-2.5 font-mono text-[10px] font-medium uppercase tracking-widest text-fg-muted">
            Audition Active Pack
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!settings.soundEffects || volumeDraft === 0}
              onClick={onTriggerTestSlam}
              className="h-7 px-2.5 text-[11px]"
            >
              Drop Slam
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!settings.soundEffects || volumeDraft === 0}
              onClick={() => playPickup(true)}
              className="h-7 px-2.5 text-[11px]"
            >
              Pickup
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!settings.soundEffects || volumeDraft === 0}
              onClick={() => playTagPop(true, 'arcade')}
              className="h-7 px-2.5 text-[11px]"
            >
              Star / Tag
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!settings.soundEffects || volumeDraft === 0}
              onClick={() => playSessionFreeze(true, settings.motionMode)}
              className="h-7 px-2.5 text-[11px]"
            >
              Session Lock
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!settings.soundEffects || volumeDraft === 0}
              onClick={() => playDelete(true)}
              className="h-7 px-2.5 text-[11px]"
            >
              Delete
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!settings.soundEffects || volumeDraft === 0}
              onClick={() => playError(true)}
              className="h-7 px-2.5 text-[11px]"
            >
              Blocked
            </Button>
          </div>
        </div>
      </div>
    </SettingsSectionCard>
  );
}
