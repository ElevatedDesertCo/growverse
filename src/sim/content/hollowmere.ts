// Hollowmere, a haunted-graveyard side-wing on the drowned western edge of the
// Sunken Wastes. Where the Phase 0 haunted fen (Grinning Jack, the Marsh Hag)
// first stirred, an old plague-drowned village will not rest: its dead climb out
// of the bog each dusk, and the last survivors keep a lantern-lit vigil at
// Wispford, the hamlet at the graveyard's edge. Reuses the Halloween/Spooktober
// bodies and props; the dungeon reuses the shared 'crypt' interior (zero render
// work), exactly like the Sunken Bastion and Blightroot Hollow.
//
// A self-contained wing, merged into the flat engine tables by sim/data.ts the
// same way temple.ts and the per-zone modules are. Level band ~9 to 13, bridging
// the Sunken Wastes (6 to 13) into Thornreach Heights. Nothing here touches the
// Gravecaller storyline of the main zones.

import type {
  CampDef,
  DungeonDef,
  DungeonSpawn,
  MobTemplate,
  NpcDef,
  QuestDef,
  ZonePropsDef,
} from '../types';

// The grave-gate (the Sunken Mausoleum door) sits at the north end of the
// Hollowmere graveyard, in the drowned western pocket of the marsh.
export const GRAVEGATE_POS = { x: -146, z: 452 };

// ---------------------------------------------------------------------------
// Mobs, overworld (the Hollowmere fen and graveyard)
// ---------------------------------------------------------------------------

export const HOLLOWMERE_MOBS: Record<string, MobTemplate> = {
  wispford_dead: {
    id: 'wispford_dead',
    name: 'Wispford Dead',
    minLevel: 9,
    maxLevel: 10,
    family: 'undead',
    hpBase: 48,
    hpPerLevel: 18,
    dmgBase: 8,
    dmgPerLevel: 2.2,
    attackSpeed: 2.1,
    armorPerLevel: 12,
    moveSpeed: 6.5,
    aggroRadius: 11,
    loot: [
      { copper: 55, chance: 1 },
      { itemId: 'linen_scrap', chance: 0.4 },
    ],
    scale: 1.0,
    color: 0x8b9c86,
  },
  fen_revenant: {
    id: 'fen_revenant',
    name: 'Fen Revenant',
    minLevel: 10,
    maxLevel: 11,
    family: 'undead',
    hpBase: 58,
    hpPerLevel: 20,
    dmgBase: 9,
    dmgPerLevel: 2.4,
    attackSpeed: 2.2,
    armorPerLevel: 15,
    moveSpeed: 6.5,
    aggroRadius: 11,
    loot: [
      { copper: 70, chance: 1 },
      { itemId: 'bone_fragments', chance: 0.4 },
    ],
    scale: 1.08,
    color: 0x6f8a72,
  },
  hexbound_crone: {
    id: 'hexbound_crone',
    name: 'Hexbound Crone',
    minLevel: 10,
    maxLevel: 11,
    family: 'humanoid',
    hpBase: 50,
    hpPerLevel: 19,
    dmgBase: 9,
    dmgPerLevel: 2.4,
    attackSpeed: 2.4,
    armorPerLevel: 12,
    moveSpeed: 7,
    aggroRadius: 12,
    soulrot: {
      chance: 0.3,
      perTick: 3,
      interval: 2,
      duration: 8,
      name: 'Withering Hex',
      school: 'shadow',
    },
    loot: [
      { copper: 80, chance: 1 },
      { itemId: 'tallow_candle', chance: 0.3 },
    ],
    scale: 1.0,
    color: 0x7a6f92,
  },
  grave_sentinel: {
    id: 'grave_sentinel',
    name: 'Grave Sentinel',
    minLevel: 12,
    maxLevel: 12,
    family: 'humanoid',
    rare: true,
    hpBase: 165,
    hpPerLevel: 24,
    dmgBase: 12,
    dmgPerLevel: 2.6,
    attackSpeed: 2.3,
    armorPerLevel: 18,
    moveSpeed: 6.5,
    aggroRadius: 13,
    cinder: {
      chance: 0.25,
      perTick: 4,
      interval: 2,
      duration: 6,
      name: 'Guttering Ember',
      school: 'fire',
    },
    loot: [
      { copper: 380, chance: 1 },
      { itemId: 'deepfen_pearl', chance: 0.5 },
      { itemId: 'tallow_candle', chance: 0.6 },
    ],
    scale: 1.2,
    color: 0xd98a3a,
  },
};

