import {
  Archive,
  BarChart2,
  Bookmark,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  Building,
  Calculator,
  Camera,
  Car,
  Code,
  Compass,
  Cpu,
  Database,
  Dumbbell,
  FileText,
  Film,
  Flame,
  Folder,
  Gamepad2,
  Globe,
  GraduationCap,
  Hammer,
  Headphones,
  Heart,
  Home,
  Layers,
  Lightbulb,
  type LucideIcon,
  MapPin,
  Music,
  Newspaper,
  Palette,
  Plane,
  Printer,
  Receipt,
  Rocket,
  Server,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Terminal,
  TrendingUp,
  Utensils,
  Video,
  Wallet,
  Wrench,
} from 'lucide-react';

export {
  type FallbackLinkIconKey,
  getFallbackLinkIcon,
  matchFallbackLinkIcon,
} from '@/lib/icons/fallback';

export interface CatalogIconEntry {
  key: string;
  label: string;
  keywords: readonly string[];
  Icon: LucideIcon;
}

/**
 * Curated whitelist of 48 everyday Lucide icons for collections and AI icon assignment.
 */
export const ICON_CATALOG: readonly CatalogIconEntry[] = [
  // Tech / Dev
  {
    key: 'terminal',
    label: 'Terminal',
    keywords: ['cli', 'shell', 'bash', 'dev', 'console', 'command'],
    Icon: Terminal,
  },
  {
    key: 'code',
    label: 'Code',
    keywords: [
      'programming',
      'dev',
      'github',
      'software',
      'web',
      'engineering',
    ],
    Icon: Code,
  },
  {
    key: 'cpu',
    label: 'Hardware',
    keywords: ['chip', 'electronics', 'computer', 'pc', 'embedded', 'tech'],
    Icon: Cpu,
  },
  {
    key: 'database',
    label: 'Database',
    keywords: ['sql', 'data', 'storage', 'backend', 'analytics'],
    Icon: Database,
  },
  {
    key: 'globe',
    label: 'Web',
    keywords: ['internet', 'world', 'browser', 'network', 'sites', 'links'],
    Icon: Globe,
  },
  {
    key: 'server',
    label: 'Server',
    keywords: ['cloud', 'infra', 'devops', 'hosting', 'selfhosted', 'homelab'],
    Icon: Server,
  },
  {
    key: 'bot',
    label: 'AI / Bot',
    keywords: ['ai', 'llm', 'automation', 'agent', 'ml', 'robot'],
    Icon: Bot,
  },
  {
    key: 'shield',
    label: 'Security',
    keywords: ['privacy', 'auth', 'cyber', 'safe', 'vpn', 'password'],
    Icon: Shield,
  },

  // Finance / Work
  {
    key: 'trending-up',
    label: 'Investing',
    keywords: ['stocks', 'trading', 'growth', 'markets', 'crypto', 'charts'],
    Icon: TrendingUp,
  },
  {
    key: 'wallet',
    label: 'Finance',
    keywords: ['money', 'banking', 'budget', 'payments', 'personal'],
    Icon: Wallet,
  },
  {
    key: 'briefcase',
    label: 'Work',
    keywords: ['career', 'job', 'office', 'business', 'client', 'project'],
    Icon: Briefcase,
  },
  {
    key: 'building',
    label: 'Company',
    keywords: ['enterprise', 'org', 'startup', 'real estate', 'corporate'],
    Icon: Building,
  },
  {
    key: 'calculator',
    label: 'Accounting',
    keywords: ['tax', 'math', 'numbers', 'budget', 'finance'],
    Icon: Calculator,
  },
  {
    key: 'bar-chart-2',
    label: 'Analytics',
    keywords: ['metrics', 'stats', 'dashboard', 'reports', 'data'],
    Icon: BarChart2,
  },
  {
    key: 'receipt',
    label: 'Bills',
    keywords: ['invoices', 'orders', 'expenses', 'taxes', 'shopping'],
    Icon: Receipt,
  },

  // Making / Hobbies
  {
    key: 'printer',
    label: '3D Print',
    keywords: ['3d', 'cad', 'stl', 'maker', 'fabrication', 'filament'],
    Icon: Printer,
  },
  {
    key: 'wrench',
    label: 'Tools',
    keywords: ['utilities', 'repair', 'fix', 'workshop', 'diy', 'settings'],
    Icon: Wrench,
  },
  {
    key: 'hammer',
    label: 'Making',
    keywords: ['build', 'woodworking', 'craft', 'diy', 'construction'],
    Icon: Hammer,
  },
  {
    key: 'camera',
    label: 'Photo',
    keywords: ['photography', 'images', 'pictures', 'lens', 'visual'],
    Icon: Camera,
  },
  {
    key: 'gamepad-2',
    label: 'Gaming',
    keywords: ['games', 'steam', 'esports', 'console', 'play', 'fun'],
    Icon: Gamepad2,
  },
  {
    key: 'music',
    label: 'Music',
    keywords: ['songs', 'synth', 'instruments', 'playlists', 'audio'],
    Icon: Music,
  },
  {
    key: 'headphones',
    label: 'Audio',
    keywords: ['podcasts', 'listening', 'sound', 'music', 'hi-fi'],
    Icon: Headphones,
  },
  {
    key: 'palette',
    label: 'Design',
    keywords: ['ui', 'ux', 'art', 'colors', 'graphics', 'icons', 'creative'],
    Icon: Palette,
  },
  {
    key: 'film',
    label: 'Movies',
    keywords: ['cinema', 'tv', 'shows', 'streaming', 'watch'],
    Icon: Film,
  },
  {
    key: 'video',
    label: 'Video',
    keywords: ['youtube', 'clips', 'editing', 'media', 'tutorials'],
    Icon: Video,
  },

  // Study / Reading
  {
    key: 'book-open',
    label: 'Reading',
    keywords: ['books', 'articles', 'docs', 'documentation', 'essays', 'wiki'],
    Icon: BookOpen,
  },
  {
    key: 'graduation-cap',
    label: 'Learning',
    keywords: ['courses', 'study', 'school', 'education', 'tutorials', 'uni'],
    Icon: GraduationCap,
  },
  {
    key: 'file-text',
    label: 'Docs',
    keywords: ['notes', 'pdf', 'papers', 'writing', 'documents', 'reference'],
    Icon: FileText,
  },
  {
    key: 'newspaper',
    label: 'News',
    keywords: ['press', 'media', 'blog', 'journalism', 'updates', 'feed'],
    Icon: Newspaper,
  },
  {
    key: 'lightbulb',
    label: 'Ideas',
    keywords: ['inspiration', 'brainstorm', 'concepts', 'tips', 'creative'],
    Icon: Lightbulb,
  },
  {
    key: 'brain',
    label: 'Knowledge',
    keywords: ['research', 'science', 'thinking', 'memory', 'ai', 'study'],
    Icon: Brain,
  },
  {
    key: 'bookmark',
    label: 'Saved',
    keywords: ['read later', 'bookmarks', 'queue', 'reference'],
    Icon: Bookmark,
  },

  // Life / Shopping
  {
    key: 'shopping-bag',
    label: 'Shopping',
    keywords: ['store', 'buy', 'wishlist', 'deals', 'gear', 'ecommerce'],
    Icon: ShoppingBag,
  },
  {
    key: 'home',
    label: 'Home',
    keywords: ['house', 'living', 'decor', 'family', 'personal', 'life'],
    Icon: Home,
  },
  {
    key: 'utensils',
    label: 'Food',
    keywords: ['cooking', 'recipes', 'restaurants', 'dining', 'kitchen'],
    Icon: Utensils,
  },
  {
    key: 'plane',
    label: 'Travel',
    keywords: ['trips', 'flights', 'vacation', 'hotels', 'places'],
    Icon: Plane,
  },
  {
    key: 'car',
    label: 'Auto',
    keywords: ['cars', 'vehicles', 'driving', 'transport', 'motor'],
    Icon: Car,
  },
  {
    key: 'heart',
    label: 'Health',
    keywords: ['wellness', 'favorites', 'medical', 'care', 'love'],
    Icon: Heart,
  },
  {
    key: 'dumbbell',
    label: 'Fitness',
    keywords: ['gym', 'workout', 'sports', 'exercise', 'training'],
    Icon: Dumbbell,
  },
  {
    key: 'map-pin',
    label: 'Places',
    keywords: ['maps', 'local', 'locations', 'travel', 'guides'],
    Icon: MapPin,
  },

  // General
  {
    key: 'folder',
    label: 'Folder',
    keywords: ['general', 'misc', 'collection', 'group', 'files'],
    Icon: Folder,
  },
  {
    key: 'star',
    label: 'Favorites',
    keywords: ['top', 'best', 'pinned', 'important', 'featured'],
    Icon: Star,
  },
  {
    key: 'flame',
    label: 'Hot',
    keywords: ['trending', 'popular', 'active', 'focus', 'urgent'],
    Icon: Flame,
  },
  {
    key: 'sparkles',
    label: 'Magic',
    keywords: ['ai', 'curated', 'shiny', 'special', 'inspiration'],
    Icon: Sparkles,
  },
  {
    key: 'rocket',
    label: 'Launch',
    keywords: ['startups', 'projects', 'ship', 'fast', 'space', 'goals'],
    Icon: Rocket,
  },
  {
    key: 'compass',
    label: 'Explore',
    keywords: ['discover', 'guides', 'navigation', 'browse'],
    Icon: Compass,
  },
  {
    key: 'archive',
    label: 'Archive',
    keywords: ['old', 'backup', 'history', 'storage', 'sessions'],
    Icon: Archive,
  },
  {
    key: 'layers',
    label: 'Stack',
    keywords: ['resources', 'components', 'design', 'architecture', 'tabs'],
    Icon: Layers,
  },
] as const;

export const CATALOG_ICON_KEYS: readonly string[] = ICON_CATALOG.map(
  (entry) => entry.key,
);

const CATALOG_ICON_MAP = new Map<string, LucideIcon>(
  ICON_CATALOG.map((entry) => [entry.key, entry.Icon]),
);

const CATALOG_KEY_SET = new Set<string>(CATALOG_ICON_KEYS);

export function isValidCatalogIcon(key: string): boolean {
  return CATALOG_KEY_SET.has(key);
}

export function getCatalogIcon(key: string | undefined): LucideIcon | null {
  if (!key) return null;
  return CATALOG_ICON_MAP.get(key) ?? null;
}

/**
 * Fast case-insensitive match against icon key, label, and keywords.
 */
export function filterIconCatalog(query: string): CatalogIconEntry[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [...ICON_CATALOG];
  }
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return ICON_CATALOG.filter((entry) => {
    const haystack = [
      entry.key,
      entry.label.toLowerCase(),
      ...entry.keywords,
    ].join(' ');
    return tokens.every((token) => haystack.includes(token));
  });
}
