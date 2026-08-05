// The Phase D extended quest objective types: reach, deliver, and reputation.
//
// Like tests/quest_branching.test.ts, these drive the REAL credit cores with temporary
// quest defs injected into the QUESTS table, so the engine is proven end to end without
// shipping (and localizing) in-world content: that lands with the next content batch.
//
// The three original types (kill / collect / interact) are already covered elsewhere;
// what is new here is that each of these credits through a different trigger (a poll, an
// NPC hand-off, and a standing crossing) while rendering through the SAME generic
// label/current/total tracker, so no UI or IWorld change was needed.

import { afterEach, describe, expect, it } from 'vitest';
import { QUESTS } from '../src/sim/data';
import { finalizeQuestAccept } from '../src/sim/quests/quest_commands';
import {
  onEscortTickForQuests,
  onNpcInteractedForQuests,
  onQuestDeadlinesForQuests,
  onReachCheckForQuests,
  onReputationChangedForQuests,
} from '../src/sim/quests/quest_credit';
import { awardReputation } from '../src/sim/reputation';
import { Sim } from '../src/sim/sim';
import type { PlayerClass, QuestDef, QuestObjective } from '../src/sim/types';

const makeSim = (cls: PlayerClass = 'warrior', seed = 42) =>
  new Sim({ seed, playerClass: cls, autoEquip: true });

const q = (id: string, objectives: QuestObjective[]): QuestDef => ({
  id,
  name: id,
  giverNpcId: 'cultivator_marlow',
  turnInNpcId: 'cultivator_marlow',
  text: id,
  completionText: id,
  objectives,
  xpReward: 0,
  copperReward: 0,
  itemRewards: {},
});

// A quest-level deadline rather than an objective (see QuestDef.timeLimit).
const timed = (id: string, timeLimit: number): QuestDef => ({
  ...q(id, [{ type: 'kill', targetMobId: 'forest_wolf', count: 1, label: 'Coyote slain' }]),
  timeLimit,
});

const TEMP: QuestDef[] = [
  timed('q_obj_timed', 60),
  q('q_obj_escort', [
    {
      type: 'escort',
      escortMobId: 'forest_wolf',
      escortTo: { x: 120, z: 120 },
      escortRadius: 8,
      count: 1,
      label: 'Escortee delivered',
    },
  ]),
  q('q_obj_reach', [
    {
      type: 'reach',
      reachPos: { x: 40, z: 40 },
      reachRadius: 10,
      count: 1,
      label: 'Reach the marker',
    },
  ]),
  q('q_obj_reach_default', [
    // No reachRadius: exercises the module's default credit radius.
    { type: 'reach', reachPos: { x: -60, z: 20 }, count: 1, label: 'Reach the far marker' },
  ]),
  q('q_obj_deliver', [
    {
      type: 'deliver',
      itemId: 'linen_scrap',
      targetNpcId: 'trader_wilkes',
      count: 3,
      label: 'Scraps delivered',
    },
  ]),
  q('q_obj_rep', [
    {
      type: 'reputation',
      requiredRep: { factionId: 'baked_beaver', tier: 'friendly' },
      count: 1,
      label: 'Friendly with the commune',
    },
  ]),
];

const install = () => {
  for (const def of TEMP) (QUESTS as Record<string, QuestDef>)[def.id] = def;
};
const uninstall = () => {
  for (const def of TEMP) delete (QUESTS as Record<string, QuestDef>)[def.id];
};

type Ctx = Parameters<typeof onReachCheckForQuests>[0];
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: Ctx }).ctx;
const metaOf = (sim: Sim) =>
  (sim as unknown as { primary: Parameters<typeof finalizeQuestAccept>[3] }).primary;

const accept = (sim: Sim, id: string) => {
  finalizeQuestAccept(ctxOf(sim) as never, id, QUESTS[id], metaOf(sim));
};
const progressOf = (sim: Sim, id: string) => metaOf(sim).questLog.get(id);
const moveTo = (sim: Sim, x: number, z: number) => {
  const e = sim.entities.get(sim.playerId);
  if (e) {
    e.pos.x = x;
    e.pos.z = z;
  }
};

