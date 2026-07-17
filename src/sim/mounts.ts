// Mounts and Stables v1 (docs/prd/mounts-and-stables.md): the mount system
// module behind the SimContext seam. Owns learning (the vendor reins item),
// summon/dismiss, and the auto-dismount rule. Backing state stays on the
// player: PlayerMeta.ownedMounts (persisted) and Entity.mountId (the active
// mount, wire-visible). Speed folds through Sim.moveSpeedMult, which reads
// MOUNTS[e.mountId].speedBonus; there is no mount aura and no new rng draw.

import { MOUNTS } from './data';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';
import type { Entity, MountDef } from './types';

/** Learn a mount from its reins item (ItemUse 'learnMount'). Consumes the item
 *  on success. Called from useItem, which has already verified possession. */
export function learnMount(
  ctx: SimContext,
  meta: PlayerMeta,
  p: Entity,
  itemId: string,
  mountId: string,
): void {
  const mount = MOUNTS[mountId];
  if (!mount) return;
  if (p.dead) return;
  // A Fiesta bout standardizes the character to level 20 with a throwaway
  // build; learning a permanent unlock off that temporary level is not allowed.
  if (meta.fiestaRestore) {
    ctx.error(meta.entityId, "You can't do that during a Fiesta bout.");
    return;
  }
  if (meta.ownedMounts.has(mountId)) {
    ctx.error(meta.entityId, 'You already know how to ride that mount.');
    return;
  }
  if (p.level < mount.requiredLevel) {
    ctx.error(meta.entityId, `You must be level ${mount.requiredLevel} to learn to ride.`);
    return;
  }
  ctx.removeItem(itemId, 1, meta.entityId);
  meta.ownedMounts.add(mountId);
  ctx.emit({
    type: 'log',
    text: `You learn to ride the ${mount.name}.`,
    color: '#8f8',
    pid: meta.entityId,
  });
}

/** Summon an owned mount (or dismiss it when it is already active). */
export function summonMount(ctx: SimContext, mountId: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  const { meta, e: p } = r;
  if (p.mountId === mountId) {
    dismountPlayer(p);
    return;
  }
  const mount: MountDef | undefined = MOUNTS[mountId];
  if (!mount || !meta.ownedMounts.has(mountId)) {
    ctx.error(meta.entityId, "You don't know how to ride that mount.");
    return;
  }
  if (p.dead) return;
  if (p.level < mount.requiredLevel) {
    ctx.error(meta.entityId, `You must be level ${mount.requiredLevel} to ride.`);
    return;
  }
  if (p.inCombat) {
    ctx.error(meta.entityId, "You can't do that while in combat.");
    return;
  }
  // No mounted spellwork: a summon during a cast would let the cast complete
  // mounted (castAbility only dismounts at cast START).
  if (p.castingAbility !== null) {
    ctx.error(meta.entityId, 'You are busy.');
    return;
  }
  if (meta.fiestaRestore) {
    ctx.error(meta.entityId, "You can't do that during a Fiesta bout.");
    return;
  }
  if (ctx.isSwimming(p)) {
    ctx.error(meta.entityId, "You can't do that while swimming.");
    return;
  }
  // Classic: mounting up breaks stealth rather than hiding a rider.
  ctx.breakStealth(p);
  p.mountId = mountId;
}

/** Dismiss the active mount, if any. */
export function dismountCommand(ctx: SimContext, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r) return;
  dismountPlayer(r.e);
}

/** The auto-dismount rule: riding ends the moment the rider takes damage,
 *  enters combat, starts a cast, or submerges. Call sites pass any entity;
 *  non-riders no-op. */
export function dismountPlayer(e: Entity): void {
  if (e.mountId !== null) e.mountId = null;
}
