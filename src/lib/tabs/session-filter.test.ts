import { describe, expect, it } from 'vitest';
import {
  formatSessionName,
  isStashableUrl,
  normalizeRawTabs,
  partitionSidebarTabs,
  selectTabsForSession,
} from '@/lib/tabs/session-filter';

describe('session-filter', () => {
  it('excludes chrome://, chrome-extension://, and other non-web URLs', () => {
    expect(isStashableUrl('https://github.com/wxt-dev/wxt')).toBe(true);
    expect(isStashableUrl('http://localhost:3000')).toBe(true);
    expect(isStashableUrl('chrome://extensions')).toBe(false);
    expect(isStashableUrl('chrome://newtab')).toBe(false);
    expect(isStashableUrl('chrome-extension://abcdef/newtab.html')).toBe(false);
    expect(isStashableUrl('about:blank')).toBe(false);
    expect(isStashableUrl('')).toBe(false);
    expect(isStashableUrl(undefined)).toBe(false);
  });

  it('normalizes raw browser tabs, filters internal URLs, and sorts by index', () => {
    const normalized = normalizeRawTabs([
      {
        id: 2,
        index: 2,
        title: 'WXT Docs',
        url: 'https://wxt.dev',
        pinned: false,
      },
      {
        id: 99,
        index: 0,
        title: 'New Tab',
        url: 'chrome-extension://xyz/newtab.html',
        pinned: false,
      },
      {
        id: 1,
        index: 1,
        title: 'Mail',
        url: 'https://mail.google.com',
        pinned: true,
      },
      {
        id: 3,
        index: 3,
        title: 'Extensions',
        url: 'chrome://extensions/',
        pinned: true,
      },
    ]);

    expect(normalized.map((t) => t.id)).toEqual([1, 2]);
    const { pinned, regular } = partitionSidebarTabs(normalized);
    expect(pinned.map((t) => t.id)).toEqual([1]);
    expect(regular.map((t) => t.id)).toEqual([2]);
  });

  it('skips pinned tabs by default and includes them when override is enabled', () => {
    const tabs = normalizeRawTabs([
      {
        id: 1,
        index: 0,
        title: 'Pinned Mail',
        url: 'https://mail.example.com',
        pinned: true,
      },
      {
        id: 2,
        index: 1,
        title: 'Docs',
        url: 'https://react.dev/',
        pinned: false,
      },
      {
        id: 3,
        index: 2,
        title: 'Docs Duplicate',
        url: 'https://react.dev',
        pinned: false,
      },
      {
        id: 4,
        index: 3,
        title: 'Vite',
        url: 'https://vite.dev',
        pinned: false,
      },
    ]);

    const defaultSelection = selectTabsForSession(tabs, {
      includePinned: false,
    });
    expect(defaultSelection.map((t) => t.id)).toEqual([2, 4]);

    const withPinned = selectTabsForSession(tabs, { includePinned: true });
    expect(withPinned.map((t) => t.id)).toEqual([1, 2, 4]);
  });

  it('formats dated session names consistently', () => {
    const sampleDate = new Date(2026, 10, 25, 14, 5);
    expect(formatSessionName(sampleDate)).toBe('Session — Nov 25, 14:05');
  });
});
