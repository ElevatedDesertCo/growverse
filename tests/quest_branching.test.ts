// Quest branching (Phase D): persistent world-flags gate quest availability and a quest
// choice sets a flag that endures. This drives the flag logic through the real quest cores
// (finalizeQuestAccept / turnInQuestCore / computeQuestState) with temporary quest defs
// injected into the QUESTS table, so the ENGINE is proven end to end without shipping
// (and localizing) in-world content: that lands with the zone re-theming.

import { afterEach, describe, expect, it } from 'vitest';
import { QUESTS } from '../src/sim/data';
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
