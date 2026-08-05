// Quest-credit math (session Q1), MOVED verbatim out of the Sim monolith behind the
// SimContext seam. These three pure updaters grant kill / collect / turn-in credit by
// mutating the live PlayerMeta.questLog in place (the immutability waiver applies: qp
// and meta are shared references the engine mutates). They draw NO rng. The interaction
// dispatcher (interact/talkToNpc/pickUpObject/lootCorpse) stays on Sim and reaches these
// through the seam; the foreign callers (handleDeath, the addItem/removeItem/buyBackItem
// inventory hub, finalizeQuestAccept, interactNpcForQuests, and the N1 crypt
// interactObjectForQuests) invoke them via ctx.onMobKilledForQuests /
// ctx.onInventoryChangedForQuests / ctx.checkQuestReady.
//
// src/sim-pure: imports only sibling sim types + the QUESTS data table (no render/ui/
// game/net/DOM/Three, no Math.random/Date.now), so it runs unchanged in Node, the
// browser, and the headless RL env.

import { MOBS, QUESTS } from '../data';
import { createMob } from '../entity';
import { meetsTier } from '../reputation';
import type { PlayerMeta } from '../sim';
import type { SimContext } from '../sim_context';
import type { Entity, QuestObjective, QuestProgress } from '../types';

// How close a `reach` objective credits at when its record does not say. Generous
// enough that walking the road past a landmark counts, tight enough that it does not
// fire from the next POI over.
const DEFAULT_REACH_RADIUS = 12;
// Escort tuning. The escortee trails the player at FOLLOW yards and is yanked forward if
// it somehow falls TELEPORT yards behind (terrain snags), matching how the delve
// companion keeps up. Arrival uses the reach radius unless the objective overrides it.
const ESCORT_FOLLOW = 4;
const ESCORT_TELEPORT_DISTANCE = 60;

export function onMobKilledForQuests(ctx: SimContext, mob: Entity, meta: PlayerMeta): void {
  for (const qp of meta.questLog.values()) {
    if (qp.state !== 'active') continue;
    const quest = QUESTS[qp.questId];
    let changed = false;
    quest.objectives.forEach((obj, i) => {
      if (obj.type === 'kill' && obj.targetMobId === mob.templateId && qp.counts[i] < obj.count) {
        qp.counts[i]++;
        changed = true;
        meta.counters.questProgress++;
        ctx.emit({
          type: 'questProgress',
          questId: qp.questId,
          text: `${obj.label}: ${qp.counts[i]}/${obj.count}`,
          pid: meta.entityId,
        });
      }
    });
    if (changed) checkQuestReady(ctx, qp, meta);
  }
}

export function onInventoryChangedForQuests(ctx: SimContext, meta: PlayerMeta): void {
  // Inventory mutated (add/remove/sell/buyback all route through here): flag
  // the player's wire state dirty so hosts re-send bags + derived quest state.
  meta.wireRev++;
  for (const qp of meta.questLog.values()) {
    const quest = QUESTS[qp.questId];
    let changed = false;
    quest.objectives.forEach((obj, i) => {
      if (obj.type === 'collect' && obj.itemId) {
        const have = Math.min(obj.count, ctx.countItem(obj.itemId, meta.entityId));
        if (have !== qp.counts[i]) {
          if (have > qp.counts[i]) meta.counters.questProgress += have - qp.counts[i];
          qp.counts[i] = have;
          changed = true;
          ctx.emit({
            type: 'questProgress',
            questId: qp.questId,
            text: `${obj.label}: ${have}/${obj.count}`,
            pid: meta.entityId,
          });
        }
      }
    });
    if (changed) checkQuestReady(ctx, qp, meta);
  }
}

// ---------------------------------------------------------------------------
// Phase D: the extended objective types. Each grants credit the same way the
// original three do (bump qp.counts[i], emit questProgress, re-check ready), so
// they render through the existing generic label/current/total tracker with no
// UI or IWorld change. None of them draws rng.
// ---------------------------------------------------------------------------

/** Bump one objective's count, emit the progress line, and report whether it moved. */
function creditObjective(
  ctx: SimContext,
  qp: QuestProgress,
  meta: PlayerMeta,
  obj: QuestObjective,
  i: number,
  to = qp.counts[i] + 1,
): boolean {
  const next = Math.min(obj.count, to);
  if (next <= qp.counts[i]) return false;
  meta.counters.questProgress += next - qp.counts[i];
  qp.counts[i] = next;
  ctx.emit({
    type: 'questProgress',
    questId: qp.questId,
    text: `${obj.label}: ${next}/${obj.count}`,
    pid: meta.entityId,
  });
  return true;
}

