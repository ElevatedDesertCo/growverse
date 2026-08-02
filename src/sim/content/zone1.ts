// Zone 1 - Bloomhaven Vale (levels 1-7). The starter zone: town of Bloomhaven,
// wolves and boars, the bandit camp, and Keeper Aldric's Blight cult chain
// leading to the Hollow Crypt.

import type {
  CampDef,
  GroundObjectDef,
  MobTemplate,
  NpcDef,
  QuestDef,
  ZoneDef,
  ZonePropsDef,
} from '../types';

export const TOWN_RADIUS = 34;
export const GRAVEYARD_POS = { x: -12, z: -22 };
// Basin carved into the heightfield. Pushed to the far northeast so its
// shoreline meets the fishing dock and the murloc camp instead of drowning them.
export const LAKE = { x: -92, z: 88, radius: 30 };
// The Sluice millpond: a broad reservoir carved a short walk northwest of
// Bloomhaven, the water feature the Baked Beaver outpost is built around. It is fed
// from the west by the Sluice river (a carve primitive in world.ts running level to
// the mountain waterfall) and held back on its townward (south) side by The Dam. It
// sits inside the town-plateau blend but the lake-carve runs last in baseHeight, so
// the center still drops below the waterline (a walkable-shore pond, not a drowning
// pit). The outpost sits well clear on the north shore, past the carve's blend edge.
export const SLUICE_POND = { x: 30, z: 28, radius: 16 };

export const ZONE1_ZONE: ZoneDef = {
  id: 'eastbrook_vale',
  name: 'Bloomhaven Vale',
  zMin: -180,
  zMax: 180,
  levelRange: [1, 7],
  biome: 'vale',
  hub: { x: 0, z: 0, radius: TOWN_RADIUS, name: 'Bloomhaven' },
  graveyard: GRAVEYARD_POS,
  lakes: [LAKE, SLUICE_POND],
  pois: [
    { x: 0, z: -3, label: 'Bloomhaven' },
    { x: -2, z: 88, label: 'Coyote Wash' },
    { x: 96, z: -12, label: 'Javelina Flats' },
    { x: -88, z: 82, label: 'Mirror Lake' },
    { x: -60, z: 4, label: 'The Mitewood' },
    { x: -84, z: -64, label: 'The Old Dig' },
    { x: 86, z: -84, label: 'The Dry Camp' },
    { x: 80, z: 80, label: 'The Withered Bloom' },
    { x: -5, z: -52, label: 'Seedvault Hill' },
    { x: 40, z: 140, label: 'Bloomwood Glade' },
    // The Baked Beaver mascot: a giant procedural beaver statue on the north shore
    // of the Sluice millpond, watching over the outpost. `landmark` gives it a
    // minimap pin + world-map glyph on top of the subzone banner. (Index 10 is
    // brand-allowlisted in the i18n completeness test; keep it at this index.)
    { x: 42, z: 54, label: 'Baked Beaver', landmark: true },
    // The Lodge: a forward work-camp of the Baked Beaver colony. A broad millpond
    // held by a log dam on the townward side, fed by a river from the western
    // mountain, with a beaver lodge and two Beaver folk giving newcomers their first
    // trails. `landmark` pins it on the map so a wandering starter finds the
    // community, not just a lone statue.
    { x: 40, z: 50, label: 'The Lodge', landmark: true },
  ],
  welcome: 'Find Marshal Redbrook in town, he has work for you.',
  welcomeQuestId: 'q_wolves',
};

// ---------------------------------------------------------------------------
// Mobs
// ---------------------------------------------------------------------------

