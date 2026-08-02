// Professions (src/sim/professions.ts + its training integrations): a player levels a skill
// by doing the activity, separately from character level. Covers the skill math (train +
// cap), the view, a save/load round-trip, and each real training path: a world node
// (mining/herbalism/logging), a garden bed (cultivation), and a crafting station
// (cultivation/cooking/alchemy/smithing via STATION_PROFESSION).

import { describe, expect, it } from 'vitest';
import { NPCS } from '../src/sim/data';
import { createGroundObject } from '../src/sim/entity';
import {
  emptyProfessions,
  professionsView,
  restoreProfessions,
  serializeProfessions,
  trainProfession,
} from '../src/sim/professions';
import { Sim } from '../src/sim/sim';
import {
  type Entity,
  PROFESSION_IDS,
  PROFESSION_MAX,
  PROFESSION_SKILL_PER_GATHER,
  type ProfessionId,
} from '../src/sim/types';
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
    const skills = { ...emptyProfessions(), mining: 5, herbalism: 12 };
    const view = professionsView(skills);
    expect(view.map((p) => p.id)).toEqual([...PROFESSION_IDS]);
    expect(view.find((p) => p.id === 'herbalism')).toEqual({
      id: 'herbalism',
      skill: 12,
      max: PROFESSION_MAX,
    });
  });

  it('serialize/restore round-trips, and a pre-professions save loads at 0', () => {
    const skills = {
      ...emptyProfessions(),
      mining: 7,
      herbalism: 3,
      logging: 21,
      cultivation: 14,
      fishing: 5,
      cooking: 2,
      alchemy: 11,
      smithing: 8,
    };
    expect(restoreProfessions(serializeProfessions(skills))).toEqual(skills);
    expect(restoreProfessions(undefined)).toEqual(emptyProfessions());
    expect(restoreProfessions({ mining: 9 })).toEqual({ ...emptyProfessions(), mining: 9 });
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

// Cultivation is a profession like the gathering three, but it trains off your own
// garden rather than a world node. The point of adding it: the grow loop should
// level a skill the way mining does, not sit outside the skill system.
describe('cultivation: trained by harvesting your own garden', () => {
  const growAndHarvest = (sim: Sim, seedItemId: string, plot = 0) => {
    sim.addItem(seedItemId, 1);
    sim.plantSeed(plot, seedItemId);
    sim.plots[plot].plantedAt = -100000;
    sim.harvestPlot(plot);
  };

  it('starts at zero and gains on each harvest', () => {
    const sim = makeSim();
    expect(skillOf(sim, 'cultivation')).toBe(0);
    growAndHarvest(sim, 'common_seed', 0);
    expect(skillOf(sim, 'cultivation')).toBe(PROFESSION_SKILL_PER_GATHER);
    growAndHarvest(sim, 'common_seed', 1);
    expect(skillOf(sim, 'cultivation')).toBe(PROFESSION_SKILL_PER_GATHER * 2);
  });

  it('does not train the gathering professions', () => {
    const sim = makeSim();
    growAndHarvest(sim, 'common_seed', 0);
    for (const id of ['mining', 'herbalism', 'logging'] as const) {
      expect(skillOf(sim, id), id).toBe(0);
    }
  });

  it('is reported by the character-sheet read alongside the others', () => {
    const sim = makeSim();
    expect(sim.professions.map((p) => p.id)).toContain('cultivation');
    expect(sim.professions.find((p) => p.id === 'cultivation')?.max).toBe(PROFESSION_MAX);
  });
});

// A crafting station trains its own skill (STATION_PROFESSION), so the bench you work
// levels a line the way a node does. The Grow Station trains cultivation on purpose:
// processing your buds is the back half of the same grow loop the garden bed trains.
describe('professions: trained by working a crafting station', () => {
  // Add a player and stand them beside the attendant NPC so the proximity gate passes.
  // Mirrors craftPlayer in crafting.test.ts.
  const atStation = (sim: AnySim, templateId: string) => {
    const pid = sim.addPlayer('warrior', 'Crafter');
    const npc = [...sim.entities.values()].find(
      (e: Entity) => (e as unknown as { templateId?: string }).templateId === templateId,
    ) as Entity;
    const p = sim.entities.get(pid) as Entity;
    p.pos.x = npc.pos.x + 2;
    p.pos.z = npc.pos.z;
    sim.rebucket(p);
    const meta = sim.meta(pid)!;
    meta.copper = 10000;
    return { pid, meta };
  };
  const skillFor = (sim: AnySim, pid: number, id: ProfessionId): number =>
    sim.meta(pid)!.professions[id];

  const cases: {
    station: ProfessionId;
    npc: string;
    recipe: string;
    input: [string, number];
  }[] = [
    {
      station: 'cultivation',
      npc: 'cultivator_marlow',
      recipe: 'craft_bloom_nutrient',
      input: ['bloom_essence', 2],
    },
    {
      station: 'cooking',
      npc: 'cook_cobb',
      recipe: 'cook_mirror_trout',
      input: ['raw_mirror_trout', 1],
    },
    {
      station: 'alchemy',
      npc: 'alchemist_sable',
      recipe: 'alchemy_healing_draught',
      input: ['bloom_extract', 2],
    },
    {
      station: 'smithing',
      npc: 'smith_draxa',
      recipe: 'craft_shard_whetstone',
      input: ['corruption_shard', 2],
    },
  ];

  for (const c of cases) {
    it(`crafting at ${c.npc}'s station trains ${c.station} and nothing else`, () => {
      const sim = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true }) as AnySim;
      const { pid } = atStation(sim, c.npc);
      sim.addItem(c.input[0], c.input[1], pid);
      sim.craft(c.recipe, pid);
      expect(skillFor(sim, pid, c.station)).toBe(PROFESSION_SKILL_PER_GATHER);
      for (const id of PROFESSION_IDS) {
        if (id !== c.station) expect(skillFor(sim, pid, id), id).toBe(0);
      }
    });
  }

  it('a craft that fails its gate trains nothing', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true }) as AnySim;
    const { pid } = atStation(sim, 'cultivator_marlow');
    sim.craft('craft_bloom_nutrient', pid); // no reagents in the bags
    for (const id of PROFESSION_IDS) expect(skillFor(sim, pid, id), id).toBe(0);
  });
});

