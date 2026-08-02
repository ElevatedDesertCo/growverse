// Crafting: the command body behind the Grow Station and Upgrade Bench. A pure
// free function `craft(ctx, recipeId, pid)` on the SimContext seam, mirroring the
// vendor buy path in items.ts (validate near the right station, check copper +
// reagents, deduct, award, emit a structured event). Sim keeps a thin same-named
// delegate so the IWorld surface, server/game.ts, and tests resolve unchanged.
//
// Recipes + reagent/output items are data-as-code in content/crafting.ts; this file
// holds NO balance numbers. `src/sim`-pure: no DOM/Three/render-ui-game-net imports,
// no Math.random/Date.now (enforced by tests/architecture.test.ts). Draws NO rng.

import { CRAFT_RECIPES_BY_ID, NPCS } from './data';
import { STATION_PROFESSION, trainProfession } from './professions';
import { meetsTier } from './reputation';
import type { SimContext } from './sim_context';
import { type CraftStation, dist2d, type Entity, INTERACT_RANGE } from './types';

// True when the player stands next to an NPC attending the given station. Mirrors
// vendorInRange in items.ts; the station role lives on the NpcDef, resolved by the
// entity's templateId.
function craftingStationInRange(ctx: SimContext, p: Entity, station: CraftStation): boolean {
  return [...ctx.entities.values()].some(
    (e) =>
      e.kind === 'npc' &&
      NPCS[e.templateId]?.crafting === station &&
      dist2d(p.pos, e.pos) <= INTERACT_RANGE + 2,
  );
}

export function craft(ctx: SimContext, recipeId: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  const recipe = CRAFT_RECIPES_BY_ID[recipeId];
  if (!recipe) {
    ctx.error(meta.entityId, 'That recipe is not available here.');
    return;
  }
  if (!craftingStationInRange(ctx, p, recipe.station)) {
    ctx.error(meta.entityId, 'You are too far from the station.');
    return;
  }
  if (recipe.requiredLevel && p.level < recipe.requiredLevel) {
    ctx.error(meta.entityId, 'You are not skilled enough to craft that yet.');
    return;
  }
  if (
    recipe.requiredProfession &&
    meta.professions[recipe.requiredProfession.id] < recipe.requiredProfession.skill
  ) {
    // Reuse the level-gate line (already localized): the player lacks the gathering
    // skill the recipe needs. No new sim string.
    ctx.error(meta.entityId, 'You are not skilled enough to craft that yet.');
    return;
  }
  if (
    recipe.requiredRep &&
    !meetsTier(meta.reputation, recipe.requiredRep.factionId, recipe.requiredRep.tier)
  ) {
    ctx.error(meta.entityId, 'The commune does not trust you enough for that yet.');
    return;
  }
  if (recipe.requiresFreshHarvest !== undefined) {
    // Live resin is pressed from material that never dried, so the recipe reads the
    // player's last garden harvest rather than the bags (inventory stacks are fungible
    // and carry no age). Missing the window costs nothing: the same buds still make hash.
    const last = meta.lastHarvestAt;
    if (last === null || ctx.time - last > recipe.requiresFreshHarvest) {
      ctx.error(meta.entityId, 'Those buds have dried. Extract live resin right after a harvest.');
      return;
    }
  }
  if (meta.copper < recipe.copperCost) {
    ctx.error(meta.entityId, 'Not enough money.');
    return;
  }
  for (const input of recipe.inputs) {
    if (ctx.countItem(input.itemId, meta.entityId) < input.count) {
      ctx.error(meta.entityId, 'You lack the materials to craft that.');
      return;
    }
  }

  // All checks passed: consume copper + reagents, award the output.
  meta.copper -= recipe.copperCost;
  for (const input of recipe.inputs) ctx.removeItem(input.itemId, input.count, meta.entityId);
  ctx.addItem(recipe.output.itemId, recipe.output.count, meta.entityId);
  // A craft trains its station's skill, the same way a gather trains a node's. Trained
  // AFTER the checks so a failed craft never advances the line that gates it.
  trainProfession(meta.professions, STATION_PROFESSION[recipe.station]);
  ctx.emit({ type: 'craft', recipeId: recipe.id, pid: meta.entityId });
}
