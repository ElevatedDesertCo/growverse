// Strain genetics: the pure inheritance engine behind Growverse's signature breeding
// mechanic. A strain carries a bounded diploid genotype (three traits, two alleles each,
// tiers 0..GENE_MAX). This module holds ONLY the math: expression, breeding, the base and
// view mappings, and the phenotype-to-gameplay curves. It draws randomness through the sim
// `Rng` alone (no Math.random/Date.now), so a given (parents, rng-state, newId) always
// breeds the same offspring: determinism the parity gate depends on.
//
// The library actions that own player state (register-on-harvest, breed, release) live in
// src/sim/cultivation.ts behind the SimContext seam; this file is a host-agnostic leaf a
// Vitest imports directly. `src/sim`-pure: no DOM/Three/render-ui-game-net imports.

import type { Rng } from './rng';
import { nameCross } from './strain_naming';
import {
  GENE_MAX,
  type Genotype,
  STRAIN_TRAITS,
  type Strain,
  type StrainDef,
  type StrainTraitId,
  type StrainView,
} from './types';

// Clamp an allele back into the legal tier band after a mutation.
function clampAllele(v: number): number {
  return v < 0 ? 0 : v > GENE_MAX ? GENE_MAX : v;
}

// The expressed phenotype of a trait: its DOMINANT (higher) allele. The lower allele is
// carried but hidden, so a recessive tier can resurface when this strain is bred.
export function expressTrait(g: Genotype, trait: StrainTraitId): number {
  const [a, b] = g[trait];
  return a > b ? a : b;
}

// A rare phenotype: every trait expresses at the maximum tier. Statistically uncommon to
// reach through breeding, so it reads as a prized landrace.
export function isLandrace(g: Genotype): boolean {
  return STRAIN_TRAITS.every((t) => expressTrait(g, t) === GENE_MAX);
}

// The client-facing view of a strain: expressed phenotype per trait, never the raw
// genotype (the hidden recessive stays server-side).
export function strainView(s: Strain): StrainView {
  return {
    id: s.id,
    baseId: s.baseId,
    name: s.name,
    landrace: s.landrace,
    potency: expressTrait(s.genotype, 'potency'),
    vigor: expressTrait(s.genotype, 'vigor'),
    yield: expressTrait(s.genotype, 'yield'),
    ...(s.lineage ? { lineage: [s.lineage[0], s.lineage[1]] as [string, string] } : {}),
    ...(s.breeder ? { breeder: s.breeder } : {}),
    mastery: s.mastery,
  };
}

// Build a fresh strain instance from base-strain content (the discovery on first harvest).
export function baseStrain(def: StrainDef, id: string): Strain {
  const genotype = cloneGenotype(def.genotype);
  return {
    id,
    baseId: def.baseId,
    name: def.name,
    genotype,
    landrace: isLandrace(genotype),
    mastery: 0,
  };
}

function cloneGenotype(g: Genotype): Genotype {
  return {
    potency: [g.potency[0], g.potency[1]],
    vigor: [g.vigor[0], g.vigor[1]],
    yield: [g.yield[0], g.yield[1]],
  };
}

// Per-allele probability that a mutation nudges it by one tier during breeding. Small, so
// most offspring inherit cleanly and mutation is an occasional surprise, not the norm.
export const MUTATION_CHANCE = 0.08;

// Breed two parent strains into an offspring genotype (Mendelian segregation): for each
// trait the child takes one random allele from parent A and one from parent B, then each
// child allele has MUTATION_CHANCE to shift by +/-1 (clamped to the legal band). Draw
// order is fixed by STRAIN_TRAITS, then A-allele, then B-allele, so it is deterministic.
export function breedGenotype(rng: Rng, a: Genotype, b: Genotype): Genotype {
  const child = {} as Genotype;
  for (const trait of STRAIN_TRAITS) {
    const fromA = rng.pick(a[trait] as unknown as number[]);
    const fromB = rng.pick(b[trait] as unknown as number[]);
    child[trait] = [mutateAllele(rng, fromA), mutateAllele(rng, fromB)];
  }
  return child;
}

// Apply the mutation roll to a single inherited allele. Always draws exactly one rng
// value for the chance and (only on a hit) one more for the direction, so the draw count
// depends only on the outcome, keeping replays stable.
function mutateAllele(rng: Rng, allele: number): number {
  if (!rng.chance(MUTATION_CHANCE)) return allele;
  return clampAllele(allele + (rng.chance(0.5) ? 1 : -1));
}