export const ZONE1_MOBS: Record<string, MobTemplate> = {
  warlock_imp: {
    id: 'warlock_imp',
    name: 'Fire Demon',
    minLevel: 1,
    maxLevel: 20,
    family: 'demon',
    hpBase: 24,
    hpPerLevel: 11,
    dmgBase: 2,
    dmgPerLevel: 0.7,
    attackSpeed: 2.0,
    armorPerLevel: 5,
    moveSpeed: 8,
    aggroRadius: 0,
    loot: [],
    scale: 0.65,
    color: 0xff5a2e,
    petRole: 'ranged_dps',
    petSpell: { name: 'Firebolt', school: 'fire', min: 8, max: 11, range: 24, every: 2.0 },
  },
  warlock_voidwalker: {
    id: 'warlock_voidwalker',
    name: 'Void Demon',
    minLevel: 10,
    maxLevel: 20,
    family: 'demon',
    hpBase: 95,
    hpPerLevel: 24,
    dmgBase: 3,
    dmgPerLevel: 1.0,
    attackSpeed: 2.4,
    armorPerLevel: 28,
    moveSpeed: 7.2,
    aggroRadius: 0,
    loot: [],
    scale: 0.9,
    color: 0x6b4bb5,
    petRole: 'melee_tank',
  },
  forest_wolf: {
    id: 'forest_wolf',
    name: 'Munchie Coyote',
    minLevel: 1,
    maxLevel: 2,
    family: 'beast',
    hpBase: 28,
    hpPerLevel: 14,
    dmgBase: 3,
    dmgPerLevel: 1.6,
    attackSpeed: 2.0,
    armorPerLevel: 10,
    moveSpeed: 8,
    aggroRadius: 10,
    loot: [
      { copper: 8, chance: 1 },
      { itemId: 'wolf_fang', chance: 0.45 },
      { itemId: 'milepost_boots', chance: 0.1 },
      // Corruption seeps into the pack near the rift: a shard for the Upgrade Bench.
      { itemId: 'corruption_shard', chance: 0.18 },
    ],
    scale: 0.9,
    color: 0x7f8c8d,
    packFrenzy: { radius: 12, hasteMult: 1.3, duration: 8 },
  },
  old_greyjaw: {
    id: 'old_greyjaw',
    name: "Ol' Smoky",
    minLevel: 4,
    maxLevel: 4,
    family: 'beast',
    rare: true,
    hpBase: 110,
    hpPerLevel: 20,
    dmgBase: 5,
    dmgPerLevel: 2.0,
    attackSpeed: 1.8,
    armorPerLevel: 16,
    moveSpeed: 8.5,
    aggroRadius: 12,
    // The old wolf turns savage as the fight wears on: each wound it takes can
    // send it into a blood frenzy, swinging 30% faster for 8s.
    frenzyOnHit: { chance: 0.25, hasteMult: 1.3, duration: 8, name: 'Blood Frenzy' },
    loot: [
      { copper: 60, chance: 1 },
      { itemId: 'greyjaw_fang', chance: 1, questId: 'q_greyjaw' },
      { itemId: 'wolf_fang', chance: 1 },
    ],
    scale: 1.25,
    color: 0x566061,
  },
  wild_boar: {
    id: 'wild_boar',
    name: 'Razorback Javelina',
    minLevel: 2,
    maxLevel: 3,
    family: 'beast',
    hpBase: 34,
    hpPerLevel: 16,
    dmgBase: 4,
    dmgPerLevel: 1.8,
    attackSpeed: 2.2,
    armorPerLevel: 14,
    moveSpeed: 7.5,
    aggroRadius: 9,
    // Stiff bristles prick anyone who melees the boar.
    thorns: { value: 2, name: 'Bristled Hide' },
    loot: [
      { copper: 12, chance: 1 },
      { itemId: 'boar_hide', chance: 0.6, questId: 'q_boars' },
      { itemId: 'tough_jerky', chance: 0.3 },
      { itemId: 'trail_leggings', chance: 0.1 },
    ],
    scale: 0.85,
    color: 0x935116,
  },
  webwood_spider: {
    id: 'webwood_spider',
    name: 'Bloom Mite',
    minLevel: 2,
    maxLevel: 4,
    family: 'spider',
    hpBase: 30,
    hpPerLevel: 15,
    dmgBase: 4,
    dmgPerLevel: 1.7,
    attackSpeed: 1.8,
    armorPerLevel: 8,
    moveSpeed: 8,
    aggroRadius: 10,
    venom: {
      chance: 0.35,
      perTick: 2,
      interval: 2,
      duration: 10,
      name: 'Spore Venom',
      school: 'nature',
    },
    ensnare: { chance: 0.25, duration: 3, name: 'Sticky Web', school: 'nature' },
    loot: [
      { copper: 14, chance: 1 },
      { itemId: 'webwood_silk', chance: 0.55, questId: 'q_spiders' },
      { itemId: 'spider_leg', chance: 0.4 },
    ],
    scale: 0.9,
    color: 0x4a235a,
  },
  mogger: {
    id: 'mogger',
    name: 'Grulmaw the Rift-Gorged',
    minLevel: 6,
    maxLevel: 6,
    family: 'humanoid',
    rare: true,
    elite: true,
    canSwim: true,
    ccImmune: true,
    respawnMult: 4,
    hpBase: 300,
    hpPerLevel: 58,
    dmgBase: 12,
    dmgPerLevel: 3.5,
    attackSpeed: 2.2,
    armorPerLevel: 34,
    moveSpeed: 7.4,
    aggroRadius: 14,
    aoePulse: { min: 14, max: 20, radius: 8, every: 10, name: 'Ground Pound', school: 'physical' },
    summonAdds: { mobId: 'mogger_lackey', count: 2, atHpPct: [0.7] },
    enrage: { belowHpPct: 0.3, dmgMult: 1.6, hasteMult: 1.3 },
    wardAllies: {
      radius: 12,
      every: 12,
      amount: 70,
      duration: 8,
      name: 'Bracing Order',
      school: 'physical',
    },
    loot: [
      { copper: 180, chance: 1 },
      { itemId: 'linen_scrap', chance: 1 },
      { itemId: 'moggers_stomper_boots', chance: 0.3 },
      { itemId: 'moggers_shiv', chance: 0.25, rollGroup: 'mogger_chase' },
      { itemId: 'cryptstalker_jerkin', chance: 0.25, rollGroup: 'mogger_chase' },
    ],
    scale: 1.28,
    color: 0x8e5b33,
  },
  mogger_lackey: {
    id: 'mogger_lackey',
    name: 'Rift-Gorged Whelp',
    minLevel: 5,
    maxLevel: 6,
    family: 'humanoid',
    hpBase: 44,
    hpPerLevel: 18,
    dmgBase: 6,
    dmgPerLevel: 2.0,
    attackSpeed: 2.0,
    armorPerLevel: 18,
    moveSpeed: 7.5,
    aggroRadius: 12,
    stunOnHit: { chance: 0.12, duration: 1, name: 'Skullthump', school: 'physical' },
    loot: [],
    scale: 0.95,
    color: 0x7b4b2b,
  },
  mudfin_murloc: {
    id: 'mudfin_murloc',
    name: 'Reservoir Snapper',
    minLevel: 3,
    maxLevel: 5,
    family: 'murloc',
    hpBase: 36,
    hpPerLevel: 17,
    dmgBase: 5,
    dmgPerLevel: 1.9,
    attackSpeed: 1.9,
    armorPerLevel: 12,
    moveSpeed: 8,
    aggroRadius: 13, // murlocs aggro from far and bring friends
    loot: [
      { copper: 18, chance: 1 },
      { itemId: 'mudfin_scale', chance: 0.5 },
      { itemId: 'linen_scrap', chance: 0.2 },
    ],
    scale: 0.8,
    color: 0x52be80,
    // Silt Hex: the Siltling's oracle-chant briefly turns a foe into a critter.
    // Low chance and it breaks the instant the victim takes damage (the murloc's
    // own next bite ends it), so it's a brief flavor incap, but a murloc pack
    // can chain it just long enough to make a careless pull dangerous.
    polymorphHex: { chance: 0.12, duration: 4, name: 'Silt Hex', school: 'nature' },
  },
  tunnel_rat: {
    id: 'tunnel_rat',
    name: 'Trimmer Gremlin',
    minLevel: 4,
    maxLevel: 6,
    family: 'kobold',
    hpBase: 42,
    hpPerLevel: 18,
    dmgBase: 6,
    dmgPerLevel: 2.0,
    attackSpeed: 2.1,
    armorPerLevel: 16,
    moveSpeed: 7,
    aggroRadius: 10,
    loot: [
      { copper: 22, chance: 1 },
      { itemId: 'tallow_candle', chance: 0.6 },
      { itemId: 'blessed_wax', chance: 0.45, questId: 'q_rite' },
      { itemId: 'linen_scrap', chance: 0.25 },
      { itemId: 'mossy_handwraps', chance: 0.15 },
    ],
    scale: 0.85,
    color: 0x9c640c,
  },
  grix_the_tunnelking: {
    id: 'grix_the_tunnelking',
    name: 'Grix the Burrow King',
    minLevel: 7,
    maxLevel: 7,
    family: 'kobold',
    rare: true,
    elite: true,
    canSwim: true,
    ccImmune: true,
    respawnMult: 432,
    hpBase: 280,
    hpPerLevel: 52,
    dmgBase: 11,
    dmgPerLevel: 3.3,
    attackSpeed: 2.0,
    armorPerLevel: 24,
    moveSpeed: 7,
    aggroRadius: 13,
    aoePulse: { min: 12, max: 18, radius: 8, every: 9, name: 'Cave-In', school: 'physical' },
    summonAdds: { mobId: 'tunnel_rat', count: 2, atHpPct: [0.55, 0.3] },
    enrage: { belowHpPct: 0.3, dmgMult: 1.4, hasteMult: 1.3 },
    loot: [
      { copper: 150, chance: 1 },
      { itemId: 'tallow_candle', chance: 1 },
      // The hoarder's stash — a guaranteed step up the potion ladder this early.
      { itemId: 'lesser_healing_potion', chance: 1 },
      { itemId: 'tunnelkings_spade', chance: 0.3 },
      { itemId: 'moggers_copper_cudgel', chance: 0.25, rollGroup: 'grix_tunnelking_chase' },
      { itemId: 'hollowbone_hauberk', chance: 0.25, rollGroup: 'grix_tunnelking_chase' },
    ],
    scale: 1.15,
    color: 0xb9770e,
  },
  vale_bandit: {
    id: 'vale_bandit',
    name: 'Dust Raider',
    minLevel: 3,
    maxLevel: 5,
    family: 'humanoid',
    hpBase: 40,
    hpPerLevel: 18,
    dmgBase: 5,
    dmgPerLevel: 2.0,
    attackSpeed: 2.0,
    armorPerLevel: 20,
    moveSpeed: 7,
    aggroRadius: 11,
    loot: [
      { copper: 25, chance: 1 },
      { itemId: 'bandit_bandana', chance: 0.5 },
      { itemId: 'linen_scrap', chance: 0.3 },
    ],
    scale: 1.0,
    color: 0x943126,
    // A practiced thug flings a handful of road grit to foul your aim.
    blind: { chance: 0.25, miss: 0.3, duration: 5, name: 'Blinding Powder', school: 'physical' },
  },
  dust_reaver: {
    id: 'dust_reaver',
    name: 'Dust Reaver',
    minLevel: 4,
    maxLevel: 5,
    family: 'humanoid',
    hpBase: 56,
    hpPerLevel: 20,
    dmgBase: 7,
    dmgPerLevel: 2.3,
    attackSpeed: 2.4,
    armorPerLevel: 22,
    moveSpeed: 7,
    aggroRadius: 12,
    scale: 1.08,
    color: 0x6e3b2f,
    // The rift-taint boils over: each wound it takes can send the reaver into a
    // Corruption-fueled fury, swinging faster for a spell.
    frenzyOnHit: { chance: 0.2, hasteMult: 1.3, duration: 6, name: 'Rift Fury' },
    loot: [
      { copper: 28, chance: 1 },
      { itemId: 'bandit_bandana', chance: 0.5 },
      { itemId: 'linen_scrap', chance: 0.3 },
      // Corruption tie-in: the tainted raiders shed shards for the Upgrade Bench.
      { itemId: 'corruption_shard', chance: 0.15 },
    ],
  },
  dust_slinger: {
    id: 'dust_slinger',
    name: 'Dust Slinger',
    minLevel: 3,
    maxLevel: 4,
    family: 'humanoid',
    hpBase: 38,
    hpPerLevel: 17,
    dmgBase: 5,
    dmgPerLevel: 1.9,
    attackSpeed: 2.0,
    armorPerLevel: 16,
    moveSpeed: 7.5,
    aggroRadius: 13, // skirmishers open from range and call the camp in
    scale: 0.98,
    color: 0xb08a3c,
    // Bolts dipped in rift-ichor: a landed shot festers a creeping shadow rot.
    soulrot: { chance: 0.22, perTick: 3, interval: 3, duration: 9, name: 'Tainted Bolt' },
    loot: [
      { copper: 24, chance: 1 },
      { itemId: 'bandit_bandana', chance: 0.5 },
      { itemId: 'linen_scrap', chance: 0.3 },
    ],
  },
  restless_bones: {
    id: 'restless_bones',
    name: 'Wither Husk',
    minLevel: 5,
    maxLevel: 7,
    family: 'undead',
    hpBase: 46,
    hpPerLevel: 19,
    dmgBase: 7,
    dmgPerLevel: 2.1,
    attackSpeed: 2.3,
    armorPerLevel: 14,
    moveSpeed: 6.5,
    aggroRadius: 11,
    loot: [
      { copper: 30, chance: 1 },
      { itemId: 'bone_fragments', chance: 0.6 },
      { itemId: 'ghostly_essence', chance: 0.55, questId: 'q_rite' },
      // Corruption-riddled husks shed shards for the Upgrade Bench.
      { itemId: 'corruption_shard', chance: 0.3 },
    ],
    scale: 1.0,
    color: 0xd5dbdb,
    // A grave-cold wail saps the strength from the living it strikes.
    demoralize: { ap: 20, duration: 8, name: 'Withering Wail' },
    // Grave-touch: a clawing swing may fester a creeping necrotic rot (shadow DoT).
    soulrot: { chance: 0.25, perTick: 4, interval: 3, duration: 12, name: 'Soulrot' },
  },
  captain_verlan: {
    // A rare named undead champion risen among the ruins' Restless Bones —
    // the undead family's rare elite, filling the gap beside Old Greyjaw
    // (beast), Elder Bristleback (beast), Sableweb Matriarch (spider) and
    // Grulmaw the Rift-Gorged (humanoid). A heavy, slow striker that erupts in a shadow nova
    // and goes berserk when low; loot mirrors the other rare elites.
    id: 'captain_verlan',
    name: 'Husk-Captain Verlan',
    minLevel: 7,
    maxLevel: 7,
    family: 'undead',
    rare: true,
    elite: true,
    ccImmune: true,
    respawnMult: 7.2,
    hpBase: 280,
    hpPerLevel: 56,
    dmgBase: 12,
    dmgPerLevel: 3.4,
    attackSpeed: 2.6,
    armorPerLevel: 32,
    moveSpeed: 7.4,
    aggroRadius: 13,
    aoePulse: {
      min: 13,
      max: 19,
      radius: 9,
      every: 9,
      name: 'Hollow Nova',
      school: 'shadow',
      fx: 'nova',
    },
    enrage: { belowHpPct: 0.3, dmgMult: 1.5, hasteMult: 1.3 },
    loot: [
      { copper: 160, chance: 1 },
      { itemId: 'bone_fragments', chance: 1 },
      { itemId: 'oathbound_greaves', chance: 0.3 },
      { itemId: 'verlans_oathblade', chance: 0.25, rollGroup: 'verlan_chase' },
      { itemId: 'hollow_vigil_staff', chance: 0.25, rollGroup: 'verlan_chase' },
      { itemId: 'gravewardens_shiv', chance: 0.25, rollGroup: 'verlan_chase' },
    ],
    scale: 1.26,
    color: 0x3b4a5a,
  },
  wraithbinder_maldrec: {
    id: 'wraithbinder_maldrec',
    name: 'Blightbinder Maldrec',
    minLevel: 7,
    maxLevel: 7,
    family: 'undead',
    rare: true,
    elite: true,
    ccImmune: true,
    respawnMult: 432,
    hpBase: 320,
    hpPerLevel: 60,
    dmgBase: 12,
    dmgPerLevel: 3.4,
    attackSpeed: 2.3,
    armorPerLevel: 28,
    moveSpeed: 6.8,
    aggroRadius: 13,
    // A fallen Gravecaller who bound his own soul to the chapel dead. A pulse of
    // grave-cold shadow rolls off him, and he tears the restless bones from the
    // ground to fight at his side, growing frantic as he is unmade.
    aoePulse: { min: 13, max: 19, radius: 9, every: 9, name: 'Grave Chill', school: 'shadow' },
    summonAdds: { mobId: 'restless_bones', count: 2, atHpPct: [0.65, 0.35] },
    enrage: { belowHpPct: 0.3, dmgMult: 1.5, hasteMult: 1.3 },
    loot: [
      { copper: 160, chance: 1 },
      { itemId: 'bone_fragments', chance: 1 },
      { itemId: 'maldrecs_soulbinder', chance: 0.25 },
      { itemId: 'hollowbone_hauberk', chance: 0.25, rollGroup: 'maldrec_chase' },
      { itemId: 'gravewoven_raiment', chance: 0.25, rollGroup: 'maldrec_chase' },
      { itemId: 'cryptstalker_jerkin', chance: 0.25, rollGroup: 'maldrec_chase' },
    ],
    scale: 1.22,
    color: 0x6f7f8f,
  },
  gorrak: {
    id: 'gorrak',
    name: 'Sarn the Hollowed',
    minLevel: 6,
    maxLevel: 6,
    family: 'humanoid',
    hpBase: 160,
    hpPerLevel: 30,
    dmgBase: 8,
    dmgPerLevel: 2.4,
    attackSpeed: 2.4,
    armorPerLevel: 30,
    moveSpeed: 7,
    aggroRadius: 13,
    boss: true,
    loot: [
      { copper: 250, chance: 1 },
      { itemId: 'bandit_bandana', chance: 1 },
      { itemId: 'oiled_boots', chance: 0.5 },
      { itemId: 'quilted_trousers', chance: 0.5 },
      { itemId: 'gorraks_cruel_chopper', chance: 0.25 },
      { itemId: 'gorraks_cleaver', chance: 0.3 },
    ],
    scale: 1.25,
    color: 0x6c3483,
  },
};

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------

