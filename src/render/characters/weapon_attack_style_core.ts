import { ABILITIES } from '../../sim/data';

// Ported from upstream (levy-street/world-of-claudecraft) at the same path so
// future re-syncs stay a straight file copy. Upstream also exports
// `weaponAttackStyle` (twohand vs dualwield), which is omitted here: Growverse
// weapons carry no `hand` field, so there is nothing for it to read.

const ABILITY_ID_BY_NAME = new Map(
  Object.entries(ABILITIES).map(([abilityId, ability]) => [ability.name, abilityId]),
);
const SPIN_ATTACK_ABILITIES = new Set(['whirlwind', 'bladestorm']);

/** Damage events carry player-facing ability names. Normalize those names back
 *  to their stable IDs before choosing a renderer-only animation cue. */
export function attackAbilityId(nameOrId: string | null): string | undefined {
  if (!nameOrId) return undefined;
  return ABILITIES[nameOrId] ? nameOrId : ABILITY_ID_BY_NAME.get(nameOrId);
}

export function isSpinAttackAbility(abilityId: string | undefined): boolean {
  return abilityId !== undefined && SPIN_ATTACK_ABILITIES.has(abilityId);
}
