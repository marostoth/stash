import {
  ChevronDown,
  Loader2,
  ShoppingBag,
  StickyNote,
  Tag,
  X,
} from 'lucide-react';
import { QuickStashProductPanel } from '@/components/sidepanel/quick-stash-product-panel';
import { Input } from '@/components/ui/input';
import type { ProductFormDraft } from '@/components/workbench/product-fields-section';
import { SmoothCollapse } from '@/components/workbench/smooth-collapse';
import type { MotionMode, ProductMeta } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { formatPrice, normalizeCurrencyCode } from '@/lib/utils/price-math';

interface QuickStashChipsProps {
  note: string;
  onChangeNote: (next: string) => void;
  tagsRaw: string;
  parsedTags: readonly string[];
  onChangeTagsRaw: (next: string) => void;
  onRemoveTag: (tag: string) => void;
  aiWorking: boolean;
  noteOpen: boolean;
  onToggleNoteOpen: () => void;
  tagsOpen: boolean;
  onToggleTagsOpen: () => void;
  productOpen: boolean;
  onToggleProductOpen: () => void;
  productMeta: ProductMeta | undefined;
  productDraft: ProductFormDraft;
  onChangeProductDraft: (next: ProductFormDraft) => void;
  isAlreadyStashed: boolean;
  extractingProduct: boolean;
  extractNotice: string | null;
  onExtractProduct: () => void;
  defaultCurrency: string;
  motionMode: MotionMode;
}

