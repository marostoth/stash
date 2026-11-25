import { describe, expect, it } from 'vitest';
import type { LinkItem } from '@/lib/types/stash';
import {
  formatCurrencySummaries,
  formatPrice,
  summarizePrices,
} from '@/lib/utils/price-math';

const NOW = '2026-11-25T19:00:00.000Z';

function makePricedLink(
  id: string,
  price: number | undefined,
  currency: string,
  extra?: Partial<NonNullable<LinkItem['product']>>,
): LinkItem {
  return {
    id,
    collectionId: 'col-1',
    url: `https://example.com/${id}`,
    title: `Item ${id}`,
    note: '',
    tags: [],
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...(price !== undefined
      ? {
          product: {
            price,
            currency,
            source: 'extracted',
            ...extra,
          },
        }
      : {}),
  };
}

describe('price-math', () => {
  it('formats prices with currency symbols and optional estimate tilde', () => {
    expect(formatPrice(16.99, 'GBP')).toBe('£16.99');
    expect(formatPrice(16.99, 'GBP', true)).toBe('~£16.99');
    expect(formatPrice(14.2, 'USD')).toBe('$14.20');
    expect(formatPrice(9.5, 'EUR', true)).toBe('~€9.50');
  });

  it('separates currencies strictly, multiplies by orderQty, and propagates estimate flag', () => {
    const links: LinkItem[] = [
      makePricedLink('1', 12.5, 'GBP', { orderQty: 2 }), // £25.00
      makePricedLink('2', 12.48, 'GBP', { priceIsEstimate: true }), // ~£12.48
      makePricedLink('3', 7.1, 'USD', { orderQty: 2 }), // $14.20
      makePricedLink('4', undefined, 'GBP'), // unpriced
    ];

    const summaries = summarizePrices(links);
    expect(summaries).toEqual([
      {
        currency: 'GBP',
        total: 37.48,
        hasEstimate: true,
        pricedCount: 2,
      },
      {
        currency: 'USD',
        total: 14.2,
        hasEstimate: false,
        pricedCount: 1,
      },
    ]);

    expect(formatCurrencySummaries(summaries)).toBe('~£37.48 + $14.20');
  });
});
