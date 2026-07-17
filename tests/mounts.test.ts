// Mounts and Stables v1 (docs/prd/mounts-and-stables.md): learn/summon/dismount
// rules, the +60% speed fold, the copper and $GROW purchase paths, and the
// ownedMounts/growCoins persistence round-trip.

import { describe, expect, it } from 'vitest';
import { MOUNTS, RIDING_LEVEL } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
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
  it('registers the v1 roster with the exclusive priced in $GROW only', () => {
    expect(Object.keys(MOUNTS).sort()).toEqual([
      'mount_alpaca',
      'mount_bloomstrider',
      'mount_boar',
      'mount_bull',
    ]);
    const exclusive = MOUNTS.mount_bloomstrider;
    expect(exclusive.exclusive).toBe(true);
    // Fairness invariant: the $GROW exclusive is cosmetic prestige only.
    for (const m of Object.values(MOUNTS)) {
      expect(m.speedBonus).toBe(exclusive.speedBonus);
      expect(m.requiredLevel).toBe(RIDING_LEVEL);
    }
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
    const evs = [
      ...sim.tick(),
      ...(sim.buyItem(npc.id, 'reins_highfield_alpaca'), sim.tick()),
    ];
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