function buildProductSummaryLabel(
  meta: ProductMeta | undefined,
  defaultCurrency: string,
): string | null {
  if (!meta) return null;
  const parts: string[] = [];
  if (meta.store) parts.push(meta.store);
  if (typeof meta.price === 'number' && Number.isFinite(meta.price)) {
    parts.push(
      formatPrice(
        meta.price,
        normalizeCurrencyCode(meta.currency, defaultCurrency),
        meta.priceIsEstimate,
      ),
    );
  }
  if (meta.orderQty && meta.orderQty >= 1) {
    parts.push(`×${meta.orderQty}`);
  } else if (typeof meta.price === 'number') {
    parts.push('×1');
  }
  if (parts.length === 0 && meta.spec) {
    return meta.spec;
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Progressive-disclosure summary chip bar & collapsible drawers for Quick Stash.
 * Keeps Product/Price, Tags, and Note collapsed by default until needed.
 */
export function QuickStashChips({
  note,
  onChangeNote,
  tagsRaw,
  parsedTags,
  onChangeTagsRaw,
  onRemoveTag,
  aiWorking,
  noteOpen,
  onToggleNoteOpen,
  tagsOpen,
  onToggleTagsOpen,
  productOpen,
  onToggleProductOpen,
  productMeta,
  productDraft,
  onChangeProductDraft,
  isAlreadyStashed,
  extractingProduct,
  extractNotice,
  onExtractProduct,
  defaultCurrency,
  motionMode,
}: QuickStashChipsProps) {
  const productSummary = buildProductSummaryLabel(productMeta, defaultCurrency);
  const hasNote = note.trim().length > 0;
  const hasTags = parsedTags.length > 0;

  const handleProductChipClick = () => {
    if (extractingProduct) return;
    if (!productSummary && !productOpen) {
      onExtractProduct();
      return;
    }
    onToggleProductOpen();
  };

  return (
    <div className="space-y-2">
      {/* Compact Single-Line Summary Chip Row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Secondary CTA: Detect Price / Detected Product Summary */}
        <button
          type="button"
          onClick={handleProductChipClick}
          aria-expanded={productOpen}
          disabled={extractingProduct}
          title={
            productSummary
              ? 'Edit product & price details'
              : 'Auto-detect price & retailer from this tab'
          }
          className={cn(
            'inline-flex h-6.5 max-w-full items-center gap-1.5 rounded-pill border px-2.5 text-[11px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60',
            productOpen
              ? 'border-accent/70 bg-accent/20 text-fg'
              : productSummary
                ? 'border-accent/55 bg-accent/14 text-fg hover:border-accent/75 hover:bg-accent/20'
                : 'border-accent/50 bg-accent/12 text-accent hover:border-accent/75 hover:bg-accent/20',
          )}
        >
          {extractingProduct ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-accent" />
          ) : (
            <ShoppingBag className="h-3 w-3 shrink-0 text-accent" />
          )}
          <span
            className={cn(
              'truncate',
              productSummary &&
                'font-mono text-[10px] font-medium tabular-nums',
            )}
          >
            {extractingProduct
              ? 'Detecting...'
              : productSummary
                ? productSummary
                : isAlreadyStashed
                  ? 'Refresh Price'
                  : 'Detect Price'}
          </span>
          {(productSummary || productOpen) && (
            <ChevronDown
              className={cn(
                'h-2.5 w-2.5 shrink-0 text-fg-muted transition-transform',
                productOpen && 'rotate-180',
              )}
            />
          )}
        </button>

        {/* Tags Chip */}
        <button
          type="button"
          onClick={onToggleTagsOpen}
          aria-expanded={tagsOpen}
          className={cn(
            'inline-flex h-6.5 max-w-full items-center gap-1 rounded-pill border px-2 text-[11px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
            tagsOpen
              ? 'border-accent/55 bg-accent/12 text-fg'
              : hasTags
                ? 'border-border bg-[var(--stash-card)] text-fg hover:border-accent/45'
                : 'border-hairline bg-[var(--stash-card)]/80 text-fg-muted hover:border-border hover:text-fg',
          )}
        >
          {aiWorking && !hasTags ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-accent" />
          ) : (
            <Tag
              className={cn(
                'h-3 w-3 shrink-0',
                hasTags || tagsOpen ? 'text-accent' : 'opacity-80',
              )}
            />
          )}
          {hasTags ? (
            <span className="flex min-w-0 items-center gap-1 font-mono text-[10px]">
              <span className="max-w-[110px] truncate">
                {parsedTags
                  .slice(0, 2)
                  .map((t) => `#${t}`)
                  .join(' ')}
              </span>
              {parsedTags.length > 2 && (
                <span className="text-fg-muted">+{parsedTags.length - 2}</span>
              )}
            </span>
          ) : (
            <span>{aiWorking ? 'AI tags...' : '+ Tags'}</span>
          )}
        </button>

        {/* Note Chip */}
        <button
          type="button"
          onClick={onToggleNoteOpen}
          aria-expanded={noteOpen}
          className={cn(
            'inline-flex h-6.5 max-w-full items-center gap-1 rounded-pill border px-2 text-[11px] font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35',
            noteOpen
              ? 'border-accent/55 bg-accent/12 text-fg'
              : hasNote
                ? 'border-border bg-[var(--stash-card)] text-fg hover:border-accent/45'
                : 'border-hairline bg-[var(--stash-card)]/80 text-fg-muted hover:border-border hover:text-fg',
          )}
        >
          {aiWorking && !hasNote ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-accent" />
          ) : (
            <StickyNote
              className={cn(
                'h-3 w-3 shrink-0',
                hasNote || noteOpen ? 'text-accent' : 'opacity-80',
              )}
            />
          )}
          {hasNote ? (
            <>
              <span className="max-w-[96px] truncate">{note.trim()}</span>
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
              />
            </>
          ) : (
            <span>{aiWorking ? 'AI note...' : '+ Note'}</span>
          )}
        </button>
      </div>

      {/* Collapsible Tags Editor */}
      <SmoothCollapse open={tagsOpen} motionMode={motionMode}>
        <div className="space-y-1.5 rounded-control border border-hairline bg-canvas/65 p-2">
          <div className="relative">
            <Input
              value={tagsRaw}
              onChange={(e) => onChangeTagsRaw(e.target.value)}
              placeholder={
                aiWorking && !tagsRaw
                  ? 'AI generating tags...'
                  : 'Comma-separated tags: docs, tools...'
              }
              aria-label="Tags"
              className="h-7 pr-7 font-mono text-[11px]"
            />
            {aiWorking && !tagsRaw && (
              <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-accent/70" />
            )}
          </div>
          {parsedTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {parsedTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-pill border border-hairline bg-[var(--stash-card)] px-2 py-0.5 font-mono text-[10px] text-fg-muted"
                >
                  <span>#{tag}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                    className="text-fg-muted/70 transition-colors hover:text-fg cursor-pointer"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </SmoothCollapse>

      {/* Collapsible Note Editor */}
      <SmoothCollapse open={noteOpen} motionMode={motionMode}>
        <div className="relative rounded-control border border-hairline bg-canvas/65 p-2">
          <Input
            value={note}
            onChange={(e) => onChangeNote(e.target.value)}
            placeholder={
              aiWorking && !note
                ? 'AI writing summary note...'
                : 'Why I saved this... (optional)'
            }
            aria-label="Why I saved this"
            className="h-7 pr-7 text-xs"
          />
          {aiWorking && !note ? (
            <Loader2 className="pointer-events-none absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-accent/70" />
          ) : hasNote ? (
            <button
              type="button"
              onClick={() => onChangeNote('')}
              aria-label="Clear note"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-muted transition-colors hover:text-fg cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </SmoothCollapse>

      {/* Collapsible Product & Price Editor */}
      <SmoothCollapse open={productOpen} motionMode={motionMode}>
        <QuickStashProductPanel
          isAlreadyStashed={isAlreadyStashed}
          extracting={extractingProduct}
          notice={extractNotice}
          draft={productDraft}
          defaultCurrency={defaultCurrency}
          onExtract={onExtractProduct}
          onChangeDraft={onChangeProductDraft}
        />
      </SmoothCollapse>
    </div>
  );
}
