// The strain name generator (src/sim/strain_naming.ts).
//
// Every cross is named by the game, never by a player, so what matters here is:
// the name is well-formed, it is not mistaken for a parent, it carries the
// parents audibly, and it is replay-stable for a given rng state (the parity
// gate depends on that last one).

import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng';
import { normalizeStrainName } from '../src/sim/strain_name';
import { nameCross, STRAIN_NAME_POOLS_FOR_TEST } from '../src/sim/strain_naming';

const { HEADS, TAILS } = STRAIN_NAME_POOLS_FOR_TEST;

describe('nameCross', () => {
  it('is deterministic for a given rng state', () => {
    const once = nameCross(new Rng(11), 'Fen Haze', 'Copper Diesel', false);
    const twice = nameCross(new Rng(11), 'Fen Haze', 'Copper Diesel', false);
    expect(once).toBe(twice);
  });

  it('draws a FIXED number of times regardless of the branch taken', () => {
    // The parity gate depends on the draw stream's shape not varying with the
    // names involved, so count draws across deliberately different inputs.
    const draws = (a: string, b: string, landrace: boolean) => {
      const rng = new Rng(5);
      let n = 0;
      rng.setObserver(() => {
        n += 1;
      });
      nameCross(rng, a, b, landrace);
      return n;
    };
    const baseline = draws('Fen Haze', 'Copper Diesel', false);
    expect(draws('Solo', 'Also', false)).toBe(baseline); // single-word parents
    expect(draws('Fen Haze', 'Fen Haze', false)).toBe(baseline); // identical parents
    expect(draws('Fen Haze', 'Copper Diesel', true)).toBe(baseline); // landrace path
  });

  it('always produces a well-formed name', () => {
    const pairs: [string, string][] = [
      ['Fen Haze', 'Copper Diesel'],
      ['Solo', 'Also'],
      ['Fen Haze', 'Fen Haze'],
      ['Old-Growth Bramble Reverie', "Marlow's Pride"],
    ];
    for (const [a, b] of pairs) {
      for (let seed = 0; seed < 40; seed++) {
        const name = nameCross(new Rng(seed), a, b, seed % 3 === 0);
        expect(normalizeStrainName(name), `${a} x ${b} @${seed} -> ${name}`).toBe(name);
      }
    }
  });

  it('never reproduces a parent name exactly', () => {
    for (let seed = 0; seed < 200; seed++) {
      const name = nameCross(new Rng(seed), 'Fen Haze', 'Copper Diesel', false);
      expect(name).not.toBe('Fen Haze');
      expect(name).not.toBe('Copper Diesel');
    }
  });

  it('never reproduces a parent even when both parents are the same strain', () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(nameCross(new Rng(seed), 'Fen Haze', 'Fen Haze', false)).not.toBe('Fen Haze');
    }
  });

  it('carries a parent word through, so lineage is audible', () => {
    // Over many seeds the blend should usually borrow from a parent rather than
    // fall back entirely to the authored pools.
    let borrowed = 0;
    const runs = 100;
    for (let seed = 0; seed < runs; seed++) {
      const name = nameCross(new Rng(seed), 'Fen Haze', 'Copper Diesel', false);
      if (/Fen|Haze|Copper|Diesel/.test(name)) borrowed += 1;
    }
    expect(borrowed).toBeGreaterThan(runs / 2);
  });

  it('marks a landrace with a prestige prefix', () => {
    const name = nameCross(new Rng(3), 'Fen Haze', 'Copper Diesel', true);
    expect(name.startsWith('True ')).toBe(true);
  });

  it('falls back to the authored pools when the parents give it nothing', () => {
    const name = nameCross(new Rng(2), '', '', false);
    expect(normalizeStrainName(name)).toBe(name);
    const [head, tail] = name.split(' ');
    expect(HEADS as readonly string[]).toContain(head);
    expect(TAILS as readonly string[]).toContain(tail);
  });

  it('keeps every authored pool word usable as a name part', () => {
    for (const head of HEADS) {
      for (const tail of TAILS) {
        expect(normalizeStrainName(`${head} ${tail}`), `${head} ${tail}`).not.toBeNull();
      }
    }
  });
});
