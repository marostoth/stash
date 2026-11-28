import { Check, Copy, Minus, PenLine, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { stashRepo } from '@/lib/storage/repo';
import type { LinkItem, ProductMeta } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import {
  computePriceDelta,
  formatPrice,
  normalizeCurrencyCode,
} from '@/lib/utils/price-math';
import { normalizeStoreName } from '@/lib/utils/product-url';

export function buildPriceTooltip(
  product: ProductMeta | undefined,
  unitPrice: number | undefined,
  displayQty: number,
  resolvedCurrency: string,
): string {
  const capturedLabel = product?.capturedAt
    ? (() => {
        const parsed = new Date(product.capturedAt);
        return Number.isNaN(parsed.getTime())
          ? ''
          : parsed.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
      })()
    : '';
  const sourceLabel =
    product?.source === 'manual'
      ? capturedLabel
        ? `Manual entry · ${capturedLabel}`
        : 'Manual entry'
      : capturedLabel
        ? `Captured ${capturedLabel}`
        : product?.source === 'ai'
          ? 'AI-extracted price'
          : 'Auto-extracted price';

  return unitPrice !== undefined && displayQty > 1
    ? `${formatPrice(unitPrice, resolvedCurrency, product?.priceIsEstimate)} × ${displayQty} · ${sourceLabel}`
    : sourceLabel;
}

interface InlineSpecCellProps {
  link: LinkItem;
  specOrNote: string;
}

/**
 * Click-to-edit inline `SPEC / NOTE` cell for Details view rows.
 * Saves to `product.spec` on product items and `note` on regular bookmarks.
 */
export function InlineSpecCell({ link, specOrNote }: InlineSpecCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(specOrNote);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(specOrNote);
  }, [editing, specOrNote]);

  const startEditing = () => {
    cancelledRef.current = false;
    setDraft(specOrNote);
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const commit = async () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditing(false);
      return;
    }
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === specOrNote.trim()) return;

    if (link.product) {
      const clearingFallbackNote =
        !trimmed && !link.product.spec && Boolean(link.note);
      await stashRepo.updateLink(link.id, {
        product: {
          ...link.product,
          spec: trimmed || undefined,
        },
        ...(clearingFallbackNote ? { note: '' } : {}),
      });
      return;
    }

    await stashRepo.updateLink(link.id, { note: trimmed });
  };

  if (editing) {
    return (
      <div className="hidden min-w-0 md:block">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelledRef.current = true;
              setDraft(specOrNote);
              setEditing(false);
            }
          }}
          placeholder="Add spec or note..."
          aria-label={`Edit spec or note for ${link.title}`}
          className="h-6 w-full rounded border border-accent/65 bg-canvas px-1.5 text-[11px] text-fg placeholder:text-fg-muted/60 focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      title={
        specOrNote
          ? `${specOrNote} · Click to edit`
          : 'Click to add spec or note'
      }
      aria-label={`Edit spec or note for ${link.title}`}
      className="hidden min-w-0 w-full truncate rounded px-1.5 py-0.5 -mx-1.5 text-left text-[11px] text-fg-muted transition-colors hover:bg-panel/90 hover:text-fg cursor-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 md:block"
    >
      {specOrNote || '—'}
    </button>
  );
}

interface InlinePriceCellProps {
  link: LinkItem;
  defaultCurrency: string;
  displayQty: number;
  isStarred: boolean;
  priceTooltip: string;
}

function parseInlinePriceInput(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/^[£$€¥₹]\s*/, '')
    .replace(/,/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return Number.NaN;
  return Math.round(parsed * 100) / 100;
}

/**
 * Click-to-edit inline `PRICE` cell for Details view rows.
 * Displays `unitPrice × qty` and edits the underlying unit price inline.
 */
