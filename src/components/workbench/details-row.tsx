import { Minus, Pencil, PenLine, Plus, Star, Trash2 } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { LinkFavicon } from '@/components/LinkFavicon';
import { playDelete, playDrop, playTagPop } from '@/lib/audio/foley';
import { stashRepo } from '@/lib/storage/repo';
import type { LinkItem, MotionMode, ProductMeta } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import {
  createDebouncedWriter,
  type DebouncedWriter,
} from '@/lib/utils/coalesce';
import { formatPrice, normalizeCurrencyCode } from '@/lib/utils/price-math';
import { normalizeStoreName } from '@/lib/utils/product-url';
import { useUiStore } from '@/store/ui-store';

const QTY_SAVE_DEBOUNCE_MS = 250;

interface DetailsRowProps {
  link: LinkItem;
  showPriceColumn: boolean;
  defaultCurrency: string;
  openInNewTab: boolean;
  motionMode: MotionMode;
  soundEffects: boolean;
  hoverPreviews: boolean;
  gridTemplateClass: string;
}

function formatCapturedDate(iso?: string): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const DetailsRow = memo(function DetailsRow({
  link,
  showPriceColumn,
  defaultCurrency,
  openInNewTab,
  motionMode,
  soundEffects,
  hoverPreviews,
  gridTemplateClass,
}: DetailsRowProps) {
  const openEditLink = useUiStore((s) => s.openEditLink);
  const schedulePreview = useUiStore((s) => s.schedulePreview);
  const dismissPreview = useUiStore((s) => s.dismissPreview);
  const settleLink = useUiStore((s) => s.settleLink);
  const isKeyboardFocused = useUiStore(
    (s) => s.keyboardFocusedLinkId === link.id,
  );

  const isStarred = link.starred === true;
  const product = link.product;
  const hasPrice =
    typeof product?.price === 'number' && Number.isFinite(product.price);
  const qty =
    typeof product?.orderQty === 'number' && product.orderQty >= 1
      ? Math.floor(product.orderQty)
      : 1;
  const [displayQty, setDisplayQty] = useState(qty);
  const productRef = useRef<ProductMeta | undefined>(product);
  productRef.current = product;
  const qtyWriterRef = useRef<DebouncedWriter<number> | null>(null);

  useEffect(() => {
    setDisplayQty(qty);
  }, [qty]);

  useEffect(() => {
    const linkId = link.id;
    const writer = createDebouncedWriter<number>((nextQty) => {
      const latestProduct = productRef.current;
      if (!latestProduct) return;
      void stashRepo.updateLink(linkId, {
        product: {
          ...latestProduct,
          orderQty: nextQty,
        },
      });
    }, QTY_SAVE_DEBOUNCE_MS);
    qtyWriterRef.current = writer;
    return () => {
      writer.flush();
      qtyWriterRef.current = null;
    };
  }, [link.id]);

  const storeName = normalizeStoreName(link.url, product?.store);
  const specOrNote = product?.spec || link.note || '';
  const visibleTags = link.tags.slice(0, 2);
  const capturedLabel = formatCapturedDate(product?.capturedAt);

  const priceTooltip =
    product?.source === 'manual'
      ? capturedLabel
        ? `Manual entry · ${capturedLabel}`
        : 'Manual entry'
      : capturedLabel
        ? `Captured ${capturedLabel}`
        : product?.source === 'ai'
          ? 'AI-extracted price'
          : 'Auto-extracted price';

  const handleToggleStar = async () => {
    const nextStarred = !isStarred;
    const res = await stashRepo.updateLink(link.id, { starred: nextStarred });
    if (res.ok && nextStarred) {
      playTagPop(soundEffects, motionMode);
    }
  };

  const handleChangeQty = (delta: number) => {
    if (!product || !hasPrice) return;
    setDisplayQty((prev) => {
      const nextQty = Math.max(1, Math.min(999, prev + delta));
      if (nextQty !== prev) {
        qtyWriterRef.current?.schedule(nextQty);
      }
      return nextQty;
    });
  };

  const handleDelete = async () => {
    const snapshot: LinkItem = {
      ...link,
      tags: [...link.tags],
      ...(link.product ? { product: { ...link.product } } : {}),
    };
    dismissPreview();
    const deleted = await stashRepo.deleteLink(snapshot.id);
    if (!deleted) return;
    playDelete(soundEffects);
    toast('Link removed', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          void stashRepo.restoreLink(snapshot).then((restored) => {
            if (restored) {
              playDrop(soundEffects, motionMode);
              settleLink(restored.id);
            }
          });
        },
      },
    });
  };

  const handlePointerEnterTitle = (
    event: React.PointerEvent<HTMLAnchorElement>,
  ) => {
    if (!hoverPreviews) return;
    const rect = event.currentTarget.getBoundingClientRect();
    schedulePreview({
      id: `link:${link.id}`,
      url: link.url,
      title: link.title,
      note: specOrNote || undefined,
      tags: link.tags,
      faviconUrl: link.faviconUrl,
      anchor: {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
      preferredSide: 'bottom',
    });
  };

  return (
    <div
      data-link-id={link.id}
      className={cn(
        'group relative grid min-h-[36px] items-center gap-2 border-b border-border/60 px-2.5 py-1 text-xs transition-colors last:border-b-0 hover:bg-card-hover/80',
        gridTemplateClass,
        isStarred && 'bg-accent/[0.06]',
        isKeyboardFocused && 'bg-accent/10 ring-1 ring-inset ring-accent/70',
      )}
    >
      {isStarred && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-accent"
        />
      )}

      {/* 1. Star toggle */}
      <button
        type="button"
        onClick={() => void handleToggleStar()}
        aria-pressed={isStarred}
        aria-label={isStarred ? `Unstar ${link.title}` : `Star ${link.title}`}
        className={cn(
          'inline-flex h-6 w-6 items-center justify-center rounded transition-colors cursor-pointer',
          isStarred ? 'text-accent' : 'text-fg-muted/50 hover:text-accent',
        )}
      >
        <Star
          className={cn('h-3.5 w-3.5', isStarred && 'fill-accent text-accent')}
        />
      </button>

      {/* 2. Item (Favicon + Title) */}
      <a
        href={link.url}
        target={openInNewTab ? '_blank' : '_self'}
        rel={openInNewTab ? 'noopener noreferrer' : undefined}
        onClick={() => {
          dismissPreview();
          void stashRepo.markLinkOpened(link.id);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          openEditLink(link);
        }}
        onPointerEnter={handlePointerEnterTitle}
        onPointerLeave={dismissPreview}
        className="flex min-w-0 items-center gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded border border-border/80 bg-panel">
          <LinkFavicon url={link.url} faviconUrl={link.faviconUrl} size="sm" />
        </div>
        <span className="truncate font-medium text-fg group-hover:text-accent transition-colors">
          {link.title}
        </span>
      </a>

      {/* 3. Store */}
      <span className="truncate font-mono text-[11px] text-fg-muted">
        {storeName}
      </span>

      {/* 4. Price (auto-hidden if Space has zero priced items) */}
      {showPriceColumn && (
        <div
          title={hasPrice ? priceTooltip : undefined}
          className="flex items-center justify-end gap-1 font-mono text-[11px] tabular-nums"
        >
          {hasPrice && product?.price !== undefined ? (
            <>
              {product.source === 'manual' && (
                <PenLine
                  className="h-3 w-3 shrink-0 text-fg-muted/70"
                  aria-label="Manual price entry"
                />
              )}
              <span
                className={cn(
                  isStarred ? 'font-semibold text-fg' : 'text-fg/90',
                )}
              >
                {formatPrice(
                  product.price,
                  normalizeCurrencyCode(product.currency, defaultCurrency),
                  product.priceIsEstimate,
                )}
              </span>
            </>
          ) : (
            <span className="text-fg-muted/50">—</span>
          )}
        </div>
      )}

      {/* 5. Spec / Note */}
      <span
        title={specOrNote || undefined}
        className="hidden truncate text-[11px] text-fg-muted md:block"
      >
        {specOrNote || '—'}
      </span>

      {/* 6. Tags */}
      <div className="hidden items-center gap-1 overflow-hidden lg:flex">
        {visibleTags.map((tag) => (
          <span
            key={tag}
            className="truncate rounded-pill border border-border bg-panel px-1.5 py-0.25 font-mono text-[10px] text-fg-muted"
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* 7. Persistent Qty Stepper (on all priced rows) & Hover Actions */}
      <div className="flex items-center justify-end gap-1">
        {showPriceColumn && hasPrice && (
          <div
            className="inline-flex items-center rounded border border-border bg-panel/90 font-mono text-[10px]"
            title="Order quantity"
          >
            <button
              type="button"
              onClick={() => handleChangeQty(-1)}
              disabled={displayQty <= 1}
              aria-label={`Decrease quantity for ${link.title}`}
              className="inline-flex h-5 w-5 items-center justify-center text-fg-muted transition-colors hover:bg-card hover:text-fg disabled:opacity-35 cursor-pointer disabled:cursor-default"
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="min-w-[18px] px-1 text-center text-fg tabular-nums">
              {displayQty}
            </span>
            <button
              type="button"
              onClick={() => handleChangeQty(1)}
              aria-label={`Increase quantity for ${link.title}`}
              className="inline-flex h-5 w-5 items-center justify-center text-fg-muted transition-colors hover:bg-card hover:text-fg cursor-pointer"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => openEditLink(link)}
            aria-label={`Edit ${link.title}`}
            title="Quick edit"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-panel hover:text-fg cursor-pointer"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            aria-label={`Delete ${link.title}`}
            title="Delete link (Undo available)"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-danger/15 hover:text-danger cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
});