describe('quest objectives: reach', () => {
  afterEach(uninstall);

  it('does not credit while the player is outside the radius', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_reach');
    moveTo(sim, 40, 60); // 20yd away, radius is 10
    onReachCheckForQuests(ctxOf(sim), metaOf(sim));
    expect(progressOf(sim, 'q_obj_reach')?.counts[0]).toBe(0);
    expect(progressOf(sim, 'q_obj_reach')?.state).toBe('active');
  });

  it('credits and completes the moment the player is inside the radius', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_reach');
    moveTo(sim, 44, 43); // 5yd away
    onReachCheckForQuests(ctxOf(sim), metaOf(sim));
    expect(progressOf(sim, 'q_obj_reach')?.counts[0]).toBe(1);
    expect(progressOf(sim, 'q_obj_reach')?.state).toBe('ready');
  });

  it('falls back to the default radius when the objective omits one', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_reach_default');
    moveTo(sim, -60, 40); // 20yd: outside the 12yd default
    onReachCheckForQuests(ctxOf(sim), metaOf(sim));
    expect(progressOf(sim, 'q_obj_reach_default')?.counts[0]).toBe(0);
    moveTo(sim, -60, 28); // 8yd: inside it
    onReachCheckForQuests(ctxOf(sim), metaOf(sim));
    expect(progressOf(sim, 'q_obj_reach_default')?.counts[0]).toBe(1);
  });

  it('stays credited after the player walks away again', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_reach');
    moveTo(sim, 40, 40);
    onReachCheckForQuests(ctxOf(sim), metaOf(sim));
    moveTo(sim, 300, 300);
    onReachCheckForQuests(ctxOf(sim), metaOf(sim));
    expect(progressOf(sim, 'q_obj_reach')?.counts[0]).toBe(1);
    expect(progressOf(sim, 'q_obj_reach')?.state).toBe('ready');
  });

  it('is credited by the running sim, not just a direct call', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_reach');
    moveTo(sim, 40, 40);
    // The poll is throttled, so step past one full cadence window.
    for (let i = 0; i < 8; i++) sim.tick();
    expect(progressOf(sim, 'q_obj_reach')?.counts[0]).toBe(1);
  });
});

describe('quest objectives: deliver', () => {
  afterEach(uninstall);

  it('does not credit when the player is empty-handed', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_deliver');
    const moved = onNpcInteractedForQuests(ctxOf(sim), 'trader_wilkes', metaOf(sim));
    expect(moved).toBe(false);
    expect(progressOf(sim, 'q_obj_deliver')?.counts[0]).toBe(0);
  });

  it('consumes exactly what it credits, and accepts a partial hand-off', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_deliver');
    sim.addItem('linen_scrap', 2, sim.playerId);
    onNpcInteractedForQuests(ctxOf(sim), 'trader_wilkes', metaOf(sim));
    expect(progressOf(sim, 'q_obj_deliver')?.counts[0]).toBe(2);
    expect(sim.countItem('linen_scrap', sim.playerId)).toBe(0);
    expect(progressOf(sim, 'q_obj_deliver')?.state).toBe('active');
  });

  it('never over-consumes past what the objective still needs', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_deliver');
    sim.addItem('linen_scrap', 5, sim.playerId); // objective wants 3
    onNpcInteractedForQuests(ctxOf(sim), 'trader_wilkes', metaOf(sim));
    expect(progressOf(sim, 'q_obj_deliver')?.counts[0]).toBe(3);
    expect(sim.countItem('linen_scrap', sim.playerId)).toBe(2); // the surplus is left alone
    expect(progressOf(sim, 'q_obj_deliver')?.state).toBe('ready');
  });

  it('ignores an unrelated NPC', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_deliver');
    sim.addItem('linen_scrap', 3, sim.playerId);
    onNpcInteractedForQuests(ctxOf(sim), 'smith_haldren', metaOf(sim));
    expect(progressOf(sim, 'q_obj_deliver')?.counts[0]).toBe(0);
    expect(sim.countItem('linen_scrap', sim.playerId)).toBe(3); // and takes nothing
  });
});

