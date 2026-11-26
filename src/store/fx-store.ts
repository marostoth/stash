import { create } from 'zustand';

export interface SettledImpact {
  linkId: string;
  collectionId: string;
  cx: number;
  cy: number;
  seq: number;
}

export interface SpaceSwallowPulse {
  spaceId: string;
  label: string;
  seq: number;
}

interface FxStoreState {
  settledImpact: SettledImpact | null;
  wakingCollectionId: string | null;
  slammedCollectionId: string | null;
  sessionSweeping: boolean;
  swallowedSpace: SpaceSwallowPulse | null;
  spaceSlideDirection: -1 | 0 | 1;
  starFlashLinkId: string | null;
  triggerSettledImpact: (linkId: string, collectionId: string) => void;
  triggerWakeWave: (collectionId: string) => void;
  triggerCollectionSlam: (collectionId: string) => void;
  setSessionSweeping: (sweeping: boolean) => void;
  triggerSpaceSwallow: (spaceId: string, label?: string) => void;
  setSpaceSlideDirection: (direction: -1 | 0 | 1) => void;
  triggerStarFlash: (linkId: string) => void;
}

let impactSeq = 0;
let swallowSeq = 0;
let impactTimer: ReturnType<typeof setTimeout> | null = null;
let wakeTimer: ReturnType<typeof setTimeout> | null = null;
let slamColTimer: ReturnType<typeof setTimeout> | null = null;
let swallowTimer: ReturnType<typeof setTimeout> | null = null;
let starFlashTimer: ReturnType<typeof setTimeout> | null = null;

export const useFxStore = create<FxStoreState>((set) => ({
  settledImpact: null,
  wakingCollectionId: null,
  slammedCollectionId: null,
  sessionSweeping: false,
  swallowedSpace: null,
  spaceSlideDirection: 0,
  starFlashLinkId: null,

  triggerSettledImpact: (linkId, collectionId) => {
    if (impactTimer) clearTimeout(impactTimer);
    if (typeof document === 'undefined') return;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-link-id="${CSS.escape(linkId)}"]`,
      );
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      impactSeq += 1;
      const seq = impactSeq;
      set({
        settledImpact: {
          linkId,
          collectionId,
          cx: rect.left + rect.width / 2,
          cy: rect.top + rect.height / 2,
          seq,
        },
      });
      impactTimer = setTimeout(() => {
        set((state) =>
          state.settledImpact?.seq === seq ? { settledImpact: null } : state,
        );
        impactTimer = null;
      }, 640);
    });
  },

  triggerWakeWave: (collectionId) => {
    if (wakeTimer) clearTimeout(wakeTimer);
    set({ wakingCollectionId: collectionId });
    wakeTimer = setTimeout(() => {
      set((state) =>
        state.wakingCollectionId === collectionId
          ? { wakingCollectionId: null }
          : state,
      );
      wakeTimer = null;
    }, 1700);
  },

  triggerCollectionSlam: (collectionId) => {
    if (slamColTimer) clearTimeout(slamColTimer);
    set({ slammedCollectionId: collectionId });
    slamColTimer = setTimeout(() => {
      set((state) =>
        state.slammedCollectionId === collectionId
          ? { slammedCollectionId: null }
          : state,
      );
      slamColTimer = null;
    }, 860);
  },

  setSessionSweeping: (sweeping) => set({ sessionSweeping: sweeping }),

  triggerSpaceSwallow: (spaceId, label = '+1') => {
    if (swallowTimer) clearTimeout(swallowTimer);
    swallowSeq += 1;
    const seq = swallowSeq;
    set({ swallowedSpace: { spaceId, label, seq } });
    swallowTimer = setTimeout(() => {
      set((state) =>
        state.swallowedSpace?.seq === seq ? { swallowedSpace: null } : state,
      );
      swallowTimer = null;
    }, 950);
  },

  setSpaceSlideDirection: (direction) =>
    set({ spaceSlideDirection: direction }),

  triggerStarFlash: (linkId) => {
    if (starFlashTimer) clearTimeout(starFlashTimer);
    set({ starFlashLinkId: linkId });
    starFlashTimer = setTimeout(() => {
      set((state) =>
        state.starFlashLinkId === linkId ? { starFlashLinkId: null } : state,
      );
      starFlashTimer = null;
    }, 860);
  },
}));
