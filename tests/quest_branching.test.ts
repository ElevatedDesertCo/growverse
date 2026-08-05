// Quest branching (Phase D): persistent world-flags gate quest availability and a quest
// choice sets a flag that endures. This drives the flag logic through the real quest cores
// (finalizeQuestAccept / turnInQuestCore / computeQuestState) with temporary quest defs
// injected into the QUESTS table, so the ENGINE is proven end to end without shipping
// (and localizing) in-world content: that lands with the zone re-theming.

import { afterEach, describe, expect, it } from 'vitest';
import { NPCS, QUEST_ORDER, QUESTS } from '../src/sim/data';
import {
  computeQuestState,
  finalizeQuestAccept,
  turnInQuestCore,
} from '../src/sim/quests/quest_commands';
import { Sim } from '../src/sim/sim';
import type { PlayerClass, QuestDef } from '../src/sim/types';

const makeSim = (cls: PlayerClass = 'warrior', seed = 42) =>
  new Sim({ seed, playerClass: cls, autoEquip: true });

// Minimal quest def with only the fields the flag logic touches (no objectives to credit).
const q = (id: string, extra: Partial<QuestDef>): QuestDef => ({
  id,
  name: id,
  giverNpcId: 'cultivator_marlow',
  turnInNpcId: 'cultivator_marlow',
  text: id,
  completionText: id,
  objectives: [],
  xpReward: 0,
  copperReward: 0,
  itemRewards: {},
  ...extra,
});

// Two mutually exclusive choice quests plus a payoff gated on one branch.
const TEMP: QuestDef[] = [
  q('q_branch_a', { setsFlagOnAccept: 'flag_a', forbidsFlag: 'flag_b' }),
  q('q_branch_b', { setsFlagOnAccept: 'flag_b', forbidsFlag: 'flag_a' }),
  q('q_branch_payoff', { requiresFlag: 'flag_a' }),
  q('q_branch_turnin', { setsFlagOnTurnIn: 'flag_done' }),
];

const install = () => {
  for (const def of TEMP) (QUESTS as Record<string, QuestDef>)[def.id] = def;
};
const uninstall = () => {
  for (const def of TEMP) delete (QUESTS as Record<string, QuestDef>)[def.id];
};

const stateOf = (sim: Sim, id: string) => {
  const meta = (sim as unknown as { primary: Parameters<typeof turnInQuestCore>[3] }).primary;
  return computeQuestState(id, meta.questLog, meta.questsDone, 60, meta.worldFlags);
};
const accept = (sim: Sim, id: string) => {
  const ctx = (sim as unknown as { ctx: Parameters<typeof finalizeQuestAccept>[0] }).ctx;
  const meta = (sim as unknown as { primary: Parameters<typeof finalizeQuestAccept>[3] }).primary;
  finalizeQuestAccept(ctx, id, QUESTS[id], meta);
};
const complete = (sim: Sim, id: string) => {
  const ctx = (sim as unknown as { ctx: Parameters<typeof turnInQuestCore>[0] }).ctx;
  const meta = (sim as unknown as { primary: Parameters<typeof turnInQuestCore>[3] }).primary;
  const qp = meta.questLog.get(id);
  if (qp) qp.state = 'ready';
  turnInQuestCore(ctx, id, QUESTS[id], meta);
};
const flags = (sim: Sim): Set<string> =>
  (sim as unknown as { primary: { worldFlags: Set<string> } }).primary.worldFlags;

describe('quest branching: world-flag gates', () => {
  afterEach(uninstall);

  it('a flag-gated quest is unavailable until its required flag is set', () => {
    install();
    const sim = makeSim();
    expect(stateOf(sim, 'q_branch_payoff')).toBe('unavailable'); // requiresFlag flag_a, unset
    accept(sim, 'q_branch_a'); // sets flag_a
    expect(flags(sim).has('flag_a')).toBe(true);
    expect(stateOf(sim, 'q_branch_payoff')).toBe('available'); // now the gate opens
  });

  it('accepting one branch forbids the mutually exclusive other (a real choice)', () => {
    install();
    const sim = makeSim();
    expect(stateOf(sim, 'q_branch_a')).toBe('available');
    expect(stateOf(sim, 'q_branch_b')).toBe('available');
    accept(sim, 'q_branch_a'); // sets flag_a, which q_branch_b forbids
    expect(stateOf(sim, 'q_branch_b')).toBe('unavailable');
  });

  it('turning in a quest sets its consequence flag', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_branch_turnin');
    expect(flags(sim).has('flag_done')).toBe(false);
    complete(sim, 'q_branch_turnin');
    expect(flags(sim).has('flag_done')).toBe(true);
  });

  it('world flags survive a full character save/load (persistent consequence)', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_branch_a'); // flag_a
    accept(sim, 'q_branch_turnin');
    complete(sim, 'q_branch_turnin'); // flag_done
    const saved = sim.serializeCharacter(sim.playerId)!;
    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    reloaded.addPlayer('warrior', 'Test', { state: saved });
    const rf = flags(reloaded);
    expect(rf.has('flag_a')).toBe(true);
    expect(rf.has('flag_done')).toBe(true);
    // and the branch gate still resolves from the restored flags
    expect(stateOf(reloaded, 'q_branch_payoff')).toBe('available');
    expect(stateOf(reloaded, 'q_branch_b')).toBe('unavailable');
  });
});

