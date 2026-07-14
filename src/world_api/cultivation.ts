import type { PlotView } from '../sim/types';

// Cultivation: the personal-garden seam. `garden` is the read (one PlotView per plot,
// mirrored from the self-snapshot online, computed live offline); plantSeed/harvestPlot
// are the server-authoritative commands. The garden state itself is per-player
// PlayerMeta data; render/ui only see this facet. Plot indices are 0..GARDEN_PLOT_COUNT.
export interface IWorldCultivation {
  // One entry per garden plot: empty, growing (with progress + countdown), or ready.
  garden: PlotView[];
  // Plant a carried seed into an empty plot. Server re-validates the seed, the plot,
  // and that the player holds it.
  plantSeed(plotIndex: number, seedItemId: string): void;
  // Harvest a matured plot for its Bloom yield; a no-op the server rejects if the plot
  // is empty or still growing.
  harvestPlot(plotIndex: number): void;
}
