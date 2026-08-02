// The Vale Cup: the commune's recurring growing competition, and the system that gives
// everything the cultivation roadmap built something to be FOR.
//
// A season is a fixed window on the sim clock. During it a grower may submit ONE entry: a
// strain from their library plus a handful of buds. The entry is scored, paid, and posted
// to a public board with the grower's name and the strain's name. At the season boundary
// the board clears and the next season opens.
//
// The score deliberately reads every axis the roadmap added, so no single system is the
// whole answer:
//   genetics   the strain's expressed potency / vigor / yield  (breeding)
//   grade      the bud grade actually submitted                (potency, expressed at harvest)
//   mastery    the grower's record with THAT strain            (tending)
//   landrace   the rare all-maxed phenotype                    (breeding luck + refining)
// A player who only breeds, or only tends, or only farms volume, can post a respectable
// score; only one who does all of it posts a winning one.
//
// The reward is paid AT ENTRY, scaled by score, rather than at a rollover payout. That is
// a deliberate v1 boundary: a rollover prize would have to reach players who are offline
// when the season turns, which needs cross-session pending-reward machinery this does not
// have. Scaling the entry reward keeps the incentive gradient (a better entry pays more)
// without pretending to a payout path that would silently drop anyone who logged off.
//
// Economy note: the point of a recurring Cup is the scheduled demand spike. For one season
// every competitor wants high-grade buds, and most would rather buy than breed, which is
// exactly the recurring pull a player market needs to stay liquid.
//
// `src/sim`-pure: no DOM/Three/render-ui-game-net imports, no Math.random/Date.now, and it
// draws NO rng (scoring is a deterministic function of state). Player text is English
// source emitted through ctx, localized at the client boundary.

import { ITEMS, NPCS } from './data';
import { expressTrait } from './genetics';
import { trainProfession } from './professions';
import { awardReputation } from './reputation';
import type { SimContext } from './sim_context';
import {
  CUP_ENTRY_BUD_COUNT,
  CUP_GRADE_ORDER,
  CUP_REP_PER_100,
  CUP_SEASON_SECONDS,
  type CupEntry,
  type CupStanding,
  cupScore,
  dist2d,
  type Entity,
  INTERACT_RANGE,
  type Strain,
} from './types';

// Which season the clock is in. Seasons are derived from the sim clock rather than stored,
// so there is no scheduler to drift and a reloaded world lands in the same season the
// clock says it is in.
export function cupSeasonAt(time: number): number {
  return time < 0 ? 0 : Math.floor(time / CUP_SEASON_SECONDS);
}

// Seconds left in the current season.
export function cupSeasonRemaining(time: number): number {
  const t = time < 0 ? 0 : time;
  return CUP_SEASON_SECONDS - (t % CUP_SEASON_SECONDS);
}

// Score a library strain: expresses its phenotype, then hands the same pure cupScore the
// client runs (types.ts). Keeping the expression step here and the WEIGHTS there is what
// lets the client project a score from its StrainView without ever seeing a genotype.
export function scoreStrain(strain: Strain, budItemId: string): number {
  return cupScore(
    {
      potency: expressTrait(strain.genotype, 'potency'),
      vigor: expressTrait(strain.genotype, 'vigor'),
      yield: expressTrait(strain.genotype, 'yield'),
      landrace: strain.landrace,
      mastery: strain.mastery,
    },
    budItemId,
  );
}

// The Cup is judged by its Steward, so proximity is keyed on that NPC exactly the way the
// crafting stations and the Breeding Chamber key on theirs: entering is somewhere you go.
function cupStewardInRange(ctx: SimContext, p: Entity): boolean {
  return [...ctx.entities.values()].some(
    (e) =>
      e.kind === 'npc' &&
      NPCS[e.templateId]?.cupSteward &&
      dist2d(p.pos, e.pos) <= INTERACT_RANGE + 2,
  );
}

// Drop last season's board when the clock crosses a boundary. Called from the read and the
// entry path rather than from a tick phase: the board is derived state with no per-tick
// work to do, and keeping it off the hot loop means the Cup adds nothing to the tick.
function syncSeason(ctx: SimContext): number {
  const season = cupSeasonAt(ctx.time);
  if (ctx.cupEntries.length > 0 && ctx.cupEntries[0].season !== season) {
    ctx.cupEntries.length = 0;
  }
  return season;
}

// Submit a strain to the current season. Guards mirror the other consumable actions (at
// the Steward, alive, strain owned, buds in hand, not already entered this season).
export function enterCup(ctx: SimContext, strainId: string, budItemId: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  if (!cupStewardInRange(ctx, p)) {
    ctx.error(meta.entityId, 'You are too far from the Cup Steward.');
    return;
  }
  const season = syncSeason(ctx);
  if (ctx.cupEntries.some((e) => e.pid === meta.entityId)) {
    ctx.error(meta.entityId, 'You have already entered this season of the Vale Cup.');
    return;
  }
  const strain = meta.strains.find((s) => s.id === strainId);
  if (!strain) {
    ctx.error(meta.entityId, "You don't have that strain.");
    return;
  }
  if (CUP_GRADE_ORDER.indexOf(budItemId) < 0) {
    ctx.error(meta.entityId, 'The Cup is judged on buds. Bring a harvest to enter.');
    return;
  }
  if (ctx.countItem(budItemId, meta.entityId) < CUP_ENTRY_BUD_COUNT) {
    ctx.error(meta.entityId, 'You do not have enough buds to enter the Vale Cup.');
    return;
  }
  ctx.removeItem(budItemId, CUP_ENTRY_BUD_COUNT, meta.entityId);
  const score = scoreStrain(strain, budItemId);
  ctx.cupEntries.push({
    season,
    pid: meta.entityId,
    growerName: p.name,
    strainName: strain.name,
    budItemId,
    score,
  });
  // A personal best is worth keeping even after the board clears: it is the one part of a
  // season that outlives it, and it is what a returning grower is measured against.
  if (score > meta.cupBest) meta.cupBest = score;
  // Paid at entry, scaled by score (see the module note on why not at rollover). Copper
  // rides the sim's own plain-English money formatter through the loot line addItem
  // already uses, so no new money text is built here.
  meta.copper += score;
  awardReputation(ctx, 'baked_beaver', Math.max(1, Math.round(score / CUP_REP_PER_100)), pid);
  trainProfession(meta.professions, 'breeding');
  const budName = ITEMS[budItemId]?.name ?? budItemId;
  ctx.notice(
    meta.entityId,
    `You enter ${strain.name} in the Vale Cup with ${budName}, scoring ${score}.`,
  );
  // World-visible (no pid): an entry landing is public, which is what makes the board a
  // competition rather than a private scoreboard.
  ctx.emit({
    type: 'cupEntry',
    entityId: meta.entityId,
    growerName: p.name,
    strainName: strain.name,
    score,
  });
}

// The public board for the current season, highest score first. Ties break on the earlier
// entry (a stable sort over insertion order), so posting a score first is worth something.
export function cupStandings(entries: CupEntry[], time: number): CupStanding[] {
  const season = cupSeasonAt(time);
  return entries
    .filter((e) => e.season === season)
    .map((e, index) => ({ ...e, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((e, i) => ({
      rank: i + 1,
      pid: e.pid,
      growerName: e.growerName,
      strainName: e.strainName,
      score: e.score,
    }));
}
