// The Vale Cup (src/sim/cup.ts + the pure cupScore in types.ts): the commune's recurring
// growing competition, and the system that gives the whole cultivation roadmap something
// to be for. Covers the scoring weights, the season clock, the entry guards, the board,
// and the client/server scoring parity that lets the window project a score before the
// player spends ten buds.

import { describe, expect, it } from 'vitest';
import { cupSeasonAt, cupSeasonRemaining, cupStandings, scoreStrain } from '../src/sim/cup';
import { NPCS } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import {
  CUP_ENTRY_BUD_COUNT,
  CUP_GRADE_ORDER,
  CUP_SEASON_SECONDS,
  CUP_W_LANDRACE,
  type CupEntry,
  cupScore,
  GENE_MAX,
  type SimEvent,
  STRAIN_MASTERY_MAX,
  type Strain,
} from '../src/sim/types';

const makeSim = () => new Sim({ seed: 42, playerClass: 'warrior', autoEquip: true });

const strain = (over: Partial<Strain> = {}): Strain => ({
  id: 's1',
  baseId: 'common_bloom',
  name: 'Test Bloom',
  genotype: { potency: [1, 1], vigor: [1, 1], yield: [1, 1] },
  landrace: false,
  mastery: 0,
  ...over,
});

describe('cup: the season clock', () => {
  it('derives the season from the sim clock, with no stored schedule to drift', () => {
    expect(cupSeasonAt(0)).toBe(0);
    expect(cupSeasonAt(CUP_SEASON_SECONDS - 1)).toBe(0);
    expect(cupSeasonAt(CUP_SEASON_SECONDS)).toBe(1);
    expect(cupSeasonAt(CUP_SEASON_SECONDS * 3 + 5)).toBe(3);
  });

  it('counts down within the season and resets at the boundary', () => {
    expect(cupSeasonRemaining(0)).toBe(CUP_SEASON_SECONDS);
    expect(cupSeasonRemaining(CUP_SEASON_SECONDS - 10)).toBe(10);
    expect(cupSeasonRemaining(CUP_SEASON_SECONDS)).toBe(CUP_SEASON_SECONDS);
  });
});

describe('cup: scoring', () => {
  it('reads every axis, so no single system is the whole answer', () => {
    const base = cupScore(
      { potency: 1, vigor: 1, yield: 1, landrace: false, mastery: 0 },
      'bud_common',
    );
    const better = cupScore(
      { potency: 4, vigor: 1, yield: 1, landrace: false, mastery: 0 },
      'bud_common',
    );
    const graded = cupScore(
      { potency: 1, vigor: 1, yield: 1, landrace: false, mastery: 0 },
      'bud_prime',
    );
    const mastered = cupScore(
      { potency: 1, vigor: 1, yield: 1, landrace: false, mastery: STRAIN_MASTERY_MAX },
      'bud_common',
    );
    // Genetics, grade, and mastery each move the score on their own.
    expect(better).toBeGreaterThan(base);
    expect(graded).toBeGreaterThan(base);
    expect(mastered).toBeGreaterThan(base);
  });

  it('adds the landrace bonus, and only for a landrace', () => {
    const plain = { potency: 2, vigor: 2, yield: 2, landrace: false, mastery: 0 };
    expect(
      cupScore({ ...plain, landrace: true }, 'bud_common') - cupScore(plain, 'bud_common'),
    ).toBe(CUP_W_LANDRACE);
  });

  it('ranks the bud grades in CUP_GRADE_ORDER, weakest first', () => {
    const s = { potency: 1, vigor: 1, yield: 1, landrace: false, mastery: 0 };
    const scores = CUP_GRADE_ORDER.map((id) => cupScore(s, id));
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
  });

  it('scores an unknown item as no grade rather than throwing', () => {
    const s = { potency: 1, vigor: 1, yield: 1, landrace: false, mastery: 0 };
    expect(cupScore(s, 'not_a_bud')).toBe(cupScore(s, 'bud_common'));
  });

  it('scoreStrain expresses the phenotype, so a hidden recessive never scores', () => {
    // Expressed potency is the DOMINANT allele: 4, not the carried 0.
    const hidden = strain({ genotype: { potency: [4, 0], vigor: [1, 1], yield: [1, 1] } });
    const plain = strain({ genotype: { potency: [4, 4], vigor: [1, 1], yield: [1, 1] } });
    expect(scoreStrain(hidden, 'bud_common')).toBe(scoreStrain(plain, 'bud_common'));
  });

  it('the client projection and the server score are the SAME function', () => {
    // The window projects from a StrainView (expressed tiers only, no genotype); the sim
    // scores from the Strain. Both land on cupScore, so the number shown before you spend
    // ten buds is the number you get.
    const s = strain({
      genotype: { potency: [3, 0], vigor: [2, 1], yield: [4, 4] },
      mastery: 50,
      landrace: false,
    });
    const projected = cupScore(
      { potency: 3, vigor: 2, yield: 4, landrace: false, mastery: 50 },
      'bud_fine',
    );
    expect(scoreStrain(s, 'bud_fine')).toBe(projected);
  });
});

