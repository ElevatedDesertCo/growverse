// Persisted roster of OFFLINE (single-player) characters.
//
// The online flow keeps characters on the server; offline used to be a throwaway
// "type a name, play, lose it" quick-start. For the standalone Growverse build
// (deployed static-only, no server) that meant a player could never resume a
// character, so progression never accrued. This module gives offline its own
// durable roster: a JSON array in localStorage of full `CharacterState` snapshots
// (the exact shape `Sim.serializeCharacter` emits and `Sim.addPlayer({ state })`
// restores), keyed by class+name so a resume also lines up with the per-character
// keybind scope (`woc_keybinds:offline:<class>:<name>`).
//
// Pure + DOM-free apart from `localStorage`; every access is try/catch guarded so
// the module imports cleanly under Vitest's plain-Node env and never throws in
// Safari private mode (where storage writes reject).

import type { CharacterState } from '../sim/sim';
import type { PlayerClass } from '../sim/types';

const STORAGE_KEY = 'growverse.offline.characters.v1';
// Cap the roster so a player who spins up many quick brawls does not grow
// localStorage without bound; oldest-touched slots evict first.
const MAX_CHARACTERS = 16;

export interface OfflineCharacterRecord {
  /** Stable slot id: `<class>:<lowercased name>`. Also the resume identity. */
  id: string;
  name: string;
  cls: PlayerClass;
  skin: number;
  /** Cached top-line level for the roster list (also lives inside `state`). */
  level: number;
  /** Epoch ms of the last autosave, for "most recent first" ordering. */
  updatedAt: number;
  /** The full serialized character, replayed into a fresh Sim on resume. */
  state: CharacterState;
}

/** Compose the stable slot id shared with the offline keybind scope. */
export function offlineCharacterId(cls: PlayerClass, name: string): string {
  return `${cls}:${name.trim().toLowerCase()}`;
}

function readAll(): OfflineCharacterRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive filter: only keep well-formed records (a corrupt/partial entry is
    // dropped rather than crashing the roster render).
    return parsed.filter(
      (r): r is OfflineCharacterRecord =>
        !!r &&
        typeof r.id === 'string' &&
        typeof r.name === 'string' &&
        typeof r.cls === 'string' &&
        !!r.state &&
        typeof r.state === 'object',
    );
  } catch {
    return [];
  }
}

function writeAll(records: OfflineCharacterRecord[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Private mode / quota: keep playing, just do not persist.
  }
}

/** All saved offline characters, most recently played first. */
export function listOfflineCharacters(): OfflineCharacterRecord[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** A single saved character by slot id, or null. */
export function getOfflineCharacter(id: string): OfflineCharacterRecord | null {
  return readAll().find((r) => r.id === id) ?? null;
}

/**
 * Upsert a character snapshot. Keyed by `<class>:<name>`, so autosaving the same
 * character repeatedly overwrites its slot instead of piling up duplicates. Past
 * the roster cap the oldest-touched slots are evicted.
 */
export function saveOfflineCharacter(input: {
  cls: PlayerClass;
  name: string;
  skin: number;
  state: CharacterState;
}): OfflineCharacterRecord {
  const id = offlineCharacterId(input.cls, input.name);
  const record: OfflineCharacterRecord = {
    id,
    name: input.name,
    cls: input.cls,
    skin: input.skin,
    level: input.state.level,
    updatedAt: Date.now(),
    state: input.state,
  };
  const others = readAll().filter((r) => r.id !== id);
  others.push(record);
  others.sort((a, b) => b.updatedAt - a.updatedAt);
  writeAll(others.slice(0, MAX_CHARACTERS));
  return record;
}

/** Delete a saved character by slot id. */
export function deleteOfflineCharacter(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}
