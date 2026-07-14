// Bloom Sessions: the buff half of the cultivation-to-power loop. A "Session" is a
// Bloom tonic (an ItemDef with an `elixir` that may carry `onset`/`couchLock`). Two
// delivery methods fall out of `onset`:
//   - spark  (onset 0/omitted): the buff takes hold instantly on use.
//   - edible (onset > 0): a slow-release draught; the buff takes hold `onset` seconds
//     later, tracked on Entity.pendingSession and applied by tickPendingSession.
// The restful (indica-style) profile carries a `couchLock` tradeoff: a movement-speed
// multiplier applied for the buff's duration alongside the stat buff.
//
// This slice reuses the existing consumable/aura path (ctx.applyAura, ctx.removeItem,
// the localized "You quaff {item}." line), so it needs no SimContext additions and
// draws NO rng. `src/sim`-pure: no DOM/Three/render/ui/net imports, no Math.random/
// Date.now (enforced by tests/architecture.test.ts). Both entry points take `ctx`; it
// is called from items.useItem (on use) and the Sim per-player loop (the onset tick).

import { ITEMS } from './data';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';
import type { Entity } from './types';

type ElixirDef = NonNullable<import('./types').ItemDef['elixir']>;

// Apply a Session's aura(s) to the player: the stat buff, plus the couch-lock slow when
// the tonic carries one. Both share the tonic's duration and refresh on re-use.
function applySessionAuras(ctx: SimContext, p: Entity, itemId: string, elx: ElixirDef): void {
  ctx.applyAura(p, {
    id: `elixir_${itemId}`,
    name: elx.aura,
    kind: elx.kind,
    remaining: elx.duration,
    duration: elx.duration,
    value: elx.value,
    sourceId: p.id,
    school: 'nature',
  });
  if (elx.couchLock !== undefined) {
    ctx.applyAura(p, {
      id: `elixir_${itemId}_couchlock`,
      name: 'Couch-Lock',
      kind: 'slow',
      remaining: elx.duration,
      duration: elx.duration,
      value: elx.couchLock,
      sourceId: p.id,
      school: 'nature',
    });
  }
}

// Consume a Bloom tonic. Spark tonics apply their buff at once; edibles (onset > 0)
// stash a pending activation on the player and take hold later. Either way, emit the
// same localized "You quaff {item}." line the classic elixir path used. Guards (alive,
// item present, not mid-fishing) are the caller's (items.useItem), matching the old
// inline elixir branch this replaces.
export function startSession(
  ctx: SimContext,
  itemId: string,
  p: Entity,
  meta: PlayerMeta,
  elx: ElixirDef,
): void {
  ctx.removeItem(itemId, 1, meta.entityId);
  if (elx.onset && elx.onset > 0) {
    p.pendingSession = { itemId, activateAt: ctx.time + elx.onset };
  } else {
    applySessionAuras(ctx, p, itemId, elx);
  }
  ctx.emit({
    type: 'log',
    text: `You quaff ${ITEMS[itemId].name}.`,
    color: '#c9f',
    pid: meta.entityId,
  });
}

// Per-player tick: once an edible's onset elapses, apply its buff and clear the pending
// slot. No-op for a player with nothing pending (the common case). Re-reads the tonic
// from ITEMS so the pending slot stays a tiny {itemId, activateAt} pair.
export function tickPendingSession(ctx: SimContext, p: Entity): void {
  const pending = p.pendingSession;
  if (!pending) return;
  if (ctx.time < pending.activateAt) return;
  p.pendingSession = null;
  const elx = ITEMS[pending.itemId]?.elixir;
  if (elx) applySessionAuras(ctx, p, pending.itemId, elx);
}
