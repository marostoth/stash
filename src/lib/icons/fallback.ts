import {
  AtSign,
  BookOpen,
  Code,
  FileText,
  Globe,
  type LucideIcon,
  MessageSquare,
  Music,
  Palette,
  PlayCircle,
  ShoppingBag,
} from 'lucide-react';

export type FallbackLinkIconKey =
  | 'code'
  | 'play-circle'
  | 'file-text'
  | 'message-square'
  | 'at-sign'
  | 'book-open'
  | 'palette'
  | 'music'
  | 'shopping-bag'
  | 'globe';

const FALLBACK_LINK_ICON_MAP: Record<FallbackLinkIconKey, LucideIcon> = {
  code: Code,
  'play-circle': PlayCircle,
  'file-text': FileText,
  'message-square': MessageSquare,
  'at-sign': AtSign,
  'book-open': BookOpen,
  palette: Palette,
  music: Music,
  'shopping-bag': ShoppingBag,
  globe: Globe,
};

export function getFallbackLinkIcon(key: FallbackLinkIconKey): LucideIcon {
  return FALLBACK_LINK_ICON_MAP[key] ?? Globe;
}

function hostMatches(host: string, domains: readonly string[]): boolean {
  return domains.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

const CODE_DOMAINS = [
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'codepen.io',
  'codesandbox.io',
  'stackoverflow.com',
] as const;

const VIDEO_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'twitch.tv',
  'loom.com',
] as const;

const DISCUSSION_DOMAINS = [
  'reddit.com',
  'news.ycombinator.com',
  'discord.com',
  'slack.com',
] as const;

const SOCIAL_DOMAINS = [
  'x.com',
  'twitter.com',
  'bsky.app',
  'threads.net',
  'mastodon.social',
] as const;

const DESIGN_DOMAINS = ['figma.com', 'dribbble.com', 'behance.net'] as const;

const AUDIO_DOMAINS = [
  'spotify.com',
  'soundcloud.com',
  'bandcamp.com',
] as const;

const READING_DOMAINS = [
  'wikipedia.org',
  'medium.com',
  'substack.com',
  'arxiv.org',
  'docs.google.com',
] as const;

const SHOPPING_DOMAINS = ['ebay.com', 'etsy.com', 'shopify.com'] as const;

/**
 * Pure domain/path matcher returning a monochrome Lucide icon key when a site's
 * favicon is missing or fails to load.
 */
export function matchFallbackLinkIcon(url: string): FallbackLinkIconKey {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.toLowerCase();

    if (pathname.endsWith('.pdf')) {
      return 'file-text';
    }
    if (hostMatches(host, CODE_DOMAINS)) {
      return 'code';
    }
    if (hostMatches(host, VIDEO_DOMAINS)) {
      return 'play-circle';
    }
    if (hostMatches(host, DISCUSSION_DOMAINS)) {
      return 'message-square';
    }
    if (hostMatches(host, SOCIAL_DOMAINS)) {
      return 'at-sign';
    }
    if (hostMatches(host, DESIGN_DOMAINS)) {
      return 'palette';
    }
    if (hostMatches(host, AUDIO_DOMAINS)) {
      return 'music';
    }
    if (hostMatches(host, READING_DOMAINS)) {
      return 'book-open';
    }
    if (
      host === 'amazon.com' ||
      host.startsWith('amazon.') ||
      host.includes('.amazon.') ||
      hostMatches(host, SHOPPING_DOMAINS)
    ) {
      return 'shopping-bag';
    }
    return 'globe';
  } catch {
    return 'globe';
  }
}
