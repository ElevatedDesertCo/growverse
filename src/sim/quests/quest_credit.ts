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

import { QUESTS } from '../data';
import { meetsTier } from '../reputation';
import type { PlayerMeta } from '../sim';
import type { SimContext } from '../sim_context';
import type { Entity, QuestObjective, QuestProgress } from '../types';

// How close a `reach` objective credits at when its record does not say. Generous
// enough that walking the road past a landmark counts, tight enough that it does not
// fire from the next POI over.
const DEFAULT_REACH_RADIUS = 12;

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
