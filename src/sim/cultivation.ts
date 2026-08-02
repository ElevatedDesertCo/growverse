// Cultivation: the personal-garden system. A player has GARDEN_PLOT_COUNT plots
// (PlayerMeta.plots); planting a crafted seed in an empty plot starts it growing, and
// once it matures over the seed's PlantDef.growSeconds it can be harvested for Bloom
// material (which feeds Sessions + alchemy). Growth is purely time-derived from the sim
// clock (plantedAt vs ctx.time), so there is no per-tick loop and this slice draws NO
// rng: stage/progress are pure reads and plant/harvest are deterministic state edits.
//
// Persistence rebases time: serialize stores `grown` (elapsed sim-seconds) rather than
// an absolute plant time, and restore sets plantedAt = now - grown, so a plant resumes
// where it left off after a relog or a server restart (the sim clock resets to 0 on a
// fresh Sim). Plants do not advance while the owner is offline; they resume on load.
//
// Per-player state lives on PlayerMeta; the functions talk only to the SimContext seam
// (no Sim internals). `src/sim`-pure: no DOM/Three/render-ui-game-net imports, no
// Math.random/Date.now (enforced by tests/architecture.test.ts). Player-facing strings
// are English source, emitted from this module (localized at the client boundary).

import { BASE_STRAINS, PLANTS } from './data';
import { budGrade, dropsEssence, expressTrait, growTimeFactor, yieldBonus } from './genetics';
import { trainProfession } from './professions';
import { awardReputation, REP_PER_HARVEST } from './reputation';
import type { SimContext } from './sim_context';
import { registerBaseStrain } from './strain_library';
import {
  GARDEN_PLOT_COUNT,
  gardenPlotUnlockLevel,
  type Plot,
  type PlotView,
  unlockedGardenPlots,
} from './types';

export type PlotStage = 'empty' | 'growing' | 'ready';

// The concentrated harvest material a high-potency strain also drops.
const ESSENCE_ITEM = 'bloom_essence';

// A fresh, all-empty garden (used at character create and as the load default).
export function emptyPlots(): Plot[] {
  return Array.from({ length: GARDEN_PLOT_COUNT }, () => ({
    seedItemId: null,
    plantedAt: 0,
    growSeconds: 0,
    strainId: null,
  }));
}

// The stage of a plot at sim-time `now`. An unknown seed id reads as empty (defensive:
// a plant whose seed was removed from content can always be cleared/re-used). Timing uses
// the plot's resolved growSeconds (a strain's vigor may have shortened it), not the raw
// PlantDef, so no genotype lookup is needed here.
export function plotStage(plot: Plot, now: number): PlotStage {
  if (!plot.seedItemId || !PLANTS[plot.seedItemId]) return 'empty';
  return now - plot.plantedAt >= plot.growSeconds ? 'ready' : 'growing';
}

// Growth fraction 0..1 for a planted plot (1 = ready); 0 for empty/unknown.
export function plotProgress(plot: Plot, now: number): number {
  if (!plot.seedItemId || !PLANTS[plot.seedItemId]) return 0;
  if (plot.growSeconds <= 0) return 1;
  return Math.min(1, Math.max(0, (now - plot.plantedAt) / plot.growSeconds));
}

// The client-facing view of a garden: one PlotView per plot, computed from the plots +
// the sim clock. Used by the IWorld `garden` read (both worlds) and the self-snapshot
// encoder. Quantized (progress to 2 decimals, secondsRemaining to whole seconds) so a
// growing plant only nudges the snapshot delta about once a second, not every tick.
export function gardenView(plots: Plot[], now: number, level: number): PlotView[] {
  const unlocked = unlockedGardenPlots(level);
  return plots.map((plot, index) => {
    const locked = index >= unlocked;
    const unlockLevel = gardenPlotUnlockLevel(index);
    const stage = plotStage(plot, now);
    if (stage === 'empty') {
      return { seedItemId: null, stage, progress: 0, secondsRemaining: 0, locked, unlockLevel };
    }
    const remaining = Math.max(0, Math.ceil(plot.growSeconds - (now - plot.plantedAt)));
    return {
      seedItemId: plot.seedItemId,
      stage,
      progress: Math.round(plotProgress(plot, now) * 100) / 100,
      secondsRemaining: stage === 'ready' ? 0 : remaining,
      locked,
      unlockLevel,
    };
  });
}

