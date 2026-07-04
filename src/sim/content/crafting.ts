import type { CraftRecipe, ItemDef, NpcDef } from '../types';

// ---------------------------------------------------------------------------
// Growverse crafting: two stations, their attendant NPCs, the reagent + output
// items, and the recipes. Pure data-as-code; the engine reads CRAFT_RECIPES in
// sim/crafting.ts and the HUD lists them. Every recipe input is obtainable in the
// world (essences/seeds are sold by the Cultivator; Corruption Shards drop from
// blight-touched mobs, see zone1.ts loot), and every output is a real item.
//
// Design split the player asked for:
//  - Grow Station (Marlow the Cultivator): growing-only. Crafts NUTRIENTS, upgrades
//    SEEDS into stronger strains, and builds grow ACCESSORIES. It is NOT where
//    plants grow, it makes the things growing needs.
//  - Upgrade Bench (Draxa the Riftsmith): reforges weapon/armor GEAR and cuts
//    combat CONSUMABLES from Corruption Shards.
// ---------------------------------------------------------------------------

// Reagents + crafted products + station gear. Merged into the flat ITEMS table by
// data.ts. Materials are quality >= common so the "sell all junk" sweep (poor-only)
// never eats them.
export const CRAFT_ITEMS: Record<string, ItemDef> = {
  // --- Grow reagents (sold by the Cultivator) --------------------------------
  bloom_essence: {
    id: 'bloom_essence',
    name: 'Bloom Essence',
    kind: 'junk',
    quality: 'common',
    sellValue: 3,
    buyValue: 15,
  },
  ember_essence: {
    id: 'ember_essence',
    name: 'Ember Essence',
    kind: 'junk',
    quality: 'common',
    sellValue: 3,
    buyValue: 15,
  },
  flow_essence: {
    id: 'flow_essence',
    name: 'Flow Essence',
    kind: 'junk',
    quality: 'common',
    sellValue: 3,
    buyValue: 15,
  },
  spore_essence: {
    id: 'spore_essence',
    name: 'Spore Essence',
    kind: 'junk',
    quality: 'common',
    sellValue: 4,
    buyValue: 20,
  },
  common_seed: {
    id: 'common_seed',
    name: 'Common Seed',
    kind: 'junk',
    quality: 'common',
    sellValue: 2,
    buyValue: 10,
  },

  // --- Upgrade material (drops from blight-touched mobs) ---------------------
  corruption_shard: {
    id: 'corruption_shard',
    name: 'Corruption Shard',
    kind: 'junk',
    quality: 'uncommon',
    sellValue: 15,
  },

  // --- Grow Station outputs: nutrients ---------------------------------------
  bloom_nutrient: {
    id: 'bloom_nutrient',
    name: 'Bloom Nutrient',
    kind: 'junk',
    quality: 'uncommon',
    sellValue: 12,
  },
  ember_nutrient: {
    id: 'ember_nutrient',
    name: 'Ember Nutrient',
    kind: 'junk',
    quality: 'uncommon',
    sellValue: 12,
  },
  flow_nutrient: {
    id: 'flow_nutrient',
    name: 'Flow Nutrient',
    kind: 'junk',
    quality: 'uncommon',
    sellValue: 12,
  },

  // --- Grow Station outputs: seed strains ------------------------------------
  enriched_seed: {
    id: 'enriched_seed',
    name: 'Enriched Seed',
    kind: 'junk',
    quality: 'uncommon',
    sellValue: 30,
  },
  prime_strain_seed: {
    id: 'prime_strain_seed',
    name: 'Prime Strain Seed',
    kind: 'junk',
    quality: 'rare',
    sellValue: 75,
  },

  // --- Grow Station outputs: accessories -------------------------------------
  bloom_lamp: {
    id: 'bloom_lamp',
    name: 'Bloom Lamp',
    kind: 'junk',
    quality: 'uncommon',
    sellValue: 40,
  },
  irrigation_coil: {
    id: 'irrigation_coil',
    name: 'Irrigation Coil',
    kind: 'junk',
    quality: 'uncommon',
    sellValue: 35,
  },

  // --- Upgrade Bench outputs: consumable + gear ------------------------------
  // A battle elixir cut from Corruption Shards: a temporary attack-power edge.
  shard_whetstone: {
    id: 'shard_whetstone',
    name: 'Shard Whetstone',
    kind: 'elixir',
    quality: 'uncommon',
    elixir: { aura: 'Riftforged Edge', kind: 'buff_ap', value: 20, duration: 600 },
    sellValue: 20,
  },
  // Generalist (no class lock) Riftforged gear, budgeted just under the
  // class-specific uncommon drops (see items.ts militia set) since anyone can use it.
  riftbound_girdle: {
    id: 'riftbound_girdle',
    name: 'Riftbound Girdle',
    kind: 'armor',
    armorType: 'leather',
    slot: 'waist',
    quality: 'uncommon',
    stats: { armor: 30, sta: 2 },
    sellValue: 90,
  },
  riftforged_guard: {
    id: 'riftforged_guard',
    name: 'Riftforged Guard',
    kind: 'armor',
    armorType: 'mail',
    slot: 'chest',
    quality: 'uncommon',
    stats: { armor: 80, sta: 3 },
    sellValue: 150,
  },
  riftforged_blade: {
    id: 'riftforged_blade',
    name: 'Riftforged Blade',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'uncommon',
    weapon: { min: 6, max: 10, speed: 2.3 },
    stats: { str: 2 },
    sellValue: 130,
  },
};