describe('cup: entering over a Sim', () => {
  const standAtSteward = (sim: Sim) => {
    const steward = [...sim.entities.values()].find(
      (e) => e.kind === 'npc' && NPCS[e.templateId]?.cupSteward,
    );
    if (!steward) throw new Error('no Cup Steward in the world');
    sim.player.pos.x = steward.pos.x;
    sim.player.pos.z = steward.pos.z;
  };
  // A strain in the library the ordinary way, then EXACTLY `count` buds to enter with.
  // The harvest itself yields buds, so the bags are normalised rather than topped up:
  // several of these tests assert the exact bud count before and after an entry.
  const ready = (sim: Sim, budId = 'bud_common', count = CUP_ENTRY_BUD_COUNT): string => {
    sim.addItem('common_seed', 1);
    sim.plantSeed(0, 'common_seed');
    sim.plots[0].plantedAt = -100000;
    sim.harvestPlot(0);
    for (const id of CUP_GRADE_ORDER) {
      const held = sim.countItem(id);
      if (held > 0) sim.removeItem(id, held);
    }
    sim.addItem(budId, count);
    standAtSteward(sim);
    return sim.strains[0].id;
  };

  it('posts an entry, spends the buds, and pays the grower', () => {
    const sim = makeSim();
    const id = ready(sim);
    const budsBefore = sim.countItem('bud_common');
    expect(budsBefore).toBe(CUP_ENTRY_BUD_COUNT);
    const copperBefore = sim.copper;

    sim.enterCup(id, 'bud_common');

    expect(sim.cupStandings).toHaveLength(1);
    expect(sim.cupStandings[0].strainName).toBe(sim.strains[0].name);
    expect(sim.cupStandings[0].rank).toBe(1);
    expect(sim.countItem('bud_common')).toBe(budsBefore - CUP_ENTRY_BUD_COUNT);
    expect(sim.copper).toBeGreaterThan(copperBefore); // paid at entry, scaled by score
    expect(sim.cupBest).toBe(sim.cupStandings[0].score);
  });

  it('allows only one entry per grower per season', () => {
    const sim = makeSim();
    const id = ready(sim, 'bud_common', CUP_ENTRY_BUD_COUNT * 2);
    sim.enterCup(id, 'bud_common');
    sim.enterCup(id, 'bud_common');
    expect(sim.cupStandings).toHaveLength(1);
    expect(sim.countItem('bud_common')).toBe(CUP_ENTRY_BUD_COUNT); // the second cost nothing
  });

  it('is rejected away from the Steward, and costs nothing', () => {
    const sim = makeSim();
    const id = ready(sim);
    sim.player.pos.x = 0;
    sim.player.pos.z = 0;
    sim.enterCup(id, 'bud_common');
    expect(sim.cupStandings).toHaveLength(0);
    expect(sim.countItem('bud_common')).toBe(CUP_ENTRY_BUD_COUNT);
  });

  it('is rejected without enough buds', () => {
    const sim = makeSim();
    const id = ready(sim, 'bud_common', CUP_ENTRY_BUD_COUNT - 1);
    sim.enterCup(id, 'bud_common');
    expect(sim.cupStandings).toHaveLength(0);
  });

  it('is rejected for an item that is not a judged bud', () => {
    const sim = makeSim();
    const id = ready(sim);
    sim.addItem('bloom_essence', 50);
    sim.enterCup(id, 'bloom_essence');
    expect(sim.cupStandings).toHaveLength(0);
    expect(sim.countItem('bloom_essence')).toBe(50);
  });

  it('announces the entry world-visibly, because a posted score is public', () => {
    const sim = makeSim();
    const id = ready(sim);
    sim.drainEvents();
    sim.enterCup(id, 'bud_common');
    const ev = sim
      .drainEvents()
      .find((e): e is Extract<SimEvent, { type: 'cupEntry' }> => e.type === 'cupEntry');
    expect(ev).toBeDefined();
    expect(ev?.pid).toBeUndefined(); // no pid: everyone sees it
    expect(ev?.strainName).toBe(sim.strains[0].name);
  });

  it('keeps the personal best after the board clears at a season boundary', () => {
    const sim = makeSim();
    const id = ready(sim);
    sim.enterCup(id, 'bud_common');
    const best = sim.cupBest;
    expect(best).toBeGreaterThan(0);
    // Jump the clock past the season boundary: the board is derived from the clock.
    (sim as unknown as { time: number }).time = CUP_SEASON_SECONDS + 1;
    expect(sim.cupSeason).toBe(1);
    expect(sim.cupStandings).toHaveLength(0); // the board cleared
    expect(sim.cupBest).toBe(best); // the record did not
  });

  it('survives a save/load round-trip', () => {
    const sim = makeSim();
    const id = ready(sim);
    sim.enterCup(id, 'bud_common');
    const best = sim.cupBest;
    const saved = sim.serializeCharacter(sim.playerId)!;
    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    reloaded.addPlayer('warrior', 'Test', { state: saved });
    expect(reloaded.cupBest).toBe(best);
  });
});