// Plant a seed the player carries into an empty plot. Guards mirror the other
// consumable actions (alive, valid target, has the item). Consumes one seed and stamps
// the plot with the current sim-time.
export function plantSeed(
  ctx: SimContext,
  plotIndex: number,
  seedItemId: string,
  pid?: number,
): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  const plot = meta.plots[plotIndex];
  if (!plot) {
    ctx.error(meta.entityId, 'There is no such garden plot.');
    return;
  }
  // Garden expansion gate: a plot in a not-yet-unlocked row cannot be planted. The Garden
  // window hides the Plant button on locked plots and shows their unlock level, so this is
  // the authoritative backstop against a stale/hostile client; reject quietly.
  if (plotIndex >= unlockedGardenPlots(p.level)) return;
  if (plot.seedItemId) {
    ctx.error(meta.entityId, 'That plot already has something growing.');
    return;
  }
  const def = PLANTS[seedItemId];
  if (!def) {
    ctx.error(meta.entityId, 'That is not a plantable seed.');
    return;
  }
  if (ctx.countItem(seedItemId, meta.entityId) <= 0) {
    ctx.error(meta.entityId, "You don't have that seed.");
    return;
  }
  ctx.removeItem(seedItemId, 1, meta.entityId);
  plot.seedItemId = seedItemId;
  plot.plantedAt = ctx.time;
  plot.growSeconds = def.growSeconds;
  plot.strainId = null;
  ctx.notice(meta.entityId, `You plant ${def.name}.`);
}

// Plant a library strain into an empty plot. Unlike plantSeed (a raw crafted seed), this
// grows a specific bred/discovered strain: it consumes one of the strain's lineage seeds
// as the growing medium, resolves the effective grow time from the strain's vigor, and
// tags the plot so the harvest applies the strain's yield/potency bonuses. Guards mirror
// plantSeed.
export function plantStrain(
  ctx: SimContext,
  plotIndex: number,
  strainId: string,
  pid?: number,
): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  const plot = meta.plots[plotIndex];
  if (!plot) {
    ctx.error(meta.entityId, 'There is no such garden plot.');
    return;
  }
  // Garden expansion gate (see plantSeed): a locked-row plot cannot be planted.
  if (plotIndex >= unlockedGardenPlots(p.level)) return;
  if (plot.seedItemId) {
    ctx.error(meta.entityId, 'That plot already has something growing.');
    return;
  }
  const strain = meta.strains.find((s) => s.id === strainId);
  if (!strain) {
    ctx.error(meta.entityId, "You don't have that strain.");
    return;
  }
  const base = BASE_STRAINS[strain.baseId];
  const seedItemId = base?.seedItemId;
  const def = seedItemId ? PLANTS[seedItemId] : undefined;
  if (!seedItemId || !def) {
    ctx.error(meta.entityId, 'That strain has no seed to grow from.');
    return;
  }
  if (ctx.countItem(seedItemId, meta.entityId) <= 0) {
    ctx.error(meta.entityId, "You don't have a seed to grow that strain.");
    return;
  }
  ctx.removeItem(seedItemId, 1, meta.entityId);
  plot.seedItemId = seedItemId;
  plot.plantedAt = ctx.time;
  plot.growSeconds = def.growSeconds * growTimeFactor(expressTrait(strain.genotype, 'vigor'));
  plot.strainId = strain.id;
  ctx.notice(meta.entityId, `You plant ${strain.name}.`);
}

