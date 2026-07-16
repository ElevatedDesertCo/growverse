// The Emberwastes: realm 1, a portal-reached desert dimension (see
// docs/design/realms.md). This is the M1 SLICE: the Sunmourn Dunes sub-zone end to
// end, so the realm is a real place to visit, fight through, and work a gathering
// loop in, not just empty terrain. It occupies a far coordinate band with its own
// zone strip and terrain seed, and (for now) reuses the `vale` biome, which already
// renders as a sun-baked desert. Later milestones add the rest of the sub-zones
// (Glass Canyons, Cinderreach, the Buried Dynasty dungeon), the full Sunforged gear
// set, and the wider quest arc.
//
// Merged into the flat engine tables by sim/data.ts the same way temple.ts and
// hollowmere.ts are: mobs, npcs, quests, items, and camps each wire in at their
// merge point, with camps APPENDED LAST for world-gen determinism. The bloomspring
// harvest node lives in content/gathering.ts and the grow_sunflare_bulb recipe in
// content/crafting.ts (each system's canonical home); this module owns the items
// those reference (sunflare_bulb_raw, sunflare_bulb).

import type {
  CampDef,
  DungeonDef,
  DungeonSpawn,
  ItemDef,
  MobTemplate,
  NpcDef,
  QuestDef,
  RealmDef,
  ZoneDef,
} from '../types';

// The realm's zone strip runs south (the Caravanserai oasis) to north (the ash
// scorchland), partitioned by zMax. Every sub-zone reuses the `vale` biome, which
// already renders as a sun-baked desert (a distinct desert biome is a deferred art
// pass, see docs/design/realms.md); since the biome is uniform, partitioning only
// adds each hub's plateau, so the Sunmourn content keeps its exact terrain.
const SUNMOURN_DUNES: ZoneDef = {
  id: 'sunmourn_dunes',
  name: 'Sunmourn Dunes',
  zMin: -560,
  zMax: 200,
  levelRange: [8, 11],
  biome: 'vale',
  hub: { x: 12000, z: 20, radius: 14, name: 'Caravanserai' },
  graveyard: { x: 12000, z: 8 },
  lakes: [],
  pois: [],
  welcome: '',
};

const GLASS_CANYONS: ZoneDef = {
  id: 'glass_canyons',
  name: 'The Glass Canyons',
  zMin: 200,
  zMax: 480,
  levelRange: [11, 14],
  biome: 'vale',
  hub: { x: 12000, z: 340, radius: 12, name: "The Glassmaker's Reach" },
  graveyard: { x: 12000, z: 328 },
  lakes: [],
  pois: [],
  welcome: '',
};

// Cinderreach is defined now (the strip's northern band + its terrain plateau) so
// the realm is partitioned once; its creatures, cult, and dungeon door arrive in M2.2.
const CINDERREACH: ZoneDef = {
  id: 'cinderreach',
  name: 'Cinderreach',
  zMin: 480,
  zMax: 780,
  levelRange: [14, 18],
  biome: 'vale',
  hub: { x: 12000, z: 630, radius: 12, name: 'The Ember Amphitheater' },
  graveyard: { x: 12000, z: 618 },
  lakes: [],
  pois: [],
  welcome: '',
};

export const EMBERWASTES_REALM: RealmDef = {
  id: 'emberwastes',
  name: 'The Emberwastes',
  // A far, otherwise-unused band (well past the dungeon/arena/delve x-bands).
  band: { xMin: 11820, xMax: 12180, zMin: -560, zMax: 780 },
  terrainSeed: 71000,
  zones: [SUNMOURN_DUNES, GLASS_CANYONS, CINDERREACH],
  hubPos: { x: 12000, z: 20 }, // the Caravanserai (portal arrival)
  returnPortalPos: { x: 12000, z: 14 }, // the return gate, just south of the hub
  entryPortalPos: { x: 0, z: -30 }, // the overworld-side gate (Bloomhaven south)
  unlock: { minLevel: 8 },
};

