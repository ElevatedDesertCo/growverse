// The timed-quest countdown across BOTH worlds (IWorldQuests.questSecondsLeft).
//
// There is no shared clock between server and client: the snapshot carries no time
// field and ClientWorld mirrors none. So the two worlds answer differently on purpose:
//   - Sim owns the clock the deadline was stamped against, so it answers exactly.
//   - The server sends seconds-remaining BUCKETED (an exact per-tick value would churn
//     the whole quest log through maybe()'s JSON diff every tick), and ClientWorld
//     interpolates down from the last value using the local UI clock, re-anchoring on
//     every update so it cannot drift.
//
// These tests pin both halves, plus the property that matters most: an untimed quest
// reports null in both worlds, so nothing renders a countdown that does not exist.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QUESTS } from '../src/sim/data';
import { finalizeQuestAccept } from '../src/sim/quests/quest_commands';
import { Sim } from '../src/sim/sim';
import type { PlayerClass, QuestDef, QuestProgress } from '../src/sim/types';

const makeSim = (cls: PlayerClass = 'warrior', seed = 42) =>
  new Sim({ seed, playerClass: cls, autoEquip: true });

const base = (id: string): QuestDef => ({
  id,
  name: id,
  giverNpcId: 'cultivator_marlow',
  turnInNpcId: 'cultivator_marlow',
  text: id,
  completionText: id,
  objectives: [{ type: 'kill', targetMobId: 'forest_wolf', count: 1, label: 'l' }],
  xpReward: 0,
  copperReward: 0,
  itemRewards: {},
});

const TEMP: QuestDef[] = [{ ...base('q_tl_timed'), timeLimit: 120 }, base('q_tl_untimed')];

const install = () => {
  for (const def of TEMP) (QUESTS as Record<string, QuestDef>)[def.id] = def;
};
const uninstall = () => {
  for (const def of TEMP) delete (QUESTS as Record<string, QuestDef>)[def.id];
};

type Ctx = Parameters<typeof finalizeQuestAccept>[0];
const metaOf = (sim: Sim) =>
  (sim as unknown as { primary: Parameters<typeof finalizeQuestAccept>[3] }).primary;
const accept = (sim: Sim, id: string) => {
  const ctx = (sim as unknown as { ctx: Ctx }).ctx;
  finalizeQuestAccept(ctx, id, QUESTS[id], metaOf(sim));
};

describe('timed-quest countdown: the offline Sim answers exactly', () => {
  afterEach(uninstall);

  it('reports the full limit the moment the quest is accepted', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_tl_timed');
    expect(sim.questSecondsLeft('q_tl_timed')).toBeCloseTo(120, 5);
  });

  it('counts down with the sim clock', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_tl_timed');
    for (let i = 0; i < 20 * 5; i++) sim.tick(); // 5 seconds at 20 Hz
    expect(sim.questSecondsLeft('q_tl_timed')).toBeCloseTo(115, 1);
  });

  it('never reports negative time', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_tl_timed');
    const qp = metaOf(sim).questLog.get('q_tl_timed');
    if (qp) qp.expiresAt = -999;
    expect(sim.questSecondsLeft('q_tl_timed')).toBe(0);
  });

  it('reports null for an untimed quest, so nothing renders a countdown', () => {
    install();
    const sim = makeSim();
    accept(sim, 'q_tl_untimed');
    expect(sim.questSecondsLeft('q_tl_untimed')).toBeNull();
  });

  it('reports null for a quest that is not in the log at all', () => {
    install();
    const sim = makeSim();
    expect(sim.questSecondsLeft('q_tl_timed')).toBeNull();
  });
});

