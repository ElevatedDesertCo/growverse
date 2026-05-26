/**
 * Units — Growers / troops trainable from Training Grounds (Phase 5).
 *
 * Schema-only in v2 Phase 1. The actual unit roster expands as the raid
 * + training systems land. Starter unit ids reserved here so building
 * data can reference them.
 */

import type { ArtPath, ElementId, GuildId, Rarity, ResourceBag } from "./types";

export interface UnitDef {
  id: string;
  name: string;
  guildId: GuildId | null;
  element: ElementId;
  rarity: Rarity;
  /** Base attack power at level 1. */
  attack: number;
  /** Base hit points at level 1. */
  hp: number;
  /** Resources required to train one. */
  trainCost: ResourceBag;
  /** Time to train, in ms. */
  trainTimeMs: number;
  artPath: ArtPath;
  /** Phase at which this unit unlocks. */
  phaseAvailable: number;
}

/** Reserved starter unit ids. Schema only — bodies fill in Phase 5. */
export const UNITS: Record<string, UnitDef> = {};

export const UNIT_ORDER: string[] = [];
