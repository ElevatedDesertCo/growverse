import type { PlantDef } from '../types';

// Cultivation: what each plantable seed grows into. A seed planted in a garden plot
// matures over `growSeconds` (sim-time) and yields Bloom material on harvest, closing
// the loop with the rest of the Growverse systems: buy essence -> craft a seed at the
// Grow Station -> plant it in your garden -> harvest Bloom Extract -> brew a Session
// tonic (src/sim/sessions.ts) at the Alchemy Lab. Pure data-as-code; the growth/harvest
// logic lives in src/sim/cultivation.ts and reads this table.
//
// This also gives the crafted seed strains (common/enriched/prime) a real consumer:
// the Prime Strain Seed was a dead-end vendor-trash item before cultivation landed.
// Higher strains take longer but yield more. No rng here (genetics/phenotypes are a
// later pass); yields are fixed so growth stays deterministic.
export const PLANTS: Record<string, PlantDef> = {
  common_seed: {
    seedItemId: 'common_seed',
    name: 'Common Bloom',
    growSeconds: 180,
    yields: [{ itemId: 'bloom_extract', count: 2 }],
  },
  enriched_seed: {
    seedItemId: 'enriched_seed',
    name: 'Enriched Bloom',
    growSeconds: 300,
    yields: [{ itemId: 'bloom_extract', count: 4 }],
  },
  prime_strain_seed: {
    seedItemId: 'prime_strain_seed',
    name: 'Prime Bloom',
    growSeconds: 600,
    yields: [
      { itemId: 'bloom_extract', count: 6 },
      { itemId: 'bloom_essence', count: 1 },
    ],
  },
};
