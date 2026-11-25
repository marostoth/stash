import { describe, expect, it } from 'vitest';
import {
  parseJsonLdProduct,
  parseMetaProduct,
} from '@/lib/product/product-parsers';

describe('parseJsonLdProduct', () => {
  it('extracts name, price, and currency from nested @graph Product/Offer JSON-LD', () => {
    const graphJson = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'Storefront' },
        {
          '@type': 'Product',
          name: 'Bambu PLA Matte Charcoal 1kg',
          offers: {
            '@type': 'AggregateOffer',
            lowPrice: '16.99',
            priceCurrency: 'GBP',
          },
        },
      ],
    });

    const parsed = parseJsonLdProduct(['{ invalid json', graphJson]);
    expect(parsed).toEqual({
      title: 'Bambu PLA Matte Charcoal 1kg',
      price: 16.99,
      currency: 'GBP',
      source: 'extracted',
    });
  });

  it('supports array offers and numeric prices', () => {
    const productJson = JSON.stringify({
      '@type': ['Product'],
      name: 'M3 Socket Head Screws 100pk',
      offers: [{ '@type': 'Offer', price: 8.5, priceCurrency: 'USD' }],
    });

    expect(parseJsonLdProduct([productJson])).toEqual({
      title: 'M3 Socket Head Screws 100pk',
      price: 8.5,
      currency: 'USD',
      source: 'extracted',
    });
  });
});

describe('parseMetaProduct', () => {
  it('extracts OpenGraph and product meta price tags', () => {
    expect(
      parseMetaProduct({
        'og:title': 'Stainless Calipers',
        'og:price:amount': '24.95',
        'og:price:currency': 'gbp',
      }),
    ).toEqual({
      title: 'Stainless Calipers',
      price: 24.95,
      currency: 'GBP',
      source: 'extracted',
    });

    expect(
      parseMetaProduct({
        'product:price:amount': '€19,50',
        'product:price:currency': 'EUR',
      }),
    ).toEqual({
      title: undefined,
      price: 19.5,
      currency: 'EUR',
      source: 'extracted',
    });
  });
});
