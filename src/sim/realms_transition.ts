// Realm portal transitions: enter a portal-reached dimension, or return to the
// overworld. Mirrors the dungeon enter/leave pattern (instances/dungeons.ts) but
// simpler: realms are shared open-world (no per-party slot/instance claim), so a
// transition is just a coordinate teleport to the realm hub (enter) or back to the
// realm's overworld entry gate (leave), plus a rebucket. Pure sim, behind the
// SimContext seam; Sim keeps thin same-named delegates. See docs/design/realms.md.

import { REALMS, realmAt } from './data';
import type { PlayerMeta } from './sim';
import type { SimContext } from './sim_context';
import type { Entity, RealmDef } from './types';

// The realm-gate feedback. A known-English backstop (this module is not scanned by
// the S3 sim-text guard, and localizing it would need a 21-language inline dict for
// a rare edge toast); the intro NPC and quest that TEACH the gate are fully
// localized. If a second realm ever needs its own gate copy, promote this to a
// sim_i18n rule. Kept generic (no realm name / number) so one line serves any realm.
const REALM_GATE_LOCKED = 'The gate senses you are not yet ready to cross it.';

// Whether the player meets a realm's unlock requirements (level + a prerequisite
// quest completed). Returns true when there is no gate or every condition is met.
function meetsRealmUnlock(realm: RealmDef, e: Entity, meta: PlayerMeta): boolean {
  const u = realm.unlock;
  if (!u) return true;
  if (u.minLevel !== undefined && e.level < u.minLevel) return false;
  if (u.requiresQuest && meta.questLog.get(u.requiresQuest)?.state !== 'done') return false;
  return true;
}

// Teleport the player into a realm's hub. No-op if the realm id is unknown (a
// valid realm_portal always names a registered realm) or the player is dead.
// Enforces the realm's unlock gate (RealmDef.unlock): the single sink both the
// offline portal interact (interaction.ts) and the online enter_realm dispatch
// (server/game.ts) reach, so the gate holds everywhere.
export function enterRealm(ctx: SimContext, realmId: string, pid?: number): void {
  const r = ctx.resolve(pid);
  if (!r || r.e.dead) return;
  const realm = REALMS.find((rm) => rm.id === realmId);
  if (!realm) return;
  const p = r.e;
  if (!meetsRealmUnlock(realm, p, r.meta)) {
    ctx.error(r.meta.entityId, REALM_GATE_LOCKED);
    return;
  }
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
