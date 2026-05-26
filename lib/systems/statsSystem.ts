/**
 * Lifetime stats counter. Persisted in localStorage independently of
 * the game save so resets don't wipe player-progress dopamine. Read
 * via getStats(), bumped via bump().
 */

const KEY = "growverse-stats-v1";

export type StatKey =
  | "buildingsPlaced"
  | "buildingsUpgraded"
  | "decorCleared"
  | "decorRegrown"
  | "dailyRewardsClaimed"
  | "harvestsCollected";

export type Stats = Record<StatKey, number>;

const DEFAULT_STATS: Stats = {
  buildingsPlaced: 0,
  buildingsUpgraded: 0,
  decorCleared: 0,
  decorRegrown: 0,
  dailyRewardsClaimed: 0,
  harvestsCollected: 0,
};

function read(): Stats {
  if (typeof window === "undefined") return { ...DEFAULT_STATS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(raw) as Partial<Stats>;
    return { ...DEFAULT_STATS, ...parsed };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

function write(s: Stats): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage disabled */
  }
}

let cache: Stats | null = null;
const listeners = new Set<(s: Stats) => void>();

function get(): Stats {
  if (!cache) cache = read();
  return cache;
}

export function getStats(): Stats {
  return { ...get() };
}

/** Bump a counter by `by` (default 1). Persists + notifies subscribers. */
export function bump(key: StatKey, by: number = 1): void {
  const s = get();
  const next: Stats = { ...s, [key]: s[key] + by };
  cache = next;
  write(next);
  for (const fn of listeners) fn(next);
}

/** Subscribe to stat changes; returns unsubscribe. */
export function subscribeStats(fn: (s: Stats) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
