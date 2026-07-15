// Gathering professions: the skill math and the train action for Mining / Herbalism /
// Logging. A player's standing in a profession is a single points total 0..PROFESSION_MAX
// (PlayerMeta.professions), raised deterministically when a world node of that profession
// is worked (harvest.ts calls trainProfession on a successful gather). Draws NO rng and
// reads no clock: skill gains are deterministic point adds, so gathering never forks the
// world. `src/sim`-pure. Character-sheet reads go through professionsView.

import {
  PROFESSION_IDS,
  PROFESSION_MAX,
  PROFESSION_SKILL_PER_GATHER,
  type ProfessionId,
  type ProfessionSkills,
  type ProfessionView,
} from './types';

// A fresh skill ledger (character create + load default): every profession at 0.
export function emptyProfessions(): ProfessionSkills {
  return { mining: 0, herbalism: 0, logging: 0 };
}

// Clamp a raw skill value into the legal band.
function clampSkill(skill: number): number {
  return skill < 0 ? 0 : skill > PROFESSION_MAX ? PROFESSION_MAX : Math.floor(skill);
}

// Train a profession by one gather: raise its skill by PROFESSION_SKILL_PER_GATHER, capped
// at PROFESSION_MAX. Returns the new skill value. Deterministic (no rng, no clock).
export function trainProfession(skills: ProfessionSkills, prof: ProfessionId): number {
  const next = clampSkill(skills[prof] + PROFESSION_SKILL_PER_GATHER);
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
  return { mining: skills.mining, herbalism: skills.herbalism, logging: skills.logging };
}

export function restoreProfessions(saved: Partial<ProfessionSkills> | undefined): ProfessionSkills {
  const out = emptyProfessions();
  if (saved) {
    for (const id of PROFESSION_IDS) out[id] = clampSkill(saved[id] ?? 0);
  }
  return out;
}
