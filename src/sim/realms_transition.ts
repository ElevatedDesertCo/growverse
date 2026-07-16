// Realm portal transitions: enter a portal-reached dimension, or return to the
// overworld. Mirrors the dungeon enter/leave pattern (instances/dungeons.ts) but
// simpler: realms are shared open-world (no per-party slot/instance claim), so a
// transition is just a coordinate teleport to the realm hub (enter) or back to the
// realm's overworld entry gate (leave), plus a rebucket. Pure sim, behind the
// SimContext seam; Sim keeps thin same-named delegates. See docs/design/realms.md.

import { REALMS, realmAt } from './data';
import type { SimContext } from './sim_context';

// Teleport the player into a realm's hub. No-op if the realm id is unknown (a
// valid realm_portal always names a registered realm) or the player is dead.
export function enterRealm(ctx: SimContext, realmId: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r || r.e.dead) return;
  const realm = REALMS.find((rm) => rm.id === realmId);
  if (!realm) return;
  const p = r.e;
  p.pos = ctx.groundPos(realm.hubPos.x, realm.hubPos.z);
  p.prevPos = { ...p.pos };
  ctx.rebucket(p);
  p.targetId = null;
  p.autoAttack = false;
}

// Return the player to the overworld gate of whatever realm they are currently
// standing in. No-op if they are not inside a realm band.
export function leaveRealm(ctx: SimContext, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r || r.e.dead) return;
  const p = r.e;
  const realm = realmAt(p.pos.x, p.pos.z);
  if (!realm) return;
  p.pos = ctx.groundPos(realm.entryPortalPos.x, realm.entryPortalPos.z);
  p.prevPos = { ...p.pos };
  ctx.rebucket(p);
  p.targetId = null;
  p.autoAttack = false;
}