export const ZONE1_NPCS: Record<string, NpcDef> = {
  the_merchant: {
    id: 'the_merchant',
    name: 'The Broker',
    title: 'Keeper of the World Market',
    // beside his World Market stall on the west of the plaza, off the north lane,
    // facing the approaching customers
    pos: { x: -3, z: 5 },
    facing: Math.PI,
    color: 0xd4af37,
    questIds: [],
    market: true,
    greeting:
      'Welcome to the World Market, $C. Buy from every adventurer in the realm — or set out your own wares and let coin find you.',
  },
  marshal_redbrook: {
    id: 'marshal_redbrook',
    name: 'Marshal Redbrook',
    title: 'Marshal of Bloomhaven',
    // his own post at the NE guard house, out of the plaza center, watching
    // over the town (faces S down the plaza)
    pos: { x: 11, z: 8 },
    facing: Math.PI,
    color: 0xb7950b,
    questIds: ['q_wolves', 'q_greyjaw', 'q_bandits', 'q_ringleader', 'q_mogger'],
    greeting:
      'Keep your blade close, $C. The Dry is creeping in off the flats, and it is hollowing men into worse things.',
  },
  trader_wilkes: {
    id: 'trader_wilkes',
    name: 'Provisioner Wilkes',
    title: 'Provisioner',
    pos: { x: -8.5, z: -0.5 },
    facing: Math.PI / 2,
    color: 0x1e8449,
    questIds: ['q_boars', 'q_supplies'],
    vendorItems: [
      'baked_bread',
      'spring_water',
      'roasted_boar',
      'tough_jerky',
      'minor_healing_potion',
      'minor_mana_potion',
    ],
    greeting: 'Fresh bread, clean water, fair prices. What can I get you?',
  },
  apothecary_lin: {
    id: 'apothecary_lin',
    name: 'Herbalist Lin',
    title: 'Bloom Herbalist',
    // drawn in close to the eastern house at her back
    pos: { x: 15.5, z: -4.8 },
    facing: -Math.PI / 2,
    color: 0x7d3c98,
    questIds: ['q_spiders'],
    greeting: 'Careful where you step in the eastern woods, friend.',
  },
  brother_aldric: {
    id: 'brother_aldric',
    name: 'Keeper Aldric',
    title: 'Keeper of the Bloom',
    // tends the churchyard graves in the solemn south, beside the chapel
    pos: { x: -11, z: -15 },
    facing: 0.8,
    color: 0xf7f9f9,
    questIds: [
      'q_bones',
      'q_whispers',
      'q_names_of_the_dead',
      'q_silence_the_call',
      'q_rite',
      'q_sexton',
      'q_hollow',
      'q_gravecallers_trail',
      'q_fenbridge_muster',
    ],
    greeting: 'The Bloom keep you. Even the dead find no rest here of late.',
  },
  smith_haldren: {
    id: 'smith_haldren',
    name: 'Smith Haldren',
    title: 'Armorer & Weaponsmith',
    pos: { x: 7, z: 16.5 },
    facing: -2.7,
    color: 0x707b7c,
    questIds: [],
    vendorItems: [
      'eastbrook_arming_sword',
      'bronzework_mace',
      'vale_carving_knife',
      'hickory_shortstaff',
      'eastbrook_chain_vest',
      'valespun_robe',
      'tanned_leather_jerkin',
      'hobnail_boots',
      'eastbrook_wool_trousers',
    ],
    greeting: 'Mind the sparks, $C. Good steel is the difference between a scar and a grave.',
  },
  fisherman_brandt: {
    id: 'fisherman_brandt',
    name: 'Netcaster Brandt',
    title: 'Old Salt',
    // town northwest corner, glaring out toward distant Mirror Lake. His prior
    // spot (-16,6) sat inside Riftsmith Draxa's forge-prop collider, so findSafePos
    // shoved him right on top of Draxa (0.85yd), twin NPCs stuck together. This
    // dry, unblocked spot keeps ~7yd of clearance from Draxa's station.
    pos: { x: -19, z: 9 },
    facing: -0.75,
    color: 0x2471a3,
    questIds: ['q_murlocs'],
    vendorItems: ['simple_fishing_pole'],
    greeting: 'Grlsnapgrl, sorry, been listening to those reservoir snappers too long.',
  },
  foreman_odell: {
    id: 'foreman_odell',
    name: 'Foreman Odell',
    title: 'Dig Foreman',
    // posted by his dwelling on the town's south flank, turned to glare back
    // north at the town cookfire while his dig stays overrun
    pos: { x: 3.5, z: -15 },
    facing: -0.05,
    color: 0xa04000,
    questIds: ['q_mine'],
    greeting: "Whole dig's crawling with those candle-headed vermin!",
  },
  // The Lodge outpost, on the north shore of the beaver millpond, clear of town
  // and the river. Two galaxy-blue Baked Beaver folk, a forward crew of the colony
  // that holds The Dam far to the south. They give a wandering newcomer their first
  // trails and the outpost's keepsake. Same blues as the zone4 Beavers, same
  // "Stay Baked, AZ" colony.
  rowan_sawtooth: {
    id: 'rowan_sawtooth',
    name: 'Rowan Sawtooth',
    title: 'Lodge Warden',
    // by the lodge hearth on the north shore, facing south across the pond
    pos: { x: 30, z: 54 },
    facing: 3.1,
    color: 0x4a7ebb,
    questIds: ['q_sluice_welcome', 'q_sluice_pilings'],
    greeting:
      "New face on the shore, $C. Welcome to the Lodge, the colony's forward camp. The Dam proper is a long haul south, but the work starts right here. Stay Baked, and mind the water.",
  },
  hazel_timbers: {
    id: 'hazel_timbers',
    name: 'Hazel Timbers',
    title: 'Dam Quartermaster',
    // on the shore by the millpond dock landing, facing east along the water
    // (east is -x in this world, so facing -PI/2; see the layout note below)
    pos: { x: 48, z: 47 },
    facing: -Math.PI / 2,
    color: 0x6fa8dc,
    questIds: [],
    vendorItems: [
      'simple_fishing_pole',
      'baked_bread',
      'spring_water',
      'roasted_boar',
      'minor_healing_potion',
      'minor_mana_potion',
    ],
    greeting:
      'Tools, tack, and trail food, all fair-priced for a newcomer. A beaver runs a tight camp, $C. What do you need?',
  },
  banker_thistle: {
    id: 'banker_thistle',
    name: 'Vault Keeper Thistle',
    title: 'Bloomhaven Banker',
    // beside the strongbox on the east side of the plaza, across the lane from
    // the World Market stall, facing the customers who cross from town center
    pos: { x: 3, z: 7 },
    facing: -2.4,
    color: 0x9a7d0a,
    questIds: [],
    stash: true,
    greeting:
      'Your coin and your keepsakes are safe in the vault, $C. Deposit what you cannot carry and draw it back whenever you pass through.',
  },
};

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export const ZONE1_QUESTS: Record<string, QuestDef> = {
  q_wolves: {
    id: 'q_wolves',
    name: 'Munchie Coyotes',
    giverNpcId: 'marshal_redbrook',
    turnInNpcId: 'marshal_redbrook',
    text: "The coyotes have gone bold, sniffing out the commune's snack stash and dragging off whole crates of munchies. Thin them out, $N. Run off 8 Munchie Coyotes up in Coyote Wash and Bloomhaven can eat in peace.",
    completionText: 'Fine work. The snack shed can breathe easy again.',
    objectives: [
      { type: 'kill', targetMobId: 'forest_wolf', count: 8, label: 'Munchie Coyote driven off' },
    ],
    xpReward: 250,
    copperReward: 75,
    itemRewards: {},
  },
  q_greyjaw: {
    id: 'q_greyjaw',
    name: "Ol' Smoky",
    giverNpcId: 'marshal_redbrook',
    turnInNpcId: 'marshal_redbrook',
    text: "There is one coyote no trap has ever held: Ol' Smoky. He has made off with three good hounds and a whole season's worth of edibles. He prowls the deep brush north of Coyote Wash. Bring me his fang.",
    completionText:
      'So the old ghost is finally down. The whole commune sleeps easier tonight, and so do I.',
    objectives: [{ type: 'collect', itemId: 'greyjaw_fang', count: 1, label: "Ol' Smoky's Fang" }],
    xpReward: 450,
    copperReward: 150,
    itemRewards: {
      warrior: 'greyjaw_pelt_cloak',
      mage: 'greyjaw_pelt_cloak',
      rogue: 'greyjaw_pelt_cloak',
    },
    requiresQuest: 'q_wolves',
  },
  q_boars: {
    id: 'q_boars',
    name: 'Javelina Trouble',
    giverNpcId: 'trader_wilkes',
    turnInNpcId: 'trader_wilkes',
    text: 'The javelinas are tearing through the garden rows out on Javelina Flats again, and their hides make the toughest travel packs going. Bring me 5 Razorback Javelina Hides and I will make it worth your time.',
    completionText: 'Ah, good thick hides! These will cure up nicely.',
    objectives: [
      { type: 'collect', itemId: 'boar_hide', count: 5, label: 'Razorback Javelina Hide' },
    ],
    xpReward: 350,
    copperReward: 120,
    itemRewards: {},
  },
  q_spiders: {
    id: 'q_spiders',
    name: 'Mites!',
    giverNpcId: 'apothecary_lin',
    turnInNpcId: 'apothecary_lin',
    text: 'Bloom Mites are breeding in the Mitewood, and if they reach the gardens they will strip a whole crop down to stems. Cull 6 of them and cut 4 webbing glands, I use the silk in my extractions.',
    completionText: "Ugh, still twitching. Perfect. Here, you've earned this.",
    objectives: [
      { type: 'kill', targetMobId: 'webwood_spider', count: 6, label: 'Bloom Mite culled' },
      { type: 'collect', itemId: 'webwood_silk', count: 4, label: 'Mite Silk Gland' },
    ],
    xpReward: 420,
    copperReward: 140,
    itemRewards: {},
    minLevel: 2,
  },
  q_murlocs: {
    id: 'q_murlocs',
    name: 'Snappers in the Shallows',
    giverNpcId: 'fisherman_brandt',
    turnInNpcId: 'fisherman_brandt',
    text: 'Twenty years I have fished Mirror Lake and never lost a net, until those Reservoir Snappers started crawling out of the shallows and chewing clean through my lines. Drive 8 of them back. And watch yourself: where there is one snapper, there is a whole clatter of them.',
    completionText: 'Hah! That will teach them to mind their own mudholes.',
    objectives: [
      { type: 'kill', targetMobId: 'mudfin_murloc', count: 8, label: 'Reservoir Snapper slain' },
    ],
    xpReward: 520,
    copperReward: 180,
    itemRewards: {},
    minLevel: 3,
  },
  q_mine: {
    id: 'q_mine',
    name: 'Squatters in the Old Dig',
    giverNpcId: 'foreman_odell',
    turnInNpcId: 'foreman_odell',
    text: 'We reopened the Old Dig and a nest of Trimmer Gremlins had already holed up inside, making off with cured Bloom by the sackful. My crew will not set foot down there until it is cleared. Put down 10 Trimmer Gremlins.',
    completionText: 'Ha! Back to work, crew! You have my thanks, and my coin.',
    objectives: [
      { type: 'kill', targetMobId: 'tunnel_rat', count: 10, label: 'Trimmer Gremlin slain' },
    ],
    xpReward: 620,
    copperReward: 220,
    itemRewards: {},
    minLevel: 4,
  },
  q_bones: {
    id: 'q_bones',
    name: 'The Restless Dead',
    giverNpcId: 'brother_aldric',
    turnInNpcId: 'brother_aldric',
    text: 'The old ruin on the northwest hill was a chapel once, and its yard a resting place. Something has stirred the dead from their sleep. Grant them peace, $N, return 8 Wither Husks to the earth.',
    completionText: 'May they rest now, and may the Bloom forgive whatever woke them.',
    objectives: [
      {
        type: 'kill',
        targetMobId: 'restless_bones',
        count: 8,
        label: 'Wither Husk laid to rest',
      },
    ],
    xpReward: 700,
    copperReward: 260,
    itemRewards: {},
    minLevel: 5,
  },
  q_supplies: {
    id: 'q_supplies',
    name: 'Stolen Supplies',
    giverNpcId: 'trader_wilkes',
    turnInNpcId: 'trader_wilkes',
    text: 'The Ashen Maw raiders hit my last wagon and made off with four crates of goods: tools, salt, good Bloomhaven linen. The crates are stacked around their camp in the southeast hills. Steal them back for me, would you?',
    completionText: 'My crates! Barely a scratch on them. You are a wonder.',
    objectives: [
      { type: 'collect', itemId: 'supply_crate', count: 4, label: 'Stolen Supply Crate' },
    ],
    xpReward: 550,
    copperReward: 250,
    itemRewards: {},
    minLevel: 3,
  },
  q_whispers: {
    id: 'q_whispers',
    name: 'Whispers Below',
    giverNpcId: 'brother_aldric',
    turnInNpcId: 'brother_aldric',
    text: 'You have laid the dead to rest, but they will not stay resting — something calls them back. Search the chapel ruin for any trace of the one doing the calling. If you find a sigil or seal, bring it to me untouched.',
    completionText:
      'This sigil... it bears the mark of the Blightcallers, a sect I had prayed was extinct. This is worse than I feared, $N.',
    objectives: [
      { type: 'collect', itemId: 'gravecaller_sigil', count: 1, label: "Blightcaller's Sigil" },
    ],
    xpReward: 400,
    copperReward: 150,
    itemRewards: {},
    requiresQuest: 'q_bones',
  },
  q_names_of_the_dead: {
    id: 'q_names_of_the_dead',
    name: 'The Names of the Dead',
    giverNpcId: 'brother_aldric',
    turnInNpcId: 'brother_aldric',
    text: 'If the Blightcallers raised our dead, I must know whose graves they robbed. The chapel sexton kept a burial ledger, and the wind has scattered its pages across the chapel yard. Gather 3 of them for me, $N, the dead deserve to be called by their names.',
    completionText:
      "These poor souls... and look here. Sexton Marrow, the chapel's own living caretaker, his grave the first disturbed. Morthen began with the very man who buried Bloomhaven's dead.",
    objectives: [
      {
        type: 'collect',
        itemId: 'weathered_ledger_page',
        count: 3,
        label: 'Weathered Ledger Page',
      },
    ],
    xpReward: 600,
    copperReward: 250,
    itemRewards: {},
    requiresQuest: 'q_whispers',
  },
  q_silence_the_call: {
    id: 'q_silence_the_call',
    name: 'Silence the Call',
    giverNpcId: 'brother_aldric',
    turnInNpcId: 'brother_aldric',
    text: "Every name in that ledger is a soul Morthen means to drag from the earth, and the chapel yard already crawls with those he has called. Return 12 Wither Husks to their graves, $N, before the Blightcaller's whisper swells into a chorus.",
    completionText:
      'The yard grows quieter, but the calling has not stopped. It rises from below now, $N. From the crypt itself.',
    objectives: [
      { type: 'kill', targetMobId: 'restless_bones', count: 12, label: 'Wither Husk silenced' },
    ],
    xpReward: 750,
    copperReward: 300,
    itemRewards: {},
    requiresQuest: 'q_names_of_the_dead',
  },
  q_rite: {
    id: 'q_rite',
    name: 'The Binding Rite',
    giverNpcId: 'brother_aldric',
    turnInNpcId: 'brother_aldric',
    text: 'The crypt beneath the chapel must be unsealed if we are to stop the Blightcaller, but only a binding rite will let the living pass. I need 4 lumps of Blessed Tallow (the kobold diggers hoard candles by the crate) and 6 Ghostly Essences from the restless dead.',
    completionText:
      'It is done. The way below stands open... and may the Bloom forgive me for opening it. Gather your strongest companions before you descend, $N. No one should face the Hollow alone.',
    objectives: [
      { type: 'collect', itemId: 'blessed_wax', count: 4, label: 'Blessed Tallow' },
      { type: 'collect', itemId: 'ghostly_essence', count: 6, label: 'Ghostly Essence' },
    ],
    xpReward: 700,
    copperReward: 500,
    itemRewards: {},
    requiresQuest: 'q_whispers',
  },
  q_hollow: {
    id: 'q_hollow',
    name: 'Into the Hollow',
    giverNpcId: 'brother_aldric',
    turnInNpcId: 'brother_aldric',
    text: "Morthen the Blightcaller waits at the bottom of the Hollow Crypt, ringed by the elite dead he has raised. He is far beyond any one hero, take four companions, no fewer. End him, and the Vale's dead will finally sleep.",
    completionText:
      'The whispering has stopped. You have done what the whole Vale could not, $N, the dead sleep, and Bloomhaven owes you everything it has.',
    objectives: [
      { type: 'kill', targetMobId: 'morthen', count: 1, label: 'Morthen the Blightcaller slain' },
    ],
    xpReward: 1500,
    copperReward: 10000,
    itemRewards: {
      warrior: 'gravecaller_blade',
      rogue: 'widowfang_dirk',
      mage: 'gravecaller_staff',
    },
    requiresQuest: 'q_rite',
    suggestedPlayers: 5,
  },
  q_sexton: {
    id: 'q_sexton',
    name: "The Sexton's Bell",
    giverNpcId: 'brother_aldric',
    turnInNpcId: 'brother_aldric',
    text: "The ledger named him and the crypt holds him: Sexton Marrow, the chapel's caretaker, the first man Morthen raised — guarding his master's door in death as faithfully as he kept the chapel in life. Take four companions into the Hollow Crypt and grant the old sexton the rest he was robbed of, $N.",
    completionText:
      'So Marrow is free at last. Ring no bell for him — he heard enough of them in life.',
    objectives: [
      { type: 'kill', targetMobId: 'sexton_marrow', count: 1, label: 'Sexton Marrow laid to rest' },
    ],
    xpReward: 1000,
    copperReward: 600,
    itemRewards: {
      warrior: 'marrowtread_boots',
      mage: 'sextons_slippers',
      rogue: 'gravewalker_softboots',
    },
    requiresQuest: 'q_rite',
    suggestedPlayers: 5,
  },
  q_gravecallers_trail: {
    id: 'q_gravecallers_trail',
    name: "The Blightcaller's Trail",
    giverNpcId: 'brother_aldric',
    turnInNpcId: 'brother_aldric',
    text: 'Morthen is dead, yet a question gnaws at me: a sect that hid for a century does not spend itself on one village chapel. He kept a grimoire — his rites, his correspondence. If anything of it survives, it lies in the vestry of the ruined chapel above the crypt. Search the ruin and bring me whatever remains of his writings, $N.',
    completionText:
      "Morthen wrote to a 'Mistcaller' in the northern fen. The sect is not dead, $N — it has merely been patient.",
    objectives: [
      { type: 'collect', itemId: 'morthen_grimoire', count: 1, label: "Morthen's Grimoire" },
    ],
    xpReward: 900,
    copperReward: 400,
    itemRewards: {},
    requiresQuest: 'q_hollow',
  },
  q_bandits: {
    id: 'q_bandits',
    name: 'The Ashen Maw',
    giverNpcId: 'marshal_redbrook',
    turnInNpcId: 'marshal_redbrook',
    text: 'A raider clan calling itself the Ashen Maw has dug into the southeast flats. They were common bandits once, but the Dry has gotten into them, the deeper they range into the parched country, the hungrier and crueler they turn. Break their raids, slay 10 Dust Raiders.',
    completionText:
      'Ten fewer ashen throats to feed. But cutting away the body does nothing while the head still calls the tune.',
    objectives: [
      { type: 'kill', targetMobId: 'vale_bandit', count: 10, label: 'Dust Raider slain' },
    ],
    xpReward: 550,
    copperReward: 200,
    itemRewards: { warrior: 'redbrook_blade', mage: 'apprentice_staff', rogue: 'keen_dirk' },
    requiresQuest: 'q_wolves',
  },
  q_ringleader: {
    id: 'q_ringleader',
    name: 'The Hollowed Warlord',
    giverNpcId: 'marshal_redbrook',
    turnInNpcId: 'marshal_redbrook',
    text: "The Ashen Maw answer to one man: Sarn the Hollowed. He drank so deep of the Dry that there is little left of the raider he was, just appetite in a warlord's hide. Cut off the head and the clan will scatter. He holds the heart of their camp. End him, $N.",
    completionText:
      'Sarn is dead? Then the Maw has lost its warlord. You have done Bloomhaven a great service, though the Dry that hollowed him still creeps in off the flats.',
    objectives: [
      { type: 'kill', targetMobId: 'gorrak', count: 1, label: 'Sarn the Hollowed slain' },
    ],
    xpReward: 800,
    copperReward: 500,
    itemRewards: { warrior: 'militia_vest', mage: 'woven_robe', rogue: 'shadow_jerkin' },
    requiresQuest: 'q_bandits',
  },
  q_mogger: {
    id: 'q_mogger',
    name: 'The Rift-Gorged',
    giverNpcId: 'marshal_redbrook',
    turnInNpcId: 'marshal_redbrook',
    text: "One of the Ashen Maw gorged on the raw Dry until his own body could not hold it: Grulmaw, they call him now, and he has swollen into something that splits carts and flattens fences by the dozen. He has dragged himself off to brood atop Grulmaw's Roost, the lone peak in the far south, past Seedvault Hill. Do not face him alone. Take two strong companions up the mountain and put the brute down for good.",
    completionText:
      "Grulmaw dead at last. Bloomhaven's fields are safer, and you leave the Vale with one more tale worth retelling.",
    objectives: [{ type: 'kill', targetMobId: 'mogger', count: 1, label: 'Grulmaw slain' }],
    xpReward: 1200,
    copperReward: 900,
    itemRewards: {
      warrior: 'bristleback_maul',
      mage: 'sableweb_slippers',
      rogue: 'moggers_stomper_boots',
    },
    requiresQuest: 'q_gravecallers_trail',
    minLevel: 6,
    suggestedPlayers: 3,
  },
  // The Lodge outpost chain: two low-level trails from the Baked Beaver crew, given
  // right where a starter first wanders out of Bloomhaven. Both are kill objectives
  // on existing vale mobs (no new mob or drop, so the deterministic spawn/loot rolls
  // are untouched); the second hands over the outpost's keepsake artifact. Neither
  // reuses the Bloomhaven opener mobs (coyotes/javelinas): the beaver work is water
  // and dam work, so these point at the pond snappers and the piling-gnawing gremlins.
  q_sluice_welcome: {
    id: 'q_sluice_welcome',
    name: 'Welcome to the Lodge',
    giverNpcId: 'rowan_sawtooth',
    turnInNpcId: 'rowan_sawtooth',
    text: "First thing you learn on the shore, $N: a beaver earns its spot by working, not gawking. The pond is the whole of this camp, and reservoir snappers have crowded the shallows, biting at the kits and fouling the water we drink. Clear six of them out of the water and come warm up by the lodge fire. Then you're one of us.",
    completionText:
      "Shallows are clear and the water runs clean again, and you never once complained. That's the Lodge way, $N. Fire's yours, free of charge. Stay Baked, AZ.",
    objectives: [
      { type: 'kill', targetMobId: 'mudfin_murloc', count: 6, label: 'Reservoir Snapper cleared' },
    ],
    xpReward: 240,
    copperReward: 80,
    itemRewards: {},
  },
  q_sluice_pilings: {
    id: 'q_sluice_pilings',
    name: 'Gnaw at the Pilings',
    giverNpcId: 'rowan_sawtooth',
    turnInNpcId: 'rowan_sawtooth',
    text: "The dam is the whole reason there's a pond to build around, and trimmer gremlins have crept up from their diggings to gnaw the pilings hollow for the sweet greenwood. A beaver takes that personally, $N. Put down six of the little thieves and the Lodge will owe you a proper keepsake, straight from The Dam itself.",
    completionText:
      "Pilings hold, pond stays put, and the kits sleep sound. Here, $N, a Baked Beaver token, carved down at The Dam. Carry it and you're colony, wherever you wander. Stay Baked, AZ.",
    objectives: [
      { type: 'kill', targetMobId: 'tunnel_rat', count: 6, label: 'Trimmer Gremlin put down' },
    ],
    xpReward: 320,
    copperReward: 120,
    itemRewards: {
      warrior: 'baked_beaver_token',
      mage: 'baked_beaver_token',
      rogue: 'baked_beaver_token',
    },
    requiresQuest: 'q_sluice_welcome',
  },

  // --- Marlow's supply ladder: the demand side of the bud economy ----------------
  // These are `collect` objectives on purpose, which means they can be satisfied by
  // BUYING the buds instead of growing them. That is the point, not a loophole: it
  // gives a player who does not farm a reason to buy from one who does, and the
  // turn-in destroys the buds, so each quest is a demand source AND a supply sink.
  // Non-repeatable, and copper rewards stay modest so the ladder can never become a
  // gold faucet by out-paying the market value of its own inputs.
  q_first_harvest: {
    id: 'q_first_harvest',
    name: 'A First Harvest',
    giverNpcId: 'cultivator_marlow',
    turnInNpcId: 'cultivator_marlow',
    text: 'Every grower starts the same way: a bed, a seed, and the patience to leave it be. Plant something, let it finish, and bring me what comes off it. I want to see how you handle a crop before I trust you with better stock.',
    completionText:
      'Look at that. Trimmed clean and not a bit of it rushed. You have the hands for this work.',
    objectives: [{ type: 'collect', itemId: 'bud_common', count: 5, label: 'Common Bud' }],
    xpReward: 250,
    copperReward: 60,
    itemRewards: {},
    minLevel: 3,
  },
  q_fine_supply: {
    id: 'q_fine_supply',
    name: 'Something Finer',
    giverNpcId: 'cultivator_marlow',
    turnInNpcId: 'cultivator_marlow',
    text: 'Common stock keeps the lamps lit, but it does not win anyone over. I need finer material, and I do not much care how you come by it. Breed for it yourself if you have the patience, or buy it off someone who did. A grower with coin is still a grower.',
    completionText:
      'Now that is worth curing properly. Whoever raised this knew what they were doing, and if that was you, all the better.',
    objectives: [{ type: 'collect', itemId: 'bud_fine', count: 8, label: 'Fine Bud' }],
    xpReward: 600,
    copperReward: 180,
    itemRewards: {},
    requiresQuest: 'q_first_harvest',
    minLevel: 6,
  },
  q_prime_order: {
    id: 'q_prime_order',
    name: "The Cultivator's Order",
    giverNpcId: 'cultivator_marlow',
    turnInNpcId: 'cultivator_marlow',
    text: 'I have a standing order I have never once been able to fill: prime material, and nothing under it. That takes a strain bred right the whole way up, which means either years of your own crosses or a good relationship with someone who has already done it. Either way, fill it and the Lodge will know your name.',
    completionText:
      'Six of prime. I have waited a long season for this. The Lodge owes you, and so do I.',
    objectives: [{ type: 'collect', itemId: 'bud_prime', count: 6, label: 'Prime Bud' }],
    xpReward: 1400,
    copperReward: 400,
    itemRewards: {},
    requiresQuest: 'q_fine_supply',
    minLevel: 10,
  },
};