// ---------------------------------------------------------------------------
// Mobs, the Sunmourn Dunes (level 8 to 11, the dune wildlife and the sun-dead)
// ---------------------------------------------------------------------------

export const EMBERWASTES_MOBS: Record<string, MobTemplate> = {
  dust_scarab: {
    id: 'dust_scarab',
    name: 'Dust Scarab',
    minLevel: 8,
    maxLevel: 9,
    family: 'beast',
    hpBase: 40,
    hpPerLevel: 15,
    dmgBase: 7,
    dmgPerLevel: 2.0,
    attackSpeed: 1.9,
    armorPerLevel: 10,
    moveSpeed: 7.5,
    aggroRadius: 10,
    loot: [{ copper: 45, chance: 1 }],
    scale: 0.8,
    color: 0xc9a24b,
  },
  sand_stalker: {
    id: 'sand_stalker',
    name: 'Sand Stalker',
    minLevel: 9,
    maxLevel: 11,
    family: 'beast',
    hpBase: 52,
    hpPerLevel: 18,
    dmgBase: 9,
    dmgPerLevel: 2.3,
    attackSpeed: 2.0,
    armorPerLevel: 12,
    moveSpeed: 8,
    aggroRadius: 12,
    loot: [
      { copper: 70, chance: 1 },
      // The ward-shard is the q_ember_ward1 collectible; it only drops while the
      // quest is active (matched by questId in quest_credit).
      { itemId: 'ember_ward_shard', chance: 0.5, questId: 'q_ember_ward1' },
    ],
    scale: 1.05,
    color: 0xb07a3c,
  },
  sunbleached_husk: {
    id: 'sunbleached_husk',
    name: 'Sunbleached Husk',
    minLevel: 8,
    maxLevel: 10,
    family: 'undead',
    hpBase: 60,
    hpPerLevel: 20,
    dmgBase: 9,
    dmgPerLevel: 2.4,
    attackSpeed: 2.5,
    armorPerLevel: 14,
    moveSpeed: 5.5,
    aggroRadius: 11,
    loot: [
      { copper: 65, chance: 1 },
      { itemId: 'ember_essence', chance: 0.25 },
    ],
    scale: 1.12,
    color: 0xd8cba0,
  },

  // --- The Glass Canyons (level 11 to 14) ---
  glassback_basilisk: {
    id: 'glassback_basilisk',
    name: 'Glassback Basilisk',
    minLevel: 12,
    maxLevel: 13,
    family: 'beast',
    rare: true,
    hpBase: 150,
    hpPerLevel: 24,
    dmgBase: 12,
    dmgPerLevel: 2.7,
    attackSpeed: 2.4,
    armorPerLevel: 18,
    moveSpeed: 6.5,
    aggroRadius: 13,
    loot: [
      { copper: 340, chance: 1 },
      { itemId: 'corruption_shard', chance: 0.4 },
    ],
    scale: 1.25,
    color: 0x7fae8a,
  },
  canyon_shrike: {
    id: 'canyon_shrike',
    name: 'Canyon Shrike',
    minLevel: 11,
    maxLevel: 13,
    family: 'beast',
    hpBase: 62,
    hpPerLevel: 19,
    dmgBase: 10,
    dmgPerLevel: 2.4,
    attackSpeed: 1.8,
    armorPerLevel: 12,
    moveSpeed: 8.5,
    aggroRadius: 13,
    loot: [{ copper: 95, chance: 1 }],
    scale: 0.95,
    color: 0xc27a4a,
  },
  mirage_djinn: {
    id: 'mirage_djinn',
    name: 'Mirage Djinn',
    minLevel: 13,
    maxLevel: 13,
    family: 'elemental',
    rare: true,
    hpBase: 175,
    hpPerLevel: 26,
    dmgBase: 13,
    dmgPerLevel: 2.8,
    attackSpeed: 2.2,
    armorPerLevel: 16,
    moveSpeed: 7.5,
    aggroRadius: 14,
    cinder: {
      chance: 0.3,
      perTick: 5,
      interval: 2,
      duration: 6,
      name: 'Scorching Mirage',
      school: 'fire',
    },
    loot: [
      { copper: 480, chance: 1 },
      { itemId: 'ember_essence', chance: 0.6 },
    ],
    scale: 1.1,
    color: 0xd9b45a,
  },

  // --- Cinderreach (level 14 to 18): the volcanic scorchland and the Ember-cult ---
  emberling: {
    id: 'emberling',
    name: 'Emberling',
    minLevel: 14,
    maxLevel: 15,
    family: 'elemental',
    hpBase: 58,
    hpPerLevel: 18,
    dmgBase: 11,
    dmgPerLevel: 2.5,
    attackSpeed: 1.7,
    armorPerLevel: 12,
    moveSpeed: 8,
    aggroRadius: 12,
    cinder: {
      chance: 0.35,
      perTick: 4,
      interval: 2,
      duration: 6,
      name: 'Guttering Flame',
      school: 'fire',
    },
    loot: [{ copper: 130, chance: 1 }],
    scale: 0.7,
    color: 0xe0662e,
  },
  cinder_golem: {
    id: 'cinder_golem',
    name: 'Cinder Golem',
    minLevel: 16,
    maxLevel: 16,
    family: 'elemental',
    elite: true,
    hpBase: 220,
    hpPerLevel: 28,
    dmgBase: 15,
    dmgPerLevel: 2.9,
    attackSpeed: 2.6,
    armorPerLevel: 22,
    moveSpeed: 5.5,
    aggroRadius: 13,
    aoePulse: { min: 20, max: 30, radius: 8, every: 8, name: 'Molten Slag' },
    loot: [
      { copper: 520, chance: 1 },
      { itemId: 'corruption_shard', chance: 0.5 },
      { itemId: 'ember_essence', chance: 0.6 },
    ],
    scale: 1.4,
    color: 0x8a3d2a,
  },
  ashen_zealot: {
    id: 'ashen_zealot',
    name: 'Ashen Zealot',
    minLevel: 15,
    maxLevel: 17,
    family: 'humanoid',
    hpBase: 92,
    hpPerLevel: 21,
    dmgBase: 12,
    dmgPerLevel: 2.6,
    attackSpeed: 2.3,
    armorPerLevel: 14,
    moveSpeed: 6.5,
    aggroRadius: 13,
    cinder: {
      chance: 0.4,
      perTick: 6,
      interval: 2,
      duration: 8,
      name: 'Sunfire Brand',
      school: 'fire',
    },
    loot: [
      { copper: 175, chance: 1 },
      { itemId: 'ember_essence', chance: 0.3 },
    ],
    scale: 1.02,
    color: 0xb5482e,
  },
};

