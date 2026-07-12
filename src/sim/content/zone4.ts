// Zone 4, The Dam (levels 1-6). A hidden southern hollow where a colony of
// galaxy-blue Beavers dammed a river and built a driftwood-and-neon shanty town.
// Fan-tribute content inspired by the Baked Beavers community; all names,
// narrative, and art cues are original (no copied text or assets). Tone: warm,
// irreverent, Arizona-mountain-snowboard street-art. Motto: "Stay Baked, AZ."
//
// This is a newcomer side-band SOUTH of Eastbrook Vale: the world strip is
// contiguous, so The Dam occupies z in [-540, -180) and is PREPENDED to ZONES in
// data.ts (ZONE4_ZONE first), which extends WORLD_MIN_Z to -540. Its camps are
// APPENDED LAST in data.ts CAMPS to preserve every existing zone's RNG draw order.
//
// Future holder/cosmetic reward hooks are marked `// BEAVER-PHASE3` and are NOT
// implemented here: the Beaver galaxy-blue skin/title gate rides the engine's
// existing holder_tier / discord_tier config in a later phase, not new code.

import type {
  CampDef,
  GroundObjectDef,
  ItemDef,
  MobTemplate,
  NpcDef,
  QuestDef,
  ZoneDef,
  ZonePropsDef,
} from '../types';

export const ZONE4_ZONE: ZoneDef = {
  id: 'the_dam',
  name: 'The Dam',
  zMin: -540,
  zMax: -180,
  // A first-steps newcomer pocket. The quests pace levels 1-4; the feral
  // "Overbaked" beavers (level 5-6) prowl the ridge trail to the south as an
  // intentional "come back stronger" frontier, so the lived band runs 1 to 6.
  levelRange: [1, 4],
  biome: 'marsh',
  hub: { x: 0, z: -300, radius: 20, name: 'The Dam' },
  graveyard: { x: 16, z: -286 },
  // Reservoir sits west of the dam so the south road (x=0) stays on dry ground.
  lakes: [{ x: -48, z: -352, radius: 24 }],
  pois: [
    { x: 0, z: -300, label: 'The Dam' },
    { x: 44, z: -316, label: 'The Tanque' },
    { x: -58, z: -318, label: 'Driftwood Row' },
    { x: -40, z: -284, label: 'The Blue Grows' },
    { x: -48, z: -352, label: 'The Reservoir' },
    { x: 44, z: -360, label: 'Snapper Shallows' },
    { x: 0, z: -470, label: 'Frozen Ridges Trail' },
  ],
  welcome: 'Nobody invited the Beavers. Boone Cascade waves you in anyway. Stay Baked, AZ.',
  // Drives the newcomer onboarding overlay (move -> seek -> talk -> slay -> return):
  // Boone's first quest must carry a kill objective, so it points at the haze critters.
  welcomeQuestId: 'q_welcome_dam',
};

// Road up from Eastbrook Vale (z = -180 pass) south to The Dam, then spokes out
// to the reservoir and the ridge trail. The x=0 crossing at z=-180 keeps the
// mountain-pass ridge between the Vale and The Dam walkable.
export const ZONE4_ROADS: { x: number; z: number }[][] = [
  [
    { x: 0, z: -180 },
    { x: 0, z: -240 },
    { x: 0, z: -300 },
  ], // Eastbrook Vale -> The Dam
  [
    { x: 6, z: -304 },
    { x: 30, z: -312 },
    { x: 44, z: -316 },
  ], // -> The Tanque
  [
    { x: -6, z: -304 },
    { x: -40, z: -314 },
    { x: -58, z: -318 },
  ], // -> Driftwood Row
  [
    { x: 0, z: -312 },
    { x: 0, z: -400 },
    { x: 0, z: -470 },
  ], // -> Frozen Ridges Trail
];

// ---------------------------------------------------------------------------
// Mobs (all new, on-theme, low-level beasts. Mob STATS are not abilities, so
// they are safe to author to fidelity feel without cross-referencing spell ranks.)
// ---------------------------------------------------------------------------

