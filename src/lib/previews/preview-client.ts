import { getPreviewEntry, type PreviewCacheEntry } from '@/lib/previews/cache';
import { isPreviewableUrl } from '@/lib/previews/capture-guard';
import { normalizeUrlForComparison } from '@/lib/utils/url';

export const FETCH_OG_PREVIEW_MESSAGE = 'STASH_FETCH_OG_PREVIEW' as const;

export interface FetchOgPreviewMessage {
  type: typeof FETCH_OG_PREVIEW_MESSAGE;
  url: string;
}

const clientInFlight = new Map<string, Promise<PreviewCacheEntry | null>>();

export async function loadVisualPreview(
  rawUrl: string,
  visualPreviewsEnabled: boolean,
): Promise<PreviewCacheEntry | null> {
  if (!isPreviewableUrl(rawUrl)) return null;

  const cached = await getPreviewEntry(rawUrl);
  if (cached?.screenshotBlob) return cached;

  const hasFreshOg =
    cached?.source === 'og' &&
    Date.now() - cached.updatedAt <
      (cached.ogImageUrl || cached.ogDescription || cached.ogTitle
        ? 24 * 60 * 60 * 1000
        : 30 * 60 * 1000);

  if (hasFreshOg || !visualPreviewsEnabled) {
    return cached;
  }

  if (typeof browser === 'undefined' || !browser.runtime?.sendMessage) {
    return cached;
  }

  const key = normalizeUrlForComparison(rawUrl);
  const existingTask = clientInFlight.get(key);
  if (existingTask) return existingTask;

  const task = (async (): Promise<PreviewCacheEntry | null> => {
    try {
      await browser.runtime.sendMessage({
        type: FETCH_OG_PREVIEW_MESSAGE,
        url: rawUrl,
      } satisfies FetchOgPreviewMessage);
      return await getPreviewEntry(rawUrl);
    } catch {
      return cached;
    } finally {
      clientInFlight.delete(key);
    }
  })();

  clientInFlight.set(key, task);
  return task;
}