// ---------------------------------------------------------------------------
// Mobs, instanced (The Buried Dynasty, ~16 to 18 group dungeon under the dunes)
// ---------------------------------------------------------------------------

export const BURIED_DYNASTY_MOBS: Record<string, MobTemplate> = {
  mummified_guard: {
    id: 'mummified_guard',
    name: 'Mummified Guard',
    minLevel: 16,
    maxLevel: 17,
    family: 'undead',
    elite: true,
    hpBase: 72,
    hpPerLevel: 22,
    dmgBase: 14,
    dmgPerLevel: 2.8,
    attackSpeed: 2.4,
    armorPerLevel: 20,
    moveSpeed: 6,
    aggroRadius: 12,
    loot: [
      { copper: 240, chance: 1 },
      { itemId: 'ember_essence', chance: 0.4 },
    ],
    scale: 1.1,
    color: 0xcdbb86,
  },
  tombscarab_cluster: {
    id: 'tombscarab_cluster',
    name: 'Tombscarab Cluster',
    minLevel: 16,
    maxLevel: 16,
    family: 'beast',
    elite: true,
    hpBase: 60,
    hpPerLevel: 20,
    dmgBase: 12,
    dmgPerLevel: 2.6,
    attackSpeed: 1.6,
    armorPerLevel: 16,
    moveSpeed: 7.5,
    aggroRadius: 12,
    loot: [
      { copper: 210, chance: 1 },
      { itemId: 'corruption_shard', chance: 0.4 },
    ],
    scale: 0.85,
    color: 0x9c7a3e,
  },
  scarab_broodmother: {
    id: 'scarab_broodmother',
    name: 'The Scarab Broodmother',
    minLevel: 18,
    maxLevel: 18,
    family: 'beast',
    elite: true,
    boss: true,
    hpBase: 300,
    hpPerLevel: 36,
    dmgBase: 16,
    dmgPerLevel: 3.0,
    attackSpeed: 2.5,
    armorPerLevel: 24,
    moveSpeed: 6,
    aggroRadius: 18,
    aoePulse: { min: 22, max: 34, radius: 12, every: 9, name: 'Skittering Swarm' },
    summonAdds: { mobId: 'tombscarab_cluster', count: 2, atHpPct: [0.6, 0.3] },
    enrage: { belowHpPct: 0.3, dmgMult: 1.35, hasteMult: 1.25 },
    loot: [
      { copper: 4600, chance: 1 },
      { itemId: 'corruption_shard', chance: 0.6 },
      { itemId: 'ember_essence', chance: 0.8 },
    ],
    scale: 1.7,
    color: 0xc0863a,
  },
};

