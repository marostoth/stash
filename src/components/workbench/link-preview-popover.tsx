import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isTactileMotion, MODAL_SPRING } from '@/lib/motion/presets';
import type { PreviewCacheEntry } from '@/lib/previews/cache';
import { loadVisualPreview } from '@/lib/previews/preview-client';
import type { MotionMode } from '@/lib/types/stash';
import { extractDomain } from '@/lib/utils/url';
import { type PreviewTarget, useUiStore } from '@/store/ui-store';

interface LinkPreviewPopoverProps {
  hoverPreviews: boolean;
  visualPreviewsEnabled: boolean;
  motionMode: MotionMode;
}

const POPOVER_WIDTH = 308;
const VIEWPORT_MARGIN = 12;
const ANCHOR_GAP = 10;

function computePopoverCoords(
  target: PreviewTarget,
  popoverHeight: number,
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const height = Math.max(120, popoverHeight);

  if (target.preferredSide === 'left') {
    let left = target.anchor.left - POPOVER_WIDTH - ANCHOR_GAP;
    if (left < VIEWPORT_MARGIN) {
      left = Math.min(
        vw - POPOVER_WIDTH - VIEWPORT_MARGIN,
        target.anchor.right + ANCHOR_GAP,
      );
    }
    const centeredTop =
      target.anchor.top + target.anchor.height / 2 - height / 2;
    const top = Math.max(
      VIEWPORT_MARGIN,
      Math.min(vh - height - VIEWPORT_MARGIN, centeredTop),
    );
    return { left, top };
  }

  let top = target.anchor.bottom + ANCHOR_GAP;
  if (top + height > vh - VIEWPORT_MARGIN) {
    const flippedTop = target.anchor.top - height - ANCHOR_GAP;
    top =
      flippedTop >= VIEWPORT_MARGIN
        ? flippedTop
        : Math.max(VIEWPORT_MARGIN, vh - height - VIEWPORT_MARGIN);
  }

  const idealLeft =
    target.anchor.left + target.anchor.width / 2 - POPOVER_WIDTH / 2;
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(vw - POPOVER_WIDTH - VIEWPORT_MARGIN, idealLeft),
  );

  return { left, top };
}

export function LinkPreviewPopover({
  hoverPreviews,
  visualPreviewsEnabled,
  motionMode,
}: LinkPreviewPopoverProps) {
  const activePreview = useUiStore((s) => s.activePreview);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [entry, setEntry] = useState<PreviewCacheEntry | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [ogImageBroken, setOgImageBroken] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState(220);

  useEffect(() => {
    setEntry(null);
    setOgImageBroken(false);

    if (!hoverPreviews || !activePreview) return;

    let cancelled = false;
    void loadVisualPreview(activePreview.url, visualPreviewsEnabled).then(
      (result) => {
        if (!cancelled) {
          setEntry(result);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [activePreview, hoverPreviews, visualPreviewsEnabled]);

  useEffect(() => {
    if (!entry?.screenshotBlob) {
      setScreenshotUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(entry.screenshotBlob);
    setScreenshotUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [entry?.screenshotBlob]);

  const remeasure = useCallback(() => {
    const el = popoverRef.current;
    if (!el) return;
    const nextHeight = Math.ceil(el.getBoundingClientRect().height);
    if (nextHeight > 0) {
      setMeasuredHeight((prev) =>
        Math.abs(nextHeight - prev) > 2 ? nextHeight : prev,
      );
    }
  }, []);

  useEffect(() => {
    if (!activePreview) return;
    const el = popoverRef.current;
    if (!el) return;

    remeasure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(remeasure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [activePreview, remeasure]);

  if (!hoverPreviews || typeof document === 'undefined') {
    return null;
  }

  const tactile = isTactileMotion(motionMode);
  const coords = activePreview
    ? computePopoverCoords(activePreview, measuredHeight)
    : { left: 0, top: 0 };

  const showScreenshot = Boolean(screenshotUrl);
  const showOgImage =
    !showScreenshot && Boolean(entry?.ogImageUrl) && !ogImageBroken;

  return createPortal(
    <AnimatePresence>
      {activePreview && (
        <motion.div
          key={activePreview.id}
          ref={popoverRef}
          initial={tactile ? { opacity: 0, scale: 0.96, y: 4 } : { opacity: 0 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={tactile ? { opacity: 0, scale: 0.97 } : { opacity: 0 }}
          transition={tactile ? MODAL_SPRING : { duration: 0.08 }}
          style={{
            left: coords.left,
            top: coords.top,
            width: POPOVER_WIDTH,
          }}
          className="pointer-events-none fixed z-50 overflow-hidden rounded-card border border-border bg-panel text-fg shadow-2xl"
        >
          {/* Visual Media Banner: Screenshot priority -> OG image fallback */}
          {showScreenshot && screenshotUrl && (
            <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border bg-canvas">
              <img
                src={screenshotUrl}
                alt=""
                onLoad={remeasure}
                className="h-full w-full object-cover object-top"
              />
              <span className="absolute right-2 top-2 rounded-pill border border-border bg-panel/85 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent backdrop-blur-xs">
                Snapshot
              </span>
            </div>
          )}

          {showOgImage && entry?.ogImageUrl && (
            <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-border bg-canvas">
              <img
                src={entry.ogImageUrl}
                alt=""
                onLoad={remeasure}
                onError={() => setOgImageBroken(true)}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {/* Metadata Body */}
          <div className="space-y-2 p-3">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold leading-snug text-fg">
                {activePreview.title || entry?.ogTitle}
              </div>
              <div className="break-all font-mono text-[10px] leading-tight text-fg-muted line-clamp-2">
                {activePreview.url}
              </div>
            </div>

            {entry?.ogDescription && (
              <p className="line-clamp-3 text-[11px] leading-relaxed text-fg-muted">
                {entry.ogDescription}
              </p>
            )}

            {activePreview.note && (
              <div className="rounded-control border-l-2 border-accent bg-canvas/80 px-2 py-1.5 text-[11px] leading-snug text-fg">
                {activePreview.note}
              </div>
            )}

            {activePreview.tags && activePreview.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {activePreview.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-pill border border-border bg-canvas px-2 py-0.5 font-mono text-[10px] text-fg-muted"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {!showScreenshot && !showOgImage && !entry?.ogDescription && (
              <div className="font-mono text-[10px] text-fg-muted/75">
                {extractDomain(activePreview.url)}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