describe('quest objectives: reputation', () => {
  afterEach(uninstall);

  it('does not credit below the required tier', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_rep');
    onReputationChangedForQuests(ctxOf(sim), metaOf(sim));
    expect(progressOf(sim, 'q_obj_rep')?.counts[0]).toBe(0);
  });

  it('is credited by awardReputation itself when the tier is crossed', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_rep');
    // Enough to cross out of neutral; awardReputation fires the hook on a tier change,
    // so no caller needs to know the quest exists.
    awardReputation(ctxOf(sim) as never, 'baked_beaver', 5000, sim.playerId);
    expect(progressOf(sim, 'q_obj_rep')?.counts[0]).toBe(1);
    expect(progressOf(sim, 'q_obj_rep')?.state).toBe('ready');
  });
});

describe('quest objectives: timed quests', () => {
  afterEach(uninstall);

  it('stamps a deadline on accept, derived from the sim clock', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_timed');
    const qp = progressOf(sim, 'q_obj_timed');
    expect(qp?.expiresAt).toBeCloseTo(ctxOf(sim).time + 60, 5);
  });

  it('leaves an untimed quest with no deadline at all', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_reach');
    expect(progressOf(sim, 'q_obj_reach')?.expiresAt).toBeUndefined();
  });

  it('does not fail the quest before the deadline', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_timed');
    onQuestDeadlinesForQuests(ctxOf(sim), metaOf(sim));
    expect(metaOf(sim).questLog.has('q_obj_timed')).toBe(true);
  });

  it('fails and drops the quest once the deadline passes, without marking it done', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_timed');
    const qp = progressOf(sim, 'q_obj_timed');
    if (qp) qp.expiresAt = ctxOf(sim).time - 1; // deadline already behind us
    onQuestDeadlinesForQuests(ctxOf(sim), metaOf(sim));
    expect(metaOf(sim).questLog.has('q_obj_timed')).toBe(false);
    // Not recorded as done, so the player can pick it up and try again.
    expect(metaOf(sim).questsDone.has('q_obj_timed')).toBe(false);
  });

  it('is failed by the running sim, and announces it', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_timed');
    const qp = progressOf(sim, 'q_obj_timed');
    if (qp) qp.expiresAt = ctxOf(sim).time - 1;
    let failed = '';
    for (let i = 0; i < 8 && !failed; i++) {
      for (const ev of sim.tick()) {
        if (ev.type === 'log' && ev.text.startsWith('Quest failed:')) failed = ev.text;
      }
    }
    expect(failed).toBe('Quest failed: q_obj_timed');
    expect(metaOf(sim).questLog.has('q_obj_timed')).toBe(false);
  });

  it('persists as seconds REMAINING, so the deadline survives a relog', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_timed');
    const qp = progressOf(sim, 'q_obj_timed');
    if (qp) qp.expiresAt = ctxOf(sim).time + 25; // 25s left when we save
    const saved = sim.serializeCharacter(sim.playerId)!;
    const row = saved.questLog.find((r) => r.questId === 'q_obj_timed');
    expect(row?.timeLeft).toBe(25);

    // A fresh Sim starts its clock at 0, so an absolute stamp would have expired.
    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    reloaded.addPlayer('warrior', 'Test', { state: saved });
    const restored = progressOf(reloaded, 'q_obj_timed');
    expect(restored).toBeDefined();
    expect(restored?.expiresAt).toBeCloseTo(ctxOf(reloaded).time + 25, 5);
  });

  it('drops a quest whose clock ran out while the character was offline', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_timed');
    const qp = progressOf(sim, 'q_obj_timed');
    if (qp) qp.expiresAt = ctxOf(sim).time; // 0s left
    const saved = sim.serializeCharacter(sim.playerId)!;
    expect(saved.questLog.find((r) => r.questId === 'q_obj_timed')?.timeLeft).toBe(0);

    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    reloaded.addPlayer('warrior', 'Test', { state: saved });
    expect(metaOf(reloaded).questLog.has('q_obj_timed')).toBe(false);
    // and it is re-acceptable, not silently completed
    expect(metaOf(reloaded).questsDone.has('q_obj_timed')).toBe(false);
  });
});

