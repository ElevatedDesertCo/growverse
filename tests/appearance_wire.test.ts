// The authored look has to reach OTHER clients, or a player spends their
// one-shot redesign and nobody, including them, sees a different character.
// This pins the entity wire carrying it, and the sparseness that keeps every
// pre-creator character on the legacy class rig.

import { describe, expect, it, vi } from 'vitest';

// Mock the db layer so no Postgres is needed; the wire shape is under test.
vi.mock('../server/db', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  saveCharacterState: vi.fn(async () => {}),
  openPlaySession: vi.fn(async () => 1),
  closePlaySession: vi.fn(async () => {}),
  insertChatLogs: vi.fn(async () => {}),
  walletForAccount: vi.fn(async () => null),
  markAccountQuestComplete: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  grantAccountMechChroma: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
}));

import { wireEntity } from '../server/game';
import { ClientWorld } from '../src/net/online';
import { Sim } from '../src/sim/sim';

// The online client mirrors server snapshots, so a look that never lands here
// is a look no peer ever sees. Same shape as snapshots.test.ts's bareClient.
function bareClient(pid: number): ClientWorld {
  const c: any = Object.create(ClientWorld.prototype);
  c.cfg = { seed: 20061, playerClass: 'warrior' };
  c.entities = new Map();
  c.playerId = pid;
  c.ownPlayerId = pid;
  c.ownPlayerClass = 'warrior';
  c.spectating = null;
  c.moveInput = {};
  c.inventory = [];
  c.vendorBuyback = [];
  c.equipment = {};
  c.accountCosmetics = { completedQuestIds: [], mechChromaIds: [] };
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
  return c;
}

function playerEntity() {
  const sim = new Sim({ seed: 7, playerClass: 'warrior', noPlayer: true });
  const pid = sim.addPlayer('warrior', 'Thornia');
  const e = sim.entities.get(pid);
  if (!e) throw new Error('player entity missing');
  return e;
}

const LOOK = { gender: 'female', hair: 'afro', brows: 'thick' };

describe('appearance on the entity wire', () => {
  it('ships the authored look so peers compose the right body', () => {
    const e = playerEntity();
    e.modularAppearance = LOOK;
    expect(wireEntity(e).app).toEqual(LOOK);
  });

  it('omits the key entirely when there is no authored look', () => {
    // Sparse on purpose: absent means "legacy class rig", which is what keeps
    // every character that predates the creator rendering exactly as before,
    // and keeps the field off the wire for all of them.
    const e = playerEntity();
    e.modularAppearance = null;
    expect('app' in wireEntity(e)).toBe(false);
  });

  it('round-trips through JSON, since that is what actually crosses the socket', () => {
    const e = playerEntity();
    e.modularAppearance = LOOK;
    const parsed = JSON.parse(JSON.stringify(wireEntity(e)));
    expect(parsed.app).toEqual(LOOK);
  });
});

describe('entity defaults', () => {
  it('a fresh player has no authored look, so nothing composes by accident', () => {
    expect(playerEntity().modularAppearance ?? null).toBeNull();
  });

  it('helmHidden defaults off, so a composed body wears its kit helm', () => {
    expect(playerEntity().helmHidden).toBe(false);
  });
});

describe('the look survives the whole round trip to a peer', () => {
  // The end the review found broken: the server had the look, but nothing put
  // it on the wire, so a player could spend their one-shot token and no client
  // would ever compose a different body.
  const applyTo = (client: ClientWorld, wire: Record<string, unknown>) => {
    (client as unknown as { applySnapshot(s: unknown): void }).applySnapshot({
      t: 'snap',
      self: { id: 1 },
      ents: [wire],
    });
  };

  it('a peer receives the authored look and can compose from it', () => {
    const e = playerEntity();
    e.id = 42;
    e.modularAppearance = LOOK;
    const client = bareClient(1);
    // Through JSON on purpose: this is what actually crosses the socket.
    applyTo(client, JSON.parse(JSON.stringify(wireEntity(e))));
    expect(client.entities.get(42)?.modularAppearance).toEqual(LOOK);
  });

  it('a peer with no authored look mirrors as null, keeping the class rig', () => {
    const e = playerEntity();
    e.id = 43;
    e.modularAppearance = null;
    const client = bareClient(1);
    applyTo(client, JSON.parse(JSON.stringify(wireEntity(e))));
    expect(client.entities.get(43)?.modularAppearance ?? null).toBeNull();
  });
});
