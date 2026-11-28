import { Check, Copy, ExternalLink, Star, Trash2 } from 'lucide-react';
import { LinkFavicon } from '@/components/LinkFavicon';
import { isTactileMotion } from '@/lib/motion/presets';
import { stashRepo } from '@/lib/storage/repo';
import type { LinkItem, MotionMode } from '@/lib/types/stash';
import { cn } from '@/lib/utils/cn';
import { HighlightText } from '@/lib/utils/highlight-match';
import {
  computePriceDelta,
  formatPrice,
  normalizeCurrencyCode,
} from '@/lib/utils/price-math';
import { extractDomain, toSafeHref } from '@/lib/utils/url';

interface SidePanelLinkRowProps {
  link: LinkItem;
  searchQuery: string;
  defaultCurrency: string;
  motionMode: MotionMode;
  onToggleChecked: (event: React.MouseEvent, link: LinkItem) => void;
  onToggleStar: (event: React.MouseEvent, link: LinkItem) => void;
  onCopyUrl: (event: React.MouseEvent, url: string) => void;
  onDelete: (event: React.MouseEvent, link: LinkItem) => void;
}

/**
 * Breathable bookmark mini-card for the Chrome Side Panel.
 * Features a recessed 24x24 favicon tile, clean 1-line title + muted subtitle,
 * tabular price/price-drop pill, and an overlaid hover action strip (zero text collision).
 */
export function SidePanelLinkRow({
  link,
  searchQuery,
  defaultCurrency,
  motionMode,
  onToggleChecked,
  onToggleStar,
  onCopyUrl,
  onDelete,
}: SidePanelLinkRowProps) {
  const isStarred = link.starred === true;
  const isChecked = link.checked === true;
  const tactile = isTactileMotion(motionMode);

  const hasUnitPrice =
    typeof link.product?.price === 'number' &&
    Number.isFinite(link.product.price);
  const qty = Math.max(1, Math.floor(link.product?.orderQty ?? 1));
  const currency = normalizeCurrencyCode(
    link.product?.currency,
    defaultCurrency,
  );
  const formattedPrice = hasUnitPrice
    ? formatPrice(
        (link.product?.price ?? 0) * qty,
        currency,
        link.product?.priceIsEstimate,
      )
    : null;
  const priceDelta = hasUnitPrice
    ? computePriceDelta(link.product?.price, link.product?.previousPrice)
    : null;

  const domain = extractDomain(link.url);
  const subtitleExtra = link.note?.trim() || link.product?.spec?.trim() || '';
  const safeHref = toSafeHref(link.url);

  return (
    <div
      className={cn(
        'group/row relative flex w-full min-w-0 items-center overflow-hidden rounded-control border border-hairline bg-[var(--stash-card)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--stash-text)_4%,transparent)] transition-[background-color,border-color,transform,opacity] duration-150 hover:border-border hover:bg-[var(--stash-card-hover)]',
        tactile && 'hover:-translate-y-[1px]',
        isStarred && !isChecked && 'border-accent/30 bg-accent/[0.04]',
        isChecked && 'opacity-60 hover:opacity-90',
      )}
    >
      {isStarred && !isChecked && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-accent"
        />
      )}

      <a
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => void stashRepo.markLinkOpened(link.id)}
        className="flex w-full min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-control px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50"
      >
        {/* Recessed 24x24 Favicon Tile */}
        <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-hairline bg-canvas shadow-[inset_0_1px_2px_color-mix(in_srgb,var(--stash-canvas)_45%,transparent)]">
          <LinkFavicon url={link.url} faviconUrl={link.faviconUrl} size="sm" />
        </div>

        {/* 1-Line Title + Muted Domain/Note Subtitle */}
        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            className={cn(
              'block truncate text-xs font-medium leading-tight',
              isChecked
                ? 'text-fg-muted line-through decoration-fg-muted/70'
                : 'text-fg',
            )}
          >
            <HighlightText text={link.title} query={searchQuery} />
          </div>
          <div className="mt-0.5 block truncate font-mono text-[10px] text-fg-muted">
            {link.product?.store ? link.product.store : domain}
            {subtitleExtra ? ` · ${subtitleExtra}` : ''}
          </div>
        </div>

        {/* Right-Aligned Monospace Price Pill (fades cleanly under hover actions) */}
        {formattedPrice && (
          <div
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-pill border px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums transition-opacity group-focus-within/row:opacity-0 group-hover/row:opacity-0',
              priceDelta?.direction === 'down'
                ? 'border-accent/45 bg-accent/12 text-accent'
                : priceDelta?.direction === 'up'
                  ? 'border-warning/40 bg-warning/10 text-warning'
                  : 'border-hairline bg-canvas/85 text-fg-muted',
            )}
            title={
              priceDelta
                ? `${priceDelta.direction === 'down' ? 'Dropped' : 'Up'} ${formatPrice(priceDelta.amount, currency)} from previous price`
                : qty > 1
                  ? `${qty} items`
                  : undefined
            }
          >
            <span className="inline-flex items-center">
              {priceDelta?.direction === 'down' && (
                <span aria-hidden="true" className="mr-0.5">
                  ↓
                </span>
              )}
              {priceDelta?.direction === 'up' && (
                <span aria-hidden="true" className="mr-0.5">
                  ↑
                </span>
              )}
              <span>{formattedPrice}</span>
            </span>
            {qty > 1 && <span className="opacity-75">×{qty}</span>}
          </div>
        )}
      </a>

      {/* Floating Overlaid Hover Action Strip (zero text-collision) */}
      <div className="pointer-events-none absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-control border border-hairline bg-[var(--stash-panel)]/95 p-0.5 opacity-0 shadow-md backdrop-blur-xs transition-opacity group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100 group-hover/row:pointer-events-auto group-hover/row:opacity-100">
        <a
          href={safeHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => void stashRepo.markLinkOpened(link.id)}
          aria-label={`Open ${link.title} in new tab`}
          title="Open in new tab"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-card-hover hover:text-fg"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
        <button
          type="button"
          onClick={(e) => onToggleChecked(e, link)}
          aria-label={
            isChecked ? `Uncheck ${link.title}` : `Mark ${link.title} done`
          }
          title={isChecked ? 'Unmark done' : 'Mark done'}
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-card-hover cursor-pointer',
            isChecked ? 'text-accent' : 'text-fg-muted hover:text-accent',
          )}
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => onToggleStar(e, link)}
          aria-label={isStarred ? `Unstar ${link.title}` : `Star ${link.title}`}
          title={isStarred ? 'Remove star' : 'Star link'}
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-card-hover cursor-pointer',
            isStarred ? 'text-accent' : 'text-fg-muted hover:text-accent',
          )}
        >
          <Star
            className={cn('h-3 w-3', isStarred && 'fill-accent text-accent')}
          />
        </button>
        <button
          type="button"
          onClick={(e) => onCopyUrl(e, link.url)}
          aria-label={`Copy URL for ${link.title}`}
          title="Copy URL"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-card-hover hover:text-fg cursor-pointer"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={(e) => onDelete(e, link)}
          aria-label={`Delete ${link.title}`}
          title="Delete (Undo available)"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-danger/15 hover:text-danger cursor-pointer"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
