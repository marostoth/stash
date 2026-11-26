import { PenLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { stashRepo } from '@/lib/storage/repo';
import type { LinkItem } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { formatPrice, normalizeCurrencyCode } from '@/lib/utils/price-math';
import { normalizeStoreName } from '@/lib/utils/product-url';

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
