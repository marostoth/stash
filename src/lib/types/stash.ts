export type TabGroupColor =
  | 'grey'
  | 'blue'
  | 'red'
  | 'yellow'
  | 'green'
  | 'pink'
  | 'purple'
  | 'cyan'
  | 'orange';

export const TAB_GROUP_COLORS: readonly TabGroupColor[] = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
] as const;

export const TAB_GROUP_COLOR_SWATCH: Record<TabGroupColor, string> = {
  grey: '#94A3B8',
  blue: '#60A5FA',
  red: '#F87171',
  yellow: '#FACC15',
  green: '#34D399',
  pink: '#F472B6',
  purple: '#C084FC',
  cyan: '#22D3EE',
  orange: '#FB923C',
};

export type CollectionViewMode = 'compact' | 'cover';
export type SpaceViewMode = 'grid' | 'details';
export type SpaceGroupBy = 'collection' | 'store';
export type ProductMetaSource = 'extracted' | 'ai' | 'manual';

export const DEFAULT_SPACE_ID = 'space-main';

export interface Space {
  id: string;
  name: string;
  icon?: string;
  order: number;
  densityOverride?: CardDensity;
  viewMode?: SpaceViewMode;
  groupBy?: SpaceGroupBy;
  createdAt: string;
  updatedAt: string;
}

export interface ProductMeta {
  store?: string;
  price?: number;
  currency?: string;
  priceIsEstimate?: boolean;
  spec?: string;
  orderQty?: number;
  source: ProductMetaSource;
  capturedAt?: string;
}

export function createDefaultSpace(
  timestamp: string = new Date().toISOString(),
): Space {
  return {
    id: DEFAULT_SPACE_ID,
    name: 'Main',
    icon: 'layers',
    order: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color: TabGroupColor;
  tintColor?: string;
  icon?: string;
  viewMode?: CollectionViewMode;
  spaceId?: string;
  order: number;
  collapsed: boolean;
  isSession?: boolean;
  isAutoInbox?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LinkItem {
  id: string;
  collectionId: string;
  url: string;
  title: string;
  note: string;
  tags: string[];
  tagsLocked?: boolean;
  starred?: boolean;
  product?: ProductMeta;
  faviconUrl?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
}

export interface CategorizationRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  match: {
    domainContains?: string[];
    titleKeywords?: string[];
    urlContains?: string[];
  };
  action: {
    targetCollectionId: string;
    addTags?: string[];
  };
}

export type MotionMode = 'arcade' | 'tactile' | 'reduced' | 'off';
export type DropEffectStyle = 'dust' | 'accent';
export type SoundPack =
  | 'arpg-heavy'
  | 'studio-desk'
  | 'mechanical-thock'
  | 'retro-synth'
  | 'glass-ceramic';
export type CardDensity = 'micro' | 'compact' | 'comfortable';
export type BoardWidthMode = 'standard' | 'wide';
export type CardRadiusPreset = 'sharp' | 'standard' | 'rounded';
export type BackdropStyle =
  | 'flat'
  | 'dot-matrix'
  | 'grid'
  | 'ambient-glow'
  | 'vignette'
  | 'mesh-glow'
  | 'noise-grain';
export type BackdropOverride = 'theme' | BackdropStyle;

export interface StashSettings {
  activeThemeId: string;
  backdropOverride: BackdropOverride;
  wallpaperEnabled: boolean;
  wallpaperDim: number;
  wallpaperBlur: number;
  openLinkInNewTab: boolean;
  includePinnedInSessions: boolean;
  closeTabOnQuickStash: boolean;
  openTabsSidebarVisible: boolean;
  enableOnDeviceAi: boolean;
  autoTagOnSave: boolean;
  motionMode: MotionMode;
  dropEffectStyle: DropEffectStyle;
  fxDeskJolt: boolean;
  fxDragTilt: boolean;
  fxHoverSheen: boolean;
  fxAmbientWaves: boolean;
  soundEffects: boolean;
  soundVolume: number;
  soundPack: SoundPack;
  hoverPreviews: boolean;
  visualPreviewsEnabled: boolean;
  density: CardDensity;
  boardWidth: BoardWidthMode;
  defaultCurrency?: string;
  lastBackupAt?: string;
  customThemes?: ThemeDefinition[];
}

export type ThemeMode = 'dark' | 'light';

export interface CoreThemeColors {
  canvas: string;
  surface: string;
  accent: string;
  text: string;
  border: string;
}

export interface ThemeColors {
  canvas: string;
  panel: string;
  card: string;
  cardHover: string;
  border: string;
  accent: string;
  accentFg: string;
  text: string;
  textMuted: string;
  danger: string;
}

export interface ThemeRadius {
  card: string;
  control: string;
  pill: string;
}

export interface ThemeFonts {
  sans: string;
  mono: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  isBuiltIn: boolean;
  mode: ThemeMode;
  colors: ThemeColors;
  radius: ThemeRadius;
  fonts: ThemeFonts;
  cardRadius?: CardRadiusPreset;
  backdropStyle?: BackdropStyle;
}

export interface StashExportBundle {
  app: 'stash';
  schemaVersion: 1;
  exportedAt: string;
  spaces?: Space[];
  collections: Collection[];
  links: LinkItem[];
  rules: CategorizationRule[];
  settings: StashSettings;
  customThemes: ThemeDefinition[];
}

export const DEFAULT_SETTINGS: StashSettings = {
  activeThemeId: 'oscilloscope',
  backdropOverride: 'theme',
  wallpaperEnabled: false,
  wallpaperDim: 45,
  wallpaperBlur: 4,
  openLinkInNewTab: true,
  includePinnedInSessions: false,
  closeTabOnQuickStash: false,
  openTabsSidebarVisible: true,
  enableOnDeviceAi: true,
  autoTagOnSave: true,
  motionMode: 'tactile',
  dropEffectStyle: 'dust',
  fxDeskJolt: true,
  fxDragTilt: true,
  fxHoverSheen: true,
  fxAmbientWaves: true,
  soundEffects: true,
  soundVolume: 75,
  soundPack: 'studio-desk',
  hoverPreviews: true,
  visualPreviewsEnabled: false,
  density: 'comfortable',
  boardWidth: 'standard',
  defaultCurrency: 'GBP',
  customThemes: [],
};
