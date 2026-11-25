import { create } from 'zustand';

export type BackgroundJobId =
  | 'auto-icon'
  | 'auto-tag'
  | 'nano-download'
  | 'health-check'
  | 'reorganize'
  | 'triage';

export type BackgroundJobStatus = 'running' | 'ready';

export interface BackgroundJobProgress {
  current: number;
  total: number;
}

export interface BackgroundJob {
  id: BackgroundJobId;
  title: string;
  detail?: string;
  status: BackgroundJobStatus;
  progress?: BackgroundJobProgress | null;
  usesNano?: boolean;
  /** Optional scope identifier (e.g., collectionId for per-collection Auto-Tag) */
  scopeId?: string;
  reopenLabel?: string;
  onReopen?: () => void;
  onCancel?: () => void;
}

export interface ModalVisibilitySnapshot {
  settingsOpen: boolean;
  healthCheckOpen: boolean;
  reorganizeOpen: boolean;
  triageOpen: boolean;
}

export function isJobVisibleInTray(
  job: BackgroundJob,
  visibility: ModalVisibilitySnapshot,
): boolean {
  switch (job.id) {
    case 'health-check':
      return !visibility.healthCheckOpen;
    case 'reorganize':
      return !visibility.reorganizeOpen;
    case 'triage':
      return !visibility.triageOpen;
    case 'auto-icon':
    case 'nano-download':
      return !visibility.settingsOpen;
    case 'auto-tag':
      // Per-collection Auto-Tag has no modal; global Auto-Tag hides while Settings is open
      return job.scopeId ? true : !visibility.settingsOpen;
  }
}

interface BackgroundJobsState {
  jobs: BackgroundJob[];
  trayHeightPx: number;
  upsertJob: (job: BackgroundJob) => void;
  removeJob: (id: BackgroundJobId) => void;
  cancelJob: (id: BackgroundJobId) => void;
  hasActiveNanoJob: (excludeId?: BackgroundJobId) => boolean;
  setTrayHeightPx: (height: number) => void;
  resetForTests: () => void;
}

export const useBackgroundJobsStore = create<BackgroundJobsState>(
  (set, get) => ({
    jobs: [],
    trayHeightPx: 0,

    upsertJob: (job) =>
      set((state) => {
        const idx = state.jobs.findIndex((item) => item.id === job.id);
        if (idx === -1) {
          return { jobs: [...state.jobs, job] };
        }
        const next = [...state.jobs];
        next[idx] = job;
        return { jobs: next };
      }),

    removeJob: (id) =>
      set((state) => {
        if (!state.jobs.some((item) => item.id === id)) return state;
        return { jobs: state.jobs.filter((item) => item.id !== id) };
      }),

    cancelJob: (id) => {
      const target = get().jobs.find((item) => item.id === id);
      if (!target) return;
      if (target.onCancel) {
        target.onCancel();
      }
      if (target.status === 'ready') {
        get().removeJob(id);
      }
    },

    hasActiveNanoJob: (excludeId) =>
      get().jobs.some(
        (job) =>
          job.status === 'running' &&
          job.usesNano === true &&
          job.id !== excludeId,
      ),

    setTrayHeightPx: (height) =>
      set((state) =>
        state.trayHeightPx === height ? state : { trayHeightPx: height },
      ),

    resetForTests: () => set({ jobs: [], trayHeightPx: 0 }),
  }),
);
