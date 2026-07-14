// Resource gathering: the harvest channel behind a resource node. `startHarvest`
// begins a channel on a node (a ground object marked with a `harvestNodeId`);
// `completeHarvest` rolls the node's yield table for one EXISTING crafting reagent
// and depletes the node (it respawns on a timer via the shared object-respawn tick).
// Mirrors the fishing channel (startFishing / completeFishing) but targets a
// specific world object, tracked on `p.harvestTargetId`. Draws rng ONLY at
// completion (the yield roll), exactly like fishing.
//
// A pure free-function slice on the SimContext seam; `src/sim`-pure (no DOM/Three,
// no Math.random/Date.now, enforced by tests/architecture.test.ts). The guard error
// strings are reused verbatim from the fishing path, so they are already localized
// and this slice introduces no new player text.

import { HARVEST_NODES } from './data';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';
import {
  dist2d,
  type Entity,
  HARVEST_CAST_ID,
  HARVEST_CAST_TIME,
  HARVEST_RESPAWN,
  INTERACT_RANGE,
  isConsuming,
} from './types';

// Begin working a resource node: guard the player state, then start the harvest
// channel aimed at this node. Called from pickUpObject when the target object
// carries a harvestNodeId, so its range is already checked by the caller.
export function startHarvest(ctx: SimContext, objId: number, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  const obj = ctx.entities.get(objId);
  if (obj?.kind !== 'object' || !obj.lootable || !obj.harvestNodeId) return;
  const node = HARVEST_NODES[obj.harvestNodeId];
  if (!node) return;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  if (p.inCombat) {
    ctx.error(meta.entityId, "You can't do that while in combat.");
    return;
  }
  if (p.castingAbility || isConsuming(p)) {
    ctx.error(meta.entityId, 'You are busy.');
    return;
  }
  if (p.sitting) p.sitting = false;
  const castTime = node.castTime ?? HARVEST_CAST_TIME;
  p.castingAbility = HARVEST_CAST_ID;
  p.castTotal = castTime;
  p.castRemaining = castTime;
  p.channeling = false;
  p.harvestTargetId = obj.id;
  ctx.emit({ type: 'castStart', entityId: p.id, ability: HARVEST_CAST_ID, time: castTime });
}

// The channel completed: re-validate the node (it may have depleted, or the player
// walked out of range), roll the yield table for one reagent, award it, and deplete
// the node so the shared object-respawn tick returns it after `respawn` seconds.
export function completeHarvest(ctx: SimContext, p: Entity, meta: PlayerMeta): void {
  const objId = p.harvestTargetId;
  p.harvestTargetId = null;
  if (objId === null) return;
  const obj = ctx.entities.get(objId);
  if (obj?.kind !== 'object' || !obj.lootable || !obj.harvestNodeId) return;
  if (dist2d(p.pos, obj.pos) > INTERACT_RANGE) return;
  const node = HARVEST_NODES[obj.harvestNodeId];
  if (!node) return;
  const total = node.yields.reduce((sum, y) => sum + y.weight, 0);
  let roll = ctx.rng.next() * total;
  let got = node.yields[node.yields.length - 1].itemId;
  for (const y of node.yields) {
    roll -= y.weight;
    if (roll < 0) {
      got = y.itemId;
      break;
    }
  }
  ctx.addItem(got, 1, meta.entityId);
  // Structured gather event (alongside addItem's "You receive" loot line): lets the
  // client pop a card with the reagent's icon + localized name on each harvest.
  ctx.emit({ type: 'harvestGather', itemId: got, pid: meta.entityId });
  obj.lootable = false;
  obj.respawnTimer = node.respawn ?? HARVEST_RESPAWN;
}
