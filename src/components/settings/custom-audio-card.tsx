import { Music, Play, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  SettingsSectionCard,
  SettingsToggleRow,
} from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import { getReadyAudioBus } from '@/lib/audio/audio-bus';
import {
  type CustomSfxMap,
  customSfxStore,
  dataUrlToArrayBuffer,
  readFileAsDataUrl,
  SOUND_EVENT_GROUPS,
  SOUND_EVENT_META,
  type SoundEventId,
  validateCustomAudioFile,
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
  setCustomSfxClips,
} from '@/lib/audio/foley';
import { stashRepo } from '@/lib/storage/repo';
import type { StashSettings } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';

interface CustomAudioCardProps {
  settings: StashSettings;
  onTriggerTestSlam: () => void;
}

export function CustomAudioCard({
  settings,
  onTriggerTestSlam,
}: CustomAudioCardProps) {
  const [clips, setClips] = useState<CustomSfxMap>({});
  const [activeSlot, setActiveSlot] = useState<SoundEventId | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let mounted = true;
    void customSfxStore.getAll().then((loaded) => {
      if (mounted) setClips(loaded);
    });
    const unwatch = customSfxStore.watch((next) => {
      if (mounted) setClips(next);
    });
    return () => {
      mounted = false;
      unwatch();
    };
  }, []);

  const uploadedCount = Object.keys(clips).length;
  const overridesEnabled = settings.customSoundsEnabled !== false;

  const auditionSlot = (eventId: SoundEventId) => {
    switch (eventId) {
      case 'drop':
        onTriggerTestSlam();
        return;
      case 'pickup':
        playPickup(true);
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
      case 'hoverRiffle':
        playHoverRiffle(true, 'arcade', Date.now() + 5000);
        return;
      case 'delete':
        playDelete(true);
        return;
      case 'error':
        playError(true);
        return;
    }
  };

  const handleOpenPicker = (eventId: SoundEventId) => {
    setActiveSlot(eventId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    const slot = activeSlot;
    setActiveSlot(null);
    if (!file || !slot) return;

    const validation = validateCustomAudioFile(file);
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      // Verify browser can decode the clip before persisting
      const bus = getReadyAudioBus();
      if (bus && typeof bus.ctx.decodeAudioData === 'function') {
        const buf = dataUrlToArrayBuffer(dataUrl);
        if (!buf) {
          toast.error('Could not read audio data.');
          return;
        }
        await bus.ctx.decodeAudioData(buf);
      }

      const next = await customSfxStore.setClip(slot, {
        name: file.name,
        mimeType: file.type || 'audio/mpeg',
        sizeBytes: file.size,
        dataUrl,
        updatedAt: new Date().toISOString(),
      });
      setCustomSfxClips(next);
      setClips(next);
      toast.success(`Loaded "${file.name}"`);
      if (settings.soundEffects && overridesEnabled) {
        if (slot === 'drop') {
          playDrop(true, settings.motionMode);
        } else {
          auditionSlot(slot);
        }
      }
    } catch {
      toast.error('Browser could not decode that audio file.');
    }
  };

  const handleRemoveClip = async (eventId: SoundEventId) => {
    const next = await customSfxStore.removeClip(eventId);
    setCustomSfxClips(next);
    setClips(next);
    toast.info('Reverted slot to active Sound Pack');
  };

  const handleClearAll = async () => {
    await customSfxStore.clearAll();
    setCustomSfxClips({});
    setClips({});
    toast.info('Cleared all custom audio clips');
  };

  return (
    <SettingsSectionCard
      icon={<Music className="h-4 w-4" />}
      title="Custom Audio Clips (.mp3 / .wav / .ogg)"
      subtitle="Drop in your own recorded sound effects for any slot (up to 512 KB each). Unfilled slots automatically use your active Sound Pack above. Clips stay local on this device and are not included in JSON backups."
      badge={{
        label:
          uploadedCount > 0
            ? `${uploadedCount} / ${SOUND_EVENT_META.length} custom`
            : 'Optional',
        tone: uploadedCount > 0 && overridesEnabled ? 'accent' : 'neutral',
      }}
    >
      <div className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a"
          onChange={(e) => void handleFileChange(e)}
          className="hidden"
        />

        {uploadedCount > 0 && (
          <SettingsToggleRow
            id="settings-custom-sfx-enabled"
            label="Use uploaded custom audio clips"
            hint="Turn off anytime to A/B compare against built-in Sound Packs."
            checked={overridesEnabled}
            onCheckedChange={(checked) =>
              void stashRepo.updateSettings({ customSoundsEnabled: checked })
            }
          />
        )}

        <div
          className={cn(
            'space-y-3',
            (!settings.soundEffects || !overridesEnabled) &&
              uploadedCount > 0 &&
              'opacity-65',
          )}
        >
          {SOUND_EVENT_GROUPS.map((group) => {
            const groupSlots = SOUND_EVENT_META.filter(
              (slot) => slot.category === group.id,
            );
            return (
              <div key={group.id} className="space-y-1.5">
                <div className="px-0.5 font-mono text-[10px] font-medium uppercase tracking-widest text-fg-muted/85">
                  {group.title}
                </div>
                <div className="divide-y divide-hairline rounded-control border border-hairline bg-panel/45">
                  {groupSlots.map((slot) => {
                    const clip = clips[slot.id];
                    return (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[13px] font-medium text-fg">
                              {slot.label}
                            </span>
                            {slot.modeScope !== 'all' && (
                              <span
                                className={cn(
                                  'rounded-pill border px-1.5 py-0.25 font-mono text-[9px]',
                                  slot.modeScope === 'arcade-only'
                                    ? 'border-accent/45 bg-accent/10 text-accent'
                                    : 'border-hairline bg-panel text-fg-muted',
                                )}
                              >
                                {slot.modeScope === 'arcade-only'
                                  ? 'Arcade only'
                                  : 'Arcade+'}
                              </span>
                            )}
                            {clip && (
                              <span className="truncate rounded-pill border border-accent/40 bg-accent/10 px-2 py-0.25 font-mono text-[10px] text-accent">
                                {clip.name} ·{' '}
                                {Math.max(1, Math.round(clip.sizeBytes / 1024))}{' '}
                                KB
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-fg-muted">
                            {slot.hint}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={!settings.soundEffects}
                            onClick={() => auditionSlot(slot.id)}
                            aria-label={`Play ${slot.label}`}
                            title={`Play ${slot.label}`}
                            className="h-7 w-7 text-fg-muted hover:text-accent"
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenPicker(slot.id)}
                            className="h-7 gap-1 px-2 text-[11px]"
                          >
                            <Upload className="h-3 w-3" />
                            <span>{clip ? 'Replace' : 'Upload'}</span>
                          </Button>
                          {clip && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => void handleRemoveClip(slot.id)}
                              aria-label={`Remove custom ${slot.label} sound`}
                              title="Revert to built-in Sound Pack"
                              className="h-7 w-7 text-fg-muted hover:text-danger"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {uploadedCount > 0 && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void handleClearAll()}
              className="h-7 gap-1 px-2 text-[11px] text-danger hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="h-3 w-3" />
              Reset All Custom Clips
            </Button>
          </div>
        )}
      </div>
    </SettingsSectionCard>
  );
}
