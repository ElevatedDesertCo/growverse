// Strain genetics: the pure inheritance engine (src/sim/genetics.ts) and the stateful
// library actions over a live Sim (src/sim/strain_library.ts). Breeding draws through the
// sim Rng, so every cross is asserted deterministic; expression, mutation bounds, the
// phenotype curves, discovery-on-harvest, the library cap/cost guards, and a full
// save/load round-trip are all covered.

import { describe, expect, it } from 'vitest';
import { NPCS, PLANTS } from '../src/sim/data';
import {
  breed,
  breedGenotype,
  budGrade,
  dropsEssence,
  expressTrait,
  growTimeFactor,
  isLandrace,
  strainView,
  VIGOR_MIN_FACTOR,
  yieldBonus,
} from '../src/sim/genetics';
import { Rng } from '../src/sim/rng';
import { Sim } from '../src/sim/sim';
import { BREED_COST_COUNT, BREED_COST_ITEM } from '../src/sim/strain_library';
import {
  GENE_MAX,
  type Genotype,
  MAX_STRAINS,
  type PlayerClass,
  STRAIN_TRAITS,
  type Strain,
} from '../src/sim/types';

const g = (p: [number, number], v: [number, number], y: [number, number]): Genotype => ({
  potency: p,
  vigor: v,
  yield: y,
});

const strain = (id: string, genotype: Genotype, name = 'Test Bloom'): Strain => ({
  id,
  baseId: 'test',
  name,
  genotype,
  landrace: isLandrace(genotype),
});

const makeSim = (cls: PlayerClass = 'warrior', seed = 42) =>
  new Sim({ seed, playerClass: cls, autoEquip: true });
// Grow + harvest a seed to completion (discovers its base strain). Rather than tick
// through the full grow time (thousands of ticks), backdate plantedAt so the plot reads
// ready immediately: growth is a pure time delta, so this is behaviorally identical and
// keeps the suite fast.
// Breeding is station-gated: crossing happens AT the Breeding Chamber, which the
// Cultivator keeps. Park the player on him so a test exercises the cross itself
// rather than the proximity guard (there is a dedicated test for that guard).
const standAtChamber = (sim: Sim) => {
  const keeper = [...sim.entities.values()].find(
    (e) => e.kind === 'npc' && NPCS[e.templateId]?.crafting === 'grow',
  );
  if (!keeper) throw new Error('no Breeding Chamber keeper in the world');
  sim.player.pos.x = keeper.pos.x;
  sim.player.pos.z = keeper.pos.z;
};
const growAndHarvest = (sim: Sim, seedItemId: string, plot = 0) => {
  sim.addItem(seedItemId, 1);
  sim.plantSeed(plot, seedItemId);
  const now = (sim as unknown as { time: number }).time;
  sim.plots[plot].plantedAt = now - PLANTS[seedItemId].growSeconds - 1;
  sim.harvestPlot(plot);
};

describe('genetics: expression', () => {
  it('expresses the dominant (higher) allele per trait', () => {
    const geno = g([2, 0], [1, 3], [0, 0]);
    expect(expressTrait(geno, 'potency')).toBe(2);
    expect(expressTrait(geno, 'vigor')).toBe(3);
    expect(expressTrait(geno, 'yield')).toBe(0);
  });

  it('flags a landrace only when every trait expresses at GENE_MAX', () => {
    expect(isLandrace(g([GENE_MAX, 0], [0, GENE_MAX], [GENE_MAX, 1]))).toBe(true);
    expect(isLandrace(g([GENE_MAX, 0], [0, GENE_MAX], [1, 1]))).toBe(false);
  });

  it('strainView exposes expressed phenotype, not the raw alleles', () => {
    const view = strainView(strain('s1', g([3, 1], [2, 0], [1, 1]), 'Kush'));
    expect(view).toMatchObject({ id: 's1', name: 'Kush', potency: 3, vigor: 2, yield: 1 });
    // The hidden recessive alleles (1, 0) are not present on the view.
    expect(Object.values(view)).not.toContain(0);
  });
});

