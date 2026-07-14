// Cultivation: planting a crafted seed in a garden plot, watching it mature over
// sim-time, harvesting it for Bloom material, and surviving a save/load round-trip with
// growth rebased onto the fresh clock. Covers src/sim/cultivation.ts + the Sim facade.

import { beforeEach, describe, expect, it } from 'vitest';
import { plotProgress, plotStage, restorePlots, serializePlots } from '../src/sim/cultivation';
import { PLANTS } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import { GARDEN_PLOT_COUNT, type PlayerClass } from '../src/sim/types';

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

  it('a plant matures over its growSeconds and yields Bloom on harvest', () => {
    const grow = PLANTS.common_seed.growSeconds;
    sim.addItem('common_seed', 1);
    sim.plantSeed(0, 'common_seed');
    // Just before ready: still growing, harvest rejected.
    tickSeconds(sim, grow - 2);
    expect(plotStage(sim.plots[0], (sim as unknown as { time: number }).time)).toBe('growing');
    sim.harvestPlot(0);
    expect(sim.countItem('bloom_extract')).toBe(0);
    expect(sim.plots[0].seedItemId).toBe('common_seed');
    // Past ready: harvest grants the yield and empties the plot.
    tickSeconds(sim, 4);
    expect(plotStage(sim.plots[0], (sim as unknown as { time: number }).time)).toBe('ready');
    sim.harvestPlot(0);
    expect(sim.countItem('bloom_extract')).toBe(PLANTS.common_seed.yields[0].count);
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

  it('is deterministic: two identical plant/grow/harvest runs match', () => {
    const run = () => {
      const s = makeSim('mage');
      s.addItem('common_seed', 1);
      s.plantSeed(0, 'common_seed');
      tickSeconds(s, PLANTS.common_seed.growSeconds + 1);
      s.harvestPlot(0);
      return s.countItem('bloom_extract');
    };
    expect(run()).toBe(run());
  });
});
