import { isStashableUrl } from '@/lib/tabs/session-filter';
import { decodeHtmlEntities } from '@/lib/utils/html-entities';
import { extractDomain } from '@/lib/utils/url';

export interface ImportedBookmarkLink {
  url: string;
  title: string;
  faviconUrl?: string;
}

export interface ImportedBookmarkFolder {
  name: string;
  links: ImportedBookmarkLink[];
}

export interface ChromeBookmarkNodeLike {
  id?: string;
  title?: string;
  url?: string;
  children?: ChromeBookmarkNodeLike[];
}

const ROOT_WRAPPER_NAMES = new Set([
  'bookmarks',
  'bookmarks bar',
  'bookmarks toolbar',
  'bookmarks menu',
  'favorites bar',
  'other bookmarks',
  'mobile bookmarks',
  'unfiled bookmarks',
]);

function readAttr(attrs: string, name: string): string | undefined {
  const regex = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  );
  const match = attrs.match(regex);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value ? decodeHtmlEntities(value).trim() : undefined;
}

/**
 * Parses standard Netscape Bookmark HTML files (Chrome, Edge, Firefox, and
 * other bookmark managers) without DOM innerHTML/DOMParser, keeping CSP clean.
 */
export function parseNetscapeBookmarksHtml(
  html: string,
): ImportedBookmarkFolder[] {
  const folderBuckets = new Map<string, ImportedBookmarkLink[]>();
  const folderOrder: string[] = [];

  const pushLink = (folderName: string, link: ImportedBookmarkLink) => {
    const cleanName = folderName.trim() || 'Imported Bookmarks';
    const bucket = folderBuckets.get(cleanName);
    if (bucket) {
      bucket.push(link);
    } else {
      folderOrder.push(cleanName);
      folderBuckets.set(cleanName, [link]);
    }
  };

  const tokenRegex =
    /<h3\b[^>]*>([\s\S]*?)<\/h3>|<a\b([^>]*)>([\s\S]*?)<\/a>|<dl\b[^>]*>|<\/dl>/gi;

  const stack: string[] = [];
  let pendingFolderName: string | null = null;

  for (const match of html.matchAll(tokenRegex)) {
    const full = match[0];
    const lower = full.toLowerCase();

    if (lower.startsWith('<h3')) {
      const rawName = (match[1] ?? '').replace(/<[^>]+>/g, '');
      pendingFolderName = decodeHtmlEntities(rawName).trim();
      continue;
    }

    if (lower.startsWith('<dl')) {
      stack.push(pendingFolderName ?? '');
      pendingFolderName = null;
      continue;
    }

    if (lower.startsWith('</dl')) {
      stack.pop();
      pendingFolderName = null;
      continue;
    }

    if (lower.startsWith('<a')) {
      const attrs = match[2] ?? '';
      const href = readAttr(attrs, 'href');
      if (!href || !isStashableUrl(href)) continue;

      const rawTitle = (match[3] ?? '').replace(/<[^>]+>/g, '');
      const title = decodeHtmlEntities(rawTitle).trim() || extractDomain(href);
      const iconUri = readAttr(attrs, 'icon_uri');

      // Find the top-most non-wrapper folder in the stack so top-level folders
      // under "Bookmarks bar" become individual Stash collections.
      const namedStack = stack.filter(Boolean);
      const nonWrapper = namedStack.find(
        (name) => !ROOT_WRAPPER_NAMES.has(name.toLowerCase()),
      );
      const targetFolder =
        nonWrapper ?? namedStack[namedStack.length - 1] ?? 'Imported Bookmarks';

      pushLink(targetFolder, {
        url: href,
        title,
        faviconUrl: iconUri && isStashableUrl(iconUri) ? iconUri : undefined,
      });
    }
  }

  return folderOrder
    .map((name) => ({
      name,
      links: folderBuckets.get(name) ?? [],
    }))
    .filter((folder) => folder.links.length > 0);
}

/**
 * Converts Chrome's `chrome.bookmarks.getTree()` structure into Stash import folders:
 * top-level folders inside Chrome roots become individual Stash collections, and
 * any nested links inside subfolders are preserved cleanly.
 */
export function extractFoldersFromChromeBookmarkTree(
  nodes: readonly ChromeBookmarkNodeLike[],
): ImportedBookmarkFolder[] {
  const folderBuckets = new Map<string, ImportedBookmarkLink[]>();
  const folderOrder: string[] = [];

  const pushLink = (folderName: string, link: ImportedBookmarkLink) => {
    const cleanName = folderName.trim() || 'Chrome Bookmarks';
    const bucket = folderBuckets.get(cleanName);
    if (bucket) {
      bucket.push(link);
    } else {
      folderOrder.push(cleanName);
      folderBuckets.set(cleanName, [link]);
    }
  };

  const collectNestedLinks = (
    node: ChromeBookmarkNodeLike,
    targetFolderName: string,
  ) => {
    if (node.url && isStashableUrl(node.url)) {
      pushLink(targetFolderName, {
        url: node.url,
        title: node.title?.trim() || extractDomain(node.url),
      });
      return;
    }
    for (const child of node.children ?? []) {
      collectNestedLinks(child, targetFolderName);
    }
  };

  const walkRoots = (
    node: ChromeBookmarkNodeLike,
    currentRootName: string | null,
  ) => {
    if (node.url && isStashableUrl(node.url)) {
      pushLink(currentRootName || 'Chrome Bookmarks', {
        url: node.url,
        title: node.title?.trim() || extractDomain(node.url),
      });
      return;
    }

    const title = node.title?.trim() ?? '';
    const isSyntheticRoot = node.id === '0' || title === '';
    const isBuiltInWrapper = ROOT_WRAPPER_NAMES.has(title.toLowerCase());

    if (isSyntheticRoot || isBuiltInWrapper) {
      const nextRootName = title || currentRootName;
      for (const child of node.children ?? []) {
        walkRoots(child, nextRootName);
      }
      return;
    }

    // This is a real user bookmark folder -> becomes a Stash collection
    collectNestedLinks(node, title);
  };

  for (const root of nodes) {
    walkRoots(root, null);
  }

  return folderOrder
    .map((name) => ({
      name,
      links: folderBuckets.get(name) ?? [],
    }))
    .filter((folder) => folder.links.length > 0);
}
