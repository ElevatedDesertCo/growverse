// Server-side $GROW ledger (docs/prd/mounts-and-stables.md): grow purchases are
// DEBIT-FIRST (buyGrowItem debits the ledger before the sim may grant, refunds
// when the sim refuses or the buyer left mid-flight, and resyncs every
// same-account mirror to the authoritative balance), join zeroes then seeds the
// mirror from the ledger, admin credits live-update online sessions, and the
// admin credit endpoint validates input.
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the db layer so no Postgres is needed (mirrors snapshots.test.ts).
vi.mock('../server/db', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  saveCharacterState: vi.fn(async () => {}),
  openPlaySession: vi.fn(async () => 1),
  closePlaySession: vi.fn(async () => {}),
  insertChatLogs: vi.fn(async () => {}),
  walletForAccount: vi.fn(async () => null),
  markAccountQuestComplete: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  grantAccountMechChroma: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  getGrowBalance: vi.fn(async () => 0),
  debitGrow: vi.fn(async () => ({ ok: true, balance: 0 })),
  creditGrow: vi.fn(async () => 0),
  growLedgerFor: vi.fn(async () => []),
  accountForToken: vi.fn(async () => null),
  isAdminAccount: vi.fn(async () => false),
  accountById: vi.fn(async () => null),
}));

import { handleAdminApi, parseGrowAmount } from '../server/admin';
import {
  accountById,
  accountForToken,
  creditGrow,
  debitGrow,
  getGrowBalance,
  growLedgerFor,
  isAdminAccount,
} from '../server/db';
import { type ClientSession, GameServer } from '../server/game';
import type { PlayerMeta } from '../src/sim/sim';

interface FakeClient {
  sent: unknown[];
  ws: { readyState: number; send: (payload: string) => void };
}

function fakeWs(): FakeClient {
  const sent: unknown[] = [];
  return { sent, ws: { readyState: 1, send: (payload: string) => sent.push(JSON.parse(payload)) } };
}

function joinServer(
  server: GameServer,
  fc: FakeClient,
  accountId: number,
  characterId: number,
  name: string,
): ClientSession {
  const session = server.join(fc.ws as never, accountId, characterId, name, 'warrior', null);
  if ('error' in session) throw new Error(session.error);
  session.blockListLoaded = true;
  return session;
}

