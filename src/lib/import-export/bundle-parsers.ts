import { normalizeHexColor } from '@/lib/themes/contrast';
import { VALID_BACKDROP_STYLE_SET } from '@/lib/themes/presets';
import {
  type BackdropOverride,
  type CardDensity,
  type CategorizationRule,
  type Collection,
  type CollectionSortMode,
  DEFAULT_SETTINGS,
  type LinkItem,
  type ProductMeta,
  type ProductMetaSource,
  type Space,
  type StashSettings,
  TAB_GROUP_COLORS,
  type TabGroupColor,
} from '@/lib/types/stash';
import { normalizeTags } from '@/lib/utils/url';

const VALID_COLORS = new Set<string>(TAB_GROUP_COLORS);

function parseDensity(raw: unknown): CardDensity | undefined {
  if (raw === 'micro' || raw === 'compact' || raw === 'comfortable') {
    return raw;
  }
  return undefined;
}

function parseProductMeta(raw: unknown): ProductMeta | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;

  const store =
    typeof obj.store === 'string' && obj.store.trim()
      ? obj.store.trim()
      : undefined;
  const spec =
    typeof obj.spec === 'string' && obj.spec.trim()
      ? obj.spec.trim()
      : undefined;
  const price =
    typeof obj.price === 'number' &&
    Number.isFinite(obj.price) &&
    obj.price >= 0
      ? Math.round(obj.price * 100) / 100
      : undefined;
  const previousPrice =
    typeof obj.previousPrice === 'number' &&
    Number.isFinite(obj.previousPrice) &&
    obj.previousPrice >= 0
      ? Math.round(obj.previousPrice * 100) / 100
      : undefined;
  const currency =
    typeof obj.currency === 'string' &&
    /^[a-zA-Z]{3}$/.test(obj.currency.trim())
      ? obj.currency.trim().toUpperCase()
      : undefined;
  const orderQty =
    typeof obj.orderQty === 'number' &&
    Number.isFinite(obj.orderQty) &&
    obj.orderQty >= 1
      ? Math.floor(obj.orderQty)
      : undefined;
  const priceIsEstimate = obj.priceIsEstimate === true ? true : undefined;
  const source: ProductMetaSource =
    obj.source === 'extracted' || obj.source === 'ai' || obj.source === 'manual'
      ? obj.source
      : 'manual';
  const capturedAt =
    typeof obj.capturedAt === 'string' && obj.capturedAt.trim()
      ? obj.capturedAt.trim()
      : undefined;

  if (
    store === undefined &&
    spec === undefined &&
    price === undefined &&
    orderQty === undefined
  ) {
    return undefined;
  }

  return {
    ...(store !== undefined ? { store } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(previousPrice !== undefined ? { previousPrice } : {}),
    ...(currency !== undefined ? { currency } : {}),
    ...(priceIsEstimate ? { priceIsEstimate: true } : {}),
    ...(spec !== undefined ? { spec } : {}),
    ...(orderQty !== undefined ? { orderQty } : {}),
    source,
    ...(capturedAt !== undefined ? { capturedAt } : {}),
  };
}

export function parseSpace(raw: unknown, fallbackOrder: number): Space | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id.trim()) return null;
  if (typeof obj.name !== 'string' || !obj.name.trim()) return null;

  const now = new Date().toISOString();
  const viewMode =
    obj.viewMode === 'grid' || obj.viewMode === 'details'
      ? obj.viewMode
      : undefined;
  const groupBy =
    obj.groupBy === 'collection' || obj.groupBy === 'store'
      ? obj.groupBy
      : undefined;

  return {
    id: obj.id.trim(),
    name: obj.name.trim(),
    icon:
      typeof obj.icon === 'string' && obj.icon.trim()
        ? obj.icon.trim()
        : undefined,
    order: typeof obj.order === 'number' ? obj.order : fallbackOrder,
    densityOverride: parseDensity(obj.densityOverride),
    ...(viewMode ? { viewMode } : {}),
    ...(groupBy ? { groupBy } : {}),
    ...(obj.hideChecked === true ? { hideChecked: true } : {}),
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : now,
  };
}

