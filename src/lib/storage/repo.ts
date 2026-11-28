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
  createCollectionInStorage,
  reorderCollectionsInStorage,
  seedStarterCollectionsInStorage,
  setCollectionsCollapsedInStorage,
  toggleCollectionCollapsedInStorage,
  updateCollectionInStorage,
} from '@/lib/storage/collections-ops';
import {
  collectionsStorage,
  customThemesStorage,
  linksStorage,
  settingsStorage,
} from '@/lib/storage/items';
import {
  addLinkInStorage,
  addTagsToLinksInStorage,
  applyAutoTagsInStorage,
  findDuplicateLinkInList,
  markLinkOpenedInStorage,
  moveLinksToCollectionInStorage,
  moveOrReorderLinkInStorage,
  setLinksCheckedInStorage,
  setLinksStarredInStorage,
  updateLinkInStorage,
} from '@/lib/storage/links-ops';
import {
  applyReorganizationInStorage,
  restoreLibrarySnapshotInStorage,
} from '@/lib/storage/reorganize-ops';
import type {
  AddLinkInput,
  AddLinkResult,
  CreateCollectionInput,
  CreateSpaceInput,
  DeleteSpaceResult,
  MoveLinkResult,
  SaveSessionResult,
  StashSnapshot,
  UpdateCollectionInput,
  UpdateLinkInput,
  UpdateLinkResult,
  UpdateSpaceInput,
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
  getOrCreateSpaceInboxInStorage,
  getSpacesFromStorage,
  moveCollectionToSpaceInStorage,
  normalizeCollectionsSpaceIds,
  setActiveSpaceIdInStorage,
  updateSpaceInStorage,
  watchSpacesInStorage,
} from '@/lib/storage/spaces-ops';
import { withStorageLock } from '@/lib/storage/storage-lock';
import {
  deleteTrashEntryInStorage,
  emptyTrashInStorage,
  getTrashEntriesInStorage,
  restoreTrashEntryInStorage,
  type TrashRestoreResult,
  watchTrashEntriesInStorage,
} from '@/lib/storage/trash-ops';
import type { OpenTabInfo } from '@/lib/tabs/session-filter';
import {
  type CategorizationRule,
  type Collection,
  DEFAULT_SETTINGS,
  type LinkItem,
  type Space,
  type StashExportBundle,
  type StashSettings,
  type ThemeDefinition,
  type TrashEntry,
} from '@/lib/types/stash';
import { sortByOrder } from '@/lib/utils/ordering';