export const ZONE1_QUEST_ORDER = [
  'q_sluice_welcome',
  'q_sluice_pilings',
  'q_first_harvest',
  'q_fine_supply',
  'q_prime_order',
  'q_wolves',
  'q_boars',
  'q_spiders',
  'q_greyjaw',
  'q_murlocs',
  'q_supplies',
  'q_bandits',
  'q_mine',
  'q_bones',
  'q_ringleader',
  'q_whispers',
  'q_names_of_the_dead',
  'q_silence_the_call',
  'q_rite',
  'q_sexton',
  'q_hollow',
  'q_gravecallers_trail',
  'q_mogger',
];

// ---------------------------------------------------------------------------
// World layout. Town sits at origin. +z north, +x WEST (east is -x:
// facing 0 looks along +z and turning right decreases facing, so the
// rendered world and the corrected map both put -x on your right).
// ---------------------------------------------------------------------------

export const ZONE1_CAMPS: CampDef[] = [
  // Wolves: FAR-north woods. Pushed well north of the Baked Beaver outpost (the
  // Sluice, x34-48 z52-64) and its approach so the pond community is a safe place
  // to build and rest, not a mob gauntlet. Counts are unchanged: the camp loop is
  // the final RNG consumer at construction, so re-centering moves the packs without
  // shifting any downstream spawn roll (parity holds); changing a count would not.
  { mobId: 'forest_wolf', center: { x: -20, z: 82 }, radius: 20, count: 7 },
  { mobId: 'forest_wolf', center: { x: 6, z: 94 }, radius: 18, count: 6 },
  { mobId: 'old_greyjaw', center: { x: -6, z: 100 }, radius: 8, count: 1 },
  // Javelinas: the deep-south meadow, SE of the Dry Camp and well behind Seedvault Hill,
  // clear of the Sluice pond and the river corridor. (Re-centering only moves the packs:
  // the camp loop is the final RNG consumer at construction, so no downstream spawn roll
  // shifts and parity holds; changing a COUNT would.)
  { mobId: 'wild_boar', center: { x: 60, z: -112 }, radius: 18, count: 6 },
  { mobId: 'wild_boar', center: { x: 78, z: -124 }, radius: 18, count: 5 },
  // Grulmaw the Rift-Gorged broods alone atop Grulmaw's Roost, the lone peak in the vale's
  // far southeast (GRULMAW_PEAK in world.ts). Its summit is a walkable dome, so a party
  // climbs the north face to finish q_mogger; the camp-flatten levels a small apex plateau
  // for the fight. (Re-centering moves the elite without shifting any downstream spawn roll.)
  { mobId: 'mogger', center: { x: -64, z: -142 }, radius: 5, count: 1 },
  // Spiders: western woods
  { mobId: 'webwood_spider', center: { x: -60, z: 5 }, radius: 22, count: 7 },
  // Murlocs: lake shore northwest — camp straddles the waterline
  { mobId: 'mudfin_murloc', center: { x: -75, z: 57 }, radius: 14, count: 8 },
  // Kobolds: mine southwest
  { mobId: 'tunnel_rat', center: { x: -82, z: -62 }, radius: 20, count: 9 },
  // Ashen Maw: southeast raider camp, re-clustered off the dirt path into a rounded
  // encampment (was a long diagonal column that straddled the road terminus). The
  // trail now stops at a clearing NW of the camp; a lookout picket (dust_slinger)
  // holds the gate, the vale_bandit body musters around the central hearth, the
  // reavers guard the east tents, and a back-guard rings Sarn's warlord tent in the
  // SE corner. (Counts are unchanged: the camp loop is the final RNG consumer at
  // construction, so re-centering + radius move mobs without shifting any downstream
  // spawn roll; changing a COUNT would.)
  { mobId: 'dust_slinger', center: { x: 78, z: -76 }, radius: 8, count: 3 },
  { mobId: 'vale_bandit', center: { x: 86, z: -84 }, radius: 11, count: 5 },
  { mobId: 'dust_reaver', center: { x: 92, z: -82 }, radius: 8, count: 3 },
  { mobId: 'vale_bandit', center: { x: 88, z: -90 }, radius: 8, count: 3 },
  { mobId: 'gorrak', center: { x: 89, z: -91 }, radius: 2, count: 1 },
  // Undead: the Wither Husk host has abandoned the ruined SKELETON_FORT and holed up in its
  // true lair, WITHER HOLLOW (the SKELETON_CAVE in world.ts), a cave SYSTEM gouged deep into
  // the mountain foot NNW of the grotto. The pack musters deep in the wide inner chamber
  // (center 173,136, radius 5: the flatten ring, radius ~9, stays entirely inside the carved
  // chamber floor so it leaves no plateau artifact on the mountainside), and Captain Verlan
  // holds the throat where the entrance tunnel opens into the chamber (162,136). The fort now
  // sits empty. (Radius only scales each spawn's drawn offset and this grotto pair is the
  // final RNG consumer at construction, so moving the mobs shifts no other content's roll.)
  { mobId: 'restless_bones', center: { x: 173, z: 136 }, radius: 5, count: 8 },
  { mobId: 'captain_verlan', center: { x: 162, z: 136 }, radius: 2.5, count: 1 },
];

