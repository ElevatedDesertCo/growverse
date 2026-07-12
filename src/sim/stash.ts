// The account bank (stash): the command bodies behind a stash-keeper NPC. Two pure
// free functions `stashDeposit`/`stashWithdraw` on the SimContext seam, mirroring the
// vendor buy/sell path in items.ts and the craft path in crafting.ts (validate near
// the right NPC, move a stack between bags and the persistent bank, emit a structured
// event). Sim keeps thin same-named delegates so the IWorld surface, server/game.ts,
// and tests resolve unchanged.
//
// The bank contents live on PlayerMeta.stash (persisted in CharacterState, like
// vendorBuyback); this file mutates that array in place plus the bags through the
// inventory hub. The stash-keeper role lives on the NpcDef (`stash?: true`), resolved
// by the entity's templateId, so no new Entity/wire field is needed.
//
// `src/sim`-pure: no DOM/Three/render-ui-game-net imports, no Math.random/Date.now
// (enforced by tests/architecture.test.ts). Draws NO rng.

import { ITEMS, NPCS } from './data';
import type { SimContext } from './sim_context';
import { dist2d, type Entity, INTERACT_RANGE, type InvSlot } from './types';

// Distinct stacks the bank can hold. Deposits that would introduce a NEW stack past
// this cap are rejected; topping up an existing stack is always allowed.
export const STASH_LIMIT = 98;

// True when the player stands next to a stash-keeper NPC. Mirrors vendorInRange
// (items.ts) and craftingStationInRange (crafting.ts); the role lives on the NpcDef,
// resolved by the entity's templateId.
function stashKeeperInRange(ctx: SimContext, p: Entity): boolean {
  return [...ctx.entities.values()].some(
    (e) =>
      e.kind === 'npc' &&
      NPCS[e.templateId]?.stash === true &&
      dist2d(p.pos, e.pos) <= INTERACT_RANGE + 2,
  );
}

// Add `count` of `itemId` into a stack array in place, merging into an existing stack.
// Returns false if a NEW stack is needed but the array is already at `limit`.
function stackInto(slots: InvSlot[], itemId: string, count: number, limit: number): boolean {
  const existing = slots.find((s) => s.itemId === itemId);
  if (existing) {
    existing.count += count;
    return true;
  }
  if (slots.length >= limit) return false;
  slots.push({ itemId, count });
  return true;
}

export function stashDeposit(ctx: SimContext, itemId: string, count = 1, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  const def = ITEMS[itemId];
  const available = ctx.countItem(itemId, meta.entityId);
  if (!def || available <= 0) {
    ctx.error(meta.entityId, "You don't have that item.");
    return;
  }
  if (!stashKeeperInRange(ctx, p)) {
    ctx.error(meta.entityId, 'There is no bank nearby.');
    return;
  }
  const moveCount = Number.isFinite(count) ? Math.min(Math.floor(count), available) : 0;
  if (moveCount <= 0) return;
  // Reserve the bank slot BEFORE removing from bags, so a full bank never eats the item.
  if (!stackInto(meta.stash, itemId, moveCount, STASH_LIMIT)) {
    ctx.error(meta.entityId, 'Your bank is full.');
    return;
  }
  ctx.removeItem(itemId, moveCount, meta.entityId);
  ctx.emit({ type: 'stash', action: 'deposit', itemId, pid: meta.entityId });
}

export function stashWithdraw(ctx: SimContext, itemId: string, count = 1, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.dead) {
    ctx.error(meta.entityId, "You can't do that while dead.");
    return;
  }
  if (!stashKeeperInRange(ctx, p)) {
    ctx.error(meta.entityId, 'There is no bank nearby.');
    return;
  }
  const slot = meta.stash.find((s) => s.itemId === itemId);
  const def = ITEMS[itemId];
  if (!def || !slot || slot.count <= 0) {
    ctx.error(meta.entityId, 'That item is not in your bank.');
    return;
  }
  const moveCount = Number.isFinite(count) ? Math.min(Math.floor(count), slot.count) : 0;
  if (moveCount <= 0) return;
  slot.count -= moveCount;
  if (slot.count <= 0) meta.stash = meta.stash.filter((s) => s !== slot);
  // Add straight into bags (merge stacks); no loot line, the stash event drives the log.
  stackInto(meta.inventory, itemId, moveCount, Number.POSITIVE_INFINITY);
  ctx.onInventoryChangedForQuests(meta);
  ctx.emit({ type: 'stash', action: 'withdraw', itemId, pid: meta.entityId });
}