// Harvest a matured plot: grant its yields and empty it. Errors on an empty or
// still-growing plot; a plot whose seed left content is silently cleared.
export function harvestPlot(ctx: SimContext, plotIndex: number, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  const plot = meta.plots[plotIndex];
  if (!plot || !plot.seedItemId) {
    ctx.error(meta.entityId, 'That plot is empty.');
    return;
  }
  const def = PLANTS[plot.seedItemId];
  if (!def) {
    plot.seedItemId = null;
    plot.plantedAt = 0;
    plot.growSeconds = 0;
    plot.strainId = null;
    return;
  }
  if (ctx.time - plot.plantedAt < plot.growSeconds) {
    ctx.error(meta.entityId, 'That plant is not ready to harvest yet.');
    return;
  }
  // Base yields from the plant, then the strain bonuses. A planted strain drives all
  // three levers at harvest: potency upgrades the bulk yield's GRADE, yield tier adds
  // whole extra units of it, and a potent strain also drops concentrated essence.
  // (Vigor already applied at plant time, through growTimeFactor.)
  const strain = plot.strainId ? meta.strains.find((s) => s.id === plot.strainId) : undefined;
  const baseBulkId = def.yields[0]?.itemId;
  // Only the bulk yield is graded; any secondary yields the plant declares pass through
  // untouched. Without a strain (a plain crafted seed) the declared base grade stands.
  const bulkId = strain ? budGrade(expressTrait(strain.genotype, 'potency')) : baseBulkId;
  for (const y of def.yields) {
    ctx.addItem(y.itemId === baseBulkId && bulkId ? bulkId : y.itemId, y.count, meta.entityId);
  }
  if (strain) {
    const bonus = yieldBonus(expressTrait(strain.genotype, 'yield'));
    if (bulkId && bonus > 0) ctx.addItem(bulkId, bonus, meta.entityId);
    if (dropsEssence(expressTrait(strain.genotype, 'potency'))) {
      ctx.addItem(ESSENCE_ITEM, 1, meta.entityId);
    }
  }
  const name = strain ? strain.name : def.name;
  const seedItemId = def.seedItemId;
  plot.seedItemId = null;
  plot.plantedAt = 0;
  plot.growSeconds = 0;
  plot.strainId = null;
  // Structured gather popup (item icon + localized name), alongside addItem's "You
  // receive" loot lines and the harvest log line, so a harvest reads as a real gather
  // with a floating popup and icon, exactly like the flower-patch nodes (harvest.ts).
  // The popup shows what actually landed in the bags, so a Prime harvest reads as Prime
  // rather than as the plant's declared base grade.
  const gatherId = bulkId ?? def.yields[0]?.itemId;
  if (gatherId) ctx.emit({ type: 'harvestGather', itemId: gatherId, pid: meta.entityId });
  ctx.notice(meta.entityId, `You harvest ${name}.`);
  // Genetics: harvesting a base seed discovers its strain in the library (once per
  // lineage), seeding the breeding loop from ordinary cultivation output.
  registerBaseStrain(ctx, seedItemId, pid);
  // Cultivation is a profession like mining or herbalism: it trains off the action
  // itself. A world node trains via harvest.ts; a garden bed trains here, so working
  // your own field levels the grower's competence line the same way.
  trainProfession(meta.professions, 'cultivation');
  // Stamp the harvest for the Extraction Lab's live-resin window. Set here, at the one
  // place a crop actually comes off the bed, so freshness means what it says.
  meta.lastHarvestAt = ctx.time;
  // Reputation: cultivating for the commune builds standing with the Baked Beaver.
  awardReputation(ctx, 'baked_beaver', REP_PER_HARVEST, pid);
}

// Persistence: store elapsed grow time (not an absolute clock stamp) so growth resumes
// correctly after the sim clock resets. Empty plots serialize to null. A plain seed plot
// stays byte-identical to the pre-genetics shape ({seedItemId, grown}); only a strain plot
// carries the extra strainId + resolved growSeconds (which a strain's vigor made non-default
// and which restore cannot recompute without the library).
export interface SavedPlot {
  seedItemId: string;
  grown: number;
  strainId?: string;
  growSeconds?: number;
}

export function serializePlots(plots: Plot[], now: number): (SavedPlot | null)[] {
  return plots.map((plot) => {
    if (!plot.seedItemId) return null;
    const base: SavedPlot = {
      seedItemId: plot.seedItemId,
      grown: Math.max(0, now - plot.plantedAt),
    };
    if (plot.strainId) {
      base.strainId = plot.strainId;
      base.growSeconds = plot.growSeconds;
    }
    return base;
  });
}

// Rebuild the fixed-size plot array from a save, rebasing `grown` back onto the current
// sim clock. Pads/truncates to GARDEN_PLOT_COUNT so a save from a different garden size
// loads cleanly, and drops entries whose seed is no longer plantable content. A pre-genetics
// save (no growSeconds) falls back to the seed's PlantDef grow time.
export function restorePlots(saved: (SavedPlot | null)[] | undefined, now: number): Plot[] {
  const plots = emptyPlots();
  if (!saved) return plots;
  for (let i = 0; i < plots.length; i++) {
    const s = saved[i];
    if (s?.seedItemId && PLANTS[s.seedItemId]) {
      plots[i] = {
        seedItemId: s.seedItemId,
        plantedAt: now - Math.max(0, s.grown),
        growSeconds: s.growSeconds ?? PLANTS[s.seedItemId].growSeconds,
        strainId: s.strainId ?? null,
      };
    }
  }
  return plots;
}