export type * from '@/lib/storage/repo-types';

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
    withStorageLock(() => setActiveSpaceIdInStorage(spaceId)),
  createSpace: (input: CreateSpaceInput): Promise<Space> =>
    withStorageLock(() => createSpaceInStorage(input)),
  updateSpace: (id: string, patch: UpdateSpaceInput): Promise<Space | null> =>
    withStorageLock(() => updateSpaceInStorage(id, patch)),
  deleteSpace: (id: string): Promise<DeleteSpaceResult> =>
    withStorageLock(() => deleteSpaceInStorage(id)),
  moveCollectionToSpace: (
    collectionId: string,
    targetSpaceId: string,
  ): Promise<Collection | null> =>
    withStorageLock(() =>
      moveCollectionToSpaceInStorage(collectionId, targetSpaceId),
    ),
  getOrCreateSpaceInbox: (spaceId: string): Promise<Collection> =>
    withStorageLock(() => getOrCreateSpaceInboxInStorage(spaceId)),

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

  createCollection: (input: CreateCollectionInput): Promise<Collection> =>
    withStorageLock(() => createCollectionInStorage(input)),
  updateCollection: (
    id: string,
    patch: UpdateCollectionInput,
  ): Promise<Collection | null> =>
    withStorageLock(() => updateCollectionInStorage(id, patch)),
  reorderCollections: (
    sourceId: string,
    targetIndex: number,
    scopeSpaceId?: string,
  ): Promise<Collection[]> =>
    withStorageLock(() =>
      reorderCollectionsInStorage(sourceId, targetIndex, scopeSpaceId),
    ),
  toggleCollectionCollapsed: (id: string): Promise<Collection | null> =>
    withStorageLock(() => toggleCollectionCollapsedInStorage(id)),
  setCollectionsCollapsed: (
    ids: readonly string[],
    collapsed: boolean,
  ): Promise<number> =>
    withStorageLock(() => setCollectionsCollapsedInStorage(ids, collapsed)),
  deleteCollection: (id: string): Promise<boolean> =>
    withStorageLock(() => deleteCollectionInStorage(id)),
  seedStarterCollections: (): Promise<Collection[]> =>
    withStorageLock(() => seedStarterCollectionsInStorage()),
  saveSessionCollection: (
    tabs: readonly OpenTabInfo[],
    options: {
      includePinned: boolean;
      name?: string;
      date?: Date;
      spaceId?: string;
    },
  ): Promise<SaveSessionResult | null> =>
    withStorageLock(() => saveSessionCollectionInStorage(tabs, options)),

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
  ): Promise<AddLinkResult> =>
    withStorageLock(() => addLinkInStorage(input, targetIndex)),
  updateLink: (id: string, patch: UpdateLinkInput): Promise<UpdateLinkResult> =>
    withStorageLock(() => updateLinkInStorage(id, patch)),
  applyAutoTagsIfEligible: (
    id: string,
    tags: readonly string[],
  ): Promise<LinkItem | null> =>
    withStorageLock(() => applyAutoTagsInStorage(id, tags)),
  moveOrReorderLink: (
    linkId: string,
    targetCollectionId: string,
    targetIndex?: number,
  ): Promise<MoveLinkResult> =>
    withStorageLock(() =>
      moveOrReorderLinkInStorage(linkId, targetCollectionId, targetIndex),
    ),
  markLinkOpened: (id: string): Promise<void> =>
    withStorageLock(() => markLinkOpenedInStorage(id)),
  setLinksStarred: (
    ids: readonly string[],
    starred: boolean,
  ): Promise<string[]> =>
    withStorageLock(() => setLinksStarredInStorage(ids, starred)),
  setLinksChecked: (
    ids: readonly string[],
    checked: boolean,
  ): Promise<string[]> =>
    withStorageLock(() => setLinksCheckedInStorage(ids, checked)),
  moveLinksToCollection: (
    ids: readonly string[],
    targetCollectionId: string,
  ): Promise<{ movedCount: number; skippedDuplicates: number }> =>
    withStorageLock(() =>
      moveLinksToCollectionInStorage(ids, targetCollectionId),
    ),
  addTagsToLinks: (
    ids: readonly string[],
    tags: readonly string[],
  ): Promise<number> =>
    withStorageLock(() => addTagsToLinksInStorage(ids, tags)),
  deleteLink: (id: string): Promise<boolean> =>
    withStorageLock(() => deleteLinkInStorage(id)),
  deleteLinks: (ids: readonly string[]): Promise<LinkItem[]> =>
    withStorageLock(() => deleteLinksInStorage(ids)),
  restoreLink: (link: LinkItem): Promise<LinkItem | null> =>
    withStorageLock(() => restoreLinkInStorage(link)),
  restoreLinks: (links: readonly LinkItem[]): Promise<LinkItem[]> =>
    withStorageLock(() => restoreLinksInStorage(links)),

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

  updateSettings(patch: Partial<StashSettings>): Promise<StashSettings> {
    return withStorageLock(async () => {
      const current = await this.getSettings();
      const updated: StashSettings = { ...current, ...patch };
      await settingsStorage.setValue(updated);
      return updated;
    });
  },

  getRules: (): Promise<CategorizationRule[]> => getSortedRules(),
  watchRules: (cb: (rules: CategorizationRule[]) => void): (() => void) =>
    watchSortedRules(cb),
  createRule: (input: CreateRuleInput): Promise<CategorizationRule> =>
    withStorageLock(() => createRuleInStorage(input)),
  updateRule: (
    id: string,
    patch: UpdateRuleInput,
  ): Promise<CategorizationRule | null> =>
    withStorageLock(() => updateRuleInStorage(id, patch)),
  deleteRule: (id: string): Promise<boolean> =>
    withStorageLock(() => deleteRuleInStorage(id)),
  moveRulePriority: (
    id: string,
    direction: 'up' | 'down',
  ): Promise<CategorizationRule[]> =>
    withStorageLock(() => moveRulePriorityInStorage(id, direction)),

  getCustomThemes: (): Promise<ThemeDefinition[]> =>
    customThemesStorage.getValue(),
  watchCustomThemes: (cb: (themes: ThemeDefinition[]) => void): (() => void) =>
    customThemesStorage.watch(cb),
  saveCustomTheme: (theme: ThemeDefinition): Promise<ThemeDefinition> =>
    withStorageLock(() => saveCustomThemeInStorage(theme)),
  deleteCustomTheme(id: string): Promise<boolean> {
    return withStorageLock(async () => {
      const deleted = await deleteCustomThemeInStorage(id);
      if (deleted) {
        const current = await this.getSettings();
        if (current.activeThemeId === id) {
          await settingsStorage.setValue({
            ...current,
            activeThemeId: DEFAULT_SETTINGS.activeThemeId,
          });
        }
      }
      return deleted;
    });
  },

  restoreBundle(
    bundle: StashExportBundle,
    mode: 'merge' | 'replace',
  ): Promise<RestoreStats> {
    return withStorageLock(async () => {
      const current = await this.getSnapshot();
      return restoreBundleInStorage(current, bundle, mode);
    });
  },

  importBookmarkFolders: (
    folders: readonly ImportedBookmarkFolder[],
  ): Promise<BookmarkImportSummary> =>
    withStorageLock(() => importBookmarkFoldersInStorage(folders)),
  applyReorganization: (
    nextState: LibraryBoardState,
  ): Promise<LibraryBoardState> =>
    withStorageLock(() => applyReorganizationInStorage(nextState)),
  restoreLibrarySnapshot: (
    snapshot: LibraryBoardState,
    spaceId?: string,
  ): Promise<void> =>
    withStorageLock(() => restoreLibrarySnapshotInStorage(snapshot, spaceId)),
  getTrash: (): Promise<TrashEntry[]> => getTrashEntriesInStorage(),
  watchTrash: (cb: (entries: TrashEntry[]) => void): (() => void) =>
    watchTrashEntriesInStorage(cb),
  restoreTrashEntry: (entryId: string): Promise<TrashRestoreResult | null> =>
    withStorageLock(() => restoreTrashEntryInStorage(entryId)),
  deleteTrashEntry: (entryId: string): Promise<boolean> =>
    withStorageLock(() => deleteTrashEntryInStorage(entryId)),
  emptyTrash: (): Promise<void> => withStorageLock(() => emptyTrashInStorage()),
};
