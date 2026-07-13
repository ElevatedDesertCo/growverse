import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import type { Entity, SimEvent } from '../src/sim/types';

// Sim-layer tests for the Grow Station / Upgrade Bench crafting path
// (src/sim/crafting.ts, behind the SimContext seam). They drive the public
// `sim.craft(recipeId, pid)` delegate the IWorld surface + server dispatch resolve,
// so the moved body is exercised through the real seam (resolve/emit/error + the
// inventory hub), not a stub.

function makeWorld() {
  return new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
}

type MetaShape = { copper: number; inventory: { itemId: string; count: number }[] };

// Add a warrior and stand them next to the attendant NPC for `station` so the
// crafting proximity gate passes. Mirrors the vendorPlayer helper in items.test.ts.
function craftPlayer(sim: Sim, templateId: string, name = 'Aleph') {
  const pid = sim.addPlayer('warrior', name);
  const anySim = sim as unknown as {
    entities: Map<number, Entity>;
    players: Map<number, MetaShape>;
    rebucket(e: Entity): void;
  };
  const npc = [...anySim.entities.values()].find(
    (e) => (e as unknown as { templateId?: string }).templateId === templateId,
  ) as Entity;
  const p = anySim.entities.get(pid) as Entity;
  p.pos.x = npc.pos.x + 2;
  p.pos.z = npc.pos.z;
  anySim.rebucket(p);
  const meta = anySim.players.get(pid) as MetaShape;
  return { pid, npc, p, meta };
}

function errorTexts(events: SimEvent[]): string[] {
  return events
    .filter((e): e is Extract<SimEvent, { type: 'error' }> => e.type === 'error')
    .map((e) => e.text);
}

function craftEvents(events: SimEvent[]): Extract<SimEvent, { type: 'craft' }>[] {
  return events.filter((e): e is Extract<SimEvent, { type: 'craft' }> => e.type === 'craft');
}

describe('crafting: Grow Station', () => {
  it('consumes reagents + copper and awards the output, emitting a craft event', () => {
    const sim = makeWorld();
    const { pid, meta } = craftPlayer(sim, 'cultivator_marlow');
    meta.copper = 100;
    sim.addItem('bloom_essence', 2, pid);
    sim.drainEvents();

    sim.craft('craft_bloom_nutrient', pid);
    const evs = sim.drainEvents();

    expect(sim.countItem('bloom_nutrient', pid)).toBe(1);
    expect(sim.countItem('bloom_essence', pid)).toBe(0);
    expect(meta.copper).toBe(85); // 100 - 15 copperCost
    const crafted = craftEvents(evs);
    expect(crafted).toHaveLength(1);
    expect(crafted[0].recipeId).toBe('craft_bloom_nutrient');
    expect(crafted[0].pid).toBe(pid);
  });

  it('rejects a recipe when the reagents are missing', () => {
    const sim = makeWorld();
    const { pid, meta } = craftPlayer(sim, 'cultivator_marlow');
    meta.copper = 100;
    sim.drainEvents();

    sim.craft('craft_bloom_nutrient', pid);
    const evs = sim.drainEvents();

    expect(sim.countItem('bloom_nutrient', pid)).toBe(0);
    expect(meta.copper).toBe(100); // no deduction on failure
    expect(errorTexts(evs)).toContain('You lack the materials to craft that.');
    expect(craftEvents(evs)).toHaveLength(0);
  });

  it('rejects a recipe the player cannot afford', () => {
    const sim = makeWorld();
    const { pid, meta } = craftPlayer(sim, 'cultivator_marlow');
    meta.copper = 5; // below the 15-copper cost
    sim.addItem('bloom_essence', 2, pid);
    sim.drainEvents();

    sim.craft('craft_bloom_nutrient', pid);
    const evs = sim.drainEvents();

    expect(sim.countItem('bloom_nutrient', pid)).toBe(0);
    expect(sim.countItem('bloom_essence', pid)).toBe(2); // reagents untouched
    expect(meta.copper).toBe(5);
    expect(errorTexts(evs)).toContain('Not enough money.');
  });
});

