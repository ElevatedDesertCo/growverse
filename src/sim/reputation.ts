// Commune reputation: the standing math and the gain/gate actions for the Baked Beaver
// commune. A player's standing is a single points total per faction (PlayerMeta.reputation);
// points earned from commune activities cross ascending tiers that gate strains/recipes/
// cosmetics. This module holds the tier math (pure, unit-tested directly) plus the stateful
// award action behind the SimContext seam. Draws NO rng and reads no clock: gains are
// deterministic point adds. `src/sim`-pure. Player text is English source, localized at the
// client boundary.

import { FACTIONS } from './data';
import type { SimContext } from './sim_context';
import {
  type FactionId,
  REP_MAX,
  REP_TIER_THRESHOLDS,
  REP_TIERS,
  type RepTier,
  type ReputationView,
} from './types';

// Reputation gains from cultivation/genetics activity. Named here so the tuning lives with
// the standing math; the harvest/breed sites just award these.
export const REP_PER_HARVEST = 15;
export const REP_PER_BREED = 30;
export const REP_PER_LANDRACE = 150; // one-off windfall for breeding a rare landrace

// A fresh reputation ledger (character create + load default): every faction at 0.
export function emptyReputation(): Record<FactionId, number> {
  return { baked_beaver: 0 };
}

// Clamp raw points into the legal band.
function clampPoints(points: number): number {
  return points < 0 ? 0 : points > REP_MAX ? REP_MAX : points;
}

// The tier index (0..REP_TIERS.length-1) a points total falls in: the highest threshold it
// has reached.
export function tierIndexFor(points: number): number {
  let idx = 0;
  for (let i = 0; i < REP_TIER_THRESHOLDS.length; i++) {
    if (points >= REP_TIER_THRESHOLDS[i]) idx = i;
  }
  return idx;
}

export function tierFor(points: number): RepTier {
  return REP_TIERS[tierIndexFor(points)];
}

// The player's current points with a faction (0 when unseen).
export function pointsFor(reputation: Record<FactionId, number>, factionId: FactionId): number {
  return reputation[factionId] ?? 0;
}

// True when the player's standing with a faction is at or above the given tier. The gate
// used by recipes (CraftRecipe.requiredRep) and any future strain/cosmetic gate.
export function meetsTier(
  reputation: Record<FactionId, number>,
  factionId: FactionId,
  tier: RepTier,
): boolean {
  return tierIndexFor(pointsFor(reputation, factionId)) >= REP_TIERS.indexOf(tier);
}

// The client-facing standing view for one faction: points, tier, and progress toward the
// next tier (1 at exalted).
export function reputationView(
  reputation: Record<FactionId, number>,
  factionId: FactionId,
): ReputationView {
  const points = pointsFor(reputation, factionId);
  const tierIndex = tierIndexFor(points);
  const floor = REP_TIER_THRESHOLDS[tierIndex];
  const ceil = REP_TIER_THRESHOLDS[tierIndex + 1];
  const atMax = ceil === undefined;
  return {
    factionId,
    name: FACTIONS[factionId].name,
    points,
    tier: REP_TIERS[tierIndex],
    tierIndex,
    progress: atMax ? 1 : (points - floor) / (ceil - floor),
    nextThreshold: atMax ? null : ceil,
  };
}

// All faction standings for the IWorld read / self-snapshot.
export function reputationViews(reputation: Record<FactionId, number>): ReputationView[] {
  return REP_FACTION_IDS.map((id) => reputationView(reputation, id));
}
const REP_FACTION_IDS: FactionId[] = ['baked_beaver'];

// Award reputation to a player, clamped to the cap. Announces a tier-up (crossing into a
// higher standing) with a notice. A non-positive amount is a no-op. Returns the new points.
export function awardReputation(
  ctx: SimContext,
  factionId: FactionId,
  amount: number,
  pid?: number,
): number {
  const r = ctx.resolve(pid);
  if (!r) return 0;
  const { meta } = r;
  if (amount <= 0) return pointsFor(meta.reputation, factionId);
  const before = pointsFor(meta.reputation, factionId);
  const after = clampPoints(before + amount);
  meta.reputation[factionId] = after;
  if (tierIndexFor(after) > tierIndexFor(before)) {
    ctx.notice(meta.entityId, `You are now ${tierFor(after)} with ${FACTIONS[factionId].name}.`);
    // A standing objective can only come due on a tier crossing, so credit it here rather
    // than polling. Every rep source (harvest, breed, cup) routes through this one fn.
    ctx.onReputationChangedForQuests(meta);
  }
  return after;
}

// ---- Persistence ------------------------------------------------------------------
// A plain factionId -> points map. Restore starts from the default ledger and overlays any
// known faction's saved points (clamped), so an unknown/removed faction in a save is dropped
// and a new faction defaults in cleanly.
export type SavedReputation = Partial<Record<FactionId, number>>;

export function serializeReputation(reputation: Record<FactionId, number>): SavedReputation {
  return { baked_beaver: reputation.baked_beaver ?? 0 };
}

export function restoreReputation(saved: SavedReputation | undefined): Record<FactionId, number> {
  const rep = emptyReputation();
  if (!saved) return rep;
  for (const id of REP_FACTION_IDS) {
    if (typeof saved[id] === 'number') rep[id] = clampPoints(saved[id] as number);
  }
  return rep;
}
