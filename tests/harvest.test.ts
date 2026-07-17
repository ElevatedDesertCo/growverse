// Resource gathering (src/sim/harvest.ts): a harvest node is worked with a channel,
// not an instant pickup, then yields an existing crafting reagent and depletes +
// respawns. These tests drive the real Sim facade (sim.pickUpObject routes a node to
// the channel; the casting lifecycle completes it) and assert the channel, the yield,
// the deplete/respawn, the guards, and determinism.

import { describe, expect, it } from 'vitest';
import { HARVEST_NODES, ITEMS } from '../src/sim/data';
import { createGroundObject } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import { type Entity, HARVEST_CAST_ID } from '../src/sim/types';
import { terrainHeight } from '../src/sim/world';

type AnySim = Sim & Record<string, any>;

const makeSim = () => new Sim({ seed: 42, playerClass: 'warrior', autoEquip: true }) as AnySim;

function placeAt(sim: AnySim, e: Entity, x: number, z: number): void {
  e.pos.x = x;
  e.pos.z = z;
  e.pos.y = terrainHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
  e.onGround = true;
  sim.rebucket(e);
}

// Spawn a fresh bloom_thicket node next to the player and return it.
function spawnNodeByPlayer(sim: AnySim, nodeId = 'bloom_thicket'): Entity {
  const p = sim.player as Entity;
  placeAt(sim, p, 0, 0);
  const node = createGroundObject(sim.nextId++, 'bloom_essence', 'Bloom Thicket', {
    x: 2,
    y: p.pos.y,
    z: 0,
  });
  node.harvestNodeId = nodeId;
  sim.addEntity(node);
  sim.rebucket(node);
  return node;
}

const YIELD_IDS = ['bloom_essence', 'common_seed'];
const totalYield = (sim: AnySim) => YIELD_IDS.reduce((n, id) => n + sim.countItem(id), 0);

describe('harvest nodes', () => {
  it('spawns resource nodes into the live world', () => {
    const sim = makeSim();
    const nodes = [...sim.entities.values()].filter(
      (e: Entity) => e.kind === 'object' && e.harvestNodeId,
    );
    expect(nodes.length).toBeGreaterThan(0);
    // every spawned node references a real node def
    for (const n of nodes) expect(HARVEST_NODES[n.harvestNodeId as string]).toBeTruthy();
  });

  it('working a node starts a harvest channel, not an instant pickup', () => {
    const sim = makeSim();
    const node = spawnNodeByPlayer(sim);
    const before = totalYield(sim);
    sim.pickUpObject(node.id);
    // channel started; nothing granted yet and the node is still there
    expect(sim.player.castingAbility).toBe(HARVEST_CAST_ID);
    expect(totalYield(sim)).toBe(before);
    expect(node.lootable).toBe(true);
  });

  it('completing the channel yields a reagent and depletes the node', () => {
    const sim = makeSim();
    const node = spawnNodeByPlayer(sim);
    const before = totalYield(sim);
    sim.pickUpObject(node.id);
    // tick out the channel (default HARVEST_CAST_TIME = 3s at 20 Hz, plus slack)
    for (let i = 0; i < 20 * 5 && sim.player.castingAbility; i++) sim.tick();
    expect(sim.player.castingAbility).toBe(null);
    expect(totalYield(sim)).toBe(before + 1);
    expect(node.lootable).toBe(false);
    expect(node.respawnTimer).toBeGreaterThan(0);
  });

  it('emits a structured harvestGather event naming the gathered reagent', () => {
    const sim = makeSim();
    const node = spawnNodeByPlayer(sim);
    sim.pickUpObject(node.id);
    let gather: any;
    for (let i = 0; i < 20 * 5 && sim.player.castingAbility; i++) {
      for (const ev of sim.tick()) if (ev.type === 'harvestGather') gather = ev;
    }
    expect(gather).toBeTruthy();
    // structured: an item id, no player-facing text (client localizes)
    expect(YIELD_IDS).toContain(gather.itemId);
    expect(gather.pid).toBe(sim.player.id);
  });

  it('a depleted node respawns after its timer', () => {
    const sim = makeSim();
    const node = spawnNodeByPlayer(sim);
    sim.pickUpObject(node.id);
    for (let i = 0; i < 20 * 5 && sim.player.castingAbility; i++) sim.tick();
    expect(node.lootable).toBe(false);
    // HARVEST_RESPAWN = 90s; tick past it
    for (let i = 0; i < 20 * 95; i++) sim.tick();
    expect(node.lootable).toBe(true);
  });

  it('cannot harvest while in combat (no channel, no yield)', () => {
    const sim = makeSim();
    const node = spawnNodeByPlayer(sim);
    sim.player.inCombat = true;
    const before = totalYield(sim);
    sim.pickUpObject(node.id);
    expect(sim.player.castingAbility).toBe(null);
    expect(totalYield(sim)).toBe(before);
    expect(node.lootable).toBe(true);
  });

  it('spawns the timber + copper veins into the world and grants real items', () => {
    const sim = makeSim();
    const nodeIds = new Set(
      [...sim.entities.values()]
        .filter((e: Entity) => e.kind === 'object' && e.harvestNodeId)
        .map((e: Entity) => e.harvestNodeId as string),
    );
    // the Phase 2b nodes are live in the world
    expect(nodeIds.has('timber_stand')).toBe(true);
    expect(nodeIds.has('copper_vein')).toBe(true);
    // every yield of every node references a real ITEMS entry (rough_timber/copper_ore
    // included), so a gather grants a genuine item, never a dangling id
    for (const node of Object.values(HARVEST_NODES)) {
      for (const y of node.yields) expect(ITEMS[y.itemId], y.itemId).toBeTruthy();
    }
    expect(ITEMS.rough_timber?.name).toBe('Rough Timber');
    expect(ITEMS.copper_ore?.name).toBe('Copper Ore');
  });

  it('is deterministic: same seed + inputs yields the same reagent', () => {
    const run = (): string => {
      const sim = makeSim();
      const node = spawnNodeByPlayer(sim);
      sim.pickUpObject(node.id);
      for (let i = 0; i < 20 * 5 && sim.player.castingAbility; i++) sim.tick();
      // whichever of the two yields was granted
      return YIELD_IDS.find((id) => sim.countItem(id) > 0) ?? '';
    };
    expect(run()).toBe(run());
    expect(YIELD_IDS).toContain(run());
  });
});