// The reagents the Cultivator sells, so the grow loop is self-contained (buy
// essence -> craft nutrient -> craft strain). Attached to the Cultivator NPC below.
const CULTIVATOR_STOCK = [
  'bloom_essence',
  'ember_essence',
  'flow_essence',
  'spore_essence',
  'common_seed',
];

// The two station attendants. Placed on open ground in Bloomhaven. Merged into
// NPCS by data.ts; NPCs in the table spawn at their pos at world init.
export const CRAFT_NPCS: Record<string, NpcDef> = {
  cultivator_marlow: {
    id: 'cultivator_marlow',
    name: 'Marlow',
    title: 'the Cultivator',
    pos: { x: 6, z: 5 },
    facing: -Math.PI / 2,
    color: 0x4e9a2f,
    questIds: [],
    vendorItems: CULTIVATOR_STOCK,
    crafting: 'grow',
    greeting:
      'The Grow Station is yours to use, friend. Nutrients, seed strains, growing gear. What do the plants need?',
  },
  smith_draxa: {
    id: 'smith_draxa',
    name: 'Draxa',
    title: 'the Riftsmith',
    pos: { x: -14, z: 4 },
    facing: Math.PI / 2,
    color: 0x7a4bc0,
    questIds: [],
    crafting: 'upgrade',
    greeting:
      'The Upgrade Bench runs hot. Bring me Corruption Shards and I will reforge your steel into something the rift cannot break.',
  },
};

// The recipes. Balance lives here, not in engine code.
export const CRAFT_RECIPES: CraftRecipe[] = [
  // --- Grow Station: nutrients (essence -> nutrient) -------------------------
  {
    id: 'craft_bloom_nutrient',
    station: 'grow',
    category: 'nutrient',
    inputs: [{ itemId: 'bloom_essence', count: 2 }],
    copperCost: 15,
    output: { itemId: 'bloom_nutrient', count: 1 },
  },
  {
    id: 'craft_ember_nutrient',
    station: 'grow',
    category: 'nutrient',
    inputs: [{ itemId: 'ember_essence', count: 2 }],
    copperCost: 15,
    output: { itemId: 'ember_nutrient', count: 1 },
  },
  {
    id: 'craft_flow_nutrient',
    station: 'grow',
    category: 'nutrient',
    inputs: [{ itemId: 'flow_essence', count: 2 }],
    copperCost: 15,
    output: { itemId: 'flow_nutrient', count: 1 },
  },
  // --- Grow Station: seed strains --------------------------------------------
  {
    id: 'craft_enriched_seed',
    station: 'grow',
    category: 'seed',
    inputs: [
      { itemId: 'common_seed', count: 1 },
      { itemId: 'bloom_nutrient', count: 1 },
    ],
    copperCost: 40,
    output: { itemId: 'enriched_seed', count: 1 },
  },
  {
    id: 'craft_prime_strain_seed',
    station: 'grow',
    category: 'seed',
    inputs: [
      { itemId: 'enriched_seed', count: 1 },
      { itemId: 'spore_essence', count: 1 },
    ],
    copperCost: 100,
    output: { itemId: 'prime_strain_seed', count: 1 },
  },
  // --- Grow Station: accessories ---------------------------------------------
  {
    id: 'craft_bloom_lamp',
    station: 'grow',
    category: 'accessory',
    inputs: [
      { itemId: 'ember_essence', count: 3 },
      { itemId: 'flow_essence', count: 1 },
    ],
    copperCost: 120,
    output: { itemId: 'bloom_lamp', count: 1 },
  },
  {
    id: 'craft_irrigation_coil',
    station: 'grow',
    category: 'accessory',
    inputs: [
      { itemId: 'flow_essence', count: 3 },
      { itemId: 'common_seed', count: 1 },
    ],
    copperCost: 90,
    output: { itemId: 'irrigation_coil', count: 1 },
  },
  // --- Upgrade Bench: consumable ---------------------------------------------
  {
    id: 'craft_shard_whetstone',
    station: 'upgrade',
    category: 'consumable',
    inputs: [{ itemId: 'corruption_shard', count: 2 }],
    copperCost: 25,
    output: { itemId: 'shard_whetstone', count: 1 },
  },
  // --- Upgrade Bench: gear ---------------------------------------------------
  {
    id: 'craft_riftbound_girdle',
    station: 'upgrade',
    category: 'gear',
    inputs: [{ itemId: 'corruption_shard', count: 3 }],
    copperCost: 120,
    output: { itemId: 'riftbound_girdle', count: 1 },
  },
  {
    id: 'craft_riftforged_guard',
    station: 'upgrade',
    category: 'gear',
    inputs: [{ itemId: 'corruption_shard', count: 5 }],
    copperCost: 220,
    output: { itemId: 'riftforged_guard', count: 1 },
  },
  {
    id: 'craft_riftforged_blade',
    station: 'upgrade',
    category: 'gear',
    // Reforge a worn starter blade plus shards into a real weapon.
    inputs: [
      { itemId: 'corruption_shard', count: 6 },
      { itemId: 'worn_sword', count: 1 },
    ],
    copperCost: 260,
    output: { itemId: 'riftforged_blade', count: 1 },
  },
];

// Fast lookup by id for the engine (sim/crafting.ts).
export const CRAFT_RECIPES_BY_ID: Record<string, CraftRecipe> = Object.fromEntries(
  CRAFT_RECIPES.map((r) => [r.id, r]),
);
