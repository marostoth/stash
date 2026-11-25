export type ShortcutPlatform = 'mac' | 'other';

export interface ShortcutEntry {
  id: string;
  keys: readonly string[];
  /** Optional separator rendered between adjacent keycaps */
  joiner?: '+' | '/' | ' ';
  /** Optional muted qualifier rendered next to the keycaps */
  qualifier?: string;
  label: string;
}

export interface ShortcutGroup {
  id: 'board-search' | 'cards-previews' | 'chrome-native';
  title: string;
  subtitle?: string;
  items: readonly ShortcutEntry[];
}

export interface GlobalChromeCommandInfo {
  name: string;
  description: string;
  shortcut: string;
}

export const FALLBACK_GLOBAL_COMMANDS: readonly GlobalChromeCommandInfo[] = [
  {
    name: 'open-stash-sidepanel',
    description: 'Open Stash Side Panel',
    shortcut: 'Alt+Shift+S',
  },
  {
    name: 'quick-stash-active-tab',
    description: 'Quick-stash active tab',
    shortcut: 'Alt+Shift+D',
  },
] as const;

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    id: 'board-search',
    title: 'Board & Search',
    subtitle:
      'Navigate, filter, and launch saved links without leaving the keyboard.',
    items: [
      {
        id: 'focus-search',
        keys: ['/'],
        label: 'Focus search bar',
      },
      {
        id: 'navigate-cards',
        keys: ['↑', '↓'],
        joiner: '/',
        label: 'Move keyboard selection across filtered cards',
      },
      {
        id: 'open-selected',
        keys: ['Enter'],
        label: 'Open selected link',
      },
      {
        id: 'clear-or-close',
        keys: ['Esc'],
        label: 'Clear search, clear Starred filter, or close active modal',
      },
      {
        id: 'open-shortcuts',
        keys: ['?'],
        label: 'Open Keyboard Shortcuts',
      },
      {
        id: 'switch-space',
        keys: ['1–9'],
        label: 'Switch Space',
      },
      {
        id: 'starred-token',
        keys: ['is:starred'],
        label: 'Search token to show starred links only',
      },
    ],
  },
  {
    id: 'cards-previews',
    title: 'Cards & Previews',
    subtitle:
      'Quickly inspect saved pages and drop open browser tabs into collections.',
    items: [
      {
        id: 'instant-preview',
        keys: ['Space'],
        qualifier: 'on card hover/focus',
        label: 'Instant peek preview',
      },
      {
        id: 'drag-open-tab',
        keys: ['Drag'],
        qualifier: 'from Open Tabs rail',
        label: 'Stash tab directly into a collection',
      },
    ],
  },
  {
    id: 'chrome-native',
    title: 'Address Bar & Right-Click',
    subtitle: 'Reach your Stash library from any tab in Chrome.',
    items: [
      {
        id: 'omnibox-search',
        keys: ['s', 'Space', 'query'],
        joiner: '+',
        qualifier: 'address bar',
        label: 'Instant omnibox search across Stash',
      },
      {
        id: 'context-menu-stash',
        keys: ['Right-click link'],
        label: 'Stash this link',
      },
    ],
  },
] as const;

const MAC_GLYPH_MAP: Readonly<Record<string, { mac: string; other: string }>> =
  {
    '⌘': { mac: '⌘', other: 'Ctrl' },
    '⌃': { mac: '⌃', other: 'Ctrl' },
    '⌥': { mac: '⌥', other: 'Alt' },
    '⇧': { mac: '⇧', other: 'Shift' },
  };

function formatSingleToken(token: string, platform: ShortcutPlatform): string {
  const lower = token.toLowerCase();
  if (platform === 'mac') {
    if (
      lower === 'ctrl' ||
      lower === 'control' ||
      lower === 'command' ||
      lower === 'cmd' ||
      lower === 'meta'
    ) {
      return '⌘';
    }
    if (lower === 'macctrl') return '⌃';
    if (lower === 'alt' || lower === 'option') return '⌥';
    if (lower === 'shift') return '⇧';
  } else {
    if (
      lower === 'ctrl' ||
      lower === 'control' ||
      lower === 'command' ||
      lower === 'cmd' ||
      lower === 'meta' ||
      lower === 'macctrl'
    ) {
      return 'Ctrl';
    }
    if (lower === 'alt' || lower === 'option') return 'Alt';
    if (lower === 'shift') return 'Shift';
  }

  return token.length === 1 ? token.toUpperCase() : token;
}

/**
 * Splits a Chrome command shortcut string (e.g. `"Alt+Shift+S"` or `"⌘⇧S"`)
 * into individual display keycap tokens adapted for macOS or Windows/Linux.
 */
export function formatShortcutTokens(
  shortcut: string,
  platform: ShortcutPlatform,
): string[] {
  const trimmed = shortcut.trim();
  if (!trimmed) return [];

  // Handle `+`-delimited chords like "Alt+Shift+S" or "Ctrl+K"
  if (trimmed.includes('+')) {
    return trimmed
      .split('+')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => formatSingleToken(part, platform));
  }

  // Handle compact macOS glyph chords returned by chrome.commands (e.g. "⌘⇧S", "⌥⇧D")
  const chars = Array.from(trimmed);
  const tokens: string[] = [];
  let cursor = 0;

  while (cursor < chars.length) {
    const ch = chars[cursor];
    if (!ch) break;
    const mapped = MAC_GLYPH_MAP[ch];
    if (mapped) {
      tokens.push(platform === 'mac' ? mapped.mac : mapped.other);
      cursor += 1;
    } else {
      break;
    }
  }

  const remainder = chars.slice(cursor).join('').trim();
  if (remainder) {
    tokens.push(formatSingleToken(remainder, platform));
  }

  return tokens;
}

/**
 * Safely detects whether the host environment is macOS/Apple or other.
 */
export function detectPlatform(): ShortcutPlatform {
  if (typeof navigator === 'undefined') return 'other';
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const raw =
    nav.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;
  return /mac|iphone|ipad|ipod/i.test(raw) ? 'mac' : 'other';
}
