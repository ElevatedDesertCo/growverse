/**
 * Upgrade system — pure helpers.
 *
 * Owns:
 * - "Cost to upgrade this building from its current level" — supports both
 *   the legacy single-Bloom `costAtLevel` and the v2 multi-resource
 *   `upgradeCosts[level]` ramp.
 * - Affordability check against the full resource bag.
 *
 * No React, no Zustand imports.
 */

import { BUILDINGS, type ResourceCost, type BuildingType } from "@/lib/buildings";
import { costAtLevel, MAX_LEVEL } from "@/lib/economy";
import { canAffordCost, type Resources } from "./resourceSystem";

/**
 * Resource cost for upgrading a building at `currentLevel` to the next.
 * Returns null if the building is at its max level.
 *
 * Resolution order:
 *   1) If the def has a `upgradeCosts` array (v2 buildings), look up
 *      `upgradeCosts[currentLevel - 1]`.
 *   2) Otherwise (legacy buildings), fall back to the v1.1 scalar
 *      `baseCost × multiplier^(level-1)` curve as a single `bloomEssence`
 *      cost.
 */
export function getUpgradeCost(
  type: BuildingType,
  currentLevel: number,
): ResourceCost | null {
  const def = BUILDINGS[type];
  const cap = def.maxLevel ?? MAX_LEVEL;
  if (currentLevel >= cap) return null;

  if (def.upgradeCosts && def.upgradeCosts.length > 0) {
    const idx = currentLevel - 1; // L1→L2 stored at index 0
    return def.upgradeCosts[Math.min(idx, def.upgradeCosts.length - 1)];
  }

  // Legacy fallback: scalar Bloom cost via the v1.1 curve.
  const scalar = costAtLevel(def.baseCost, currentLevel, def.costMultiplier);
  return { bloomEssence: scalar };
}

/** True if the player can afford to upgrade `type` from `currentLevel`. */
export function canAffordUpgrade(
  resources: Resources,
  type: BuildingType,
  currentLevel: number,
): boolean {
  const cost = getUpgradeCost(type, currentLevel);
  if (!cost) return false;
  return canAffordCost(resources, cost);
}

/** True if `type` is already at its tier cap. */
export function isMaxLevel(
  type: BuildingType,
  currentLevel: number,
): boolean {
  const def = BUILDINGS[type];
  const cap = def.maxLevel ?? MAX_LEVEL;
  return currentLevel >= cap;
}