// Fishing trains on the catch itself (sim.completeFishing), which is the same shape as a
// gather: the action succeeds, the skill ticks. Driven through the completion body rather
// than a real five-second cast so the assertion is about training, not lake geometry; the
// cast-to-completion path itself is covered in sim.test.ts.
describe('fishing: trained by landing a catch', () => {
  const bagCount = (meta: { inventory: { count: number }[] }) =>
    meta.inventory.reduce((n, s) => n + s.count, 0);
  // completeFishing is private on Sim; reached the same way the rest of the suite reaches
  // sim internals (tests/CLAUDE.md), so the training hook is driven where it actually runs.
  const landCast = (sim: AnySim) => {
    const meta = sim.meta(sim.playerId)!;
    const before = bagCount(meta);
    (sim as Record<string, any>).completeFishing(sim.player, meta);
    return bagCount(meta) > before;
  };

  it('trains once per catch and never on an empty line', () => {
    const sim = makeSim();
    let catches = 0;
    for (let i = 0; i < 40; i++) if (landCast(sim)) catches++;
    // The table has a "nothing bit" weight, so some of the 40 casts come up empty. The
    // point of the test is the exact correspondence: skill gained == fish landed.
    expect(catches).toBeGreaterThan(0);
    expect(catches).toBeLessThan(40);
    expect(skillOf(sim, 'fishing')).toBe(catches * PROFESSION_SKILL_PER_GATHER);
  });

  it('does not train any other skill', () => {
    const sim = makeSim();
    for (let i = 0; i < 10; i++) landCast(sim);
    for (const id of PROFESSION_IDS) {
      if (id !== 'fishing') expect(skillOf(sim, id), id).toBe(0);
    }
  });
});

