import {
  type Collection,
  DEFAULT_SPACE_ID,
  type LinkItem,
  type Space,
} from '@/lib/types/stash';
import { sortCollectionLinks } from '@/lib/utils/collection-sort';
import { sortByOrder } from '@/lib/utils/ordering';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toUnixSeconds(iso?: string): number {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(ms)
    ? Math.floor(ms / 1000)
    : Math.floor(Date.now() / 1000);
}

export function formatBookmarksHtmlFilename(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `stash-bookmarks-${year}-${month}-${day}.html`;
}

/**
 * Serializes all Stash Spaces, collections, and links into a standard
 * Netscape Bookmark File-1 HTML document compatible with Chrome, Edge,
 * Firefox, Safari, and other bookmark managers.
 */
export function buildNetscapeBookmarksHtml(
  spaces: readonly Space[],
  collections: readonly Collection[],
  links: readonly LinkItem[],
  exportedAt: string = new Date().toISOString(),
): string {
  const linksByCol = new Map<string, LinkItem[]>();
  for (const link of links) {
    const bucket = linksByCol.get(link.collectionId);
    if (bucket) bucket.push(link);
    else linksByCol.set(link.collectionId, [link]);
  }

  const orderedCollections = sortByOrder(collections);
  const spaceNameById = new Map(spaces.map((s) => [s.id, s.name]));
  const multipleSpaces = spaces.length > 1;
  const exportSec = toUnixSeconds(exportedAt);

  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file exported from Stash. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Stash Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];

  for (const col of orderedCollections) {
    const colLinks = sortCollectionLinks(
      linksByCol.get(col.id) ?? [],
      col.sortMode ?? 'manual',
    );
    if (colLinks.length === 0) continue;

    const spaceName = spaceNameById.get(col.spaceId ?? DEFAULT_SPACE_ID);
    const folderLabel =
      multipleSpaces && spaceName ? `${spaceName} — ${col.name}` : col.name;
    const colSec = toUnixSeconds(col.createdAt || exportedAt);

    lines.push(
      `    <DT><H3 ADD_DATE="${colSec}" LAST_MODIFIED="${exportSec}">${escapeHtml(folderLabel)}</H3>`,
    );
    lines.push('    <DL><p>');

    for (const link of colLinks) {
      const addDate = toUnixSeconds(link.createdAt);
      const iconAttr = link.faviconUrl
        ? ` ICON_URI="${escapeHtml(link.faviconUrl)}"`
        : '';
      const tagsAttr =
        link.tags.length > 0
          ? ` TAGS="${escapeHtml(link.tags.join(','))}"`
          : '';
      lines.push(
        `        <DT><A HREF="${escapeHtml(link.url)}" ADD_DATE="${addDate}"${iconAttr}${tagsAttr}>${escapeHtml(link.title)}</A>`,
      );
      if (link.note.trim()) {
        lines.push(`        <DD>${escapeHtml(link.note.trim())}`);
      }
    }

    lines.push('    </DL><p>');
  }

  lines.push('</DL><p>');
  return `${lines.join('\n')}\n`;
}
