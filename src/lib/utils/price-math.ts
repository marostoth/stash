import type { LinkItem } from '@/lib/types/stash';

export interface CurrencySummary {
  currency: string;
  total: number;
  hasEstimate: boolean;
  pricedCount: number;
}

const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'A$',
  CHF: 'CHF ',
};

export const COMMON_CURRENCIES = [
  { code: 'GBP', label: 'GBP (£)' },
  { code: 'USD', label: 'USD ($)' },
  { code: 'EUR', label: 'EUR (€)' },
] as const;

export function normalizeCurrencyCode(raw?: string, fallback = 'GBP'): string {
  const cleaned = raw?.trim().toUpperCase();
  if (cleaned && /^[A-Z]{3}$/.test(cleaned)) {
    return cleaned;
  }
  return fallback;
}

/**
 * Formats a numeric price with its currency symbol and optional `~` estimate prefix.
 */
export function formatPrice(
  price: number,
  currency: string,
  isEstimate?: boolean,
): string {
  const code = normalizeCurrencyCode(currency);
  const symbol = CURRENCY_SYMBOLS[code] ?? `${code} `;
  const formatted = price.toFixed(2);
  const prefix = isEstimate ? '~' : '';
  return `${prefix}${symbol}${formatted}`;
}

/**
 * Sums `price * (orderQty ?? 1)` strictly per currency bucket — never mixing
 * GBP, USD, EUR, etc. Propagates `hasEstimate: true` if any item in that bucket
 * is marked as an estimate.
 */
export function summarizePrices(
  links: readonly LinkItem[],
  fallbackCurrency = 'GBP',
): CurrencySummary[] {
  const buckets = new Map<string, CurrencySummary>();

  for (const link of links) {
    const product = link.product;
    if (
      !product ||
      typeof product.price !== 'number' ||
      !Number.isFinite(product.price) ||
      product.price < 0
    ) {
      continue;
    }

    const currency = normalizeCurrencyCode(product.currency, fallbackCurrency);
    const qty =
      typeof product.orderQty === 'number' && product.orderQty >= 1
        ? Math.floor(product.orderQty)
        : 1;
    const lineTotal = product.price * qty;

    const existing = buckets.get(currency);
    if (existing) {
      existing.total = Math.round((existing.total + lineTotal) * 100) / 100;
      existing.pricedCount += 1;
      if (product.priceIsEstimate) {
        existing.hasEstimate = true;
      }
    } else {
      buckets.set(currency, {
        currency,
        total: Math.round(lineTotal * 100) / 100,
        hasEstimate: product.priceIsEstimate === true,
        pricedCount: 1,
      });
    }
  }

  return Array.from(buckets.values());
}

/**
 * Formats one or more per-currency buckets (e.g. `~£37.48 + $14.20`).
 */
export function formatCurrencySummaries(
  summaries: readonly CurrencySummary[],
): string {
  return summaries
    .map((entry) => formatPrice(entry.total, entry.currency, entry.hasEstimate))
    .join(' + ');
}

export interface PriceDelta {
  amount: number;
  direction: 'down' | 'up';
}

/**
 * Computes the unit price delta between current and previous prices.
 * Returns null when previousPrice is missing or differs by less than 0.01.
 */
export function computePriceDelta(
  currentPrice?: number,
  previousPrice?: number,
): PriceDelta | null {
  if (
    typeof currentPrice !== 'number' ||
    !Number.isFinite(currentPrice) ||
    typeof previousPrice !== 'number' ||
    !Number.isFinite(previousPrice)
  ) {
    return null;
  }
  const diff = Math.round((currentPrice - previousPrice) * 100) / 100;
  if (Math.abs(diff) < 0.01) return null;
  return {
    amount: Math.abs(diff),
    direction: diff < 0 ? 'down' : 'up',
  };
}

/**
 * Sums prices for unchecked (`checked !== true`) links only.
 */
export function summarizeRemainingPrices(
  links: readonly LinkItem[],
  fallbackCurrency = 'GBP',
): CurrencySummary[] {
  return summarizePrices(
    links.filter((link) => link.checked !== true),
    fallbackCurrency,
  );
}
