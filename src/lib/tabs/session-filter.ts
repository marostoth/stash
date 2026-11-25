import { extractDomain, normalizeUrlForComparison } from '@/lib/utils/url';

export interface OpenTabInfo {
  id: number;
  windowId: number;
  index: number;
  title: string;
  url: string;
  favIconUrl?: string;
  pinned: boolean;
  active: boolean;
  audible?: boolean;
}

export interface RawTabLike {
  id?: number;
  windowId?: number;
  index?: number;
  title?: string;
  url?: string;
  pendingUrl?: string;
  favIconUrl?: string;
  pinned?: boolean;
  active?: boolean;
  audible?: boolean;
}

const EXCLUDED_PROTOCOLS = new Set([
  'chrome:',
  'chrome-extension:',
  'edge:',
  'about:',
  'devtools:',
  'view-source:',
  'javascript:',
  'data:',
]);

export function isStashableUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (EXCLUDED_PROTOCOLS.has(parsed.protocol.toLowerCase())) {
      return false;
    }
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeRawTabs(
  rawTabs: readonly RawTabLike[],
): OpenTabInfo[] {
  const result: OpenTabInfo[] = [];
  for (const tab of rawTabs) {
    const url = tab.url || tab.pendingUrl;
    if (typeof tab.id !== 'number' || !isStashableUrl(url) || !url) {
      continue;
    }
    result.push({
      id: tab.id,
      windowId: tab.windowId ?? -1,
      index: tab.index ?? 0,
      title: tab.title?.trim() || extractDomain(url),
      url,
      favIconUrl:
        tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')
          ? tab.favIconUrl
          : undefined,
      pinned: Boolean(tab.pinned),
      active: Boolean(tab.active),
      audible: Boolean(tab.audible),
    });
  }
  return result.sort((a, b) => a.index - b.index);
}

export function partitionSidebarTabs(tabs: readonly OpenTabInfo[]): {
  pinned: OpenTabInfo[];
  regular: OpenTabInfo[];
} {
  const pinned: OpenTabInfo[] = [];
  const regular: OpenTabInfo[] = [];
  for (const tab of tabs) {
    if (!isStashableUrl(tab.url)) continue;
    if (tab.pinned) {
      pinned.push(tab);
    } else {
      regular.push(tab);
    }
  }
  return { pinned, regular };
}

/**
 * Returns every stashable open tab eligible for a session (respecting includePinned),
 * including duplicate URLs so "Save & Close" closes all duplicate copies too.
 */
export function selectEligibleTabsForClose(
  tabs: readonly OpenTabInfo[],
  options: { includePinned: boolean },
): OpenTabInfo[] {
  const eligible: OpenTabInfo[] = [];
  for (const tab of tabs) {
    if (!isStashableUrl(tab.url)) continue;
    if (tab.pinned && !options.includePinned) continue;
    eligible.push(tab);
  }
  return eligible;
}

export function selectTabsForSession(
  tabs: readonly OpenTabInfo[],
  options: { includePinned: boolean },
): OpenTabInfo[] {
  const seenUrls = new Set<string>();
  const selected: OpenTabInfo[] = [];

  for (const tab of selectEligibleTabsForClose(tabs, options)) {
    const normalized = normalizeUrlForComparison(tab.url);
    if (seenUrls.has(normalized)) continue;
    seenUrls.add(normalized);
    selected.push(tab);
  }

  return selected;
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function formatSessionName(date: Date = new Date()): string {
  const month = SHORT_MONTHS[date.getMonth()] ?? 'Session';
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `Session — ${month} ${day}, ${hours}:${minutes}`;
}
