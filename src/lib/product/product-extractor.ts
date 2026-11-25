import {
  checkNanoAvailability,
  NANO_AVAILABILITY_OPTIONS,
} from '@/lib/categorizer/nano-engine';
import {
  getLanguageModel,
  resolveDeterministicSampling,
  stripJsonFences,
} from '@/lib/categorizer/nano-helpers';
import type { LanguageModelSession } from '@/lib/categorizer/types';
import {
  type ParsedProductDraft,
  parseJsonLdProduct,
  parseMetaProduct,
  parsePriceNumber,
  type RawProductSignals,
} from '@/lib/product/product-parsers';
import type { ProductMeta } from '@/lib/types/stash';
import { normalizeCurrencyCode } from '@/lib/utils/price-math';
import { cleanProductUrl, normalizeStoreName } from '@/lib/utils/product-url';

const NANO_PRODUCT_TIMEOUT_MS = 12_000;

const PRODUCT_NANO_CONSTRAINT: Record<string, unknown> = {
  type: 'object',
  properties: {
    cleanTitle: { type: 'string', maxLength: 80 },
    spec: { type: 'string', maxLength: 60 },
    price: { type: ['number', 'null'] },
    currency: { type: 'string', maxLength: 6 },
  },
  required: ['cleanTitle', 'spec', 'price', 'currency'],
};

/**
 * Computes the Chrome optional_host_permissions origin pattern for a web URL.
 */
export function getOriginPermissionPattern(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}/*`;
  } catch {
    return null;
  }
}

/**
 * Self-contained read-only DOM collector executed in the active tab via
 * `chrome.scripting.executeScript`. Must NOT reference any outer imports.
 */
function collectPageSignalsInTab(): RawProductSignals {
  const jsonLdBlocks: string[] = [];
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]',
  );
  for (const script of scripts) {
    const text = script.textContent?.trim();
    if (text) jsonLdBlocks.push(text.slice(0, 20_000));
  }

  const metaTags: Record<string, string> = {};
  const metaKeys = [
    'og:price:amount',
    'og:price:currency',
    'product:price:amount',
    'product:price:currency',
    'og:title',
    'og:site_name',
  ];
  for (const key of metaKeys) {
    const el = document.querySelector<HTMLMetaElement>(
      `meta[property="${key}"], meta[name="${key}"]`,
    );
    const val = el?.content?.trim();
    if (val) metaTags[key] = val;
  }

  const chunks: string[] = [];
  const h1 = document.querySelector('h1')?.textContent?.trim();
  if (h1) chunks.push(`H1: ${h1}`);

  const selectors = [
    '[itemprop="price"]',
    '#corePriceDisplay_desktop_feature_div',
    '#corePrice_feature_div',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '[data-testid*="price"]',
    '[class*="price"]',
    '#feature-bullets',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.replace(/\s+/g, ' ').trim();
    if (text && text.length < 600) {
      chunks.push(text);
    }
    if (chunks.join('\n').length >= 1500) break;
  }

  return {
    url: window.location.href,
    title: document.title || '',
    jsonLdBlocks,
    metaTags,
    pageTextSlice: chunks.join('\n').slice(0, 1500),
  };
}

/**
 * Stage 1: Deterministic read-only DOM extraction via `chrome.scripting.executeScript`.
 */
export async function extractPageProductSignals(
  tabId: number,
): Promise<RawProductSignals | null> {
  if (typeof browser === 'undefined' || !browser.scripting?.executeScript) {
    return null;
  }

  try {
    const results = await browser.scripting.executeScript({
      target: { tabId },
      func: collectPageSignalsInTab,
    });
    const first = results[0]?.result as RawProductSignals | undefined;
    return first ?? null;
  } catch {
    return null;
  }
}

interface NanoProductResult {
  cleanTitle?: string;
  spec?: string;
  price?: number;
  currency?: string;
}

/**
 * Stage 2: Optional Gemini Nano cleanup stripping bloated marketplace titles
 * into short product names + concise specs, with fallback price extraction.
 */
