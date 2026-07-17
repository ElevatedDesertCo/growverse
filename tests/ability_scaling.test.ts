import { describe, expect, it } from 'vitest';
import {
  abilityOutputScale,
  scaleAbilityEffects,
  scaleAbilityOutput,
} from '../src/sim/ability_scaling';
import { abilitiesKnownAt, CLASSES } from '../src/sim/content/classes';
import type { AbilityDef, AbilityEffect } from '../src/sim/types';
import { ABILITY_AUTHORED_CAP_LEVEL, MAX_LEVEL } from '../src/sim/types';

const spellDef = (over: Partial<AbilityDef> = {}): AbilityDef =>
  ({
    id: 'x',
    name: 'X',
    class: 'mage',
    learnLevel: 1,
    cost: 0,
    castTime: 1.5,
    cooldown: 0,
    school: 'frost',
    effects: [],
    ...over,
  }) as AbilityDef;

describe('abilityOutputScale', () => {
  it('is exactly 1 at or below the authored cap (byte-identical sub-cap)', () => {
    for (let lvl = 1; lvl <= ABILITY_AUTHORED_CAP_LEVEL; lvl++) {
      expect(abilityOutputScale('mage', CLASSES.mage, spellDef(), lvl)).toBe(1);
    }
  });

  it('grows above the cap in step with the scaling stat (int for a caster)', () => {
    const at = (lvl: number) =>
      CLASSES.mage.baseStats.int + CLASSES.mage.statsPerLevel.int * (lvl - 1);
    const expected = at(MAX_LEVEL) / at(ABILITY_AUTHORED_CAP_LEVEL);
    expect(abilityOutputScale('mage', CLASSES.mage, spellDef(), MAX_LEVEL)).toBeCloseTo(
      expected,
      6,
    );
    expect(abilityOutputScale('mage', CLASSES.mage, spellDef(), MAX_LEVEL)).toBeGreaterThan(1);
  });

  it('never shrinks an ability whose scaling stat does not grow (>= 1)', () => {
    // a caster physical special scales off Strength; mages gain 0 str/level
    const physical = spellDef({ school: 'physical' });
    expect(CLASSES.mage.statsPerLevel.str).toBe(0);
    expect(abilityOutputScale('mage', CLASSES.mage, physical, MAX_LEVEL)).toBe(1);
  });

  it('uses Ranged AP growth (agi) for a ranged-scaling ability', () => {
    const ranged = spellDef({ class: 'hunter', school: 'nature', scalesWith: 'ranged' });
    const at = (lvl: number) =>
      CLASSES.hunter.baseStats.agi + CLASSES.hunter.statsPerLevel.agi * (lvl - 1);
    const expected = at(MAX_LEVEL) / at(ABILITY_AUTHORED_CAP_LEVEL);
    expect(abilityOutputScale('hunter', CLASSES.hunter, ranged, MAX_LEVEL)).toBeCloseTo(
      expected,
      6,
    );
  });
});

describe('scaleAbilityOutput', () => {
  it('scales damage and healing OUTPUT fields, rounding', () => {
    const dd = scaleAbilityOutput({ type: 'directDamage', min: 66, max: 74 }, 2) as Extract<
      AbilityEffect,
      { type: 'directDamage' }
    >;
    expect(dd).toEqual({ type: 'directDamage', min: 132, max: 148 });
    const dot = scaleAbilityOutput(
      { type: 'dot', total: 100, duration: 12, interval: 3 },
      1.5,
    ) as Extract<AbilityEffect, { type: 'dot' }>;
    expect(dot.total).toBe(150);
    const heal = scaleAbilityOutput({ type: 'heal', min: 40, max: 60 }, 2) as Extract<
      AbilityEffect,
      { type: 'heal' }
    >;
    expect(heal).toEqual({ type: 'heal', min: 80, max: 120 });
  });

  it('leaves buffs, CC, and resource magnitudes untouched', () => {
    const buff: AbilityEffect = { type: 'selfBuff', kind: 'buff_sta', value: 6, duration: 120 };
    expect(scaleAbilityOutput(buff, 4)).toBe(buff);
    const stun: AbilityEffect = { type: 'stun', duration: 3 };
    expect(scaleAbilityOutput(stun, 4)).toBe(stun);
    const res: AbilityEffect = { type: 'gainResource', amount: 20 };
    expect(scaleAbilityOutput(res, 4)).toBe(res);
  });

  it('factor === 1 returns the same effect and array references', () => {
    const eff: AbilityEffect = { type: 'directDamage', min: 1, max: 2 };
    expect(scaleAbilityOutput(eff, 1)).toBe(eff);
    const arr = [eff];
    expect(scaleAbilityEffects(arr, 1)).toBe(arr);
  });
});

describe('abilitiesKnownAt integration', () => {
  it('sub-cap resolution is byte-identical to the authored effects', () => {
    const fb20 = abilitiesKnownAt('mage', ABILITY_AUTHORED_CAP_LEVEL).find(
      (k) => k.def.id === 'frostbolt',
    )!;
    const dd = fb20.effects.find((e) => e.type === 'directDamage') as Extract<
      AbilityEffect,
      { type: 'directDamage' }
    >;
    // authored rank-4 Frostbolt (level 20) is 66-74, unscaled
    expect(dd.min).toBe(66);
    expect(dd.max).toBe(74);
  });

  it('scales flagship damage upward at the level cap', () => {
    const fb100 = abilitiesKnownAt('mage', MAX_LEVEL).find((k) => k.def.id === 'frostbolt')!;
    const dd = fb100.effects.find((e) => e.type === 'directDamage') as Extract<
      AbilityEffect,
      { type: 'directDamage' }
    >;
    expect(dd.min).toBeGreaterThan(66);
    expect(dd.max).toBeGreaterThan(74);
    // grows with the mage's Intellect (about 4x from level 20 to 100)
    expect(dd.max / 74).toBeCloseTo(
      abilityOutputScale('mage', CLASSES.mage, fb100.def, MAX_LEVEL),
      1,
    );
  });
});
