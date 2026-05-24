/**
 * Raids — corrupted camps and ruined zones the player attacks.
 *
 * Schema only in v2 Phase 1. Raid map + battle MVP lands in Phase 5.
 */

import type { ArtPath, ElementId, ResourceBag } from "./types";

export type RaidDifficulty = "trivial" | "easy" | "normal" | "hard" | "elite";

export interface RaidDef {
  id: string;
  name: string;
  /** Backdrop element / theme of the corrupted zone. */
  zoneElement: ElementId;
  difficulty: RaidDifficulty;
  /** Total enemy squad power — opposes player squad power. */
  enemyPower: number;
  /** Resource + unlock cost to attempt. */
  cost: ResourceBag;
  /** Guaranteed rewards on win. */
  rewards: ResourceBag;
  /** Possible card drops on win (CARDS ids). */
  cardDrops?: string[];
  artPath: ArtPath;
  phaseAvailable: number;
}

export const RAIDS: Record<string, RaidDef> = {};
export const RAID_ORDER: string[] = [];
