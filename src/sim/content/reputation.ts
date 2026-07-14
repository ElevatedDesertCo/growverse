import type { FactionDef, FactionId } from '../types';

// Factions: the commune-reputation catalog. For Phase C there is one, the Baked Beaver
// commune, the growers' collective at the heart of the Growverse fantasy. Standing with it
// is earned by cultivating and breeding, and gates the deepest strains/recipes/cosmetics.
// Pure data-as-code; the standing math + gain/gate logic lives in src/sim/reputation.ts.
export const FACTIONS: Record<FactionId, FactionDef> = {
  baked_beaver: {
    id: 'baked_beaver',
    name: 'The Baked Beaver Commune',
  },
};
