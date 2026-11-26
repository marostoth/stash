import { Flame, Sparkles, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EffectsTogglesCard } from '@/components/settings/effects-toggles-card';
import { SettingsSectionCard } from '@/components/settings/settings-section-card';
import { Button } from '@/components/ui/button';
import { DropSparks } from '@/components/workbench/drop-sparks';
import { playDrop } from '@/lib/audio/foley';
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
      'Heavy tile slam, perimeter dust shockwave, neighbor jolt, drag trail, and combo overtones.',
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

export function EffectsPanel({ settings }: EffectsPanelProps) {
  const [slamActive, setSlamActive] = useState(false);
  const [slamKey, setSlamKey] = useState(0);
  const slamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
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
      }, 720);
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
                  ? { x: [0, 8, -1.5, 0], scale: [1, 0.98, 1.005, 1] }
                  : { x: 0, scale: 1 }
              }
              transition={{
                duration: 0.38,
                delay: 0.065,
                times: [0, 0.28, 0.66, 1],
                ease: [0.22, 0.85, 0.34, 1],
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
    </div>
  );
}
