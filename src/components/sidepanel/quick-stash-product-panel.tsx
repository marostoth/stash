import { Loader2, Minus, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  createProductFormDraft,
  type ProductFormDraft,
} from '@/components/workbench/product-fields-section';
import { cn } from '@/lib/utils/cn';
import { COMMON_CURRENCIES } from '@/lib/utils/price-math';

interface QuickStashProductPanelProps {
  isAlreadyStashed: boolean;
  extracting: boolean;
  notice: string | null;
  draft: ProductFormDraft;
  defaultCurrency: string;
  onExtract: () => void;
  onChangeDraft: (next: ProductFormDraft) => void;
}

const CURRENCY_PILLS: ReadonlyArray<{ code: string; symbol: string }> = [
  { code: 'GBP', symbol: '£' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
];

/**
 * Machined inline Product & Price editor drawer for the Side Panel.
 * Uses strictly custom theme-aware controls (zero native `<select>` borders).
 */
export function QuickStashProductPanel({
  isAlreadyStashed,
  extracting,
  notice,
  draft,
  defaultCurrency,
  onExtract,
  onChangeDraft,
}: QuickStashProductPanelProps) {
  const updateManual = (patch: Partial<ProductFormDraft>) => {
    onChangeDraft({
      ...draft,
      ...patch,
      source: 'manual',
      capturedAt: new Date().toISOString(),
    });
  };

  const activeCurrency = COMMON_CURRENCIES.some(
    (c) => c.code === draft.currency,
  )
    ? draft.currency
    : defaultCurrency;
  const qty = Math.max(1, Math.floor(draft.orderQty ?? 1));
  const hasAnyValue = Boolean(
    draft.store.trim() ||
      draft.priceRaw.trim() ||
      draft.spec.trim() ||
      (draft.orderQty && draft.orderQty > 1),
  );

  return (
    <div className="space-y-2 rounded-control border border-hairline bg-canvas/65 p-2.5">
      {/* Drawer Header: Re-detect + Clear */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
          Product &amp; Price
        </span>
        <div className="flex items-center gap-1">
          {hasAnyValue && (
            <button
              type="button"
              onClick={() =>
                onChangeDraft(
                  createProductFormDraft(undefined, defaultCurrency),
                )
              }
              title="Clear product fields"
              className="inline-flex h-6 items-center gap-1 rounded px-1.5 font-mono text-[10px] text-fg-muted transition-colors hover:bg-card-hover hover:text-fg cursor-pointer"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>Clear</span>
            </button>
          )}
          <button
            type="button"
            disabled={extracting}
            onClick={onExtract}
            className="inline-flex h-6 items-center gap-1 rounded border border-hairline bg-[var(--stash-card)] px-2 font-mono text-[10px] text-fg-muted transition-colors hover:border-accent/45 hover:text-accent disabled:opacity-50 cursor-pointer"
          >
            {extracting ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin text-accent" />
            ) : (
              <RefreshCw className="h-2.5 w-2.5" />
            )}
            <span>
              {extracting
                ? 'Detecting...'
                : isAlreadyStashed
                  ? 'Refresh'
                  : 'Auto-detect'}
            </span>
          </button>
        </div>
      </div>

      {notice && <p className="font-mono text-[10px] text-warning">{notice}</p>}

      {/* Store + Currency Segmented Switcher */}
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <div className="min-w-0 space-y-1">
          <label
            htmlFor="sp-product-store"
            className="block font-mono text-[9px] uppercase tracking-wider text-fg-muted"
          >
            Retailer
          </label>
          <Input
            id="sp-product-store"
            value={draft.store}
            onChange={(e) => updateManual({ store: e.target.value })}
            placeholder="Halfords, Amazon..."
            className="h-7 text-xs"
          />
        </div>

        <div className="space-y-1">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-fg-muted">
            Currency
          </span>
          <fieldset
            aria-label="Currency"
            className="m-0 inline-flex h-7 items-center rounded-control border border-hairline bg-[var(--stash-panel)] p-0.5"
          >
            {CURRENCY_PILLS.map(({ code, symbol }) => {
              const selected = activeCurrency === code;
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => updateManual({ currency: code })}
                  title={code}
                  className={cn(
                    'inline-flex h-5.5 items-center justify-center rounded-[calc(var(--stash-radius-control)-2px)] px-2 font-mono text-[10px] font-medium transition-colors cursor-pointer',
                    selected
                      ? 'bg-elevated text-accent shadow-xs'
                      : 'text-fg-muted hover:text-fg',
                  )}
                >
                  {symbol}
                </button>
              );
            })}
          </fieldset>
        </div>
      </div>

      {/* Price + Qty Stepper + Estimate Toggle */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[96px] flex-1 space-y-1">
          <label
            htmlFor="sp-product-price"
            className="block font-mono text-[9px] uppercase tracking-wider text-fg-muted"
          >
            Unit Price
          </label>
          <Input
            id="sp-product-price"
            type="number"
            step="0.01"
            min="0"
            value={draft.priceRaw}
            onChange={(e) => updateManual({ priceRaw: e.target.value })}
            placeholder="0.00"
            className="h-7 font-mono text-xs tabular-nums"
          />
        </div>

        <div className="space-y-1">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-fg-muted">
            Qty
          </span>
          <div className="inline-flex h-7 items-center rounded-control border border-hairline bg-[var(--stash-panel)]">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={qty <= 1}
              onClick={() => updateManual({ orderQty: Math.max(1, qty - 1) })}
              className="inline-flex h-full w-6 items-center justify-center text-fg-muted transition-colors hover:text-fg disabled:opacity-35 cursor-pointer"
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="min-w-[22px] text-center font-mono text-[11px] text-fg tabular-nums">
              {qty}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => updateManual({ orderQty: qty + 1 })}
              className="inline-flex h-full w-6 items-center justify-center text-fg-muted transition-colors hover:text-fg cursor-pointer"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>

        <div className="flex h-7 items-center gap-1.5 rounded-control border border-hairline bg-[var(--stash-panel)] px-2">
          <label
            htmlFor="sp-product-estimate"
            className="font-mono text-[10px] text-fg-muted select-none cursor-pointer"
          >
            Est.
          </label>
          <Switch
            id="sp-product-estimate"
            checked={draft.priceIsEstimate}
            onCheckedChange={(checked) =>
              updateManual({ priceIsEstimate: checked })
            }
          />
        </div>
      </div>

      {/* Spec / Variant */}
      <div className="space-y-1">
        <label
          htmlFor="sp-product-spec"
          className="block font-mono text-[9px] uppercase tracking-wider text-fg-muted"
        >
          Spec / Variant
        </label>
        <Input
          id="sp-product-spec"
          value={draft.spec}
          onChange={(e) => updateManual({ spec: e.target.value })}
          placeholder="e.g. 5L · 5W-30 · Black"
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}
