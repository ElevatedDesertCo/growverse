import { type CraftRecipe, FRESH_HARVEST_WINDOW, type ItemDef, type NpcDef } from '../types';

// How long the diamond wash runs between batches. Named rather than inline so the one
// balance number the prestige tier turns on is visible next to the recipe.
const DIAMOND_PROCESS_SECONDS = 1200;

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
  // --- Gathering-profession crafts (timber -> grow accessory, ore -> gear) ------
  // Built at the Grow Station from Rough Timber (Logging): a wooden trellis the vale
  // growers lean their cannaplants on. A grow accessory alongside the lamp + coil.
  trellis_frame: {
    id: 'trellis_frame',
    name: 'Trellis Frame',
    kind: 'junk',
    quality: 'uncommon',
    sellValue: 38,
  },
  // Cut at the Upgrade Bench from Copper Ore (Mining): light leather gloves reinforced
  // with copper mesh, budgeted like the other generalist Riftforged uncommons.
  coppermesh_gloves: {
    id: 'coppermesh_gloves',
    name: 'Coppermesh Gloves',
    kind: 'armor',
    armorType: 'leather',
    slot: 'gloves',
    quality: 'uncommon',
    stats: { armor: 24, agi: 2 },
    sellValue: 85,
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

  // --- Buds: what a CULTIVATED plant yields (cultivation.ts harvestPlot) ---------
  // Deliberately distinct from Bloom Extract above, which stays the FORAGED material
  // pressed from the vale's flower patches. Splitting them stops a grown harvest and a
  // picked flower being the same tradeable good, which is what let foraging (no seed,
  // no timer, no plot) dominate growing.
  //
  // The grade a harvest yields comes from the strain's expressed POTENCY tier
  // (genetics.ts budGrade). Yield tier still governs QUANTITY and vigor tier still
  // governs grow TIME, so each of the three genetics traits now owns one lever.
  // sellValue is the vendor floor that keeps player market prices off zero; it is set
  // low on purpose so player pricing, not the vendor, sets the interesting range.
  bud_common: {
    id: 'bud_common',
    name: 'Common Bud',
    kind: 'junk',
    quality: 'common',
    sellValue: 4,
  },
  bud_fine: {
    id: 'bud_fine',
    name: 'Fine Bud',
    kind: 'junk',
    quality: 'uncommon',
    sellValue: 9,
  },
  bud_prime: {
    id: 'bud_prime',
    name: 'Prime Bud',
    kind: 'junk',
    quality: 'rare',
    sellValue: 18,
  },
  // The Epic Bud: the breeding input, and the one harvest yield that is NOT a grade of
  // the bulk crop. It does not come from the strain's potency at all; it comes from how
  // well the crop was GROWN (tended, and the grower's mastery of that strain), and a
  // perfect grow guarantees one. That is what ties the breeding economy to grow SKILL
  // instead of grow VOLUME: before this, two Common Buds bought a cross, so anyone who
  // planted enough could breed without ever getting better at growing.
  //
  // Epic quality both for the name colour and so the junk sweep (poor only) never eats
  // one. sellValue is high because it is genuinely scarce, but the real price is set by
  // players on the market: this is the thing a grower who tends well has and a grower
  // who does not has to buy.
  epic_bud: {
    id: 'epic_bud',
    name: 'Epic Bud',
    kind: 'junk',
    quality: 'epic',
    sellValue: 120,
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
  // The Herbalism payoff: a potent healing draught pressed from the vale's blooms,
  // stronger than the common Swirling draught. Unlocked by Herbalism (see recipe).
  verdant_draught: {
    id: 'verdant_draught',
    name: 'Verdant Draught',
    kind: 'potion',
    quality: 'uncommon',
    potionHp: 160,
    sellValue: 18,
  },
  elixir_of_the_bloom: {
    id: 'elixir_of_the_bloom',
    name: 'Elixir of the Bloom',
    kind: 'elixir',
    quality: 'uncommon',
    elixir: { aura: 'Blessing of the Bloom', kind: 'buff_int', value: 8, duration: 900 },
    sellValue: 20,
  },

  // --- Alchemist outputs: Bloom Sessions (the cultivation-to-power buff loop) -----
  // A "Session" is a Bloom tonic brewed from the vale's blooms, drawing out one of
  // three profiles. Sparks (instant) are the everyday buff; the edible lozenge is a
  // slow-release draught that takes hold after a delay but runs longer and stronger.
  // These are the first consumers wiring a harvest into real combat power; when
  // cultivation lands (Phase B), grown strains feed the same tonics. Values fold
  // through the normal elixir/aura path (see src/sim/sessions.ts).
  //
  // Restful (indica-style): stamina to soak hits, with a couch-lock movement tradeoff.
  restful_bloom_tonic: {
    id: 'restful_bloom_tonic',
    name: 'Restful Bloom Tonic',
    kind: 'elixir',
    quality: 'uncommon',
    elixir: { aura: 'Restful Bloom', kind: 'buff_sta', value: 10, duration: 600, couchLock: 0.85 },
    sellValue: 18,
  },
  // Lively (sativa-style): a quicker hand, no tradeoff, but a shorter buzz.
  lively_bloom_tonic: {
    id: 'lively_bloom_tonic',
    name: 'Lively Bloom Tonic',
    kind: 'elixir',
    quality: 'uncommon',
    elixir: { aura: 'Lively Bloom', kind: 'buff_haste', value: 1.12, duration: 300 },
    sellValue: 18,
  },
  // Hybrid: a balanced lift across every attribute.
  balanced_bloom_tonic: {
    id: 'balanced_bloom_tonic',
    name: 'Balanced Bloom Tonic',
    kind: 'elixir',
    quality: 'uncommon',
    elixir: { aura: 'Balanced Bloom', kind: 'buff_allstats', value: 4, duration: 600 },
    sellValue: 22,
  },
  // Edible: a slow-release lozenge. Takes hold after a delay, then runs long and strong.
  slow_bloom_lozenge: {
    id: 'slow_bloom_lozenge',
    name: 'Slow-Bloom Lozenge',
    kind: 'elixir',
    quality: 'rare',
    elixir: {
      aura: 'Slow-Bloom',
      kind: 'buff_allstats',
      value: 7,
      duration: 1200,
      onset: 12,
    },
    sellValue: 45,
  },

  // --- Processed Sessions: the second axis (grade x process) ---------------------
  // The four tonics above are the ENTRY tier: brewed from common buds, differentiated
  // by PROFILE (restful / lively / balanced / edible). The nine outcomes below come
  // from crossing bud GRADE with the PROCESS applied to it, so what you grew and what
  // you did with it both matter:
  //
  //   Cure   - instant, moderate duration, no tradeoff. The dependable session.
  //   Press  - instant, SHORT, strongest per second. A burst before a hard pull.
  //   Infuse - delayed onset, LONGEST, carries couch-lock. Set it up in advance.
  //
  // Each is gated STRUCTURALLY by its input: a prime product cannot be made from
  // anything but prime buds, which means breeding potency to tier 3. No separate
  // level or reputation gate is needed, the genetics are the gate.
  //
  // Values scale from the entry tier's exemplars (balanced tonic: allstats 4 / 600s;
  // slow-bloom lozenge: allstats 7 / 1200s). Press trades duration for magnitude and
  // Infuse trades onset for duration, so no line strictly dominates another.
  // BALANCE: these are first-pass numbers and want a tuning pass against real play.
  cured_flower_fine: {
    id: 'cured_flower_fine',
    name: 'Fine Cured Flower',
    kind: 'elixir',
    quality: 'uncommon',
    elixir: { aura: 'Cured Bloom', kind: 'buff_allstats', value: 6, duration: 600 },
    sellValue: 30,
  },
  cured_flower_prime: {
    id: 'cured_flower_prime',
    name: 'Prime Cured Flower',
    kind: 'elixir',
    quality: 'rare',
    elixir: { aura: 'Cured Bloom', kind: 'buff_allstats', value: 8, duration: 720 },
    sellValue: 60,
  },
  pressed_resin_fine: {
    id: 'pressed_resin_fine',
    name: 'Fine Pressed Resin',
    kind: 'elixir',
    quality: 'uncommon',
    elixir: { aura: 'Pressed Bloom', kind: 'buff_allstats', value: 8, duration: 300 },
    sellValue: 35,
  },
  pressed_resin_prime: {
    id: 'pressed_resin_prime',
    name: 'Prime Pressed Resin',
    kind: 'elixir',
    quality: 'rare',
    elixir: { aura: 'Pressed Bloom', kind: 'buff_allstats', value: 10, duration: 360 },
    sellValue: 70,
  },
  infused_lozenge_fine: {
    id: 'infused_lozenge_fine',
    name: 'Fine Infused Lozenge',
    kind: 'elixir',
    quality: 'uncommon',
    elixir: {
      aura: 'Infused Bloom',
      kind: 'buff_allstats',
      value: 7,
      duration: 1500,
      onset: 12,
      couchLock: 0.9,
    },
    sellValue: 40,
  },
  infused_lozenge_prime: {
    id: 'infused_lozenge_prime',
    name: 'Prime Infused Lozenge',
    kind: 'elixir',
    quality: 'rare',
    elixir: {
      aura: 'Infused Bloom',
      kind: 'buff_allstats',
      value: 9,
      duration: 1800,
      onset: 15,
      couchLock: 0.9,
    },
    sellValue: 80,
  },

  // --- Infusion Table outputs: resin glyphs (the long-duration tier) --------------
  // A glyph is prime flower bound to a Corruption Shard: not smoked, carried. That is
  // what separates Enchanting from Alchemy here. Every session above is a strong buff
  // on a short clock (300-1800s, most under 900), and several carry a couch-lock or
  // an onset delay you have to plan around. A glyph is the opposite trade: a flat
  // 1800s, no tradeoff, no onset, but a narrow single-stat effect rather than the
  // sessions' all-stats sweep. So a glyph is what you carry into a long delve and a
  // session is what you take before a specific pull; neither replaces the other.
  //
  // Cost side: prime buds mean tier-3 potency, which means breeding for it, and
  // Corruption Shards come off delve mobs. So the recipe spans the game's two loops
  // (grow and fight) on purpose, and gives the top harvest grade a use besides sale.
  // BALANCE: first-pass numbers, tuned to sit just under the 1800s gear buffs already
  // in the tables (buff_ap 20-35, buff_armor 70-80) since a glyph is craftable.
  resin_glyph_vigor: {
    id: 'resin_glyph_vigor',
    name: 'Resin Glyph of Vigor',
    kind: 'elixir',
    quality: 'uncommon',
    elixir: { aura: 'Bound Vigor', kind: 'buff_ap', value: 25, duration: 1800 },
    sellValue: 45,
  },
  resin_glyph_focus: {
    id: 'resin_glyph_focus',
    name: 'Resin Glyph of Focus',
    kind: 'elixir',
    quality: 'uncommon',
    elixir: { aura: 'Bound Focus', kind: 'buff_int', value: 7, duration: 1800 },
    sellValue: 45,
  },
  // The deep cut: gated on Enchanting itself, so the station unlocks its own best
  // recipe. Warding is the tanking line, hence the heavier shard cost.
  resin_glyph_warding: {
    id: 'resin_glyph_warding',
    name: 'Resin Glyph of Warding',
    kind: 'elixir',
    quality: 'rare',
    elixir: { aura: 'Bound Warding', kind: 'buff_armor', value: 75, duration: 1800 },
    sellValue: 90,
  },

  // --- Extraction Lab outputs: concentrates (the burst tier) ----------------------
  // The third axis over bud grade and the cure/press/infuse split: extraction METHOD.
  // Where a Session is broad and medium-length and a Glyph is narrow and long, a
  // concentrate is the opposite corner: the highest all-stats numbers in the game on
  // the shortest clocks. You take one for a specific fight, not for an evening.
  //
  // The ladder is ordered by what it asks of the player, not by raw power:
  //   Hash      any buds, no gate.        The floor: turns surplus common flower into
  //                                       something usable and sellable.
  //   Shatter   fine buds + a press,      The workhorse, once you have worked the lab.
  //             Extraction 10.
  //   Live      fine buds, and they must  The freshness window. Best magnitude-to-
  //   Resin     be FRESH off the bed,     duration ratio in the game, and the only
  //             Extraction 20.            recipe that asks you to BE somewhere.
  //   Diamonds  prime buds,               Prestige. Epic quality, the biggest number,
  //             Extraction 40.            the shortest window to spend it in.
  //
  // BALANCE: first-pass numbers anchored on Prime Pressed Resin (allstats 10 / 360s),
  // the strongest burst the Grow Station can make. Everything above it here costs a
  // second station, a skill, and (for two of the four) a real constraint.
  vale_hash: {
    id: 'vale_hash',
    name: 'Vale Hash',
    kind: 'elixir',
    quality: 'uncommon',
    elixir: { aura: 'Hash Haze', kind: 'buff_allstats', value: 6, duration: 300 },
    sellValue: 26,
  },
  golden_shatter: {
    id: 'golden_shatter',
    name: 'Golden Shatter',
    kind: 'elixir',
    quality: 'rare',
    elixir: { aura: 'Shatter Rush', kind: 'buff_allstats', value: 11, duration: 300 },
    sellValue: 65,
  },
  // The freshness payoff: strictly better than shatter, and the only way to get it is
  // to be standing at the lab when a crop comes off the bed.
  live_resin: {
    id: 'live_resin',
    name: 'Live Resin',
    kind: 'elixir',
    quality: 'rare',
    elixir: { aura: 'Living Bloom', kind: 'buff_allstats', value: 12, duration: 420 },
    sellValue: 95,
  },
  bloom_diamonds: {
    id: 'bloom_diamonds',
    name: 'Bloom Diamonds',
    kind: 'elixir',
    quality: 'epic',
    elixir: { aura: 'Diamond Clarity', kind: 'buff_allstats', value: 15, duration: 240 },
    sellValue: 160,
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
    // Stationed at the south entrance of the Baked Beaver farm, facing north up the field
    // of beds (which now expands south toward him as the player levels): the early-game
    // growing hub. He keeps BOTH the Grow Station and the Breeding Chamber, the building
    // immediately behind him (zone1.ts buildings), so the whole grow loop is one place:
    // field in front, chamber behind, him in the doorway. His position is also the
    // proximity anchor that gates crossing (strain_library.ts breedingChamberInRange),
    // so moving him moves the chamber's reach. Kept a couple of yards south of the
    // southmost (fully-unlocked) row of plots and north of the chamber wall (z 48).
    pos: { x: 60, z: 50 },
    facing: 0,
    color: 0x4e9a2f,
    questIds: [
      'q_first_harvest',
      'q_fine_supply',
      'q_prime_order',
      'q_stock_run',
      'q_cuttings_for_the_lodge',
      'q_walk_it_home',
    ],
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
  // The Glyphwright: runs the Infusion Table, a few paces west of the Alchemy Lab so
  // Bloomhaven's west side reads as one craft quarter (Sable brews, Orrin binds). Like
  // Sable and Draxa he IS the station, no building of his own; the Breeding Chamber is
  // the one station that needed to be a place, because crossing is a ceremony.
  glyphwright_orrin: {
    id: 'glyphwright_orrin',
    name: 'Orrin',
    title: 'the Glyphwright',
    // Set far enough from Sable (-24, 0) that one spot cannot reach both stations:
    // the crafting gate is INTERACT_RANGE + 2 = 7yd, and these two sit 9.9yd apart,
    // so each bench is somewhere you walk to. Still inside the town (TOWN_RADIUS 34).
    pos: { x: -28, z: 9 },
    // Faces the plaza: atan2(targetX - x, targetZ - z) toward (0, 0), the same
    // convention the town buildings and Marlow use.
    facing: 1.881,
    color: 0x8a6fd0,
    questIds: [],
    crafting: 'enchant',
    greeting:
      'Any grower can burn their best flower, $C. Bring your prime buds and a shard off the rift and I will bind the two into a glyph that holds for half an hour.',
  },
  // The Extractor: keeps the Extraction Lab on the EAST flank of the garden field,
  // mirroring the Breeding Chamber on the south. Both are places rather than benches,
  // because both are things you make a trip for. Rell stands between the lab wall and
  // the beds, which is also the proximity anchor the extraction recipes gate on; the
  // walk from the northmost bed is a few seconds, which is what makes the live-resin
  // freshness window fair. 14yd east of Marlow (60, 50), so no one spot reaches both
  // the Grow Station and the lab (the gate is INTERACT_RANGE + 2 = 7yd).
  // The Cup Steward: keeps the Vale Cup, the commune's recurring growing competition.
  // Stands at the NORTH end of the garden field, past the last bed row, so the field
  // itself reads as the walk up to the judging table: beds behind you, the board ahead.
  // Far from Marlow (50) and Rell (74, 50) so no one spot reaches two stations at once.
  // Like the crafting attendants he IS the station; the Cup's stage is the field.
  cup_steward_wilder: {
    id: 'cup_steward_wilder',
    name: 'Wilder',
    title: 'Steward of the Vale Cup',
    pos: { x: 60, z: 70 },
    // Faces back down the beds, due south toward the field and the town beyond.
    facing: Math.PI,
    color: 0xc8a24a,
    questIds: [],
    cupSteward: true,
    greeting:
      'The Cup is open, $C. Bring me a strain and ten buds off it and I will put your name on the board. Judged on the genetics, on the grade you bring, and on how well you know the plant. All three, or you are just entering.',
  },
  extractor_rell: {
    id: 'extractor_rell',
    name: 'Rell',
    title: 'the Extractor',
    pos: { x: 74, z: 50 },
    // Faces the beds, due north: atan2(targetX - x, targetZ - z) with the field
    // straight up-field, the same convention Marlow and the town ring use.
    facing: 0,
    color: 0xd08a3a,
    questIds: [],
    crafting: 'extract',
    greeting:
      'Flower is where it starts, $C, not where it ends. Bring me buds and I will wash them down to hash, shatter, or diamonds. Bring them still wet off the bed and we will make something better.',
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
    // The finest base stock is a commune-trust reward: locked until Honored with the
    // Baked Beaver commune, which cultivating and breeding earn (Phase C).
    requiredRep: { factionId: 'baked_beaver', tier: 'honored' },
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
  // --- Gathering-profession crafts: the timber/ore payoff --------------------
  // Logging: a Rough Timber trellis, unlocked once the skill reaches 10 (a few
  // stands' worth of work). Consumes the timber that working the stands grants.
  {
    id: 'craft_trellis_frame',
    station: 'grow',
    category: 'accessory',
    inputs: [{ itemId: 'rough_timber', count: 4 }],
    copperCost: 60,
    output: { itemId: 'trellis_frame', count: 1 },
    requiredProfession: { id: 'logging', skill: 10 },
  },
  // Mining: copper-meshed gloves cut from Copper Ore, unlocked at skill 15. The ore
  // gate is what makes leveling Mining at the veins matter.
  {
    id: 'craft_coppermesh_gloves',
    station: 'upgrade',
    category: 'gear',
    inputs: [{ itemId: 'copper_ore', count: 4 }],
    copperCost: 100,
    output: { itemId: 'coppermesh_gloves', count: 1 },
    requiredProfession: { id: 'mining', skill: 15 },
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
  // Herbalism payoff (parity with the Logging/Mining gates): a stronger heal draught
  // pressed from Purple Petals + Bloom Extract, unlocked at Herbalism 15. Both inputs
  // are herbalism-gathered, so working the flower patches unlocks it.
  {
    id: 'alchemy_verdant_draught',
    station: 'alchemy',
    category: 'consumable',
    inputs: [
      { itemId: 'purple_petal', count: 2 },
      { itemId: 'bloom_extract', count: 2 },
    ],
    copperCost: 45,
    output: { itemId: 'verdant_draught', count: 1 },
    requiredProfession: { id: 'herbalism', skill: 15 },
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
  // --- Alchemy Lab: Bloom Sessions (spark tonics + the edible lozenge) ------------
  {
    id: 'alchemy_restful_bloom_tonic',
    station: 'alchemy',
    category: 'consumable',
    inputs: [{ itemId: 'bud_common', count: 3 }],
    copperCost: 15,
    output: { itemId: 'restful_bloom_tonic', count: 1 },
  },
  {
    id: 'alchemy_lively_bloom_tonic',
    station: 'alchemy',
    category: 'consumable',
    inputs: [{ itemId: 'bud_common', count: 3 }],
    copperCost: 15,
    output: { itemId: 'lively_bloom_tonic', count: 1 },
  },
  {
    id: 'alchemy_balanced_bloom_tonic',
    station: 'alchemy',
    category: 'consumable',
    inputs: [{ itemId: 'bud_common', count: 3 }],
    copperCost: 15,
    output: { itemId: 'balanced_bloom_tonic', count: 1 },
  },
  {
    id: 'alchemy_slow_bloom_lozenge',
    station: 'alchemy',
    category: 'consumable',
    inputs: [{ itemId: 'bud_common', count: 5 }],
    copperCost: 40,
    requiredLevel: 8,
    output: { itemId: 'slow_bloom_lozenge', count: 1 },
  },
  // The graded process line. Each recipe is gated by its INPUT grade: fine products
  // need fine buds, prime products need prime buds, and prime buds only come from a
  // strain bred to potency tier 3. That structural gate is what gives high-grade buds
  // inelastic demand, and therefore a price, on the player market.
  {
    id: 'alchemy_cured_flower_fine',
    station: 'alchemy',
    category: 'consumable',
    inputs: [{ itemId: 'bud_fine', count: 3 }],
    copperCost: 25,
    output: { itemId: 'cured_flower_fine', count: 1 },
  },
  {
    id: 'alchemy_cured_flower_prime',
    station: 'alchemy',
    category: 'consumable',
    inputs: [{ itemId: 'bud_prime', count: 3 }],
    copperCost: 50,
    output: { itemId: 'cured_flower_prime', count: 1 },
  },
  {
    id: 'alchemy_pressed_resin_fine',
    station: 'alchemy',
    category: 'consumable',
    inputs: [{ itemId: 'bud_fine', count: 4 }],
    copperCost: 30,
    output: { itemId: 'pressed_resin_fine', count: 1 },
  },
  {
    id: 'alchemy_pressed_resin_prime',
    station: 'alchemy',
    category: 'consumable',
    inputs: [{ itemId: 'bud_prime', count: 4 }],
    copperCost: 60,
    output: { itemId: 'pressed_resin_prime', count: 1 },
  },
  {
    id: 'alchemy_infused_lozenge_fine',
    station: 'alchemy',
    category: 'consumable',
    inputs: [
      { itemId: 'bud_fine', count: 4 },
      { itemId: 'bloom_essence', count: 1 },
    ],
    copperCost: 45,
    requiredLevel: 8,
    output: { itemId: 'infused_lozenge_fine', count: 1 },
  },
  {
    id: 'alchemy_infused_lozenge_prime',
    station: 'alchemy',
    category: 'consumable',
    inputs: [
      { itemId: 'bud_prime', count: 4 },
      { itemId: 'bloom_essence', count: 2 },
    ],
    copperCost: 90,
    requiredLevel: 8,
    output: { itemId: 'infused_lozenge_prime', count: 1 },
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

  // --- Infusion Table (the Glyphwright): prime buds + shards -> resin glyphs ------
  // Both entry glyphs are gated on Cultivation 10 rather than character level: the
  // reagent already requires tier-3 potency, and the gate says out loud that this
  // station belongs to growers. Vigor and Focus are deliberately the same price, so
  // the choice is which stat your class wants, never which is cheaper.
  {
    id: 'enchant_glyph_of_vigor',
    station: 'enchant',
    category: 'consumable',
    inputs: [
      { itemId: 'bud_prime', count: 2 },
      { itemId: 'corruption_shard', count: 1 },
    ],
    copperCost: 60,
    output: { itemId: 'resin_glyph_vigor', count: 1 },
    requiredProfession: { id: 'cultivation', skill: 10 },
  },
  {
    id: 'enchant_glyph_of_focus',
    station: 'enchant',
    category: 'consumable',
    inputs: [
      { itemId: 'bud_prime', count: 2 },
      { itemId: 'corruption_shard', count: 1 },
    ],
    copperCost: 60,
    output: { itemId: 'resin_glyph_focus', count: 1 },
    requiredProfession: { id: 'cultivation', skill: 10 },
  },
  // Gated on Enchanting itself: the two glyphs above train the skill that opens this
  // one, so the station is a ladder rather than a flat menu.
  {
    id: 'enchant_glyph_of_warding',
    station: 'enchant',
    category: 'consumable',
    inputs: [
      { itemId: 'bud_prime', count: 3 },
      { itemId: 'corruption_shard', count: 2 },
    ],
    copperCost: 120,
    output: { itemId: 'resin_glyph_warding', count: 1 },
    requiredProfession: { id: 'enchanting', skill: 15 },
  },

  // --- Extraction Lab (the Extractor): buds -> concentrates -----------------------
  // Hash is the ungated floor on purpose: a new grower with nothing but common buds can
  // walk in and make something the first time, which is what makes the lab worth
  // finding. Everything above it gates on Extraction, so the lab teaches itself.
  {
    id: 'extract_vale_hash',
    station: 'extract',
    category: 'consumable',
    inputs: [{ itemId: 'bud_common', count: 4 }],
    copperCost: 20,
    output: { itemId: 'vale_hash', count: 1 },
  },
  // Shatter needs a press: the Trellis Frame is the Logging-line grow accessory, so the
  // workhorse concentrate quietly wants a second gathering profession worked.
  {
    id: 'extract_golden_shatter',
    station: 'extract',
    category: 'consumable',
    inputs: [
      { itemId: 'bud_fine', count: 3 },
      { itemId: 'trellis_frame', count: 1 },
    ],
    copperCost: 70,
    output: { itemId: 'golden_shatter', count: 1 },
    requiredProfession: { id: 'extraction', skill: 10 },
  },
  // Live resin: same buds as shatter and NO press, but the harvest must still be wet.
  // Cheaper in materials and better in effect, paid for entirely with presence.
  {
    id: 'extract_live_resin',
    station: 'extract',
    category: 'consumable',
    inputs: [{ itemId: 'bud_fine', count: 3 }],
    copperCost: 70,
    output: { itemId: 'live_resin', count: 1 },
    requiredProfession: { id: 'extraction', skill: 20 },
    requiresFreshHarvest: FRESH_HARVEST_WINDOW,
  },
  {
    id: 'extract_bloom_diamonds',
    station: 'extract',
    category: 'consumable',
    inputs: [{ itemId: 'bud_prime', count: 4 }],
    copperCost: 200,
    output: { itemId: 'bloom_diamonds', count: 1 },
    requiredProfession: { id: 'extraction', skill: 40 },
    // The prestige tier's real cost is TIME on the wash, not reagents. Twenty sim
    // minutes between runs, so diamonds are something you set going and come back to
    // rather than something you spam once the skill gate is behind you.
    processSeconds: DIAMOND_PROCESS_SECONDS,
  },
];

// Fast lookup by id for the engine (sim/crafting.ts).
export const CRAFT_RECIPES_BY_ID: Record<string, CraftRecipe> = Object.fromEntries(
  CRAFT_RECIPES.map((r) => [r.id, r]),
);
