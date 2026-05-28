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

// ─── Milestone definitions ──────────────────────────────────────────
// Each milestone fires a one-shot celebration toast the first time the
// stat crosses the threshold. Tracked separately at growverse-milestones
// so a save reset doesn't trigger re-fires.

export interface Milestone {
  key: StatKey;
  threshold: number;
  /** Toast title — short verb phrase. */
  title: string;
  /** Optional flavor body. */
  body?: string;
  /** Accent hex driving the toast pill color. */
  accent: string;
}

export const MILESTONES: Milestone[] = [
  // Building placement
  { key: "buildingsPlaced", threshold: 1,   title: "First Building",    body: "Welcome to base-building.", accent: "#d4a04a" },
  { key: "buildingsPlaced", threshold: 5,   title: "Architect",         body: "5 structures placed.",       accent: "#d4a04a" },
  { key: "buildingsPlaced", threshold: 15,  title: "Master Builder",    body: "15 structures placed.",      accent: "#d4a04a" },
  { key: "buildingsPlaced", threshold: 30,  title: "Realm Maker",       body: "30 structures placed.",      accent: "#d4a04a" },
  // Upgrades
  { key: "buildingsUpgraded", threshold: 1, title: "First Upgrade",     body: "A guild that grows.",         accent: "#7fb069" },
  { key: "buildingsUpgraded", threshold: 10, title: "Empowered",        body: "10 upgrades complete.",       accent: "#7fb069" },
  { key: "buildingsUpgraded", threshold: 30, title: "Ascendant",        body: "30 upgrades complete.",       accent: "#7fb069" },
  // Decor clearing
  { key: "decorCleared", threshold: 1,      title: "First Clear",       body: "The desert reveals its gifts.", accent: "#c9a878" },
  { key: "decorCleared", threshold: 25,     title: "Desert Tamer",      body: "25 props cleared.",           accent: "#c9a878" },
  { key: "decorCleared", threshold: 100,    title: "Desert Wrangler",   body: "100 props cleared.",          accent: "#c9a878" },
  { key: "decorCleared", threshold: 250,    title: "Desert Master",     body: "250 props cleared.",          accent: "#c9a878" },
  // Regrowth
  { key: "decorRegrown", threshold: 1,      title: "First Regrowth",    body: "Life finds a way.",           accent: "#9ed16e" },
  { key: "decorRegrown", threshold: 10,     title: "Patient Cultivator", body: "10 props regrew while you were away.", accent: "#9ed16e" },
  // Harvest
  { key: "harvestsCollected", threshold: 10, title: "Diligent Grower",  body: "10 harvests.",                accent: "#7fb069" },
  { key: "harvestsCollected", threshold: 50, title: "Bountiful",        body: "50 harvests.",                accent: "#7fb069" },
  { key: "harvestsCollected", threshold: 200, title: "Abundance",       body: "200 harvests.",               accent: "#7fb069" },
  // Daily streak
  { key: "dailyRewardsClaimed", threshold: 3, title: "3-Day Streak",    body: "Three daily bounties claimed.", accent: "#b78ddf" },
  { key: "dailyRewardsClaimed", threshold: 7, title: "Loyal Grower",    body: "A full week of returns.",     accent: "#b78ddf" },
  { key: "dailyRewardsClaimed", threshold: 14, title: "Two Weeks Strong", body: "14 daily claims.",          accent: "#b78ddf" },
  { key: "dailyRewardsClaimed", threshold: 30, title: "Devoted Grower", body: "A full month of returns.",    accent: "#b78ddf" },
];

const MILESTONES_KEY = "growverse-milestones-v1";

function readSeenMilestones(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(MILESTONES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSeenMilestones(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      MILESTONES_KEY,
      JSON.stringify(Array.from(set)),
    );
  } catch {
    /* storage disabled */
  }
}

let seenCache: Set<string> | null = null;
function seen(): Set<string> {
  if (!seenCache) seenCache = readSeenMilestones();
  return seenCache;
}

/** Count of milestones the player has unlocked / total available. UI uses
 *  this to surface progress in the HUD. */
export function getMilestoneProgress(): { unlocked: number; total: number } {
  return { unlocked: seen().size, total: MILESTONES.length };
}

type MilestoneHitFn = (m: Milestone) => void;
let onMilestoneHit: MilestoneHitFn | null = null;

/** Register a global handler that fires when a milestone is hit. */
export function setMilestoneHandler(fn: MilestoneHitFn | null): void {
  onMilestoneHit = fn;
}

/** Bump a counter by `by` (default 1). Persists + notifies subscribers
 *  + fires any unseen milestones for the stat. */
export function bump(key: StatKey, by: number = 1): void {
  const s = get();
  const prev = s[key];
  const next: Stats = { ...s, [key]: prev + by };
  cache = next;
  write(next);
  for (const fn of listeners) fn(next);
  // Check milestones crossed during this bump.
  if (onMilestoneHit) {
    const seenSet = seen();
    let mutated = false;
    for (const m of MILESTONES) {
      if (m.key !== key) continue;
      if (prev < m.threshold && next[key] >= m.threshold) {
        const id = `${m.key}:${m.threshold}`;
        if (!seenSet.has(id)) {
          seenSet.add(id);
          mutated = true;
          onMilestoneHit(m);
        }
      }
    }
    if (mutated) writeSeenMilestones(seenSet);
  }
}

/** Subscribe to stat changes; returns unsubscribe. */
export function subscribeStats(fn: (s: Stats) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Find the next unmet milestone with the smallest absolute distance
 * to its threshold. Used by the "next goal" chip so the player always
 * sees what to do next. Returns null when every milestone is unlocked.
 */
export function getNextMilestone(): {
  milestone: Milestone;
  current: number;
  remaining: number;
} | null {
  const s = get();
  let best: { milestone: Milestone; current: number; remaining: number } | null = null;
  for (const m of MILESTONES) {
    const current = s[m.key];
    if (current >= m.threshold) continue;
    const remaining = m.threshold - current;
    if (!best || remaining < best.remaining) {
      best = { milestone: m, current, remaining };
    }
  }
  return best;
}
