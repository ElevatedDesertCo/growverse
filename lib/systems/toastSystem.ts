import { create } from "zustand";

/**
 * Transient toast bus. UI subscribers render whatever is in `toasts`; each
 * entry auto-dismisses after its `ttlMs`. Used by the store actions and by
 * the BuildMenu to surface "placed / upgraded / can't afford" feedback.
 *
 * Intentionally NOT persisted — only live messages.
 */

export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
  /** Hex color used for the leading dot + title accent. */
  accent?: string;
  /** Lifetime in ms. Defaults to 2200 for success, 2600 for error. */
  ttlMs?: number;
  /** Coalesce key — toasts with the same key merge instead of stacking. */
  coalesceKey?: string;
  /** Repeat count when coalesced (shown as "x3" badge). Default 1. */
  count?: number;
  /** Numeric body amount to sum across coalesced toasts (e.g. +10 → +15). */
  bodyAmount?: number;
  /** Body suffix for coalesced display (e.g. "Bloom"). */
  bodySuffix?: string;
}

interface ToastState {
  toasts: Toast[];
  pushToast: (t: Omit<Toast, "id">) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

let _counter = 0;
function nextId(): string {
  _counter = (_counter + 1) % 1_000_000;
  return `t${Date.now().toString(36)}_${_counter}`;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  pushToast: (t) => {
    const ttlMs = t.ttlMs ?? (t.kind === "error" ? 2600 : 2200);
    // Coalesce: if an existing toast shares this coalesceKey, bump its
    // count + extend its lifetime + sum the bodyAmount instead of
    // stacking a fresh toast. Keeps rapid "Cleared" bursts readable.
    if (t.coalesceKey) {
      const existing = get().toasts.find(
        (x) => x.coalesceKey === t.coalesceKey,
      );
      if (existing) {
        const newCount = (existing.count ?? 1) + (t.count ?? 1);
        const newAmount =
          (existing.bodyAmount ?? 0) + (t.bodyAmount ?? 0);
        const suffix = existing.bodySuffix ?? t.bodySuffix ?? "";
        const newBody = t.bodyAmount !== undefined
          ? `+${newAmount}${suffix ? ` ${suffix}` : ""}`
          : existing.body;
        set((s) => ({
          toasts: s.toasts.map((x) =>
            x.id === existing.id
              ? { ...x, count: newCount, bodyAmount: newAmount, body: newBody }
              : x,
          ),
        }));
        // Extend lifetime so the toast doesn't vanish mid-burst.
        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            get().dismissToast(existing.id);
          }, ttlMs);
        }
        return existing.id;
      }
    }
    const id = nextId();
    set((s) => ({ toasts: [...s.toasts, { ...t, id, ttlMs, count: 1 }] }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        get().dismissToast(id);
      }, ttlMs);
    }
    return id;
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),

  clearToasts: () => set({ toasts: [] }),
}));

/**
 * Module-level helper so callers (store actions, components) can fire a
 * toast without subscribing to React. Safe to call during render-adjacent
 * events (handlers, effects) — pushes go through the store's set().
 */
export function pushToast(t: Omit<Toast, "id">): string {
  return useToastStore.getState().pushToast(t);
}