export function InlinePriceCell({
  link,
  defaultCurrency,
  displayQty,
  isStarred,
  priceTooltip,
}: InlinePriceCellProps) {
  const product = link.product;
  const unitPrice =
    typeof product?.price === 'number' && Number.isFinite(product.price)
      ? product.price
      : undefined;
  const resolvedCurrency = normalizeCurrencyCode(
    product?.currency,
    defaultCurrency,
  );
  const linePrice =
    unitPrice !== undefined
      ? Math.round(unitPrice * displayQty * 100) / 100
      : undefined;
  const priceDelta = computePriceDelta(unitPrice, product?.previousPrice);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    unitPrice !== undefined ? String(unitPrice) : '',
  );
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!editing) {
      setDraft(unitPrice !== undefined ? String(unitPrice) : '');
    }
  }, [editing, unitPrice]);

  const startEditing = () => {
    cancelledRef.current = false;
    setDraft(unitPrice !== undefined ? String(unitPrice) : '');
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const commit = async () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditing(false);
      return;
    }
    setEditing(false);

    const parsed = parseInlinePriceInput(draft);
    if (Number.isNaN(parsed)) {
      setDraft(unitPrice !== undefined ? String(unitPrice) : '');
      return;
    }

    if (parsed === null) {
      if (unitPrice === undefined) return;
      if (!product) return;
      const remaining = {
        ...product,
        price: undefined,
      };
      const hasOtherData = Boolean(remaining.store || remaining.spec);
      await stashRepo.updateLink(link.id, {
        product: hasOtherData ? remaining : null,
      });
      return;
    }

    if (unitPrice !== undefined && parsed === unitPrice) return;

    await stashRepo.updateLink(link.id, {
      product: {
        store: product?.store ?? normalizeStoreName(link.url),
        ...(product?.spec ? { spec: product.spec } : {}),
        ...(product?.orderQty ? { orderQty: product.orderQty } : {}),
        ...(product?.priceIsEstimate ? { priceIsEstimate: true } : {}),
        price: parsed,
        currency: resolvedCurrency,
        source: 'manual',
        capturedAt: new Date().toISOString(),
      },
    });
  };

  if (editing) {
    return (
      <div className="flex items-center justify-end">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              void commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelledRef.current = true;
              setDraft(unitPrice !== undefined ? String(unitPrice) : '');
              setEditing(false);
            }
          }}
          placeholder="0.00"
          aria-label={`Edit unit price (${resolvedCurrency}) for ${link.title}`}
          title={`Unit price in ${resolvedCurrency} (Enter to save, Esc to cancel)`}
          className="h-6 w-[84px] rounded border border-accent/65 bg-canvas px-1.5 text-right font-mono text-[11px] tabular-nums text-fg placeholder:text-fg-muted/60 focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end font-mono text-[11px] tabular-nums">
      <button
        type="button"
        onClick={startEditing}
        title={
          linePrice !== undefined
            ? `${priceTooltip} · Click to edit unit price`
            : 'Click to add price'
        }
        aria-label={
          linePrice !== undefined
            ? `Edit unit price for ${link.title}`
            : `Add price for ${link.title}`
        }
        className="inline-flex items-center justify-end gap-1 rounded px-1.5 py-0.5 -mr-1.5 transition-colors hover:bg-panel/90 hover:text-accent cursor-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60"
      >
        {linePrice !== undefined && product ? (
          <>
            {priceDelta && product.previousPrice !== undefined && (
              <span
                title={
                  priceDelta.direction === 'down'
                    ? `Price dropped ${formatPrice(priceDelta.amount, resolvedCurrency)} (was ${formatPrice(product.previousPrice, resolvedCurrency)})`
                    : `Price up ${formatPrice(priceDelta.amount, resolvedCurrency)} (was ${formatPrice(product.previousPrice, resolvedCurrency)})`
                }
                className={cn(
                  'hidden shrink-0 items-center rounded px-1 py-0.25 font-mono text-[9px] font-semibold leading-none sm:inline-flex',
                  priceDelta.direction === 'down'
                    ? 'border border-accent/35 bg-accent/15 text-accent'
                    : 'border border-danger/35 bg-danger/15 text-danger',
                )}
              >
                {priceDelta.direction === 'down' ? '↓' : '↑'}
                {formatPrice(priceDelta.amount, resolvedCurrency)}
              </span>
            )}
            {product.source === 'manual' && (
              <PenLine
                className="h-3 w-3 shrink-0 text-fg-muted/70"
                aria-label="Manual price entry"
              />
            )}
            <span
              className={cn(isStarred ? 'font-semibold text-fg' : 'text-fg/95')}
            >
              {formatPrice(
                linePrice,
                resolvedCurrency,
                product.priceIsEstimate,
              )}
            </span>
          </>
        ) : (
          <span className="text-fg-muted/50">—</span>
        )}
      </button>
    </div>
  );
}

interface CopyListButtonProps {
  label?: string;
  title?: string;
  onBuildText: () => string;
}

/**
 * 1-click Copy Shopping List button with instant Check morph feedback.
 */
export function CopyListButton({
  label = 'Copy List',
  title = 'Copy formatted list to clipboard',
  onBuildText,
}: CopyListButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    const text = onBuildText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied list to clipboard');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCopied(false);
        timerRef.current = null;
      }, 1500);
    } catch {
      toast.error('Could not access clipboard');
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void handleCopy()}
      title={title}
      className="h-7 gap-1 px-2 text-[11px] text-fg-muted hover:text-fg"
    >
      {copied ? (
        <Check className="h-3 w-3 text-accent" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      <span className="hidden sm:inline">{copied ? 'Copied' : label}</span>
    </Button>
  );
}

export function InlineQtyCell({
  linkTitle,
  hasPrice,
  displayQty,
  onChangeQty,
}: {
  linkTitle: string;
  hasPrice: boolean;
  displayQty: number;
  onChangeQty: (delta: number) => void;
}) {
  return (
    <div className="flex items-center justify-center">
      {hasPrice ? (
        <div
          className="inline-flex items-center rounded border border-border bg-panel/90 font-mono text-[10px]"
          title="Order quantity"
        >
          <button
            type="button"
            onClick={() => onChangeQty(-1)}
            disabled={displayQty <= 1}
            aria-label={`Decrease quantity for ${linkTitle}`}
            className="inline-flex h-5 w-5 items-center justify-center text-fg-muted transition-colors hover:bg-card hover:text-fg disabled:opacity-35 cursor-pointer disabled:cursor-default"
          >
            <Minus className="h-2.5 w-2.5" />
          </button>
          <span className="min-w-[18px] px-1 text-center text-fg tabular-nums">
            {displayQty}
          </span>
          <button
            type="button"
            onClick={() => onChangeQty(1)}
            aria-label={`Increase quantity for ${linkTitle}`}
            className="inline-flex h-5 w-5 items-center justify-center text-fg-muted transition-colors hover:bg-card hover:text-fg cursor-pointer"
          >
            <Plus className="h-2.5 w-2.5" />
          </button>
        </div>
      ) : (
        <span className="font-mono text-[11px] text-fg-muted/40">—</span>
      )}
    </div>
  );
}
