import { create } from 'zustand';
import { stashRepo } from '@/lib/storage/repo';
import {
  type Collection,
  DEFAULT_SPACE_ID,
  type LinkItem,
} from '@/lib/types/stash';

const ACTIVE_SPACE_LOCAL_KEY = 'stash_active_space_id';

function readInitialActiveSpaceId(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(ACTIVE_SPACE_LOCAL_KEY);
      if (saved?.trim()) return saved.trim();
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
  return DEFAULT_SPACE_ID;
}

function writeLocalActiveSpaceId(spaceId: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ACTIVE_SPACE_LOCAL_KEY, spaceId);
    }
  } catch {
    // Ignore storage access errors
  }
}

export type SettingsTab =
  | 'general'
  | 'appearance'
  | 'ai-rules'
  | 'library-tools'
  | 'shortcuts'
  | 'backup';

export type LinkModalState =
  | { mode: 'create'; defaultCollectionId: string }
  | { mode: 'edit'; link: LinkItem }
  | null;

export type CollectionModalState =
  | { mode: 'create' }
  | { mode: 'edit'; collection: Collection }
  | null;

export interface PreviewAnchorRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface PreviewTarget {
  id: string;
  url: string;
  title: string;
  note?: string;
  tags?: string[];
  faviconUrl?: string;
  anchor: PreviewAnchorRect;
  preferredSide: 'bottom' | 'left';
}

interface UiStoreState {
  activeSpaceId: string;
  searchQuery: string;
  starredOnly: boolean;
  searchAllSpaces: boolean;
  keyboardFocusedLinkId: string | null;
  collectionModal: CollectionModalState;
  linkModal: LinkModalState;
  settingsOpen: boolean;
  settingsTab: SettingsTab;
  healthCheckOpen: boolean;
  reorganizeOpen: boolean;
  triageCollectionId: string | null;
  triageOpen: boolean;
  highlightedLinkId: string | null;
  settledLinkId: string | null;
  taggingLinkIds: string[];
  cascadingCollectionIds: string[];
  hoveredPreviewCandidate: PreviewTarget | null;
  activePreview: PreviewTarget | null;
  setActiveSpaceId: (spaceId: string, persist?: boolean) => void;
  setSearchQuery: (query: string) => void;
  setStarredOnly: (starredOnly: boolean) => void;
  toggleStarredOnly: () => void;
  setSearchAllSpaces: (allSpaces: boolean) => void;
  toggleSearchAllSpaces: () => void;
  setKeyboardFocusedLinkId: (linkId: string | null) => void;
  openCreateCollection: () => void;
  openEditCollection: (collection: Collection) => void;
  closeCollectionModal: () => void;
  openCreateLink: (collectionId: string) => void;
  openEditLink: (link: LinkItem) => void;
  closeLinkModal: () => void;
  openSettings: (tab?: SettingsTab) => void;
  setSettingsTab: (tab: SettingsTab) => void;
  closeSettings: () => void;
  openHealthCheck: () => void;
  closeHealthCheck: () => void;
  openReorganize: () => void;
  closeReorganize: () => void;
  openTriage: (collectionId: string) => void;
  reopenTriage: () => void;
  closeTriage: () => void;
  clearTriage: () => void;
  pulseLink: (linkId: string) => void;
  settleLink: (linkId: string) => void;
  addTaggingLink: (linkId: string) => void;
  removeTaggingLink: (linkId: string) => void;
  triggerCollectionCascade: (collectionId: string) => void;
  schedulePreview: (target: PreviewTarget) => void;
  openPreviewImmediate: (target: PreviewTarget) => void;
  dismissPreview: () => void;
}

const HOVER_PREVIEW_DELAY_MS = 500;

let pulseTimer: ReturnType<typeof setTimeout> | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;
let previewTimer: ReturnType<typeof setTimeout> | null = null;
const cascadeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearPreviewTimer(): void {
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
}

