import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  SettingsSectionCard,
  SettingsToggleRow,
} from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import {
  SOUND_EVENT_GROUPS,
  SOUND_EVENT_META,
  type SoundEventId,
  type SoundModeScope,
} from '@/lib/audio/custom-sfx-store';
import {
  playDelete,
  playDrop,
  playError,
  playHoverRiffle,
  playPickup,
  playSessionFreeze,
  playTagPop,
  playUncheck,
  setSoundPack,
  setSoundVolume,
} from '@/lib/audio/foley';
import { stashRepo } from '@/lib/storage/repo';
import type { MotionMode, SoundPack, StashSettings } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import {
  createDebouncedWriter,
  type DebouncedWriter,
} from '@/lib/utils/coalesce';

interface EffectsSoundCardProps {
  settings: StashSettings;
  onTriggerTestSlam: () => void;
}

const MOTION_LABEL: Record<MotionMode, string> = {
  arcade: 'Arcade',
  tactile: 'Tactile',
  reduced: 'Reduced',
  off: 'Off',
};

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
    description:
      'Dry anodized hardware clicks, matte desk contact, and clean pentatonic chimes.',
  },
  {
    id: 'mechanical-thock',
    label: 'Mechanical Thock',
    description: 'Creamy PBT keycap thock, switches, and crisp rotary clicks.',
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

function ModeScopeTag({ scope }: { scope: SoundModeScope }) {
  if (scope === 'all') return null;
  return (
    <span
      className={cn(
        'rounded-pill border px-1.5 py-0.25 font-mono text-[9px]',
        scope === 'arcade-only'
          ? 'border-accent/45 bg-accent/10 text-accent'
          : 'border-hairline bg-panel text-fg-muted',
      )}
    >
      {scope === 'arcade-only' ? 'Arcade only' : 'Arcade+'}
    </span>
  );
}

export function EffectsSoundCard({
  settings,
  onTriggerTestSlam,
}: EffectsSoundCardProps) {
  const [volumeDraft, setVolumeDraft] = useState(settings.soundVolume ?? 75);
  const volumeWriterRef = useRef<DebouncedWriter<number> | null>(null);
  const activePack: SoundPack = settings.soundPack ?? 'studio-desk';
  const modeLabel = MOTION_LABEL[settings.motionMode] ?? 'Tactile';

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

  const auditionSound = (eventId: SoundEventId) => {
    switch (eventId) {
      case 'drop':
        onTriggerTestSlam();
        return;
      case 'pickup':
        playPickup(true);
        return;
      case 'hoverRiffle':
        playHoverRiffle(true, 'arcade', Date.now() + 5000);
        return;
      case 'tagPop':
        playTagPop(
          true,
          settings.motionMode === 'off' ? 'tactile' : settings.motionMode,
        );
        return;
      case 'uncheck':
        playUncheck(true);
        return;
      case 'sessionFreeze':
        playSessionFreeze(true, settings.motionMode);
        return;
      case 'delete':
        playDelete(true);
        return;
      case 'error':
        playError(true);
        return;
    }
  };

  const disabledAudio = !settings.soundEffects || volumeDraft === 0;

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
        label: settings.soundEffects
          ? `${modeLabel} · ${volumeDraft}%`
          : 'Muted',
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
            'space-y-2 border-t border-hairline pt-4',
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
                    'relative rounded-control border p-3 text-left transition-colors cursor-pointer',
                    pack.id === 'arpg-heavy' && 'sm:col-span-2',
                    active
                      ? 'border-border bg-elevated text-fg'
                      : 'border-hairline bg-panel/60 hover:border-border hover:bg-card',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                      {active && (
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-accent"
                        />
                      )}
                      {pack.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {pack.badge ? (
                        <span className="rounded-pill border border-hairline bg-panel px-1.5 py-0.25 font-mono text-[9px] text-fg-muted">
                          {pack.badge}
                        </span>
                      ) : null}
                      {active ? (
                        <span className="rounded-pill border border-accent/40 bg-accent/10 px-1.5 py-0.25 font-mono text-[9px] text-accent">
                          Active
                        </span>
                      ) : null}
                    </div>
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
            'block space-y-2 border-t border-hairline pt-4 text-xs',
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

        {/* Grouped Foley Soundboard (All 8 Sounds) */}
        <div className="space-y-3 border-t border-hairline pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-mono text-[10px] font-medium uppercase tracking-widest text-fg-muted">
              Audition Active Pack (8 Sounds)
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-fg-muted">
              <span>Previewing in {modeLabel}</span>
              <span>·</span>
              <span>Arcade+ = boosted in Arcade</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {SOUND_EVENT_GROUPS.map((group) => {
              const items = SOUND_EVENT_META.filter(
                (item) => item.category === group.id,
              );
              return (
                <div
                  key={group.id}
                  className="space-y-2 rounded-control border border-hairline bg-panel/45 p-2.5"
                >
                  <div className="font-mono text-[10px] font-medium uppercase tracking-wider text-fg-muted">
                    {group.title}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {items.map((slot) => (
                      <Button
                        key={slot.id}
                        variant="secondary"
                        size="sm"
                        disabled={disabledAudio}
                        onClick={() => auditionSound(slot.id)}
                        title={slot.hint}
                        className="h-7 w-full justify-between px-2.5 text-[11px]"
                      >
                        <span className="truncate">{slot.label}</span>
                        <ModeScopeTag scope={slot.modeScope} />
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SettingsSectionCard>
  );
}
