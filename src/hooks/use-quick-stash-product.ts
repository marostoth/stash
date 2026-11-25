import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  buildProductMetaFromDraft,
  createProductFormDraft,
  type ProductFormDraft,
} from '@/components/workbench/product-fields-section';
import {
  captureProductFromTab,
  getOriginPermissionPattern,
} from '@/lib/product/product-extractor';
import { stashRepo } from '@/lib/storage/repo';
import type { OpenTabInfo } from '@/lib/tabs/session-filter';
import type { LinkItem } from '@/lib/types/stash';
import { cleanProductUrl } from '@/lib/utils/product-url';
import { normalizeUrlForComparison } from '@/lib/utils/url';

interface UseQuickStashProductOptions {
  activeTab: OpenTabInfo | null;
  links: readonly LinkItem[];
  enableOnDeviceAi: boolean;
  defaultCurrency: string;
}

/**
 * Manages canonical product URL cleaning, preloaded optional host permission
 * state, synchronous permission request on click, 2-stage extraction, and
 * manual product fields state for the Side Panel Quick-Stash card.
 */
export function useQuickStashProduct({
  activeTab,
  links,
  enableOnDeviceAi,
  defaultCurrency,
}: UseQuickStashProductOptions) {
  const [titleOverride, setTitleOverride] = useState('');
  const [hasHostPermission, setHasHostPermission] = useState(false);
  const [extractingProduct, setExtractingProduct] = useState(false);
  const [extractNotice, setExtractNotice] = useState<string | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [productDraft, setProductDraft] = useState<ProductFormDraft>(() =>
    createProductFormDraft(undefined, defaultCurrency),
  );

  const canonicalUrl = useMemo(
    () => (activeTab ? cleanProductUrl(activeTab.url) : ''),
    [activeTab],
  );
  const originPattern = useMemo(
    () => (activeTab ? getOriginPermissionPattern(activeTab.url) : null),
    [activeTab],
  );

  const existingStashedLink = useMemo(() => {
    if (!activeTab) return undefined;
    const normCanonical = normalizeUrlForComparison(canonicalUrl);
    const normRaw = normalizeUrlForComparison(activeTab.url);
    return links.find((item) => {
      const norm = normalizeUrlForComparison(item.url);
      return norm === normCanonical || norm === normRaw;
    });
  }, [activeTab, canonicalUrl, links]);

  // Preload host permission state so click handler can call permissions.request synchronously
  useEffect(() => {
    setHasHostPermission(false);
    setExtractNotice(null);
    setTitleOverride('');
    setProductOpen(false);
    setProductDraft(createProductFormDraft(undefined, defaultCurrency));
    if (
      !originPattern ||
      typeof browser === 'undefined' ||
      !browser.permissions?.contains
    ) {
      return;
    }
    let active = true;
    void browser.permissions
      .contains({ origins: [originPattern] })
      .then((granted) => {
        if (active) setHasHostPermission(Boolean(granted));
      })
      .catch(() => {
        if (active) setHasHostPermission(false);
      });
    return () => {
      active = false;
    };
  }, [originPattern, defaultCurrency]);

  const handleExtractProduct = () => {
    if (!activeTab || extractingProduct) return;

    const runExtraction = async (granted: boolean) => {
      if (!granted) {
        setExtractNotice("Couldn't auto-detect price — enter manually below");
        setProductOpen(true);
        return;
      }

      setExtractingProduct(true);
      setExtractNotice(null);
      try {
        const result = await captureProductFromTab({
          tabId: activeTab.id,
          url: activeTab.url,
          fallbackTitle: activeTab.title,
          enableOnDeviceAi,
          defaultCurrency,
        });
        setTitleOverride(result.title);
        const mergedProduct = existingStashedLink?.product?.orderQty
          ? {
              ...result.product,
              orderQty: existingStashedLink.product.orderQty,
            }
          : result.product;
        setProductDraft(createProductFormDraft(mergedProduct, defaultCurrency));
        setProductOpen(true);

        if (!result.foundPrice) {
          setExtractNotice("Couldn't auto-detect price — enter manually below");
        } else if (existingStashedLink) {
          await stashRepo.updateLink(existingStashedLink.id, {
            title: result.title,
            url: result.cleanUrl,
            product: mergedProduct,
          });
          toast.success('Updated price & spec from tab');
        }
      } finally {
        setExtractingProduct(false);
      }
    };

    if (!originPattern) {
      void runExtraction(false);
      return;
    }

    // CRITICAL: request host permission synchronously before any await
    if (
      !hasHostPermission &&
      typeof browser !== 'undefined' &&
      browser.permissions?.request
    ) {
      void browser.permissions
        .request({ origins: [originPattern] })
        .then((granted) => {
          setHasHostPermission(Boolean(granted));
          return runExtraction(Boolean(granted));
        })
        .catch(() => runExtraction(false));
      return;
    }

    void runExtraction(true);
  };

  const productMeta = useMemo(
    () => buildProductMetaFromDraft(productDraft),
    [productDraft],
  );

  return {
    canonicalUrl,
    existingStashedLink,
    titleOverride,
    extractingProduct,
    extractNotice,
    productOpen,
    setProductOpen,
    productDraft,
    setProductDraft,
    productMeta,
    handleExtractProduct,
  };
}
