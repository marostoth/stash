import type { ImportedBookmarkFolder } from '@/lib/import-export/bookmarks-html';
import type { RestoreStats } from '@/lib/import-export/bundle';
import type { LibraryBoardState } from '@/lib/reorganize/plan';
import {
  type BookmarkImportSummary,
  deleteCollectionInStorage,
  deleteCustomThemeInStorage,
  deleteLinkInStorage,
  deleteLinksInStorage,
  importBookmarkFoldersInStorage,
  restoreBundleInStorage,
  restoreLinkInStorage,
  restoreLinksInStorage,
  saveCustomThemeInStorage,
  saveSessionCollectionInStorage,
} from '@/lib/storage/backup-ops';
import {
  collectionsStorage,
  customThemesStorage,
  linksStorage,
  settingsStorage,
} from '@/lib/storage/items';
import {
  addLinkInStorage,
  applyAutoTagsInStorage,
  findDuplicateLinkInList,
  markLinkOpenedInStorage,
  moveOrReorderLinkInStorage,
  setLinksStarredInStorage,
  updateLinkInStorage,
} from '@/lib/storage/links-ops';
import {
  applyReorganizationInStorage,
  restoreLibrarySnapshotInStorage,
} from '@/lib/storage/reorganize-ops';
import {
  type AddLinkInput,
  type AddLinkResult,
  buildStarterCollections,
  type CreateCollectionInput,
  type CreateSpaceInput,
  type DeleteSpaceResult,
  type MoveLinkResult,
  type SaveSessionResult,
  type StashSnapshot,
  type UpdateCollectionInput,
  type UpdateLinkInput,
  type UpdateLinkResult,
  type UpdateSpaceInput,
} from '@/lib/storage/repo-types';
import {
  type CreateRuleInput,
  createRuleInStorage,
  deleteRuleInStorage,
  getSortedRules,
  moveRulePriorityInStorage,
  type UpdateRuleInput,
  updateRuleInStorage,
  watchSortedRules,
} from '@/lib/storage/rules-ops';
import {
  createSpaceInStorage,
  deleteSpaceInStorage,
  getActiveSpaceIdFromStorage,
  getSpacesFromStorage,
  moveCollectionToSpaceInStorage,
  normalizeCollectionsSpaceIds,
  setActiveSpaceIdInStorage,
  updateSpaceInStorage,
  watchSpacesInStorage,
} from '@/lib/storage/spaces-ops';
import type { OpenTabInfo } from '@/lib/tabs/session-filter';
import {
  type CategorizationRule,
  type Collection,
  DEFAULT_SETTINGS,
  DEFAULT_SPACE_ID,
  type LinkItem,
  type Space,
  type StashExportBundle,
  type StashSettings,
  type ThemeDefinition,
} from '@/lib/types/stash';
import { reorderCollectionsList, sortByOrder } from '@/lib/utils/ordering';

export type * from '@/lib/storage/repo-types';

function nowIso(): string {
  return new Date().toISOString();
}

