import { describe, expect, it } from 'vitest';
import { cleanProductUrl, normalizeStoreName } from '@/lib/utils/product-url';

describe('cleanProductUrl', () => {
  it('canonicalizes Amazon regional product URLs to /dp/<ASIN>', () => {
    expect(
      cleanProductUrl(
        'https://www.amazon.co.uk/SUNLU-Filament-Dimensional-Accuracy/dp/B07ZNG4L9P/ref=sr_1_3?crid=123&keywords=pla&qid=999&sprefix=pla&sr=8-3',
      ),
    ).toBe('https://www.amazon.co.uk/dp/B07ZNG4L9P');

    expect(
      cleanProductUrl(
        'https://amazon.com/gp/product/b09abc1234?pd_rd_w=xyz&pf_rd_p=abc',
      ),
    ).toBe('https://amazon.com/dp/B09ABC1234');
  });

  it('strips tracking parameters while keeping functional query parameters', () => {
    expect(
      cleanProductUrl(
        'https://uk.store.bambulab.com/products/pla-matte?variant=412345&utm_source=newsletter&fbclid=abc&gclid=def&ref_=nav',
      ),
    ).toBe('https://uk.store.bambulab.com/products/pla-matte?variant=412345');
  });
});

describe('normalizeStoreName', () => {
  it('maps known marketplace and maker store hosts cleanly', () => {
    expect(normalizeStoreName('https://www.amazon.co.uk/dp/B07ZNG4L9P')).toBe(
      'Amazon UK',
    );
    expect(normalizeStoreName('https://amazon.com/dp/B07ZNG4L9P')).toBe(
      'Amazon US',
    );
    expect(
      normalizeStoreName('https://uk.store.bambulab.com/products/pla-matte'),
    ).toBe('Bambu Lab');
    expect(normalizeStoreName('https://www.screwfix.com/p/12345')).toBe(
      'Screwfix',
    );
    expect(normalizeStoreName('https://jlcpcb.com/parts')).toBe('JLCPCB');
  });

  it('prefers explicit override and falls back cleanly for unknown stores', () => {
    expect(
      normalizeStoreName('https://amazon.co.uk/dp/B07ZNG4L9P', 'My Supplier'),
    ).toBe('My Supplier');
    expect(normalizeStoreName('https://shop.uk.prusa3d.com/en/filament')).toBe(
      'Prusa3d',
    );
  });
});
