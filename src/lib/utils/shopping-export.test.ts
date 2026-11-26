import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { stashRepo } from '@/lib/storage/repo';
import type { LinkItem } from '@/lib/types/stash';
import {
  computePriceDelta,
  formatCurrencySummaries,
  summarizeRemainingPrices,
} from '@/lib/utils/price-math';
import { formatShoppingListMarkdown } from '@/lib/utils/shopping-export';

function makeLink(overrides: Partial<LinkItem>): LinkItem {
  return {
    id: overrides.id ?? 'l-1',
    collectionId: overrides.collectionId ?? 'c-1',
    url: overrides.url ?? 'https://autoglym.com/product',
    title: overrides.title ?? 'Clean Wheels',
    note: overrides.note ?? '',
    tags: overrides.tags ?? [],
    order: overrides.order ?? 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('price delta & remaining totals', () => {
  it('computes price drops and increases while ignoring negligible noise', () => {
    expect(computePriceDelta(11.99, 15.99)).toEqual({
      amount: 4,
      direction: 'down',
    });
    expect(computePriceDelta(17.99, 15.99)).toEqual({
      amount: 2,
      direction: 'up',
    });
    expect(computePriceDelta(15.99, 15.99)).toBeNull();
    expect(computePriceDelta(15.99, undefined)).toBeNull();
  });

  it('excludes checked items from remaining price summaries', () => {
    const links = [
      makeLink({
        id: '1',
        checked: true,
        product: { price: 10, currency: 'GBP', orderQty: 2, source: 'manual' },
      }),
      makeLink({
        id: '2',
        checked: false,
        product: {
          price: 12.5,
          currency: 'GBP',
          orderQty: 1,
          source: 'manual',
        },
      }),
    ];
    expect(
      formatCurrencySummaries(summarizeRemainingPrices(links, 'GBP')),
    ).toBe('£12.50');
  });

  it('formats shopping lists with checkboxes, specs, quantities, and remaining totals', () => {
    const links = [
      makeLink({
        id: '1',
        title: 'Clean Wheels',
        checked: true,
        product: {
          store: 'Autoglym',
          spec: '1L',
          price: 17.99,
          currency: 'GBP',
          orderQty: 2,
          source: 'manual',
        },
      }),
      makeLink({
        id: '2',
        title: 'De-Icer',
        product: {
          store: 'Autoglym',
          price: 7,
          currency: 'GBP',
          source: 'manual',
        },
      }),
    ];
    const md = formatShoppingListMarkdown({
      title: 'Shopping Lists',
      groups: [{ name: 'Autoglym', links }],
      defaultCurrency: 'GBP',
    });
    expect(md).toContain('# Shopping Lists');
    expect(md).toContain('- [x] Clean Wheels (1L) ×2 · Autoglym — £35.98');
    expect(md).toContain('- [ ] De-Icer · Autoglym — £7.00');
    expect(md).toContain('**Remaining:** £7.00 (1 item)');
    expect(md).toContain('**Total:** £42.98 (2 items)');
  });
});

describe('automatic previousPrice tracking and checked state in repo', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('automatically records previousPrice when unit price changes and persists checked toggles', async () => {
    const col = await stashRepo.createCollection({ name: 'Shopping' });
    const added = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://example.com/item',
      title: 'Filament',
      product: { price: 15.99, currency: 'GBP', source: 'extracted' },
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const updated = await stashRepo.updateLink(added.link.id, {
      product: {
        ...added.link.product,
        price: 11.99,
        source: 'manual',
      },
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.link.product?.price).toBe(11.99);
    expect(updated.link.product?.previousPrice).toBe(15.99);

    // Updating orderQty should preserve previousPrice cleanly
    const qtyUpdated = await stashRepo.updateLink(added.link.id, {
      product: {
        ...updated.link.product,
        source: updated.link.product?.source ?? 'manual',
        orderQty: 3,
      },
    });
    expect(qtyUpdated.ok).toBe(true);
    if (!qtyUpdated.ok) return;
    expect(qtyUpdated.link.product?.previousPrice).toBe(15.99);

    // Batch checked update works cleanly
    const checkedIds = await stashRepo.setLinksChecked([added.link.id], true);
    expect(checkedIds).toEqual([added.link.id]);
    const reloaded = (await stashRepo.getLinks()).find(
      (l) => l.id === added.link.id,
    );
    expect(reloaded?.checked).toBe(true);
  });
});