// ---------------------------------------------------------------------------
// NPCs, the Caravanserai (the oasis town at the portal arrival)
// ---------------------------------------------------------------------------

export const EMBERWASTES_NPCS: Record<string, NpcDef> = {
  ember_trademaster: {
    id: 'ember_trademaster',
    name: 'Kessa',
    title: 'the Trade-Master',
    pos: { x: 11992, z: 22 },
    facing: 1.2,
    color: 0xc9a24b,
    questIds: [],
    vendorItems: [
      'baked_bread',
      'spring_water',
      'roasted_boar',
      'minor_healing_potion',
      'minor_mana_potion',
      'lesser_healing_potion',
      'lesser_mana_potion',
    ],
    greeting:
      'Water, salt, and steel, traveller, that is all the Caravanserai sells and all the dunes respect. Buy what you need before you walk out under that sun.',
  },
  ember_wayfinder: {
    id: 'ember_wayfinder',
    name: 'Oren',
    title: 'the Wayfinder',
    pos: { x: 12008, z: 22 },
    facing: 2.0,
    color: 0xb07a3c,
    questIds: ['q_ember_ward1'],
    greeting:
      'You came through the gate, so you have already seen it, $N: the sun that will not set. The old sun-wards along the dune road are dark, and until they burn again the dead never rest. Help me relight the first of them.',
  },
  ember_cultivator: {
    id: 'ember_cultivator',
    name: 'Sabra',
    title: 'the Sun-Cultivator',
    pos: { x: 12000, z: 31 },
    facing: 0,
    color: 0x4e9a2f,
    questIds: [],
    // The Grow Station attendant here, so the whole seed loop closes at the hub:
    // she also stocks the raw bulbs and ember essence a grower needs.
    vendorItems: ['common_seed', 'ember_essence', 'sunflare_bulb_raw'],
    crafting: 'grow',
    greeting:
      'The oasis blooms one flower the rest of the wastes cannot, $C: the Sunflare Bulb. Bring me raw bulbs and a little ember essence, and the Grow Station will coax a true rare seed from them.',
  },
  // The Glass Canyons outpost: a lone artisan who works the obsidian veins.
  ember_glassmaker: {
    id: 'ember_glassmaker',
    name: 'Vashti',
    title: 'the Glassmaker',
    pos: { x: 12000, z: 340 },
    facing: 3.0,
    color: 0x7fae8a,
    questIds: ['q_ember_ward2', 'q_ember_ward3', 'q_ember_finale'],
    vendorItems: ['spring_water', 'roasted_boar', 'lesser_healing_potion', 'lesser_mana_potion'],
    greeting:
      'Careful on the canyon floor, $N: the Glassback Basilisks blend into the obsidian until they are on you. I stay for the veins, the finest glass-sand in any world, but the second sun-ward lies buried in the slot canyon north of here, and something wearing a heat-haze guards it.',
  },
};