// Spawned LAST in the merged CAMPS array (see data.ts) so these appended draws
// fall after every other zone's camp spawns — and the camp loop is the final
// RNG consumer at construction (ground objects, dungeon doors and addPlayer draw
// none). Keeping the rare elite at the tail means adding it shifts no other
// content's deterministic spawn rolls, so fixed-seed tests stay stable.
export const ZONE1_CHAPEL_CAMPS: CampDef[] = [
  // A pair of bone guardians flank the ruined altar at the grotto's back; their binder
  // lurks by the crypt cave-mouth in the cliff.
  { mobId: 'restless_bones', center: { x: 163, z: 84 }, radius: 5, count: 2 },
  { mobId: 'wraithbinder_maldrec', center: { x: 164, z: 86 }, radius: 3, count: 1 },
];

export const ZONE1_OBJECTS: GroundObjectDef[] = [
  {
    itemId: 'supply_crate',
    name: 'Stolen Supply Crate',
    positions: [
      { x: 58, z: -58 },
      { x: 73, z: -70 },
      { x: 86, z: -82 },
      { x: 95, z: -97 },
      { x: 64, z: -76 },
      { x: 81, z: -94 },
    ],
  },
  {
    itemId: 'gravecaller_sigil',
    name: "Blightcaller's Sigil",
    // Scattered across the Skeleton Grotto floor among the husks (see SKELETON_GROTTO).
    positions: [
      { x: 151, z: 88 },
      { x: 143, z: 80 },
    ],
  },
  {
    itemId: 'weathered_ledger_page',
    name: 'Weathered Ledger Page',
    positions: [
      { x: 145, z: 84 },
      { x: 150, z: 90 },
      { x: 154, z: 79 },
    ],
  },
  {
    itemId: 'morthen_grimoire',
    name: "Morthen's Grimoire",
    positions: [{ x: 158, z: 87 }],
  },
];

