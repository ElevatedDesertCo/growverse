// Content id-integrity gate. The content tables (src/sim/content/*) reference each
// other by bare string id, and the merge in src/sim/data.ts does NOT check that a
// referenced id actually exists (see src/sim/content/CLAUDE.md: "there's no compile
// check that a loot.itemId exists"). A typo therefore ships silently and only shows
// up as a mob that drops nothing, a quest that can't be turned in, or a camp that
// spawns no mobs. This test walks every cross-reference in the merged flat tables and
// fails on any dangling id, so a bad reference is caught at CI time instead of in game.

import { describe, expect, it } from 'vitest';
import {
  CAMPS,
  CRAFT_RECIPES,
  DUNGEONS,
  FISHING_RARE_ID,
  FISHING_TABLES,
  GROUND_OBJECTS,
  HARVEST_NODE_SPAWNS,
  HARVEST_NODES,
  ITEMS,
  MOBS,
  NPCS,
  QUEST_ORDER,
  QUESTS,
} from '../src/sim/data';

// Non-item object markers a quest/dungeon may reference that are NOT item ids: the
// engine spawns these as special world objects, not from the ITEMS dictionary.
const NON_ITEM_OBJECT_IDS = new Set(['dungeon_door', 'dungeon_exit']);

const hasItem = (id: string | null | undefined): boolean => !!id && !!ITEMS[id];
const hasMob = (id: string): boolean => !!MOBS[id];
const hasNpc = (id: string): boolean => !!NPCS[id];
const hasQuest = (id: string): boolean => !!QUESTS[id];

// Collect [context, badId] pairs so a failure names exactly what is wrong and where.
type Violation = { where: string; id: string };