export function parseCollection(
  raw: unknown,
  fallbackOrder: number,
): Collection | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id.trim()) return null;
  if (typeof obj.name !== 'string' || !obj.name.trim()) return null;

  const now = new Date().toISOString();
  const color: TabGroupColor =
    typeof obj.color === 'string' && VALID_COLORS.has(obj.color)
      ? (obj.color as TabGroupColor)
      : 'green';

  const tintColor = normalizeHexColor(obj.tintColor) ?? undefined;
  const viewMode =
    obj.viewMode === 'compact' || obj.viewMode === 'cover'
      ? obj.viewMode
      : undefined;
  const sortMode: CollectionSortMode | undefined =
    obj.sortMode === 'title-asc' ||
    obj.sortMode === 'newest' ||
    obj.sortMode === 'last-opened' ||
    obj.sortMode === 'price-asc' ||
    obj.sortMode === 'price-desc'
      ? obj.sortMode
      : undefined;

  return {
    id: obj.id.trim(),
    name: obj.name.trim(),
    description:
      typeof obj.description === 'string' && obj.description.trim()
        ? obj.description.trim()
        : undefined,
    color,
    tintColor,
    icon:
      typeof obj.icon === 'string' && obj.icon.trim()
        ? obj.icon.trim()
        : undefined,
    viewMode,
    ...(sortMode ? { sortMode } : {}),
    spaceId:
      typeof obj.spaceId === 'string' && obj.spaceId.trim()
        ? obj.spaceId.trim()
        : undefined,
    order: typeof obj.order === 'number' ? obj.order : fallbackOrder,
    collapsed: Boolean(obj.collapsed),
    isSession: obj.isSession === true ? true : undefined,
    isAutoInbox: obj.isAutoInbox === true ? true : undefined,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : now,
  };
}

export function parseLink(
  raw: unknown,
  fallbackOrder: number,
): LinkItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id.trim()) return null;
  if (typeof obj.collectionId !== 'string' || !obj.collectionId.trim()) {
    return null;
  }
  if (typeof obj.url !== 'string' || !obj.url.trim()) return null;

  const now = new Date().toISOString();
  const rawTags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === 'string')
    : [];

  return {
    id: obj.id.trim(),
    collectionId: obj.collectionId.trim(),
    url: obj.url.trim(),
    title:
      typeof obj.title === 'string' && obj.title.trim()
        ? obj.title.trim()
        : obj.url.trim(),
    note: typeof obj.note === 'string' ? obj.note : '',
    tags: normalizeTags(rawTags),
    tagsLocked: obj.tagsLocked === true ? true : undefined,
    starred: obj.starred === true ? true : undefined,
    checked: obj.checked === true ? true : undefined,
    pinnedToDock: obj.pinnedToDock === true ? true : undefined,
    product: parseProductMeta(obj.product),
    faviconUrl:
      typeof obj.faviconUrl === 'string' && obj.faviconUrl.trim()
        ? obj.faviconUrl.trim()
        : undefined,
    order: typeof obj.order === 'number' ? obj.order : fallbackOrder,
    createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : now,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : now,
    lastOpenedAt:
      typeof obj.lastOpenedAt === 'string' ? obj.lastOpenedAt : undefined,
  };
}

export function parseRule(
  raw: unknown,
  fallbackPriority: number,
): CategorizationRule | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id.trim()) return null;
  if (!obj.match || typeof obj.match !== 'object') return null;
  if (!obj.action || typeof obj.action !== 'object') return null;

  const matchObj = obj.match as Record<string, unknown>;
  const actionObj = obj.action as Record<string, unknown>;
  if (
    typeof actionObj.targetCollectionId !== 'string' ||
    !actionObj.targetCollectionId.trim()
  ) {
    return null;
  }

  const readStringArray = (val: unknown): string[] | undefined => {
    if (!Array.isArray(val)) return undefined;
    const cleaned = val
      .filter((item): item is string => typeof item === 'string')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  };

  return {
    id: obj.id.trim(),
    name:
      typeof obj.name === 'string' && obj.name.trim()
        ? obj.name.trim()
        : 'Imported Rule',
    enabled: obj.enabled !== false,
    priority:
      typeof obj.priority === 'number' ? obj.priority : fallbackPriority,
    match: {
      domainContains: readStringArray(matchObj.domainContains),
      titleKeywords: readStringArray(matchObj.titleKeywords),
      urlContains: readStringArray(matchObj.urlContains),
    },
    action: {
      targetCollectionId: actionObj.targetCollectionId.trim(),
      addTags: readStringArray(actionObj.addTags),
    },
  };
}

