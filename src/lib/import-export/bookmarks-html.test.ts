import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  extractFoldersFromChromeBookmarkTree,
  parseNetscapeBookmarksHtml,
} from '@/lib/import-export/bookmarks-html';
import { stashRepo } from '@/lib/storage/repo';

const SAMPLE_NETSCAPE_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3 PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
  <DL><p>
    <DT><A HREF="https://news.ycombinator.com/">Hacker News</A>
    <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
    <DT><H3>3D Printing</H3>
    <DL><p>
      <DT><A HREF="https://www.printables.com/">Printables &amp; Models</A>
      <DT><H3>Voron Subfolder</H3>
      <DL><p>
        <DT><A HREF="https://vorondesign.com/">Voron &#39;Design&#39;</A>
      </DL><p>
    </DL><p>
    <DT><H3>Empty Folder</H3>
    <DL><p></DL><p>
  </DL><p>
  <DT><H3>Other bookmarks</H3>
  <DL><p>
    <DT><H3>Dev Docs</H3>
    <DL><p>
      <DT><A HREF="https://wxt.dev">WXT</A>
      <DT><A HREF="chrome://extensions/">Extensions</A>
    </DL><p>
  </DL><p>
</DL><p>`;

describe('bookmark importers', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('parses Netscape HTML bookmarks, preserves nested links, decodes entities, and filters unsafe URLs', () => {
    const folders = parseNetscapeBookmarksHtml(SAMPLE_NETSCAPE_HTML);

    expect(folders.map((f) => f.name)).toEqual([
      'Bookmarks bar',
      '3D Printing',
      'Dev Docs',
    ]);
    expect(folders[0]?.links).toEqual([
      {
        url: 'https://news.ycombinator.com/',
        title: 'Hacker News',
        faviconUrl: undefined,
      },
    ]);
    expect(folders[1]?.links.map((l) => l.title)).toEqual([
      'Printables & Models',
      "Voron 'Design'",
    ]);
    expect(folders[2]?.links.map((l) => l.url)).toEqual(['https://wxt.dev']);
  });

  it('extracts top-level folders from Chrome bookmarks.getTree() structure', () => {
    const folders = extractFoldersFromChromeBookmarkTree([
      {
        id: '0',
        title: '',
        children: [
          {
            id: '1',
            title: 'Bookmarks bar',
            children: [
              { id: '10', title: 'Loose Link', url: 'https://example.com' },
              {
                id: '11',
                title: 'Electronics',
                children: [
                  { id: '12', title: 'DigiKey', url: 'https://digikey.com' },
                  {
                    id: '13',
                    title: 'ESP32',
                    children: [
                      {
                        id: '14',
                        title: 'Espressif',
                        url: 'https://espressif.com',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    expect(folders.map((f) => f.name)).toEqual([
      'Bookmarks bar',
      'Electronics',
    ]);
    expect(folders[1]?.links.map((l) => l.url)).toEqual([
      'https://digikey.com',
      'https://espressif.com',
    ]);
  });

  it('imports parsed folders into storage while skipping duplicate URLs', async () => {
    const folders = parseNetscapeBookmarksHtml(SAMPLE_NETSCAPE_HTML);
    const first = await stashRepo.importBookmarkFolders(folders);
    expect(first.collectionsCreated).toBe(3);
    expect(first.linksAdded).toBe(4);
    expect(first.linksSkipped).toBe(0);

    // Re-importing the exact same file matches existing collections and skips duplicates
    const second = await stashRepo.importBookmarkFolders(folders);
    expect(second.collectionsCreated).toBe(0);
    expect(second.collectionsMatched).toBe(3);
    expect(second.linksAdded).toBe(0);
    expect(second.linksSkipped).toBe(4);
  });
});
