import { normalizeHexColor } from '@/lib/themes/contrast';
import { VALID_BACKDROP_STYLE_SET } from '@/lib/themes/presets';
import {
  type BackdropOverride,
  type CardDensity,
  type CategorizationRule,
  type Collection,
  DEFAULT_SETTINGS,
  type LinkItem,
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

export function parseSpace(raw: unknown, fallbackOrder: number): Space | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id.trim()) return null;
  if (typeof obj.name !== 'string' || !obj.name.trim()) return null;

  const now = new Date().toISOString();
  return {
    id: obj.id.trim(),
    name: obj.name.trim(),
    icon:
      typeof obj.icon === 'string' && obj.icon.trim()
        ? obj.icon.trim()
        : undefined,
    order: typeof obj.order === 'number' ? obj.order : fallbackOrder,
    densityOverride: parseDensity(obj.densityOverride),
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
    spaceId:
      typeof obj.spaceId === 'string' && obj.spaceId.trim()
        ? obj.spaceId.trim()
        : undefined,
    order: typeof obj.order === 'number' ? obj.order : fallbackOrder,
    collapsed: Boolean(obj.collapsed),
    isSession: obj.isSession === true ? true : undefined,
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
    soundEffects:
      typeof obj.soundEffects === 'boolean'
        ? obj.soundEffects
        : DEFAULT_SETTINGS.soundEffects,
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
    lastBackupAt:
      typeof obj.lastBackupAt === 'string' && obj.lastBackupAt.trim()
        ? obj.lastBackupAt.trim()
        : undefined,
    customThemes: [],
  };
}
