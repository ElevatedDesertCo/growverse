// Professions: the skill math and the train action behind every levelable skill
// (the roster and who trains each one is documented at ProfessionId in types.ts).
// A player's standing in a profession is a single points total 0..PROFESSION_MAX
// (PlayerMeta.professions), raised deterministically when the matching action
// succeeds: harvest.ts on a world node, cultivation.ts on a garden bed, sim.ts on
// a fish catch, crafting.ts at a station. Draws NO rng and reads no clock: skill
// gains are deterministic point adds, so working a skill never forks the world.
// `src/sim`-pure. Character-sheet reads go through professionsView.

import {
  type CraftStation,
  PROFESSION_IDS,
  PROFESSION_MAX,
  PROFESSION_SKILL_PER_GATHER,
  type ProfessionId,
  type ProfessionSkills,
  type ProfessionView,
} from './types';

// Which skill a crafting station trains (and, via CraftRecipe.requiredProfession,
// gates its own deeper recipes on). One map rather than a check per recipe, so a new
// station is a one-line change and can never silently train nothing. The Grow Station
// trains cultivation: processing your buds is the back half of the same grow loop the
// garden bed trains, not a separate craft.
export const STATION_PROFESSION: Record<CraftStation, ProfessionId> = {
  grow: 'cultivation',
  cook: 'cooking',
  alchemy: 'alchemy',
  upgrade: 'smithing',
  enchant: 'enchanting',
};

// A fresh skill ledger (character create + load default): every profession at 0.
export function emptyProfessions(): ProfessionSkills {
  return {
    mining: 0,
    herbalism: 0,
    logging: 0,
    cultivation: 0,
    breeding: 0,
    fishing: 0,
    cooking: 0,
    alchemy: 0,
    smithing: 0,
    enchanting: 0,
    lockpicking: 0,
  };
}

// Clamp a raw skill value into the legal band.
function clampSkill(skill: number): number {
  return skill < 0 ? 0 : skill > PROFESSION_MAX ? PROFESSION_MAX : Math.floor(skill);
}

// Train a profession by one successful action: raise its skill by `points` (one gather's
// worth by default), capped at PROFESSION_MAX. Returns the new skill value. `points` exists
// for the actions that are not all the same size: a delve chest solved on the premium ante
// is a three-page flawless gauntlet, not one modest lock, so it is worth more than a swing
// at an ore vein. Deterministic (no rng, no clock).
export function trainProfession(
  skills: ProfessionSkills,
  prof: ProfessionId,
  points: number = PROFESSION_SKILL_PER_GATHER,
): number {
  const next = clampSkill(skills[prof] + points);
  skills[prof] = next;
  return next;
}

// The client-facing read: one ProfessionView per profession, in PROFESSION_IDS order.
export function professionsView(skills: ProfessionSkills): ProfessionView[] {
  return PROFESSION_IDS.map((id) => ({ id, skill: clampSkill(skills[id]), max: PROFESSION_MAX }));
}

// Persistence: a plain skills record for CharacterState. Undefined fields default to 0, so
// a save from before professions existed (or a partial one) loads cleanly.
export function serializeProfessions(skills: ProfessionSkills): ProfessionSkills {
  const out = emptyProfessions();
  for (const id of PROFESSION_IDS) out[id] = skills[id];
  return out;
}

export function restoreProfessions(saved: Partial<ProfessionSkills> | undefined): ProfessionSkills {
  const out = emptyProfessions();
  if (saved) {
    for (const id of PROFESSION_IDS) out[id] = clampSkill(saved[id] ?? 0);
  }
  return out;
}
