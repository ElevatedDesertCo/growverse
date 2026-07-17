// Gear + talent loadout sets (src/sim/sim.ts saveLoadout / switchLoadout wrappers):
// a saved loadout snapshots the player's equipment alongside their talents, and
// switching to it re-equips the saved gear from bags. Talent-only behavior is
// covered elsewhere; this pins the gear ride-along + persistence.

import { describe, expect, it } from 'vitest';
import * as items from '../src/sim/items';
import { Sim } from '../src/sim/sim';

// biome-ignore lint/suspicious/noExplicitAny: tests reach into Sim internals (ctx / players)
type AnySim = Sim & Record<string, any>;

function makeWorld() {
  return new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true }) as AnySim;
}
const ctxOf = (sim: AnySim) => sim.ctx as Parameters<typeof items.equipItem>[0];

describe('gear + talent loadout sets', () => {
  it('snapshots equipment on save and re-equips it on switch', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Loadout');
    const meta = sim.players.get(pid)!;
    const ctx = ctxOf(sim);

    // Equip helmet A, then save the loadout (captures the current gear).
    sim.addItem('cryptbone_helm', 1, pid);
    items.equipItem(ctx, 'cryptbone_helm', pid);
    expect(meta.equipment.helmet).toBe('cryptbone_helm');
    const idx = sim.saveLoadout('Tank Set', [], pid);
    expect(idx).toBe(0);
    expect((meta.loadouts[0] as { gear?: Record<string, string> }).gear?.helmet).toBe(
      'cryptbone_helm',
    );

    // Swap to helmet B: A goes back to bags, B is worn.
    sim.addItem('roadwardens_helm', 1, pid);
    items.equipItem(ctx, 'roadwardens_helm', pid);
    expect(meta.equipment.helmet).toBe('roadwardens_helm');
    expect(sim.countItem('cryptbone_helm', pid)).toBe(1);

    // Switch back to the loadout: helmet A (in bags) is re-equipped, B returns to bags.
    expect(sim.switchLoadout(0, pid)).toBe(true);
    expect(meta.equipment.helmet).toBe('cryptbone_helm');
    expect(sim.countItem('roadwardens_helm', pid)).toBe(1);
    expect(sim.countItem('cryptbone_helm', pid)).toBe(0);
  });

  it('skips a saved piece the player no longer owns, without error', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Gone');
    const meta = sim.players.get(pid)!;
    const ctx = ctxOf(sim);

    sim.addItem('cryptbone_helm', 1, pid);
    items.equipItem(ctx, 'cryptbone_helm', pid);
    sim.saveLoadout('Set', [], pid);

    // Remove the helm entirely (unequip + destroy), then switch: the slot just stays empty.
    items.unequipItem(ctx, 'helmet', pid);
    sim.removeItem('cryptbone_helm', 1, pid);
    expect(sim.countItem('cryptbone_helm', pid)).toBe(0);
    expect(sim.switchLoadout(0, pid)).toBe(true);
    expect(meta.equipment.helmet).toBeUndefined();
  });

  it('persists the gear snapshot across a character save/load round-trip', () => {
    const sim = makeWorld();
    const pid = sim.addPlayer('warrior', 'Persist');
    const ctx = ctxOf(sim);
    sim.addItem('cryptbone_helm', 1, pid);
    items.equipItem(ctx, 'cryptbone_helm', pid);
    sim.saveLoadout('Set', [], pid);

    const saved = sim.serializeCharacter(pid)!;
    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true }) as AnySim;
    reloaded.addPlayer('warrior', 'Persist', { state: saved });
    const rmeta = [...reloaded.players.values()][0];
    expect((rmeta.loadouts[0] as { gear?: Record<string, string> }).gear?.helmet).toBe(
      'cryptbone_helm',
    );
  });
});
