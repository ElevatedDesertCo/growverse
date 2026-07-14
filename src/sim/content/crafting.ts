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

  // --- Dockside Cook outputs: cooked fish -----------------------------------
  // A cooked fish restores more health than its raw catch AND some mana (the
  // eating slot ticks both foodHp and drinkMana over the sit), so a cooked meal
  // is a real upgrade over eating the raw fish. quality uncommon so they never
  // get swept as junk. Made from the raw fish you catch (FISHING_TABLES).
  cooked_mirror_trout: {
    id: 'cooked_mirror_trout',
    name: 'Grilled Mirror Trout',
    kind: 'food',
    quality: 'uncommon',
    foodHp: 105,
    drinkMana: 40,
    sellValue: 20,
  },
  cooked_river_perch: {
    id: 'cooked_river_perch',
    name: 'Pan-Fried River Perch',
    kind: 'food',
    quality: 'uncommon',
    foodHp: 80,
    drinkMana: 30,
    sellValue: 16,
  },
  cooked_marsh_pike: {
    id: 'cooked_marsh_pike',
    name: 'Roasted Marsh Pike',
    kind: 'food',
    quality: 'uncommon',
    foodHp: 150,
    drinkMana: 55,
    sellValue: 30,
  },
  cooked_bog_eel: {
    id: 'cooked_bog_eel',
    name: 'Smoked Bog Eel',
    kind: 'food',
    quality: 'uncommon',
    foodHp: 150,
    drinkMana: 55,
    sellValue: 30,
  },
  cooked_frostgill_trout: {
    id: 'cooked_frostgill_trout',
    name: 'Grilled Frostgill Trout',
    kind: 'food',
    quality: 'uncommon',
    foodHp: 195,
    drinkMana: 70,
    sellValue: 40,
  },
  cooked_stonescale_carp: {
    id: 'cooked_stonescale_carp',
    name: 'Baked Stonescale Carp',
    kind: 'food',
    quality: 'uncommon',
    foodHp: 195,
    drinkMana: 70,
    sellValue: 40,
  },

  // --- Alchemist outputs: potions + elixir brewed from harvested blooms ------
  // Bloom Extract is pressed from the vale's flower patches (a harvest node); the
  // Alchemist brews it into restorative draughts and a battle elixir. The draughts
  // are instant and share the potion cooldown; the elixir grants a timed buff.
  bloom_extract: {
    id: 'bloom_extract',
    name: 'Bloom Extract',
    kind: 'junk',
    quality: 'common',
    sellValue: 3,
  },
  // Colored petals harvested from the vale's tinted flower patches. Purple petals
  // are the Alchemist's potion reagent; golden petals are pressed into a growth
  // booster at the Grow Station. Each color is its own harvest node (gathering.ts).
  purple_petal: {
    id: 'purple_petal',
    name: 'Purple Petal',
    kind: 'junk',
    quality: 'common',
    sellValue: 3,
  },
  golden_petal: {
    id: 'golden_petal',
    name: 'Golden Petal',
    kind: 'junk',
    quality: 'common',
    sellValue: 3,
  },
  swirling_healing_draught: {
    id: 'swirling_healing_draught',
    name: 'Swirling Healing Draught',
    kind: 'potion',
    quality: 'common',
    potionHp: 90,
    sellValue: 12,
  },
  swirling_mana_draught: {
    id: 'swirling_mana_draught',
    name: 'Swirling Mana Draught',
    kind: 'potion',
    quality: 'common',
    potionMana: 120,
    sellValue: 12,
  },
  elixir_of_the_bloom: {
    id: 'elixir_of_the_bloom',
    name: 'Elixir of the Bloom',
    kind: 'elixir',
    quality: 'uncommon',
    elixir: { aura: 'Blessing of the Bloom', kind: 'buff_int', value: 8, duration: 900 },
    sellValue: 20,
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
    pos: { x: -20, z: -6 },
    facing: Math.PI,
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
  // Dockside Cooks: one at each fishing dock. Each sells the fishing pole and runs
  // the Cookfire (the 'cook' station), so a dock is a full loop: buy a pole, fish
  // the water off the pier, then cook your catch into a hearty meal. Placed on the
  // shore beside each dock (props.docks positions in zone1/zone2).
  cook_ferra: {
    id: 'cook_ferra',
    name: 'Ferra',
    title: 'the Dockside Cook',
    pos: { x: -62, z: 303 },
    facing: -2.0,
    color: 0xc8791e,
    questIds: [],
    vendorItems: ['simple_fishing_pole'],
    crafting: 'cook',
    greeting:
      'Off the pier the pike run deep, $C. Buy a pole, land a few, and I will cook them up hot on the fire.',
  },
  cook_cobb: {
    id: 'cook_cobb',
    name: 'Cobb',
    title: 'the Dockside Cook',
    pos: { x: -79.3, z: 68.2 },
    facing: 0.0,
    color: 0xb5813a,
    questIds: [],
    vendorItems: ['simple_fishing_pole'],
    crafting: 'cook',
    greeting:
      'Mirror Lake gives up a fine trout to a patient line. Grab a pole, and bring the catch back to my fire.',
  },
  // The Alchemist: runs the Alchemy Lab in Bloomhaven, near the Grow Station. Brew
  // Bloom Extract (harvested from vale flower patches) into healing/mana draughts
  // and a battle elixir.
  alchemist_sable: {
    id: 'alchemist_sable',
    name: 'Sable',
    title: 'the Alchemist',
    pos: { x: -24, z: 0 },
    facing: 0,
    color: 0x2f9a7a,
    questIds: [],
    crafting: 'alchemy',
    greeting:
      'Bring me blooms from the vale, $C, and I will draw out their virtue: draughts to mend flesh, to quicken the mind, and an elixir to sharpen your wits.',
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
  // Golden petals (harvested from the vale's golden flower patch) press into a
  // potent growth booster.
  {
    id: 'craft_golden_booster',
    station: 'grow',
    category: 'nutrient',
    inputs: [{ itemId: 'golden_petal', count: 2 }],
    copperCost: 15,
    output: { itemId: 'bloom_nutrient', count: 1 },
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
  // --- Cookfire (Dockside Cook): raw fish -> cooked meal ---------------------
  // One recipe per catchable fish. A few coppers of firewood turns a raw catch
  // into a hearty meal that restores more health and some mana.
  {
    id: 'cook_mirror_trout',
    station: 'cook',
    category: 'food',
    inputs: [{ itemId: 'raw_mirror_trout', count: 1 }],
    copperCost: 5,
    output: { itemId: 'cooked_mirror_trout', count: 1 },
  },
  {
    id: 'cook_river_perch',
    station: 'cook',
    category: 'food',
    inputs: [{ itemId: 'raw_river_perch', count: 1 }],
    copperCost: 5,
    output: { itemId: 'cooked_river_perch', count: 1 },
  },
  {
    id: 'cook_marsh_pike',
    station: 'cook',
    category: 'food',
    inputs: [{ itemId: 'raw_marsh_pike', count: 1 }],
    copperCost: 8,
    requiredLevel: 8,
    output: { itemId: 'cooked_marsh_pike', count: 1 },
  },
  {
    id: 'cook_bog_eel',
    station: 'cook',
    category: 'food',
    inputs: [{ itemId: 'raw_bog_eel', count: 1 }],
    copperCost: 8,
    requiredLevel: 8,
    output: { itemId: 'cooked_bog_eel', count: 1 },
  },
  {
    id: 'cook_frostgill_trout',
    station: 'cook',
    category: 'food',
    inputs: [{ itemId: 'raw_frostgill_trout', count: 1 }],
    copperCost: 12,
    requiredLevel: 15,
    output: { itemId: 'cooked_frostgill_trout', count: 1 },
  },
  {
    id: 'cook_stonescale_carp',
    station: 'cook',
    category: 'food',
    inputs: [{ itemId: 'raw_stonescale_carp', count: 1 }],
    copperCost: 12,
    requiredLevel: 15,
    output: { itemId: 'cooked_stonescale_carp', count: 1 },
  },
  // --- Alchemy Lab (the Alchemist): bloom extract -> potions + elixir --------
  // Blooms harvested from the vale's flower patches, pressed to extract, brewed
  // into restorative draughts and a battle elixir.
  {
    id: 'alchemy_healing_draught',
    station: 'alchemy',
    category: 'consumable',
    inputs: [{ itemId: 'bloom_extract', count: 2 }],
    copperCost: 10,
    output: { itemId: 'swirling_healing_draught', count: 1 },
  },
  {
    id: 'alchemy_mana_draught',
    station: 'alchemy',
    category: 'consumable',
    inputs: [{ itemId: 'bloom_extract', count: 2 }],
    copperCost: 10,
    output: { itemId: 'swirling_mana_draught', count: 1 },
  },
  {
    id: 'alchemy_elixir_of_the_bloom',
    station: 'alchemy',
    category: 'consumable',
    inputs: [{ itemId: 'bloom_extract', count: 4 }],
    copperCost: 40,
    requiredLevel: 5,
    output: { itemId: 'elixir_of_the_bloom', count: 1 },
  },
  // Purple petals (harvested from the vale's purple flower patch) brew straight
  // into restorative draughts, the Alchemist's potion line.
  {
    id: 'alchemy_purple_healing',
    station: 'alchemy',
    category: 'consumable',
    inputs: [{ itemId: 'purple_petal', count: 2 }],
    copperCost: 10,
    output: { itemId: 'swirling_healing_draught', count: 1 },
  },
  {
    id: 'alchemy_purple_mana',
    station: 'alchemy',
    category: 'consumable',
    inputs: [{ itemId: 'purple_petal', count: 2 }],
    copperCost: 10,
    output: { itemId: 'swirling_mana_draught', count: 1 },
  },
];

// Fast lookup by id for the engine (sim/crafting.ts).
export const CRAFT_RECIPES_BY_ID: Record<string, CraftRecipe> = Object.fromEntries(
  CRAFT_RECIPES.map((r) => [r.id, r]),
);
