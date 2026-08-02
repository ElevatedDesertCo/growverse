// Pure, host-agnostic view model for the Breeding window (strain genetics + commune
// reputation).
//
// The pure-core half of the pure-core + thin-consumer split (reference garden_view.ts).
// It owns what the Breeding window decides without a DOM: for each owned strain its
// expressed traits and whether it is picked as parent A or B; whether a cross is legal
// (two distinct strains, room in the library); where a Plant action would sow (the first
// empty plot); and the commune standings to show. The DOM/i18n side lives in
// breeding_window.ts.
//
// DOM-free and i18n-free so tests/breeding_view.test.ts can drive it directly,
// same-input-same-output against a Sim- and a ClientWorld-shaped read. The server always
// re-validates breed/plant/release, so this is purely presentational.

import { MAX_STRAINS, type PlotView, type ReputationView, type StrainView } from '../sim/types';

export interface BreedingStrainRow {
  id: string;
  name: string;
  landrace: boolean;
  potency: number;
  vigor: number;
  yield: number;
  /** Which parent slot this strain fills in the pending cross, or null. */
  selectedAs: 'a' | 'b' | null;
  /** The two parent names this strain was crossed from, or null for a base strain
   *  (which has no parents). Display only; the genotype is the mechanical record. */
  lineage: readonly [string, string] | null;
  /** The character credited with the cross, or null for a base strain and for any
   *  strain restored from a save written before breeder credit existed. */
  breeder: string | null;
}

export interface BreedingView {
  strains: BreedingStrainRow[];
  /** Commune standings (one per faction; usually just the Baked Beaver). */
  reputation: ReputationView[];
  selectedA: string | null;
  selectedB: string | null;
  /** Two distinct owned strains are picked and the library has room: Breed is enabled. */
  canBreed: boolean;
  /** The plot a Plant action would sow into, or null when the garden is full. */
  firstEmptyPlot: number | null;
  /** The library is at MAX_STRAINS: a cross would have nowhere to land. */
  atCapacity: boolean;
  /** Library size, for the header count. */
  count: number;
}

/**
 * Build the structured breeding view.
 *
 * `strains` is the IWorld library read (StrainView[], expressed phenotype only, identical
 * in both worlds); `reputation` is the standings read; `garden` locates the first empty
 * plot for the Plant action. `selectedA`/`selectedB` are the pending parent picks (the
 * caller clears a pick that no longer names an owned strain). A cross is legal only when
 * A and B are two different owned strains AND the library is below MAX_STRAINS.
 */
export function buildBreedingView(
  strains: readonly StrainView[],
  reputation: readonly ReputationView[],
  garden: readonly PlotView[],
  selectedA: string | null,
  selectedB: string | null,
): BreedingView {
  const owns = (id: string | null): boolean => id !== null && strains.some((s) => s.id === id);
  const a = owns(selectedA) ? selectedA : null;
  const b = owns(selectedB) ? selectedB : null;
  const atCapacity = strains.length >= MAX_STRAINS;
  const rows: BreedingStrainRow[] = strains.map((s) => ({
    id: s.id,
    name: s.name,
    landrace: s.landrace,
    potency: s.potency,
    vigor: s.vigor,
    yield: s.yield,
    selectedAs: s.id === a ? 'a' : s.id === b ? 'b' : null,
    lineage: s.lineage ? [s.lineage[0], s.lineage[1]] : null,
    breeder: s.breeder ?? null,
  }));
  const emptyIndex = garden.findIndex((p) => p.stage === 'empty');
  return {
    strains: rows,
    reputation: [...reputation],
    selectedA: a,
    selectedB: b,
    canBreed: a !== null && b !== null && a !== b && !atCapacity,
    firstEmptyPlot: emptyIndex >= 0 ? emptyIndex : null,
    atCapacity,
    count: strains.length,
  };
}
