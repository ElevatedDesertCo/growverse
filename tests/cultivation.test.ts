// Cultivation: planting a crafted seed in a garden plot, watching it mature over
// sim-time, harvesting it for Bloom material, and surviving a save/load round-trip with
// growth rebased onto the fresh clock. Covers src/sim/cultivation.ts + the Sim facade.

import { beforeEach, describe, expect, it } from 'vitest';
import { plotProgress, plotStage, restorePlots, serializePlots } from '../src/sim/cultivation';
import { NPCS, PLANTS } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import {
  type Entity,
  GARDEN_PLOT_COUNT,
  GARDEN_PLOT_GRID,
  MASTERY_YIELD_BONUS,
  type PlayerClass,
  type Plot,
  STRAIN_MASTERY_MAX,
  TEND_YIELD_BONUS,
  TENDS_PER_GROW,
  unlockedGardenPlots,
} from '../src/sim/types';

const makeSim = (cls: PlayerClass = 'warrior', seed = 42) =>
  new Sim({ seed, playerClass: cls, autoEquip: true });
const tickSeconds = (sim: Sim, s: number) => {
  for (let i = 0; i < 20 * s; i++) sim.tick();
};

describe('cultivation', () => {
  let sim: Sim;
  beforeEach(() => {
    sim = makeSim('warrior');
  });

  it('a new character starts with an all-empty garden', () => {
    expect(sim.plots).toHaveLength(GARDEN_PLOT_COUNT);
    expect(sim.plots.every((p) => p.seedItemId === null)).toBe(true);
  });

  it('spawns one interactable garden_plot bed per plot, in a grid at the outpost', () => {
    const beds = [
      ...(sim as unknown as { entities: Map<number, Entity> }).entities.values(),
    ].filter((e) => e.kind === 'object' && e.templateId === 'garden_plot');
    expect(beds).toHaveLength(GARDEN_PLOT_COUNT);
    expect(GARDEN_PLOT_GRID).toHaveLength(GARDEN_PLOT_COUNT);
    // every configured grid position has a bed placed on it (x/z match; y is terrain)
    for (const spot of GARDEN_PLOT_GRID) {
      const bed = beds.find(
        (b) => Math.abs(b.pos.x - spot.x) < 1e-5 && Math.abs(b.pos.z - spot.z) < 1e-5,
      );
      expect(bed, `no bed at (${spot.x}, ${spot.z})`).toBeDefined();
      expect(bed?.objectItemId).toBeNull(); // not a pickup/collectible
    }
  });

  it('planting a seed consumes it and starts the plot growing', () => {
    sim.addItem('common_seed', 1);
    sim.plantSeed(0, 'common_seed');
    expect(sim.countItem('common_seed')).toBe(0);
    expect(sim.plots[0].seedItemId).toBe('common_seed');
    expect(plotStage(sim.plots[0], (sim as unknown as { time: number }).time)).toBe('growing');
  });

  it('cannot plant into an occupied plot or plant a non-seed', () => {
    sim.addItem('common_seed', 1);
    sim.addItem('worn_sword', 1);
    sim.plantSeed(0, 'common_seed');
    // occupied
    sim.addItem('common_seed', 1);
    sim.plantSeed(0, 'common_seed');
    expect(sim.countItem('common_seed')).toBe(1); // the second plant was rejected
    // non-seed item is not plantable
    sim.plantSeed(1, 'worn_sword');
    expect(sim.plots[1].seedItemId).toBeNull();
  });

  it('a plant matures over its growSeconds and yields buds on harvest', () => {
    const grow = PLANTS.common_seed.growSeconds;
    sim.addItem('common_seed', 1);
    sim.plantSeed(0, 'common_seed');
    // Just before ready: still growing, harvest rejected.
    tickSeconds(sim, grow - 2);
    expect(plotStage(sim.plots[0], (sim as unknown as { time: number }).time)).toBe('growing');
    sim.harvestPlot(0);
    expect(sim.countItem('bud_common')).toBe(0);
    expect(sim.plots[0].seedItemId).toBe('common_seed');
    // Past ready: harvest grants the yield and empties the plot.
    tickSeconds(sim, 4);
    expect(plotStage(sim.plots[0], (sim as unknown as { time: number }).time)).toBe('ready');
    sim.harvestPlot(0);
    expect(sim.countItem('bud_common')).toBe(PLANTS.common_seed.yields[0].count);
    expect(sim.plots[0].seedItemId).toBeNull();
  });

  it('serialize/restore rebases growth onto a fresh clock (progress survives a reload)', () => {
    const now = 500;
    const plots = restorePlots([{ seedItemId: 'common_seed', grown: 60 }, null], now);
    expect(plots[0].seedItemId).toBe('common_seed');
    // grown 60s -> plantedAt is 60s before `now`, so progress is 60/180.
    expect(plotProgress(plots[0], now)).toBeCloseTo(60 / PLANTS.common_seed.growSeconds, 5);
    // round-trip: serialize back to elapsed and it matches.
    const saved = serializePlots(plots, now);
    expect(saved[0]).toEqual({ seedItemId: 'common_seed', grown: 60 });
    expect(saved[1]).toBeNull();
  });

  it('a full character save/load round-trip preserves a growing plot', () => {
    sim.addItem('enriched_seed', 1);
    sim.plantSeed(2, 'enriched_seed');
    tickSeconds(sim, 100);
    const saved = sim.serializeCharacter(sim.playerId)!;
    // Load into a fresh Sim (clock resets to ~0); growth must resume, not restart.
    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    reloaded.addPlayer('warrior', 'Test', { state: saved });
    const plot = reloaded.plots[2];
    expect(plot.seedItemId).toBe('enriched_seed');
    const remaining =
      PLANTS.enriched_seed.growSeconds -
      (reloaded as unknown as { time: number }).time +
      plot.plantedAt;
    // ~200s should remain (300 grow - 100 elapsed), give or take a tick.
    expect(remaining).toBeGreaterThan(195);
    expect(remaining).toBeLessThan(205);
  });

  it('gates plots by level: locked rows cannot be planted and open as you level', () => {
    sim.setPlayerLevel(1);
    const unlockedL1 = unlockedGardenPlots(1);
    expect(unlockedL1).toBeLessThan(GARDEN_PLOT_COUNT); // some rows start locked
    // The garden view flags the locked plots and carries their unlock level.
    expect(sim.garden[unlockedL1 - 1].locked).toBe(false);
    const firstLocked = sim.garden[unlockedL1];
    expect(firstLocked.locked).toBe(true);
    expect(firstLocked.unlockLevel).toBeGreaterThan(1);
    // Planting into a locked plot is rejected (the seed is not consumed).
    sim.addItem('common_seed', 1);
    sim.plantSeed(unlockedL1, 'common_seed');
    expect(sim.plots[unlockedL1].seedItemId).toBeNull();
    expect(sim.countItem('common_seed')).toBe(1);
    // Leveling to that plot's unlock level opens it, and planting now works.
    sim.setPlayerLevel(firstLocked.unlockLevel);
    expect(sim.garden[unlockedL1].locked).toBe(false);
    sim.plantSeed(unlockedL1, 'common_seed');
    expect(sim.plots[unlockedL1].seedItemId).toBe('common_seed');
    expect(sim.countItem('common_seed')).toBe(0);
  });

  it('is deterministic: two identical plant/grow/harvest runs match', () => {
    const run = () => {
      const s = makeSim('mage');
      s.addItem('common_seed', 1);
      s.plantSeed(0, 'common_seed');
      tickSeconds(s, PLANTS.common_seed.growSeconds + 1);
      s.harvestPlot(0);
      return s.countItem('bud_common');
    };
    expect(run()).toBe(run());
  });
});