// Breeding is its own line, trained at the Breeding Chamber. Deliberately NOT folded
// into cultivation: growing a plant well and reading genetics are different skills,
// and the strain library is the game's signature progression.
describe('breeding: trained by landing a cross', () => {
  // The chamber's proximity gate is anchored on its keeper (the Cultivator), so park
  // the player on him. Mirrors standAtChamber in genetics.test.ts.
  const standAtChamber = (sim: AnySim) => {
    const keeper = [...sim.entities.values()].find(
      (e: Entity) => e.kind === 'npc' && NPCS[e.templateId]?.crafting === 'grow',
    );
    if (!keeper) throw new Error('no Breeding Chamber keeper in the world');
    sim.player.pos.x = keeper.pos.x;
    sim.player.pos.z = keeper.pos.z;
  };
  // Two owned strains plus the bud cost, so only the cross itself is under test.
  const readyToCross = (sim: AnySim) => {
    standAtChamber(sim);
    const meta = sim.meta(sim.playerId)!;
    for (const seedId of ['common_seed', 'enriched_seed']) {
      sim.addItem(seedId, 1);
      sim.plantSeed(0, seedId);
      sim.plots[0].plantedAt = -100000;
      sim.harvestPlot(0);
    }
    sim.addItem('bud_common', 40);
    return meta;
  };

  it('gains on each cross that lands', () => {
    const sim = makeSim();
    const meta = readyToCross(sim);
    const [a, b] = meta.strains;
    expect(skillOf(sim, 'breeding')).toBe(0);
    sim.breedStrains(a.id, b.id);
    expect(skillOf(sim, 'breeding')).toBe(PROFESSION_SKILL_PER_GATHER);
    sim.breedStrains(a.id, b.id);
    expect(skillOf(sim, 'breeding')).toBe(PROFESSION_SKILL_PER_GATHER * 2);
  });

  it('trains nothing when the cross is rejected', () => {
    const sim = makeSim();
    const meta = readyToCross(sim);
    const [a] = meta.strains;
    sim.breedStrains(a.id, a.id); // same strain twice: rejected
    expect(skillOf(sim, 'breeding')).toBe(0);
  });

  it('is separate from cultivation: growing does not train it', () => {
    const sim = makeSim();
    readyToCross(sim); // two harvests happened, so cultivation moved
    expect(skillOf(sim, 'cultivation')).toBeGreaterThan(0);
    expect(skillOf(sim, 'breeding')).toBe(0);
  });
});

// The Infusion Table (the Glyphwright): the enchanting station. Its entry recipes are
// gated on Cultivation, and its best recipe is gated on Enchanting itself, so working
// the station is what unlocks the station's own top line.
describe('enchanting: the Infusion Table ladder', () => {
  const atTable = (sim: AnySim) => {
    const pid = sim.addPlayer('warrior', 'Binder');
    const npc = [...sim.entities.values()].find(
      (e: Entity) => (e as unknown as { templateId?: string }).templateId === 'glyphwright_orrin',
    ) as Entity;
    const p = sim.entities.get(pid) as Entity;
    p.pos.x = npc.pos.x + 2;
    p.pos.z = npc.pos.z;
    sim.rebucket(p);
    const meta = sim.meta(pid)!;
    meta.copper = 10000;
    sim.addItem('bud_prime', 20, pid);
    sim.addItem('corruption_shard', 20, pid);
    return { pid, meta };
  };
  const world = () => new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true }) as AnySim;

  it('an entry glyph needs Cultivation 10, and crafting it trains Enchanting', () => {
    const sim = world();
    const { pid, meta } = atTable(sim);
    sim.craft('enchant_glyph_of_vigor', pid);
    expect(sim.countItem('resin_glyph_vigor', pid)).toBe(0); // Cultivation 0: gated

    meta.professions.cultivation = 10;
    sim.craft('enchant_glyph_of_vigor', pid);
    expect(sim.countItem('resin_glyph_vigor', pid)).toBe(1);
    expect(meta.professions.enchanting).toBe(PROFESSION_SKILL_PER_GATHER);
    expect(meta.professions.cultivation).toBe(10); // the station trains enchanting, not the gate
  });

  it('the warding glyph is gated on Enchanting itself, so the station unlocks its own top recipe', () => {
    const sim = world();
    const { pid, meta } = atTable(sim);
    meta.professions.cultivation = 10;
    sim.craft('enchant_glyph_of_warding', pid);
    expect(sim.countItem('resin_glyph_warding', pid)).toBe(0); // Enchanting 0: gated

    meta.professions.enchanting = 15;
    sim.craft('enchant_glyph_of_warding', pid);
    expect(sim.countItem('resin_glyph_warding', pid)).toBe(1);
  });

  it('needs the Infusion Table: the same recipe fails at the Alchemy Lab', () => {
    const sim = world();
    const pid = sim.addPlayer('warrior', 'Wanderer');
    const sable = [...sim.entities.values()].find(
      (e: Entity) => (e as unknown as { templateId?: string }).templateId === 'alchemist_sable',
    ) as Entity;
    const p = sim.entities.get(pid) as Entity;
    p.pos.x = sable.pos.x;
    p.pos.z = sable.pos.z;
    sim.rebucket(p);
    const meta = sim.meta(pid)!;
    meta.copper = 10000;
    meta.professions.cultivation = 10;
    sim.addItem('bud_prime', 20, pid);
    sim.addItem('corruption_shard', 20, pid);
    sim.craft('enchant_glyph_of_vigor', pid);
    expect(sim.countItem('resin_glyph_vigor', pid)).toBe(0);
    expect(meta.professions.enchanting).toBe(0);
  });
});
