import { create } from 'zustand';

interface SelectionStoreState {
  selectedIds: string[];
  lastSelectedId: string | null;
  orderedVisibleIds: string[];
  setOrderedVisibleIds: (ids: readonly string[]) => void;
  toggleSelect: (id: string) => void;
  selectRangeTo: (targetId: string) => void;
  selectAll: (ids: readonly string[]) => void;
  clearSelection: () => void;
  pruneMissing: (validIds: ReadonlySet<string>) => void;
}

export const useSelectionStore = create<SelectionStoreState>((set) => ({
  selectedIds: [],
  lastSelectedId: null,
  orderedVisibleIds: [],

  setOrderedVisibleIds: (ids) => set({ orderedVisibleIds: [...ids] }),

  toggleSelect: (id) =>
    set((state) => {
      const exists = state.selectedIds.includes(id);
      return {
        selectedIds: exists
          ? state.selectedIds.filter((item) => item !== id)
          : [...state.selectedIds, id],
        lastSelectedId: id,
      };
    }),

  selectRangeTo: (targetId) =>
    set((state) => {
      const orderedIds = state.orderedVisibleIds;
      const anchorId = state.lastSelectedId;
      if (!anchorId) {
        return {
          selectedIds: state.selectedIds.includes(targetId)
            ? state.selectedIds
            : [...state.selectedIds, targetId],
          lastSelectedId: targetId,
        };
      }
      const startIdx = orderedIds.indexOf(anchorId);
      const endIdx = orderedIds.indexOf(targetId);
      if (startIdx < 0 || endIdx < 0) {
        return {
          selectedIds: state.selectedIds.includes(targetId)
            ? state.selectedIds
            : [...state.selectedIds, targetId],
          lastSelectedId: targetId,
        };
      }
      const low = Math.min(startIdx, endIdx);
      const high = Math.max(startIdx, endIdx);
      const rangeSlice = orderedIds.slice(low, high + 1);
      const merged = Array.from(new Set([...state.selectedIds, ...rangeSlice]));
      return { selectedIds: merged, lastSelectedId: targetId };
    }),

  selectAll: (ids) =>
    set({
      selectedIds: Array.from(new Set(ids)),
      lastSelectedId: ids[ids.length - 1] ?? null,
    }),

  clearSelection: () =>
    set((state) =>
      state.selectedIds.length === 0 && state.lastSelectedId === null
        ? state
        : { selectedIds: [], lastSelectedId: null },
    ),

  pruneMissing: (validIds) =>
    set((state) => {
      if (state.selectedIds.length === 0) return state;
      const next = state.selectedIds.filter((id) => validIds.has(id));
      if (next.length === state.selectedIds.length) return state;
      return {
        selectedIds: next,
        lastSelectedId:
          state.lastSelectedId && validIds.has(state.lastSelectedId)
            ? state.lastSelectedId
            : (next[next.length - 1] ?? null),
      };
    }),
}));