// Roads from town toward each hub — used for terrain painting and the map.
// Roads from town toward each hub — used for terrain painting and the map.
// Bloomhaven's lanes leave the plaza as five clean corridors, not six radial
// spokes: the road to the northeast ruins shares the north corridor and only
// forks off past the dwelling ring (r > 26), which opens a wide building gap on
// either side. Each spoke exits through a gap between dwellings; the south stays
// road-free for the ceremonial well -> obelisk -> rift axis.
export const ZONE1_ROADS: { x: number; z: number }[][] = [
  [
    { x: 2, z: 10 },
    { x: -4, z: 27 },
    { x: -12, z: 48 },
    { x: -15, z: 62 },
    { x: -18, z: 82 },
  ], // north to the wolf woods (now the far-north packs, clear of the Sluice)
  [
    { x: 2, z: 10 },
    { x: 3, z: 27 },
    { x: 6, z: 44 },
    { x: 20, z: 58 },
    { x: 42, z: 70 },
    { x: 62, z: 72 },
    { x: 82, z: 78 },
    { x: 104, z: 82 },
    { x: 126, z: 84 },
  ], // to the Skeleton Grotto: forks off the north corridor, skirts the enlarged
  // Sluice pond's town-facing shore, then runs west across the field to the grotto
  // mouth at the foot of the western rim mountain
  [
    { x: 10, z: 3 },
    { x: 30, z: 8 },
    { x: 58, z: 4 },
    { x: 88, z: -6 },
  ], // west to the boar meadow (south of the Sluice river corridor)
  [
    { x: 7, z: -7 },
    { x: 30, z: -30 },
    { x: 50, z: -48 },
    { x: 64, z: -62 },
  ], // southeast to the raider camp: the trail bends and STOPS at a clearing NW of
  // the camp (was driving straight into the picket at 65,-65). The camp now sits
  // south-east of this trailhead, its gate facing back up the path, so the dirt
  // road is an approach to the camp, not a lane plowing through its middle.
  [
    { x: -7, z: -7 },
    { x: -30, z: -28 },
    { x: -55, z: -45 },
    { x: -70, z: -55 },
  ], // southwest to mine
  [
    { x: -9, z: 7 },
    { x: -35, z: 25 },
    { x: -58, z: 48 },
    { x: -72, z: 63 },
  ], // northwest to the Mirror Lake pier
  [
    { x: 9, z: 7 },
    { x: 4, z: 26 },
    { x: 10, z: 48 },
    { x: 26, z: 52 },
    { x: 40, z: 52 },
  ], // spur to The Sluice: up the town-facing (east) shore of the millpond, around
  // its north end to the outpost, staying clear of the water and the west river.
  // The path runs SOUTH of the lodge + den, so the houses sit clearly on its north side.
];