// ---------------------------------------------------------------------------
// Mobs, instanced (The Sunken Mausoleum, 5-player elite)
// ---------------------------------------------------------------------------

export const MAUSOLEUM_DUNGEON_MOBS: Record<string, MobTemplate> = {
  mausoleum_shambler: {
    id: 'mausoleum_shambler',
    name: 'Mausoleum Shambler',
    minLevel: 11,
    maxLevel: 12,
    family: 'undead',
    elite: true,
    hpBase: 50,
    hpPerLevel: 19,
    dmgBase: 10,
    dmgPerLevel: 2.4,
    attackSpeed: 2.3,
    armorPerLevel: 16,
    moveSpeed: 6,
    aggroRadius: 12,
    loot: [
      { copper: 160, chance: 1 },
      { itemId: 'bone_fragments', chance: 0.5 },
      { itemId: 'linen_scrap', chance: 0.4 },
    ],
    scale: 1.08,
    color: 0x86977f,
  },
  crypt_hexward: {
    id: 'crypt_hexward',
    name: 'Crypt Hexward',
    minLevel: 11,
    maxLevel: 12,
    family: 'humanoid',
    elite: true,
    hpBase: 48,
    hpPerLevel: 18,
    dmgBase: 10,
    dmgPerLevel: 2.4,
    attackSpeed: 2.3,
    armorPerLevel: 13,
    moveSpeed: 7,
    aggroRadius: 12,
    soulrot: {
      chance: 0.3,
      perTick: 4,
      interval: 2,
      duration: 8,
      name: 'Grave Hex',
      school: 'shadow',
    },
    loot: [
      { copper: 175, chance: 1 },
      { itemId: 'tallow_candle', chance: 0.4 },
    ],
    scale: 1.0,
    color: 0x796d90,
  },
  bonepile_horror: {
    id: 'bonepile_horror',
    name: 'Bonepile Horror',
    minLevel: 12,
    maxLevel: 13,
    family: 'undead',
    elite: true,
    hpBase: 62,
    hpPerLevel: 21,
    dmgBase: 11,
    dmgPerLevel: 2.6,
    attackSpeed: 2.5,
    armorPerLevel: 18,
    moveSpeed: 5.5,
    aggroRadius: 12,
    loot: [
      { copper: 220, chance: 1 },
      { itemId: 'bone_fragments', chance: 0.6 },
      { itemId: 'deepfen_pearl', chance: 0.3 },
    ],
    scale: 1.18,
    color: 0x9aa889,
  },
  pumpkin_spriteling: {
    id: 'pumpkin_spriteling',
    name: 'Pumpkin Spriteling',
    minLevel: 12,
    maxLevel: 12,
    family: 'humanoid',
    hpBase: 34,
    hpPerLevel: 12,
    dmgBase: 7,
    dmgPerLevel: 2.0,
    attackSpeed: 2.0,
    armorPerLevel: 8,
    moveSpeed: 8,
    aggroRadius: 11,
    loot: [], // summoned by the Pumpkin King, nothing to loot
    scale: 0.72,
    color: 0xe08a2e,
  },
  grinning_king: {
    id: 'grinning_king',
    name: 'The Pumpkin King',
    minLevel: 13,
    maxLevel: 13,
    family: 'humanoid',
    elite: true,
    boss: true,
    hpBase: 280,
    hpPerLevel: 34,
    dmgBase: 13,
    dmgPerLevel: 2.8,
    attackSpeed: 2.5,
    armorPerLevel: 22,
    moveSpeed: 6.5,
    aggroRadius: 18,
    aoePulse: { min: 18, max: 28, radius: 12, every: 9, name: 'Bonfire Grin' },
    summonAdds: { mobId: 'pumpkin_spriteling', count: 2, atHpPct: [0.6, 0.3] },
    enrage: { belowHpPct: 0.3, dmgMult: 1.35, hasteMult: 1.25 },
    // Reuses existing level-13-sourced rare gear (tidescale_vest + gravepath_treads
    // both derive item level 16 at the boss's level) plus a bonus Upgrade-Bench
    // reagent. Item level is derived from the dropping mob (src/sim/item_level.ts),
    // so the boss must NOT drop lower-tier showcase gear (that inflates its level).
    loot: [
      { copper: 4200, chance: 1 },
      { itemId: 'tidescale_vest', chance: 0.45 },
      { itemId: 'gravepath_treads', chance: 0.45 },
      { itemId: 'corruption_shard', chance: 0.5 },
    ],
    scale: 1.6,
    color: 0xe88a2a,
  },
};

