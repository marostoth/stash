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

interface UiStoreState {
  searchQuery: string;
  collectionModal: CollectionModalState;
  linkModal: LinkModalState;
  settingsOpen: boolean;
  triageCollectionId: string | null;
  highlightedLinkId: string | null;
  settledLinkId: string | null;
  setSearchQuery: (query: string) => void;
  openCreateCollection: () => void;
  openEditCollection: (collection: Collection) => void;
  closeCollectionModal: () => void;
  openCreateLink: (collectionId: string) => void;
  openEditLink: (link: LinkItem) => void;
  closeLinkModal: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openTriage: (collectionId: string) => void;
  closeTriage: () => void;
  pulseLink: (linkId: string) => void;
  settleLink: (linkId: string) => void;
}

let pulseTimer: ReturnType<typeof setTimeout> | null = null;
let settleTimer: ReturnType<typeof setTimeout> | null = null;

export const useUiStore = create<UiStoreState>((set) => ({
  searchQuery: '',
  collectionModal: null,
  linkModal: null,
  settingsOpen: false,
  triageCollectionId: null,
  highlightedLinkId: null,
  settledLinkId: null,

  setSearchQuery: (query) => set({ searchQuery: query }),

  openCreateCollection: () => set({ collectionModal: { mode: 'create' } }),
  openEditCollection: (collection) =>
    set({ collectionModal: { mode: 'edit', collection } }),
  closeCollectionModal: () => set({ collectionModal: null }),

  openCreateLink: (collectionId) =>
    set({ linkModal: { mode: 'create', defaultCollectionId: collectionId } }),
  openEditLink: (link) => set({ linkModal: { mode: 'edit', link } }),
  closeLinkModal: () => set({ linkModal: null }),

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  openTriage: (collectionId) => set({ triageCollectionId: collectionId }),
  closeTriage: () => set({ triageCollectionId: null }),

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
    }, 520);
  },
}));
