/**
 * Save system facade.
 *
 * The actual persistence is handled by zustand's persist middleware
 * (already wired in lib/store.ts — versioned, migrated, partialized).
 * This module exposes a small API so future code (chapter rewards,
 * export/import, debug tools) doesn't reach into the store internals.
 *
 * No React.
 */

import { useGameStore, SAVE_KEY, SAVE_VERSION } from "@/lib/store";

/** Trigger an immediate write of the current store state to localStorage. */
export function saveNow(): void {
  // Zustand persist auto-saves on every set(); calling tick() forces a
  // no-op state change to nudge it. Used by manual "save" buttons later.
  useGameStore.getState().tick();
}

/** Re-read localStorage and rehydrate the store. */
export async function reloadFromDisk(): Promise<void> {
  await useGameStore.persist?.rehydrate?.();
}

/** Wipe the persisted save and reset to fresh start. */
export function resetSave(): void {
  useGameStore.getState().resetSave();
}

/** Has the persisted save finished loading yet? */
export function hasHydrated(): boolean {
  return useGameStore.persist?.hasHydrated?.() ?? false;
}

/** Subscribe to the one-time "save loaded" event. */
export function onSaveHydrated(cb: () => void): (() => void) | undefined {
  return useGameStore.persist?.onFinishHydration?.(cb);
}

// ─── Export / import (debug + share) ────────────────────────────────

interface SaveEnvelope {
  app: "growverse";
  version: number;
  exportedAt: number;
  state: unknown;
}

/** Serialize the current persisted state as a portable JSON string. */
export function exportSave(): string {
  const raw = localStorage.getItem(SAVE_KEY);
  let state: unknown = null;
  if (raw) {
    try {
      state = JSON.parse(raw);
    } catch {
      state = null;
    }
  }
  const envelope: SaveEnvelope = {
    app: "growverse",
    version: SAVE_VERSION,
    exportedAt: Date.now(),
    state,
  };
  return JSON.stringify(envelope, null, 2);
}

/**
 * Replace the persisted save with the contents of an export string,
 * then rehydrate. Returns true on success, throws on a malformed envelope.
 */
export async function importSave(serialized: string): Promise<boolean> {
  let envelope: SaveEnvelope;
  try {
    envelope = JSON.parse(serialized);
  } catch {
    throw new Error("Save data is not valid JSON.");
  }
  if (!envelope || envelope.app !== "growverse") {
    throw new Error("This doesn't look like a Growverse save file.");
  }
  if (typeof envelope.version !== "number") {
    throw new Error("Save envelope is missing a version field.");
  }
  // We let the same persist `migrate` function in store.ts handle older
  // versions on rehydrate, so all we have to do is write to localStorage
  // and trigger a re-read.
  localStorage.setItem(SAVE_KEY, JSON.stringify(envelope.state));
  await reloadFromDisk();
  return true;
}