// ---------------------------------------------------------------------------
// Static props (rendering + collision share this placement data)
// ---------------------------------------------------------------------------

export const ZONE1_PROPS: ZonePropsDef = {
  // Bloomhaven is laid out as TWO rings around the central well+market plaza:
  // the NPCs cluster on an inner ring (r < 13) and six dwellings sit on an OUTER
  // ring (r ~ 16-20), each dropped into an angular GAP between the road spokes so
  // every lane and the interior stay walkable. The whole outer ring sits inside
  // the flattened town plateau (TOWN_RADIUS * 0.7 = 23.8yd of fully-flat ground),
  // so every building's footprint rests FLUSH on level terrain (measured corner
  // height spread <= 0.1yd) instead of floating on the blended hillsides. Doors
  // face inward (rot = atan2(-x,-z) aims each front at the square). The two
  // southern dwellings FLANK the ceremonial axis (well -> south green -> distant
  // Corruption rift) without blocking it; the chapel anchors the solemn south
  // ground beside the churchyard graves.
  buildings: [
    { kind: 'inn', x: -7.5, z: 14.1, w: 6, d: 7, rot: 2.65 }, // NNW gap, the traveler's rest
    { kind: 'house', x: 15.4, z: 12, w: 6, d: 5, rot: -2.23 }, // ENE gap, clear of Smith Haldren's smithy
    { kind: 'house', x: 19, z: -6.2, w: 6, d: 5, rot: -1.26 }, // E-SE gap
    { kind: 'house', x: -20, z: -1.4, w: 6, d: 5, rot: 1.5 }, // W gap, by Netcaster Brandt
    { kind: 'house', x: 3.8, z: -19.6, w: 7, d: 6, rot: -0.19 }, // south flank (east of axis)
    { kind: 'chapel', x: -6.5, z: -17.8, w: 5, d: 7, rot: 0.35 }, // south flank (west of axis), the solemn ground, set back from the graves
    // The Sluice outpost, on the north shore of the millpond (a short walk
    // northwest of town, clear of the plaza, the wolf woods, and the river). The
    // lodge is an `inn`, so its footprint grants classic rested XP: a real reason
    // for a starter to walk out and rest by the beaver pond. Both houses sit on the
    // NORTH side of the dirt-path spur (which now runs along z52), doors facing the
    // pond and the path to the south.
    { kind: 'inn', x: 38, z: 60, w: 6, d: 7, rot: 3.05 }, // beaver lodge (rested XP)
    { kind: 'house', x: 46, z: 62, w: 6, d: 5, rot: 2.9 }, // beaver den
    // The Breeding Chamber: where crosses are made. Sits at the SOUTH entrance of
    // the garden field with its door facing north up the beds, so the grow loop
    // reads as one place (field in front, chamber behind). Marlow keeps it and
    // stands a couple of yards north of the north wall, between chamber and field,
    // which is also the proximity anchor breeding is gated on (strain_library.ts).
    // Footprint x 56.5-63.5, z 42-48: clear of the southmost plot row (z 53.7) and
    // of Marlow himself (z 50).
    // rot follows the same convention as the town ring: atan2(targetX - x, targetZ - z)
    // aims the FRONT at the target. Marlow/the field sit due north at (60, 50), so
    // atan2(0, +5) = 0 puts the door on the field side. (3.1 faced it away.)
    { kind: 'house', x: 60, z: 45, w: 7, d: 6, rot: 0 }, // the Breeding Chamber
  ],
  wells: [{ x: 0, z: 2, r: 1.5 }],
  stalls: [
    { x: -10, z: 0, rot: Math.PI / 2, r: 1.7 }, // Provisioner Wilkes' stall, out in the SW plaza corner (clear of the World Market stall)
    { x: 8, z: 15, rot: -2.7, r: 1.7 }, // Smith Haldren's smithy stall (beside his NE dwelling)
    { x: -3, z: 7, rot: 2.74, r: 1.8 }, // The Broker's World Market stall (west of the plaza, off the north lane)
  ],
  mines: [{ x: -88, z: -68, rot: 0.8 }],
  docks: [
    { x: -79.3, z: 75.3, rot: 2.356, hutLocal: { x: 2.8, z: 2.4, hw: 1.7, hd: 1.5 } }, // Mirror Lake fishing dock (seated on the SE waterline, deck out over the basin)
    // The Sluice landing: a short plank dock off the millpond's north shore where
    // the Beaver quartermaster runs supplies, giving the waterfront a working edge
    // and the pond a human-scale reference.
    { x: 36, z: 44, rot: 0.1, hutLocal: { x: 10.8, z: 2.1, hw: 1.6, hd: 1.4 } }, // shack set back to world (47,45), off the dock
  ],
  // The Sluice work-camp is an open, tent-free landing: the two stock canvas tents
  // that used to flank the lodge were removed so the shore reads clean (the Ashen Maw
  // warcamp still uses its own procedural raiderTents below).
  tents: [],
  crates: [
    // Draxa the Riftsmith's Upgrade Bench stock dresses the western craft stall.
    // Trade crates stacked by the eastern house behind Herbalist Lin, moved
    // out of the plaza so they no longer clutter the center of Bloomhaven.
    [21.6, -8],
    [22.4, -8],
    [-16, 2], // Draxa the Riftsmith's Upgrade Bench stock
    [-11.8, 6.4],
    // The Sluice supply stacks: driftwood and trade crates by the beaver lodge and
    // the pond landing, dressing the outpost as a working camp. The first stack was
    // pulled south off the den/campfire (it clipped the den corner at 44,60) to open
    // ground between the lodge and the shore.
    [46, 57],
    [40, 56],
    // Ashen Maw plunder stacks: stolen Bloomhaven crates piled among the tents around
    // the camp's central hearth (the q_supplies steal-back objective reads them off
    // these stacks). Re-clustered with the camp so they dress a lived-in encampment
    // rather than a strung-out column.
    [75, -79],
    [83, -81],
    [89, -80],
    [92, -87],
    [85, -90],
    [79, -87],
    [96, -90],
  ],
  campfires: [
    [3, -4],
    [-16.2, 6.2], // Draxa the Riftsmith's forge fire (Upgrade Bench)
    [-80, -60],
    [-77.5, 68], // Cobb the Dockside Cook's hearth, beside the Mirror Lake pier
    [42, 60], // The Sluice: the beaver crew's hearth between lodge and den
  ],
  // Ashen Maw cookfires: a lookout fire by the gate, the main hearth at the camp's
  // center, and the warlord's fire by Sarn's tent. A Growverse-original procedural
  // log-pyre in a blackened stone ring (render/props.ts), NOT the shared CC0 bonfire
  // the other zones burn, so the raider camp reads 1-of-1.
  raiderCookfires: [
    [78, -75], // lookout fire, just inside the NW gate
    [86, -84], // main hearth, camp center
    [90, -91], // warlord's fire, by Sarn's tent
  ],
  // Ashen Maw raider tents: hide-and-pole lean-tos clustered in a rough ring around
  // the central hearth, doors turned inward so the site reads as a lived-in camp, not
  // a marching column. A lookout tent sits by the NW gate, the warlord's larger tent
  // anchors the SE back corner. A Growverse-original procedural shelter
  // (render/props.ts), NOT the shared CC0 Kenney tent the other zones use.
  raiderTents: [
    { x: 77, z: -77, rot: 0.7, scale: 1 }, // lookout, by the gate
    { x: 84, z: -76, rot: 2.6, scale: 1 }, // north of the hearth
    { x: 95, z: -82, rot: -1.4, scale: 1 }, // east
    { x: 81, z: -90, rot: 1.0, scale: 1 }, // south
    { x: 93, z: -94, rot: 1.1, scale: 1.35 }, // warlord's tent, SE back corner
    { x: 87, z: -88, rot: -0.6, scale: 1 }, // inner, by Sarn's heart
  ],
  mudHuts: [
    [-73, 59],
    [-78, 54],
    [-69, 55],
  ],
  ruinRings: [
    // (The toppled-column ring that used to sit at the Skeleton Grotto center was
    // removed when the SKELETON_FORT keep was raised there, so the columns no longer
    // clip through the keep; the grotto's ruin now reads as the fort itself.)
    { x: -5, z: -60, ringR: 8, columns: 6 },
  ],
  // A low L-shaped churchyard rail southwest of the chapel + graves (well clear
  // of the SW road and the ceremonial axis); the enclosure opens NE toward the
  // chapel and town, it never walls a lane.
  fences: [
    // Churchyard rail (solemn south). The Ashen Maw palisade that used to live here
    // was a CC0 Kenney fence; it has been replaced by the custom spiked-stake
    // barricade line in `spikeBarricades` above, so the warcamp wall is now 1-of-1
    // raider timber rather than a stock pack asset.
    { x1: -15, z1: -18, x2: -15, z2: -26 },
    { x1: -15, z1: -26, x2: -8, z2: -26 },
    // (The Sluice split-rail pen that used to stand behind the beaver lodge has been
    // removed: the outpost is now an open, fence-free camp so nothing reads as walling
    // the dirt-path spur that runs along its south side.)
    // Homestead river line: a wooden rail strung along the SOUTH (river-side) edge of the
    // garden field at z = 36, tower to tower (the SW lookout at x=54 to the SE lookout at
    // x=138). z=36 is the tower line, 2yd in from the bank top (zSouth 34) so the rail rests
    // on flat field, never on the terrace blend or over the river drop. Both runs stop just
    // clear of each tower's posts (footprint HALF ~1.35), and a GAP is left over the dam
    // crossing (SLUICE_BRIDGE x=70, halfWidth 2.8, deck reaches z=35) so the fence never
    // walls the bridge access from the homestead. Fences are jump-over colliders anyway.
    { x1: 55.5, z1: 36, x2: 65.5, z2: 36 }, // SW tower -> west of the dam crossing
    { x1: 74.5, z1: 36, x2: 136.5, z2: 36 }, // east of the dam crossing -> SE tower
  ],
  graveyards: [
    { x: -14, z: -25.5 }, // churchyard graves in the solemn south (grid grows +x/+z, seated clear of the chapel wall and inside the rail)
    { x: 4, z: -56 },
  ],
  delveMarkers: [{ x: -5, z: -52, delveId: 'collapsed_reliquary' }],
  // An Elevated Obelisk standing alone far out on the eastern desert flats: an
  // ancient relic lost in time, weathered by the wastes, a landmark travelers
  // sight from a distance (no longer crowds the town square).
  obelisks: [{ x: 64, z: -22, y: 7 }],
  // Ashen Maw ward-totems (a Growverse-original procedural skull-stake, not a CC0
  // model): two flank the open NW gate, the rest ring the camp's outer edge, so the
  // clan's ground is claimed by bone standards no other WoCC settlement carries.
  // (Thin brush-past colliders, so even the gate pair never wall the entrance.)
  wardStakes: [
    { x: 72, z: -72 }, // gate flank (west of the entrance)
    { x: 78, z: -70 }, // gate flank (east of the entrance)
    { x: 86, z: -70 }, // outer ring, north
    { x: 96, z: -76 }, // north-east
    { x: 100, z: -86 }, // east
    { x: 96, z: -96 }, // south-east
    { x: 84, z: -98 }, // south
    { x: 74, z: -90 }, // south-west
  ],
  // Ashen Maw spiked-stake barricades (a custom Meshy GLB, not a CC0 pack): lashed
  // clusters of sharpened stakes dug in around the camp's OUTER edge (N, E, S, SW, W),
  // so the site reads as a fortified raider position. The whole NW arc is left OPEN as
  // the gate that faces the incoming trail, so the barricades no longer straddle the
  // dirt path, and the boss is never walled in.
  spikeBarricades: [
    { x: 84, z: -69 }, // north wall (east of the gate)
    { x: 90, z: -71 },
    { x: 94, z: -73 }, // forward wing, NE
    { x: 99, z: -79 }, // east wall
    { x: 101, z: -88, h: 1.8 },
    { x: 98, z: -95, h: 1.8 }, // south-east corner
    { x: 90, z: -99, h: 1.8 }, // south wall
    { x: 82, z: -100, h: 1.8 },
    { x: 74, z: -96 }, // south-west
    { x: 70, z: -88 }, // west wall
    { x: 69, z: -81 },
  ],
  // Ashen Maw war-standard (a Growverse-original procedural totem, not a CC0/Meshy
  // model): the clan's central effigy raised over Sarn the Hollowed's heart, a tall
  // skull-trophy post that reads as the camp's ceremonial center. Sits inside the
  // warlord's-heart ward-totem ring, facing the NW approach so raiders (and players)
  // muster before it. Replaces the earlier ill-fitting stone-guardian idol.
  warStandards: [{ x: 84, z: -86, rot: 2.3 }],
  // The Sluice pond has no separate dam anymore: the colony's dam is the straight
  // beaver-log dam thrown across the river at the crossing (SLUICE_BRIDGE, x=70), and
  // you walk its crest to cross (render/bridge.ts renders the dam over the walkable
  // causeway terrain). The far-south Dam colony keeps its own colossal dam (zone4).
  // The Baked Beaver mascot: a ~5m-tall procedural beaver statue (render/props.ts)
  // on the north shore of the Sluice millpond, facing south across the water so it
  // watches over the outpost and greets a player circling the pond. A short cylinder
  // collider (colliders.ts) keeps players from walking through it. Matches the
  // `Baked Beaver` landmark POI above. A decoration-exclusion point in world.ts
  // keeps a stray tree from clipping the statue.
  beaverMascots: [{ x: 42, z: 54, rot: 3.1, scale: 1.05 }],
  // Homestead-corner lookouts: a matched pair of solid wooden watch towers flanking the
  // south (riverside) edge of the leveled garden field (GARDEN_FARM xMin 52 / xMax 140 /
  // zSouth 34, world.ts). Each is seated ~2yd in from its two edges so all four posts
  // (footprint HALF ~1.35) rest on the flat field, never on the terrace blend or over the
  // river bank. Both ladders/fronts (and the archers' gaze) face NORTH (rot = 0; world
  // north is +z), so each climb faces in toward the homestead.
  //   - SOUTHWEST corner (nearest the Sluice outpost and river): x = xMin 52 + 2, z = 34 + 2.
  //   - SOUTHEAST corner, snug against the mountain foot: x = xMax 140 - 2, z = zSouth 34 + 2.
  //     Clear of the Skeleton Grotto, which is gouged into the mountain up at the north end.
  watchTowers: [
    { x: 54, z: 36, rot: 0 },
    { x: 138, z: 36, rot: 0 },
  ],
  // Stone stairway up the steep east wall of the channel below the garden terrace: from
  // the low channel floor (~-3.1) at the foot up ~5 yards to the grass plateau (~+2.1).
  // The straight ramp holds the climb well under the slope gate; treads draped over it.
  stairs: [{ x1: 36, z1: 65, x2: 46, z2: 65, halfWidth: 2 }],
};
