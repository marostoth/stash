import { describe, expect, it } from 'vitest';
import {
  buildLibraryDigest,
  cleanTitleForDigest,
  sanitizeProposedCategories,
  UNCATEGORIZED_CATEGORY_NAME,
} from '@/lib/reorganize/digest';
import {
  buildReorganizationPlan,
  type LibraryBoardState,
} from '@/lib/reorganize/plan';
import type { Collection, LinkItem } from '@/lib/types/stash';

function makeCollection(
  overrides: Partial<Collection> & { id: string; name: string },
): Collection {
  return {
    color: 'green',
    order: 0,
    collapsed: false,
    createdAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    ...overrides,
  };
}

function makeLink(
  overrides: Partial<LinkItem> & {
    id: string;
    collectionId: string;
    url: string;
  },
): LinkItem {
  return {
    title: 'Sample',
    note: '',
    tags: [],
    order: 0,
    createdAt: '2026-11-25T10:00:00.000Z',
    updatedAt: '2026-11-25T10:00:00.000Z',
    ...overrides,
  };
}

describe('reorganize/digest', () => {
  it('aggregates domain frequencies, cleans boilerplate titles, and enforces character cap on 250+ links', () => {
    expect(cleanTitleForDigest('(12) WXT Extension Guide — YouTube')).toBe(
      'WXT Extension Guide',
    );

    const links: LinkItem[] = [];
    for (let i = 0; i < 250; i++) {
      const domain =
        i % 5 === 0
          ? 'github.com'
          : i % 5 === 1
            ? 'youtube.com'
            : i % 5 === 2
              ? 'developer.chrome.com'
              : `site-${i}.example.org`;
      links.push(
        makeLink({
          id: `link-${i}`,
          collectionId: 'col-1',
          url: `https://${domain}/resource/${i}`,
          title: `(3) Long Resource Title Number ${i} Covering Various Topics | Home`,
          tags: i % 2 === 0 ? ['dev', 'reference'] : [],
        }),
      );
    }

    const digest = buildLibraryDigest(links, { maxChars: 2000 });
    expect(digest.totalLinks).toBe(250);
    expect(digest.text.length).toBeLessThanOrEqual(2000);
    expect(digest.text).toContain('github.com (50)');
    expect(digest.text).toContain('youtube.com (50)');
    expect(digest.text).toContain('developer.chrome.com (50)');
    expect(digest.sampleCount).toBeGreaterThan(0);
  });

  it('sanitizes, deduplicates case-insensitively, excludes Uncategorized, and caps categories at 10', () => {
    let seq = 0;
    const raw = [
      { name: '1. Dev & Tools', description: '  Code   and   docs  ' },
      { name: 'dev & tools', description: 'Duplicate casing' },
      { name: 'Uncategorized', description: 'Should be skipped' },
      { name: '  ', description: 'Empty' },
      { name: 'Design', description: 'UI inspiration' },
      { name: 'Finance', description: 'Banking and investing' },
      { name: 'Reading', description: 'Longform essays' },
      { name: '3D Printing', description: 'Models & slicers' },
      { name: 'Audio', description: 'Synths' },
      { name: 'Hardware', description: 'Electronics' },
      { name: 'AI', description: 'Models' },
      { name: 'Cooking', description: 'Recipes' },
      { name: 'Travel', description: 'Trips' },
      {
        name: 'Overflow Category',
        description: 'Should be trimmed by maxCount',
      },
    ];

    const sanitized = sanitizeProposedCategories(raw, {
      maxCount: 10,
      createId: () => `cat-${++seq}`,
    });

    expect(sanitized).toHaveLength(10);
    expect(sanitized[0]).toEqual({
      id: 'cat-1',
      name: 'Dev & Tools',
      description: 'Code and docs',
    });
    expect(
      sanitized.some(
        (c) =>
          c.name.toLowerCase() === UNCATEGORIZED_CATEGORY_NAME.toLowerCase(),
      ),
    ).toBe(false);
    expect(sanitized.some((c) => c.name === 'Overflow Category')).toBe(false);
  });
});

