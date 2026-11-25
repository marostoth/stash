import { describe, expect, it } from 'vitest';
import {
  extractRestorableTabs,
  filterClearableTabs,
  formatClearTabsToast,
} from '@/lib/tabs/clearFilter';

describe('filterClearableTabs', () => {
  it('skips pinned tabs, audible tabs, and currentTabId while counting protected tabs', () => {
    const tabs = [
      {
        id: 1,
        url: 'chrome-extension://stash/newtab.html',
        title: 'Stash',
        pinned: false,
        audible: false,
      },
      {
        id: 2,
        url: 'https://mail.google.com',
        title: 'Gmail',
        pinned: true,
        audible: false,
      },
      {
        id: 3,
        url: 'https://youtube.com/watch?v=123',
        title: 'YouTube',
        pinned: false,
        audible: true,
      },
      {
        id: 4,
        url: 'https://open.spotify.com',
        title: 'Spotify',
        pinned: true,
        audible: true,
      },
      {
        id: 5,
        url: 'https://github.com/wxt-dev/wxt',
        title: 'WXT',
        pinned: false,
        audible: false,
      },
      {
        id: 6,
        url: 'https://react.dev',
        title: 'React',
        pinned: false,
        audible: false,
      },
    ];

    const result = filterClearableTabs(tabs, { currentTabId: 1 });

    expect(result.tabsToClose.map((t) => t.id)).toEqual([5, 6]);
    expect(result.skippedPinnedCount).toBe(2);
    expect(result.skippedAudibleCount).toBe(2);
    expect(result.wouldCloseWindow).toBe(false);
  });

  it('detects wouldCloseWindow accurately for Side Panel vs New Tab scenarios', () => {
    const sidePanelTabs = [
      { id: 10, url: 'https://a.dev', pinned: false, audible: false },
      { id: 11, url: 'https://b.dev', pinned: false, audible: false },
    ];

    // Triggered from Side Panel (no currentTabId) and no pinned/audible tabs
    const sidePanelResult = filterClearableTabs(sidePanelTabs);
    expect(sidePanelResult.tabsToClose.map((t) => t.id)).toEqual([10, 11]);
    expect(sidePanelResult.wouldCloseWindow).toBe(true);

    // Triggered from New Tab page where tab 10 is Stash itself
    const newTabResult = filterClearableTabs(sidePanelTabs, {
      currentTabId: 10,
    });
    expect(newTabResult.tabsToClose.map((t) => t.id)).toEqual([11]);
    expect(newTabResult.wouldCloseWindow).toBe(false);

    // Side Panel with one audible tab keeping the window alive
    const withAudible = [
      { id: 10, url: 'https://a.dev', pinned: false, audible: true },
      { id: 11, url: 'https://b.dev', pinned: false, audible: false },
    ];
    const audibleResult = filterClearableTabs(withAudible);
    expect(audibleResult.tabsToClose.map((t) => t.id)).toEqual([11]);
    expect(audibleResult.skippedAudibleCount).toBe(1);
    expect(audibleResult.wouldCloseWindow).toBe(false);
  });

  it('handles empty tab lists and tabs missing valid id safely', () => {
    const empty = filterClearableTabs([]);
    expect(empty).toEqual({
      tabsToClose: [],
      skippedPinnedCount: 0,
      skippedAudibleCount: 0,
      wouldCloseWindow: false,
    });

    const withMissingIds = filterClearableTabs([
      { url: 'https://no-id.dev', pinned: false, audible: false },
      { id: 42, url: 'https://valid.dev', pinned: false, audible: false },
    ]);
    expect(withMissingIds.tabsToClose.map((t) => t.id)).toEqual([42]);
    // Because an unidentifiable tab exists in the window, we are not closing every tab
    expect(withMissingIds.wouldCloseWindow).toBe(false);
  });

  it('extracts restorable URL snapshots cleanly and formats concise toast copy', () => {
    const snapshots = extractRestorableTabs([
      { id: 1, url: 'https://example.com', title: 'Example' },
      { id: 2, pendingUrl: 'https://loading.dev/docs' },
      { id: 3, url: 'chrome://settings', title: 'Settings' },
      { id: 4, url: 'chrome-extension://abc/newtab.html', title: 'Stash' },
      { id: 5, url: '', title: 'Blank' },
    ]);

    expect(snapshots).toEqual([
      { url: 'https://example.com', title: 'Example' },
      { url: 'https://loading.dev/docs', title: 'loading.dev' },
    ]);

    expect(formatClearTabsToast(1, 0, 0)).toBe('Cleared 1 tab');
    expect(formatClearTabsToast(5, 0, 0)).toBe('Cleared 5 tabs');
    expect(formatClearTabsToast(8, 2, 1)).toBe(
      'Cleared 8 tabs (audible/pinned kept)',
    );
    expect(formatClearTabsToast(3, 0, 1)).toBe('Cleared 3 tabs (audible kept)');
    expect(formatClearTabsToast(4, 2, 0)).toBe('Cleared 4 tabs (pinned kept)');
  });
});
