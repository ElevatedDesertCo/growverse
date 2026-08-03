// Pure-core test for the Garden window view model. buildGardenView takes plain data
// (the PlotView[] IWorld read, identical in both worlds), so this drives it directly.

import { describe, expect, it } from 'vitest';
import type { ItemDef, PlotView } from '../src/sim/types';
import { buildGardenView, type GardenSeedOption } from '../src/ui/garden_view';

const ITEMS: Record<string, ItemDef> = {
  common_seed: {
    id: 'common_seed',
    name: 'Common Seed',
    kind: 'junk',
    quality: 'common',
    sellValue: 2,
  },
  enriched_seed: {
    id: 'enriched_seed',
    name: 'Enriched Seed',
    kind: 'junk',
    quality: 'uncommon',
    sellValue: 30,
  },
};

const empty = (): PlotView => ({
  seedItemId: null,
  stage: 'empty',
  progress: 0,
  secondsRemaining: 0,
  locked: false,
  unlockLevel: 1,
  tends: 0,
  canTend: false,
});
const growing = (seed: string, progress: number, secs: number): PlotView => ({
  seedItemId: seed,
  stage: 'growing',
  progress,
  secondsRemaining: secs,
  locked: false,
  unlockLevel: 1,
  tends: 0,
  canTend: false,
});
const ready = (seed: string): PlotView => ({
  seedItemId: seed,
  stage: 'ready',
  progress: 1,
  secondsRemaining: 0,
  locked: false,
  unlockLevel: 1,
  tends: 0,
  canTend: false,
});

const seeds: GardenSeedOption[] = [{ itemId: 'common_seed', item: ITEMS.common_seed, count: 3 }];

describe('buildGardenView', () => {
  it('maps an empty garden with no seed selected: nothing plantable or harvestable', () => {
    const view = buildGardenView([empty(), empty()], ITEMS, [], null);
    expect(view.plots).toHaveLength(2);
    expect(view.readyCount).toBe(0);
    expect(view.plots.every((p) => p.stage === 'empty')).toBe(true);
    expect(view.plots.every((p) => !p.canPlant && !p.canHarvest)).toBe(true);
    expect(view.seeds).toEqual([]);
  });

  it('enables planting on empty plots when a seed is selected', () => {
    const view = buildGardenView([empty(), empty()], ITEMS, seeds, 'common_seed');
    expect(view.selectedSeedId).toBe('common_seed');
    expect(view.plots.every((p) => p.canPlant)).toBe(true);
    expect(view.seeds).toHaveLength(1);
  });

  it('resolves a growing plot to its seed item, with progress and no actions', () => {
    const view = buildGardenView([growing('common_seed', 0.5, 90)], ITEMS, seeds, 'common_seed');
    const plot = view.plots[0];
    expect(plot.stage).toBe('growing');
    expect(plot.seedItem?.id).toBe('common_seed');
    expect(plot.progress).toBe(0.5);
    expect(plot.secondsRemaining).toBe(90);
    expect(plot.canPlant).toBe(false); // occupied
    expect(plot.canHarvest).toBe(false); // not ready
  });

  it('marks a ready plot harvestable and counts it in readyCount', () => {
    const view = buildGardenView(
      [ready('enriched_seed'), growing('common_seed', 0.2, 200), ready('common_seed')],
      ITEMS,
      seeds,
      'common_seed',
    );
    expect(view.readyCount).toBe(2);
    expect(view.plots[0].canHarvest).toBe(true);
    expect(view.plots[0].seedItem?.id).toBe('enriched_seed');
    expect(view.plots[1].canHarvest).toBe(false);
    expect(view.plots[2].canHarvest).toBe(true);
  });

  it('tolerates a growing plot whose seed left the item table (null seedItem)', () => {
    const view = buildGardenView([growing('gone_seed', 0.3, 100)], ITEMS, seeds, 'common_seed');
    expect(view.plots[0].seedItem).toBeNull();
    expect(view.plots[0].stage).toBe('growing');
  });

  it('is a pure function of its inputs (same input -> same output)', () => {
    const garden = [empty(), growing('common_seed', 0.4, 108), ready('common_seed')];
    const a = buildGardenView(garden, ITEMS, seeds, 'common_seed');
    const b = buildGardenView(garden, ITEMS, seeds, 'common_seed');
    expect(a).toEqual(b);
  });
});
