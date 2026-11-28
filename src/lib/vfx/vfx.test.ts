import { describe, expect, it, vi } from 'vitest';
import { createVfxEngine } from '@/lib/vfx/engine';
import {
  appendEntitiesWithCap,
  CHAR_CINDER_RGB,
  collectNearbyOccluderRects,
  DARK_EMBER_RGB,
  DRAG_MOTE_THROTTLE_MS,
  MAX_VFX_ENTITIES,
  MOLTEN_AMBER_RGB,
  type ParticleKinematics,
  parseCssColorToRgb,
  rectsIntersect,
  SPARK_AIR_DRAG_60FPS,
  SPARK_GRAVITY_PX_S2,
  sampleSparkHeatColor,
  stepParticleKinematics,
  WHITE_HOT_RGB,
} from '@/lib/vfx/math';
import { generateFissureGeometry } from '@/lib/vfx/packs/fissures';
import { IRON_EMBER_PACK } from '@/lib/vfx/packs/iron-ember';
import type { VfxEntity, VfxPack, VfxRect } from '@/lib/vfx/types';

describe('VFX pure physics, heat gradient, and entity cap', () => {
  it('integrates spark kinematics with downward gravity, drag, and prev-position trails', () => {
    const state: ParticleKinematics = {
      x: 100,
      y: 200,
      prevX: 100,
      prevY: 200,
      vx: 300,
      vy: -120,
      gravityY: SPARK_GRAVITY_PX_S2,
      drag60: SPARK_AIR_DRAG_60FPS,
    };

    const dt = 1 / 60;
    stepParticleKinematics(state, dt);

    expect(state.prevX).toBe(100);
    expect(state.prevY).toBe(200);
    expect(state.vx).toBeCloseTo(300 * SPARK_AIR_DRAG_60FPS, 4);
    expect(state.vy).toBeCloseTo(
      -120 * SPARK_AIR_DRAG_60FPS + SPARK_GRAVITY_PX_S2 * dt,
      4,
    );
    expect(state.x).toBeCloseTo(100 + state.vx * dt, 4);
    expect(state.y).toBeCloseTo(200 + state.vy * dt, 4);

    // Second step shifts prevX/prevY to prior coordinates and continues downward gravity pull
    const afterFirstX = state.x;
    const afterFirstY = state.y;
    const prevVy = state.vy;
    stepParticleKinematics(state, dt);
    expect(state.prevX).toBeCloseTo(afterFirstX, 6);
    expect(state.prevY).toBeCloseTo(afterFirstY, 6);
    expect(state.vy).toBeGreaterThan(prevVy);
  });

  it('cools incandescent sparks cleanly from white-hot -> amber/accent -> dark ember -> char', () => {
    const emeraldAccent = parseCssColorToRgb('#10b981');
    expect(emeraldAccent).toEqual({ r: 16, g: 185, b: 129 });
    expect(parseCssColorToRgb('rgb(255, 128, 0)')).toEqual({
      r: 255,
      g: 128,
      b: 0,
    });
    expect(parseCssColorToRgb('invalid', MOLTEN_AMBER_RGB)).toEqual(
      MOLTEN_AMBER_RGB,
    );

    // t=0 is pure white-hot peak
    expect(sampleSparkHeatColor(0, emeraldAccent, 'dust')).toEqual(
      WHITE_HOT_RGB,
    );

    // t=0.25 blends molten amber with active accent (stronger accent weight in 'accent' mode)
    const midDust = sampleSparkHeatColor(0.25, emeraldAccent, 'dust');
    const midAccent = sampleSparkHeatColor(0.25, emeraldAccent, 'accent');
    expect(midDust.r).toBeGreaterThan(midAccent.r);
    expect(midAccent.g).toBeGreaterThan(midDust.g);

    // t=0.8 cools into dark ember cinder
    const ember = sampleSparkHeatColor(0.8, emeraldAccent, 'dust');
    expect(ember.r).toBeLessThan(midDust.r);
    expect(ember.r).toBeGreaterThan(CHAR_CINDER_RGB.r);
    expect(ember.r).toBeLessThanOrEqual(DARK_EMBER_RGB.r);

    // t=1.0 reaches deep char fade
    expect(sampleSparkHeatColor(1, emeraldAccent, 'dust')).toEqual(
      CHAR_CINDER_RGB,
    );
  });

  it('caps concurrent entities at MAX_VFX_ENTITIES by recycling oldest first', () => {
    const initial = Array.from({ length: 190 }, (_, i) => i);
    const incoming = Array.from({ length: 25 }, (_, i) => 1000 + i);
    const next = appendEntitiesWithCap(initial, incoming, MAX_VFX_ENTITIES);

    expect(next).toHaveLength(MAX_VFX_ENTITIES);
    // Oldest 15 entries (0..14) were recycled; first surviving item is 15
    expect(next[0]).toBe(15);
    expect(next[next.length - 1]).toBe(1024);

    // Incoming batch larger than cap trims cleanly to the newest `cap` entries
    const giant = Array.from({ length: 260 }, (_, i) => i);
    const trimmed = appendEntitiesWithCap([], giant, MAX_VFX_ENTITIES);
    expect(trimmed).toHaveLength(MAX_VFX_ENTITIES);
    expect(trimmed[0]).toBe(60);
  });

  it('spawns uniform full-weight Iron & Ember entities for slam, delete, bulk, and drag motes', () => {
    const rect: VfxRect = {
      x: 120,
      y: 180,
      width: 260,
      height: 96,
      radius: 10,
    };
    const baseTheme = {
      accentRgb: { r: 16, g: 185, b: 129 },
      textRgb: { r: 235, g: 235, b: 235 },
      isDark: true,
      dropStyle: 'dust' as const,
      dropDust: true,
      dropFissures: false,
    };

    // 1. Impact Shockwave only: 1 ring + 20 warm sparks + 9 ash puffs = 30 air entities
    const shockwaveOnly = IRON_EMBER_PACK.spawnSlam(rect, baseTheme);
    expect(shockwaveOnly).toHaveLength(30);
    expect(
      shockwaveOnly.every((e) => e.layer === 'air' && e.lifetimeSec > 0),
    ).toBe(true);

    // 2. Both ON (default): 1 floor fissure + 30 air shockwave/sparks/dust = 31 entities
    const bothOn = IRON_EMBER_PACK.spawnSlam(rect, {
      ...baseTheme,
      dropDust: true,
      dropFissures: true,
    });
    expect(bothOn).toHaveLength(31);
    const bothFloor = bothOn.filter((e) => e.layer === 'floor');
    expect(bothFloor).toHaveLength(1);
    expect(bothFloor[0]?.excludeRects).toEqual([rect]);
    expect(bothOn.filter((e) => e.layer === 'air')).toHaveLength(30);

    // 3. Ground Fracture only: 1 floor fissure + 5 subtle stone-dust puffs (no ring/sparks)
    const fractureOnly = IRON_EMBER_PACK.spawnSlam(rect, {
      ...baseTheme,
      dropDust: false,
      dropFissures: true,
    });
    expect(fractureOnly).toHaveLength(6);
    expect(fractureOnly.filter((e) => e.layer === 'floor')).toHaveLength(1);
    expect(fractureOnly.filter((e) => e.layer === 'air')).toHaveLength(5);

    // 4. Both OFF: zero canvas drop entities
    const bothOff = IRON_EMBER_PACK.spawnSlam(rect, {
      ...baseTheme,
      dropDust: false,
      dropFissures: false,
    });
    expect(bothOff).toHaveLength(0);

    const del = IRON_EMBER_PACK.spawnDelete(rect, baseTheme);
    expect(del.length).toBeGreaterThanOrEqual(20);

    const bulk = IRON_EMBER_PACK.spawnBulkPulse(rect, baseTheme);
    expect(bulk.length).toBeGreaterThanOrEqual(18);

    const motes = IRON_EMBER_PACK.spawnDragMote(240, 310, baseTheme);
    expect(motes.length).toBeGreaterThanOrEqual(1);
    expect(motes.length).toBeLessThanOrEqual(2);
  });

  it('strictly gates VFX engine to Arcade mode and throttles drag motes to 80ms', () => {
    const spawnSlamSpy = vi.fn((): VfxEntity[] => []);
    const spawnDragSpy = vi.fn((): VfxEntity[] => []);
    const fakePack: VfxPack = {
      id: 'spy',
      spawnSlam: spawnSlamSpy,
      spawnDelete: () => [],
      spawnBulkPulse: () => [],
      spawnDragMote: spawnDragSpy,
    };

    const engine = createVfxEngine(fakePack);
    const rect: VfxRect = { x: 0, y: 0, width: 200, height: 80 };

    // Tactile / Reduced / Off must do zero work
    for (const mode of ['tactile', 'reduced', 'off'] as const) {
      engine.setConfig({
        motionMode: mode,
        dropDust: true,
        dropFissures: true,
      });
      engine.spawnSlam(rect);
      engine.spawnDragMote(50, 50, 1000);
    }
    expect(spawnSlamSpy).not.toHaveBeenCalled();
    expect(spawnDragSpy).not.toHaveBeenCalled();

    // Arcade accepts events and enforces the 80ms drag-mote throttle
    engine.setConfig({
      motionMode: 'arcade',
      dropDust: true,
      dropFissures: true,
    });
    engine.spawnSlam(rect);
    expect(spawnSlamSpy).toHaveBeenCalledTimes(1);

    engine.spawnDragMote(10, 10, 1000);
    engine.spawnDragMote(20, 20, 1000 + DRAG_MOTE_THROTTLE_MS - 10);
    engine.spawnDragMote(30, 30, 1000 + DRAG_MOTE_THROTTLE_MS);
    expect(spawnDragSpy).toHaveBeenCalledTimes(2);
  });

  it('generates procedural outward-radiating fissures with monotonic taper and bounded offshoots', () => {
    const rect: VfxRect = {
      x: 200,
      y: 160,
      width: 240,
      height: 88,
      radius: 10,
    };
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;

    // Deterministic LCG PRNG across 25 samples to verify invariants under all seeds
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x100000000;
    };

    let sawOffshoots = false;
    for (let trial = 0; trial < 25; trial++) {
      const branches = generateFissureGeometry(rect, rng);
      const primaries = branches.filter((b) => !b.isOffshoot);
      const offshoots = branches.filter((b) => b.isOffshoot);

      expect(primaries.length).toBeGreaterThanOrEqual(6);
      expect(primaries.length).toBeLessThanOrEqual(8);
      expect(offshoots.length).toBeLessThanOrEqual(primaries.length * 2);
      if (offshoots.length > 0) sawOffshoots = true;

      for (const primary of primaries) {
        expect(primary.segments.length).toBeGreaterThanOrEqual(4);
        expect(primary.segments.length).toBeLessThanOrEqual(6);
        expect(primary.totalLength).toBeGreaterThanOrEqual(35.9);
        expect(primary.totalLength).toBeLessThanOrEqual(78.1);

        // Origin starts on rect perimeter and tip finishes strictly farther from center
        const first = primary.segments[0];
        const last = primary.segments[primary.segments.length - 1];
        expect(first).toBeDefined();
        expect(last).toBeDefined();
        if (first && last) {
          const originDist = Math.hypot(first.x1 - centerX, first.y1 - centerY);
          const tipDist = Math.hypot(last.x2 - centerX, last.y2 - centerY);
          expect(tipDist).toBeGreaterThan(originDist + 15);
        }

        // Strict monotonic taper from thick base (~3px) to hairline tip (~0.6px)
        for (let i = 1; i < primary.segments.length; i++) {
          const prev = primary.segments[i - 1];
          const curr = primary.segments[i];
          if (prev && curr) {
            expect(curr.width).toBeLessThan(prev.width);
          }
        }
      }

      for (const off of offshoots) {
        expect(off.segments.length).toBeGreaterThanOrEqual(2);
        expect(off.segments.length).toBeLessThanOrEqual(3);
        expect(off.totalLength).toBeGreaterThanOrEqual(15.9);
        expect(off.totalLength).toBeLessThanOrEqual(34.1);
        expect(off.parentAttachDist).toBeGreaterThan(0);

        for (let i = 1; i < off.segments.length; i++) {
          const prev = off.segments[i - 1];
          const curr = off.segments[i];
          if (prev && curr) {
            expect(curr.width).toBeLessThan(prev.width);
          }
        }
      }
    }
    expect(sawOffshoots).toBe(true);
  });

  it('collects nearby neighbor occluder rects within 96px padding and deduplicates origin', () => {
    const origin: VfxRect = {
      x: 200,
      y: 200,
      width: 240,
      height: 88,
      radius: 10,
    };
    const duplicateOrigin: VfxRect = {
      x: 200.4,
      y: 199.8,
      width: 240,
      height: 88,
      radius: 10,
    };
    const rightNeighbor: VfxRect = {
      x: 456, // 16px gutter -> inside 96px padding
      y: 200,
      width: 240,
      height: 88,
      radius: 10,
    };
    const belowNeighbor: VfxRect = {
      x: 200,
      y: 340, // 52px gutter -> inside 96px padding
      width: 240,
      height: 88,
      radius: 10,
    };
    const farCard: VfxRect = {
      x: 800, // 360px away -> outside 96px padding
      y: 200,
      width: 240,
      height: 88,
      radius: 10,
    };
    const hiddenZeroRect: VfxRect = {
      x: 210,
      y: 210,
      width: 0,
      height: 0,
    };

    expect(rectsIntersect(origin, rightNeighbor)).toBe(false);
    expect(rectsIntersect(origin, duplicateOrigin)).toBe(true);

    const occluders = collectNearbyOccluderRects(origin, [
      duplicateOrigin,
      rightNeighbor,
      belowNeighbor,
      farCard,
      hiddenZeroRect,
    ]);

    // Origin first, followed only by nearby neighbors (duplicate origin, far card, and 0x0 excluded)
    expect(occluders).toEqual([origin, rightNeighbor, belowNeighbor]);
  });
});