export const useUiStore = create<UiStoreState>((set) => ({
  activeSpaceId: readInitialActiveSpaceId(),
  searchQuery: '',
  starredOnly: false,
  searchAllSpaces: false,
  keyboardFocusedLinkId: null,
  collectionModal: null,
  linkModal: null,
  settingsOpen: false,
  settingsTab: 'general',
  healthCheckOpen: false,
  reorganizeOpen: false,
  triageCollectionId: null,
  triageOpen: false,
  highlightedLinkId: null,
  settledLinkId: null,
  taggingLinkIds: [],
  cascadingCollectionIds: [],
  hoveredPreviewCandidate: null,
  activePreview: null,

  setActiveSpaceId: (spaceId, persist = true) => {
    const trimmed = spaceId.trim() || DEFAULT_SPACE_ID;
    writeLocalActiveSpaceId(trimmed);
    if (persist) {
      void stashRepo.setActiveSpaceId(trimmed).catch(() => undefined);
    }
    set({ activeSpaceId: trimmed, keyboardFocusedLinkId: null });
  },
  setSearchQuery: (query) =>
    set({ searchQuery: query, keyboardFocusedLinkId: null }),
  setStarredOnly: (starredOnly) =>
    set({ starredOnly, keyboardFocusedLinkId: null }),
  toggleStarredOnly: () =>
    set((state) => ({
      starredOnly: !state.starredOnly,
      keyboardFocusedLinkId: null,
    })),
  setSearchAllSpaces: (allSpaces) =>
    set({ searchAllSpaces: allSpaces, keyboardFocusedLinkId: null }),
  toggleSearchAllSpaces: () =>
    set((state) => ({
      searchAllSpaces: !state.searchAllSpaces,
      keyboardFocusedLinkId: null,
    })),
  setKeyboardFocusedLinkId: (linkId) => set({ keyboardFocusedLinkId: linkId }),

  openCreateCollection: () => {
    clearPreviewTimer();
    set({
      collectionModal: { mode: 'create' },
      hoveredPreviewCandidate: null,
      activePreview: null,
    });
  },
  openEditCollection: (collection) => {
    clearPreviewTimer();
    set({
      collectionModal: { mode: 'edit', collection },
      hoveredPreviewCandidate: null,
      activePreview: null,
    });
  },
  closeCollectionModal: () => set({ collectionModal: null }),

  openCreateLink: (collectionId) => {
    clearPreviewTimer();
    set({
      linkModal: { mode: 'create', defaultCollectionId: collectionId },
      hoveredPreviewCandidate: null,
      activePreview: null,
    });
  },
  openEditLink: (link) => {
    clearPreviewTimer();
    set({
      linkModal: { mode: 'edit', link },
      hoveredPreviewCandidate: null,
      activePreview: null,
    });
  },
  closeLinkModal: () => set({ linkModal: null }),

  openSettings: (tab) => {
    clearPreviewTimer();
    set({
      settingsOpen: true,
      settingsTab: typeof tab === 'string' ? tab : 'general',
      hoveredPreviewCandidate: null,
      activePreview: null,
    });
  },
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  closeSettings: () => set({ settingsOpen: false }),

  openHealthCheck: () => {
    clearPreviewTimer();
    set({
      settingsOpen: false,
      reorganizeOpen: false,
      healthCheckOpen: true,
      hoveredPreviewCandidate: null,
      activePreview: null,
    });
  },
  closeHealthCheck: () => set({ healthCheckOpen: false }),

  openReorganize: () => {
    clearPreviewTimer();
    set({
      settingsOpen: false,
      healthCheckOpen: false,
      reorganizeOpen: true,
      hoveredPreviewCandidate: null,
      activePreview: null,
    });
  },
  closeReorganize: () => set({ reorganizeOpen: false }),

  openTriage: (collectionId) => {
    clearPreviewTimer();
    set({
      triageCollectionId: collectionId,
      triageOpen: true,
      hoveredPreviewCandidate: null,
      activePreview: null,
    });
  },
  reopenTriage: () => {
    clearPreviewTimer();
    set((state) =>
      state.triageCollectionId
        ? {
            triageOpen: true,
            hoveredPreviewCandidate: null,
            activePreview: null,
          }
        : state,
    );
  },
  closeTriage: () => set({ triageOpen: false }),
  clearTriage: () => set({ triageOpen: false, triageCollectionId: null }),

  pulseLink: (linkId) => {
    if (pulseTimer) {
      clearTimeout(pulseTimer);
    }
    set({ highlightedLinkId: linkId });
    pulseTimer = setTimeout(() => {
      set((state) =>
        state.highlightedLinkId === linkId
          ? { highlightedLinkId: null }
          : state,
      );
      pulseTimer = null;
    }, 2300);
  },

  settleLink: (linkId) => {
    if (settleTimer) {
      clearTimeout(settleTimer);
    }
    set({ settledLinkId: linkId });
    settleTimer = setTimeout(() => {
      set((state) =>
        state.settledLinkId === linkId ? { settledLinkId: null } : state,
      );
      settleTimer = null;
    }, 420);
  },

  addTaggingLink: (linkId) =>
    set((state) =>
      state.taggingLinkIds.includes(linkId)
        ? state
        : { taggingLinkIds: [...state.taggingLinkIds, linkId] },
    ),

  removeTaggingLink: (linkId) =>
    set((state) => ({
      taggingLinkIds: state.taggingLinkIds.filter((id) => id !== linkId),
    })),

  triggerCollectionCascade: (collectionId) => {
    const existing = cascadeTimers.get(collectionId);
    if (existing) clearTimeout(existing);

    set((state) =>
      state.cascadingCollectionIds.includes(collectionId)
        ? state
        : {
            cascadingCollectionIds: [
              ...state.cascadingCollectionIds,
              collectionId,
            ],
          },
    );

    const timer = setTimeout(() => {
      cascadeTimers.delete(collectionId);
      set((state) => ({
        cascadingCollectionIds: state.cascadingCollectionIds.filter(
          (id) => id !== collectionId,
        ),
      }));
    }, 520);
    cascadeTimers.set(collectionId, timer);
  },

  schedulePreview: (target) => {
    clearPreviewTimer();
    set({ hoveredPreviewCandidate: target });
    previewTimer = setTimeout(() => {
      previewTimer = null;
      set((state) =>
        state.hoveredPreviewCandidate?.id === target.id
          ? { activePreview: target }
          : state,
      );
    }, HOVER_PREVIEW_DELAY_MS);
  },

  openPreviewImmediate: (target) => {
    clearPreviewTimer();
    set({ hoveredPreviewCandidate: target, activePreview: target });
  },

  dismissPreview: () => {
    clearPreviewTimer();
    set((state) =>
      state.activePreview === null && state.hoveredPreviewCandidate === null
        ? state
        : { hoveredPreviewCandidate: null, activePreview: null },
    );
  },
}));