function metaOf(server: GameServer, pid: number): PlayerMeta {
  const meta = (server as unknown as { sim: { meta(pid: number): PlayerMeta | null } }).sim.meta(
    pid,
  );
  if (!meta) throw new Error('no meta');
  return meta;
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('grow balance sync on join', () => {
  it('seeds meta.growCoins from the account ledger after join', async () => {
    vi.mocked(getGrowBalance).mockResolvedValue(250);
    const server = new GameServer();
    const session = joinServer(server, fakeWs(), 5, 101, 'Grower');
    await flush();
    expect(getGrowBalance).toHaveBeenCalledWith(5);
    expect(metaOf(server, session.pid).growCoins).toBe(250);
  });
});

// --- debit-first grow purchases ----------------------------------------------

const REINS = 'reins_verdant_bloomstrider'; // growPrice 100, sold by the stable
const REINS_PRICE = 100;

function stableNpc(server: GameServer): { id: number; pos: { x: number; z: number } } {
  const npc = [...server.sim.entities.values()].find((e) => e.templateId === 'stablemaster_marla');
  if (!npc) throw new Error('stablemaster_marla not in world');
  return npc;
}

function moveTo(server: GameServer, pid: number, x: number, z: number): void {
  const e = server.sim.entities.get(pid);
  if (!e) throw new Error('no player entity');
  e.pos.x = x;
  e.pos.z = z;
  e.prevPos = { ...e.pos };
}

// Drive the real command path: the wire 'buy' cmd routes grow-priced items
// through the async debit-first buyGrowItem, never straight into sim.buyItem.
function sendBuy(server: GameServer, session: ClientSession, npcId: number): void {
  server.handleMessage(session, JSON.stringify({ t: 'cmd', cmd: 'buy', npc: npcId, item: REINS }));
}

describe('debit-first grow purchases', () => {
  it('debits the ledger first, grants the item, and lands the mirror on the balance', async () => {
    vi.mocked(getGrowBalance).mockResolvedValue(1000);
    vi.mocked(debitGrow).mockResolvedValue({ ok: true, balance: 900 });
    const server = new GameServer();
    const session = joinServer(server, fakeWs(), 6, 102, 'Buyer');
    await flush();
    const npc = stableNpc(server);
    moveTo(server, session.pid, npc.pos.x + 1, npc.pos.z);
    sendBuy(server, session, npc.id);
    // The debit is issued synchronously with the command, before any grant.
    expect(debitGrow).toHaveBeenCalledWith(6, REINS_PRICE, `purchase:${REINS}`);
    expect(server.sim.countItem(REINS, session.pid)).toBe(0);
    await flush();
    expect(server.sim.countItem(REINS, session.pid)).toBe(1);
    expect(metaOf(server, session.pid).growCoins).toBe(900);
    expect(creditGrow).not.toHaveBeenCalled();
  });

  it('grants nothing on a failed debit and resyncs the mirror to the real balance', async () => {
    vi.mocked(getGrowBalance).mockResolvedValue(1000);
    vi.mocked(debitGrow).mockResolvedValue({ ok: false, balance: 40 });
    const server = new GameServer();
    const session = joinServer(server, fakeWs(), 7, 103, 'Racer');
    await flush();
    expect(metaOf(server, session.pid).growCoins).toBe(1000); // stale-high seed
    const npc = stableNpc(server);
    moveTo(server, session.pid, npc.pos.x + 1, npc.pos.z);
    sendBuy(server, session, npc.id);
    await flush();
    expect(debitGrow).toHaveBeenCalledWith(7, REINS_PRICE, `purchase:${REINS}`);
    expect(server.sim.countItem(REINS, session.pid)).toBe(0);
    expect(metaOf(server, session.pid).growCoins).toBe(40);
    expect(creditGrow).not.toHaveBeenCalled();
  });

  it('refunds the debit when the sim refuses the purchase', async () => {
    vi.mocked(getGrowBalance).mockResolvedValue(1000);
    vi.mocked(debitGrow).mockResolvedValue({ ok: true, balance: 900 });
    vi.mocked(creditGrow).mockResolvedValue(1000);
    const server = new GameServer();
    const session = joinServer(server, fakeWs(), 6, 102, 'FarAway');
    await flush();
    const npc = stableNpc(server);
    // Out of interact range: the ledger debit succeeds but the sim refuses the
    // sale, so nothing is granted and the debit must come straight back.
    moveTo(server, session.pid, npc.pos.x + 500, npc.pos.z);
    sendBuy(server, session, npc.id);
    await flush();
    expect(debitGrow).toHaveBeenCalledWith(6, REINS_PRICE, `purchase:${REINS}`);
    expect(creditGrow).toHaveBeenCalledWith(6, REINS_PRICE, `refund:${REINS}`, 'game');
    expect(server.sim.countItem(REINS, session.pid)).toBe(0);
    expect(metaOf(server, session.pid).growCoins).toBe(1000);
  });

  it('resyncs a sibling session on the same account after a buy', async () => {
    vi.mocked(getGrowBalance).mockResolvedValue(1000);
    vi.mocked(debitGrow).mockResolvedValue({ ok: true, balance: 900 });
    const server = new GameServer();
    const buyer = joinServer(server, fakeWs(), 6, 102, 'BuyerOne');
    const sibling = joinServer(server, fakeWs(), 6, 103, 'BuyerTwo');
    const other = joinServer(server, fakeWs(), 9, 105, 'Bystander');
    await flush();
    expect(metaOf(server, sibling.pid).growCoins).toBe(1000);
    const npc = stableNpc(server);
    moveTo(server, buyer.pid, npc.pos.x + 1, npc.pos.z);
    sendBuy(server, buyer, npc.id);
    await flush();
    // The two characters share one ledger balance: the sibling's mirror snaps
    // to it too, so it can never spend the same 1000 twice.
    expect(metaOf(server, buyer.pid).growCoins).toBe(900);
    expect(metaOf(server, sibling.pid).growCoins).toBe(900);
    expect(metaOf(server, other.pid).growCoins).toBe(1000);
  });

  it('refunds a debit that lands after the buyer left the world', async () => {
    vi.mocked(getGrowBalance).mockResolvedValue(1000);
    let resolveDebit!: (v: { ok: boolean; balance: number }) => void;
    vi.mocked(debitGrow).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDebit = resolve;
        }),
    );
    vi.mocked(creditGrow).mockResolvedValue(1000);
    const server = new GameServer();
    const session = joinServer(server, fakeWs(), 8, 104, 'Ghost');
    await flush();
    const npc = stableNpc(server);
    moveTo(server, session.pid, npc.pos.x + 1, npc.pos.z);
    sendBuy(server, session, npc.id);
    expect(debitGrow).toHaveBeenCalledWith(8, REINS_PRICE, `purchase:${REINS}`);
    // The socket drops while the debit is still in flight: the player never
    // received anything, so the successful debit must be returned in full.
    await server.leave(session, 'test');
    resolveDebit({ ok: true, balance: 900 });
    await flush();
    expect(creditGrow).toHaveBeenCalledWith(8, REINS_PRICE, `refund:${REINS} (left world)`, 'game');
  });
});

