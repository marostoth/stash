import { Flame, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EffectsTogglesCard } from '@/components/settings/effects-toggles-card';
import {
  SettingsSectionCard,
  SettingsToggleRow,
} from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import { DropSparks } from '@/components/workbench/drop-sparks';
import {
  playDelete,
  playDrop,
  playError,
  playPickup,
  playSessionFreeze,
  playTagPop,
  setSoundVolume,
} from '@/lib/audio/foley';
import {
  ARCADE_SQUASH_KEYFRAMES,
  ARCADE_SQUASH_TRANSITION,
  isArcadeMotion,
  TACTILE_SETTLE_KEYFRAMES,
  TACTILE_SETTLE_TRANSITION,
  TACTILE_SPRING,
} from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import type {
  DropEffectStyle,
  MotionMode,
  StashSettings,
} from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import {
  createDebouncedWriter,
  type DebouncedWriter,
} from '@/lib/utils/coalesce';

interface EffectsPanelProps {
  settings: StashSettings;
}

const MOTION_OPTIONS: ReadonlyArray<{
  id: MotionMode;
  label: string;
  badge?: string;
  description: string;
}> = [
  {
    id: 'arcade',
    label: 'Arcade',
    badge: 'Peak FX',
    description:
      'Heavy tile slam, perimeter dust shockwave, 3D foil tilt, and combo overtones.',
  },
  {
    id: 'tactile',
    label: 'Tactile',
    description:
      'Crisp weighted mechanical settle and subtle springs without shockwaves.',
  },
  {
    id: 'reduced',
    label: 'Reduced',
    description: 'Minimal motion transitions for calmer everyday browsing.',
  },
  {
    id: 'off',
    label: 'Off',
    description: 'Instant snaps with animations disabled.',
  },
];

const DROP_STYLE_OPTIONS: ReadonlyArray<{
  id: DropEffectStyle;
  label: string;
  description: string;
}> = [
  {
    id: 'dust',
    label: 'Neutral Dust + Accent Ring',
    description:
      'Smoky matte desk dust with a crisp theme-accent pressure ring.',
  },
  {
    id: 'accent',
    label: 'Full Accent Glow',
    description:
      'Luminous theme-accent plasma dust and double glowing shockwaves.',
  },
];

const VOLUME_DEBOUNCE_MS = 150;