// ---------------------------------------------------------------------------
// NPCs, the Wispford survivors
// ---------------------------------------------------------------------------

export const HOLLOWMERE_NPCS: Record<string, NpcDef> = {
  morvenna_hedgewitch: {
    id: 'morvenna_hedgewitch',
    name: 'Morvenna',
    title: 'the Hedgewitch',
    pos: { x: -137, z: 428 },
    facing: 2.2,
    color: 0x7a6f92,
    questIds: ['q_hollowmere_revenants', 'q_hollowmere_sentinel'],
    vendorItems: [
      'lesser_healing_potion',
      'lesser_mana_potion',
      'marsh_mint_tea',
      'silvermist_cordial',
    ],
    greeting:
      'Keep to the lantern-light, $C. The bog gives up its dead at dusk, and the wards I bind hold only while the tallow burns. Bring me what I ask, and I will keep Wispford breathing one more night.',
  },
  gravewarden_holt: {
    id: 'gravewarden_holt',
    name: 'Holt',
    title: 'the Gravewarden',
    pos: { x: -143, z: 436 },
    facing: 0.9,
    color: 0x6f7a6b,
    questIds: ['q_hollowmere_risen', 'q_hollowmere_crones', 'q_hollowmere_pumpkin_king'],
    greeting:
      'I buried most of these people myself, $N, and now I put them back in the ground a second time. The grave-gate at the north end has not been sealed in a lifetime. Something below it is doing the raising.',
  },
};

// ---------------------------------------------------------------------------
// Quests, a soloable vigil on the surface then a 5-player finale below
// ---------------------------------------------------------------------------