// ---------------------------------------------------------------------------
// Items: the ward-shard collectible and the Sunflare-Bulb seed loop
// ---------------------------------------------------------------------------

export const EMBERWASTES_ITEMS: Record<string, ItemDef> = {
  // q_ember_ward1 collectible: a shard of a shattered sun-ward, carried by the
  // Sand Stalkers that nest in the broken wardstones.
  ember_ward_shard: {
    id: 'ember_ward_shard',
    name: 'Sun-Ward Shard',
    kind: 'quest',
    quality: 'common',
    sellValue: 0,
    noVendorSell: true,
    noMarketList: true,
    questId: 'q_ember_ward1',
  },
  // Raw reagent gathered at the bloomspring oasis node (Herbalism), pressed with
  // ember essence at the Grow Station into the rare Sunflare Bulb.
  sunflare_bulb_raw: {
    id: 'sunflare_bulb_raw',
    name: 'Raw Sunflare Bulb',
    kind: 'junk',
    quality: 'common',
    sellValue: 4,
    buyValue: 20,
  },
  // The realm's signature rare seed, the payoff of the Emberwastes gathering loop.
  sunflare_bulb: {
    id: 'sunflare_bulb',
    name: 'Sunflare Bulb',
    kind: 'junk',
    quality: 'rare',
    sellValue: 90,
  },
};

// ---------------------------------------------------------------------------
// Quests, the sun-ward chain (M1 opens it; later milestones extend it)
// ---------------------------------------------------------------------------

