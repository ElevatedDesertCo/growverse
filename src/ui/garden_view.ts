// Pure, host-agnostic view model for the Garden window (cultivation).
//
// The pure-core half of the pure-core + thin-consumer split (reference
// crafting_view.ts / stash_view.ts). It owns the one thing the Garden window
// decides that is worth testing without a DOM: for each of the player's plots,
// whether it is empty / growing / ready, which seed is growing (resolved to its
// ItemDef for name + icon), its progress, and its countdown; plus the list of
// plantable seeds the player is carrying and which one is selected to plant.
// The DOM/i18n side lives in garden_window.ts.
//
// DOM-free and i18n-free so tests/garden_view.test.ts can drive it directly,
// same-input-same-output against a Sim- and a ClientWorld-shaped `garden` read.
// The server always re-validates plant/harvest, so this is purely presentational.

import type { ItemDef, PlotView } from '../sim/types';

export interface GardenSeedOption {
  itemId: string;
  item: ItemDef;
  count: number;
}

export interface GardenPlotRow {
  index: number;
  stage: PlotView['stage'];
  /** The growing seed's item (for name + icon); null for an empty plot. */
  seedItem: ItemDef | null;
  /** 0..1 growth fraction (1 = ready); 0 for empty. */
  progress: number;
  secondsRemaining: number;
  /** Empty plot with a seed selected to plant: the Plant button is enabled. */
  canPlant: boolean;
  /** Matured plot: the Harvest button is enabled. */
  canHarvest: boolean;
  /** Growing plot whose current tend window is still open: the Tend button is enabled.
   *  Tending is a pure bonus, so a disabled Tend never blocks anything. */
  canTend: boolean;
  /** How many of the grow's tend windows have been caught so far (0 when empty/ready). */
  tends: number;
  /** A not-yet-unlocked plot (its row opens at a higher level): shows the unlock level
   *  instead of Plant/Harvest, and cannot be acted on. */
  locked: boolean;
  /** The character level at which this plot unlocks (only shown when `locked`). */
  unlockLevel: number;
}

export interface GardenView {
  plots: GardenPlotRow[];
  /** Plantable seeds the player holds (seed ids that map to a PlantDef). */
  seeds: GardenSeedOption[];
  /** The seed id the Plant buttons will sow; null when the player holds none. */
  selectedSeedId: string | null;
  /** How many plots are ready to harvest (drives the header count). */
  readyCount: number;
  /** How many growing plots are waiting on a tend right now (drives the header nudge, so
   *  a player who never opens a plot still sees there is a bonus on the table). */
  tendableCount: number;
}

/**
 * Build the structured garden view.
 *
 * `garden` is the per-plot IWorld read (PlotView[], identical in both worlds).
 * `items` resolves a seed id to its ItemDef for the name/icon. `seeds` is the
 * player's plantable inventory (already filtered to seeds that grow), and
 * `selectedSeedId` is the strain chosen to plant (the caller defaults it to the
 * first available seed; null means the player carries none, so planting is
 * disabled). A plot can plant only when empty AND a seed is selected; it can
 * harvest only when ready. A growing plot whose seed is missing from the item
 * table renders with a null `seedItem` (defensive; never happens with valid data).
 */
export function buildGardenView(
  garden: readonly PlotView[],
  items: Record<string, ItemDef>,
  seeds: readonly GardenSeedOption[],
  selectedSeedId: string | null,
): GardenView {
  const canPlantAny = selectedSeedId !== null;
  let readyCount = 0;
  let tendableCount = 0;
  const plots: GardenPlotRow[] = garden.map((plot, index) => {
    if (plot.stage === 'ready' && !plot.locked) readyCount++;
    if (plot.stage === 'growing' && plot.canTend && !plot.locked) tendableCount++;
    return {
      index,
      stage: plot.stage,
      seedItem: plot.seedItemId ? (items[plot.seedItemId] ?? null) : null,
      progress: plot.progress,
      secondsRemaining: plot.secondsRemaining,
      canPlant: !plot.locked && plot.stage === 'empty' && canPlantAny,
      canHarvest: !plot.locked && plot.stage === 'ready',
      canTend: !plot.locked && plot.stage === 'growing' && plot.canTend,
      tends: plot.tends,
      locked: plot.locked,
      unlockLevel: plot.unlockLevel,
    };
  });
  return { plots, seeds: [...seeds], selectedSeedId, readyCount, tendableCount };
}