export function parseSettings(raw: unknown): StashSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_SETTINGS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    activeThemeId:
      typeof obj.activeThemeId === 'string' && obj.activeThemeId.trim()
        ? obj.activeThemeId.trim()
        : DEFAULT_SETTINGS.activeThemeId,
    backdropOverride:
      obj.backdropOverride === 'theme' ||
      (typeof obj.backdropOverride === 'string' &&
        VALID_BACKDROP_STYLE_SET.has(obj.backdropOverride))
        ? (obj.backdropOverride as BackdropOverride)
        : DEFAULT_SETTINGS.backdropOverride,
    wallpaperEnabled:
      typeof obj.wallpaperEnabled === 'boolean'
        ? obj.wallpaperEnabled
        : DEFAULT_SETTINGS.wallpaperEnabled,
    wallpaperDim:
      typeof obj.wallpaperDim === 'number' && Number.isFinite(obj.wallpaperDim)
        ? Math.max(0, Math.min(85, Math.round(obj.wallpaperDim)))
        : DEFAULT_SETTINGS.wallpaperDim,
    wallpaperBlur:
      typeof obj.wallpaperBlur === 'number' &&
      Number.isFinite(obj.wallpaperBlur)
        ? Math.max(0, Math.min(24, Math.round(obj.wallpaperBlur)))
        : DEFAULT_SETTINGS.wallpaperBlur,
    openLinkInNewTab:
      typeof obj.openLinkInNewTab === 'boolean'
        ? obj.openLinkInNewTab
        : DEFAULT_SETTINGS.openLinkInNewTab,
    includePinnedInSessions:
      typeof obj.includePinnedInSessions === 'boolean'
        ? obj.includePinnedInSessions
        : DEFAULT_SETTINGS.includePinnedInSessions,
    closeTabOnQuickStash:
      typeof obj.closeTabOnQuickStash === 'boolean'
        ? obj.closeTabOnQuickStash
        : DEFAULT_SETTINGS.closeTabOnQuickStash,
    openTabsSidebarVisible:
      typeof obj.openTabsSidebarVisible === 'boolean'
        ? obj.openTabsSidebarVisible
        : DEFAULT_SETTINGS.openTabsSidebarVisible,
    quickLaunchVisible:
      typeof obj.quickLaunchVisible === 'boolean'
        ? obj.quickLaunchVisible
        : DEFAULT_SETTINGS.quickLaunchVisible,
    enableOnDeviceAi:
      typeof obj.enableOnDeviceAi === 'boolean'
        ? obj.enableOnDeviceAi
        : DEFAULT_SETTINGS.enableOnDeviceAi,
    autoTagOnSave:
      typeof obj.autoTagOnSave === 'boolean'
        ? obj.autoTagOnSave
        : DEFAULT_SETTINGS.autoTagOnSave,
    motionMode:
      obj.motionMode === 'arcade' ||
      obj.motionMode === 'tactile' ||
      obj.motionMode === 'reduced' ||
      obj.motionMode === 'off'
        ? obj.motionMode
        : DEFAULT_SETTINGS.motionMode,
    dropEffectStyle:
      obj.dropEffectStyle === 'dust' || obj.dropEffectStyle === 'accent'
        ? obj.dropEffectStyle
        : DEFAULT_SETTINGS.dropEffectStyle,
    fxDeskJolt:
      typeof obj.fxDeskJolt === 'boolean'
        ? obj.fxDeskJolt
        : DEFAULT_SETTINGS.fxDeskJolt,
    fxDragTilt:
      typeof obj.fxDragTilt === 'boolean'
        ? obj.fxDragTilt
        : DEFAULT_SETTINGS.fxDragTilt,
    fxHoverSheen:
      typeof obj.fxHoverSheen === 'boolean'
        ? obj.fxHoverSheen
        : DEFAULT_SETTINGS.fxHoverSheen,
    fxAmbientWaves:
      typeof obj.fxAmbientWaves === 'boolean'
        ? obj.fxAmbientWaves
        : DEFAULT_SETTINGS.fxAmbientWaves,
    soundEffects:
      typeof obj.soundEffects === 'boolean'
        ? obj.soundEffects
        : DEFAULT_SETTINGS.soundEffects,
    soundVolume:
      typeof obj.soundVolume === 'number' && Number.isFinite(obj.soundVolume)
        ? Math.max(0, Math.min(100, Math.round(obj.soundVolume)))
        : DEFAULT_SETTINGS.soundVolume,
    soundPack:
      obj.soundPack === 'arpg-heavy' ||
      obj.soundPack === 'studio-desk' ||
      obj.soundPack === 'mechanical-thock' ||
      obj.soundPack === 'retro-synth' ||
      obj.soundPack === 'glass-ceramic'
        ? obj.soundPack
        : DEFAULT_SETTINGS.soundPack,
    customSoundsEnabled:
      typeof obj.customSoundsEnabled === 'boolean'
        ? obj.customSoundsEnabled
        : DEFAULT_SETTINGS.customSoundsEnabled,
    hoverPreviews:
      typeof obj.hoverPreviews === 'boolean'
        ? obj.hoverPreviews
        : DEFAULT_SETTINGS.hoverPreviews,
    visualPreviewsEnabled:
      typeof obj.visualPreviewsEnabled === 'boolean'
        ? obj.visualPreviewsEnabled
        : DEFAULT_SETTINGS.visualPreviewsEnabled,
    density:
      obj.density === 'micro' ||
      obj.density === 'compact' ||
      obj.density === 'comfortable'
        ? obj.density
        : DEFAULT_SETTINGS.density,
    boardWidth:
      obj.boardWidth === 'standard' || obj.boardWidth === 'wide'
        ? obj.boardWidth
        : DEFAULT_SETTINGS.boardWidth,
    defaultCurrency:
      typeof obj.defaultCurrency === 'string' &&
      /^[a-zA-Z]{3}$/.test(obj.defaultCurrency.trim())
        ? obj.defaultCurrency.trim().toUpperCase()
        : DEFAULT_SETTINGS.defaultCurrency,
    lastBackupAt:
      typeof obj.lastBackupAt === 'string' && obj.lastBackupAt.trim()
        ? obj.lastBackupAt.trim()
        : undefined,
    customThemes: [],
  };
}