describe('cup: the board', () => {
  const entry = (pid: number, score: number, season = 0): CupEntry => ({
    season,
    pid,
    growerName: `G${pid}`,
    strainName: `S${pid}`,
    budItemId: 'bud_common',
    score,
  });

  it('ranks highest first', () => {
    const rows = cupStandings([entry(1, 10), entry(2, 30), entry(3, 20)], 0);
    expect(rows.map((r) => r.pid)).toEqual([2, 3, 1]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('breaks ties on the earlier entry, so posting first is worth something', () => {
    const rows = cupStandings([entry(1, 20), entry(2, 20)], 0);
    expect(rows.map((r) => r.pid)).toEqual([1, 2]);
  });

  it('shows only the running season', () => {
    const rows = cupStandings([entry(1, 10, 0), entry(2, 99, 1)], 0);
    expect(rows.map((r) => r.pid)).toEqual([1]);
  });

  it('carries the grower and strain names, because a strain is known BY someone', () => {
    const [row] = cupStandings([entry(7, 10)], 0);
    expect(row.growerName).toBe('G7');
    expect(row.strainName).toBe('S7');
  });
});

describe('cup: a landrace is an edge, not an automatic win', () => {
  it('a mastered prime-bud entry beats a fresh landrace on common buds', () => {
    const landrace = cupScore(
      { potency: GENE_MAX, vigor: GENE_MAX, yield: GENE_MAX, landrace: true, mastery: 0 },
      'bud_common',
    );
    const worked = cupScore(
      {
        potency: GENE_MAX,
        vigor: GENE_MAX,
        yield: GENE_MAX,
        landrace: false,
        mastery: STRAIN_MASTERY_MAX,
      },
      'bud_prime',
    );
    expect(worked).toBeGreaterThan(landrace);
  });
});