export const EMBERWASTES_QUESTS: Record<string, QuestDef> = {
  q_ember_ward1: {
    id: 'q_ember_ward1',
    name: 'Relight the Sun-Ward',
    giverNpcId: 'ember_wayfinder',
    turnInNpcId: 'ember_wayfinder',
    text: 'The first sun-ward stands broken on the dune road north of the Caravanserai, $N, and Sand Stalkers have made a nest of its fallen stones. Cull six of them and gather three ward-shards from the wreck, and I can rebind the ward and give the dead one length of road they cannot walk.',
    completionText:
      'The ward-stone drinks the shards and catches light, and for the first time in a long age one stretch of the dune road throws a shadow. It is a small dark, $N, but it is a start. The dead will not cross it.',
    objectives: [
      { type: 'kill', targetMobId: 'sand_stalker', count: 6, label: 'Sand Stalkers culled' },
      { type: 'collect', itemId: 'ember_ward_shard', count: 3, label: 'Sun-Ward Shards gathered' },
    ],
    xpReward: 2400,
    copperReward: 950,
    itemRewards: {},
    minLevel: 8,
  },
  q_ember_ward2: {
    id: 'q_ember_ward2',
    name: 'The Buried Sun-Ward',
    giverNpcId: 'ember_glassmaker',
    turnInNpcId: 'ember_glassmaker',
    text: 'The second sun-ward lies half-buried in the collapsed slot canyon north of the Reach, $N, and the Glassback Basilisks have denned in the rubble atop it. Thin their number, five should do, and cut down eight of the Canyon Shrikes that scream any digger off the ridgeline. Clear me a path and I can climb down to the ward myself.',
    completionText:
      'The ridge is quiet and the den is broken, $N. I got down to the ward and cleared the sand from its focus-stone: the second of three, dark as the first was. Two relit, one to go, and the last is where the cult keeps its fire.',
    objectives: [
      {
        type: 'kill',
        targetMobId: 'glassback_basilisk',
        count: 5,
        label: 'Glassback Basilisks culled',
      },
      { type: 'kill', targetMobId: 'canyon_shrike', count: 8, label: 'Canyon Shrikes downed' },
    ],
    xpReward: 3200,
    copperReward: 1300,
    itemRewards: {},
    requiresQuest: 'q_ember_ward1',
    minLevel: 11,
  },
  q_ember_ward3: {
    id: 'q_ember_ward3',
    name: 'The Cult of the Standing Sun',
    giverNpcId: 'ember_glassmaker',
    turnInNpcId: 'ember_glassmaker',
    text: 'Now you know why the sun will not set, $N: the third sun-ward is no ruin. The Ember-cult keeps it lit on purpose, at their amphitheater up in Cinderreach, and every Ashen Zealot there feeds the fire that holds the day. Break their circle. Cut down ten of the zealots and shatter four of the Cinder Golems they raise from the slag, and I will know how deep this goes.',
    completionText:
      'Ten zealots down and their golems slagged, and still the sun hangs there, $N. So it is true: the ward here is not broken, it is being HELD, and the anchor is not on the surface at all. It runs down, into the old tomb-city under the dunes. That is where this ends.',
    objectives: [
      { type: 'kill', targetMobId: 'ashen_zealot', count: 10, label: 'Ashen Zealots cut down' },
      { type: 'kill', targetMobId: 'cinder_golem', count: 4, label: 'Cinder Golems shattered' },
    ],
    xpReward: 4200,
    copperReward: 1700,
    itemRewards: {},
    requiresQuest: 'q_ember_ward2',
    minLevel: 14,
  },
  q_ember_finale: {
    id: 'q_ember_finale',
    name: 'Where the Sun Goes Down',
    giverNpcId: 'ember_glassmaker',
    turnInNpcId: 'ember_glassmaker',
    text: 'The anchor runs down into The Buried Dynasty, $N, the tomb-city drowned under the dunes, and at its heart the Scarab Broodmother coils around the ritual that holds the sun aloft. This is no errand for one blade: gather companions, go down through the cult amphitheater, and break the Broodmother and her brood. Put out the standing sun.',
    completionText:
      'It is done, $N. The Broodmother lies still, the ritual-fire gutters, and above the dunes the sun slides down toward a horizon it has not touched in an age. The Caravanserai will see its first true dusk tonight, and its first cool dawn. You gave the Emberwastes back its night.',
    objectives: [
      {
        type: 'kill',
        targetMobId: 'scarab_broodmother',
        count: 1,
        label: 'The Scarab Broodmother slain',
      },
    ],
    xpReward: 5600,
    copperReward: 3200,
    itemRewards: {},
    requiresQuest: 'q_ember_ward3',
    minLevel: 16,
    suggestedPlayers: 3,
  },
};

export const EMBERWASTES_QUEST_ORDER = [
  'q_ember_ward1',
  'q_ember_ward2',
  'q_ember_ward3',
  'q_ember_finale',
];

// ---------------------------------------------------------------------------
// World layout, the Sunmourn Dunes camps (append LAST in data.ts for world-gen
// determinism; every position sits in the realm band around the Caravanserai).
// ---------------------------------------------------------------------------