export const ZONE4_MOBS: Record<string, MobTemplate> = {
  // Little drifting motes of blue haze that thickened into something almost
  // alive over the reservoir. Barely a threat; the first thing a newcomer swats.
  haze_critter: {
    id: 'haze_critter',
    name: 'Haze Critter',
    minLevel: 1,
    maxLevel: 2,
    family: 'beast',
    hpBase: 20,
    hpPerLevel: 10,
    dmgBase: 2,
    dmgPerLevel: 1.2,
    attackSpeed: 2.2,
    armorPerLevel: 8,
    moveSpeed: 7,
    aggroRadius: 8,
    loot: [{ copper: 24, chance: 1 }],
    scale: 0.7,
    color: 0x6fa8dc,
  },
  // Snapping driftwood turtles that lurk in the shallows below the dam. Slow,
  // stubborn, and carry chips of the good blue driftwood the Beavers build with.
  driftwood_snapper: {
    id: 'driftwood_snapper',
    name: 'Driftwood Snapper',
    minLevel: 3,
    maxLevel: 4,
    family: 'beast',
    hpBase: 34,
    hpPerLevel: 15,
    dmgBase: 4,
    dmgPerLevel: 1.8,
    attackSpeed: 2.4,
    armorPerLevel: 12,
    moveSpeed: 6,
    aggroRadius: 9,
    loot: [{ copper: 40, chance: 1 }],
    scale: 0.9,
    color: 0x8b7355,
  },
  // A Beaver that dipped too deep into the blue strain and went feral: puffed up,
  // glowing, and grumpy. The tough of the newcomer zone, met on the ridge trail.
  overbaked_beaver: {
    id: 'overbaked_beaver',
    name: 'Overbaked Beaver',
    minLevel: 5,
    maxLevel: 6,
    family: 'beast',
    hpBase: 48,
    hpPerLevel: 18,
    dmgBase: 6,
    dmgPerLevel: 2.0,
    attackSpeed: 2.0,
    armorPerLevel: 12,
    moveSpeed: 8,
    aggroRadius: 10,
    loot: [{ copper: 70, chance: 1 }],
    scale: 1.05,
    color: 0x5b6ee1,
  },
};

// ---------------------------------------------------------------------------
// NPCs (galaxy-blue Beavers of The Dam)
// ---------------------------------------------------------------------------

