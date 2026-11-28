import { SPARK_GRAVITY_PX_S2 } from '@/lib/vfx/math';
import { createGroundFissureEntity } from '@/lib/vfx/packs/fissures';
import {
  createAshPuff,
  createIncandescentSpark,
  createShockwaveRing,
  randRange,
  sampleRectPerimeter,
} from '@/lib/vfx/primitives';
import type {
  VfxEntity,
  VfxPack,
  VfxRect,
  VfxThemeContext,
} from '@/lib/vfx/types';

/**
 * Pack #1 — Iron & Ember (PoE2-inspired heavy stone, incandescent sparks,
 * crisp razor shockwave, and heavy braking ash dust). Uniform full weight on every drop.
 */
export const IRON_EMBER_PACK: VfxPack = {
  id: 'iron-ember',

  spawnSlam(rect: VfxRect, theme: VfxThemeContext): VfxEntity[] {
    const entities: VfxEntity[] = [];
    const showFissures = theme.dropFissures;
    const showDustRing = theme.dropDust;

    // 0. Floor-layer branching ground fracture when enabled
    if (showFissures) {
      entities.push(createGroundFissureEntity(rect, theme));
    }

    if (showDustRing) {
      // 1. Crisp expanding shockwave ring (120ms, hard alpha fade)
      entities.push(
        createShockwaveRing(rect, theme, {
          durationSec: 0.12,
          maxExpandPx: 30,
          coreWidth: 1.6,
        }),
      );

      // 2. Classic warm molten-amber + subtle accent incandescent sparks
      const warmTheme: VfxThemeContext = { ...theme, dropStyle: 'dust' };
      for (let i = 0; i < 20; i++) {
        const pt = sampleRectPerimeter(rect);
        const normLen = Math.hypot(pt.nx, pt.ny) || 1;
        const speed = randRange(210, 520);
        const vx = (pt.nx / normLen) * speed + randRange(-70, 70);
        const vy = (pt.ny / normLen) * speed - randRange(55, 165);
        entities.push(
          createIncandescentSpark(pt.x, pt.y, vx, vy, warmTheme, {
            lifetimeSec: randRange(0.28, 0.48),
            gravityY: SPARK_GRAVITY_PX_S2,
          }),
        );
      }

      // 3. Heavy stone/ash dust puffs (slightly softer when stacked over ground cracks)
      for (let i = 0; i < 9; i++) {
        const pt = sampleRectPerimeter(rect);
        const normLen = Math.hypot(pt.nx, pt.ny) || 1;
        const speed = randRange(180, 320);
        entities.push(
          createAshPuff(
            pt.x,
            pt.y,
            (pt.nx / normLen) * speed,
            (pt.ny / normLen) * speed,
            {
              lifetimeSec: randRange(0.5, 0.65),
              startSize: randRange(26, 36),
              endSize: randRange(56, 78),
              driftY: -42,
              peakAlpha: showFissures
                ? randRange(0.28, 0.42)
                : randRange(0.38, 0.54),
            },
          ),
        );
      }
    } else if (showFissures) {
      // Ground Fracture solo: subtle stone-dust kickup around the cracks (no ring or sparks)
      for (let i = 0; i < 5; i++) {
        const pt = sampleRectPerimeter(rect);
        const normLen = Math.hypot(pt.nx, pt.ny) || 1;
        const speed = randRange(145, 250);
        entities.push(
          createAshPuff(
            pt.x,
            pt.y,
            (pt.nx / normLen) * speed,
            (pt.ny / normLen) * speed,
            {
              lifetimeSec: randRange(0.45, 0.6),
              startSize: randRange(22, 30),
              endSize: randRange(46, 64),
              driftY: -32,
              peakAlpha: randRange(0.2, 0.3),
            },
          ),
        );
      }
    }

    return entities;
  },

  spawnDelete(rect: VfxRect, theme: VfxThemeContext): VfxEntity[] {
    const entities: VfxEntity[] = [];
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;

    // 1. Tight inward flash ring
    entities.push(
      createShockwaveRing(rect, theme, {
        durationSec: 0.105,
        maxExpandPx: 14,
        inward: true,
        coreWidth: 1.5,
      }),
    );

    // 2. Outward burst of crisp cinder shards (350-450ms)
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + randRange(-0.22, 0.22);
      const px = cx + Math.cos(angle) * randRange(6, rect.width * 0.36);
      const py = cy + Math.sin(angle) * randRange(4, rect.height * 0.36);
      const speed = randRange(150, 360);
      entities.push(
        createIncandescentSpark(
          px,
          py,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed - randRange(25, 95),
          theme,
          {
            lifetimeSec: randRange(0.35, 0.45),
            gravityY: 920,
            width: randRange(1.5, 2.5),
            stretch: 1.45,
          },
        ),
      );
    }

    // 3. Downward-falling ash dust dissolving over 360-450ms
    for (let i = 0; i < 7; i++) {
      const px = rect.x + randRange(0.12, 0.88) * rect.width;
      const py = rect.y + randRange(0.18, 0.82) * rect.height;
      entities.push(
        createAshPuff(px, py, randRange(-85, 85), randRange(20, 90), {
          lifetimeSec: randRange(0.36, 0.45),
          startSize: randRange(22, 32),
          endSize: randRange(44, 62),
          driftY: 140,
          peakAlpha: randRange(0.32, 0.46),
        }),
      );
    }

    return entities;
  },

  spawnBulkPulse(rect: VfxRect, theme: VfxThemeContext): VfxEntity[] {
    const entities: VfxEntity[] = [];

    // Fast perimeter shockwave sweep along the affected container edge
    entities.push(
      createShockwaveRing(rect, theme, {
        durationSec: 0.16,
        maxExpandPx: 26,
        coreWidth: 1.8,
      }),
    );

    // Container-edge incandescent spark burst
    for (let i = 0; i < 20; i++) {
      const pt = sampleRectPerimeter(rect);
      const normLen = Math.hypot(pt.nx, pt.ny) || 1;
      const speed = randRange(180, 440);
      entities.push(
        createIncandescentSpark(
          pt.x,
          pt.y,
          (pt.nx / normLen) * speed + randRange(-55, 55),
          (pt.ny / normLen) * speed - randRange(40, 120),
          theme,
          {
            lifetimeSec: randRange(0.3, 0.46),
            gravityY: 940,
          },
        ),
      );
    }

    return entities;
  },

  spawnDragMote(x: number, y: number, theme: VfxThemeContext): VfxEntity[] {
    const entities: VfxEntity[] = [];
    const count = Math.random() < 0.5 ? 2 : 1;

    for (let i = 0; i < count; i++) {
      if (Math.random() < 0.42) {
        entities.push(
          createAshPuff(
            x + randRange(-10, 10),
            y + randRange(-2, 2),
            randRange(-20, 20),
            randRange(16, 40),
            {
              lifetimeSec: randRange(0.32, 0.48),
              startSize: randRange(11, 16),
              endSize: randRange(20, 30),
              driftY: 120,
              peakAlpha: randRange(0.34, 0.48),
            },
          ),
        );
      } else {
        entities.push(
          createIncandescentSpark(
            x + randRange(-8, 8),
            y,
            randRange(-32, 32),
            randRange(24, 64),
            theme,
            {
              lifetimeSec: randRange(0.28, 0.44),
              gravityY: 360,
              width: randRange(1.4, 2.0),
              stretch: 1.35,
            },
          ),
        );
      }
    }

    return entities;
  },
};
