import type { LinkItem } from '@/lib/types/stash';
import {
  formatCurrencySummaries,
  formatPrice,
  normalizeCurrencyCode,
  summarizePrices,
  summarizeRemainingPrices,
} from '@/lib/utils/price-math';
import { normalizeStoreName } from '@/lib/utils/product-url';

export interface ShoppingExportGroup {
  name: string;
  links: readonly LinkItem[];
}

function formatLineItem(link: LinkItem, defaultCurrency: string): string {
  const checkbox = link.checked === true ? '[x]' : '[ ]';
  const product = link.product;
  const spec = product?.spec?.trim() || '';
  const qty =
    typeof product?.orderQty === 'number' && product.orderQty >= 1
      ? Math.floor(product.orderQty)
      : 1;
  const store = normalizeStoreName(link.url, product?.store);
  const hasPrice =
    typeof product?.price === 'number' && Number.isFinite(product.price);
  const currency = normalizeCurrencyCode(product?.currency, defaultCurrency);
  const lineTotal =
    hasPrice && product?.price !== undefined
      ? formatPrice(
          Math.round(product.price * qty * 100) / 100,
          currency,
          product.priceIsEstimate,
        )
      : '';

  const parts: string[] = [`- ${checkbox} ${link.title}`];
  if (spec) parts.push(`(${spec})`);
  if (qty > 1) parts.push(`×${qty}`);
  if (store) parts.push(`· ${store}`);
  if (lineTotal) parts.push(`— ${lineTotal}`);
  return parts.join(' ');
}

/**
 * Formats one or more shopping groups into clean Markdown/plain-text ready to
 * paste into WhatsApp, Notes, Slack, or email.
 */
export function formatShoppingListMarkdown(options: {
  title: string;
  groups: readonly ShoppingExportGroup[];
  defaultCurrency: string;
  includeChecked?: boolean;
}): string {
  const { title, groups, defaultCurrency, includeChecked = true } = options;
  const lines: string[] = [`# ${title}`];
  const allVisibleLinks: LinkItem[] = [];

  for (const group of groups) {
    const items = includeChecked
      ? group.links
      : group.links.filter((l) => l.checked !== true);
    if (items.length === 0) continue;

    allVisibleLinks.push(...items);
    const groupTotal = formatCurrencySummaries(
      summarizePrices(items, defaultCurrency),
    );
    const headingMeta = groupTotal
      ? `${items.length} ${items.length === 1 ? 'item' : 'items'} — ${groupTotal}`
      : `${items.length} ${items.length === 1 ? 'item' : 'items'}`;
    lines.push('', `## ${group.name} (${headingMeta})`);
    for (const item of items) {
      lines.push(formatLineItem(item, defaultCurrency));
    }
  }

  const grandTotal = formatCurrencySummaries(
    summarizePrices(allVisibleLinks, defaultCurrency),
  );
  const remainingTotal = formatCurrencySummaries(
    summarizeRemainingPrices(allVisibleLinks, defaultCurrency),
  );
  const checkedCount = allVisibleLinks.filter((l) => l.checked === true).length;
  const remainingCount = allVisibleLinks.length - checkedCount;

  if (grandTotal) {
    lines.push('');
    if (checkedCount > 0) {
      lines.push(
        `**Remaining:** ${remainingTotal || formatPrice(0, defaultCurrency)} (${remainingCount} ${remainingCount === 1 ? 'item' : 'items'}) · **Total:** ${grandTotal} (${allVisibleLinks.length} ${allVisibleLinks.length === 1 ? 'item' : 'items'})`,
      );
    } else {
      lines.push(
        `**Total:** ${grandTotal} (${allVisibleLinks.length} ${allVisibleLinks.length === 1 ? 'item' : 'items'})`,
      );
    }
  }

  return lines.join('\n');
}