// Talking to an NPC credits both `interact` (just be there) and `deliver` (be there
// holding the payload, which is consumed). Deliver takes as many as the objective still
// needs and no more, so a partial hand-off is possible and never over-consumes.
export function onNpcInteractedForQuests(
  ctx: SimContext,
  npcTemplateId: string,
  meta: PlayerMeta,
): boolean {
  let progressed = false;
  for (const qp of meta.questLog.values()) {
    if (qp.state !== 'active') continue;
    const quest = QUESTS[qp.questId];
    let changed = false;
    quest.objectives.forEach((obj, i) => {
      if (obj.targetNpcId !== npcTemplateId) return;
      if (qp.counts[i] >= obj.count) return;
      if (obj.type === 'interact') {
        changed = creditObjective(ctx, qp, meta, obj, i) || changed;
      } else if (obj.type === 'deliver' && obj.itemId) {
        const wanted = obj.count - qp.counts[i];
        const handed = Math.min(wanted, ctx.countItem(obj.itemId, meta.entityId));
        if (handed <= 0) return;
        ctx.removeItem(obj.itemId, handed, meta.entityId);
        changed = creditObjective(ctx, qp, meta, obj, i, qp.counts[i] + handed) || changed;
      }
    });
    if (changed) {
      progressed = true;
      checkQuestReady(ctx, qp, meta);
    }
  }
  return progressed;
}

// `reach` objectives are credited by standing near a spot, so they need a poll rather
// than an event. Scanning every active objective every tick for every player would be
// pure waste at 20 Hz, so the coordinator calls this on a fixed throttle; the cadence is
// deterministic (derived from tickCount), and the check itself is plain distance math.
export function onReachCheckForQuests(ctx: SimContext, meta: PlayerMeta): void {
  const r = ctx.resolve(meta.entityId);
  if (!r) return;
  const { x, z } = r.e.pos;
  for (const qp of meta.questLog.values()) {
    if (qp.state !== 'active') continue;
    const quest = QUESTS[qp.questId];
    let changed = false;
    quest.objectives.forEach((obj, i) => {
      if (obj.type !== 'reach' || !obj.reachPos) return;
      if (qp.counts[i] >= obj.count) return;
      const radius = obj.reachRadius ?? DEFAULT_REACH_RADIUS;
      const dx = x - obj.reachPos.x;
      const dz = z - obj.reachPos.z;
      if (dx * dx + dz * dz > radius * radius) return;
      changed = creditObjective(ctx, qp, meta, obj, i, obj.count) || changed;
    });
    if (changed) checkQuestReady(ctx, qp, meta);
  }
}

// Standing gates are level-like: once the tier is reached the objective is fully done,
// and it never un-credits if standing later drops.
export function onReputationChangedForQuests(ctx: SimContext, meta: PlayerMeta): void {
  for (const qp of meta.questLog.values()) {
    if (qp.state !== 'active') continue;
    const quest = QUESTS[qp.questId];
    let changed = false;
    quest.objectives.forEach((obj, i) => {
      if (obj.type !== 'reputation' || !obj.requiredRep) return;
      if (qp.counts[i] >= obj.count) return;
      const { factionId, tier } = obj.requiredRep;
      if (!meetsTier(meta.reputation, factionId, tier)) return;
      changed = creditObjective(ctx, qp, meta, obj, i, obj.count) || changed;
    });
    if (changed) checkQuestReady(ctx, qp, meta);
  }
}

// Timed quests fail rather than complete: on expiry the quest leaves the log and is NOT
// recorded as done, so it can be picked up and attempted again. Driven on the same
// throttled cadence as the reach poll (deadlines need no finer granularity than that),
// and it reads only the sim clock, so it draws no rng.
export function onQuestDeadlinesForQuests(ctx: SimContext, meta: PlayerMeta): void {
  let expired: string[] | null = null;
  for (const qp of meta.questLog.values()) {
    if (qp.state === 'done' || qp.expiresAt === undefined) continue;
    if (ctx.time < qp.expiresAt) continue;
    if (!expired) expired = [];
    expired.push(qp.questId);
  }
  if (!expired) return;
  for (const questId of expired) failQuest(ctx, questId, meta);
}