export const ZONE4_NPCS: Record<string, NpcDef> = {
  // Elder and hub quest-giver. Waves everyone in, hands out the first trail.
  boone_cascade: {
    id: 'boone_cascade',
    name: 'Boone Cascade',
    title: 'Elder of The Dam',
    pos: { x: 0, z: -296 },
    facing: 0,
    color: 0x5b6ee1,
    questIds: ['q_welcome_dam'],
    greeting:
      "Well, look who wandered down off the map, $N. Our dam is here now, and you're already invited. Haze critters are thick off the reservoir, though. Swat a few for us and the fire's all yours.",
  },
  // Grower and the closest thing The Dam has to a merchant: she runs the blue
  // grows and is the only Beaver who bothers counting anything.
  // BEAVER-PHASE3: gate a galaxy-blue Beaver cosmetic on her stock behind the
  // engine's existing holder_tier / discord_tier config; not implemented here.
  sequoia_marsh: {
    id: 'sequoia_marsh',
    name: 'Sequoia Marsh',
    title: 'Keeper of the Blue Grows',
    pos: { x: -8, z: -303 },
    facing: 0.6,
    color: 0x6fa8dc,
    questIds: ['q_dam_driftwood'],
    // Reuses existing newcomer consumables (no new items): the "blue bud" flavor
    // lives in her greeting, not a separate item record.
    vendorItems: ['baked_bread', 'spring_water', 'roasted_boar'],
    greeting:
      "Careful where you step, that patch runs hot and blue. You buying, or you working? Either way I've got a job needs doing, $N.",
  },
  // Raid-happy scout who cannot sit still. Points newcomers at whatever needs
  // thinning out today.
  ollie_ridgeback: {
    id: 'ollie_ridgeback',
    name: 'Ollie Ridgeback',
    title: 'Ridge Scout',
    pos: { x: 8, z: -303 },
    facing: -0.6,
    color: 0x4a7ebb,
    questIds: ['q_clear_haze'],
    greeting:
      "You board? Doesn't matter, you'll learn. Haze is thick off the water today, $N, and thick haze means critters. Grab a stick and help me thin it.",
  },
  // The voice of The Dam: runs the Beaver signal, a pirate broadcast that goes
  // out every week. Flavor NPC (a nod to their real weekly show).
  // BEAVER-PHASE3: a "Haze Rush" weekend kill-count leaderboard can hang off her
  // broadcast via existing event config; not implemented here.
  wren_alder: {
    id: 'wren_alder',
    name: 'Wren Alder',
    title: 'The Broadcast',
    pos: { x: 0, z: -308 },
    facing: 0,
    color: 0x7ba7e0,
    questIds: [],
    greeting:
      "You're live, whether you like it or not. Signal goes out Monday nights, the whole ridge tunes in. Stay Baked, AZ, $N, and try to say something worth broadcasting.",
  },
  // Oldest Beaver, lorekeeper. Remembers the ridge before the descent and speaks
  // in riddles that turn out to be directions. Stationed at The Tanque, so the
  // welcome quest walks the newcomer to the easter-egg watering hole.
  junie_stonewater: {
    id: 'junie_stonewater',
    name: 'Junie Stonewater',
    title: 'Keeper of the Old Ridge',
    pos: { x: 44, z: -316 },
    facing: 3.0,
    color: 0x9fc0ea,
    questIds: [],
    greeting:
      "Boone sent you to the Tanque, did he. Good. Sit. We came down the frozen ridges on boards with a half-built dam behind us, and we never once looked back. That's the whole story. The rest is just smoke.",
  },
};

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export const ZONE4_QUESTS: Record<string, QuestDef> = {
  // The newcomer's first steps (drives the onboarding overlay): Boone waves you
  // in and points at the haze critters over the reservoir. Kill objective so the
  // "slay" tutorial step has a target; giver and turn-in are both Boone at the hub.
  q_welcome_dam: {
    id: 'q_welcome_dam',
    name: 'Welcome to The Dam',
    giverNpcId: 'boone_cascade',
    turnInNpcId: 'boone_cascade',
    text: "First rule of The Dam, $N: nobody earns their spot by sitting still. The haze off the reservoir has clumped into critters again, thick along the water. Swat six of them and come warm up by the fire. Then go hear Junie's story at The Tanque, if you want the whole of it.",
    completionText:
      "Six critters lighter and you're still standing. That's the whole trial, $N. Seat by the fire's yours, free of charge. You're one of us now. Stay Baked, AZ.",
    objectives: [
      { type: 'kill', targetMobId: 'haze_critter', count: 6, label: 'Haze Critter swatted' },
    ],
    xpReward: 300,
    copperReward: 120,
    itemRewards: {},
  },
  // Follow-up kill: Ollie wants the reservoir critters properly thinned. Reward is
  // a healthy purse of copper (a newcomer's first real coin); the "blue bud" snack
  // stays flavor in the completion text, no new item record.
  q_clear_haze: {
    id: 'q_clear_haze',
    name: 'Clear the Haze',
    giverNpcId: 'ollie_ridgeback',
    turnInNpcId: 'ollie_ridgeback',
    text: "Boone had you swat a few, but the haze keeps rolling thick off the reservoir and clumping right back, $N. Annoying little things, and they spook the newer folk. Knock out ten of them along the water and I'll cut you in on the good stash.",
    completionText:
      "Ten down, air's already clearer. Here's your cut, and a pull off Seq's own patch on the house. Runs hot. Don't burn out before your first hill.",
    objectives: [
      { type: 'kill', targetMobId: 'haze_critter', count: 10, label: 'Haze Critter dispersed' },
    ],
    xpReward: 600,
    copperReward: 250,
    itemRewards: {},
  },
  // Kill objective: the snapping driftwood turtles below the dam keep chewing up
  // the blue driftwood Seq needs for her grows. Thin them out.
  q_dam_driftwood: {
    id: 'q_dam_driftwood',
    name: 'Snapping Driftwood',
    giverNpcId: 'sequoia_marsh',
    turnInNpcId: 'sequoia_marsh',
    text: "The dam's leaking blue and my grows are half in the wet, $N. I'd patch it with good driftwood, but those snappers down in the shallows chew every board I float. Cull ten of them and I can shore the beds up myself. Mind the jaws.",
    completionText:
      "Ten fewer sets of teeth in my driftwood. The beds will dry out now. You've got a steady hand for a newcomer. Come back when your boots are drier and I'll teach you the grow.",
    objectives: [
      {
        type: 'kill',
        targetMobId: 'driftwood_snapper',
        count: 10,
        label: 'Driftwood Snapper culled',
      },
    ],
    xpReward: 700,
    copperReward: 300,
    itemRewards: {},
    minLevel: 3,
  },
};

export const ZONE4_QUEST_ORDER = ['q_welcome_dam', 'q_clear_haze', 'q_dam_driftwood'];

// ---------------------------------------------------------------------------
// World layout. NOTE: these camps are APPENDED LAST in data.ts CAMPS so every
// existing zone keeps its exact world-gen RNG draw order (determinism).
// ---------------------------------------------------------------------------

