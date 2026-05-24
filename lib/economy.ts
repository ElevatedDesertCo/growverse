/**
 * Pure economy functions. No React, no Zustand, no globals.
 * All time math is wall-clock relative — `now` is a parameter so tests can
 * inject a fixed time and these stay deterministic.
 */

export const MAX_LEVEL = 5;
export const DEFAULT_COST_MULTIPLIER = 1.5;
export const DEFAULT_STAT_MULTIPLIER = 1.5;
/**
 * Maximum offline accrual window for passive generators. Time elapsed
 * beyond this is capped so leaving the tab open for days doesn't
 * dump millions of Fire on the next collect.
 */
export const OFFLINE_CAP_HOURS = 12;
const OFFLINE_CAP_MS = OFFLINE_CAP_HOURS * 60 * 60 * 1000;

// ─── Sprint 3: grow + passive Fire ───────────────────────────────────

/** 0 → 1 over the grow cycle. Clamped. */
export function getGrowProgress(
  plantedAt: number,
  durationMs: number,
  now: number,
): number {
  if (durationMs <= 0) return 1;
  const elapsed = now - plantedAt;
  if (elapsed <= 0) return 0;
  if (elapsed >= durationMs) return 1;
  return elapsed / durationMs;
}

/** True once a Grow Tent's cycle has elapsed. */
export function isReadyToHarvest(
  plantedAt: number,
  durationMs: number,
  now: number,
): boolean {
  return now - plantedAt >= durationMs;
}

/**
 * Whole Fire units accrued since `lastGenerated`, capped at
 * OFFLINE_CAP_HOURS of generation to bound offline rewards.
 */
export function getPendingFire(
  lastGenerated: number,
  perSecond: number,
  now: number,
): number {
  if (perSecond <= 0) return 0;
  const elapsedMs = Math.min(now - lastGenerated, OFFLINE_CAP_MS);
  if (elapsedMs <= 0) return 0;
  return Math.floor((elapsedMs / 1000) * perSecond);
}

// ─── Sprint 4: costs + upgrades ──────────────────────────────────────

/**
 * Leaf cost to upgrade a building at `currentLevel` to `currentLevel + 1`.
 *   L1 → L2 = baseCost * 1.5^0 = baseCost
 *   L2 → L3 = baseCost * 1.5^1
 *   ...
 *   L4 → L5 = baseCost * 1.5^3
 * Rounded up so prices stay whole Leaf.
 */
export function costAtLevel(
  baseCost: number,
  currentLevel: number,
  multiplier = DEFAULT_COST_MULTIPLIER,
): number {
  return Math.ceil(baseCost * Math.pow(multiplier, currentLevel - 1));
}

/**
 * A base stat at level 1, scaled to the given level.
 * Used for harvestYield and firePerSecond.
 */
export function statAtLevel(
  baseStat: number,
  level: number,
  multiplier = DEFAULT_STAT_MULTIPLIER,
): number {
  return baseStat * Math.pow(multiplier, level - 1);
}

/** Integer version of statAtLevel — for displayed yields. */
export function intStatAtLevel(
  baseStat: number,
  level: number,
  multiplier = DEFAULT_STAT_MULTIPLIER,
): number {
  return Math.round(statAtLevel(baseStat, level, multiplier));
}

export function canAfford(leaf: number, cost: number): boolean {
  return leaf >= cost;
}
