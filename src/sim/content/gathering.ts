// Resource-gathering nodes: the world-object half of the harvest loop. Each node
// is spawned as a ground object carrying a `harvestNodeId`; walking up and working
// it (a short channel) rolls the node's yield table for an EXISTING crafting
// reagent, then the node depletes and respawns. The reagents feed the existing
// stations (essences + common_seed -> the Grow Station; corruption_shard -> the
// Upgrade Bench), so gathering plugs straight into crafting with NO new items.
//
// No new item entities and no new player strings: a node's nameplate resolves
// through the reagent it grants (objectDisplayName in the renderer), so it reads as
// e.g. "Bloom Essence". The behavior lives in src/sim/harvest.ts behind SimContext.

import type { HarvestNodeDef, HarvestNodeSpawn } from '../types';

export const HARVEST_NODES: Record<string, HarvestNodeDef> = {
  bloom_thicket: {
    id: 'bloom_thicket',
    yields: [
      { itemId: 'bloom_essence', weight: 3 },
      { itemId: 'common_seed', weight: 1 },
    ],
  },
  ember_vent: {
    id: 'ember_vent',
    yields: [
      { itemId: 'ember_essence', weight: 3 },
      { itemId: 'common_seed', weight: 1 },
    ],
  },
  tidepool_spring: {
    id: 'tidepool_spring',
    yields: [
      { itemId: 'flow_essence', weight: 3 },
      { itemId: 'common_seed', weight: 1 },
    ],
  },
  sporebloom: {
    id: 'sporebloom',
    yields: [
      { itemId: 'spore_essence', weight: 3 },
      { itemId: 'common_seed', weight: 1 },
    ],
  },
  // The blight seam is slower to work and slower to return, and yields the
  // Upgrade Bench reagent with an occasional stray essence.
  corrupt_seam: {
    id: 'corrupt_seam',
    castTime: 4,
    respawn: 120,
    yields: [
      { itemId: 'corruption_shard', weight: 3 },
      { itemId: 'ember_essence', weight: 1 },
    ],
  },
};

// Node placements, seeded by biome: Bloomhaven Vale grows bloom/ember essence
// nodes; the Sunken Wastes hold tidepool/spore essence nodes and the blight seams.
// Every position is validated dry, road-clear, and camp-clear at the world seed.
export const HARVEST_NODE_SPAWNS: HarvestNodeSpawn[] = [
  {
    nodeId: 'bloom_thicket',
    itemId: 'bloom_essence',
    name: 'Bloom Thicket',
    positions: [
      { x: -44, z: 118 },
      { x: 52, z: 118 },
      { x: -98, z: 40 },
    ],
  },
  {
    nodeId: 'ember_vent',
    itemId: 'ember_essence',
    name: 'Ember Vent',
    positions: [
      { x: 94, z: 36 },
      { x: -56, z: 120 },
      { x: 64, z: 120 },
    ],
  },
  {
    nodeId: 'tidepool_spring',
    itemId: 'flow_essence',
    name: 'Tidepool Spring',
    positions: [
      { x: -78, z: 224 },
      { x: 36, z: 300 },
      { x: 30, z: 388 },
    ],
  },
  {
    nodeId: 'sporebloom',
    itemId: 'spore_essence',
    name: 'Sporebloom',
    positions: [
      { x: 90, z: 216 },
      { x: -54, z: 332 },
      { x: 78, z: 516 },
    ],
  },
  {
    nodeId: 'corrupt_seam',
    itemId: 'corruption_shard',
    name: 'Corrupt Seam',
    positions: [
      { x: -48, z: 404 },
      { x: -66, z: 456 },
    ],
  },
];