export const ZONE4_CAMPS: CampDef[] = [
  // Haze critters drift over the reservoir and along the near shore
  { mobId: 'haze_critter', center: { x: -18, z: -330 }, radius: 18, count: 6 },
  { mobId: 'haze_critter', center: { x: 22, z: -338 }, radius: 18, count: 6 },
  { mobId: 'haze_critter', center: { x: 0, z: -358 }, radius: 16, count: 5 },
  // Driftwood snappers in the shallows below the dam, east
  { mobId: 'driftwood_snapper', center: { x: 58, z: -358 }, radius: 16, count: 5 },
  { mobId: 'driftwood_snapper', center: { x: 40, z: -378 }, radius: 14, count: 4 },
  // Overbaked beavers gone feral along the ridge trail, south
  { mobId: 'overbaked_beaver', center: { x: -14, z: -440 }, radius: 18, count: 5 },
  { mobId: 'overbaked_beaver', center: { x: 12, z: -470 }, radius: 16, count: 5 },
];

export const ZONE4_OBJECTS: GroundObjectDef[] = [];

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

// The Dam ships NO new item records: quests reward copper + XP, and the vendor
// (Sequoia Marsh) stocks existing newcomer consumables. This keeps the slice out
// of the fully-translated item catalog (src/ui/i18n.catalog/items.ts) so it stays
// a clean English-only content add. Themed items (the "Blue Bud Nug" snack, a
// Tanque keepsake) can be added later as their own change with full locale fills.
// BEAVER-PHASE3: a galaxy-blue Beaver cosmetic/title rides the engine's existing
// holder_tier / discord_tier config, not new item or engine code here.
export const ZONE4_ITEMS: Record<string, ItemDef> = {};

// ---------------------------------------------------------------------------
// Props (driftwood-and-neon shanty town around the hub + The Tanque)
// ---------------------------------------------------------------------------

export const ZONE4_PROPS: ZonePropsDef = {
  buildings: [
    { kind: 'house', x: 12, z: -298, w: 6, d: 5, rot: -0.4 },
    { kind: 'house', x: -12, z: -298, w: 6, d: 5, rot: 0.5 },
    { kind: 'house', x: 16, z: -308, w: 5, d: 5, rot: 1.1 },
    { kind: 'inn', x: 44, z: -316, w: 7, d: 7, rot: -0.7 }, // The Tanque
    { kind: 'house', x: -58, z: -318, w: 6, d: 5, rot: 0.8 }, // Driftwood Row
  ],
  wells: [{ x: 0, z: -302, r: 1.5 }],
  stalls: [
    { x: -8, z: -306, rot: Math.PI / 2, r: 1.7 }, // Sequoia Marsh (grow stall)
    { x: 8, z: -306, rot: -0.6, r: 1.7 }, // Ollie Ridgeback
  ],
  mines: [],
  docks: [],
  tents: [
    { x: -54, z: -322, rot: 0.6, scale: 1 },
    { x: -62, z: -314, rot: 2.1, scale: 1 },
    { x: 48, z: -322, rot: -0.5, scale: 1 },
  ],
  crates: [
    [-10, -300],
    [10, -300],
    [42, -318],
  ],
  campfires: [
    [0, -294], // the first fire, hub center
    [44, -318], // The Tanque fire
    [-58, -320], // Driftwood Row fire
  ],
  mudHuts: [],
  ruinRings: [],
  fences: [
    { x1: -14, z1: -290, x2: -4, z2: -288 }, // north gate, east run
    { x1: 4, z1: -288, x2: 14, z2: -290 }, // north gate, west run
  ],
  graveyards: [{ x: 16, z: -286 }],
  // The namesake gag: an absurdly huge beaver dam holding back The Reservoir,
  // dwarfing the driftwood town named after it. A U of stacked logs wrapping the
  // reservoir (the pond nearest Bloomhaven, at x=-48,z=-352,r=24): a north, a west,
  // and a south arm hugging the bank just outside the waterline, open to the EAST
  // toward the town approach so the whole pond reads as embraced by the dam on
  // arrival. Each entry is one crest LINE (x1,z1)->(x2,z2); the render mesh AND the
  // OBB collider (colliders.ts) share it, so barrier == geometry. render/props.ts
  // perches the single beaver mascot on the MIDDLE segment (index 1, the west arm).
  // The east side is left open because the haze_critter camps sit there; the
  // world-gen rng draw order shifts slightly where the arms meet camp footprints,
  // so the parity goldens are regenerated with this change. 9m tall stacked logs.
  beaverDams: [
    { x1: -73, z1: -326, x2: -24, z2: -326, h: 9 }, // north arm
    { x1: -73, z1: -326, x2: -73, z2: -378, h: 9 }, // west arm (carries the beaver)
    { x1: -73, z1: -378, x2: -24, z2: -378, h: 9 }, // south arm
  ],
};
