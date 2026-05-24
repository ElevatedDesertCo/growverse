/**
 * Pure economy functions. No React, no Zustand, no globals.
 * All time math is wall-clock relative — `now` is a parameter so tests can
 * inject a fixed time and these stay deterministic.
 */

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
 * Amount of Fire (whole units) accrued since `lastGenerated` at the given
 * rate. Floored so partial units only count once the next whole unit
 * completes — keeps display + collect math consistent.
 */
export function getPendingFire(
  lastGenerated: number,
  perSecond: number,
  now: number,
): number {
  if (perSecond <= 0) return 0;
  const elapsedSec = (now - lastGenerated) / 1000;
  if (elapsedSec <= 0) return 0;
  return Math.floor(elapsedSec * perSecond);
}