// Breed two owned strains into a new library strain. The offspring inherits parent A's
// lineage (baseId + name root) so display names stay bounded; its genotype is the bred
// result and its landrace flag is recomputed from expression.
// Cross two strains. `breeder` is the character credited with the cross; omit it
// for a cross with no owner to attribute (tests, tooling).
//
// The offspring is NAMED here rather than inheriting parent A's name, which is
// what it used to do: every cross now blends its parents into a new name, so a
// library reads as a lineage instead of twelve rows all called "Common Bloom".
// The genotype draw happens FIRST and the naming draws after it, so the existing
// inheritance stream is untouched and only the new draws extend it.
export function breed(rng: Rng, a: Strain, b: Strain, newId: string, breeder?: string): Strain {
  const genotype = breedGenotype(rng, a.genotype, b.genotype);
  const landrace = isLandrace(genotype);
  return {
    id: newId,
    baseId: a.baseId,
    name: nameCross(rng, a.name, b.name, landrace),
    genotype,
    landrace,
    lineage: [a.name, b.name],
    ...(breeder ? { breeder } : {}),
    // Mastery is the GROWER's record, not a heritable trait: a brand-new cross is a
    // strain nobody has grown yet, however well its parents were tended.
    mastery: 0,
  };
}

// Fold a donor strain's genetics into a target's, returning the improved genotype. Per
// trait, the target's WEAKER allele is replaced by the donor's STRONGER one when that is
// an upgrade, so the result is never worse than the target on any trait and the pair the
// target carries into future crosses gets better too, not just its expressed tier.
//
// Deterministic (no rng): refining is a deliberate, expensive action, and a guaranteed
// improvement is what makes it worth spending the cost on. It also keeps the cultivation
// slice's rng footprint to the single Epic Bud roll.
//
// Why the weaker slot rather than the stronger: expression takes the higher allele, so
// overwriting the higher one could LOWER the phenotype, and overwriting the lower one can
// only raise it (or leave it alone). That is the whole invariant, in one line.
export function refineGenotype(target: Genotype, donor: Genotype): Genotype {
  const out = cloneGenotype(target);
  for (const trait of STRAIN_TRAITS) {
    const [t0, t1] = out[trait];
    const weakIndex = t0 <= t1 ? 0 : 1;
    const donorBest = expressTrait(donor, trait);
    if (donorBest > out[trait][weakIndex]) out[trait][weakIndex] = donorBest;
  }
  return out;
}

// ---- Phenotype -> gameplay curves -------------------------------------------------
// These map an expressed trait tier (0..GENE_MAX) onto the cultivation payoff. Kept here
// so the tuning lives with the genetics and both plant-time (grow speed) and harvest-time
// (yield, potency) reads share one source. All are pure functions of the tier.

// Vigor shortens grow time: each tier trims a fixed fraction, floored so a maxed strain
// still takes real time. Tier 0 leaves the base grow time unchanged.
export const VIGOR_SPEEDUP_PER_TIER = 0.12; // 12% faster per tier
export const VIGOR_MIN_FACTOR = 0.5; // never faster than half the base time
export function growTimeFactor(vigorTier: number): number {
  const f = 1 - VIGOR_SPEEDUP_PER_TIER * vigorTier;
  return f < VIGOR_MIN_FACTOR ? VIGOR_MIN_FACTOR : f;
}

// Yield adds whole extra units of harvested material: one per tier above 0.
export function yieldBonus(yieldTier: number): number {
  return yieldTier;
}

// Potency gates the premium harvest: at or above this expressed tier, a harvest also
// drops one unit of the concentrated material (bloom_essence), the breeding payoff that
// feeds the strongest Sessions and recipes.
export const POTENCY_ESSENCE_TIER = 2;
export function dropsEssence(potencyTier: number): boolean {
  return potencyTier >= POTENCY_ESSENCE_TIER;
}

// Potency also sets the GRADE of bud a harvest yields, which is what makes one grower's
// product worth more than another's on the market. The bottom two tiers collapse into
// the common grade so that a starter seed and a barely-bred cross read the same: the
// grades above it have to be EARNED by breeding, or they carry no price signal.
//
// Quantity (yieldBonus) and grow time (growTimeFactor) stay separate axes, so breeding
// is a real three-way choice: faster, more, or better.
export const BUD_GRADES = ['bud_common', 'bud_fine', 'bud_prime'] as const;
export type BudGrade = (typeof BUD_GRADES)[number];

export const POTENCY_FINE_TIER = 2;
export const POTENCY_PRIME_TIER = 3;

export function budGrade(potencyTier: number): BudGrade {
  if (potencyTier >= POTENCY_PRIME_TIER) return 'bud_prime';
  if (potencyTier >= POTENCY_FINE_TIER) return 'bud_fine';
  return 'bud_common';
}
