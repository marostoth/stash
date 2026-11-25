import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { stashRepo } from '@/lib/storage/repo';
import { DEFAULT_SETTINGS } from '@/lib/types/stash';

describe('stashRepo', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('returns version 1 default snapshot when storage is empty', async () => {
    const snapshot = await stashRepo.getSnapshot();
    expect(snapshot.collections).toEqual([]);
    expect(snapshot.links).toEqual([]);
    expect(snapshot.rules).toEqual([]);
    expect(snapshot.customThemes).toEqual([]);
    expect(snapshot.settings).toEqual(DEFAULT_SETTINGS);
    expect(snapshot.settings.activeThemeId).toBe('oscilloscope');
  });

  it('performs collection CRUD and cascades link deletion', async () => {
    const c1 = await stashRepo.createCollection({
      name: '3D Printing',
      description: 'Models and calibration',
      color: 'cyan',
    });
    const c2 = await stashRepo.createCollection({
      name: 'Electronics',
      color: 'green',
    });

    expect(c1.id).toBeTruthy();
    expect(c1.order).toBe(0);
    expect(c2.order).toBe(1);
    expect(c1.collapsed).toBe(false);

    const toggled = await stashRepo.toggleCollectionCollapsed(c1.id);
    expect(toggled?.collapsed).toBe(true);

    const renamed = await stashRepo.updateCollection(c1.id, {
      name: '3D Printing Lab',
      color: 'orange',
    });
    expect(renamed?.name).toBe('3D Printing Lab');
    expect(renamed?.color).toBe('orange');

    await stashRepo.addLink({
      collectionId: c1.id,
      url: 'https://printables.com',
      title: 'Printables',
    });
    await stashRepo.addLink({
      collectionId: c2.id,
      url: 'https://digikey.com',
      title: 'DigiKey',
    });

    const deleted = await stashRepo.deleteCollection(c1.id);
    expect(deleted).toBe(true);

    const remainingCollections = await stashRepo.getCollections();
    expect(remainingCollections).toHaveLength(1);
    expect(remainingCollections[0]?.id).toBe(c2.id);
    expect(remainingCollections[0]?.order).toBe(0);

    const remainingLinks = await stashRepo.getLinks();
    expect(remainingLinks).toHaveLength(1);
    expect(remainingLinks[0]?.collectionId).toBe(c2.id);
  });

  it('seeds starter collections only when library is empty', async () => {
    const seeded = await stashRepo.seedStarterCollections();
    expect(seeded.map((c) => c.name)).toEqual([
      'Reading',
      'Tools',
      'Inspiration',
    ]);

    const secondCall = await stashRepo.seedStarterCollections();
    expect(secondCall).toHaveLength(3);
  });

  it('enforces Duplicate URL Guard within a collection but allows cross-collection URLs', async () => {
    const colA = await stashRepo.createCollection({ name: 'Dev' });
    const colB = await stashRepo.createCollection({ name: 'Favorites' });

    const first = await stashRepo.addLink({
      collectionId: colA.id,
      url: 'https://github.com/wxt-dev/wxt',
      title: 'WXT Repo',
      tags: ['Extension', '#WXT', 'extension'],
    });

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.link.tags).toEqual(['extension', 'wxt']);

    // Trailing slash + uppercase host + default port should match as duplicate
    const dupTrailing = await stashRepo.addLink({
      collectionId: colA.id,
      url: 'https://GitHub.com:443/wxt-dev/wxt/',
      title: 'Duplicate WXT',
    });
    expect(dupTrailing.ok).toBe(false);
    if (!dupTrailing.ok) {
      expect(dupTrailing.reason).toBe('duplicate');
      expect(dupTrailing.existingLink.id).toBe(first.link.id);
    }

    // Same URL in a DIFFERENT collection must succeed
    const crossCollection = await stashRepo.addLink({
      collectionId: colB.id,
      url: 'https://github.com/wxt-dev/wxt/',
      title: 'WXT in Favorites',
    });
    expect(crossCollection.ok).toBe(true);
    if (!crossCollection.ok) return;

    // Editing own link metadata should NOT trigger self-duplicate
    const selfUpdate = await stashRepo.updateLink(first.link.id, {
      note: 'Core MV3 framework',
      tags: ['wxt', 'mv3'],
    });
    expect(selfUpdate.ok).toBe(true);
    if (selfUpdate.ok) {
      expect(selfUpdate.link.note).toBe('Core MV3 framework');
    }

    // Moving link into a collection that already contains that URL must be blocked
    const moveDup = await stashRepo.updateLink(crossCollection.link.id, {
      collectionId: colA.id,
    });
    expect(moveDup.ok).toBe(false);
    if (!moveDup.ok) {
      expect(moveDup.reason).toBe('duplicate');
    }
  });

  it('deletes links, marks lastOpenedAt, and updates settings', async () => {
    const col = await stashRepo.createCollection({ name: 'Docs' });
    const l1 = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://react.dev',
    });
    const l2 = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://tailwindcss.com',
    });
    expect(l1.ok && l2.ok).toBe(true);
    if (!l1.ok || !l2.ok) return;

    expect(l1.link.title).toBe('react.dev');

    await stashRepo.markLinkOpened(l2.link.id);
    await stashRepo.deleteLink(l1.link.id);

    const remaining = await stashRepo.getLinks();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(l2.link.id);
    expect(remaining[0]?.order).toBe(0);
    expect(remaining[0]?.lastOpenedAt).toBeTruthy();

    const updatedSettings = await stashRepo.updateSettings({
      activeThemeId: 'clean-light',
      density: 'compact',
    });
    expect(updatedSettings.activeThemeId).toBe('clean-light');
    expect(updatedSettings.density).toBe('compact');
    expect(updatedSettings.openLinkInNewTab).toBe(true);
  });

  it('persists collection reordering, link moves, and session saves', async () => {
    const c1 = await stashRepo.createCollection({ name: 'First' });
    const c2 = await stashRepo.createCollection({ name: 'Second' });

    const reordered = await stashRepo.reorderCollections(c2.id, 0);
    expect(reordered.map((c) => c.id)).toEqual([c2.id, c1.id]);

    const a1 = await stashRepo.addLink({
      collectionId: c1.id,
      url: 'https://a.dev',
    });
    const a2 = await stashRepo.addLink({
      collectionId: c1.id,
      url: 'https://b.dev',
    });
    expect(a1.ok && a2.ok).toBe(true);
    if (!a1.ok || !a2.ok) return;

    const moved = await stashRepo.moveOrReorderLink(a1.link.id, c2.id, 0);
    expect(moved.ok).toBe(true);

    const session = await stashRepo.saveSessionCollection(
      [
        {
          id: 1,
          windowId: 1,
          index: 0,
          title: 'Pinned',
          url: 'https://mail.dev',
          pinned: true,
          active: false,
        },
        {
          id: 2,
          windowId: 1,
          index: 1,
          title: 'WXT',
          url: 'https://wxt.dev',
          pinned: false,
          active: false,
        },
      ],
      { includePinned: false, date: new Date(2026, 10, 25, 14, 30) },
    );

    expect(session).not.toBeNull();
    expect(session?.collection.isSession).toBe(true);
    expect(session?.collection.name).toBe('Session — Nov 25, 14:30');
    expect(session?.links.map((l) => l.url)).toEqual(['https://wxt.dev']);

    const allCollections = await stashRepo.getCollections();
    expect(allCollections[0]?.id).toBe(session?.collection.id);
  });

  it('creates, updates, prioritizes, and deletes categorization rules', async () => {
    const col = await stashRepo.createCollection({ name: 'Dev' });
    const r1 = await stashRepo.createRule({
      name: 'GitHub',
      match: { domainContains: ['GitHub.com'] },
      action: { targetCollectionId: col.id, addTags: ['Code'] },
    });
    const r2 = await stashRepo.createRule({
      name: 'Docs',
      match: { urlContains: ['/docs/'] },
      action: { targetCollectionId: col.id },
    });

    expect(r1.priority).toBe(1);
    expect(r2.priority).toBe(2);
    expect(r1.match.domainContains).toEqual(['github.com']);

    const reordered = await stashRepo.moveRulePriority(r2.id, 'up');
    expect(reordered.map((r) => r.id)).toEqual([r2.id, r1.id]);

    const toggled = await stashRepo.updateRule(r1.id, { enabled: false });
    expect(toggled?.enabled).toBe(false);

    expect(await stashRepo.deleteRule(r2.id)).toBe(true);
    const remaining = await stashRepo.getRules();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.priority).toBe(1);
  });

  it('restores a deleted link with exact ID, tagsLocked, metadata, and original position (Undo)', async () => {
    const col = await stashRepo.createCollection({ name: 'Reading' });
    const l1 = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://one.dev',
      title: 'One',
    });
    const l2 = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://two.dev',
      title: 'Two',
      note: 'Important essay',
      tags: ['essay', 'favorite'],
      tagsLocked: true,
    });
    const l3 = await stashRepo.addLink({
      collectionId: col.id,
      url: 'https://three.dev',
      title: 'Three',
    });
    expect(l1.ok && l2.ok && l3.ok).toBe(true);
    if (!l1.ok || !l2.ok || !l3.ok) return;

    const deletedSnapshot = { ...l2.link };
    expect(await stashRepo.deleteLink(l2.link.id)).toBe(true);
    expect((await stashRepo.getLinks()).map((l) => l.id)).toEqual([
      l1.link.id,
      l3.link.id,
    ]);

    const restored = await stashRepo.restoreLink(deletedSnapshot);
    expect(restored).not.toBeNull();
    expect(restored?.id).toBe(l2.link.id);
    expect(restored?.note).toBe('Important essay');
    expect(restored?.tags).toEqual(['essay', 'favorite']);
    expect(restored?.tagsLocked).toBe(true);
    expect(restored?.order).toBe(1);

    const all = await stashRepo.getLinks();
    expect(all.map((l) => [l.id, l.order])).toEqual([
      [l1.link.id, 0],
      [l2.link.id, 1],
      [l3.link.id, 2],
    ]);

    // Verify v1.4 preview settings defaults
    const settings = await stashRepo.getSettings();
    expect(settings.hoverPreviews).toBe(true);
    expect(settings.visualPreviewsEnabled).toBe(false);
  });
});
