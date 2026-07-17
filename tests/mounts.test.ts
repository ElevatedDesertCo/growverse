// Mounts and Stables v1 (docs/prd/mounts-and-stables.md): learn/summon/dismount
// rules, the +60% speed fold, the copper and $GROW purchase paths, and the
// ownedMounts/growCoins persistence round-trip.

import { describe, expect, it } from 'vitest';
import { ITEMS, MOUNTS, RIDING_LEVEL } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import { tradeSetOffer } from '../src/sim/social/trade';
import type { MountDef } from '../src/sim/types';
import { terrainHeight } from '../src/sim/world';

const makeSim = (cls = 'warrior', seed = 42) =>
  new Sim({ seed, playerClass: cls as never, autoEquip: true });

function meta(sim: Sim) {
  return (sim as never as { players: Map<number, { [k: string]: never }> }).players.get(
    (sim as never as { primaryId: number }).primaryId,
  ) as unknown as {
    growCoins: number;
    ownedMounts: Set<string>;
    copper: number;
    entityId: number;
  };
}

function teleportTo(sim: Sim, x: number, z: number): void {
  const p = sim.player;
  p.pos.x = x;
  p.pos.z = z;
  p.pos.y = terrainHeight(x, z, sim.cfg.seed);
  p.prevPos = { ...p.pos };
}

function stablemaster(sim: Sim) {
  const npc = [...sim.entities.values()].find((e) => e.templateId === 'stablemaster_marla');
  expect(npc, 'Stablemaster Marla spawns in zone 1').toBeDefined();
  return npc as NonNullable<typeof npc>;
}

describe('mount content', () => {
  it('registers the two-tier roster with the exclusives priced in $GROW only', () => {
    expect(Object.keys(MOUNTS).sort()).toEqual([
      'mount_alpaca',
      'mount_bloomstrider',
      'mount_boar',
      'mount_bull',
      'mount_elder_bloomstrider',
      'mount_swift_alpaca',
      'mount_swift_boar',
      'mount_swift_bull',
    ]);
    expect(MOUNTS.mount_bloomstrider.exclusive).toBe(true);
    expect(MOUNTS.mount_elder_bloomstrider.exclusive).toBe(true);
    // Fairness invariant: a $GROW exclusive never outruns the copper mounts,
    // and every mount is actually reachable (gate within the level cap).
    const all = Object.values(MOUNTS);
    const maxCopperSpeed = Math.max(...all.filter((m) => !m.exclusive).map((m) => m.speedBonus));
    for (const m of all) {
      expect(m.requiredLevel, m.id).toBeLessThanOrEqual(20);
      if (m.exclusive) expect(m.speedBonus, m.id).toBeLessThanOrEqual(maxCopperSpeed);
    }
  });

  it('marks every stable item soulbound-style (no trade, no market, no vendor sellback)', () => {
    for (const m of Object.values(MOUNTS)) {
      const item = ITEMS[m.itemId];
      expect(item?.noTrade, m.itemId).toBe(true);
      expect(item?.noMarketList, m.itemId).toBe(true);
      expect(item?.noVendorSell, m.itemId).toBe(true);
    }
    expect(ITEMS.verdant_wardrobe_crate?.noTrade).toBe(true);
  });

  it('filters reins out of a player trade offer (noTrade, soulbound-style)', () => {
    // Direct module drive with a minimal fake ctx, per tests/trade.test.ts.
    const players = new Map<number, { entityId: number; name: string; copper: number }>();
    const entities = new Map<number, { id: number; pos: { x: number; y: number; z: number } }>();
    const trades = new Map<number, unknown>();
    const bag = new Map<string, number>([
      ['reins_highfield_alpaca', 1],
      ['baked_bread', 2],
    ]);
    players.set(1, { entityId: 1, name: 'Trader', copper: 0 });
    entities.set(1, { id: 1, pos: { x: 0, y: 0, z: 0 } });
    const session = {
      a: 1,
      b: 2,
      offerA: { items: [] as { itemId: string; count: number }[], copper: 0 },
      offerB: { items: [], copper: 0 },
      acceptedA: false,
      acceptedB: false,
    };
    trades.set(1, session);
    const ctx = {
      players,
      entities,
      trades,
      resolve: (pid?: number) => {
        const meta = players.get(pid ?? -1);
        const e = entities.get(pid ?? -1);
        return meta && e ? { meta, e } : null;
      },
      countItem: (itemId: string) => bag.get(itemId) ?? 0,
    } as unknown as import('../src/sim/sim_context').SimContext;
    tradeSetOffer(
      ctx,
      [
        { itemId: 'reins_highfield_alpaca', count: 1 },
        { itemId: 'baked_bread', count: 2 },
      ],
      0,
      1,
    );
    expect(session.offerA.items.map((s) => s.itemId)).toEqual(['baked_bread']);
  });

  it('sells every mount at the stable, reins learn on use, and the vendor refuses a repeat sale', () => {
    const sim = makeSim();
    const npc = stablemaster(sim);
    teleportTo(sim, npc.pos.x, npc.pos.z - 1);
    sim.setPlayerLevel(RIDING_LEVEL);
    const m = meta(sim);
    m.copper = 100000;
    sim.buyItem(npc.id, 'reins_highfield_alpaca');
    expect(m.copper).toBe(100000 - 40000);
    sim.useItem('reins_highfield_alpaca');
    expect(m.ownedMounts.has('mount_alpaca')).toBe(true);
    // the reins are consumed on learning
    expect(sim.inventory.some((s) => s.itemId === 'reins_highfield_alpaca')).toBe(false);
    // a second copy is refused before payment
    sim.tick();
    const before = m.copper;
    const evs = [...sim.tick(), ...(sim.buyItem(npc.id, 'reins_highfield_alpaca'), sim.tick())];
    expect(m.copper).toBe(before);
    expect(evs.some((e) => e.type === 'error')).toBe(true);
  });
});