export const stashRepo = {
  async getSnapshot(): Promise<StashSnapshot> {
    const [spaces, rawCollections, links, rules, settings, customThemes] =
      await Promise.all([
        this.getSpaces(),
        collectionsStorage.getValue(),
        this.getLinks(),
        this.getRules(),
        this.getSettings(),
        this.getCustomThemes(),
      ]);
    const collections = normalizeCollectionsSpaceIds(rawCollections, spaces);
    return { spaces, collections, links, rules, settings, customThemes };
  },

  getSpaces: (): Promise<Space[]> => getSpacesFromStorage(),
  watchSpaces: (cb: (spaces: Space[]) => void): (() => void) =>
    watchSpacesInStorage(cb),
  getActiveSpaceId: (): Promise<string> => getActiveSpaceIdFromStorage(),
  setActiveSpaceId: (spaceId: string): Promise<void> =>
    setActiveSpaceIdInStorage(spaceId),
  createSpace: (input: CreateSpaceInput): Promise<Space> =>
    createSpaceInStorage(input),
  updateSpace: (id: string, patch: UpdateSpaceInput): Promise<Space | null> =>
    updateSpaceInStorage(id, patch),
  deleteSpace: (id: string): Promise<DeleteSpaceResult> =>
    deleteSpaceInStorage(id),
  moveCollectionToSpace: (
    collectionId: string,
    targetSpaceId: string,
  ): Promise<Collection | null> =>
    moveCollectionToSpaceInStorage(collectionId, targetSpaceId),

  async getCollections(): Promise<Collection[]> {
    const [spaces, raw] = await Promise.all([
      getSpacesFromStorage(),
      collectionsStorage.getValue(),
    ]);
    return normalizeCollectionsSpaceIds(raw, spaces);
  },

  watchCollections(cb: (collections: Collection[]) => void): () => void {
    return collectionsStorage.watch((next) => {
      void getSpacesFromStorage().then((spaces) =>
        cb(normalizeCollectionsSpaceIds(next, spaces)),
      );
    });
  },

  async createCollection(input: CreateCollectionInput): Promise<Collection> {
    const [spaces, existing] = await Promise.all([
      getSpacesFromStorage(),
      collectionsStorage.getValue(),
    ]);
    const fallbackSpaceId = spaces[0]?.id ?? DEFAULT_SPACE_ID;
    const resolvedSpaceId =
      input.spaceId && spaces.some((s) => s.id === input.spaceId)
        ? input.spaceId
        : fallbackSpaceId;
    const maxOrder = existing.reduce(
      (max, item) => Math.max(max, item.order),
      -1,
    );
    const timestamp = nowIso();
    const created: Collection = {
      id: crypto.randomUUID(),
      name: input.name.trim() || 'Untitled Collection',
      description: input.description?.trim() || undefined,
      color: input.color ?? 'green',
      tintColor: input.tintColor?.trim() || undefined,
      icon: input.icon?.trim() || undefined,
      viewMode: input.viewMode,
      spaceId: resolvedSpaceId,
      order: maxOrder + 1,
      collapsed: false,
      isSession: input.isSession,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await collectionsStorage.setValue([...existing, created]);
    return created;
  },

  async updateCollection(
    id: string,
    patch: UpdateCollectionInput,
  ): Promise<Collection | null> {
    const existing = await collectionsStorage.getValue();
    let updated: Collection | null = null;
    const next = existing.map((item) => {
      if (item.id !== id) return item;
      updated = {
        ...item,
        ...(patch.name !== undefined
          ? { name: patch.name.trim() || item.name }
          : {}),
        ...(patch.description !== undefined
          ? { description: patch.description.trim() || undefined }
          : {}),
        ...(patch.color !== undefined ? { color: patch.color } : {}),
        ...(patch.tintColor !== undefined
          ? { tintColor: patch.tintColor?.trim() || undefined }
          : {}),
        ...(patch.icon !== undefined
          ? { icon: patch.icon?.trim() || undefined }
          : {}),
        ...(patch.viewMode !== undefined ? { viewMode: patch.viewMode } : {}),
        ...(patch.spaceId !== undefined ? { spaceId: patch.spaceId } : {}),
        ...(patch.collapsed !== undefined
          ? { collapsed: patch.collapsed }
          : {}),
        ...(patch.order !== undefined ? { order: patch.order } : {}),
        updatedAt: nowIso(),
      };
      return updated;
    });

    if (!updated) return null;
    await collectionsStorage.setValue(next);
    return updated;
  },

  async reorderCollections(
    sourceId: string,
    targetIndex: number,
  ): Promise<Collection[]> {
    const existing = await collectionsStorage.getValue();
    const next = reorderCollectionsList(
      existing,
      sourceId,
      targetIndex,
      nowIso(),
    );
    await collectionsStorage.setValue(next);
    return next;
  },

  async toggleCollectionCollapsed(id: string): Promise<Collection | null> {
    const existing = await collectionsStorage.getValue();
    const target = existing.find((item) => item.id === id);
    if (!target) return null;
    return this.updateCollection(id, { collapsed: !target.collapsed });
  },

  deleteCollection: (id: string): Promise<boolean> =>
    deleteCollectionInStorage(id),

  async seedStarterCollections(): Promise<Collection[]> {
    const existing = await collectionsStorage.getValue();
    if (existing.length > 0) return sortByOrder(existing);

    const starters = buildStarterCollections(nowIso());
    await collectionsStorage.setValue(starters);
    return starters;
  },

  saveSessionCollection(
    tabs: readonly OpenTabInfo[],
    options: {
      includePinned: boolean;
      name?: string;
      date?: Date;
      spaceId?: string;
    },
  ): Promise<SaveSessionResult | null> {
    return saveSessionCollectionInStorage(tabs, options);
  },

  async getLinks(): Promise<LinkItem[]> {
    return sortByOrder(await linksStorage.getValue());
  },

  watchLinks(cb: (links: LinkItem[]) => void): () => void {
    return linksStorage.watch((next) => cb(sortByOrder(next)));
  },

  findDuplicateInList: (
    links: readonly LinkItem[],
    collectionId: string,
    url: string,
    excludeLinkId?: string,
  ): LinkItem | undefined =>
    findDuplicateLinkInList(links, collectionId, url, excludeLinkId),

  addLink: (
    input: AddLinkInput,
    targetIndex?: number,
  ): Promise<AddLinkResult> => addLinkInStorage(input, targetIndex),

  updateLink: (id: string, patch: UpdateLinkInput): Promise<UpdateLinkResult> =>
    updateLinkInStorage(id, patch),

  applyAutoTagsIfEligible: (
    id: string,
    tags: readonly string[],
  ): Promise<LinkItem | null> => applyAutoTagsInStorage(id, tags),

  moveOrReorderLink: (
    linkId: string,
    targetCollectionId: string,
    targetIndex?: number,
  ): Promise<MoveLinkResult> =>
    moveOrReorderLinkInStorage(linkId, targetCollectionId, targetIndex),

  markLinkOpened: (id: string): Promise<void> => markLinkOpenedInStorage(id),

  setLinksStarred: (
    ids: readonly string[],
    starred: boolean,
  ): Promise<string[]> => setLinksStarredInStorage(ids, starred),

  deleteLink: (id: string): Promise<boolean> => deleteLinkInStorage(id),
  deleteLinks: (ids: readonly string[]): Promise<LinkItem[]> =>
    deleteLinksInStorage(ids),
  restoreLink: (link: LinkItem): Promise<LinkItem | null> =>
    restoreLinkInStorage(link),
  restoreLinks: (links: readonly LinkItem[]): Promise<LinkItem[]> =>
    restoreLinksInStorage(links),

  async getSettings(): Promise<StashSettings> {
    const stored = await settingsStorage.getValue();
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      customThemes: Array.isArray(stored.customThemes)
        ? stored.customThemes
        : [],
    };
  },

  watchSettings(cb: (settings: StashSettings) => void): () => void {
    return settingsStorage.watch((next) =>
      cb({
        ...DEFAULT_SETTINGS,
        ...next,
        customThemes: Array.isArray(next.customThemes) ? next.customThemes : [],
      }),
    );
  },

  async updateSettings(patch: Partial<StashSettings>): Promise<StashSettings> {
    const current = await this.getSettings();
    const updated: StashSettings = { ...current, ...patch };
    await settingsStorage.setValue(updated);
    return updated;
  },

  async getRules(): Promise<CategorizationRule[]> {
    return getSortedRules();
  },

  watchRules(cb: (rules: CategorizationRule[]) => void): () => void {
    return watchSortedRules(cb);
  },

  createRule(input: CreateRuleInput): Promise<CategorizationRule> {
    return createRuleInStorage(input);
  },

  updateRule(
    id: string,
    patch: UpdateRuleInput,
  ): Promise<CategorizationRule | null> {
    return updateRuleInStorage(id, patch);
  },

  deleteRule(id: string): Promise<boolean> {
    return deleteRuleInStorage(id);
  },

  moveRulePriority(
    id: string,
    direction: 'up' | 'down',
  ): Promise<CategorizationRule[]> {
    return moveRulePriorityInStorage(id, direction);
  },

  async getCustomThemes(): Promise<ThemeDefinition[]> {
    return customThemesStorage.getValue();
  },

  watchCustomThemes(cb: (themes: ThemeDefinition[]) => void): () => void {
    return customThemesStorage.watch(cb);
  },

  saveCustomTheme(theme: ThemeDefinition): Promise<ThemeDefinition> {
    return saveCustomThemeInStorage(theme);
  },

  async deleteCustomTheme(id: string): Promise<boolean> {
    const deleted = await deleteCustomThemeInStorage(id);
    if (deleted) {
      const settings = await this.getSettings();
      if (settings.activeThemeId === id) {
        await this.updateSettings({
          activeThemeId: DEFAULT_SETTINGS.activeThemeId,
        });
      }
    }
    return deleted;
  },

  async restoreBundle(
    bundle: StashExportBundle,
    mode: 'merge' | 'replace',
  ): Promise<RestoreStats> {
    const current = await this.getSnapshot();
    return restoreBundleInStorage(current, bundle, mode);
  },

  importBookmarkFolders: (
    folders: readonly ImportedBookmarkFolder[],
  ): Promise<BookmarkImportSummary> => importBookmarkFoldersInStorage(folders),
  applyReorganization: (
    nextState: LibraryBoardState,
  ): Promise<LibraryBoardState> => applyReorganizationInStorage(nextState),
  restoreLibrarySnapshot: (snapshot: LibraryBoardState): Promise<void> =>
    restoreLibrarySnapshotInStorage(snapshot),
};
