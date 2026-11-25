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
  applyReorganizationInStorage,
  restoreLibrarySnapshotInStorage,
} from '@/lib/storage/reorganize-ops';
import {
  type AddLinkInput,
  type AddLinkResult,
  buildStarterCollections,
  type CreateCollectionInput,
  type MoveLinkResult,
  type SaveSessionResult,
  type StashSnapshot,
  type UpdateCollectionInput,
  type UpdateLinkInput,
  type UpdateLinkResult,
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
import type { OpenTabInfo } from '@/lib/tabs/session-filter';
import {
  type CategorizationRule,
  type Collection,
  DEFAULT_SETTINGS,
  type LinkItem,
  type StashExportBundle,
  type StashSettings,
  type ThemeDefinition,
} from '@/lib/types/stash';
import {
  insertLinkAtIndexInList,
  type MoveLinkListResult,
  moveOrReorderLinkInList,
  reorderCollectionsList,
  sortByOrder,
} from '@/lib/utils/ordering';
import {
  extractDomain,
  normalizeTags,
  normalizeUrlForComparison,
} from '@/lib/utils/url';

export type {
  AddLinkInput,
  AddLinkResult,
  CreateCollectionInput,
  MoveLinkResult,
  SaveSessionResult,
  StashSnapshot,
  UpdateCollectionInput,
  UpdateLinkInput,
  UpdateLinkResult,
} from '@/lib/storage/repo-types';

function nowIso(): string {
  return new Date().toISOString();
}

export const stashRepo = {
  async getSnapshot(): Promise<StashSnapshot> {
    const [collections, links, rules, settings, customThemes] =
      await Promise.all([
        this.getCollections(),
        this.getLinks(),
        this.getRules(),
        this.getSettings(),
        this.getCustomThemes(),
      ]);
    return { collections, links, rules, settings, customThemes };
  },

  async getCollections(): Promise<Collection[]> {
    return sortByOrder(await collectionsStorage.getValue());
  },

  watchCollections(cb: (collections: Collection[]) => void): () => void {
    return collectionsStorage.watch((next) => cb(sortByOrder(next)));
  },

  async createCollection(input: CreateCollectionInput): Promise<Collection> {
    const existing = await collectionsStorage.getValue();
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
    options: { includePinned: boolean; name?: string; date?: Date },
  ): Promise<SaveSessionResult | null> {
    return saveSessionCollectionInStorage(tabs, options);
  },

  async getLinks(): Promise<LinkItem[]> {
    return sortByOrder(await linksStorage.getValue());
  },

  watchLinks(cb: (links: LinkItem[]) => void): () => void {
    return linksStorage.watch((next) => cb(sortByOrder(next)));
  },

  findDuplicateInList(
    links: readonly LinkItem[],
    collectionId: string,
    url: string,
    excludeLinkId?: string,
  ): LinkItem | undefined {
    const normalized = normalizeUrlForComparison(url);
    return links.find(
      (item) =>
        item.collectionId === collectionId &&
        item.id !== excludeLinkId &&
        normalizeUrlForComparison(item.url) === normalized,
    );
  },

  async addLink(
    input: AddLinkInput,
    targetIndex?: number,
  ): Promise<AddLinkResult> {
    const existing = await linksStorage.getValue();
    const duplicate = this.findDuplicateInList(
      existing,
      input.collectionId,
      input.url,
    );
    if (duplicate) {
      return { ok: false, reason: 'duplicate', existingLink: duplicate };
    }

    const timestamp = nowIso();
    const trimmedUrl = input.url.trim();
    const created: LinkItem = {
      id: crypto.randomUUID(),
      collectionId: input.collectionId,
      url: trimmedUrl,
      title: input.title?.trim() || extractDomain(trimmedUrl),
      note: input.note?.trim() ?? '',
      tags: normalizeTags(input.tags ?? []),
      ...(input.tagsLocked === true ? { tagsLocked: true } : {}),
      faviconUrl: input.faviconUrl?.trim() || undefined,
      order: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const nextLinks = insertLinkAtIndexInList(existing, created, targetIndex);
    const persisted =
      nextLinks.find((item) => item.id === created.id) ?? created;
    await linksStorage.setValue(nextLinks);
    return { ok: true, link: persisted };
  },

  async updateLink(
    id: string,
    patch: UpdateLinkInput,
  ): Promise<UpdateLinkResult> {
    const existing = await linksStorage.getValue();
    const current = existing.find((item) => item.id === id);
    if (!current) return { ok: false, reason: 'not_found' };

    const targetCollectionId = patch.collectionId ?? current.collectionId;
    const targetUrl = patch.url !== undefined ? patch.url.trim() : current.url;

    const duplicate = this.findDuplicateInList(
      existing,
      targetCollectionId,
      targetUrl,
      id,
    );
    if (duplicate) {
      return { ok: false, reason: 'duplicate', existingLink: duplicate };
    }

    let nextOrder = patch.order ?? current.order;
    if (
      patch.collectionId !== undefined &&
      patch.collectionId !== current.collectionId &&
      patch.order === undefined
    ) {
      const targetMax = existing
        .filter((item) => item.collectionId === targetCollectionId)
        .reduce((max, item) => Math.max(max, item.order), -1);
      nextOrder = targetMax + 1;
    }

    const nextTagsLocked =
      patch.tagsLocked !== undefined
        ? patch.tagsLocked
          ? true
          : undefined
        : current.tagsLocked;

    const updated: LinkItem = {
      ...current,
      collectionId: targetCollectionId,
      url: targetUrl,
      title:
        patch.title !== undefined
          ? patch.title.trim() || extractDomain(targetUrl)
          : current.title,
      note: patch.note !== undefined ? patch.note.trim() : current.note,
      tags: patch.tags !== undefined ? normalizeTags(patch.tags) : current.tags,
      tagsLocked: nextTagsLocked,
      faviconUrl:
        patch.faviconUrl !== undefined
          ? patch.faviconUrl.trim() || undefined
          : current.faviconUrl,
      order: nextOrder,
      updatedAt: nowIso(),
    };

    await linksStorage.setValue(
      existing.map((item) => (item.id === id ? updated : item)),
    );
    return { ok: true, link: updated };
  },

  async applyAutoTagsIfEligible(
    id: string,
    tags: readonly string[],
  ): Promise<LinkItem | null> {
    const cleaned = normalizeTags(tags).slice(0, 3);
    if (cleaned.length === 0) return null;

    const existing = await linksStorage.getValue();
    const current = existing.find((item) => item.id === id);
    if (!current || current.tagsLocked || current.tags.length > 0) {
      return null;
    }

    const updated: LinkItem = {
      ...current,
      tags: cleaned,
      updatedAt: nowIso(),
    };
    await linksStorage.setValue(
      existing.map((item) => (item.id === id ? updated : item)),
    );
    return updated;
  },

  async moveOrReorderLink(
    linkId: string,
    targetCollectionId: string,
    targetIndex?: number,
  ): Promise<MoveLinkResult> {
    const existing = await linksStorage.getValue();
    const result: MoveLinkListResult = moveOrReorderLinkInList(
      existing,
      linkId,
      targetCollectionId,
      targetIndex,
      nowIso(),
    );
    if (!result.ok) return result;
    await linksStorage.setValue(result.links);
    return { ok: true, link: result.link };
  },

  async markLinkOpened(id: string): Promise<void> {
    const existing = await linksStorage.getValue();
    let changed = false;
    const timestamp = nowIso();
    const next = existing.map((item) => {
      if (item.id !== id) return item;
      changed = true;
      return { ...item, lastOpenedAt: timestamp };
    });
    if (changed) await linksStorage.setValue(next);
  },

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