describe('learning gates', () => {
  it('refuses to learn below the riding level and refunds nothing (item kept)', () => {
    const sim = makeSim();
    sim.addItem('reins_highfield_alpaca', 1);
    sim.useItem('reins_highfield_alpaca');
    const m = meta(sim);
    expect(m.ownedMounts.size).toBe(0);
    expect(sim.inventory.some((s) => s.itemId === 'reins_highfield_alpaca')).toBe(true);
  });
});

describe('$GROW purchases', () => {
  it('debits growCoins, emits grow_spend, and refuses when the balance is short', () => {
    const sim = makeSim();
    const npc = stablemaster(sim);
    teleportTo(sim, npc.pos.x, npc.pos.z - 1);
    sim.setPlayerLevel(RIDING_LEVEL);
    const m = meta(sim);
    // short balance: refused, nothing granted
    m.growCoins = 99;
    sim.buyItem(npc.id, 'reins_verdant_bloomstrider');
    expect(m.growCoins).toBe(99);
    expect(sim.inventory.some((s) => s.itemId === 'reins_verdant_bloomstrider')).toBe(false);
    // funded: debited exactly, item granted, ledger event emitted with the amount
    m.growCoins = 150;
    sim.buyItem(npc.id, 'reins_verdant_bloomstrider');
    const evs = sim.tick();
    expect(m.growCoins).toBe(50);
    expect(sim.inventory.some((s) => s.itemId === 'reins_verdant_bloomstrider')).toBe(true);
    const spend = evs.find((e) => e.type === 'grow_spend');
    expect(spend && 'amount' in spend && spend.amount).toBe(100);
    // copper is never touched by a $GROW purchase
    expect(m.copper).toBe(0);
  });
});