// Tending: the opt-in skill expression. The grow is split into TENDS_PER_GROW windows
// and each can be caught once. The load-bearing property is that it is BONUS-ONLY, so an
// untended crop yields exactly what it always did and a raid night is never a loss.
describe('cultivation: tending', () => {
  const plant = (sim: Sim, seed = 'common_seed') => {
    sim.addItem(seed, 1);
    sim.plantSeed(0, seed);
    return sim.plots[0];
  };
  // Jump the clock by rewinding plantedAt, which is how the sibling tests age a plant
  // without ticking thousands of frames.
  const ageTo = (sim: Sim, fraction: number) => {
    const plot = sim.plots[0];
    plot.plantedAt = (sim as unknown as { time: number }).time - plot.growSeconds * fraction;
  };

  it('credits one tend per window and refuses a second in the same window', () => {
    const sim = makeSim();
    plant(sim);
    expect(sim.plots[0].tends).toBe(0);
    sim.tendPlot(0);
    expect(sim.plots[0].tends).toBe(1);
    sim.tendPlot(0); // same window: not credited
    expect(sim.plots[0].tends).toBe(1);
  });

  it('credits a tend in each later window, up to TENDS_PER_GROW', () => {
    const sim = makeSim();
    plant(sim);
    for (let w = 0; w < TENDS_PER_GROW; w++) {
      ageTo(sim, (w + 0.5) / TENDS_PER_GROW);
      sim.tendPlot(0);
    }
    expect(sim.plots[0].tends).toBe(TENDS_PER_GROW);
  });

  it('a skipped window costs only that window', () => {
    const sim = makeSim();
    plant(sim);
    ageTo(sim, 0.5 / TENDS_PER_GROW);
    sim.tendPlot(0); // window 0
    ageTo(sim, 2.5 / TENDS_PER_GROW); // window 1 missed entirely
    sim.tendPlot(0); // window 2
    expect(sim.plots[0].tends).toBe(2);
  });

  it('refuses a matured plant: a finished crop is past tending', () => {
    const sim = makeSim();
    plant(sim);
    ageTo(sim, 1.5);
    expect(plotStage(sim.plots[0], (sim as unknown as { time: number }).time)).toBe('ready');
    sim.tendPlot(0);
    expect(sim.plots[0].tends).toBe(0);
  });

  it('BONUS-ONLY: an untended crop yields exactly its base yield', () => {
    const sim = makeSim();
    plant(sim);
    ageTo(sim, 1.5);
    sim.harvestPlot(0);
    expect(sim.countItem('bud_common')).toBe(PLANTS.common_seed.yields[0].count);
  });

  it('a perfectly tended crop yields the base plus TEND_YIELD_BONUS', () => {
    const sim = makeSim();
    plant(sim);
    for (let w = 0; w < TENDS_PER_GROW; w++) {
      ageTo(sim, (w + 0.5) / TENDS_PER_GROW);
      sim.tendPlot(0);
    }
    ageTo(sim, 1.5);
    sim.harvestPlot(0);
    const base = PLANTS.common_seed.yields[0].count;
    expect(sim.countItem('bud_common')).toBe(base + Math.round(base * TEND_YIELD_BONUS));
  });

  it('resets the tend record on the next planting', () => {
    const sim = makeSim();
    plant(sim);
    sim.tendPlot(0);
    ageTo(sim, 1.5);
    sim.harvestPlot(0);
    expect(sim.plots[0].tends).toBe(0);
    plant(sim);
    expect(sim.plots[0].tends).toBe(0);
    expect(sim.plots[0].lastTendWindow).toBe(-1);
  });

  it('the garden view reports the tend record and whether a window is open', () => {
    const sim = makeSim();
    plant(sim);
    expect(sim.garden[0].canTend).toBe(true);
    expect(sim.garden[0].tends).toBe(0);
    sim.tendPlot(0);
    expect(sim.garden[0].canTend).toBe(false);
    expect(sim.garden[0].tends).toBe(1);
  });

  it('survives a save/load round-trip', () => {
    const sim = makeSim();
    plant(sim);
    sim.tendPlot(0);
    const saved = sim.serializeCharacter(sim.playerId)!;
    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    const pid = reloaded.addPlayer('warrior', 'Test', { state: saved });
    const plots = (reloaded as unknown as { players: Map<number, { plots: Plot[] }> }).players.get(
      pid,
    )!.plots;
    expect(plots[0].tends).toBe(1);
    expect(plots[0].lastTendWindow).toBe(0);
  });

  it('an in-flight crop from a pre-tending save loads untended, not broken', () => {
    // The bonus-only rule holding across the upgrade: no tend fields in the save means
    // no tends, which means the crop yields exactly what it would have yielded before.
    const restored = restorePlots([{ seedItemId: 'common_seed', grown: 10 }], 100);
    expect(restored[0].tends).toBe(0);
    expect(restored[0].lastTendWindow).toBe(-1);
  });
});

