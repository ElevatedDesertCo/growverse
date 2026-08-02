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

import { BASE_STRAIN_BY_SEED, NPCS } from './data';
import { baseStrain, breed, isLandrace, refineGenotype, strainView } from './genetics';
import { trainProfession } from './professions';
import { awardReputation, REP_PER_BREED, REP_PER_LANDRACE } from './reputation';
import type { SimContext } from './sim_context';
import {
  BREED_COST_COUNT,
  BREED_COST_ITEM,
  dist2d,
  type Entity,
  type Genotype,
  INTERACT_RANGE,
  MAX_STRAINS,
  STRAIN_MASTERY_MAX,
  STRAIN_TRAITS,
  type Strain,
  type StrainView,
} from './types';

// Breeding costs two EPIC Buds, a mother and a father. Epic Buds are not a grade of the
// bulk crop: they drop from how well a crop was GROWN (the tend record plus the grower's
// mastery of that strain, see cultivation.ts), and a perfect grow guarantees one.
//
// This is the point of the gate. The cost used to be two Common Buds, which any amount
// of planting produced, so the breeding economy was a function of grow VOLUME. Tying it
// to Epic Buds makes it a function of grow SKILL instead: a grower who tends well breeds
// often, and a grower who does not has to buy the difference from one who does, which is
// what gives the player market something worth trading.
// Re-exported (the values live with the other tuning constants in types.ts) so the
// existing importers here and in tests keep resolving them from the owning system.
export { BREED_COST_COUNT, BREED_COST_ITEM };

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

// The Breeding Chamber is kept by the Cultivator, so his station is the anchor:
// one NPC, one building, both the Grow Station and the crossing bench. Mirrors
// craftingStationInRange (crafting.ts) rather than inventing a second rule.
function breedingChamberInRange(ctx: SimContext, p: Entity): boolean {
  return [...ctx.entities.values()].some(
    (e) =>
      e.kind === 'npc' &&
      NPCS[e.templateId]?.crafting === 'grow' &&
      dist2d(p.pos, e.pos) <= INTERACT_RANGE + 2,
  );
}

// Cross two owned strains into a new library strain. Guards mirror the other consumable
// actions (at the chamber, alive, both strains owned and distinct, library has room, can
// pay the cost). Draws through ctx.rng so the offspring is replay-stable.
export function breedStrains(ctx: SimContext, idA: string, idB: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  // Crossing happens at the Breeding Chamber, not anywhere in the world. Same
  // proximity rule the crafting stations use (crafting.ts), keyed on the NPC who
  // keeps the chamber, so breeding is a PLACE you go rather than a menu you open.
  if (!breedingChamberInRange(ctx, p)) {
    ctx.error(meta.entityId, 'You are too far from the Breeding Chamber.');
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
    // Names the real cost AND how to get one, because the answer is not "grow more", it
    // is "grow better": an Epic Bud comes off a well-tended crop, not a bigger one.
    ctx.error(meta.entityId, 'You need two Epic Buds to cross strains. Tend a crop to earn one.');
    return;
  }
  ctx.removeItem(BREED_COST_ITEM, BREED_COST_COUNT, meta.entityId);
  // The cross is credited to the breeder, and its name is generated from the
  // parents, so the library reads as a lineage rather than twelve identical rows.
  const child = breed(ctx.rng, a, b, `s${meta.strainSeq++}`, p.name);
  meta.strains.push(child);
  // Breeding is its own skill: reading genetics is not the same competence as growing a
  // plant well, so a cross trains breeding rather than cultivation. Trained here, after
  // every guard and after the cost is paid, so only a cross that actually landed counts.
  trainProfession(meta.professions, 'breeding');
  ctx.notice(meta.entityId, `You cross ${a.name} and ${b.name} into a new ${child.name} strain.`);
  // The ceremony. World-visible (no pid) so other growers at the chamber see a
  // cross land, which is half the point of breeding being a place.
  ctx.emit({
    type: 'strainFused',
    entityId: meta.entityId,
    childName: child.name,
    landrace: child.landrace,
  });
  // Reputation: breeding advances the commune's craft; a rare landrace is a windfall.
  awardReputation(ctx, 'baked_beaver', REP_PER_BREED, pid);
  if (child.landrace) awardReputation(ctx, 'baked_beaver', REP_PER_LANDRACE, pid);
}