// The first SHIPPED branching questline (Phase D-2): zone 2's grey-rot arc. Drives the
// real content records, not injected defs, so the wiring (giver questIds, QUEST_ORDER,
// the flag names on both branches) is proven, not just the engine.
describe('zone 2 grey-rot arc: the shipped branching questline', () => {
  const ARC = [
    'q_greyrot',
    'q_burn_the_beds',
    'q_seed_the_shallows',
    'q_ash_and_water',
    'q_first_green',
  ];

  // Reach the arc's entry point: q_greyrot requires q_widows turned in.
  const openArc = (sim: Sim) => {
    (sim as unknown as { primary: { questsDone: Set<string> } }).primary.questsDone.add('q_widows');
  };

  it('every arc quest is a real, reachable content record', () => {
    for (const id of ARC) {
      const q = QUESTS[id];
      expect(q, `${id} missing from QUESTS`).toBeDefined();
      expect(NPCS[q.giverNpcId]?.questIds).toContain(id);
      expect(QUEST_ORDER).toContain(id);
    }
  });

  it('the two answers to the rot are mutually exclusive once one is accepted', () => {
    const sim = makeSim();
    openArc(sim);
    // Neither answer is offered until the rot has actually been traced.
    expect(stateOf(sim, 'q_burn_the_beds')).toBe('unavailable');
    expect(stateOf(sim, 'q_seed_the_shallows')).toBe('unavailable');

    accept(sim, 'q_greyrot');
    complete(sim, 'q_greyrot'); // sets fen_rot_traced
    expect(stateOf(sim, 'q_burn_the_beds')).toBe('available');
    expect(stateOf(sim, 'q_seed_the_shallows')).toBe('available');

    accept(sim, 'q_burn_the_beds'); // sets fen_beds_burned, which the other branch forbids
    expect(stateOf(sim, 'q_seed_the_shallows')).toBe('unavailable');
  });

  it("each branch's payoff opens only for the branch that was taken", () => {
    const burn = makeSim();
    openArc(burn);
    accept(burn, 'q_greyrot');
    complete(burn, 'q_greyrot');
    accept(burn, 'q_burn_the_beds');
    expect(stateOf(burn, 'q_ash_and_water')).toBe('unavailable'); // gated on the TURN-IN
    complete(burn, 'q_burn_the_beds');
    expect(stateOf(burn, 'q_ash_and_water')).toBe('available');
    expect(stateOf(burn, 'q_first_green')).toBe('unavailable'); // the road not taken

    const seed = makeSim();
    openArc(seed);
    accept(seed, 'q_greyrot');
    complete(seed, 'q_greyrot');
    accept(seed, 'q_seed_the_shallows');
    complete(seed, 'q_seed_the_shallows');
    expect(stateOf(seed, 'q_first_green')).toBe('available');
    expect(stateOf(seed, 'q_ash_and_water')).toBe('unavailable');
    expect(stateOf(seed, 'q_burn_the_beds')).toBe('unavailable');
  });

  it('the choice survives a save/load and still locks out the other road', () => {
    const sim = makeSim();
    openArc(sim);
    accept(sim, 'q_greyrot');
    complete(sim, 'q_greyrot');
    accept(sim, 'q_seed_the_shallows');
    complete(sim, 'q_seed_the_shallows');

    const saved = sim.serializeCharacter(sim.playerId)!;
    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    reloaded.addPlayer('warrior', 'Test', { state: saved });
    expect(stateOf(reloaded, 'q_first_green')).toBe('available');
    expect(stateOf(reloaded, 'q_burn_the_beds')).toBe('unavailable');
    expect(stateOf(reloaded, 'q_ash_and_water')).toBe('unavailable');
  });
});
