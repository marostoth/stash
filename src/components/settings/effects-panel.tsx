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
import type { MotionMode, StashSettings } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { spawnSlamForElement, vfxEngine } from '@/lib/vfx/engine';

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

type DropLayerKey = 'fxDropDust' | 'fxDropFissures';

const DROP_LAYER_OPTIONS: ReadonlyArray<{
  key: DropLayerKey;
  label: string;
  description: string;
}> = [
  {
    key: 'fxDropDust',
    label: 'Impact Shockwave',
    description:
      'Expanding kinetic ring, braking ash dust, and warm ember sparks.',
  },
  {
    key: 'fxDropFissures',
    label: 'Ground Fracture',
    description:
      'Branching surface cracks radiating from the card edge with cooling theme seams.',
  },
];

function describeDropLayers(dropDust: boolean, dropFissures: boolean): string {
  if (dropDust && dropFissures) return 'shockwave + ground fracture';
  if (dropDust) return 'impact shockwave & ember dust';
  if (dropFissures) return 'ground fracture & stone dust';
  return 'clean physical slam';
}

export function EffectsPanel({ settings }: EffectsPanelProps) {
  const [slamActive, setSlamActive] = useState(false);
  const [slamKey, setSlamKey] = useState(0);
  const slamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (slamTimerRef.current) clearTimeout(slamTimerRef.current);
    };
  }, []);

  const arcade = isArcadeMotion(settings.motionMode);
  const dropDust = settings.fxDropDust ?? true;
  const dropFissures = settings.fxDropFissures ?? true;
  const activeLayerCount = Number(dropDust) + Number(dropFissures);

  const triggerTestSlam = (overrides?: {
    dropDust?: boolean;
    dropFissures?: boolean;
  }) => {
    const nextDust = overrides?.dropDust ?? dropDust;
    const nextFissures = overrides?.dropFissures ?? dropFissures;
    if (slamTimerRef.current) clearTimeout(slamTimerRef.current);

    // Sync VFX config immediately so toggling a layer previews it on the first click
    vfxEngine.setConfig({
      motionMode: settings.motionMode,
      dropDust: nextDust,
      dropFissures: nextFissures,
    });

    setSlamActive(false);
    setSlamKey((prev) => prev + 1);
    requestAnimationFrame(() => {
      setSlamActive(true);
      playDrop(settings.soundEffects, settings.motionMode);
      if (arcade) {
        spawnSlamForElement(previewCardRef.current);
      }
      slamTimerRef.current = setTimeout(() => {
        setSlamActive(false);
        slamTimerRef.current = null;
      }, 420);
    });
  };

  const handleToggleLayer = (key: DropLayerKey) => {
    const nextDust = key === 'fxDropDust' ? !dropDust : dropDust;
    const nextFissures =
      key === 'fxDropFissures' ? !dropFissures : dropFissures;
    void stashRepo.updateSettings({
      [key]: key === 'fxDropDust' ? nextDust : nextFissures,
    });
    const enabledThisLayer = key === 'fxDropDust' ? nextDust : nextFissures;
    if (arcade && enabledThisLayer) {
      triggerTestSlam({ dropDust: nextDust, dropFissures: nextFissures });
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Motion Feel */}
      <SettingsSectionCard
        icon={<Zap className="h-4 w-4" />}
        title="Motion Feel"
        subtitle="Choose how much physical weight, bounce, and celebratory FX Stash uses across the board."
        badge={{
          label:
            MOTION_OPTIONS.find((m) => m.id === settings.motionMode)?.label ??
            'Tactile',
          tone: arcade ? 'accent' : 'neutral',
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
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
                  'rounded-control border p-3.5 text-left transition-colors cursor-pointer',
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
                    {opt.label}
                  </span>
                  {opt.badge ? (
                    <span className="rounded-pill border border-accent/40 bg-accent/10 px-1.5 py-0.25 font-mono text-[9px] text-accent">
                      {opt.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </SettingsSectionCard>

      {/* 2. Drop Impact Effects & Live Stage */}
      <SettingsSectionCard
        icon={<Flame className="h-4 w-4" />}
        title="Drop Impact Effects"
        subtitle="Combine or toggle the kinetic layers that fire when cards land on the board."
        badge={{
          label: arcade
            ? activeLayerCount > 0
              ? `${activeLayerCount} / 2 on`
              : 'Off'
            : 'Arcade Only',
          tone: arcade && activeLayerCount > 0 ? 'accent' : 'neutral',
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {DROP_LAYER_OPTIONS.map((opt) => {
            const active = opt.key === 'fxDropDust' ? dropDust : dropFissures;
            return (
              <button
                key={opt.key}
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => handleToggleLayer(opt.key)}
                className={cn(
                  'rounded-control border p-3.5 text-left transition-colors cursor-pointer',
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
                    {opt.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'relative inline-flex h-4.5 w-8 shrink-0 items-center rounded-full border transition-colors',
                      active
                        ? 'border-accent bg-accent'
                        : 'border-border bg-panel',
                    )}
                  >
                    <span
                      className={cn(
                        'block h-3 w-3 rounded-full bg-canvas shadow-sm transition-transform',
                        active ? 'translate-x-3.5' : 'translate-x-0.5',
                      )}
                    />
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Interactive Mini Slam Preview Stage */}
        <motion.div
          animate={
            slamActive && arcade && (settings.fxDeskJolt ?? true)
              ? { y: [0, 4, -1.8, 0.6, 0], x: [0, 0.35, -0.25, 0, 0] }
              : { x: 0, y: 0 }
          }
          transition={{
            duration: 0.135,
            times: [0, 0.24, 0.58, 0.82, 1],
            ease: 'easeOut',
          }}
          className="flex flex-col items-center justify-between gap-4 rounded-card border border-border/80 bg-panel/45 px-5 py-7 sm:flex-row"
        >
          <div className="flex items-center gap-3">
            <div
              ref={previewCardRef}
              data-vfx-occluder="true"
              className="relative w-48 sm:w-52"
            >
              <DropSparks
                key={slamKey}
                active={settings.motionMode !== 'off' && slamActive}
                arcade={arcade}
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
                    Impact Preview
                  </div>
                  <div className="truncate font-mono text-[10px] text-fg-muted">
                    {arcade
                      ? describeDropLayers(dropDust, dropFissures)
                      : `${settings.motionMode} mode`}
                  </div>
                </div>
              </motion.div>
            </div>

            <motion.div
              data-vfx-occluder="true"
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
              Preview Impact
            </Button>
            {arcade ? (
              <span className="font-mono text-[10px] text-fg-muted">
                {activeLayerCount === 2
                  ? 'Shockwave, ember dust & ground fracture layered on every drop'
                  : activeLayerCount === 1
                    ? 'Toggle both layers above to combine shockwave & fracture'
                    : 'Enable either layer above to add canvas drop effects'}
              </span>
            ) : (
              <span className="text-[10px] text-fg-muted">
                Switch to Arcade above for full impact effects
              </span>
            )}
          </div>
        </motion.div>
      </SettingsSectionCard>

      {/* 3. Fine-Tune Physics & Waves */}
      <EffectsTogglesCard settings={settings} />
    </div>
  );
}