describe('summon and dismount', () => {
  function riddenSim() {
    const sim = makeSim();
    sim.setPlayerLevel(RIDING_LEVEL);
    const m = meta(sim);
    m.ownedMounts.add('mount_bull');
    return { sim, m };
  }

  it('summons an owned mount, applies +60% speed, and toggles off', () => {
    const { sim } = riddenSim();
    sim.summonMount('mount_bull');
    expect(sim.activeMountId).toBe('mount_bull');
    expect(sim.moveSpeedMult(sim.player)).toBeCloseTo(1.6);
    // summoning the active mount dismisses it
    sim.summonMount('mount_bull');
    expect(sim.activeMountId).toBe(null);
    expect(sim.moveSpeedMult(sim.player)).toBe(1);
  });

  it('refuses an unowned mount, and respects the level gate', () => {
    const sim = makeSim();
    sim.summonMount('mount_bull');
    expect(sim.activeMountId).toBe(null);
    const m = meta(sim);
    m.ownedMounts.add('mount_bull');
    // owned but underleveled (level 1)
    sim.summonMount('mount_bull');
    expect(sim.activeMountId).toBe(null);
  });

  it('dismounts on taking damage', () => {
    const { sim } = riddenSim();
    sim.summonMount('mount_bull');
    expect(sim.activeMountId).toBe('mount_bull');
    (sim as never as { dealDamage: (...a: unknown[]) => void }).dealDamage(
      null,
      sim.player,
      5,
      false,
      'physical',
      null,
      'hit',
    );
    expect(sim.activeMountId).toBe(null);
  });

  it('dismounts on entering combat', () => {
    const { sim } = riddenSim();
    sim.summonMount('mount_bull');
    const mob = [...sim.entities.values()].find((e) => e.kind === 'mob' && !e.dead);
    expect(mob).toBeDefined();
    (sim as never as { enterCombat: (a: unknown, b: unknown) => void }).enterCombat(
      sim.player,
      mob,
    );
    expect(sim.activeMountId).toBe(null);
  });

  it('cannot summon while in combat', () => {
    const { sim } = riddenSim();
    sim.player.inCombat = true;
    sim.summonMount('mount_bull');
    expect(sim.activeMountId).toBe(null);
  });
});

describe('riding lessons', () => {
  it('walks the practice course and pays out enough for a first set of reins', () => {
    const sim = makeSim();
    sim.setPlayerLevel(RIDING_LEVEL);
    const marla = stablemaster(sim);
    teleportTo(sim, marla.pos.x, marla.pos.z - 1);
    sim.acceptQuest('q_riding_lessons');
    expect(sim.questLog.get('q_riding_lessons')?.state).toBe('active');
    for (const marker of ['course_low_rail', 'course_hay_bales', 'course_timber_arch']) {
      const obj = [...sim.entities.values()].find(
        (e) => e.kind === 'object' && e.objectItemId === marker,
      );
      expect(obj, marker).toBeDefined();
      if (!obj) return;
      teleportTo(sim, obj.pos.x, obj.pos.z);
      sim.pickUpObject(obj.id);
    }
    expect(sim.questLog.get('q_riding_lessons')?.state).toBe('ready');
    const m = meta(sim);
    const before = m.copper;
    teleportTo(sim, marla.pos.x, marla.pos.z - 1);
    sim.turnInQuest('q_riding_lessons');
    expect(sim.questLog.has('q_riding_lessons')).toBe(false);
    // The payout covers a riding-tier set of reins (40000c).
    expect(m.copper - before).toBe(40000);
  });
});

describe('persistence', () => {
  it('round-trips ownedMounts and growCoins through CharacterState', () => {
    const sim = makeSim();
    sim.setPlayerLevel(RIDING_LEVEL);
    const m = meta(sim);
    m.ownedMounts.add('mount_boar');
    m.growCoins = 42;
    const state = sim.serializeCharacter((sim as never as { primaryId: number }).primaryId);
    expect(state?.ownedMounts).toEqual(['mount_boar']);
    expect(state?.growCoins).toBe(42);

    const sim2 = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    const pid = sim2.addPlayer('warrior', 'Rider', { state: state ?? undefined });
    const m2 = (
      sim2 as never as { players: Map<number, { ownedMounts: Set<string>; growCoins: number }> }
    ).players.get(pid);
    expect(m2?.ownedMounts.has('mount_boar')).toBe(true);
    expect(m2?.growCoins).toBe(42);
  });

  it('loads a pre-mount save cleanly (defaults: none, 0)', () => {
    const sim = makeSim();
    const state = sim.serializeCharacter((sim as never as { primaryId: number }).primaryId);
    expect(state).toBeTruthy();
    if (!state) return;
    delete state.ownedMounts;
    delete state.growCoins;
    const sim2 = new Sim({ seed: 7, playerClass: 'warrior', noPlayer: true });
    const pid = sim2.addPlayer('warrior', 'Older', { state });
    const m2 = (
      sim2 as never as { players: Map<number, { ownedMounts: Set<string>; growCoins: number }> }
    ).players.get(pid);
    expect(m2?.ownedMounts.size).toBe(0);
    expect(m2?.growCoins).toBe(0);
  });
});