describe('content id-integrity', () => {
  it('every mob loot entry references a real item', () => {
    const bad: Violation[] = [];
    for (const [mobId, mob] of Object.entries(MOBS)) {
      for (const entry of mob.loot) {
        if (entry.itemId && !hasItem(entry.itemId)) {
          bad.push({ where: `MOBS.${mobId}.loot`, id: entry.itemId });
        }
        if (entry.questId && !hasQuest(entry.questId)) {
          bad.push({ where: `MOBS.${mobId}.loot.questId`, id: entry.questId });
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('every camp spawns a real mob', () => {
    const bad: Violation[] = [];
    for (const camp of CAMPS) {
      if (!hasMob(camp.mobId)) bad.push({ where: 'CAMPS', id: camp.mobId });
    }
    expect(bad).toEqual([]);
  });

  it('every dungeon spawn and object references a real mob/item', () => {
    const bad: Violation[] = [];
    for (const [dunId, dun] of Object.entries(DUNGEONS)) {
      for (const spawn of dun.spawns) {
        if (!hasMob(spawn.mobId)) bad.push({ where: `DUNGEONS.${dunId}.spawns`, id: spawn.mobId });
      }
      for (const obj of dun.objects ?? []) {
        // Objects carrying a templateId (dungeon_door / dungeon_exit) are engine-spawned
        // portals, not item pickups: their itemId is a marker, not an ITEMS id.
        if (obj.templateId || NON_ITEM_OBJECT_IDS.has(obj.itemId)) continue;
        if (!hasItem(obj.itemId)) bad.push({ where: `DUNGEONS.${dunId}.objects`, id: obj.itemId });
      }
    }
    expect(bad).toEqual([]);
  });

  it('every quest references real givers, turn-ins, objectives, prerequisites and rewards', () => {
    const bad: Violation[] = [];
    for (const [qid, q] of Object.entries(QUESTS)) {
      if (!hasNpc(q.giverNpcId)) bad.push({ where: `QUESTS.${qid}.giverNpcId`, id: q.giverNpcId });
      if (!hasNpc(q.turnInNpcId))
        bad.push({ where: `QUESTS.${qid}.turnInNpcId`, id: q.turnInNpcId });
      for (const npcId of q.turnInNpcIds ?? []) {
        if (!hasNpc(npcId)) bad.push({ where: `QUESTS.${qid}.turnInNpcIds`, id: npcId });
      }
      if (q.requiresQuest && !hasQuest(q.requiresQuest)) {
        bad.push({ where: `QUESTS.${qid}.requiresQuest`, id: q.requiresQuest });
      }
      for (const itemId of q.requiredItems ?? []) {
        if (!hasItem(itemId)) bad.push({ where: `QUESTS.${qid}.requiredItems`, id: itemId });
      }
      for (const rewardId of Object.values(q.itemRewards)) {
        if (rewardId && !hasItem(rewardId)) {
          bad.push({ where: `QUESTS.${qid}.itemRewards`, id: rewardId });
        }
      }
      for (const obj of q.objectives) {
        if (obj.targetMobId && !hasMob(obj.targetMobId)) {
          bad.push({ where: `QUESTS.${qid}.objectives.targetMobId`, id: obj.targetMobId });
        }
        if (obj.itemId && !hasItem(obj.itemId)) {
          bad.push({ where: `QUESTS.${qid}.objectives.itemId`, id: obj.itemId });
        }
        if (
          obj.targetObjectItemId &&
          !NON_ITEM_OBJECT_IDS.has(obj.targetObjectItemId) &&
          !hasItem(obj.targetObjectItemId)
        ) {
          bad.push({
            where: `QUESTS.${qid}.objectives.targetObjectItemId`,
            id: obj.targetObjectItemId,
          });
        }
        if (obj.targetNpcId && !hasNpc(obj.targetNpcId)) {
          bad.push({ where: `QUESTS.${qid}.objectives.targetNpcId`, id: obj.targetNpcId });
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('every quest in QUEST_ORDER is a defined quest', () => {
    const bad: Violation[] = [];
    for (const qid of QUEST_ORDER) {
      if (!hasQuest(qid)) bad.push({ where: 'QUEST_ORDER', id: qid });
    }
    // and every defined quest appears in the order (so it is reachable/tracked)
    for (const qid of Object.keys(QUESTS)) {
      if (!QUEST_ORDER.includes(qid))
        bad.push({ where: 'QUESTS (missing from QUEST_ORDER)', id: qid });
    }
    expect(bad).toEqual([]);
  });

  it('every NPC references real quests and vendor items', () => {
    const bad: Violation[] = [];
    for (const [npcId, npc] of Object.entries(NPCS)) {
      for (const qid of npc.questIds) {
        if (!hasQuest(qid)) bad.push({ where: `NPCS.${npcId}.questIds`, id: qid });
      }
      for (const itemId of npc.vendorItems ?? []) {
        if (!hasItem(itemId)) bad.push({ where: `NPCS.${npcId}.vendorItems`, id: itemId });
      }
    }
    expect(bad).toEqual([]);
  });

  it('every ground object references a real item', () => {
    const bad: Violation[] = [];
    for (const obj of GROUND_OBJECTS) {
      if (!hasItem(obj.itemId)) bad.push({ where: 'GROUND_OBJECTS', id: obj.itemId });
    }
    expect(bad).toEqual([]);
  });

  it('every harvest node and placement references real items/nodes', () => {
    const bad: Violation[] = [];
    for (const [nodeId, node] of Object.entries(HARVEST_NODES)) {
      for (const y of node.yields) {
        if (!hasItem(y.itemId)) bad.push({ where: `HARVEST_NODES.${nodeId}.yields`, id: y.itemId });
      }
      if (node.tool && !hasItem(node.tool)) {
        bad.push({ where: `HARVEST_NODES.${nodeId}.tool`, id: node.tool });
      }
    }
    for (const spawn of HARVEST_NODE_SPAWNS) {
      if (!HARVEST_NODES[spawn.nodeId]) {
        bad.push({ where: 'HARVEST_NODE_SPAWNS.nodeId', id: spawn.nodeId });
      }
      if (!hasItem(spawn.itemId))
        bad.push({ where: 'HARVEST_NODE_SPAWNS.itemId', id: spawn.itemId });
    }
    expect(bad).toEqual([]);
  });

  it('every craft recipe references real input and output items', () => {
    const bad: Violation[] = [];
    for (const recipe of CRAFT_RECIPES) {
      for (const input of recipe.inputs) {
        if (!hasItem(input.itemId))
          bad.push({ where: `CRAFT_RECIPES.${recipe.id}.inputs`, id: input.itemId });
      }
      if (!hasItem(recipe.output.itemId)) {
        bad.push({ where: `CRAFT_RECIPES.${recipe.id}.output`, id: recipe.output.itemId });
      }
    }
    expect(bad).toEqual([]);
  });

  it('every fishing catch references a real item', () => {
    const bad: Violation[] = [];
    for (const [zoneId, table] of Object.entries(FISHING_TABLES)) {
      for (const entry of table) {
        // itemId null = a "no catch" slot, which is legitimate.
        if (entry.itemId !== null && !hasItem(entry.itemId)) {
          bad.push({ where: `FISHING_TABLES.${zoneId}`, id: entry.itemId });
        }
      }
    }
    if (!hasItem(FISHING_RARE_ID)) bad.push({ where: 'FISHING_RARE_ID', id: FISHING_RARE_ID });
    expect(bad).toEqual([]);
  });
});