// Per-strain mastery: the grower's permanent record with a strain. Never decays, only a
// planted library strain earns it, and it is not inherited by a cross.
describe('cultivation: strain mastery', () => {
  const growStrain = (sim: Sim, strainId: string, tends: number) => {
    sim.addItem('common_seed', 1);
    sim.plantStrain(0, strainId);
    const now = () => (sim as unknown as { time: number }).time;
    for (let w = 0; w < tends; w++) {
      sim.plots[0].plantedAt = now() - sim.plots[0].growSeconds * ((w + 0.5) / TENDS_PER_GROW);
      sim.tendPlot(0);
    }
    sim.plots[0].plantedAt = now() - sim.plots[0].growSeconds * 1.5;
    sim.harvestPlot(0);
  };
  // Discover a base strain the ordinary way (harvesting its seed), then grow THAT.
  const discover = (sim: Sim): string => {
    sim.addItem('common_seed', 1);
    sim.plantSeed(0, 'common_seed');
    sim.plots[0].plantedAt = -100000;
    sim.harvestPlot(0);
    return sim.strains[0].id;
  };

  it('rises on every harvest and rises faster when the crop was tended', () => {
    const lazy = makeSim();
    const lazyId = discover(lazy);
    growStrain(lazy, lazyId, 0);
    const lazyGain = lazy.strains.find((s) => s.id === lazyId)!.mastery;

    const keen = makeSim();
    const keenId = discover(keen);
    growStrain(keen, keenId, TENDS_PER_GROW);
    const keenGain = keen.strains.find((s) => s.id === keenId)!.mastery;

    expect(lazyGain).toBeGreaterThan(0);
    expect(keenGain).toBeGreaterThan(lazyGain);
  });

  it('never decays, and clamps at STRAIN_MASTERY_MAX', () => {
    const sim = makeSim();
    const id = discover(sim);
    const strain = (
      sim as unknown as { primary: { strains: { id: string; mastery: number }[] } }
    ).primary.strains.find((s) => s.id === id)!;
    strain.mastery = STRAIN_MASTERY_MAX;
    growStrain(sim, id, 0); // a sloppy grow of a mastered strain
    expect(strain.mastery).toBe(STRAIN_MASTERY_MAX); // held, not reduced
  });

  it('adds bulk yield at high mastery, and nothing at zero', () => {
    const base = PLANTS.common_seed.yields[0].count;

    const fresh = makeSim();
    const freshId = discover(fresh);
    fresh.addItem('common_seed', 1);
    const before = fresh.countItem('bud_common');
    growStrain(fresh, freshId, 0);
    const unmastered = fresh.countItem('bud_common') - before;

    const expert = makeSim();
    const expertId = discover(expert);
    (
      expert as unknown as { primary: { strains: { id: string; mastery: number }[] } }
    ).primary.strains.find((s) => s.id === expertId)!.mastery = STRAIN_MASTERY_MAX;
    expert.addItem('common_seed', 1);
    const before2 = expert.countItem('bud_common');
    growStrain(expert, expertId, 0);
    const mastered = expert.countItem('bud_common') - before2;

    expect(mastered - unmastered).toBe(Math.round(base * MASTERY_YIELD_BONUS));
  });

  it("mastery is the grower's record, not a heritable trait: a fresh cross starts at zero", () => {
    const sim = makeSim();
    const id = discover(sim);
    const strains = (
      sim as unknown as { primary: { strains: { id: string; mastery: number; baseId: string }[] } }
    ).primary.strains;
    strains[0].mastery = STRAIN_MASTERY_MAX;
    // A second strain to cross with, then stand at the chamber and breed.
    sim.addItem('enriched_seed', 1);
    sim.plantSeed(1, 'enriched_seed');
    sim.plots[1].plantedAt = -100000;
    sim.harvestPlot(1);
    const keeper = [...sim.entities.values()].find(
      (e) => e.kind === 'npc' && NPCS[e.templateId]?.crafting === 'grow',
    )!;
    sim.player.pos.x = keeper.pos.x;
    sim.player.pos.z = keeper.pos.z;
    sim.addItem('bud_common', 20);
    const beforeCount = strains.length;
    sim.breedStrains(id, strains[1].id);
    expect(strains.length).toBe(beforeCount + 1);
    expect(strains[strains.length - 1].mastery).toBe(0);
  });
});
