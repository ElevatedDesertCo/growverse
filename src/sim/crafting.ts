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
  ctx.emit({ type: 'craft', recipeId: recipe.id, pid: meta.entityId });
}