describe('reorganize/plan', () => {
  it('subset scope leaves untouched collections intact, preserves link metadata, deduplicates targets, and removes empty sources only when enabled', () => {
    const colImported = makeCollection({
      id: 'col-imported',
      name: 'Imported Bookmarks',
      order: 0,
    });
    const colDev = makeCollection({
      id: 'col-dev',
      name: 'Dev',
      order: 1,
    });
    const colUntouchedEmpty = makeCollection({
      id: 'col-empty-other',
      name: 'Scratchpad',
      order: 2,
    });

    const currentState: LibraryBoardState = {
      collections: [colImported, colDev, colUntouchedEmpty],
      links: [
        makeLink({
          id: 'l-existing-dev',
          collectionId: 'col-dev',
          url: 'https://react.dev/',
          title: 'React Docs',
          tags: ['react'],
          order: 0,
        }),
        makeLink({
          id: 'l-dup-in-import',
          collectionId: 'col-imported',
          url: 'https://React.dev',
          title: 'React Duplicate',
          order: 0,
        }),
        makeLink({
          id: 'l-new-dev',
          collectionId: 'col-imported',
          url: 'https://wxt.dev',
          title: 'WXT Framework',
          note: 'Keep this note',
          tags: ['mv3', 'wxt'],
          tagsLocked: true,
          faviconUrl: 'https://wxt.dev/favicon.ico',
          order: 1,
        }),
        makeLink({
          id: 'l-design',
          collectionId: 'col-imported',
          url: 'https://figma.com',
          title: 'Figma',
          order: 2,
        }),
        makeLink({
          id: 'l-straggler',
          collectionId: 'col-imported',
          url: 'https://mystery.example',
          title: 'Mystery',
          order: 3,
        }),
      ],
    };

    const approved = [
      { id: 'c1', name: 'Dev', description: 'Development tools' },
      { id: 'c2', name: 'Design', description: 'UI tools' },
    ];
    const assignments = {
      'l-dup-in-import': 'Dev',
      'l-new-dev': 'Dev',
      'l-design': 'Design',
      'l-straggler': UNCATEGORIZED_CATEGORY_NAME,
    };

    let seq = 0;
    const plan = buildReorganizationPlan(
      currentState,
      {
        mode: 'collections',
        collectionIds: ['col-imported'],
        keepExistingTargets: true,
      },
      approved,
      assignments,
      true,
      {
        nowIso: '2026-11-25T13:15:00.000Z',
        createId: () => `new-col-${++seq}`,
      },
    );

    // Imported Bookmarks became empty -> removed; untouched Scratchpad MUST remain!
    expect(plan.nextState.collections.map((c) => c.name)).toEqual([
      'Dev',
      'Scratchpad',
      'Design',
      'Uncategorized',
    ]);
    expect(plan.summary.removedEmptyCollections).toBe(1);
    expect(plan.summary.deduplicatedLinks).toBe(1);
    expect(plan.summary.movedLinks).toBe(3);
    expect(plan.summary.uncategorizedCount).toBe(1);

    // Verify metadata and tagsLocked preserved intact
    const movedWxt = plan.nextState.links.find((l) => l.id === 'l-new-dev');
    expect(movedWxt).toMatchObject({
      id: 'l-new-dev',
      collectionId: 'col-dev',
      note: 'Keep this note',
      tags: ['mv3', 'wxt'],
      tagsLocked: true,
      faviconUrl: 'https://wxt.dev/favicon.ico',
    });

    // Duplicate React link was skipped; original untouched React link remains
    const devLinks = plan.nextState.links.filter(
      (l) => l.collectionId === 'col-dev',
    );
    expect(devLinks.map((l) => l.id)).toEqual(['l-existing-dev', 'l-new-dev']);

    // When removeEmptySources is false, Imported Bookmarks is retained even though empty
    const keepEmptyPlan = buildReorganizationPlan(
      currentState,
      {
        mode: 'collections',
        collectionIds: ['col-imported'],
        keepExistingTargets: true,
      },
      approved,
      assignments,
      false,
    );
    expect(
      keepEmptyPlan.nextState.collections.some((c) => c.id === 'col-imported'),
    ).toBe(true);
    expect(keepEmptyPlan.summary.removedEmptyCollections).toBe(0);
  });

  it('full-library scope rebuilds cleanly and omits Uncategorized when unused', () => {
    const currentState: LibraryBoardState = {
      collections: [
        makeCollection({ id: 'old-1', name: 'Misc 1', order: 0 }),
        makeCollection({ id: 'old-2', name: 'Misc 2', order: 1 }),
      ],
      links: [
        makeLink({
          id: 'a',
          collectionId: 'old-1',
          url: 'https://github.com/a',
          title: 'Repo A',
        }),
        makeLink({
          id: 'b',
          collectionId: 'old-2',
          url: 'https://nytimes.com/article',
          title: 'Article B',
        }),
      ],
    };

    const plan = buildReorganizationPlan(
      currentState,
      { mode: 'full' },
      [
        { id: 'cat-1', name: 'Engineering', description: 'Code' },
        { id: 'cat-2', name: 'Reading', description: 'News' },
      ],
      { a: 'Engineering', b: 'Reading' },
      true,
    );

    expect(plan.nextState.collections.map((c) => c.name)).toEqual([
      'Engineering',
      'Reading',
    ]);
    expect(plan.summary.removedEmptyCollections).toBe(2);
    expect(plan.summary.createdCollections).toBe(2);
    expect(plan.summary.uncategorizedCount).toBe(0);
    expect(plan.nextState.links).toHaveLength(2);
  });
});