// A soloable kill-based vigil on the surface, then a 5-player finale below the
// grave-gate. Every reward reuses an existing (already-localized) item, and no
// quest introduces a new item entity, so the chain adds zero item-localization
// burden (the gather/harvest loop is deliberately deferred to Phase 3).
export const HOLLOWMERE_QUESTS: Record<string, QuestDef> = {
  q_hollowmere_risen: {
    id: 'q_hollowmere_risen',
    name: 'The Restless Fen',
    giverNpcId: 'gravewarden_holt',
    turnInNpcId: 'gravewarden_holt',
    text: 'They climb out of the bog every dusk now, $N: the Wispford Dead, still in the rags we buried them in. Put ten of them back down before they reach the hamlet fence. It is grim work, but it is mercy.',
    completionText:
      'Ten laid back in the mud. They do not fight, $N, not really. They only walk toward the lights. Whatever calls them, it calls from below the grave-gate.',
    objectives: [
      { type: 'kill', targetMobId: 'wispford_dead', count: 10, label: 'Wispford Dead put down' },
    ],
    xpReward: 2400,
    copperReward: 900,
    itemRewards: {},
    minLevel: 9,
  },
  q_hollowmere_revenants: {
    id: 'q_hollowmere_revenants',
    name: "Morvenna's Wards",
    giverNpcId: 'morvenna_hedgewitch',
    turnInNpcId: 'morvenna_hedgewitch',
    text: 'The pale grave-moss my wards are bound with only takes root where the bog-touched dead have fallen, $N. The Fen Revenants trample it flat where they walk. Cut down eight along the graveyard edge, and the moss will creep back over the ground they held.',
    completionText:
      'The moss is already greening where they dropped. Good. The hamlet ring will hold another night, and the tallow to burn it. You have bought these people time, $N.',
    objectives: [
      { type: 'kill', targetMobId: 'fen_revenant', count: 8, label: 'Fen Revenant felled' },
    ],
    xpReward: 2600,
    copperReward: 1000,
    itemRewards: {},
    requiresQuest: 'q_hollowmere_risen',
    minLevel: 9,
  },
  q_hollowmere_crones: {
    id: 'q_hollowmere_crones',
    name: 'Light the Long Dark',
    giverNpcId: 'gravewarden_holt',
    turnInNpcId: 'gravewarden_holt',
    text: 'The old ward-lanterns line the road to the grave-gate, $N, and the Hexbound Crones creep it at dusk, snuffing every flame they pass so the dead can walk a dark road. Cut down six of them, and the wardlights will burn through the night again.',
    completionText:
      'The road glows once more, and the risen hang back from it, hissing. It will not hold forever, $N: something below is patient, and the flame is only tallow.',
    objectives: [
      { type: 'kill', targetMobId: 'hexbound_crone', count: 6, label: 'Hexbound Crone silenced' },
    ],
    xpReward: 2800,
    copperReward: 1100,
    itemRewards: {
      warrior: 'drogmar_warboots',
      mage: 'sableweb_slippers',
      rogue: 'moggers_stomper_boots',
    },
    requiresQuest: 'q_hollowmere_risen',
    minLevel: 10,
  },
  q_hollowmere_sentinel: {
    id: 'q_hollowmere_sentinel',
    name: 'The Grave Sentinel',
    giverNpcId: 'morvenna_hedgewitch',
    turnInNpcId: 'morvenna_hedgewitch',
    text: 'One thing on this fen is no risen corpse, $N: a Grave Sentinel, a bonfire-headed watchman the thing below set to guard the grave-gate road. While it stands, no one reaches the gate alive. It is a hard kill for one blade, but a rare chance to see what the deep dead fear enough to post a guard. End it.',
    completionText:
      'The grin guttered out, and the gate-road is open at last. Whatever crowned that sentinel, $N, it is close now. Holt will want to know the way down is clear.',
    objectives: [
      {
        type: 'kill',
        targetMobId: 'grave_sentinel',
        count: 1,
        label: 'The Grave Sentinel destroyed',
      },
    ],
    xpReward: 3200,
    copperReward: 1400,
    itemRewards: {
      warrior: 'bristleback_maul',
      mage: 'emberwood_staff',
      rogue: 'cultist_flayer',
    },
    requiresQuest: 'q_hollowmere_revenants',
    minLevel: 11,
  },
  q_hollowmere_pumpkin_king: {
    id: 'q_hollowmere_pumpkin_king',
    name: 'The Pumpkin King',
    giverNpcId: 'gravewarden_holt',
    turnInNpcId: 'gravewarden_holt',
    text: 'With the sentinel down and the gate-road open, we know what waits below, $N: in the Sunken Mausoleum, a bonfire-headed thing the old rhymes called the Pumpkin King has crowned itself king of the dead, raising every corpse in the fen to fill its court. Take companions down the grave-gate and cut the head off it. This is no errand for a lone blade.',
    completionText:
      'The grin goes dark, and above us the whole fen goes quiet at once, $N: every risen thing dropping back into the mud like a cut puppet. Wispford will bury its dead one last time, and this time they will stay. You gave these people their graveyard back.',
    objectives: [
      { type: 'kill', targetMobId: 'grinning_king', count: 1, label: 'The Pumpkin King slain' },
    ],
    xpReward: 4000,
    copperReward: 6000,
    itemRewards: {
      warrior: 'emberfang_warblade',
      mage: 'hollow_vigil_staff',
      rogue: 'nhalias_dirgeblade',
    },
    requiresQuest: 'q_hollowmere_sentinel',
    minLevel: 11,
    suggestedPlayers: 5,
  },
};

export const HOLLOWMERE_QUEST_ORDER = [
  'q_hollowmere_risen',
  'q_hollowmere_revenants',
  'q_hollowmere_crones',
  'q_hollowmere_sentinel',
  'q_hollowmere_pumpkin_king',
];