describe('creditGrowForAccount', () => {
  it('writes the ledger and live-updates every online session on the account', async () => {
    vi.mocked(getGrowBalance).mockResolvedValue(10);
    vi.mocked(creditGrow).mockResolvedValue(510);
    const server = new GameServer();
    const session = joinServer(server, fakeWs(), 8, 104, 'Lucky');
    const other = joinServer(server, fakeWs(), 9, 105, 'Bystander');
    await flush();
    const balance = await server.creditGrowForAccount(8, 500, 'promo', 'adminuser');
    expect(creditGrow).toHaveBeenCalledWith(8, 500, 'promo', 'adminuser');
    expect(balance).toBe(510);
    expect(metaOf(server, session.pid).growCoins).toBe(510);
    // Another account's session is untouched.
    expect(metaOf(server, other.pid).growCoins).toBe(10);
  });
});

// --- admin credit endpoint validation ---------------------------------------

const VALID_TOKEN = 'a'.repeat(64);

function fakeReq(opts: { method?: string; url?: string; body?: unknown } = {}): IncomingMessage {
  const req = new EventEmitter() as EventEmitter & {
    method: string;
    url: string;
    headers: { authorization?: string };
    socket: { remoteAddress: string };
  };
  req.method = opts.method ?? 'GET';
  req.url = opts.url ?? '/admin/api/overview';
  req.headers = { authorization: `Bearer ${VALID_TOKEN}` };
  req.socket = { remoteAddress: '10.0.0.1' };
  if (opts.method === 'POST') {
    setImmediate(() => {
      if (opts.body !== undefined) req.emit('data', JSON.stringify(opts.body));
      req.emit('end');
    });
  }
  return req as unknown as IncomingMessage;
}

interface FakeResponse {
  statusCode: number;
  body: { success?: boolean; data?: unknown; error?: string | null } | null;
  writeHead(status: number): void;
  end(data?: string): void;
}

function fakeRes(): FakeResponse & ServerResponse {
  const res: FakeResponse = {
    statusCode: 0,
    body: null,
    writeHead(status: number) {
      this.statusCode = status;
    },
    end(data?: string) {
      this.body = data ? JSON.parse(data) : null;
    },
  };
  return res as FakeResponse & ServerResponse;
}