// Refine a strain: fold a DONOR strain's genetics into a TARGET strain, consuming the
// donor. The target keeps everything that makes it that strain (its name, lineage,
// breeder credit, and the MASTERY the owner built on it) and gets a genotype that is
// never worse on any trait; the donor's library slot is freed.
//
// This is the answer to a real pressure the library has: MAX_STRAINS means it fills, and
// before this every further cross forced a release, so a full library was a dead end and
// the mediocre strains cluttering it were pure waste. Refining gives them somewhere to
// go, and unlike a cross it FREES a slot instead of needing one.
//
// It also resolves the tension mastery created. Mastery is per-strain and never
// transfers, so breeding your way to better genetics used to mean abandoning the record
// you had built on the strain you knew. Refining improves the strain you have MASTERED
// instead, which is what makes it worth the same Epic Bud cost as a cross.
//
// Draws NO rng: the improvement is deterministic (see genetics.refineGenotype), which is
// what makes an expensive deliberate action worth taking.
export function refineStrain(
  ctx: SimContext,
  targetId: string,
  donorId: string,
  pid?: number,
): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  // Same place as a cross: refining is chamber work, not a menu you open anywhere.
  if (!breedingChamberInRange(ctx, p)) {
    ctx.error(meta.entityId, 'You are too far from the Breeding Chamber.');
    return;
  }
  if (targetId === donorId) {
    ctx.error(meta.entityId, 'Pick a different strain to refine with.');
    return;
  }
  const target = meta.strains.find((s) => s.id === targetId);
  const donorIndex = meta.strains.findIndex((s) => s.id === donorId);
  if (!target || donorIndex < 0) {
    ctx.error(meta.entityId, "You don't have both of those strains.");
    return;
  }
  if (ctx.countItem(BREED_COST_ITEM, meta.entityId) < BREED_COST_COUNT) {
    ctx.error(meta.entityId, 'You need two Epic Buds to cross strains. Tend a crop to earn one.');
    return;
  }
  const donor = meta.strains[donorIndex];
  const improved = refineGenotype(target.genotype, donor.genotype);
  // Nothing gained means nothing spent: refusing rather than silently eating two Epic
  // Buds for a no-op is the difference between a mechanic and a trap. Note this tests
  // every ALLELE, not just the expressed tier, because lifting only the hidden recessive
  // is still a real gain (it is what the strain passes on in future crosses).
  const changed = STRAIN_TRAITS.some(
    (t) => improved[t][0] !== target.genotype[t][0] || improved[t][1] !== target.genotype[t][1],
  );
  if (!changed) {
    ctx.error(meta.entityId, 'That strain has nothing to add. Pick a stronger donor.');
    return;
  }
  ctx.removeItem(BREED_COST_ITEM, BREED_COST_COUNT, meta.entityId);
  target.genotype = improved;
  // A refine can complete a set of maxed traits, so the landrace flag is recomputed
  // rather than carried: that is a legitimate way to reach one.
  const wasLandrace = target.landrace;
  target.landrace = isLandrace(improved);
  meta.strains.splice(donorIndex, 1);
  ctx.notice(meta.entityId, `You refine ${target.name} with ${donor.name}.`);
  // Reuse the cross ceremony: from the outside a refine looks like what it is, two
  // strains becoming one at the chamber.
  ctx.emit({
    type: 'strainFused',
    entityId: meta.entityId,
    childName: target.name,
    landrace: target.landrace,
  });
  awardReputation(ctx, 'baked_beaver', REP_PER_BREED, pid);
  // Only a NEWLY reached landrace pays the windfall, so refining a landrace repeatedly
  // cannot farm reputation.
  if (target.landrace && !wasLandrace) awardReputation(ctx, 'baked_beaver', REP_PER_LANDRACE, pid);
  // Refining is breeding work, so it trains the same line a cross does.
  trainProfession(meta.professions, 'breeding');
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
  // The grower's record with this strain. Absent from saves written before mastery
  // existed, which load at 0: mastery is earned by growing, so starting a returning
  // player at zero is the truthful value rather than a backfilled guess.
  mastery?: number;
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
    ...(s.mastery > 0 ? { mastery: s.mastery } : {}),
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
    mastery: Math.max(0, Math.min(STRAIN_MASTERY_MAX, s.mastery ?? 0)),
  }));
}
