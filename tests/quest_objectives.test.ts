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
  onNpcInteractedForQuests,
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

const TEMP: QuestDef[] = [
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