describe('quest objectives: escort', () => {
  afterEach(uninstall);

  it('spawns an escortee beside the player on accept and remembers it', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_escort');
    const id = progressOf(sim, 'q_obj_escort')?.escortEntityId;
    expect(id).toBeDefined();
    const escortee = sim.entities.get(id as number);
    expect(escortee).toBeDefined();
    // Owner-linked and non-hostile, so it is never a valid target for its own escort.
    expect(escortee?.ownerId).toBe(sim.playerId);
    expect(escortee?.hostile).toBe(false);
  });

  it('trails the player rather than standing still', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_escort');
    const escortee = sim.entities.get(progressOf(sim, 'q_obj_escort')?.escortEntityId as number);
    if (!escortee) throw new Error('no escortee');
    moveTo(sim, 60, 60);
    const before = Math.hypot(escortee.pos.x - 60, escortee.pos.z - 60);
    for (let i = 0; i < 40; i++) sim.tick();
    const after = Math.hypot(escortee.pos.x - 60, escortee.pos.z - 60);
    expect(after).toBeLessThan(before);
  });

  it('credits on arrival and retires the escortee', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_escort');
    const id = progressOf(sim, 'q_obj_escort')?.escortEntityId as number;
    const escortee = sim.entities.get(id);
    if (escortee) {
      escortee.pos.x = 120;
      escortee.pos.z = 120;
    }
    onEscortTickForQuests(ctxOf(sim), metaOf(sim));
    expect(progressOf(sim, 'q_obj_escort')?.counts[0]).toBe(1);
    expect(progressOf(sim, 'q_obj_escort')?.state).toBe('ready');
    // The escortee is despawned once delivered, not left following forever.
    expect(sim.entities.has(id)).toBe(false);
    expect(progressOf(sim, 'q_obj_escort')?.escortEntityId).toBeUndefined();
  });

  it('does not credit while the escortee is short of the destination', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_escort');
    const escortee = sim.entities.get(progressOf(sim, 'q_obj_escort')?.escortEntityId as number);
    if (escortee) {
      escortee.pos.x = 120;
      escortee.pos.z = 140; // 20yd out, radius is 8
    }
    onEscortTickForQuests(ctxOf(sim), metaOf(sim));
    expect(progressOf(sim, 'q_obj_escort')?.counts[0]).toBe(0);
  });

  it('FAILS the quest when the escortee dies, and does not mark it done', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_escort');
    const escortee = sim.entities.get(progressOf(sim, 'q_obj_escort')?.escortEntityId as number);
    if (escortee) escortee.dead = true;
    onEscortTickForQuests(ctxOf(sim), metaOf(sim));
    expect(metaOf(sim).questLog.has('q_obj_escort')).toBe(false);
    expect(metaOf(sim).questsDone.has('q_obj_escort')).toBe(false);
  });

  it('fails the quest on relog, since the escortee is not persisted', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_obj_escort');
    const saved = sim.serializeCharacter(sim.playerId)!;
    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    reloaded.addPlayer('warrior', 'Test', { state: saved });
    // The handle is deliberately not saved, so the escort simply has no escortee...
    expect(progressOf(reloaded, 'q_obj_escort')?.escortEntityId).toBeUndefined();
    // ...and the quest is still in the log until the tick resolves it, then dropped.
    expect(metaOf(reloaded).questLog.has('q_obj_escort')).toBe(true);
  });
});