// ---------------------------------------------------------------------------
// World layout, the Hollowmere graveyard (drowned western pocket of the marsh)
// ---------------------------------------------------------------------------

export const HOLLOWMERE_CAMPS: CampDef[] = [
  { mobId: 'wispford_dead', center: { x: -152, z: 420 }, radius: 14, count: 6 },
  { mobId: 'wispford_dead', center: { x: -150, z: 448 }, radius: 13, count: 5 },
  { mobId: 'fen_revenant', center: { x: -133, z: 454 }, radius: 12, count: 4 },
  { mobId: 'hexbound_crone', center: { x: -149, z: 462 }, radius: 11, count: 4 },
  { mobId: 'grave_sentinel', center: { x: -156, z: 434 }, radius: 3, count: 1 },
];

// Static props for Wispford and its graveyard: a couple of survivor shelters at
// the hamlet, then headstone clusters and iron fencing along the grave rows up
// to the grave-gate (rendering + collision share this ZonePropsDef).
export const HOLLOWMERE_PROPS: ZonePropsDef = {
  buildings: [],
  wells: [{ x: -139, z: 430, r: 2 }],
  stalls: [],
  mines: [],
  docks: [],
  tents: [
    { x: -136, z: 426, rot: 2.1, scale: 1.1 },
    { x: -143, z: 433, rot: -0.6, scale: 1.0 },
  ],
  crates: [
    [-134, 430],
    [-140, 425],
  ],
  campfires: [[-138, 432]],
  mudHuts: [],
  ruinRings: [],
  fences: [
    { x1: -128, z1: 440, x2: -128, z2: 458 },
    { x1: -128, z1: 458, x2: -148, z2: 460 },
  ],
  graveyards: [
    { x: -133, z: 444 },
    { x: -139, z: 450 },
    { x: -145, z: 448 },
  ],
};

// ---------------------------------------------------------------------------
// The Sunken Mausoleum instance, reusing the shared 'crypt' interior: paired
// elite packs down the flooded nave, a Crypt Hexward holding the inner arch,
// then the Pumpkin King grinning on the tomb-dais with two Mausoleum Shamblers.
// ---------------------------------------------------------------------------

const MAUSOLEUM_SPAWN_LIST: DungeonSpawn[] = [
  // nave
  { mobId: 'mausoleum_shambler', x: -3, z: 14 },
  { mobId: 'mausoleum_shambler', x: 3, z: 15 },
  { mobId: 'crypt_hexward', x: -6, z: 30 },
  { mobId: 'mausoleum_shambler', x: 5, z: 31 },
  { mobId: 'bonepile_horror', x: -5, z: 44 },
  { mobId: 'crypt_hexward', x: 4, z: 45 },
  // inner tombs (past the waist arch)
  { mobId: 'crypt_hexward', x: -4, z: 60 },
  { mobId: 'mausoleum_shambler', x: 2, z: 61 },
  { mobId: 'bonepile_horror', x: 7, z: 74 },
  { mobId: 'mausoleum_shambler', x: -7, z: 75 },
  // the tomb-dais
  { mobId: 'grinning_king', x: 0, z: 88 },
  { mobId: 'mausoleum_shambler', x: -4, z: 86 },
  { mobId: 'mausoleum_shambler', x: 4, z: 86 },
];

export const MAUSOLEUM_DUNGEON_DEFS: Record<string, DungeonDef> = {
  sunken_mausoleum: {
    id: 'sunken_mausoleum',
    name: 'The Sunken Mausoleum',
    index: 8, // instance origin x = 900 + 8*600 = 6300 (clear of every other band)
    doorPos: { ...GRAVEGATE_POS }, // the grave-gate at the north end of the graveyard
    entry: { x: 0, z: 4 },
    exitOffset: { x: 0, z: -6 },
    spawns: MAUSOLEUM_SPAWN_LIST,
    interior: 'crypt',
    suggestedPlayers: 5,
    enterText:
      'You descend through the grave-gate into wet stone and the reek of tallow, and somewhere below, something is grinning in the dark.',
    leaveText: 'You climb the grave-gate stair back into the lantern-lit fen.',
  },
};
