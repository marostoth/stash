import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { parseNetscapeBookmarksHtml } from '@/lib/import-export/bookmarks-html';
import {
  buildNetscapeBookmarksHtml,
  formatBookmarksHtmlFilename,
} from '@/lib/import-export/bookmarks-html-export';
import { trashStorage } from '@/lib/storage/items';
import { stashRepo } from '@/lib/storage/repo';
import {
  pruneExpiredTrashEntries,
  TRASH_RETENTION_MS,
} from '@/lib/storage/trash-ops';
import { createDefaultSpace, type TrashEntry } from '@/lib/types/stash';

describe('7-day Recently Deleted Trash', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('captures deleted links in Trash, clears on immediate Undo, and restores cleanly', async () => {
    const col = await stashRepo.createCollection({ name: 'Reading' });
    const added = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://example.com/article',
      title: 'Deep Dive',
      note: 'Great read',
      tags: ['dev'],
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    await stashRepo.deleteLink(added.link.id);
    expect(await stashRepo.getLinks()).toHaveLength(0);

    const trashAfterDelete = await stashRepo.getTrash();
    expect(trashAfterDelete).toHaveLength(1);
    expect(trashAfterDelete[0]?.kind).toBe('link');

    // Immediate Undo removes the restored link from Trash too
    await stashRepo.restoreLink(added.link);
    expect(await stashRepo.getLinks()).toHaveLength(1);
    expect(await stashRepo.getTrash()).toHaveLength(0);

    // Delete again and restore via Trash API
    await stashRepo.deleteLink(added.link.id);
    const trash = await stashRepo.getTrash();
    const entryId = trash[0]?.id;
    expect(entryId).toBeDefined();
    if (!entryId) return;

    const restored = await stashRepo.restoreTrashEntry(entryId);
    expect(restored?.restoredKind).toBe('link');
    expect(restored?.restoredCount).toBe(1);
    expect((await stashRepo.getLinks())[0]?.title).toBe('Deep Dive');
    expect(await stashRepo.getTrash()).toHaveLength(0);
  });

  it('captures and restores an entire deleted collection along with its links', async () => {
    const col = await stashRepo.createCollection({ name: 'Projects' });
    await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://github.com/test/repo',
      title: 'Test Repo',
    });

    await stashRepo.deleteCollection(col.id);
    expect(await stashRepo.getCollections()).toHaveLength(0);
    expect(await stashRepo.getLinks()).toHaveLength(0);

    const trash = await stashRepo.getTrash();
    expect(trash).toHaveLength(1);
    expect(trash[0]?.kind).toBe('collection');

    const entryId = trash[0]?.id;
    if (!entryId) return;
    const restored = await stashRepo.restoreTrashEntry(entryId);
    expect(restored?.restoredKind).toBe('collection');
    expect(restored?.restoredCount).toBe(1);
    expect((await stashRepo.getCollections())[0]?.name).toBe('Projects');
    expect((await stashRepo.getLinks())[0]?.title).toBe('Test Repo');
  });

  it('auto-prunes trash entries older than 7 days and supports Empty Trash', async () => {
    const now = Date.parse('2026-11-26T12:00:00.000Z');
    const expiredIso = new Date(
      now - TRASH_RETENTION_MS - 60_000,
    ).toISOString();
    const freshIso = new Date(now - 3_600_000).toISOString();
    const entries: TrashEntry[] = [
      {
        id: 'old',
        kind: 'link',
        deletedAt: expiredIso,
        link: {
          id: 'l1',
          collectionId: 'c1',
          url: 'https://old.example',
          title: 'Old',
          note: '',
          tags: [],
          order: 0,
          createdAt: expiredIso,
          updatedAt: expiredIso,
        },
      },
      {
        id: 'fresh',
        kind: 'link',
        deletedAt: freshIso,
        link: {
          id: 'l2',
          collectionId: 'c1',
          url: 'https://fresh.example',
          title: 'Fresh',
          note: '',
          tags: [],
          order: 0,
          createdAt: freshIso,
          updatedAt: freshIso,
        },
      },
    ];

    expect(pruneExpiredTrashEntries(entries, now).map((e) => e.id)).toEqual([
      'fresh',
    ]);

    await trashStorage.setValue(entries);
    await stashRepo.emptyTrash();
    expect(await stashRepo.getTrash()).toEqual([]);
  });
});

describe('Netscape HTML bookmark export round-trip', () => {
  it('exports valid escaped Netscape HTML that parses back cleanly', () => {
    const space = createDefaultSpace('2026-11-26T12:00:00.000Z');
    const html = buildNetscapeBookmarksHtml(
      [space],
      [
        {
          id: 'c1',
          name: 'Dev & Tools',
          color: 'green',
          spaceId: space.id,
          order: 0,
          collapsed: false,
          createdAt: '2026-11-26T12:00:00.000Z',
          updatedAt: '2026-11-26T12:00:00.000Z',
        },
      ],
      [
        {
          id: 'l1',
          collectionId: 'c1',
          url: 'https://biomejs.dev/?a=1&b=2',
          title: 'Biome <Fast>',
          note: 'Linter & formatter',
          tags: ['dev', 'lint'],
          order: 0,
          createdAt: '2026-11-26T12:00:00.000Z',
          updatedAt: '2026-11-26T12:00:00.000Z',
        },
      ],
      '2026-11-26T12:00:00.000Z',
    );

    expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
    expect(html).toContain('Dev &amp; Tools');
    expect(html).toContain('Biome &lt;Fast&gt;');

    const parsed = parseNetscapeBookmarksHtml(html);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe('Dev & Tools');
    expect(parsed[0]?.links[0]).toEqual({
      url: 'https://biomejs.dev/?a=1&b=2',
      title: 'Biome <Fast>',
      faviconUrl: undefined,
    });

    expect(
      formatBookmarksHtmlFilename(new Date('2026-11-26T12:00:00.000Z')),
    ).toBe('stash-bookmarks-2026-11-26.html');
  });
});
