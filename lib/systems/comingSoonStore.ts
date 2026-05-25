import { create } from "zustand";

/**
 * Tiny store for the "Coming Soon" modal. UI-only, not persisted.
 * Used by BottomNav when the player taps a tab that isn't shipped yet
 * (Train / Raid / Heroes / Pets in current Phase 2 state).
 */

export interface ComingSoonContent {
  title: string;
  /** Plain-text body. Keep it short (1-2 sentences). */
  body: string;
  /** Optional release-phase tag, e.g. "Phase 3". */
  phase?: string;
}

interface State {
  open: boolean;
  content: ComingSoonContent | null;
  showComingSoon: (content: ComingSoonContent) => void;
  closeComingSoon: () => void;
}

export const useComingSoonStore = create<State>((set) => ({
  open: false,
  content: null,
  showComingSoon: (content) => set({ open: true, content }),
  closeComingSoon: () => set({ open: false }),
}));

export function showComingSoon(content: ComingSoonContent) {
  useComingSoonStore.getState().showComingSoon(content);
}
