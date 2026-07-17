// Ability-rank extrapolation past the authored cap.
//
// Ability damage and healing are hand-authored as discrete ranks up to
// ABILITY_AUTHORED_CAP_LEVEL (the original level cap). Above it the derived
// combat ratings (Attack Power / Ranged AP / Spell Power) keep climbing with the
// character's stats, but the authored base numbers stop, so a level-100 nuke
// would be almost entirely Spell-Power rider and its authored base would be
// irrelevant. To keep each ability's OUTPUT balanced against the rating that
// scales it, we multiply the authored base damage/healing by the growth of that
// rating from the authored cap to the current level.
//
// This is deliberately narrow: it scales only damage and healing OUTPUT fields.
// Buffs, crowd control, resource gains, and other utility magnitudes are left as
// authored (scaling a self-buff AP aura would feed back into the very rating this
// uses, and buff/CC balance is a separate concern). The factor is 1 at or below
// the authored cap, so sub-cap resolution stays byte-identical to the data.
//
// Pure and host-agnostic (imports only types), unit-tested directly in
// tests/ability_scaling.test.ts and consumed by content/classes.ts
// (abilitiesKnownAt).

import type { AbilityDef, AbilityEffect, PlayerClass, Stats } from './types';
import { ABILITY_AUTHORED_CAP_LEVEL } from './types';

// The class stat data this module reads. A structural subset of ClassDef (which
// lives in content/classes.ts) so this stays a pure leaf with no cycle back into
// the content layer.
export interface ClassStatSource {
  baseStats: Stats;
  statsPerLevel: Stats;
}

// The stat total a class has at a given level (base + per-level growth), before
// gear or auras. Mirrors the linear stat model in entity.ts recalcPlayerStats.
function statAt(cls: ClassStatSource, key: 'str' | 'agi' | 'int', level: number): number {
  return cls.baseStats[key] + cls.statsPerLevel[key] * (level - 1);
}

// The pre-gear combat rating that scales this ability, mirroring
// abilityScalingPower (which rating) + recalcPlayerStats (the stat formula).
// Ranged shots scale off Ranged AP (2/agi for hunters); physical specials off
// melee Attack Power (per-class stat mix); everything else off Spell Power
// (int). The SPELL_POWER_PER_INT / AP-per-stat constants cancel in the ratio, so
// only the stat totals matter here.
function scalingRatingAt(
  clsId: PlayerClass,
  cls: ClassStatSource,
  def: AbilityDef,
  level: number,
): number {
  if (def.scalesWith === 'ranged') return statAt(cls, 'agi', level) * 2;
  if (def.school === 'physical') {
    if (clsId === 'warrior' || clsId === 'paladin' || clsId === 'shaman' || clsId === 'druid') {
      return statAt(cls, 'str', level) * 2;
    }
    if (clsId === 'rogue' || clsId === 'hunter') {
      return statAt(cls, 'str', level) + statAt(cls, 'agi', level);
    }
    return statAt(cls, 'str', level);
  }
  return statAt(cls, 'int', level);
}

// Multiplier applied to an ability's authored base damage/healing at `level`.
// 1 at or below the authored cap; above it, the growth of the ability's scaling
// rating from the cap to `level`. Clamped to >= 1 so a stat that does not grow
// (e.g. a caster's Strength) never shrinks an ability, and returns 1 if the
// baseline rating is zero (the ability's stat does not scale for this class).
export function abilityOutputScale(
  clsId: PlayerClass,
  cls: ClassStatSource,
  def: AbilityDef,
  level: number,
): number {
  if (level <= ABILITY_AUTHORED_CAP_LEVEL) return 1;
  const baseline = scalingRatingAt(clsId, cls, def, ABILITY_AUTHORED_CAP_LEVEL);
  if (baseline <= 0) return 1;
  const now = scalingRatingAt(clsId, cls, def, level);
  return Math.max(1, now / baseline);
}

// Scale one effect's damage/healing OUTPUT fields by `factor`, cloning so the
// shared authored data is never mutated. factor === 1 returns the effect
// unchanged (same reference). Non-output effects (buffs, CC, resource, utility)
// pass through untouched.
export function scaleAbilityOutput(eff: AbilityEffect, factor: number): AbilityEffect {
  if (factor === 1) return eff;
  const s = (n: number) => Math.round(n * factor);
  switch (eff.type) {
    case 'directDamage':
    case 'aoeDamage':
    case 'aoeRoot':
    case 'drainTick':
      return { ...eff, min: s(eff.min), max: s(eff.max) };
    case 'groundAoE':
      return { ...eff, min: s(eff.min), max: s(eff.max) };
    case 'dot':
      return { ...eff, total: s(eff.total) };
    case 'heal':
      return { ...eff, min: s(eff.min), max: s(eff.max) };
    case 'hot':
      return { ...eff, total: s(eff.total) };
    case 'absorb':
      return { ...eff, amount: s(eff.amount) };
    case 'weaponDamage':
    case 'weaponStrike':
      return { ...eff, bonus: s(eff.bonus) };
    case 'finisherDamage':
      return { ...eff, base: s(eff.base), perCombo: s(eff.perCombo) };
    case 'imbue':
      return {
        ...eff,
        bonus: s(eff.bonus),
        judgeMin: eff.judgeMin === undefined ? undefined : s(eff.judgeMin),
        judgeMax: eff.judgeMax === undefined ? undefined : s(eff.judgeMax),
      };
    default:
      return eff;
  }
}

// Scale every effect's output fields by `factor`. Returns the same array
// reference when factor === 1 (sub-cap: no allocation, byte-identical).
export function scaleAbilityEffects(effects: AbilityEffect[], factor: number): AbilityEffect[] {
  if (factor === 1) return effects;
  return effects.map((e) => scaleAbilityOutput(e, factor));
}
