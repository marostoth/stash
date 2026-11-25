import {
  Bookmark,
  BookOpen,
  Code,
  Cpu,
  Flame,
  Folder,
  Globe,
  type LucideIcon,
  Music,
  Printer,
  Rocket,
  ShoppingBag,
  Sparkles,
  Star,
  Terminal,
  TrendingUp,
  Video,
  Wallet,
  Wrench,
} from 'lucide-react';

export interface CuratedCollectionIcon {
  key: string;
  label: string;
  Icon: LucideIcon;
}

export const CURATED_COLLECTION_ICONS: readonly CuratedCollectionIcon[] = [
  { key: 'folder', label: 'Folder', Icon: Folder },
  { key: 'trending-up', label: 'Trending', Icon: TrendingUp },
  { key: 'terminal', label: 'Terminal', Icon: Terminal },
  { key: 'cpu', label: 'Hardware', Icon: Cpu },
  { key: 'printer', label: '3D Print', Icon: Printer },
  { key: 'book-open', label: 'Reading', Icon: BookOpen },
  { key: 'sparkles', label: 'AI / Magic', Icon: Sparkles },
  { key: 'rocket', label: 'Launch', Icon: Rocket },
  { key: 'globe', label: 'Web', Icon: Globe },
  { key: 'code', label: 'Code', Icon: Code },
  { key: 'wrench', label: 'Tools', Icon: Wrench },
  { key: 'video', label: 'Video', Icon: Video },
  { key: 'music', label: 'Audio', Icon: Music },
  { key: 'shopping-bag', label: 'Shopping', Icon: ShoppingBag },
  { key: 'wallet', label: 'Finance', Icon: Wallet },
  { key: 'flame', label: 'Hot', Icon: Flame },
  { key: 'star', label: 'Favorites', Icon: Star },
  { key: 'bookmark', label: 'Saved', Icon: Bookmark },
] as const;

const ICON_BY_KEY = new Map<string, LucideIcon>(
  CURATED_COLLECTION_ICONS.map((entry) => [entry.key, entry.Icon]),
);

export function getCuratedCollectionIcon(
  key: string | undefined,
): LucideIcon | null {
  if (!key) return null;
  return ICON_BY_KEY.get(key) ?? null;
}

export interface CollectionTintSwatch {
  hex: string;
  label: string;
}

export const COLLECTION_TINT_SWATCHES: readonly CollectionTintSwatch[] = [
  { hex: '#00D68F', label: 'Mint' },
  { hex: '#22D3EE', label: 'Cyan' },
  { hex: '#3B82F6', label: 'Blue' },
  { hex: '#6366F1', label: 'Indigo' },
  { hex: '#A855F7', label: 'Purple' },
  { hex: '#EC4899', label: 'Pink' },
  { hex: '#F43F5E', label: 'Rose' },
  { hex: '#F97316', label: 'Orange' },
  { hex: '#F59E0B', label: 'Amber' },
  { hex: '#84CC16', label: 'Lime' },
] as const;
