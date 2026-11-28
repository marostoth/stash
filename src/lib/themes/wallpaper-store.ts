export const WALLPAPER_DB_NAME = 'stash_wallpaper_db';
export const WALLPAPER_DB_VERSION = 1;
export const WALLPAPER_STORE_NAME = 'wallpapers';
export const WALLPAPER_ACTIVE_KEY = 'active';
export const WALLPAPER_CHANGED_EVENT = 'stash:wallpaper-changed';

const MAX_WALLPAPER_WIDTH = 2560;

export interface StoredWallpaper {
  key: string;
  blob: Blob;
  filename: string;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openWallpaperDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(WALLPAPER_DB_NAME, WALLPAPER_DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(WALLPAPER_STORE_NAME)) {
          db.createObjectStore(WALLPAPER_STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
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

function notifyWallpaperChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WALLPAPER_CHANGED_EVENT));
  }
}

async function optimizeWallpaperBlob(file: Blob): Promise<Blob> {
  if (
    typeof createImageBitmap !== 'function' ||
    typeof OffscreenCanvas === 'undefined'
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    try {
      const scale =
        bitmap.width > MAX_WALLPAPER_WIDTH
          ? MAX_WALLPAPER_WIDTH / bitmap.width
          : 1;
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);
      try {
        return await canvas.convertToBlob({
          type: 'image/webp',
          quality: 0.86,
        });
      } catch {
        return await canvas.convertToBlob({
          type: 'image/jpeg',
          quality: 0.88,
        });
      }
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}

export async function getStoredWallpaper(): Promise<StoredWallpaper | null> {
  const db = await openWallpaperDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(WALLPAPER_STORE_NAME, 'readonly');
      const req = tx
        .objectStore(WALLPAPER_STORE_NAME)
        .get(WALLPAPER_ACTIVE_KEY);
      req.onsuccess = () =>
        resolve((req.result as StoredWallpaper | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveStoredWallpaper(
  file: File,
): Promise<StoredWallpaper | null> {
  const db = await openWallpaperDb();
  if (!db) return null;

  const optimized = await optimizeWallpaperBlob(file);
  const record: StoredWallpaper = {
    key: WALLPAPER_ACTIVE_KEY,
    blob: optimized,
    filename: file.name || 'wallpaper',
    updatedAt: Date.now(),
  };

  const saved = await new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(WALLPAPER_STORE_NAME, 'readwrite');
      tx.objectStore(WALLPAPER_STORE_NAME).put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });

  if (!saved) return null;
  notifyWallpaperChanged();
  return record;
}

export async function clearStoredWallpaper(): Promise<void> {
  const db = await openWallpaperDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(WALLPAPER_STORE_NAME, 'readwrite');
      tx.objectStore(WALLPAPER_STORE_NAME).delete(WALLPAPER_ACTIVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });

  notifyWallpaperChanged();
}
