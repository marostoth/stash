import type { DropEffectStyle, MotionMode } from '@/lib/types/stash';
import {
  appendEntitiesWithCap,
  collectNearbyOccluderRects,
  DRAG_MOTE_THROTTLE_MS,
  domRectToVfxRect,
  MAX_VFX_DPR,
  MAX_VFX_ENTITIES,
  MOLTEN_AMBER_RGB,
  parseCssColorToRgb,
  VFX_OCCLUDER_PADDING_PX,
} from '@/lib/vfx/math';
import { IRON_EMBER_PACK } from '@/lib/vfx/packs/iron-ember';
import { createVfxSpriteSet } from '@/lib/vfx/sprites';
import type {
  VfxEntity,
  VfxPack,
  VfxRect,
  VfxSpriteSet,
  VfxThemeContext,
} from '@/lib/vfx/types';

export interface VfxEngineConfig {
  motionMode: MotionMode;
  dropDust: boolean;
  dropFissures: boolean;
  dropEffectStyle?: DropEffectStyle;
}

const RESIZE_DEBOUNCE_MS = 120;

interface CachedThemeTokens {
  accentRgb: VfxThemeContext['accentRgb'];
  textRgb: VfxThemeContext['textRgb'];
  isDark: boolean;
}

function readReducedMotionOnce(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function computeThemeTokens(): CachedThemeTokens {
  if (
    typeof document === 'undefined' ||
    typeof getComputedStyle !== 'function'
  ) {
    return {
      accentRgb: MOLTEN_AMBER_RGB,
      textRgb: { r: 230, g: 230, b: 230 },
      isDark: true,
    };
  }
  const styles = getComputedStyle(document.documentElement);
  const accentRaw = styles.getPropertyValue('--stash-accent');
  const textRaw = styles.getPropertyValue('--stash-text');
  const canvasRaw = styles.getPropertyValue('--stash-canvas');
  const canvasRgb = parseCssColorToRgb(canvasRaw, { r: 14, g: 16, b: 19 });
  const luma = 0.299 * canvasRgb.r + 0.587 * canvasRgb.g + 0.114 * canvasRgb.b;
  return {
    accentRgb: parseCssColorToRgb(accentRaw, MOLTEN_AMBER_RGB),
    textRgb: parseCssColorToRgb(textRaw, { r: 230, g: 230, b: 230 }),
    isDark: luma < 128,
  };
}

function appendRoundedRectSubpath(
  ctx: CanvasRenderingContext2D,
  exclude: VfxRect,
): void {
  const r = Math.max(
    0,
    Math.min(exclude.radius ?? 10, Math.min(exclude.width, exclude.height) / 2),
  );
  const { x, y, width: w, height: h } = exclude;

  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

function applyFloorExclusionClip(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  excludes: readonly VfxRect[],
): void {
  ctx.beginPath();
  // Outer viewport rect
  ctx.rect(0, 0, width, height);
  // Punch rounded cutouts for the dropped card and nearby neighbor cards so
  // floor fractures travel cleanly across gutters and duck beneath neighbor cards
  for (const exclude of excludes) {
    appendRoundedRectSubpath(ctx, exclude);
  }
  ctx.clip('evenodd');
}

function queryNearbyOccluderRects(origin: VfxRect): VfxRect[] {
  if (typeof document === 'undefined') return [origin];
  const nodes = document.querySelectorAll('[data-vfx-occluder]');
  if (nodes.length === 0) return [origin];
  const radius = origin.radius ?? 10;
  const candidates: VfxRect[] = [];
  for (const node of nodes) {
    const domRect = node.getBoundingClientRect();
    if (domRect.width > 0 && domRect.height > 0) {
      candidates.push(domRectToVfxRect(domRect, radius));
    }
  }
  return collectNearbyOccluderRects(
    origin,
    candidates,
    VFX_OCCLUDER_PADDING_PX,
  );
}

export interface VfxEngine {
  mount: (canvas: HTMLCanvasElement) => () => void;
  setConfig: (config: VfxEngineConfig) => void;
  setPack: (pack: VfxPack) => void;
  spawnSlam: (rect: VfxRect) => void;
  spawnDelete: (rect: VfxRect) => void;
  spawnBulkPulse: (rect: VfxRect) => void;
  spawnDragMote: (x: number, y: number, nowMs?: number) => void;
  clear: () => void;
}

/**
 * Lightweight, zero-idle-overhead 2D Canvas VFX loop manager.
 * Starts `requestAnimationFrame` only while active entities exist and
 * cancels/clears immediately once the pool drains.
 */
export function createVfxEngine(initialPack: VfxPack): VfxEngine {
  let activePack = initialPack;
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let sprites: VfxSpriteSet = { ashPuff: null, glowDot: null };
  let entities: VfxEntity[] = [];
  let rafId: number | null = null;
  let lastFrameMs = 0;
  let lastDragMoteMs = 0;
  let viewportW = 0;
  let viewportH = 0;
  let config: VfxEngineConfig = {
    motionMode: 'tactile',
    dropDust: true,
    dropFissures: true,
  };
  let reducedMotion = readReducedMotionOnce();
  let cachedThemeTokens: CachedThemeTokens | null = null;

  const isEnabled = (): boolean =>
    config.motionMode === 'arcade' && !reducedMotion;

  const getThemeContext = (): VfxThemeContext => {
    const tokens = cachedThemeTokens ?? computeThemeTokens();
    if (canvas) {
      cachedThemeTokens = tokens;
    }
    return {
      ...tokens,
      // Keep sparks in the classic warm molten-amber + subtle accent palette
      dropStyle: 'dust',
      dropDust: config.dropDust,
      dropFissures: config.dropFissures,
    };
  };

  const clearCanvas = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, viewportW, viewportH);
  };

  const stopLoop = () => {
    if (rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafId);
    }
    rafId = null;
    lastFrameMs = 0;
  };

  const syncSize = () => {
    if (!canvas || !ctx || typeof window === 'undefined') return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_VFX_DPR);
    viewportW = Math.max(1, window.innerWidth);
    viewportH = Math.max(1, window.innerHeight);
    canvas.width = Math.round(viewportW * dpr);
    canvas.height = Math.round(viewportH * dpr);
    canvas.style.width = `${viewportW}px`;
    canvas.style.height = `${viewportH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const tick = (nowMs: number) => {
    rafId = null;
    if (!ctx || !isEnabled()) {
      entities = [];
      clearCanvas();
      return;
    }

    const dtSec =
      lastFrameMs > 0
        ? Math.min(0.05, Math.max(0.001, (nowMs - lastFrameMs) / 1000))
        : 1 / 60;
    lastFrameMs = nowMs;

    const survivors: VfxEntity[] = [];
    for (const entity of entities) {
      if (entity.update(dtSec)) {
        survivors.push(entity);
      }
    }
    entities = survivors;

    clearCanvas();

    if (entities.length === 0) {
      lastFrameMs = 0;
      return;
    }

    // Pass 1: 'floor' entities with optional evenodd interior card + neighbor exclusion clipping
    for (const entity of entities) {
      if (entity.layer !== 'floor') continue;
      if (entity.excludeRects && entity.excludeRects.length > 0) {
        ctx.save();
        applyFloorExclusionClip(ctx, viewportW, viewportH, entity.excludeRects);
        entity.render(ctx, sprites);
        ctx.restore();
      } else {
        entity.render(ctx, sprites);
      }
    }

    // Pass 2: 'air' entities rendered freely above everything
    for (const entity of entities) {
      if (entity.layer !== 'air') continue;
      entity.render(ctx, sprites);
    }

    rafId = requestAnimationFrame(tick);
  };

  const enqueue = (spawned: readonly VfxEntity[]) => {
    if (!canvas || !ctx || !isEnabled() || spawned.length === 0) return;
    entities = appendEntitiesWithCap(entities, spawned, MAX_VFX_ENTITIES);
    if (rafId === null && typeof requestAnimationFrame === 'function') {
      lastFrameMs = 0;
      rafId = requestAnimationFrame(tick);
    }
  };

  return {
    mount(target: HTMLCanvasElement) {
      canvas = target;
      ctx = target.getContext('2d');
      sprites = createVfxSpriteSet();
      cachedThemeTokens = computeThemeTokens();
      syncSize();

      let resizeTimer: ReturnType<typeof setTimeout> | null = null;
      const handleResize = () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          syncSize();
          resizeTimer = null;
        }, RESIZE_DEBOUNCE_MS);
      };

      let mql: MediaQueryList | null = null;
      const handleReducedMotionChange = (event: MediaQueryListEvent) => {
        reducedMotion = event.matches;
        if (!isEnabled()) {
          stopLoop();
          entities = [];
          clearCanvas();
        }
      };

      let themeObserver: MutationObserver | null = null;
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', handleResize, { passive: true });
        if (typeof window.matchMedia === 'function') {
          mql = window.matchMedia('(prefers-reduced-motion: reduce)');
          reducedMotion = mql.matches;
          mql.addEventListener('change', handleReducedMotionChange);
        }
      }
      if (
        typeof MutationObserver === 'function' &&
        typeof document !== 'undefined' &&
        document.documentElement
      ) {
        themeObserver = new MutationObserver(() => {
          cachedThemeTokens = null;
        });
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['style', 'data-theme', 'class'],
        });
      }

      return () => {
        stopLoop();
        entities = [];
        clearCanvas();
        if (resizeTimer) clearTimeout(resizeTimer);
        if (typeof window !== 'undefined') {
          window.removeEventListener('resize', handleResize);
        }
        mql?.removeEventListener('change', handleReducedMotionChange);
        themeObserver?.disconnect();
        cachedThemeTokens = null;
        canvas = null;
        ctx = null;
      };
    },

    setConfig(next: VfxEngineConfig) {
      config = next;
      if (!isEnabled()) {
        stopLoop();
        entities = [];
        clearCanvas();
      }
    },

    setPack(pack: VfxPack) {
      activePack = pack;
    },

    spawnSlam(rect: VfxRect) {
      if (!isEnabled() || rect.width <= 0 || rect.height <= 0) return;
      const spawned = activePack.spawnSlam(rect, getThemeContext());
      if (spawned.some((entity) => entity.layer === 'floor')) {
        const occluders = queryNearbyOccluderRects(rect);
        for (const entity of spawned) {
          if (entity.layer === 'floor') {
            entity.excludeRects = occluders;
          }
        }
      }
      enqueue(spawned);
    },

    spawnDelete(rect: VfxRect) {
      if (!isEnabled() || rect.width <= 0 || rect.height <= 0) return;
      enqueue(activePack.spawnDelete(rect, getThemeContext()));
    },

    spawnBulkPulse(rect: VfxRect) {
      if (!isEnabled() || rect.width <= 0 || rect.height <= 0) return;
      enqueue(activePack.spawnBulkPulse(rect, getThemeContext()));
    },

    spawnDragMote(x: number, y: number, nowMs = performance.now()) {
      if (!isEnabled()) return;
      if (nowMs - lastDragMoteMs < DRAG_MOTE_THROTTLE_MS) return;
      lastDragMoteMs = nowMs;
      enqueue(activePack.spawnDragMote(x, y, getThemeContext()));
    },

    clear() {
      stopLoop();
      entities = [];
      clearCanvas();
    },
  };
}

export const vfxEngine = createVfxEngine(IRON_EMBER_PACK);

export function captureSelectorRect(
  selector: string,
  radius = 10,
): VfxRect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return domRectToVfxRect(rect, radius);
}

export function spawnSlamForElement(
  el: Element | null | undefined,
  radius = 10,
): void {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  vfxEngine.spawnSlam(domRectToVfxRect(rect, radius));
}

export function spawnDeleteForElement(
  el: Element | null | undefined,
  radius = 10,
): void {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  vfxEngine.spawnDelete(domRectToVfxRect(rect, radius));
}

export function spawnBulkPulseForElement(
  el: Element | null | undefined,
  radius = 10,
): void {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  vfxEngine.spawnBulkPulse(domRectToVfxRect(rect, radius));
}

export function spawnBulkPulseForSelector(selector: string, radius = 10): void {
  const rect = captureSelectorRect(selector, radius);
  if (rect) vfxEngine.spawnBulkPulse(rect);
}