// Spawn the escortee for any escort objective on a freshly accepted quest. Called from
// finalizeQuestAccept, so it happens on a player action rather than world-gen: the golden
// traces never accept these quests, so the extra entity id never shifts their draw order.
export function spawnEscortsForQuest(ctx: SimContext, questId: string, meta: PlayerMeta): void {
  const qp = meta.questLog.get(questId);
  const quest = QUESTS[questId];
  if (!qp || !quest) return;
  const objective = quest.objectives.find((o) => o.type === 'escort' && o.escortMobId);
  if (!objective?.escortMobId) return;
  const owner = ctx.entities.get(meta.entityId);
  const template = MOBS[objective.escortMobId];
  if (!owner || !template) return;
  const mob = createMob(
    ctx.nextId++,
    template,
    owner.level,
    ctx.groundPos(owner.pos.x + 1.5, owner.pos.z),
  );
  mob.ownerId = meta.entityId;
  mob.hostile = false;
  mob.aiState = 'idle';
  ctx.addEntity(mob);
  qp.escortEntityId = mob.id;
}

/** True for a mob that is somebody's in-flight escortee (the mob-AI dispatch predicate). */
export function isEscortMob(ctx: SimContext, mob: Entity): boolean {
  if (mob.ownerId === null) return false;
  const meta = ctx.players.get(mob.ownerId);
  if (!meta) return false;
  for (const qp of meta.questLog.values()) if (qp.escortEntityId === mob.id) return true;
  return false;
}

/** Per-tick escortee brain: trail the owner. Arrival and death are handled by the poll. */
export function updateEscortMob(ctx: SimContext, mob: Entity): void {
  const owner = mob.ownerId !== null ? ctx.entities.get(mob.ownerId) : null;
  if (!owner || owner.dead) return;
  const dx = owner.pos.x - mob.pos.x;
  const dz = owner.pos.z - mob.pos.z;
  const d = Math.hypot(dx, dz);
  if (d > ESCORT_TELEPORT_DISTANCE) {
    mob.pos = ctx.groundPos(owner.pos.x + 1.5, owner.pos.z);
    return;
  }
  if (d > ESCORT_FOLLOW) ctx.moveToward(mob, owner.pos, mob.moveSpeed);
}

// Escort resolution, run on the same throttled cadence as the reach poll: credit on
// arrival, fail on death or on a missing escortee (the relog case).
export function onEscortTickForQuests(ctx: SimContext, meta: PlayerMeta): void {
  let failed: string[] | null = null;
  for (const qp of meta.questLog.values()) {
    if (qp.state === 'done' || qp.escortEntityId === undefined) continue;
    const quest = QUESTS[qp.questId];
    const i = quest.objectives.findIndex((o) => o.type === 'escort');
    if (i < 0) continue;
    const objective = quest.objectives[i];
    const escortee = ctx.entities.get(qp.escortEntityId);
    if (!escortee || escortee.dead) {
      qp.escortEntityId = undefined;
      if (!failed) failed = [];
      failed.push(qp.questId);
      continue;
    }
    if (qp.counts[i] >= objective.count || !objective.escortTo) continue;
    const radius = objective.escortRadius ?? DEFAULT_REACH_RADIUS;
    const dx = escortee.pos.x - objective.escortTo.x;
    const dz = escortee.pos.z - objective.escortTo.z;
    if (dx * dx + dz * dz > radius * radius) continue;
    // Delivered: credit, then retire the escortee so it stops trailing the player.
    creditObjective(ctx, qp, meta, objective, i, objective.count);
    ctx.dropEntity(escortee.id);
    qp.escortEntityId = undefined;
    checkQuestReady(ctx, qp, meta);
  }
  if (failed) for (const questId of failed) failQuest(ctx, questId, meta);
}

/** Drop a quest from the log and announce it. Shared by the deadline and escort paths. */
function failQuest(ctx: SimContext, questId: string, meta: PlayerMeta): void {
  const qp = meta.questLog.get(questId);
  if (qp?.escortEntityId !== undefined && ctx.entities.has(qp.escortEntityId)) {
    ctx.dropEntity(qp.escortEntityId);
  }
  meta.questLog.delete(questId);
  ctx.emit({
    type: 'log',
    text: `Quest failed: ${QUESTS[questId].name}`,
    color: '#f66',
    pid: meta.entityId,
  });
}

export function checkQuestReady(ctx: SimContext, qp: QuestProgress, meta: PlayerMeta): void {
  const quest = QUESTS[qp.questId];
  const ready = quest.objectives.every((obj, i) => qp.counts[i] >= obj.count);
  if (ready && qp.state === 'active') {
    qp.state = 'ready';
    ctx.emit({ type: 'questReady', questId: qp.questId, pid: meta.entityId });
    ctx.emit({
      type: 'log',
      text: `${quest.name} (Complete)`,
      color: '#ff0',
      pid: meta.entityId,
    });
  } else if (!ready && qp.state === 'ready') {
    qp.state = 'active';
  }
}
