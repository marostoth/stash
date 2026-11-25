import {
  extractFoldersFromChromeBookmarkTree,
  type ImportedBookmarkFolder,
} from '@/lib/import-export/bookmarks-html';

export type ChromeBookmarksImportReadResult =
  | { ok: true; folders: ImportedBookmarkFolder[] }
  | { ok: false; reason: 'denied' | 'unsupported' | 'error'; message: string };

/**
 * Requests optional `bookmarks` permission on click, reads Chrome's bookmark
 * tree, and converts folders into Stash-ready collections.
 */
export async function readChromeBookmarksWithPermission(): Promise<ChromeBookmarksImportReadResult> {
  if (typeof browser === 'undefined' || !browser.permissions) {
    return {
      ok: false,
      reason: 'unsupported',
      message: 'Chrome Bookmarks API is unavailable in this environment.',
    };
  }

  try {
    const alreadyGranted = await browser.permissions.contains({
      permissions: ['bookmarks'],
    });
    if (!alreadyGranted) {
      const granted = await browser.permissions.request({
        permissions: ['bookmarks'],
      });
      if (!granted) {
        return {
          ok: false,
          reason: 'denied',
          message:
            'Bookmarks permission was not granted. You can also import a .html bookmark file instead.',
        };
      }
    }

    if (!browser.bookmarks?.getTree) {
      return {
        ok: false,
        reason: 'unsupported',
        message: 'Chrome Bookmarks API could not be accessed.',
      };
    }

    const tree = await browser.bookmarks.getTree();
    const folders = extractFoldersFromChromeBookmarkTree(tree);
    return { ok: true, folders };
  } catch (error: unknown) {
    console.warn('Stash: Chrome bookmarks import failed', error);
    return {
      ok: false,
      reason: 'error',
      message: 'Failed to read Chrome bookmarks.',
    };
  }
}

export function triggerFileDownload(
  filename: string,
  content: string,
  mimeType = 'application/json',
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