describe('parseGrowAmount', () => {
  it('accepts bounded non-zero integers in either direction', () => {
    expect(parseGrowAmount(100)).toBe(100);
    expect(parseGrowAmount(-100)).toBe(-100);
    expect(parseGrowAmount(1_000_000)).toBe(1_000_000);
  });

  it('rejects zero, non-integers, out-of-bound and non-number values', () => {
    expect(parseGrowAmount(0)).toBeNull();
    expect(parseGrowAmount(1.5)).toBeNull();
    expect(parseGrowAmount(1_000_001)).toBeNull();
    expect(parseGrowAmount(-1_000_001)).toBeNull();
    expect(parseGrowAmount(Number.NaN)).toBeNull();
    expect(parseGrowAmount(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseGrowAmount('100')).toBeNull();
    expect(parseGrowAmount(undefined)).toBeNull();
  });
});

describe('admin grow credit endpoint', () => {
  const creditGrowForAccount = vi.fn(async () => 500);
  const fakeGame = { creditGrowForAccount } as unknown as Parameters<typeof handleAdminApi>[2];

  beforeEach(() => {
    vi.mocked(accountForToken).mockResolvedValue(7);
    vi.mocked(isAdminAccount).mockResolvedValue(true);
    vi.mocked(accountById).mockResolvedValue({
      id: 7,
      username: 'opsadmin',
      password_hash: '',
      password_set: true,
      email: null,
      created_at: '',
      deactivated_at: null,
      locale: null,
      marketing_opt_in: false,
    });
    creditGrowForAccount.mockClear();
    creditGrowForAccount.mockResolvedValue(500);
  });

  async function post(body: unknown): Promise<FakeResponse> {
    const res = fakeRes();
    await handleAdminApi(
      fakeReq({ method: 'POST', url: '/admin/api/accounts/42/grow/credit', body }),
      res,
      fakeGame,
    );
    return res;
  }

  it('rejects a missing, zero, fractional, or out-of-bound amount', async () => {
    for (const body of [
      {},
      { amount: 0, reason: 'x' },
      { amount: 2.5, reason: 'x' },
      { amount: 2_000_000, reason: 'x' },
      { amount: '50', reason: 'x' },
    ]) {
      const res = await post(body);
      expect(res.statusCode).toBe(400);
      expect(res.body?.error).toBe('amount must be a non-zero integer within 1000000');
    }
    expect(creditGrowForAccount).not.toHaveBeenCalled();
  });

  it('rejects a missing or blank reason', async () => {
    const res = await post({ amount: 50, reason: '   ' });
    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toBe('a reason is required');
    expect(creditGrowForAccount).not.toHaveBeenCalled();
  });

  it('routes a valid credit through the game server with the admin as actor', async () => {
    const res = await post({ amount: -50, reason: ' correction ' });
    expect(res.statusCode).toBe(200);
    expect(res.body?.data).toEqual({ balance: 500 });
    expect(creditGrowForAccount).toHaveBeenCalledWith(42, -50, 'correction', 'opsadmin');
  });

  it('maps a guarded-out adjustment to a 400 with the guard message', async () => {
    creditGrowForAccount.mockRejectedValue(
      new Error('grow adjustment rejected: account missing or balance would go below zero'),
    );
    const res = await post({ amount: -500, reason: 'correction' });
    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toBe(
      'grow adjustment rejected: account missing or balance would go below zero',
    );
  });

  it('serves the balance + ledger lookup', async () => {
    vi.mocked(getGrowBalance).mockResolvedValue(123);
    vi.mocked(growLedgerFor).mockResolvedValue([
      { id: 2, delta: -100, reason: 'purchase:mount_dirtbike', actor: 'game', createdAt: 'now' },
      { id: 1, delta: 223, reason: 'promo', actor: 'opsadmin', createdAt: 'now' },
    ]);
    const res = fakeRes();
    await handleAdminApi(fakeReq({ url: '/admin/api/accounts/42/grow' }), res, fakeGame);
    expect(res.statusCode).toBe(200);
    expect(res.body?.data).toEqual({
      balance: 123,
      ledger: [
        { id: 2, delta: -100, reason: 'purchase:mount_dirtbike', actor: 'game', createdAt: 'now' },
        { id: 1, delta: 223, reason: 'promo', actor: 'opsadmin', createdAt: 'now' },
      ],
    });
  });

  it('404s the lookup for a missing account', async () => {
    vi.mocked(accountById).mockResolvedValue(null);
    const res = fakeRes();
    await handleAdminApi(fakeReq({ url: '/admin/api/accounts/42/grow' }), res, fakeGame);
    expect(res.statusCode).toBe(404);
  });
});
