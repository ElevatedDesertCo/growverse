/**
 * Shared cross-component helper: count ready-to-harvest gardens + total
 * pending Amber Forge output across all placed buildings. Pure read —
 * cheap to recompute every tick. Used by the HUD ready-collect badge
 * (ResourceBar) and the Base-tab badge (BottomNav).
 */

import { BUILDINGS } from "@/lib/buildings";
import { getPendingFire, isReadyToHarvest, statAtLevel } from "@/lib/economy";
import type { PlacedBuilding } from "@/lib/store";

export interface ReadyCollectSummary {
  readyGardens: number;
  pendingAmber: number;
}

export function aggregateReadyCollect(
  buildings: PlacedBuilding[],
): ReadyCollectSummary {
  const now = Date.now();
  let readyGardens = 0;
  let pendingAmber = 0;
  for (const b of buildings) {
    const def = BUILDINGS[b.type];
    if (def.growDurationMs && b.plantedAt !== undefined) {
      if (isReadyToHarvest(b.plantedAt, def.growDurationMs, now)) readyGardens++;
    }
    if (def.firePerSecond && b.lastGenerated !== undefined) {
      pendingAmber += getPendingFire(
        b.lastGenerated,
        statAtLevel(def.firePerSecond, b.level),
        now,
      );
    }
  }
  return { readyGardens, pendingAmber };
}