describe('crafting: station proximity', () => {
  it('rejects when the player is not near the required station', () => {
    const sim = makeWorld();
    // Stand at the Grow Station but attempt an Upgrade Bench recipe.
    const { pid, meta } = craftPlayer(sim, 'cultivator_marlow');
    meta.copper = 500;
    sim.addItem('corruption_shard', 6, pid);
    sim.drainEvents();

    sim.craft('craft_shard_whetstone', pid);
    const evs = sim.drainEvents();

    expect(sim.countItem('shard_whetstone', pid)).toBe(0);
    expect(errorTexts(evs)).toContain('You are too far from the station.');
  });

  it('crafts an Upgrade Bench recipe when standing at the Riftsmith', () => {
    const sim = makeWorld();
    const { pid, meta } = craftPlayer(sim, 'smith_draxa');
    meta.copper = 500;
    sim.addItem('corruption_shard', 2, pid);
    sim.drainEvents();

    sim.craft('craft_shard_whetstone', pid);
    const evs = sim.drainEvents();

    expect(sim.countItem('shard_whetstone', pid)).toBe(1);
    expect(sim.countItem('corruption_shard', pid)).toBe(0);
    expect(meta.copper).toBe(475); // 500 - 25 copperCost
    expect(craftEvents(evs)).toHaveLength(1);
  });
});

describe('crafting: Cookfire (dockside cook)', () => {
  it('cooks a raw fish into a meal at the Dockside Cook', () => {
    const sim = makeWorld();
    const { pid, meta } = craftPlayer(sim, 'cook_ferra');
    meta.copper = 50;
    sim.addItem('raw_river_perch', 1, pid);
    sim.drainEvents();

    sim.craft('cook_river_perch', pid);
    const evs = sim.drainEvents();

    expect(sim.countItem('cooked_river_perch', pid)).toBe(1);
    expect(sim.countItem('raw_river_perch', pid)).toBe(0);
    expect(meta.copper).toBe(45); // 50 - 5 copperCost
    expect(craftEvents(evs)).toHaveLength(1);
  });

  it('gates a higher-tier fish recipe on the required level', () => {
    const sim = makeWorld();
    const { pid, meta } = craftPlayer(sim, 'cook_ferra');
    meta.copper = 50;
    sim.addItem('raw_marsh_pike', 1, pid); // cook_marsh_pike requires level 8
    sim.drainEvents();

    sim.craft('cook_marsh_pike', pid);
    const evs = sim.drainEvents();

    expect(sim.countItem('cooked_marsh_pike', pid)).toBe(0);
    expect(sim.countItem('raw_marsh_pike', pid)).toBe(1); // reagent untouched
    expect(errorTexts(evs)).toContain('You are not skilled enough to craft that yet.');
  });

  it('makes cooked fish a better meal than the raw catch (heals more, restores mana)', () => {
    const raw = ITEMS.raw_marsh_pike;
    const cooked = ITEMS.cooked_marsh_pike;
    expect(cooked.kind).toBe('food');
    expect(cooked.foodHp ?? 0).toBeGreaterThan(raw.foodHp ?? 0);
    expect(cooked.drinkMana ?? 0).toBeGreaterThan(0);
  });
});

describe('crafting: Alchemy Lab (the Alchemist)', () => {
  it('brews bloom extract into a healing draught at the Alchemist', () => {
    const sim = makeWorld();
    const { pid, meta } = craftPlayer(sim, 'alchemist_sable');
    meta.copper = 50;
    sim.addItem('bloom_extract', 2, pid);
    sim.drainEvents();

    sim.craft('alchemy_healing_draught', pid);
    const evs = sim.drainEvents();

    expect(sim.countItem('swirling_healing_draught', pid)).toBe(1);
    expect(sim.countItem('bloom_extract', pid)).toBe(0);
    expect(meta.copper).toBe(40); // 50 - 10 copperCost
    expect(craftEvents(evs)).toHaveLength(1);
  });

  it('gates the bloom elixir on its required level', () => {
    const sim = makeWorld();
    const { pid, meta } = craftPlayer(sim, 'alchemist_sable');
    meta.copper = 50;
    sim.addItem('bloom_extract', 4, pid); // alchemy_elixir_of_the_bloom requires level 5
    sim.drainEvents();

    sim.craft('alchemy_elixir_of_the_bloom', pid);
    const evs = sim.drainEvents();

    expect(sim.countItem('elixir_of_the_bloom', pid)).toBe(0);
    expect(sim.countItem('bloom_extract', pid)).toBe(4); // reagents untouched
    expect(errorTexts(evs)).toContain('You are not skilled enough to craft that yet.');
  });
});

describe('crafting: bad input', () => {
  it('rejects an unknown recipe id', () => {
    const sim = makeWorld();
    const { pid } = craftPlayer(sim, 'cultivator_marlow');
    sim.drainEvents();

    sim.craft('craft_nonexistent', pid);
    const evs = sim.drainEvents();

    expect(errorTexts(evs)).toContain('That recipe is not available here.');
    expect(craftEvents(evs)).toHaveLength(0);
  });
});
