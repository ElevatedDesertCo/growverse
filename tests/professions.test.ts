// Gathering professions (src/sim/professions.ts + the harvest integration): a player levels
// Mining / Herbalism / Logging by working world nodes. Covers the skill math (train + cap),
// the view, a save/load round-trip, and the real gather path raising the node's profession.

import { describe, expect, it } from 'vitest';
import { createGroundObject } from '../src/sim/entity';
import {
  emptyProfessions,
  professionsView,
  restoreProfessions,
  serializeProfessions,
  trainProfession,
} from '../src/sim/professions';
import { Sim } from '../src/sim/sim';
import { type Entity, PROFESSION_MAX, type ProfessionId } from '../src/sim/types';
import { terrainHeight } from '../src/sim/world';

type AnySim = Sim & Record<string, any>;
const makeSim = () => new Sim({ seed: 42, playerClass: 'warrior', autoEquip: true }) as AnySim;
const skillOf = (sim: Sim, id: ProfessionId) =>
  sim.professions.find((p) => p.id === id)?.skill ?? -1;

function spawnNode(sim: AnySim, nodeId: string, itemId: string): Entity {
  const p = sim.player as Entity;
  p.pos.x = 0;
  p.pos.z = 0;
  p.pos.y = terrainHeight(0, 0, sim.cfg.seed);
  p.prevPos = { ...p.pos };
  sim.rebucket(p);
  const node = createGroundObject(sim.nextId++, itemId, 'Node', { x: 2, y: p.pos.y, z: 0 });
  node.harvestNodeId = nodeId;
  sim.addEntity(node);
  sim.rebucket(node);
  return node;
}
const workNode = (sim: AnySim, node: Entity) => {
  sim.pickUpObject(node.id);
  for (let i = 0; i < 20 * 5 && sim.player.castingAbility; i++) sim.tick();
};

describe('professions: skill math', () => {
  it('trains a profession by one per gather and caps at PROFESSION_MAX', () => {
    const skills = emptyProfessions();
    expect(trainProfession(skills, 'mining')).toBe(1);
    expect(trainProfession(skills, 'mining')).toBe(2);
    skills.mining = PROFESSION_MAX;
    expect(trainProfession(skills, 'mining')).toBe(PROFESSION_MAX); // clamped
    expect(skills.herbalism).toBe(0); // untouched
  });

  it('professionsView returns one entry per profession with skill + ceiling', () => {
    const skills = { mining: 5, herbalism: 12, logging: 0 };
    const view = professionsView(skills);
    expect(view.map((p) => p.id).sort()).toEqual(['herbalism', 'logging', 'mining']);
    expect(view.find((p) => p.id === 'herbalism')).toEqual({
      id: 'herbalism',
      skill: 12,
      max: PROFESSION_MAX,
    });
  });

  it('serialize/restore round-trips, and a pre-professions save loads at 0', () => {
    const skills = { mining: 7, herbalism: 3, logging: 21 };
    expect(restoreProfessions(serializeProfessions(skills))).toEqual(skills);
    expect(restoreProfessions(undefined)).toEqual(emptyProfessions());
    expect(restoreProfessions({ mining: 9 })).toEqual({ mining: 9, herbalism: 0, logging: 0 });
  });
});

describe('professions: earned by gathering', () => {
  it('a fresh character has every profession at 0', () => {
    const sim = makeSim();
    expect(skillOf(sim, 'mining')).toBe(0);
    expect(skillOf(sim, 'herbalism')).toBe(0);
    expect(skillOf(sim, 'logging')).toBe(0);
  });

  it('working a herbalism node raises Herbalism, not the other skills', () => {
    const sim = makeSim();
    const node = spawnNode(sim, 'bloom_thicket', 'bloom_essence'); // tagged herbalism
    workNode(sim, node);
    expect(skillOf(sim, 'herbalism')).toBe(1);
    expect(skillOf(sim, 'mining')).toBe(0);
    expect(skillOf(sim, 'logging')).toBe(0);
  });

  it('working a mining node raises Mining', () => {
    const sim = makeSim();
    const node = spawnNode(sim, 'ember_vent', 'ember_essence'); // tagged mining
    workNode(sim, node);
    expect(skillOf(sim, 'mining')).toBe(1);
    expect(skillOf(sim, 'herbalism')).toBe(0);
  });

  it('working a timber stand raises Logging (the only Logging node)', () => {
    const sim = makeSim();
    const node = spawnNode(sim, 'timber_stand', 'rough_timber'); // tagged logging
    workNode(sim, node);
    expect(skillOf(sim, 'logging')).toBe(1);
    expect(skillOf(sim, 'mining')).toBe(0);
    expect(skillOf(sim, 'herbalism')).toBe(0);
  });

  it('working a copper vein raises Mining', () => {
    const sim = makeSim();
    const node = spawnNode(sim, 'copper_vein', 'copper_ore'); // tagged mining
    workNode(sim, node);
    expect(skillOf(sim, 'mining')).toBe(1);
    expect(skillOf(sim, 'logging')).toBe(0);
  });

  it('a profession skill survives a character save/load round-trip', () => {
    const sim = makeSim();
    const node = spawnNode(sim, 'bloom_thicket', 'bloom_essence');
    workNode(sim, node);
    const saved = sim.serializeCharacter(sim.playerId)!;
    const reloaded = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
    reloaded.addPlayer('warrior', 'Test', { state: saved });
    expect(reloaded.professions.find((p) => p.id === 'herbalism')?.skill).toBe(1);
  });
});
