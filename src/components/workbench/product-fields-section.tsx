import { ChevronDown, ChevronRight, ShoppingBag } from 'lucide-react';
import { Input, Select } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { ProductMeta, ProductMetaSource } from '@/lib/types/stash';
import { COMMON_CURRENCIES } from '@/lib/utils/price-math';

export interface ProductFormDraft {
  store: string;
  priceRaw: string;
  currency: string;
  priceIsEstimate: boolean;
  spec: string;
  source: ProductMetaSource;
  orderQty?: number;
  capturedAt?: string;
}

export function createProductFormDraft(
  product: ProductMeta | undefined,
  defaultCurrency: string,
): ProductFormDraft {
  return {
    store: product?.store ?? '',
    priceRaw:
      typeof product?.price === 'number' ? product.price.toFixed(2) : '',
    currency: product?.currency ?? defaultCurrency,
    priceIsEstimate: product?.priceIsEstimate === true,
    spec: product?.spec ?? '',
    source: product?.source ?? 'manual',
    orderQty: product?.orderQty,
    capturedAt: product?.capturedAt,
  };
}

export function buildProductMetaFromDraft(
  draft: ProductFormDraft,
): ProductMeta | undefined {
  const store = draft.store.trim() || undefined;
  const spec = draft.spec.trim() || undefined;
  const parsedPrice = Number.parseFloat(
    draft.priceRaw.replace(',', '.').trim(),
  );
  const price =
    draft.priceRaw.trim() !== '' &&
    Number.isFinite(parsedPrice) &&
    parsedPrice >= 0
      ? Math.round(parsedPrice * 100) / 100
      : undefined;

  if (!store && !spec && price === undefined && !draft.orderQty) {
    return undefined;
  }

  return {
    ...(store ? { store } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(price !== undefined && draft.currency.trim()
      ? { currency: draft.currency.trim().toUpperCase() }
      : {}),
    ...(price !== undefined && draft.priceIsEstimate
      ? { priceIsEstimate: true }
      : {}),
    ...(spec ? { spec } : {}),
    ...(draft.orderQty && draft.orderQty >= 1
      ? { orderQty: Math.floor(draft.orderQty) }
      : {}),
    source: draft.source,
    capturedAt: draft.capturedAt ?? new Date().toISOString(),
  };
}

const SOURCE_BADGE_LABEL: Record<ProductMetaSource, string> = {
  extracted: 'Auto-extracted',
  ai: 'AI',
  manual: 'Manual',
};

interface ProductFieldsSectionProps {
  expanded: boolean;
  onToggleExpanded: () => void;
  draft: ProductFormDraft;
  onChange: (next: ProductFormDraft) => void;
  showSourceBadge?: boolean;
  compact?: boolean;
}

export function ProductFieldsSection({
  expanded,
  onToggleExpanded,
  draft,
  onChange,
  showSourceBadge = true,
  compact = false,
}: ProductFieldsSectionProps) {
  const updateManual = (patch: Partial<ProductFormDraft>) => {
    onChange({
      ...draft,
      ...patch,
      source: 'manual',
      capturedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="rounded-control border border-border bg-panel/50">
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-fg hover:bg-panel/80 cursor-pointer rounded-control"
      >
        <span className="flex items-center gap-1.5">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-fg-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-fg-muted" />
          )}
          <ShoppingBag className="h-3.5 w-3.5 text-accent" />
          <span>Product &amp; Price</span>
        </span>
        {showSourceBadge && (draft.priceRaw || draft.spec || draft.store) ? (
          <span className="rounded-pill border border-border bg-canvas px-2 py-0.25 font-mono text-[10px] text-fg-muted">
            {SOURCE_BADGE_LABEL[draft.source]}
          </span>
        ) : null}
      </button>

      {expanded && (
        <div className="space-y-2.5 border-t border-border px-3 py-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label
                htmlFor="product-store"
                className="block font-mono text-[10px] uppercase text-fg-muted"
              >
                Store
              </label>
              <Input
                id="product-store"
                value={draft.store}
                onChange={(e) => updateManual({ store: e.target.value })}
                placeholder="Amazon UK, Bambu Lab..."
                className={compact ? 'h-7 text-xs' : 'h-8 text-xs'}
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="product-currency"
                className="block font-mono text-[10px] uppercase text-fg-muted"
              >
                Currency
              </label>
              <Select
                id="product-currency"
                value={
                  COMMON_CURRENCIES.some((c) => c.code === draft.currency)
                    ? draft.currency
                    : 'GBP'
                }
                onChange={(e) => updateManual({ currency: e.target.value })}
                className={compact ? 'h-7 text-xs' : 'h-8 text-xs'}
              >
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label
                htmlFor="product-price"
                className="block font-mono text-[10px] uppercase text-fg-muted"
              >
                Price
              </label>
              <Input
                id="product-price"
                type="number"
                step="0.01"
                min="0"
                value={draft.priceRaw}
                onChange={(e) => updateManual({ priceRaw: e.target.value })}
                placeholder="16.99"
                className={
                  compact ? 'h-7 font-mono text-xs' : 'h-8 font-mono text-xs'
                }
              />
            </div>

            <div className="flex h-8 items-center gap-2 rounded-control border border-border bg-canvas px-2.5">
              <label
                htmlFor="product-estimate"
                className="font-mono text-[10px] text-fg-muted select-none cursor-pointer"
              >
                Est. (~)
              </label>
              <Switch
                id="product-estimate"
                checked={draft.priceIsEstimate}
                onCheckedChange={(checked) =>
                  updateManual({ priceIsEstimate: checked })
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="product-spec"
              className="block font-mono text-[10px] uppercase text-fg-muted"
            >
              Spec / Variant
            </label>
            <Input
              id="product-spec"
              value={draft.spec}
              onChange={(e) => updateManual({ spec: e.target.value })}
              placeholder="1kg · Matte Black PLA, 100pk · M3x8..."
              className={compact ? 'h-7 text-xs' : 'h-8 text-xs'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
