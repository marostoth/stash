import { create } from 'zustand';
import type { Collection, LinkItem } from '@/lib/types/stash';

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
  searchQuery: string;
  collectionModal: CollectionModalState;
  linkModal: LinkModalState;
  settingsOpen: boolean;
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
  setSearchQuery: (query: string) => void;
  openCreateCollection: () => void;
  openEditCollection: (collection: Collection) => void;
  closeCollectionModal: () => void;
  openCreateLink: (collectionId: string) => void;
  openEditLink: (link: LinkItem) => void;
  closeLinkModal: () => void;
  openSettings: () => void;
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
  searchQuery: '',
  collectionModal: null,
  linkModal: null,
  settingsOpen: false,
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

  setSearchQuery: (query) => set({ searchQuery: query }),

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

  openSettings: () => {
    clearPreviewTimer();
    set({
      settingsOpen: true,
      hoveredPreviewCandidate: null,
      activePreview: null,
    });
  },
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
