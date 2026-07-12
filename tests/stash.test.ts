import { beforeEach, describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import { STASH_LIMIT } from '../src/sim/stash';
import type { PlayerClass } from '../src/sim/types';
import { terrainHeight } from '../src/sim/world';

// The account bank (stash): deposit/withdraw at the banker NPC, plus the
// CharacterState persistence round-trip. banker_thistle stands at (3, 7); a
// deposit/withdraw is only allowed within INTERACT_RANGE + 2 (= 7) of a
// stash-keeper NPC, so the player is teleported onto the banker for the happy
// path and far away for the "no bank nearby" rejection.
const STASH_ITEM = 'bloom_essence';
const BANKER = { x: 3, z: 7 };

function makeSim(cls: PlayerClass = 'warrior', seed = 42): Sim {
  return new Sim({ seed, playerClass: cls, autoEquip: false });
}

// Move the primary player next to the banker so proximity checks pass.
function standAtBank(sim: Sim): void {
  const p = sim.player;
  p.pos.x = BANKER.x;
  p.pos.z = BANKER.z;
  p.pos.y = terrainHeight(BANKER.x, BANKER.z, sim.cfg.seed);
  p.prevPos = { ...p.pos };
}

// Move the player far from any NPC so the stash-keeper proximity check fails.
function standAway(sim: Sim): void {
  const p = sim.player;
  p.pos.x = 240;
  p.pos.z = 240;
  p.pos.y = terrainHeight(240, 240, sim.cfg.seed);
  p.prevPos = { ...p.pos };
}

describe('stash deposit/withdraw at the banker', () => {
  let sim: Sim;
  beforeEach(() => {
    sim = makeSim();
    standAtBank(sim);
  });

  it('moves a stack from bags into the bank on deposit', () => {
    sim.addItem(STASH_ITEM, 5);
    expect(sim.countItem(STASH_ITEM)).toBe(5);
    sim.depositToStash(STASH_ITEM, 2);
    expect(sim.countItem(STASH_ITEM)).toBe(3);
    expect(sim.stash.find((s) => s.itemId === STASH_ITEM)?.count).toBe(2);
  });

  it('defaults to depositing a single unit when count is omitted', () => {
    sim.addItem(STASH_ITEM, 4);
    sim.depositToStash(STASH_ITEM);
    expect(sim.countItem(STASH_ITEM)).toBe(3);
    expect(sim.stash.find((s) => s.itemId === STASH_ITEM)?.count).toBe(1);
  });

  it('clamps an over-large deposit to what the player actually holds', () => {
    sim.addItem(STASH_ITEM, 3);
    sim.depositToStash(STASH_ITEM, 99);
    expect(sim.countItem(STASH_ITEM)).toBe(0);
    expect(sim.stash.find((s) => s.itemId === STASH_ITEM)?.count).toBe(3);
  });

  it('merges repeated deposits into the same bank stack', () => {
    sim.addItem(STASH_ITEM, 5);
    sim.depositToStash(STASH_ITEM, 2);
    sim.depositToStash(STASH_ITEM, 1);
    expect(sim.stash.filter((s) => s.itemId === STASH_ITEM)).toHaveLength(1);
    expect(sim.stash.find((s) => s.itemId === STASH_ITEM)?.count).toBe(3);
    expect(sim.countItem(STASH_ITEM)).toBe(2);
  });

  it('moves a stack from the bank back into bags on withdraw', () => {
    sim.addItem(STASH_ITEM, 5);
    sim.depositToStash(STASH_ITEM, 5);
    expect(sim.countItem(STASH_ITEM)).toBe(0);
    sim.withdrawFromStash(STASH_ITEM, 2);
    expect(sim.countItem(STASH_ITEM)).toBe(2);
    expect(sim.stash.find((s) => s.itemId === STASH_ITEM)?.count).toBe(3);
  });

  it('removes the bank slot entirely once fully withdrawn', () => {
    sim.addItem(STASH_ITEM, 3);
    sim.depositToStash(STASH_ITEM, 3);
    sim.withdrawFromStash(STASH_ITEM, 3);
    expect(sim.stash.find((s) => s.itemId === STASH_ITEM)).toBeUndefined();
    expect(sim.countItem(STASH_ITEM)).toBe(3);
  });

  it('emits a stash event describing the moved item', () => {
    sim.addItem(STASH_ITEM, 2);
    sim.depositToStash(STASH_ITEM, 1);
    const events = sim.tick();
    const stashEv = events.find((e) => e.type === 'stash');
    expect(stashEv).toMatchObject({ type: 'stash', action: 'deposit', itemId: STASH_ITEM });
  });
});

describe('stash rejects invalid moves', () => {
  it('refuses a deposit when no stash-keeper is nearby, leaving bags intact', () => {
    const sim = makeSim();
    standAway(sim);
    sim.addItem(STASH_ITEM, 4);
    sim.depositToStash(STASH_ITEM, 2);
    expect(sim.countItem(STASH_ITEM)).toBe(4);
    expect(sim.stash).toHaveLength(0);
  });

  it('refuses a withdraw when no stash-keeper is nearby, leaving the bank intact', () => {
    const sim = makeSim();
    standAtBank(sim);
    sim.addItem(STASH_ITEM, 3);
    sim.depositToStash(STASH_ITEM, 3);
    standAway(sim);
    sim.withdrawFromStash(STASH_ITEM, 1);
    expect(sim.stash.find((s) => s.itemId === STASH_ITEM)?.count).toBe(3);
    expect(sim.countItem(STASH_ITEM)).toBe(0);
  });

  it('refuses to deposit an item the player does not hold', () => {
    const sim = makeSim();
    standAtBank(sim);
    sim.depositToStash(STASH_ITEM, 1);
    expect(sim.stash).toHaveLength(0);
  });

  it('refuses to withdraw an item that is not banked', () => {
    const sim = makeSim();
    standAtBank(sim);
    sim.withdrawFromStash(STASH_ITEM, 1);
    expect(sim.countItem(STASH_ITEM)).toBe(0);
  });

  it('reserves the bank slot before touching bags: a full bank never eats the item', () => {
    const sim = makeSim();
    standAtBank(sim);
    // Fill the bank to its distinct-stack cap with unique junk ids, then try to
    // deposit a NEW item id. The new-stack deposit must be rejected and the item
    // must stay in the player's bags (no silent loss).
    for (let i = 0; i < STASH_LIMIT; i++) sim.stash.push({ itemId: `filler_${i}`, count: 1 });
    sim.addItem(STASH_ITEM, 2);
    sim.depositToStash(STASH_ITEM, 1);
    expect(sim.countItem(STASH_ITEM)).toBe(2);
    expect(sim.stash.find((s) => s.itemId === STASH_ITEM)).toBeUndefined();
  });
});

describe('stash persists across a save/load round-trip', () => {
  it('serializes bank contents into CharacterState and restores them on reload', () => {
    const sim = makeSim();
    standAtBank(sim);
    sim.addItem(STASH_ITEM, 5);
    sim.depositToStash(STASH_ITEM, 3);

    const state = sim.serializeCharacter(sim.player.id);
    expect(state?.stash).toEqual([{ itemId: STASH_ITEM, count: 3 }]);

    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    const pid = reloaded.addPlayer('warrior', 'Thistletest', { state: state ?? undefined });
    const meta = reloaded.serializeCharacter(pid);
    expect(meta?.stash).toEqual([{ itemId: STASH_ITEM, count: 3 }]);
  });

  it('defaults to an empty bank when loading a pre-stash save (no stash field)', () => {
    const sim = makeSim();
    standAtBank(sim);
    const state = sim.serializeCharacter(sim.player.id);
    expect(state).not.toBeNull();
    // Simulate a save minted before the stash feature existed.
    const legacy = { ...(state as object) } as Record<string, unknown>;
    delete legacy.stash;

    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    const pid = reloaded.addPlayer('warrior', 'Legacy', {
      state: legacy as unknown as NonNullable<Parameters<Sim['addPlayer']>[2]>['state'],
    });
    expect(reloaded.serializeCharacter(pid)?.stash).toEqual([]);
  });
});
