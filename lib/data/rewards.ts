/**
 * Reward bundles — reusable payouts attached to chapters, quests, raids,
 * achievements, daily rewards, booster pack milestones.
 *
 * A reward is any combination of: resources, unlocked character/pet/building
 * ids, card ids, and free-form flag-style unlocks.
 *
 * Schema only in v2 Phase 1.
 */

import type { ResourceBag } from "./types";

export interface RewardBundle {
  id: string;
  /** Display name for tooltips. */
  name: string;
  /** Resources granted. */
  resources?: ResourceBag;
  /** CHARACTERS ids unlocked. */
  characters?: string[];
  /** SPIRIT_PETS ids unlocked. */
  spiritPets?: string[];
  /** BUILDINGS type ids unlocked for the BuildMenu. */
  buildings?: string[];
  /** CARDS ids granted directly. */
  cards?: string[];
  /** Free-form game-progression flags this reward sets. */
  flags?: string[];
}

export const REWARDS: Record<string, RewardBundle> = {
  ch1_complete: {
    id: "ch1_complete",
    name: "Portal Awakening completion",
    resources: { bloomEssence: 10 },
    characters: ["anderz", "solace"],
    spiritPets: ["solace"],
    flags: ["tutorialComplete"],
  },
  ch2_complete: {
    id: "ch2_complete",
    name: "Reality Has Trust Issues completion",
    resources: { bloomEssence: 25, relicFragments: 1 },
    characters: ["raiin"],
    spiritPets: ["vyrra"],
  },
};

export const REWARD_ORDER: string[] = ["ch1_complete", "ch2_complete"];
