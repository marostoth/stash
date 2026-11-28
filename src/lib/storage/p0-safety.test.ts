import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { parseLink } from '@/lib/import-export/bundle-parsers';
import { mergeSpaceReorganization } from '@/lib/reorganize/plan';
import { stashRepo } from '@/lib/storage/repo';
import { DEFAULT_SPACE_ID } from '@/lib/types/stash';
import { isSafeHttpUrl, sanitizeFaviconUrl, toSafeHref } from '@/lib/utils/url';

describe('P0 security & data-safety invariants', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('blocks malicious URL schemes and unsafe favicons across helpers, JSON import, and repo boundary', async () => {
    // Pure helpers
    expect(isSafeHttpUrl('https://example.com/path')).toBe(true);
    expect(isSafeHttpUrl('http://localhost:3000')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(
      false,
    );
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
    expect(toSafeHref('javascript:alert(1)')).toBeUndefined();
    expect(toSafeHref('https://example.com')).toBe('https://example.com');

    // Favicon sanitization allows https and raster data URIs, blocks svg/javascript/chrome-extension
    expect(sanitizeFaviconUrl('https://example.com/favicon.ico')).toBe(
      'https://example.com/favicon.ico',
    );
    expect(sanitizeFaviconUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(
      'data:image/png;base64,iVBORw0KGgo=',
    );
    expect(
      sanitizeFaviconUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='),
    ).toBeUndefined();
    expect(sanitizeFaviconUrl('javascript:alert(1)')).toBeUndefined();
    expect(
      sanitizeFaviconUrl('chrome-extension://abcdef/icon.png'),
    ).toBeUndefined();

    // JSON backup parseLink rejects unsafe URLs and strips unsafe favicons
    expect(
      parseLink({ id: '1', collectionId: 'c1', url: 'javascript:alert(1)' }, 0),
    ).toBeNull();
    expect(
      parseLink(
        { id: '2', collectionId: 'c1', url: 'data:text/html,<h1>x</h1>' },
        0,
      ),
    ).toBeNull();
    expect(
      parseLink(
        { id: '3', collectionId: 'c1', url: 'file:///C:/secret.txt' },
        0,
      ),
    ).toBeNull();
    const cleanParsed = parseLink(
      {
        id: '4',
        collectionId: 'c1',
        url: 'https://example.com',
        faviconUrl: 'javascript:alert(1)',
      },
      0,
    );
    expect(cleanParsed?.url).toBe('https://example.com');
    expect(cleanParsed?.faviconUrl).toBeUndefined();

    // Repository addLink & updateLink reject non-http(s) URLs
    const col = await stashRepo.createCollection({ name: 'Safe' });
    const badAdd = await stashRepo.addLink({
      collectionId: col.id,
      url: 'javascript:alert(1)',
    });
    expect(badAdd).toEqual({ ok: false, reason: 'invalid_url' });

    const goodAdd = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://example.com',
      faviconUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    });
    expect(goodAdd.ok).toBe(true);
    if (goodAdd.ok) {
      expect(goodAdd.link.faviconUrl).toBeUndefined();
      const badUpdate = await stashRepo.updateLink(goodAdd.link.id, {
        url: 'file:///etc/hosts',
      });
      expect(badUpdate).toEqual({ ok: false, reason: 'invalid_url' });
    }
  });

  it('serializes concurrent writes without clobbering links or duplicating Space Inboxes', async () => {
    const space = await stashRepo.createSpace({ name: 'Work' });

    // Concurrent getOrCreateSpaceInbox calls must yield the exact same Inbox ID
    const [inboxA, inboxB, inboxC] = await Promise.all([
      stashRepo.getOrCreateSpaceInbox(space.id),
      stashRepo.getOrCreateSpaceInbox(space.id),
      stashRepo.getOrCreateSpaceInbox(space.id),
    ]);
    expect(inboxA.id).toBe(inboxB.id);
    expect(inboxB.id).toBe(inboxC.id);

    const allCollections = await stashRepo.getCollections();
    expect(allCollections.filter((c) => c.spaceId === space.id)).toHaveLength(
      1,
    );

    // 10 concurrent addLink calls must persist all 10 links cleanly
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        stashRepo.addLink({
          collectionId: inboxA.id,
          url: `https://example.com/page-${i}`,
          title: `Page ${i}`,
        }),
      ),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await stashRepo.getLinks()).toHaveLength(10);
  });

  it('recovers a pruned Auto-Inbox collection when clicking Undo on its last deleted link', async () => {
    const inbox = await stashRepo.getOrCreateSpaceInbox(DEFAULT_SPACE_ID);
    const added = await stashRepo.addLink({
      collectionId: inbox.id,
      url: 'https://example.com/solo',
      title: 'Solo Link',
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    // Deleting the last link prunes the empty auto-Inbox
    expect(await stashRepo.deleteLink(added.link.id)).toBe(true);
    expect(
      (await stashRepo.getCollections()).some((c) => c.id === inbox.id),
    ).toBe(false);

    // Undo restores both the Inbox collection and the link atomically
    const restored = await stashRepo.restoreLink(added.link);
    expect(restored?.id).toBe(added.link.id);
    expect(
      (await stashRepo.getCollections()).some((c) => c.id === inbox.id),
    ).toBe(true);
    expect(
      (await stashRepo.getLinks()).some((l) => l.id === added.link.id),
    ).toBe(true);
  });

  it('scopes Smart Reorganize Undo to activeSpaceId without wiping edits in other Spaces', async () => {
    const spaceB = await stashRepo.createSpace({ name: 'Shopping' });
    const colA = await stashRepo.createCollection({
      name: 'Main Col',
      spaceId: DEFAULT_SPACE_ID,
    });
    const colB = await stashRepo.createCollection({
      name: 'Shop Col',
      spaceId: spaceB.id,
    });
    const linkA = await stashRepo.addLink({
      collectionId: colA.id,
      url: 'https://main.example.com',
      title: 'Main Link',
    });
    expect(linkA.ok).toBe(true);
    if (!linkA.ok) return;

    const prevMainSnapshot = {
      collections: [colA],
      links: [linkA.link],
    };

    // Simulate reorganizing Main space into a new collection
    const newColA = {
      ...colA,
      id: crypto.randomUUID(),
      name: 'Reorganized Main',
    };
    const mergedNext = mergeSpaceReorganization(
      [colA, colB],
      [linkA.link],
      DEFAULT_SPACE_ID,
      {
        collections: [newColA],
        links: [{ ...linkA.link, collectionId: newColA.id }],
      },
    );
    await stashRepo.applyReorganization(mergedNext);

    // User adds a brand-new link in Space B during the 10-second Undo window
    const newLinkB = await stashRepo.addLink({
      collectionId: colB.id,
      url: 'https://shop.example.com/item',
      title: 'Intervening Shop Item',
    });
    expect(newLinkB.ok).toBe(true);
    if (!newLinkB.ok) return;

    // Undo restores Main Space ONLY — Space B's intervening link survives intact
    await stashRepo.restoreLibrarySnapshot(prevMainSnapshot, DEFAULT_SPACE_ID);

    const finalCols = await stashRepo.getCollections();
    const finalLinks = await stashRepo.getLinks();
    expect(finalCols.some((c) => c.id === colA.id)).toBe(true);
    expect(finalCols.some((c) => c.id === colB.id)).toBe(true);
    expect(finalLinks.some((l) => l.id === linkA.link.id)).toBe(true);
    expect(finalLinks.some((l) => l.id === newLinkB.link.id)).toBe(true);
  });
});