// ClientWorld is exercised through a bare instance + applySnapshot, the pattern
// tests/snapshots.test.ts established. The UI clock is faked so the interpolation is
// asserted deterministically rather than by sleeping.
describe('timed-quest countdown: ClientWorld interpolates from the bucketed value', () => {
  let now = 0;
  beforeEach(() => {
    now = 10_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The self frame carries the quest log, and applySnapshot only decodes the extended self
  // state once applyWire has turned that frame into a real entity, so the wire fields below
  // are load-bearing: a `{ qlog }`-only self is silently ignored.
  const selfWire = {
    id: 1,
    k: 'player',
    tid: 'warrior',
    nm: 'Tester',
    lv: 10,
    x: 0,
    y: 0,
    z: 0,
    f: 0,
    hp: 100,
    mhp: 100,
    res: 0,
    mres: 100,
    rtype: 'rage',
  };

  // A bare ClientWorld driven through the REAL applySnapshot, mirroring the bareClient
  // pattern in tests/snapshots.test.ts. Driving the real path is the point: a helper that
  // re-implemented the re-anchor logic would prove nothing about applySnapshot's wiring.
  const clientWithQlog = async (qlog: QuestProgress[]) => {
    const { ClientWorld } = await import('../src/net/online');
    // biome-ignore lint/suspicious/noExplicitAny: bare prototype instance, as snapshots.test.ts does
    const c: any = Object.create(ClientWorld.prototype);
    c.cfg = { seed: 20061, playerClass: 'warrior' };
    c.entities = new Map();
    c.playerId = 1;
    c.ownPlayerId = 1;
    c.ownPlayerClass = 'warrior';
    c.spectating = null;
    c.moveInput = {};
    c.inventory = [];
    c.vendorBuyback = [];
    c.equipment = {};
    c.accountCosmetics = { completedQuestIds: [], mechChromaIds: [] };
    c.copper = 0;
    c.xp = 0;
    c.known = [];
    c.questLog = new Map();
    c.questsDone = new Set();
    c.questTimeAnchors = new Map();
    c.pendingQuestCommands = new Map();
    c.partyInfo = null;
    c.tradeInfo = null;
    c.duelInfo = null;
    c.lastSnapAt = 0;
    c.snapInterval = 50;
    c.missingSince = new Map();
    c.pendingFacingDelta = 0;
    c.connected = true;
    c.eventQueue = [];
    c.mouselookFacing = null;
    c.lastInputSentAt = 0;
    c.lastInputSig = '';
    c.inputSeq = 0;
    c.pendingInputSeqSentAt = new Map();
    c.ackedInputSeq = 0;
    c.inputEchoSamples = [];
    c.spectateFacingPending = false;
    c.pendingSpectateFacing = null;
    c.applySnapshot({ t: 'snap', ents: [], self: { ...selfWire, qlog } });
    return c as InstanceType<typeof ClientWorld>;
  };

  it('reports the anchored value immediately, then counts down locally', async () => {
    const w = await clientWithQlog([
      { questId: 'q_tl_timed', counts: [0], state: 'active', secondsLeft: 90 },
    ]);
    expect(w.questSecondsLeft('q_tl_timed')).toBeCloseTo(90, 5);
    now += 30_000; // 30 seconds of UI clock
    expect(w.questSecondsLeft('q_tl_timed')).toBeCloseTo(60, 5);
  });

  it('clamps at zero rather than going negative', async () => {
    const w = await clientWithQlog([
      { questId: 'q_tl_timed', counts: [0], state: 'active', secondsLeft: 10 },
    ]);
    now += 60_000;
    expect(w.questSecondsLeft('q_tl_timed')).toBe(0);
  });

  it('reports null for an untimed quest', async () => {
    const w = await clientWithQlog([{ questId: 'q_tl_untimed', counts: [0], state: 'active' }]);
    expect(w.questSecondsLeft('q_tl_untimed')).toBeNull();
  });

  it('a fresh bucketed value re-anchors, so a coarse wire value cannot drift', async () => {
    const w = await clientWithQlog([
      { questId: 'q_tl_timed', counts: [0], state: 'active', secondsLeft: 90 },
    ]);
    now += 12_000; // local countdown says 78
    expect(w.questSecondsLeft('q_tl_timed')).toBeCloseTo(78, 5);
    // The server re-sends at its bucket boundary with the authoritative 80, through the
    // real snapshot path.
    (w as unknown as { applySnapshot(s: unknown): void }).applySnapshot({
      t: 'snap',
      ents: [],
      self: {
        ...selfWire,
        qlog: [{ questId: 'q_tl_timed', counts: [0], state: 'active', secondsLeft: 80 }],
      },
    });
    expect(w.questSecondsLeft('q_tl_timed')).toBeCloseTo(80, 5);
  });
});
