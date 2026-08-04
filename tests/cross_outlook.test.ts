import { describe, expect, it } from 'vitest';
import { breedGenotype, expressTrait } from '../src/sim/genetics';
import { Rng } from '../src/sim/rng';
import {
  crossCanReachLandrace,
  crossOutlook,
  GENE_MAX,
  type Genotype,
  STRAIN_TRAITS,
  traitOutlook,
} from '../src/sim/types';

// The pre-cross outlook shown in the Breeding window. Two things are being asserted, and
// the second matters more than the first:
//
//   1. the numbers are what they claim (target, ceiling, the at-least bound);
//   2. the bound is a genuine LOWER bound against the real breeding engine, and the
//      outlook depends ONLY on the expressed phenotype.
//
// (2) is the design constraint, not an implementation detail. Exact odds are computable
// from two genotypes, but they would let a player invert the distribution and read the
// hidden recessive alleles, and a recessive tier resurfacing is the reason to make a cross
// at all. So the last test here pins that two parents with IDENTICAL expression but
// different hidden alleles produce the identical outlook: if that ever fails, the preview
// has started leaking the genotype.

const g = (p: [number, number], v: [number, number], y: [number, number]): Genotype => ({
  potency: p,
  vigor: v,
  yield: y,
});

/** Expressed view of a genotype, the shape crossOutlook consumes. */
const view = (x: Genotype) => ({
  potency: expressTrait(x, 'potency'),
  vigor: expressTrait(x, 'vigor'),
  yield: expressTrait(x, 'yield'),
});

describe('traitOutlook', () => {
  it('aims at the better parent and allows one mutation tier above it', () => {
    const o = traitOutlook('potency', 1, 2);
    expect(o.target).toBe(2);
    expect(o.ceiling).toBe(3);
  });

  it('clamps the ceiling at GENE_MAX', () => {
    expect(traitOutlook('potency', GENE_MAX, GENE_MAX).ceiling).toBe(GENE_MAX);
  });

  it('is certain when the target is the floor tier', () => {
    // Every tier is >= 0, so "at least 0" needs no probability argument.
    expect(traitOutlook('yield', 0, 0).atLeastTargetPct).toBe(100);
  });

  it('rates two parents at the target above one', () => {
    const both = traitOutlook('vigor', 2, 2).atLeastTargetPct;
    const one = traitOutlook('vigor', 2, 1).atLeastTargetPct;
    expect(both).toBeGreaterThan(one);
    // One contributing parent: a 1/2 allele pick that survives mutation at its tier.
    expect(one).toBe(48);
    // Two: the chance neither contributes is (1 - 0.48) squared.
    expect(both).toBe(73);
  });

  it('is symmetric in its parents', () => {
    expect(traitOutlook('potency', 3, 1)).toEqual(traitOutlook('potency', 1, 3));
  });
});

describe('crossOutlook', () => {
  it('returns one entry per trait in the fixed order', () => {
    const o = crossOutlook(view(g([1, 0], [2, 1], [3, 3])), view(g([2, 2], [0, 0], [1, 0])));
    expect(o.map((x) => x.trait)).toEqual([...STRAIN_TRAITS]);
  });

  it('flags a landrace as reachable only when every trait can top out', () => {
    const top = view(g([3, 3], [3, 3], [3, 3]));
    const nearly = view(g([2, 2], [3, 3], [3, 3]));
    const low = view(g([0, 0], [3, 3], [3, 3]));
    expect(crossCanReachLandrace(crossOutlook(top, top))).toBe(true);
    // 2 + a mutation reaches 3, so this pairing can still get there.
    expect(crossCanReachLandrace(crossOutlook(nearly, nearly))).toBe(true);
    // 0 cannot reach 3 in one cross however the mutation falls.
    expect(crossCanReachLandrace(crossOutlook(low, low))).toBe(false);
  });

  it('does not depend on the hidden allele', () => {
    // The design constraint. Same expressed tiers, very different recessives: if the
    // outlook differed, a player could diff the two and read the hidden genotype.
    const shallow = g([2, 2], [1, 1], [3, 3]);
    const deep = g([2, 0], [1, 0], [3, 0]);
    expect(view(shallow)).toEqual(view(deep));
    expect(crossOutlook(view(shallow), view(deep))).toEqual(
      crossOutlook(view(deep), view(shallow)),
    );
    expect(crossOutlook(view(shallow), view(shallow))).toEqual(
      crossOutlook(view(deep), view(deep)),
    );
  });
});

describe('the bound holds against the real breeding engine', () => {
  // The claim on the tin is "at least N%". Breed each pairing many times through the
  // actual engine and confirm the observed rate never falls below the advertised bound,
  // and that nothing ever exceeds the advertised ceiling.
  const pairs: Array<[Genotype, Genotype]> = [
    [g([2, 2], [2, 2], [2, 2]), g([2, 2], [2, 2], [2, 2])],
    [g([3, 3], [1, 1], [2, 2]), g([1, 0], [1, 0], [2, 1])],
    [g([2, 0], [3, 0], [1, 1]), g([2, 2], [0, 0], [3, 3])],
    [g([0, 0], [0, 0], [0, 0]), g([3, 3], [3, 3], [3, 3])],
  ];

  for (const [i, [a, b]] of pairs.entries()) {
    it(`pairing ${i} never underperforms its bound or exceeds its ceiling`, () => {
      const outlook = crossOutlook(view(a), view(b));
      const runs = 4000;
      const hits = new Map<string, number>();
      const rng = new Rng(1234 + i);
      for (let n = 0; n < runs; n++) {
        const child = breedGenotype(rng, a, b);
        for (const o of outlook) {
          const e = expressTrait(child, o.trait);
          expect(e).toBeLessThanOrEqual(o.ceiling);
          if (e >= o.target) hits.set(o.trait, (hits.get(o.trait) ?? 0) + 1);
        }
      }
      for (const o of outlook) {
        const observed = ((hits.get(o.trait) ?? 0) / runs) * 100;
        // A lower bound with sampling slack: the observed rate must not fall meaningfully
        // below what the UI promises.
        expect(observed).toBeGreaterThanOrEqual(o.atLeastTargetPct - 3);
      }
    });
  }
});
