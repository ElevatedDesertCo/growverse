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

import { PLANTS } from './data';
import type { SimContext } from './sim_context';
import { registerBaseStrain } from './strain_library';
import { GARDEN_PLOT_COUNT, type Plot, type PlotView } from './types';

export type PlotStage = 'empty' | 'growing' | 'ready';

// A fresh, all-empty garden (used at character create and as the load default).
export function emptyPlots(): Plot[] {
  return Array.from({ length: GARDEN_PLOT_COUNT }, () => ({ seedItemId: null, plantedAt: 0 }));
}

// The stage of a plot at sim-time `now`. An unknown seed id reads as empty (defensive:
// a plant whose seed was removed from content can always be cleared/re-used).
export function plotStage(plot: Plot, now: number): PlotStage {
  if (!plot.seedItemId) return 'empty';
  const def = PLANTS[plot.seedItemId];
  if (!def) return 'empty';
  return now - plot.plantedAt >= def.growSeconds ? 'ready' : 'growing';
}

// Growth fraction 0..1 for a planted plot (1 = ready); 0 for empty/unknown.
export function plotProgress(plot: Plot, now: number): number {
  if (!plot.seedItemId) return 0;
  const def = PLANTS[plot.seedItemId];
  if (!def || def.growSeconds <= 0) return plot.seedItemId ? 1 : 0;
  return Math.min(1, Math.max(0, (now - plot.plantedAt) / def.growSeconds));
}

// The client-facing view of a garden: one PlotView per plot, computed from the plots +
// the sim clock. Used by the IWorld `garden` read (both worlds) and the self-snapshot
// encoder. Quantized (progress to 2 decimals, secondsRemaining to whole seconds) so a
// growing plant only nudges the snapshot delta about once a second, not every tick.
export function gardenView(plots: Plot[], now: number): PlotView[] {
  return plots.map((plot) => {
    const stage = plotStage(plot, now);
    if (stage === 'empty') {
      return { seedItemId: null, stage, progress: 0, secondsRemaining: 0 };
    }
    const def = plot.seedItemId ? PLANTS[plot.seedItemId] : undefined;
    const remaining = def ? Math.max(0, Math.ceil(def.growSeconds - (now - plot.plantedAt))) : 0;
    return {
      seedItemId: plot.seedItemId,
      stage,
      progress: Math.round(plotProgress(plot, now) * 100) / 100,
      secondsRemaining: stage === 'ready' ? 0 : remaining,
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
  ctx.notice(meta.entityId, `You plant ${def.name}.`);
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
    return;
  }
  if (ctx.time - plot.plantedAt < def.growSeconds) {
    ctx.error(meta.entityId, 'That plant is not ready to harvest yet.');
    return;
  }
  for (const y of def.yields) ctx.addItem(y.itemId, y.count, meta.entityId);
  const name = def.name;
  plot.seedItemId = null;
  plot.plantedAt = 0;
  ctx.notice(meta.entityId, `You harvest ${name}.`);
  // Genetics: harvesting a base seed discovers its strain in the library (once per
  // lineage), seeding the breeding loop from ordinary cultivation output.
  registerBaseStrain(ctx, def.seedItemId, pid);
}

// Persistence: store elapsed grow time (not an absolute clock stamp) so growth resumes
// correctly after the sim clock resets. Empty plots serialize to null.
export function serializePlots(
  plots: Plot[],
  now: number,
): ({ seedItemId: string; grown: number } | null)[] {
  return plots.map((plot) =>
    plot.seedItemId
      ? { seedItemId: plot.seedItemId, grown: Math.max(0, now - plot.plantedAt) }
      : null,
  );
}

// Rebuild the fixed-size plot array from a save, rebasing `grown` back onto the current
// sim clock. Pads/truncates to GARDEN_PLOT_COUNT so a save from a different garden size
// loads cleanly, and drops entries whose seed is no longer plantable content.
export function restorePlots(
  saved: ({ seedItemId: string; grown: number } | null)[] | undefined,
  now: number,
): Plot[] {
  const plots = emptyPlots();
  if (!saved) return plots;
  for (let i = 0; i < plots.length; i++) {
    const s = saved[i];
    if (s?.seedItemId && PLANTS[s.seedItemId]) {
      plots[i] = { seedItemId: s.seedItemId, plantedAt: now - Math.max(0, s.grown) };
    }
  }
  return plots;
}