export const EMBERWASTES_CAMPS: CampDef[] = [
  // Sunmourn Dunes (z < 200)
  { mobId: 'dust_scarab', center: { x: 12040, z: 70 }, radius: 14, count: 6 },
  { mobId: 'dust_scarab', center: { x: 11955, z: -30 }, radius: 13, count: 5 },
  { mobId: 'sand_stalker', center: { x: 12085, z: 130 }, radius: 12, count: 4 },
  { mobId: 'sand_stalker', center: { x: 11915, z: 95 }, radius: 12, count: 4 },
  { mobId: 'sunbleached_husk', center: { x: 12055, z: -95 }, radius: 12, count: 4 },
  // The Glass Canyons (200 < z < 480): shrike flocks on the ridgelines, basilisks
  // denned in the slot canyon north of the Reach, the Mirage Djinn roaming alone.
  { mobId: 'canyon_shrike', center: { x: 12060, z: 260 }, radius: 14, count: 5 },
  { mobId: 'canyon_shrike', center: { x: 11940, z: 300 }, radius: 13, count: 5 },
  { mobId: 'glassback_basilisk', center: { x: 12030, z: 420 }, radius: 16, count: 3 },
  { mobId: 'glassback_basilisk', center: { x: 11950, z: 440 }, radius: 12, count: 2 },
  { mobId: 'mirage_djinn', center: { x: 12000, z: 460 }, radius: 6, count: 1 },
  // Cinderreach (480 < z < 780): emberling swarms in the ash drifts, the Ashen
  // Cult massed at their amphitheater, Cinder Golems looming on the vents to the north.
  { mobId: 'emberling', center: { x: 12045, z: 540 }, radius: 15, count: 6 },
  { mobId: 'emberling', center: { x: 11950, z: 575 }, radius: 14, count: 6 },
  { mobId: 'ashen_zealot', center: { x: 12000, z: 640 }, radius: 16, count: 6 },
  { mobId: 'ashen_zealot', center: { x: 11945, z: 665 }, radius: 13, count: 5 },
  { mobId: 'cinder_golem', center: { x: 12055, z: 710 }, radius: 14, count: 3 },
];

// ---------------------------------------------------------------------------
// The Buried Dynasty instance (reuses the shared 'crypt' interior, zero render
// work, like the Sunken Mausoleum): paired Mummified Guards and Tombscarab
// Clusters down the tomb-nave, then the Scarab Broodmother on the ritual dais.
// The door stands at the cult amphitheater in Cinderreach; the instance origin
// sits in its own far x-band (index 9), clear of every other band and the realm.
// ---------------------------------------------------------------------------

const BURIED_DYNASTY_SPAWNS: DungeonSpawn[] = [
  // the tomb-nave
  { mobId: 'mummified_guard', x: -3, z: 14 },
  { mobId: 'tombscarab_cluster', x: 3, z: 15 },
  { mobId: 'mummified_guard', x: -6, z: 30 },
  { mobId: 'tombscarab_cluster', x: 5, z: 31 },
  { mobId: 'mummified_guard', x: -5, z: 44 },
  { mobId: 'tombscarab_cluster', x: 4, z: 45 },
  // the inner vaults (past the waist arch)
  { mobId: 'mummified_guard', x: -4, z: 60 },
  { mobId: 'tombscarab_cluster', x: 2, z: 61 },
  { mobId: 'mummified_guard', x: 7, z: 74 },
  { mobId: 'tombscarab_cluster', x: -7, z: 75 },
  // the ritual dais
  { mobId: 'scarab_broodmother', x: 0, z: 88 },
  { mobId: 'mummified_guard', x: -4, z: 86 },
  { mobId: 'mummified_guard', x: 4, z: 86 },
];

export const BURIED_DYNASTY_DUNGEON_DEFS: Record<string, DungeonDef> = {
  the_buried_dynasty: {
    id: 'the_buried_dynasty',
    name: 'The Buried Dynasty',
    index: 9, // instance origin x = 900 + 9*600 (its own far band, clear of the realm)
    doorPos: { x: 12000, z: 720 }, // the cult amphitheater in Cinderreach
    entry: { x: 0, z: 4 },
    exitOffset: { x: 0, z: -6 },
    spawns: BURIED_DYNASTY_SPAWNS,
    interior: 'crypt',
    suggestedPlayers: 3,
    enterText:
      'You descend past the guttering ritual-fire into cold sandstone and the dry rasp of a thousand scarabs, down where the old dynasty was buried with its dead sun.',
    leaveText: 'You climb back up through the amphitheater into the standing light.',
  },
};