describe('genetics: phenotype -> gameplay curves', () => {
  it('vigor shortens grow time, floored at VIGOR_MIN_FACTOR', () => {
    expect(growTimeFactor(0)).toBe(1);
    expect(growTimeFactor(1)).toBeLessThan(1);
    expect(growTimeFactor(GENE_MAX)).toBeGreaterThanOrEqual(VIGOR_MIN_FACTOR);
    // Even an out-of-band tier can never dip below the floor.
    expect(growTimeFactor(99)).toBe(VIGOR_MIN_FACTOR);
  });

  it('yield adds one unit per tier; potency gates the essence drop', () => {
    expect(yieldBonus(0)).toBe(0);
    expect(yieldBonus(3)).toBe(3);
    expect(dropsEssence(0)).toBe(false);
    expect(dropsEssence(1)).toBe(false);
    expect(dropsEssence(2)).toBe(true);
    expect(dropsEssence(3)).toBe(true);
  });
});

describe('genetics: breeding', () => {
  it('is deterministic for a given rng seed (same parents -> same offspring)', () => {
    const a = strain('a', g([2, 1], [1, 2], [2, 1]));
    const b = strain('b', g([3, 0], [2, 1], [0, 3]));
    const run = () => breed(new Rng(7), a, b, 'child').genotype;
    expect(run()).toEqual(run());
  });

  it('segregates one allele from each parent per trait (within-bounds)', () => {
    // With no mutation reachable at these tiers we still assert each child allele came
    // from the matching parent OR a +/-1 mutation of it, and stays in 0..GENE_MAX.
    const a = g([2, 2], [1, 1], [3, 3]);
    const b = g([0, 0], [2, 2], [1, 1]);
    for (let seed = 0; seed < 50; seed++) {
      const child = breedGenotype(new Rng(seed), a, b);
      for (const t of STRAIN_TRAITS) {
        const [c0, c1] = child[t];
        expect(c0).toBeGreaterThanOrEqual(0);
        expect(c0).toBeLessThanOrEqual(GENE_MAX);
        expect(c1).toBeGreaterThanOrEqual(0);
        expect(c1).toBeLessThanOrEqual(GENE_MAX);
        // allele 0 derives from parent A's alleles (+/-1), allele 1 from parent B's.
        expect(Math.min(...a[t].map((v) => Math.abs(v - c0)))).toBeLessThanOrEqual(1);
        expect(Math.min(...b[t].map((v) => Math.abs(v - c1)))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('offspring inherits parent A baseId but gets its OWN generated name', () => {
    const a = strain('a', g([1, 1], [1, 1], [1, 1]), 'Alpha');
    const b = strain('b', g([2, 2], [2, 2], [2, 2]), 'Beta');
    b.baseId = 'beta';
    const child = breed(new Rng(3), a, b, 'c');
    expect(child.baseId).toBe('test'); // a.baseId
    // The name used to be copied from parent A, which left a whole library
    // reading as one strain. A cross is now named from its parents instead.
    expect(child.name).not.toBe('Alpha');
    expect(child.name).not.toBe('Beta');
    expect(child.name.length).toBeGreaterThan(0);
  });

  it('records both parents as lineage, oldest-first, and credits the breeder', () => {
    const a = strain('a', g([1, 1], [1, 1], [1, 1]), 'Alpha');
    const b = strain('b', g([2, 2], [2, 2], [2, 2]), 'Beta');
    const child = breed(new Rng(3), a, b, 'c', 'Grower');
    expect(child.lineage).toEqual(['Alpha', 'Beta']);
    expect(child.breeder).toBe('Grower');
  });

  it('leaves breeder unset when no one is credited', () => {
    const a = strain('a', g([1, 1], [1, 1], [1, 1]), 'Alpha');
    const b = strain('b', g([2, 2], [2, 2], [2, 2]), 'Beta');
    expect(breed(new Rng(3), a, b, 'c').breeder).toBeUndefined();
  });

  it('names the same cross identically for the same rng state (replay-stable)', () => {
    const mk = () => {
      const a = strain('a', g([1, 1], [1, 1], [1, 1]), 'Alpha');
      const b = strain('b', g([2, 2], [2, 2], [2, 2]), 'Beta');
      return breed(new Rng(7), a, b, 'c', 'Grower');
    };
    expect(mk().name).toBe(mk().name);
  });
});

describe('strain library: discovery + breeding over a Sim', () => {
  it('harvesting a base seed discovers its strain exactly once', () => {
    const sim = makeSim();
    expect(sim.strains).toHaveLength(0);
    growAndHarvest(sim, 'common_seed');
    expect(sim.strains).toHaveLength(1);
    expect(sim.strains[0]).toMatchObject({ baseId: 'common_bloom', name: 'Common Bloom' });
    // A second harvest of the same lineage does not duplicate it.
    growAndHarvest(sim, 'common_seed');
    expect(sim.strains.filter((s) => s.baseId === 'common_bloom')).toHaveLength(1);
  });

  it('crossing two owned strains consumes Bloom Extract and adds a new strain', () => {
    const sim = makeSim();
    growAndHarvest(sim, 'common_seed', 0);
    growAndHarvest(sim, 'enriched_seed', 1);
    expect(sim.strains).toHaveLength(2);
    const [a, b] = sim.strains;
    const before = sim.countItem(BREED_COST_ITEM);
    expect(before).toBeGreaterThanOrEqual(BREED_COST_COUNT);
    standAtChamber(sim);
    sim.breedStrains(a.id, b.id);
    expect(sim.strains).toHaveLength(3);
    expect(sim.countItem(BREED_COST_ITEM)).toBe(before - BREED_COST_COUNT);
  });

  it('rejects a cross without enough Bloom Extract or with the same strain twice', () => {
    const sim = makeSim();
    growAndHarvest(sim, 'common_seed', 0);
    growAndHarvest(sim, 'enriched_seed', 1);
    const [a, b] = sim.strains;
    // Drain the material below the cost.
    sim.removeItem(BREED_COST_ITEM, sim.countItem(BREED_COST_ITEM));
    standAtChamber(sim);
    sim.breedStrains(a.id, b.id);
    expect(sim.strains).toHaveLength(2); // rejected: no material
    // Same strain twice is rejected too.
    sim.addItem(BREED_COST_ITEM, 10);
    standAtChamber(sim);
    sim.breedStrains(a.id, a.id);
    expect(sim.strains).toHaveLength(2);
  });

  it('releasing a strain frees a slot; a base re-discovers on the next harvest', () => {
    const sim = makeSim();
    growAndHarvest(sim, 'common_seed');
    const id = sim.strains[0].id;
    sim.releaseStrain(id);
    expect(sim.strains).toHaveLength(0);
    growAndHarvest(sim, 'common_seed');
    expect(sim.strains).toHaveLength(1);
  });

  // Crossing is a PLACE you go, not a menu you open anywhere in the world.
  it('refuses a cross away from the Breeding Chamber, and allows it at the chamber', () => {
    const sim = makeSim();
    growAndHarvest(sim, 'common_seed', 0);
    growAndHarvest(sim, 'enriched_seed', 1);
    const [a, b] = sim.strains;
    sim.addItem(BREED_COST_ITEM, 100);

    // Far from the chamber: rejected, and the cost is NOT consumed.
    sim.player.pos.x = 1000;
    sim.player.pos.z = 1000;
    const held = sim.countItem(BREED_COST_ITEM);
    sim.breedStrains(a.id, b.id);
    expect(sim.strains).toHaveLength(2);
    expect(sim.countItem(BREED_COST_ITEM)).toBe(held);

    // At the chamber: the same call goes through.
    standAtChamber(sim);
    sim.breedStrains(a.id, b.id);
    expect(sim.strains).toHaveLength(3);
  });

  it('caps the library at MAX_STRAINS', () => {
    const sim = makeSim();
    growAndHarvest(sim, 'common_seed', 0);
    growAndHarvest(sim, 'enriched_seed', 1);
    const [a, b] = sim.strains;
    sim.addItem(BREED_COST_ITEM, 100);
    standAtChamber(sim);
    // Breed until full; further crosses are rejected rather than growing past the cap.
    for (let i = 0; i < MAX_STRAINS + 4; i++) sim.breedStrains(a.id, b.id);
    expect(sim.strains.length).toBe(MAX_STRAINS);
  });

  it('is deterministic: two identical breed runs produce identical genotypes', () => {
    const run = () => {
      const sim = makeSim('mage');
      growAndHarvest(sim, 'common_seed', 0);
      growAndHarvest(sim, 'enriched_seed', 1);
      const [a, b] = sim.strains;
      sim.addItem(BREED_COST_ITEM, 10);
      standAtChamber(sim);
      sim.breedStrains(a.id, b.id);
      // The IWorld view exposes only expressed phenotype; reach into the library state
      // for the raw genotype so determinism covers the hidden recessive alleles too.
      return (sim as unknown as { primary: { strains: Strain[] } }).primary.strains[2].genotype;
    };
    expect(run()).toEqual(run());
  });

  it('survives a full character save/load round-trip', () => {
    const sim = makeSim();
    growAndHarvest(sim, 'common_seed', 0);
    growAndHarvest(sim, 'enriched_seed', 1);
    sim.addItem(BREED_COST_ITEM, 10);
    standAtChamber(sim);
    sim.breedStrains(sim.strains[0].id, sim.strains[1].id);
    const savedLibrary = sim.strains.map((s) => ({ ...s }));
    const saved = sim.serializeCharacter(sim.playerId)!;

    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    reloaded.addPlayer('warrior', 'Test', { state: saved });
    expect(reloaded.strains).toHaveLength(savedLibrary.length);
    expect(reloaded.strains.map((s) => s.id)).toEqual(savedLibrary.map((s) => s.id));
    expect(reloaded.strains.map((s) => s.name)).toEqual(savedLibrary.map((s) => s.name));
  });
});

// Inject a strain (with a chosen genotype + lineage) straight into the library so a test
// can assert exact plant/harvest payoff without breeding toward a target genotype.
const injectStrain = (sim: Sim, baseId: string, genotype: Genotype, name = 'Injected'): string => {
  const s: Strain = { id: 'inj', baseId, name, genotype, landrace: isLandrace(genotype) };
  (sim as unknown as { primary: { strains: Strain[] } }).primary.strains.push(s);
  return s.id;
};
const plotOf = (sim: Sim, i: number) => sim.plots[i];
const simTime = (sim: Sim) => (sim as unknown as { time: number }).time;
const forceReady = (sim: Sim, plot = 0) => {
  plotOf(sim, plot).plantedAt = simTime(sim) - plotOf(sim, plot).growSeconds - 1;
};

describe('genetics: planting a strain (the payoff)', () => {
  it('consumes the lineage seed and grows faster for high vigor', () => {
    const sim = makeSim();
    // vigor 3 -> shortened grow time vs the base common_seed grow time.
    const id = injectStrain(sim, 'common_bloom', g([1, 1], [3, 3], [1, 1]));
    sim.addItem('common_seed', 1);
    sim.plantStrain(0, id);
    expect(sim.countItem('common_seed')).toBe(0);
    expect(plotOf(sim, 0).strainId).toBe(id);
    expect(plotOf(sim, 0).growSeconds).toBeLessThan(PLANTS.common_seed.growSeconds);
    expect(plotOf(sim, 0).growSeconds).toBeGreaterThan(0);
  });

  it('rejects planting a strain with no lineage seed in the bag', () => {
    const sim = makeSim();
    const id = injectStrain(sim, 'common_bloom', g([1, 1], [1, 1], [1, 1]));
    sim.plantStrain(0, id); // no common_seed carried
    expect(plotOf(sim, 0).seedItemId).toBeNull();
  });

  it('a high-yield, high-potency strain harvests extra PRIME buds plus Essence', () => {
    const sim = makeSim();
    const baseYield = PLANTS.common_seed.yields[0].count;
    const id = injectStrain(sim, 'common_bloom', g([3, 3], [0, 0], [2, 2])); // potency3, yield2
    sim.addItem('common_seed', 1);
    sim.plantStrain(0, id);
    forceReady(sim, 0);
    sim.harvestPlot(0);
    // potency 3 upgrades the bulk yield's GRADE, so nothing lands as a common bud...
    expect(sim.countItem('bud_common')).toBe(0);
    // ...and the whole harvest, base yield + yieldBonus(2) extra units, is prime.
    expect(sim.countItem('bud_prime')).toBe(baseYield + yieldBonus(2));
    // ...and potency >= 2 also drops one essence.
    expect(sim.countItem('bloom_essence')).toBe(1);
  });

  it('a low-potency, low-yield strain harvests only the base yield (no essence)', () => {
    const sim = makeSim();
    const baseYield = PLANTS.common_seed.yields[0].count;
    const id = injectStrain(sim, 'common_bloom', g([1, 0], [1, 0], [0, 0])); // potency1, yield0
    sim.addItem('common_seed', 1);
    sim.plantStrain(0, id);
    forceReady(sim, 0);
    sim.harvestPlot(0);
    expect(sim.countItem('bud_common')).toBe(baseYield);
    expect(sim.countItem('bud_fine')).toBe(0);
    expect(sim.countItem('bud_prime')).toBe(0);
    expect(sim.countItem('bloom_essence')).toBe(0);
  });

  it('a strain plot survives save/load with its resolved grow time and strain tag', () => {
    const sim = makeSim();
    const id = injectStrain(sim, 'common_bloom', g([1, 1], [2, 2], [1, 1]));
    sim.addItem('common_seed', 1);
    sim.plantStrain(0, id);
    const grow = plotOf(sim, 0).growSeconds;
    const saved = sim.serializeCharacter(sim.playerId)!;
    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    reloaded.addPlayer('warrior', 'Test', { state: saved });
    expect(reloaded.plots[0].seedItemId).toBe('common_seed');
    expect(reloaded.plots[0].strainId).toBe(id);
    expect(reloaded.plots[0].growSeconds).toBeCloseTo(grow, 5);
  });
});

// Bud grades: the economic axis. Potency decides WHICH bud a harvest yields, which is
// what lets one grower's product out-price another's on the market. The bottom two
// tiers deliberately collapse into the common grade so the better grades have to be
// earned by breeding rather than handed out by a starter seed.
describe('budGrade: potency drives harvest grade', () => {
  it('maps every legal potency tier onto a grade', () => {
    expect(budGrade(0)).toBe('bud_common');
    expect(budGrade(1)).toBe('bud_common');
    expect(budGrade(2)).toBe('bud_fine');
    expect(budGrade(3)).toBe('bud_prime');
  });

  it('clamps outside the legal tier band rather than returning undefined', () => {
    expect(budGrade(-1)).toBe('bud_common');
    expect(budGrade(GENE_MAX + 5)).toBe('bud_prime');
  });

  it('is pure: the same tier always gives the same grade', () => {
    for (let t = 0; t <= GENE_MAX; t++) expect(budGrade(t)).toBe(budGrade(t));
  });
});

describe('harvest grade over a live Sim', () => {
  it('a mid-potency strain harvests FINE buds, not common or prime', () => {
    const sim = makeSim();
    const baseYield = PLANTS.common_seed.yields[0].count;
    const id = injectStrain(sim, 'common_bloom', g([2, 1], [0, 0], [0, 0])); // potency 2
    sim.addItem('common_seed', 1);
    sim.plantStrain(0, id);
    forceReady(sim, 0);
    sim.harvestPlot(0);
    expect(sim.countItem('bud_fine')).toBe(baseYield);
    expect(sim.countItem('bud_common')).toBe(0);
    expect(sim.countItem('bud_prime')).toBe(0);
  });

  it('a plain crafted seed with no strain still yields the declared base grade', () => {
    const sim = makeSim();
    sim.addItem('common_seed', 1);
    sim.plantSeed(0, 'common_seed');
    forceReady(sim, 0);
    sim.harvestPlot(0);
    expect(sim.countItem('bud_common')).toBe(PLANTS.common_seed.yields[0].count);
    expect(sim.countItem('bud_fine')).toBe(0);
    expect(sim.countItem('bud_prime')).toBe(0);
  });

  it('never yields the foraged bloom_extract: growing and picking are separate tracks', () => {
    const sim = makeSim();
    const id = injectStrain(sim, 'common_bloom', g([3, 3], [3, 3], [3, 3]));
    sim.addItem('common_seed', 1);
    sim.plantStrain(0, id);
    forceReady(sim, 0);
    sim.harvestPlot(0);
    expect(sim.countItem('bloom_extract')).toBe(0);
  });
});
