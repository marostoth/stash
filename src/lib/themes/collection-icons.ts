export {
  type CatalogIconEntry as CuratedCollectionIcon,
  getCatalogIcon as getCuratedCollectionIcon,
  ICON_CATALOG as CURATED_COLLECTION_ICONS,
} from '@/lib/icons/catalog';

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
