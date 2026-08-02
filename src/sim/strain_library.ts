// Strain library: the per-player collection of bred strains and the actions over it
// (discover-on-harvest, breed, release) plus its persistence. State lives on PlayerMeta
// (`strains` + the `strainSeq` id counter); this module holds only the FUNCTIONS and talks
// to the SimContext seam, never to Sim internals. The inheritance MATH is genetics.ts; this
// file is the stateful "system" half (guards, library caps, rng-seeded breeding, discovery).
//
// Ids: a discovered base strain gets the deterministic id `base:<baseId>` (one per lineage,
// so re-harvesting never duplicates it); a bred offspring gets `s<n>` from the monotonic
// per-player `strainSeq`. Breeding is deterministic through ctx.rng, so a replay from the
// same seed breeds the same strain.
//
// `src/sim`-pure: no DOM/Three/render-ui-game-net imports, no Math.random/Date.now. Player
// text is English source emitted through ctx, localized at the client boundary.

import { BASE_STRAIN_BY_SEED } from './data';
import { baseStrain, breed, strainView } from './genetics';
import { awardReputation, REP_PER_BREED, REP_PER_LANDRACE } from './reputation';
import type { SimContext } from './sim_context';
import { type Genotype, MAX_STRAINS, type Strain, type StrainView } from './types';

// Breeding consumes harvested buds, tying the mechanic back into cultivation output (a
// real sink, reachable from the garden loop) rather than being free. Buds rather than
// the foraged bloom_extract: you breed from your own harvest, not from picked flowers,
// which also keeps the two materials on separate economic tracks.
export const BREED_COST_ITEM = 'bud_common';
export const BREED_COST_COUNT = 2;

// A fresh, empty library (character create + load default).
export function emptyStrains(): Strain[] {
  return [];
}

function baseStrainId(baseId: string): string {
  return `base:${baseId}`;
}

// Discover the base strain for a just-harvested seed. Idempotent per lineage (the fixed
// `base:` id means a second harvest finds it already present) and non-fatal: a full library
// simply skips the discovery rather than blocking the harvest. Returns true when a new
// strain was added (so the caller can announce it).
export function registerBaseStrain(ctx: SimContext, seedItemId: string, pid?: number): boolean {
  const r = ctx.resolve(pid);
  if (!r) return false;
  const { meta } = r;
  const def = BASE_STRAIN_BY_SEED[seedItemId];
  if (!def) return false;
  const id = baseStrainId(def.baseId);
  if (meta.strains.some((s) => s.id === id)) return false;
  if (meta.strains.length >= MAX_STRAINS) return false;
  meta.strains.push(baseStrain(def, id));
  ctx.notice(meta.entityId, `You have discovered the ${def.name} strain.`);
  return true;
}

// Cross two owned strains into a new library strain. Guards mirror the other consumable
// actions (alive, both strains owned and distinct, library has room, can pay the cost).
// Draws through ctx.rng so the offspring is replay-stable.
export function breedStrains(ctx: SimContext, idA: string, idB: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  if (idA === idB) {
    ctx.error(meta.entityId, 'Pick two different strains to cross.');
    return;
  }
  const a = meta.strains.find((s) => s.id === idA);
  const b = meta.strains.find((s) => s.id === idB);
  if (!a || !b) {
    ctx.error(meta.entityId, "You don't have both of those strains.");
    return;
  }
  if (meta.strains.length >= MAX_STRAINS) {
    ctx.error(meta.entityId, 'Your strain library is full. Release a strain first.');
    return;
  }
  if (ctx.countItem(BREED_COST_ITEM, meta.entityId) < BREED_COST_COUNT) {
    // Says buds, not extract: the cost moved to cultivation output when growing
    // and foraging were split, and this line was left describing the old item.
    ctx.error(meta.entityId, 'You need more Common Buds to cross strains.');
    return;
  }
  ctx.removeItem(BREED_COST_ITEM, BREED_COST_COUNT, meta.entityId);
  // The cross is credited to the breeder, and its name is generated from the
  // parents, so the library reads as a lineage rather than twelve identical rows.
  const child = breed(ctx.rng, a, b, `s${meta.strainSeq++}`, p.name);
  meta.strains.push(child);
  ctx.notice(meta.entityId, `You cross ${a.name} and ${b.name} into a new ${child.name} strain.`);
  // Reputation: breeding advances the commune's craft; a rare landrace is a windfall.
  awardReputation(ctx, 'baked_beaver', REP_PER_BREED, pid);
  if (child.landrace) awardReputation(ctx, 'baked_beaver', REP_PER_LANDRACE, pid);
}

// Release a strain from the library (frees a slot). A base strain re-discovers on the next
// harvest, so releasing anything is safe.
export function releaseStrain(ctx: SimContext, id: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta } = r;
  const idx = meta.strains.findIndex((s) => s.id === id);
  if (idx < 0) {
    ctx.error(meta.entityId, "You don't have that strain.");
    return;
  }
  const [removed] = meta.strains.splice(idx, 1);
  ctx.notice(meta.entityId, `You release the ${removed.name} strain.`);
}

// The client-facing library view (IWorld read; rides the self-snapshot). Expressed
// phenotype only, never the raw genotype.
export function strainViews(strains: Strain[]): StrainView[] {
  return strains.map(strainView);
}

// ---- Persistence ------------------------------------------------------------------
// Strains are self-contained (name + genotype are stored, not re-derived from content), so
// a save round-trips without depending on the base-strain table. Truncated to MAX_STRAINS
// on load to bound a tampered save.

export interface SavedStrain {
  id: string;
  baseId: string;
  name: string;
  genotype: Genotype;
  landrace: boolean;
  // Both optional and both absent from saves written before named genetics
  // landed, so an old character loads with an unattributed library rather than
  // failing. Never backfilled: a strain whose breeder was not recorded has no
  // truthful value to invent.
  lineage?: [string, string];
  breeder?: string;
}

export function serializeStrains(strains: Strain[]): SavedStrain[] {
  return strains.map((s) => ({
    id: s.id,
    baseId: s.baseId,
    name: s.name,
    genotype: {
      potency: [s.genotype.potency[0], s.genotype.potency[1]],
      vigor: [s.genotype.vigor[0], s.genotype.vigor[1]],
      yield: [s.genotype.yield[0], s.genotype.yield[1]],
    },
    landrace: s.landrace,
    ...(s.lineage ? { lineage: [s.lineage[0], s.lineage[1]] as [string, string] } : {}),
    ...(s.breeder ? { breeder: s.breeder } : {}),
  }));
}

export function restoreStrains(saved: SavedStrain[] | undefined): Strain[] {
  if (!saved) return [];
  return saved.slice(0, MAX_STRAINS).map((s) => ({
    id: s.id,
    baseId: s.baseId,
    name: s.name,
    genotype: {
      potency: [s.genotype.potency[0], s.genotype.potency[1]],
      vigor: [s.genotype.vigor[0], s.genotype.vigor[1]],
      yield: [s.genotype.yield[0], s.genotype.yield[1]],
    },
    landrace: s.landrace,
    ...(s.lineage ? { lineage: [s.lineage[0], s.lineage[1]] as [string, string] } : {}),
    ...(s.breeder ? { breeder: s.breeder } : {}),
  }));
}
