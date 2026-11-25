import { normalizeUrlForComparison } from '@/lib/utils/url';

export const PREVIEW_DB_NAME = 'stash_preview_cache';
export const PREVIEW_DB_VERSION = 1;
export const PREVIEW_STORE_NAME = 'previews';
export const PREVIEW_CACHE_MAX_ENTRIES = 200;

export type PreviewSource = 'screenshot' | 'og';

export interface PreviewCacheEntry {
  url: string;
  screenshotBlob?: Blob;
  ogImageUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  source: PreviewSource;
  updatedAt: number;
  lastAccessedAt: number;
}

export type PreviewCacheWriteInput = Omit<
  PreviewCacheEntry,
  'url' | 'lastAccessedAt'
>;

/**
 * Pure LRU eviction helper returning the oldest `lastAccessedAt` keys to drop
 * whenever the cache exceeds `maxEntries`.
 */
export function selectLruEvictionKeys(
  entries: readonly Pick<PreviewCacheEntry, 'url' | 'lastAccessedAt'>[],
  maxEntries = PREVIEW_CACHE_MAX_ENTRIES,
): string[] {
  if (entries.length <= maxEntries) return [];
  const overflow = entries.length - Math.max(0, maxEntries);
  return [...entries]
    .sort(
      (a, b) =>
        a.lastAccessedAt - b.lastAccessedAt || a.url.localeCompare(b.url),
    )
    .slice(0, overflow)
    .map((entry) => entry.url);
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openPreviewDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(PREVIEW_DB_NAME, PREVIEW_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PREVIEW_STORE_NAME)) {
          db.createObjectStore(PREVIEW_STORE_NAME, { keyPath: 'url' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

export async function getPreviewEntry(
  rawUrl: string,
): Promise<PreviewCacheEntry | null> {
  const db = await openPreviewDb();
  if (!db) return null;

  const key = normalizeUrlForComparison(rawUrl);

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PREVIEW_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PREVIEW_STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        const found = req.result as PreviewCacheEntry | undefined;
        if (!found) {
          resolve(null);
          return;
        }
        const touched: PreviewCacheEntry = {
          ...found,
          lastAccessedAt: Date.now(),
        };
        store.put(touched);
        resolve(touched);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function putPreviewEntry(
  rawUrl: string,
  input: PreviewCacheWriteInput,
): Promise<void> {
  const db = await openPreviewDb();
  if (!db) return;

  const key = normalizeUrlForComparison(rawUrl);
  const now = Date.now();
  const record: PreviewCacheEntry = {
    ...input,
    url: key,
    lastAccessedAt: now,
  };

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(PREVIEW_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PREVIEW_STORE_NAME);
      store.put(record);

      const countReq = store.count();
      countReq.onsuccess = () => {
        if (countReq.result <= PREVIEW_CACHE_MAX_ENTRIES) {
          return;
        }
        const meta: Array<Pick<PreviewCacheEntry, 'url' | 'lastAccessedAt'>> =
          [];
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            const val = cursor.value as PreviewCacheEntry;
            meta.push({ url: val.url, lastAccessedAt: val.lastAccessedAt });
            cursor.continue();
            return;
          }
          const evictKeys = selectLruEvictionKeys(
            meta,
            PREVIEW_CACHE_MAX_ENTRIES,
          );
          for (const evictKey of evictKeys) {
            store.delete(evictKey);
          }
        };
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getPreviewCacheCount(): Promise<number> {
  const db = await openPreviewDb();
  if (!db) return 0;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PREVIEW_STORE_NAME, 'readonly');
      const req = tx.objectStore(PREVIEW_STORE_NAME).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    } catch {
      resolve(0);
    }
  });
}

export async function clearPreviewCache(): Promise<void> {
  const db = await openPreviewDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(PREVIEW_STORE_NAME, 'readwrite');
      tx.objectStore(PREVIEW_STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}