export function EffectsPanel({ settings }: EffectsPanelProps) {
  const [volumeDraft, setVolumeDraft] = useState(settings.soundVolume ?? 75);
  const [slamActive, setSlamActive] = useState(false);
  const [slamKey, setSlamKey] = useState(0);
  const slamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeWriterRef = useRef<DebouncedWriter<number> | null>(null);

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
      if (slamTimerRef.current) clearTimeout(slamTimerRef.current);
    };
  }, []);

  const arcade = isArcadeMotion(settings.motionMode);
  const dropStyle: DropEffectStyle = settings.dropEffectStyle ?? 'dust';

  const triggerTestSlam = (overrideStyle?: DropEffectStyle) => {
    if (overrideStyle && overrideStyle !== dropStyle) {
      void stashRepo.updateSettings({ dropEffectStyle: overrideStyle });
    }
    if (slamTimerRef.current) clearTimeout(slamTimerRef.current);
    setSlamActive(false);
    setSlamKey((prev) => prev + 1);
    requestAnimationFrame(() => {
      setSlamActive(true);
      playDrop(settings.soundEffects, settings.motionMode);
      slamTimerRef.current = setTimeout(() => {
        setSlamActive(false);
        slamTimerRef.current = null;
      }, 560);
    });
  };

  return (
    <div className="space-y-4">
      {/* 1. Motion Feel */}
      <SettingsSectionCard
        icon={<Zap className="h-4 w-4" />}
        title="Motion Feel"
        badge={{
          label:
            MOTION_OPTIONS.find((m) => m.id === settings.motionMode)?.label ??
            'Tactile',
          tone: arcade ? 'accent' : 'neutral',
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {MOTION_OPTIONS.map((opt) => {
            const active = settings.motionMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  void stashRepo.updateSettings({ motionMode: opt.id })
                }
                className={cn(
                  'rounded-control border p-2.5 text-left transition-colors cursor-pointer',
                  active
                    ? 'border-accent/70 bg-accent/12'
                    : 'border-border bg-panel/60 hover:border-border/80 hover:bg-card',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      active ? 'text-accent' : 'text-fg',
                    )}
                  >
                    {opt.label}
                  </span>
                  {opt.badge ? (
                    <span className="rounded-pill border border-accent/40 bg-accent/10 px-1.5 py-0.25 font-mono text-[9px] text-accent">
                      {opt.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-fg-muted">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </SettingsSectionCard>

      {/* 2. Drop Impact Shockwave & Live Stage */}
      <SettingsSectionCard
        icon={<Flame className="h-4 w-4" />}
        title="Drop Impact Shockwave"
        badge={{
          label: arcade ? 'Active (Arcade)' : 'Arcade Only',
          tone: arcade ? 'accent' : 'neutral',
        }}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {DROP_STYLE_OPTIONS.map((opt) => {
            const active = dropStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  void stashRepo.updateSettings({ dropEffectStyle: opt.id });
                  if (arcade) triggerTestSlam(opt.id);
                }}
                className={cn(
                  'rounded-control border p-2.5 text-left transition-colors cursor-pointer',
                  active
                    ? 'border-accent/70 bg-accent/12'
                    : 'border-border bg-panel/60 hover:border-border/80 hover:bg-card',
                )}
              >
                <div
                  className={cn(
                    'text-xs font-semibold',
                    active ? 'text-accent' : 'text-fg',
                  )}
                >
                  {opt.label}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-fg-muted">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Interactive Mini Slam Preview Stage */}
        <div className="mt-3 flex flex-col items-center justify-between gap-3 rounded-card border border-border bg-canvas/85 px-4 py-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="relative w-48 sm:w-52">
              <DropSparks
                key={slamKey}
                active={arcade && slamActive}
                variant={dropStyle}
              />
              <motion.div
                animate={
                  slamActive && arcade
                    ? ARCADE_SQUASH_KEYFRAMES
                    : slamActive && settings.motionMode === 'tactile'
                      ? TACTILE_SETTLE_KEYFRAMES
                      : { scale: 1, y: 0 }
                }
                transition={
                  slamActive && arcade
                    ? ARCADE_SQUASH_TRANSITION
                    : slamActive && settings.motionMode === 'tactile'
                      ? TACTILE_SETTLE_TRANSITION
                      : TACTILE_SPRING
                }
                className="relative z-[1] flex items-center gap-2.5 rounded-card border border-border bg-card px-3 py-2.5 shadow-sm"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control border border-border bg-panel font-mono text-xs font-semibold text-accent">
                  S
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-fg">
                    Heavy Impact Preview
                  </div>
                  <div className="truncate font-mono text-[10px] text-fg-muted">
                    {arcade
                      ? dropStyle === 'dust'
                        ? 'dust + accent shockwave'
                        : 'full accent plasma'
                      : `${settings.motionMode} mode`}
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div
              animate={
                slamActive && arcade && (settings.fxDeskJolt ?? true)
                  ? { x: [0, 6, 0], scale: [1, 0.985, 1] }
                  : { x: 0, scale: 1 }
              }
              transition={{
                duration: 0.28,
                delay: 0.04,
                times: [0, 0.34, 1],
                ease: [0.22, 1, 0.36, 1],
              }}
              className="hidden w-24 shrink-0 rounded-card border border-border/75 bg-card/75 px-2.5 py-2.5 opacity-80 sm:block"
            >
              <div className="h-2 w-12 rounded bg-fg/20" />
              <div className="mt-1.5 h-1.5 w-16 rounded bg-fg-muted/20" />
            </motion.div>
          </div>

          <div className="flex flex-col items-center gap-1.5 sm:items-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => triggerTestSlam()}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Test Drop Slam
            </Button>
            {!arcade && (
              <span className="text-[10px] text-fg-muted">
                Switch to Arcade above for full dust shockwave
              </span>
            )}
          </div>
        </div>
      </SettingsSectionCard>

      {/* 3. Fine-Tune Physics & Waves */}
      <EffectsTogglesCard settings={settings} />

      {/* 4. Sound Effects & Volume */}
      <SettingsSectionCard
        icon={
          settings.soundEffects && volumeDraft > 0 ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )
        }
        title="Mechanical Foley & Volume"
        badge={{
          label: settings.soundEffects ? `${volumeDraft}%` : 'Muted',
          tone: settings.soundEffects && volumeDraft > 0 ? 'accent' : 'neutral',
        }}
      >
        <div className="space-y-3">
          <SettingsToggleRow
            id="settings-sound-fx"
            label="Mechanical sound effects"
            hint="Synthesized locally with Web Audio (zero audio files)."
            checked={settings.soundEffects}
            onCheckedChange={(checked) => {
              void stashRepo.updateSettings({ soundEffects: checked });
              if (checked) {
                playDrop(true, settings.motionMode);
              }
            }}
          />

          <label
            className={cn(
              'block space-y-1.5 text-xs',
              !settings.soundEffects && 'opacity-50',
            )}
          >
            <div className="flex items-center justify-between text-fg-muted">
              <span>Effect volume</span>
              <span className="font-mono text-[11px] font-medium text-fg tabular-nums">
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
          <div className="border-t border-border/70 pt-2.5">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
              Audition Sound Effects
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={!settings.soundEffects || volumeDraft === 0}
                onClick={() => triggerTestSlam()}
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
    </div>
  );
}