export async function refineProductWithNano(
  signals: RawProductSignals,
  stage1: ParsedProductDraft,
  defaultCurrency: string,
): Promise<NanoProductResult | null> {
  const lm = getLanguageModel();
  if (!lm) return null;
  const status = await checkNanoAvailability();
  if (status !== 'available') return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NANO_PRODUCT_TIMEOUT_MS);
  let session: LanguageModelSession | null = null;

  try {
    const sampling = await resolveDeterministicSampling(lm);
    session = await lm.create({
      ...NANO_AVAILABILITY_OPTIONS,
      ...sampling,
      signal: controller.signal,
      initialPrompts: [
        {
          role: 'system',
          content: [
            'You clean e-commerce product bookmark data into strict JSON.',
            '1. "cleanTitle": short readable product name (<=60 chars), stripping SEO spam, store suffixes, and boilerplate.',
            '2. "spec": ultra-concise variant/pack/size spec (<=45 chars, e.g. "1kg · Matte Black PLA" or "100pk · M3x8"), or "" if none.',
            '3. "price": numeric unit price if clearly stated in text, else null.',
            '4. "currency": 3-letter ISO code (e.g. GBP, USD, EUR) or "".',
          ].join('\n'),
        },
      ],
    });

    const payload = JSON.stringify({
      title: stage1.title || signals.title,
      knownPrice: stage1.price ?? null,
      knownCurrency: stage1.currency ?? defaultCurrency,
      snippet: signals.pageTextSlice.slice(0, 1200),
    });

    const raw = await session.prompt(payload, {
      responseConstraint: PRODUCT_NANO_CONSTRAINT,
      signal: controller.signal,
    });
    const parsed = JSON.parse(stripJsonFences(raw)) as Record<string, unknown>;
    return {
      cleanTitle:
        typeof parsed.cleanTitle === 'string' && parsed.cleanTitle.trim()
          ? parsed.cleanTitle.trim().slice(0, 80)
          : undefined,
      spec:
        typeof parsed.spec === 'string' && parsed.spec.trim()
          ? parsed.spec.trim().slice(0, 60)
          : undefined,
      price: parsePriceNumber(parsed.price),
      currency:
        typeof parsed.currency === 'string' && parsed.currency.trim()
          ? normalizeCurrencyCode(parsed.currency, defaultCurrency)
          : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    session?.destroy();
  }
}

export interface ProductCaptureOutcome {
  ok: boolean;
  cleanUrl: string;
  title: string;
  product: ProductMeta;
  foundPrice: boolean;
}

/**
 * Orchestrates Stage 1 deterministic JSON-LD/meta extraction + optional Stage 2
 * Gemini Nano title/spec cleanup (keeping Stage 1 price authoritative).
 */
export async function captureProductFromTab(options: {
  tabId: number;
  url: string;
  fallbackTitle: string;
  enableOnDeviceAi: boolean;
  defaultCurrency: string;
}): Promise<ProductCaptureOutcome> {
  const cleanUrl = cleanProductUrl(options.url);
  const store = normalizeStoreName(cleanUrl);
  const capturedAt = new Date().toISOString();

  const signals = await extractPageProductSignals(options.tabId);
  if (!signals) {
    return {
      ok: false,
      cleanUrl,
      title: options.fallbackTitle,
      product: { store, currency: options.defaultCurrency, source: 'manual' },
      foundPrice: false,
    };
  }

  const ld = parseJsonLdProduct(signals.jsonLdBlocks);
  const meta = parseMetaProduct(signals.metaTags);
  const stage1: ParsedProductDraft = {
    title: ld.title ?? meta.title ?? signals.title ?? options.fallbackTitle,
    price: ld.price ?? meta.price,
    currency: ld.currency ?? meta.currency,
    source:
      ld.price !== undefined || meta.price !== undefined
        ? 'extracted'
        : undefined,
  };

  const nano = options.enableOnDeviceAi
    ? await refineProductWithNano(signals, stage1, options.defaultCurrency)
    : null;

  const finalPrice = stage1.price ?? nano?.price;
  const finalCurrency = normalizeCurrencyCode(
    stage1.price !== undefined
      ? (stage1.currency ?? nano?.currency)
      : (nano?.currency ?? stage1.currency),
    options.defaultCurrency,
  );
  const source: ProductMeta['source'] =
    stage1.price !== undefined
      ? 'extracted'
      : nano?.price !== undefined
        ? 'ai'
        : 'manual';

  return {
    ok: true,
    cleanUrl,
    title: nano?.cleanTitle || stage1.title || options.fallbackTitle,
    foundPrice: finalPrice !== undefined,
    product: {
      store,
      ...(finalPrice !== undefined ? { price: finalPrice } : {}),
      currency: finalCurrency,
      ...(nano?.spec ? { spec: nano.spec } : {}),
      source,
      capturedAt,
    },
  };
}
