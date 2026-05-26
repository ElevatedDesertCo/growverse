/**
 * Building system — pure helpers.
 *
 * Owns:
 * - Guild Core level lookup from current buildings.
 * - Whether a building type is unlocked at the player's current Core level.
 * - Aggregate storage bonus across all Storage Vaults.
 *
 * No React, no Zustand imports.
 */

import { BUILDINGS, type BuildingType } from "@/lib/buildings";
import type { PlacedBuilding } from "@/lib/store";
import { statAtLevel } from "@/lib/economy";

/**
 * Current Guild Core level. Returns 0 if no Core is placed yet — that
 * signals "tutorial / fresh start" state and gates everything except
 * the Core itself.
 */
export function getGuildCoreLevel(buildings: PlacedBuilding[]): number {
  const core = buildings.find((b) => b.type === "guildCore");
  return core ? core.level : 0;
}

/**
 * True if the given building type can appear in the BuildMenu given the
 * current Core level. The Core itself is always shown (unlockCoreLevel:0).
 */
export function isUnlockedAtCoreLevel(
  type: BuildingType,
  coreLevel: number,
): boolean {
  return coreLevel >= BUILDINGS[type].unlockCoreLevel;
}

/**
 * Total extra storage from all Storage Vaults, summed across instances
 * and tier-scaled per Vault level via statAtLevel.
 */
export function getTotalStorageBonus(buildings: PlacedBuilding[]): number {
  let total = 0;
  for (const b of buildings) {
    const def = BUILDINGS[b.type];
    if (def.storageBonus === undefined) continue;
    total += Math.round(statAtLevel(def.storageBonus, b.level));
  }
  return total;
}

/** True if at least one Guild Core exists (the player has "started" the game). */
export function hasGuildCore(buildings: PlacedBuilding[]): boolean {
  return buildings.some((b) => b.type === "guildCore");
}
