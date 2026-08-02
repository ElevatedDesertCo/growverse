import type { PlotView, StrainView } from '../sim/types';

// Cultivation: the personal-garden + strain-genetics seam. `garden` is the plot read (one
// PlotView per plot) and `strains` is the library read (one StrainView per owned strain,
// expressed phenotype only). plantSeed/plantStrain/harvestPlot/breedStrains/releaseStrain
// are the server-authoritative commands. All state is per-player PlayerMeta data; render/ui
// only see this facet. Plot indices are 0..GARDEN_PLOT_COUNT; strain ids are opaque.
export interface IWorldCultivation {
  // One entry per garden plot: empty, growing (with progress + countdown), or ready.
  garden: PlotView[];
  // The player's strain library: expressed phenotype per owned strain (the raw genotype,
  // with its hidden recessives, stays server-side).
  strains: StrainView[];
  // Plant a carried seed into an empty plot. Server re-validates the seed, the plot,
  // and that the player holds it.
  plantSeed(plotIndex: number, seedItemId: string): void;
  // Plant a library strain into an empty plot (consumes the strain's lineage seed). Server
  // re-validates the strain, the plot, and the seed medium.
  plantStrain(plotIndex: number, strainId: string): void;
  // Tend a growing plot, crediting its current tend window if it is still open. Purely a
  // BONUS: an untended crop yields exactly what it always did, so this never has to be
  // pressed. Server re-validates the plot, its stage, and the window.
  tendPlot(plotIndex: number): void;
  // Harvest a matured plot for its Bloom yield; a no-op the server rejects if the plot
  // is empty or still growing.
  harvestPlot(plotIndex: number): void;
  // Cross two owned strains into a new library strain (consumes two Epic Buds, which drop
  // from a well-tended crop). Server re-validates ownership, the library cap, and the cost.
  breedStrains(strainIdA: string, strainIdB: string): void;
  // Release a strain from the library to free a slot.
  releaseStrain(strainId: string): void;
}
