import { normalizeCurrencyCode } from '@/lib/utils/price-math';

export interface RawProductSignals {
  url: string;
  title: string;
  jsonLdBlocks: string[];
  metaTags: Record<string, string>;
  pageTextSlice: string;
}

export interface ParsedProductDraft {
  title?: string;
  store?: string;
  price?: number;
  currency?: string;
  spec?: string;
  source?: 'extracted' | 'ai';
}

export function parsePriceNumber(raw: unknown): number | undefined {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0
      ? Math.round(raw * 100) / 100
      : undefined;
  }
  if (typeof raw !== 'string') return undefined;
  const cleaned = raw.replace(/[^0-9.,]/g, '').trim();
  if (!cleaned) return undefined;

  // Handle European decimal comma vs thousands comma cleanly
  const normalized =
    cleaned.includes(',') && !cleaned.includes('.')
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '');
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100) / 100;
}

function hasProductType(typeValue: unknown): boolean {
  if (typeof typeValue === 'string') {
    return typeValue.toLowerCase().includes('product');
  }
  if (Array.isArray(typeValue)) {
    return typeValue.some(
      (item) =>
        typeof item === 'string' && item.toLowerCase().includes('product'),
    );
  }
  return false;
}

function collectProductNodes(
  node: unknown,
  out: Array<Record<string, unknown>>,
): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectProductNodes(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (hasProductType(obj['@type'])) {
    out.push(obj);
  }
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) collectProductNodes(item, out);
  }
}

function extractOfferPrice(offers: unknown): {
  price?: number;
  currency?: string;
} {
  if (!offers || typeof offers !== 'object') return {};
  if (Array.isArray(offers)) {
    for (const entry of offers) {
      const found = extractOfferPrice(entry);
      if (found.price !== undefined) return found;
    }
    return {};
  }
  const obj = offers as Record<string, unknown>;
  const price =
    parsePriceNumber(obj.price) ??
    parsePriceNumber(obj.lowPrice) ??
    parsePriceNumber(obj.highPrice);
  const currency =
    typeof obj.priceCurrency === 'string' && obj.priceCurrency.trim()
      ? normalizeCurrencyCode(obj.priceCurrency)
      : undefined;

  if (price !== undefined) {
    return { price, currency };
  }
  if (obj.offers) {
    return extractOfferPrice(obj.offers);
  }
  return { currency };
}

/**
 * Pure parser extracting product title, brand/store, price, and currency from
 * `<script type="application/ld+json">` strings (including nested `@graph`).
 */
export function parseJsonLdProduct(
  jsonLdBlocks: readonly string[],
): ParsedProductDraft {
  const productNodes: Array<Record<string, unknown>> = [];

  for (const rawBlock of jsonLdBlocks) {
    const trimmed = rawBlock.trim();
    if (!trimmed) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      collectProductNodes(parsed, productNodes);
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  }

  for (const node of productNodes) {
    const title =
      typeof node.name === 'string' && node.name.trim()
        ? node.name.trim()
        : undefined;
    const offer = extractOfferPrice(node.offers);
    if (offer.price !== undefined || title) {
      return {
        title,
        price: offer.price,
        currency: offer.currency,
        source: offer.price !== undefined ? 'extracted' : undefined,
      };
    }
  }

  return {};
}

/**
 * Pure parser extracting product price/currency/title from OpenGraph & product meta tags.
 */
export function parseMetaProduct(
  metaTags: Readonly<Record<string, string>>,
): ParsedProductDraft {
  const lower = new Map<string, string>();
  for (const [k, v] of Object.entries(metaTags)) {
    if (v?.trim()) {
      lower.set(k.toLowerCase(), v.trim());
    }
  }

  const price =
    parsePriceNumber(lower.get('product:price:amount')) ??
    parsePriceNumber(lower.get('og:price:amount')) ??
    parsePriceNumber(lower.get('price'));

  const rawCurrency =
    lower.get('product:price:currency') ??
    lower.get('og:price:currency') ??
    lower.get('pricecurrency');

  const currency = rawCurrency ? normalizeCurrencyCode(rawCurrency) : undefined;
  const title = lower.get('og:title');

  return {
    title,
    price,
    currency,
    source: price !== undefined ? 'extracted' : undefined,
  };
}
