import type { StrainDef } from '../types';

// Base strains: the starting genotypes a player discovers by harvesting the three crafted
// seeds. Growing a Common/Enriched/Prime seed registers the matching base strain in the
// library the first time, giving the breeding loop its raw stock without any new items.
// Each base carries deliberately UNEVEN alleles (a hidden recessive under the dominant
// tier) so crossing them can surface or combine traits, which is the whole point of the
// mechanic. Higher-grade bases express higher tiers. Pure data-as-code; the genetics math
// lives in src/sim/genetics.ts and the library actions in src/sim/cultivation.ts.
//
// Genotype tiers run 0..GENE_MAX (3). Expressed phenotype is the higher (dominant) allele:
//   common   -> potency 1, vigor 1, yield 1
//   enriched -> potency 2, vigor 2, yield 2
//   prime    -> potency 3, vigor 2, yield 3
export const BASE_STRAINS: Record<string, StrainDef> = {
  common_bloom: {
    baseId: 'common_bloom',
    name: 'Common Bloom',
    seedItemId: 'common_seed',
    genotype: { potency: [1, 0], vigor: [1, 1], yield: [1, 0] },
  },
  enriched_bloom: {
    baseId: 'enriched_bloom',
    name: 'Enriched Bloom',
    seedItemId: 'enriched_seed',
    genotype: { potency: [2, 1], vigor: [1, 2], yield: [2, 1] },
  },
  prime_bloom: {
    baseId: 'prime_bloom',
    name: 'Prime Bloom',
    seedItemId: 'prime_strain_seed',
    genotype: { potency: [3, 2], vigor: [2, 2], yield: [3, 2] },
  },
};

// Reverse index: which base strain a crafted seed discovers on harvest. Built once so the
// harvest path is an O(1) lookup rather than a scan.
export const BASE_STRAIN_BY_SEED: Record<string, StrainDef> = Object.fromEntries(
  Object.values(BASE_STRAINS).map((def) => [def.seedItemId, def]),
);
