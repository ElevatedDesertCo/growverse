/**
 * Quests — Phase 3 system.
 *
 * Schema-only in v2 Phase 1. The quest log + tracker logic ships in
 * Phase 3 alongside chapters and dialogue boxes.
 */

import type { ResourceBag } from "./types";

export type QuestObjectiveKind =
  | "place" // place N buildings of a given type
  | "harvest" // harvest N times from a given type
  | "collect" // collect N total of a given resource
  | "upgradeTo" // upgrade any building to level N
  | "raidWin" // win N raids
  | "openCard" // open N booster packs / cards
  | "chapter"; // complete a story chapter

export interface QuestObjective {
  kind: QuestObjectiveKind;
  /** Free-form target ref (building id, resource id, chapter id, etc.). */
  target?: string;
  /** Required count. */
  count: number;
}

export interface QuestDef {
  id: string;
  name: string;
  description: string;
  objectives: QuestObjective[];
  rewards: ResourceBag;
  /** Other id rewards (cards, pets, character unlocks). */
  rewardUnlocks?: string[];
  /** Phase at which this quest is offered. */
  phaseAvailable: number;
}

export const QUESTS: Record<string, QuestDef> = {};
export const QUEST_ORDER: string[] = [];
