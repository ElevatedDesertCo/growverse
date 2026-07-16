import {
  CAMPS,
  DUNGEON_FLOOR_Y,
  DUNGEON_X_THRESHOLD,
  PROPS,
  ROADS,
  realmAt,
  WORLD_MAX_X,
  WORLD_MAX_Z,
  WORLD_MIN_X,
  WORLD_MIN_Z,
  ZONES,
} from './data';
import { fbm2, hash2 } from './rng';
import type { BiomeId, RealmDef } from './types';

// Terrain is a pure function of (x, z, seed): both the sim (ground clamping)
// and the renderer (mesh) sample the same heightfield, so they always agree.
//
// The world is a north-running strip of zone bands (see ZONES in data.ts).
// Each biome shapes the heightfield differently — the vale rolls, the marsh
// lies low and flat, the peaks tower — with smooth blends at the boundaries
// and a mountain ridge wall between zones, pierced by a road pass.

const HILL_SCALE = 0.013;
const DETAIL_SCALE = 0.05;

export const WATER_LEVEL = -4.5;

// Hill amplitude / base elevation / hub plateau height per biome.
const BIOME_SHAPE: Record<BiomeId, { hill: number; base: number; hubHeight: number }> = {
  vale: { hill: 26, base: 0, hubHeight: 1.5 },
  marsh: { hill: 11, base: -1.0, hubHeight: 1.2 },
  peaks: { hill: 34, base: 7, hubHeight: 9 },
};

// Ridge walls between zone bands, each opened by a road pass.
const ZONE_RIDGES: { z: number; passX: number }[] = [];
for (let i = 0; i + 1 < ZONES.length; i++) {
  ZONE_RIDGES.push({ z: ZONES[i].zMax, passX: 0 });
}
const RIDGE_HEIGHT = 22;
const RIDGE_SIGMA = 18; // gaussian width of the wall
const PASS_HALF_WIDTH = 10; // flat opening around the road
const PASS_SHOULDER = 34; // ...rising to full wall by this far from the pass

export const MIREFEN_IMPACT_CRATER = {
  x: 149.5,
  z: 295,
  bowlRadius: 20,
  radius: 30,
  depth: 2.6,
  rimHeight: 0.95,
} as const;

// The Skeleton Grotto (zone1): a great hollow gouged into the foot of the western
// rim mountain, where the Hollow Crypt's undead now muster. It is a pure terrain
// primitive (no rng, no props, no colliders): a flat bowl floor pinned well below
// the rim, ringed by steep rock walls on three sides, with a single wide mouth
// opening EAST toward the vale (east is -x here). Applied LAST in terrainHeight so
// the floor carve WINS over the ambient world rim (like the Sluice river beats the
// peak). The walls rise faster than PLAYER_MAX_CLIMB_SLOPE, so they contain the
// player exactly the way the world rim does, and the renderer paints their steep,
// high faces as bare rock on its own. The crypt cave-mouth (DUNGEONS.hollow_crypt.
// doorPos) sits at the floor's west edge, set into the base of the back cliff.
export const SKELETON_GROTTO = {
  x: 150, // grotto center (foot of the western rim, well north of the Sluice)
  z: 84,
  floorY: 8, // flat floor height (a touch above the ambient vale field so the mouth grades out)
  bowlRadius: 22, // flat floor reach: the walkable encounter arena
  radius: 34, // outer reach: the rock-wall crest ring beyond the floor
  wallHeight: 16, // how far the enclosing rock wall rises above the floor on the walled arcs
} as const;

// A huge ruined stone fort planted on the Skeleton Grotto floor: the Wither Husk host
// musters inside it. It is a 1-of-1 landmark (like SLUICE_BRIDGE): this ONE const is the
// single source of truth that both the render mesh (render/fort.ts) and the movement
// colliders (colliders.ts) derive from, so the walls you see are exactly the walls you
// bump. It sits ENTIRELY on the flat grotto floor (every corner is within bowlRadius, so
// terrainHeight is a dead-flat floorY across the whole footprint) and needs NO terrain
// edit. A square curtain wall with a corner tower at each angle, a central keep, a FRONT
// gatehouse on the low-x (grotto mouth) side facing the player's approach, and a REAR
// sally-port on the high-x side lined up with the hollow_crypt cave-mouth (DUNGEONS.
// hollow_crypt.doorPos = 168,84) so the dungeon door stays reachable through the courtyard.
export const SKELETON_FORT = {
  x: 150, // centered on the grotto (SKELETON_GROTTO.x/z)
  z: 84,
  floorY: 8, // the flat grotto floor (SKELETON_GROTTO.floorY); the whole fort sits on it
  half: 14, // curtain-wall half-extent: a 28yd square, corners at d~19.8 (inside bowlRadius 22)
  wallH: 6, // curtain-wall height above the floor
  wallHalfThick: 0.7, // half thickness of the curtain walls (and gate/keep faces)
  merlonH: 1.0, // crenellation (merlon) rise above the wall walk
  gateHalf: 3.5, // FRONT gate opening half-width, in the low-x wall (the grotto mouth side)
  sallyHalf: 2.5, // REAR sally-port half-width, in the high-x wall (toward the crypt door)
  towerR: 2.4, // corner-tower radius
  towerH: 10, // corner-tower body height above the floor (a conical roof rises above)
  keepHalf: 4.5, // central keep half-extent (a 9yd square)
  keepH: 14, // central keep body height above the floor (a peaked roof + banner rises above)
} as const;

// The Sluice waterway (zone1): a millpond (carved as a lake in content) fed by a
// river that runs west, roughly level, all the way to a mountain at the world's
// edge where a waterfall spills into it. These are pure carve/raise primitives
// (no rng): the river lowers terrain below WATER_LEVEL so the per-zone water plane
// fills it for free, and a raised peak backs the falls. The pond, dam, and outpost
// that dress the east end live in src/sim/content/zone1.ts.
export const SLUICE_RIVER = {
  z: 24, // centerline; the channel stays roughly level (an east-west run)
  xEast: 34, // merges into the enlarged Sluice pond
  xWest: 150, // plunge pool at the foot of the western mountain
  halfWidth: 4.5, // flat channel half-width at the water line
  bank: 10, // banks blend back up to natural terrain by this distance
} as const;

// The mountain that backs the waterfall, at the river's west end. A gaussian peak
// (steeper and taller than the ambient world rim) whose east foot meets the river.
export const SLUICE_PEAK = {
  x: 168,
  z: 24,
  height: 42,
  sigma: 13,
} as const;

// Grulmaw's Roost (zone1): a lone dramatic peak rising from the vale's far southern
// reaches (SE corner), where Grulmaw the Rift-Gorged dragged himself to brood after
// gorging on the raw Dry. Unlike SLUICE_PEAK (a steep, unclimbable gaussian wall that
// only backs scenery), this is a WALKABLE summit: a smoothstep dome whose max slope
// (1.5 * height / radius = ~0.88) stays under PLAYER_MAX_CLIMB_SLOPE (1.5) on every
// approach, so a party can trek up its north face to fight the boss at the top and
// finish q_mogger. Its southern flank runs into the world's south rim, so it reads as
// a spur off the distant southern range. Added in baseHeight (like sluicePeakOffset)
// so the camp-flatten levels a small plateau at the apex for the encounter.
export const GRULMAW_PEAK = {
  x: -64,
  z: -142,
  height: 40,
  radius: 68,
} as const;

// A stone crossing over the Sluice river, mid-corridor, so a player on the south
// (boar-meadow) bank can reach the north shore without swimming. It is a pure
// terrain primitive (a raised, gently-arched causeway), NOT a walkable-platform
// subsystem: because the renderer samples the same `terrainHeight`, the deck you
// see is exactly the deck you walk on. The ends ramp down onto the natural banks
// (below the climb-slope cap) and the crown clears the water; the crisp x-edges
// drop back to the river so it reads as a bridge, with parapet rails added in
// colliders.ts and the stone skin in render/bridge.ts, all off THIS one const.
export const SLUICE_BRIDGE = {
  x: 70, // crossing centered on the open river corridor
  z: 24, // river centerline (SLUICE_RIVER.z)
  halfSpan: 11, // deck runs z in [13, 35], solid south bank to solid north bank
  halfWidth: 2.8, // deck half-width across x (a comfortable footbridge, ~4yd of deck)
  deckBase: 0.4, // deck height at the ramp ends (world y)
  crown: 1.9, // extra rise at the span center, so the crown clears the water
  rampZ: 4, // z-length over which each end ramps down onto the bank
  edge: 0.8, // x-taper at the deck edge before it drops to the river
} as const;

// River/plunge-pool bed height (below WATER_LEVEL so the water plane fills it).
const SLUICE_RIVER_BED = WATER_LEVEL - 2.5;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// The Baked Beaver farm: the large, fully flat, fully cleared field the colony works
// south of the grotto road, from just east of the outpost to the foot of the western
// mountain (it stops before the land climbs toward the Skeleton Grotto/crypt, so the
// grotto's dramatic rise stays intact). A road-parallel band: its north edge hugs the
// grotto road (a thin natural verge), it is leveled to one height, and it is stripped of
// all trees, rocks, and grass so the whole expanse is plantable farmland the garden can
// grow into. Terrain flatten (below) + decoration cull (generateDecorations) + the grass
// cull (render/foliage) all key off inGardenFarm, so this ONE region drives the field.
export const GARDEN_FARM = {
  xMin: 52, // west edge, east of the outpost den (keeps the terrace bank off the buildings)
  xMax: 140, // east edge at the Sluice mountain foot (the peak/grotto rim climbs steeply past here)
  zSouth: 34, // southern limit of the flat field: level right down to the Sluice river bank
  anchorX: 72, // sample point whose natural height sets the flat level (~2yd, gentle vale)
  anchorZ: 52,
  roadVerge: 1, // north edge sits this far south of the grotto road centerline
  blend: 3, // edge feather width (yards) blending the terrace back to natural ground
} as const;

// The grotto road polyline across the farm's x-span (mirrors the second ZONE1_ROADS
// spoke). The field's north edge follows it so the whole south side of the path is field.
const FARM_ROAD_PTS: readonly { x: number; z: number }[] = [
  { x: 42, z: 70 },
  { x: 62, z: 72 },
  { x: 82, z: 78 },
  { x: 104, z: 82 },
  { x: 126, z: 84 },
];

// Grotto-road centerline z at a given x (clamped to the polyline ends).
function farmRoadZ(x: number): number {
  const pts = FARM_ROAD_PTS;
  if (x <= pts[0].x) return pts[0].z;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (x <= b.x) return a.z + ((b.z - a.z) * (x - a.x)) / (b.x - a.x);
  }
  return pts[pts.length - 1].z;
}

// North edge of the flat field at x: a thin verge south of the road centerline.
function farmNorthEdge(x: number): number {
  return farmRoadZ(x) - GARDEN_FARM.roadVerge;
}

// Blend weight (0..1) of the farm terrace at (x,z): 1 = fully inside the level field,
// 0 = outside/natural, feathering over `blend` yards at every edge.
function farmBlend(x: number, z: number): number {
  const f = GARDEN_FARM;
  const north = farmNorthEdge(x);
  if (x < f.xMin - f.blend || x > f.xMax + f.blend) return 0;
  if (z < f.zSouth - f.blend || z > north) return 0;
  const bN = smoothstep(north, north - f.blend, z); // 0 at the road verge -> 1 to the south
  const bS = smoothstep(f.zSouth - f.blend, f.zSouth, z); // 0 south of the field -> 1 inside
  const bW = smoothstep(f.xMin - f.blend, f.xMin, x); // 0 west of the field -> 1 inside
  const bE = smoothstep(f.xMax + f.blend, f.xMax, x); // 0 east (mountain) -> 1 inside
  return bN * bS * bW * bE;
}

// Is (x,z) inside the cleared field (used to strip every tree/rock/grass tuft off it)?
// The core, not the feather, so a thin ring of natural dressing frames the field edge.
export function inGardenFarm(x: number, z: number): boolean {
  const f = GARDEN_FARM;
  return x > f.xMin && x < f.xMax && z > f.zSouth && z < farmNorthEdge(x);
}

export function mirefenImpactCraterOffset(x: number, z: number): number {
  const dx = x - MIREFEN_IMPACT_CRATER.x;
  const dz = z - MIREFEN_IMPACT_CRATER.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d >= MIREFEN_IMPACT_CRATER.radius) return 0;

  const bowlT = d / MIREFEN_IMPACT_CRATER.bowlRadius;
  const bowl =
    d < MIREFEN_IMPACT_CRATER.bowlRadius
      ? -MIREFEN_IMPACT_CRATER.depth * (1 - smoothstep(0, 1, bowlT))
      : 0;

  const rimStart = MIREFEN_IMPACT_CRATER.bowlRadius * 0.82;
  if (d <= rimStart) return bowl;
  const rimT = (d - rimStart) / (MIREFEN_IMPACT_CRATER.radius - rimStart);
  const rim =
    MIREFEN_IMPACT_CRATER.rimHeight * smoothstep(0, 0.35, rimT) * (1 - smoothstep(0.72, 1, rimT));
  return bowl + rim;
}

// Carve the Skeleton Grotto into whatever terrain h already is (called AFTER the rim
// so the floor overrides it). Inside the bowl the floor is pinned to floorY; in the
// ring beyond it a steep rock wall rises on every arc EXCEPT the eastern mouth cone,
// which instead grades the floor back out to the natural field so the player can walk
// in. Returns the new height (never touched outside `radius`).
export function skeletonGrottoOffset(x: number, z: number, h: number): number {
  const g = SKELETON_GROTTO;
  const dx = x - g.x;
  const dz = z - g.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d >= g.radius) return h;
  // Mouth faces EAST (-x): points east of center have dx < 0, so -dx/d is +1 due east.
  // `openness` is 1 inside the east mouth cone and 0 on the walled sides and back.
  const eastDot = d > 1e-3 ? -dx / d : 0;
  const openness = smoothstep(0.15, 0.72, eastDot);
  // Floor: hard-pin toward floorY across the bowl, feathering back to natural at the
  // outer ring so the wall (walled arcs) or the field (mouth) takes over cleanly.
  const floorPin = smoothstep(g.radius, g.bowlRadius, d); // 1 for d <= bowlRadius, 0 at radius
  let out = h * (1 - floorPin) + g.floorY * floorPin;
  // Wall: a steep rock lip in the ring, suppressed across the mouth. Peaks mid-ring so
  // the rise from the floor rim clears PLAYER_MAX_CLIMB_SLOPE and reads as a cliff.
  const ringMid = (g.bowlRadius + g.radius) / 2;
  const wallProfile = smoothstep(g.bowlRadius, ringMid, d) * (1 - smoothstep(ringMid, g.radius, d));
  out += g.wallHeight * wallProfile * (1 - openness);
  return out;
}

// A point sits on the grotto's walkable floor (used to keep the decoration field off
// the encounter arena; the wall arcs still take their natural rocks/pines).
function isOnGrottoFloor(x: number, z: number): boolean {
  const g = SKELETON_GROTTO;
  return Math.hypot(x - g.x, z - g.z) < g.bowlRadius + 1;
}

// The western mountain that backs the Sluice waterfall: a gaussian peak.
function sluicePeakOffset(x: number, z: number): number {
  const dx = x - SLUICE_PEAK.x;
  const dz = z - SLUICE_PEAK.z;
  const d2 = dx * dx + dz * dz;
  const reach = SLUICE_PEAK.sigma * 3;
  if (d2 >= reach * reach) return 0;
  return SLUICE_PEAK.height * Math.exp(-d2 / (2 * SLUICE_PEAK.sigma * SLUICE_PEAK.sigma));
}

// Grulmaw's Roost: a walkable dome peak (see GRULMAW_PEAK). smoothstep(radius, 0, d)
// is 1 at the apex and eases to 0 at the foot; its steepest point (d = radius/2) has
// slope 1.5 * height / radius, kept below PLAYER_MAX_CLIMB_SLOPE so the summit is
// reachable from any side (unlike the sheer sluicePeakOffset gaussian).
function grulmawPeakOffset(x: number, z: number): number {
  const dx = x - GRULMAW_PEAK.x;
  const dz = z - GRULMAW_PEAK.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d >= GRULMAW_PEAK.radius) return 0;
  return GRULMAW_PEAK.height * smoothstep(GRULMAW_PEAK.radius, 0, d);
}

// Capsule-shaped river carve: distance to the channel centerline segment, blended
// from the flat bed out to the natural banks. Carve wins over the peak so the
// channel and plunge pool stay water even where the mountain foot overlaps them.
function sluiceRiverCarve(x: number, z: number, h: number): number {
  const r = SLUICE_RIVER;
  if (x < r.xEast - r.bank || x > r.xWest + r.bank) return h;
  const cx = Math.max(r.xEast, Math.min(r.xWest, x));
  const dx = x - cx;
  const dz = z - r.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d >= r.bank) return h;
  const blend = smoothstep(r.halfWidth, r.bank, d);
  return h * blend + SLUICE_RIVER_BED * (1 - blend);
}

// Raise the Sluice bridge causeway: a deck that LANDS on each shore at its own
// natural height (the south bank is low, the north bank is higher), humped in the
// middle to clear the water. Landing on the REAL bank heights is what keeps the deck
// flush with each shore: a fixed end height undershot the higher north bank, leaving
// a dip the deck dropped into and logs the rising bank buried. Only ever RAISES (max
// against natural) and tapers to a crisp x-edge so the river shows on either side.
// Applied last in terrainHeight; `seed` lets it sample the two bank heights.
let sluiceBankCache: { seed: number; south: number; north: number } | null = null;
function sluiceBankHeights(seed: number): { south: number; north: number } {
  if (sluiceBankCache && sluiceBankCache.seed === seed) return sluiceBankCache;
  const b = SLUICE_BRIDGE;
  // Sample natural terrain just past each end; the bridge offset is identity there
  // (|dz| >= halfSpan), so these calls do not recurse into the bank sampling.
  const south = terrainHeight(b.x, b.z - b.halfSpan - 2, seed);
  const north = terrainHeight(b.x, b.z + b.halfSpan + 2, seed);
  sluiceBankCache = { seed, south, north };
  return sluiceBankCache;
}

function sluiceBridgeOffset(x: number, z: number, h: number, seed: number): number {
  const b = SLUICE_BRIDGE;
  const dx = x - b.x;
  const dz = z - b.z;
  if (Math.abs(dx) >= b.halfWidth || Math.abs(dz) >= b.halfSpan) return h;
  const zt = dz / b.halfSpan; // -1 at the south end .. +1 at the north end
  const banks = sluiceBankHeights(seed);
  // a straight baseline connecting the two shores at their real heights, plus a
  // parabolic crown humped above it: the deck descends monotonically to each bank
  // with no local dip, and meets the shore flush where natural terrain takes over.
  const baseline = banks.south + (banks.north - banks.south) * (zt + 1) * 0.5;
  const deck = baseline + b.crown * (1 - zt * zt);
  const widthBlend = smoothstep(b.halfWidth, b.halfWidth - b.edge, Math.abs(dx)); // parapet edge
  const target = Math.max(h, deck); // never dig below the natural surface
  return h + (target - h) * widthBlend;
}

// Fishing-dock piers (zone1/zone2 `PROPS.docks`): raise a flat, walkable deck strip
// that runs from the shore out over the water, so the render planks (which sample this
// same terrainHeight) form a pier you can actually walk onto and fish from, instead of
// pallets clamped to the lakebed. Like the bridge it ONLY raises (max against the
// natural surface), tapers at the side edges and the water tip, and eases in at the
// shore end. The deck sits a touch above the water line so it reads as a low jetty.
const DOCK_DECK_Y = WATER_LEVEL + 0.7; // flat deck height, a low jetty just above the water
const DOCK_LEN = 9; // how far the pier reaches out over the water (local -z, toward water)
const DOCK_BACK = 2.8; // how far it reaches back onto the shore (local +z)
const DOCK_HALFW = 2.4; // pier walkable half-width (local x); >= render DECK_HALFW so you never slip off
const DOCK_EDGE = 0.15; // side taper: keep it tiny so the deck stays flat across its full width
const DOCK_TIP = 1.2; // taper in from the water tip
const DOCK_SHORE = 2.6; // long ease-in at the shore end so the bank grades smoothly to the deck
const DOCK_APRON = 3.5; // sand ramp BEYOND the deck: raises a low shore up to deck level so there is no step-up onto the planks

function dockDeckOffset(x: number, z: number, h: number): number {
  for (const d of PROPS.docks) {
    const dx = x - d.x;
    const dz = z - d.z;
    if (dx * dx + dz * dz > (DOCK_LEN + 3) * (DOCK_LEN + 3)) continue;
    // world->local (inverse of the render's local->world in props.ts: local -z faces
    // the water). lx = c*dx - s*dz, lz = s*dx + c*dz.
    const c = Math.cos(d.rot);
    const s = Math.sin(d.rot);
    const lx = c * dx - s * dz;
    const lz = s * dx + c * dz;
    if (lx <= -DOCK_HALFW || lx >= DOCK_HALFW) continue;
    if (lz >= DOCK_BACK + DOCK_APRON || lz <= -DOCK_LEN) continue;
    const wBlend = smoothstep(DOCK_HALFW, DOCK_HALFW - DOCK_EDGE, Math.abs(lx));
    const tipBlend = smoothstep(-DOCK_LEN, -DOCK_LEN + DOCK_TIP, lz); // 0 at the tip, 1 inward
    const backBlend = smoothstep(DOCK_BACK, DOCK_BACK - DOCK_SHORE, lz); // ease at the shore end
    // Over the shore half (lz >= 0) where the natural ground is at or BELOW the deck
    // (a low/wet bank), fill it straight UP to the flat deck with the width taper only
    // (no shore ease-in). The deck planks stay flat over [0, DOCK_BACK], then a sand
    // apron over (DOCK_BACK, DOCK_BACK + DOCK_APRON] eases the RAISED ground back down to
    // the natural bank, so the shore grades UP to meet the deck instead of leaving a
    // step-up you have to jump onto the planks. Easing DOWN inside the plank region is what
    // sagged the shore end below its own boards; a HIGH bank (h > deck) still uses the full
    // backBlend ease below to grade smoothly DOWN to meet the jetty.
    if (lz >= 0 && h <= DOCK_DECK_Y) {
      const shoreProfile = smoothstep(DOCK_BACK + DOCK_APRON, DOCK_BACK, lz); // 1 through the deck, eases to 0 across the apron
      return h + (DOCK_DECK_Y - h) * wBlend * tipBlend * shoreProfile;
    }
    const blend = wBlend * tipBlend * backBlend;
    // Over the water (lz < 0) only RAISE (never dig below the natural lakebed). Over a
    // high shore bank drive straight to the deck height so it grades DOWN to meet the
    // jetty instead of leaving a steep dip at the shore junction.
    const target = lz < 0 ? Math.max(h, DOCK_DECK_Y) : DOCK_DECK_Y;
    return h + (target - h) * blend;
  }
  return h;
}

// A point is on a dock pier deck (used to keep decorations off the walkable planks).
function isOnDock(x: number, z: number): boolean {
  for (const d of PROPS.docks) {
    const dx = x - d.x;
    const dz = z - d.z;
    if (dx * dx + dz * dz > (DOCK_LEN + 3) * (DOCK_LEN + 3)) continue;
    const c = Math.cos(d.rot);
    const s = Math.sin(d.rot);
    const lx = c * dx - s * dz;
    const lz = s * dx + c * dz;
    if (Math.abs(lx) < DOCK_HALFW + 1 && lz < DOCK_BACK + 1 && lz > -DOCK_LEN - 1) return true;
  }
  return false;
}

// House entry ramps: a plinth-seated house sits on a stone foundation with a flight of
// stone steps down its door (+z) edge (props.ts addSteps). Those treads are COSMETIC; the
// player's feet ride terrainHeight, so without a matching ground ramp the seated sill reads
// as an unclimbable wall (the > MAX_CLIMB_SLOPE move gate treats the sudden rise as a cliff).
// Raise a walkable ramp under the steps, from the seated sill at the door edge down to
// natural grade at the stair foot, so the treads sit on solid ground you can actually climb.
// Like the dock apron it ONLY raises (max against natural), stays OUTSIDE the footprint
// (local z > d/2, clear of the wall OBB collider), and tapers at the side edges. The run is
// held to at least floorDrop / HOUSE_RAMP_MAX_SLOPE so the grade stays under MAX_CLIMB_SLOPE.
// Samples terrainHeightNatural (NEVER terrainHeight) at the corners/foot so it never recurses.
const HOUSE_STEP_TREAD = 0.5; // matches props.ts addSteps tread depth
const HOUSE_STEP_RISE = 0.42; // matches props.ts addSteps target rise (n = round(floorDrop / rise))
const HOUSE_RAMP_MAX_SLOPE = 1.3; // hold the ramp comfortably under the 1.5 MAX_CLIMB_SLOPE gate
const HOUSE_RAMP_EDGE = 0.6; // side taper width (local x) so the ramp edge is not a lateral cliff

function houseStepsOffset(x: number, z: number, h: number, seed: number): number {
  for (const b of PROPS.buildings) {
    const dx = x - b.x;
    const dz = z - b.z;
    // cheap cull: the ramp reaches at most ~d/2 + a few yards past the door edge
    const reach = b.d / 2 + 8;
    if (dx * dx + dz * dz > reach * reach) continue;
    // world->local (inverse of props.ts local->world; local +z faces the door)
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const lx = c * dx - s * dz;
    const lz = s * dx + c * dz;
    const zFace = b.d / 2;
    if (lz <= zFace) continue; // inside/behind the footprint: never disturb the walls
    const stepHalfW = Math.min(b.w * 0.5, 4.6) / 2 + 0.3; // props stepW half + a little margin
    if (Math.abs(lx) >= stepHalfW) continue;
    const along = lz - zFace; // 0 at the door edge, grows toward the stair foot
    // Seat the sill at the highest footprint corner (mirrors props.ts footprintGround),
    // sampled from the NATURAL surface so this offset never recurses through terrainHeight.
    const hw = b.w / 2;
    const hd = b.d / 2;
    let hi = -Infinity;
    for (const cx of [-hw, hw]) {
      for (const cz of [-hd, hd]) {
        const wx = b.x + cx * c + cz * s;
        const wz = b.z - cx * s + cz * c;
        hi = Math.max(hi, terrainHeightNatural(wx, wz, seed));
      }
    }
    // Natural grade a little past the door edge = the stair foot (props.ts doorProbe).
    const footGrade = terrainHeightNatural(b.x + (zFace + 1.2) * s, b.z + (zFace + 1.2) * c, seed);
    const floorDrop = hi - footGrade;
    if (floorDrop <= 0.5) continue; // door near grade: no steps rendered, no ramp needed
    const n = Math.min(8, Math.max(1, Math.round(floorDrop / HOUSE_STEP_RISE)));
    const rampLen = Math.max(n * HOUSE_STEP_TREAD, floorDrop / HOUSE_RAMP_MAX_SLOPE);
    if (along >= rampLen) continue; // past the stair foot: already at natural grade
    const rampY = hi + (footGrade - hi) * (along / rampLen); // linear ramp, sill -> foot
    if (rampY <= h) continue; // only ever RAISE, never dig below the natural surface
    const wBlend = smoothstep(stepHalfW, stepHalfW - HOUSE_RAMP_EDGE, Math.abs(lx));
    return h + (rampY - h) * wBlend;
  }
  return h;
}

// Walkable stone staircases (PROPS.stairs): carve a straight, uniform-grade ramp up a
// steep hillside from the FOOT (x1,z1) to the TOP landing (x2,z2), so the render treads
// (props.ts, which sample this same terrainHeight) sit on a clean incline you can actually
// climb. Unlike the dock/house ramps this both RAISES and CUTS toward the target ramp
// plane inside the footprint (a real staircase channel gouged into the hill), tapering to
// natural grade at the side edges (STAIR_EDGE) and feathering the along-ends (STAIR_END) so
// there is no lateral or end cliff. The two end heights are sampled from terrainHeightNatural
// (NEVER terrainHeight) so this offset never recurses, and so each end meets its real grade
// flush. The along-grade is (topY - footY) / runLen; authored runs hold that under the
// MAX_CLIMB_SLOPE move gate.
const STAIR_EDGE = 0.9; // side taper (yards) beyond the walkable half-width: no lateral cliff
const STAIR_END = 1.2; // along-end feather (yards) so the channel does not pop as an end wall

function stairsOffset(x: number, z: number, h: number, seed: number): number {
  const stairs = PROPS.stairs;
  if (!stairs) return h;
  for (const s of stairs) {
    const ax = s.x2 - s.x1;
    const az = s.z2 - s.z1;
    const runLen = Math.hypot(ax, az);
    if (runLen < 1e-3) continue;
    const ux = ax / runLen; // unit vector foot -> top (along)
    const uz = az / runLen;
    const dx = x - s.x1;
    const dz = z - s.z1;
    const along = dx * ux + dz * uz; // 0 at foot, runLen at top
    const perp = dx * -uz + dz * ux; // signed lateral offset from the centre line
    const halfW = s.halfWidth ?? 2;
    if (along < -STAIR_END || along > runLen + STAIR_END) continue;
    if (Math.abs(perp) > halfW + STAIR_EDGE) continue;
    const footY = terrainHeightNatural(s.x1, s.z1, seed);
    const topY = terrainHeightNatural(s.x2, s.z2, seed);
    const t = Math.max(0, Math.min(1, along / runLen));
    const rampY = footY + (topY - footY) * t;
    const wBlend = smoothstep(halfW + STAIR_EDGE, halfW, Math.abs(perp)); // 1 on the path, 0 past the edge
    // Feather both ends so the perp channel eases in/out instead of ending in a wall.
    const lowBlend = smoothstep(-STAIR_END, 0.5, along);
    const highBlend = smoothstep(runLen + STAIR_END, runLen - 0.5, along);
    const blend = wBlend * lowBlend * highBlend;
    return h + (rampY - h) * blend;
  }
  return h;
}

// Blended biome shape at a given z. Zone interiors keep their exact shape;
// blends happen across ±~35yd windows at the band boundaries.
function shapeAt(z: number): { hill: number; base: number } {
  let hill = BIOME_SHAPE[ZONES[0].biome].hill;
  let base = BIOME_SHAPE[ZONES[0].biome].base;
  for (let i = 0; i + 1 < ZONES.length; i++) {
    const boundary = ZONES[i].zMax;
    const t = smoothstep(boundary - 30, boundary + 35, z);
    const next = BIOME_SHAPE[ZONES[i + 1].biome];
    hill = lerp(hill, next.hill, t);
    base = lerp(base, next.base, t);
  }
  return { hill, base };
}

function baseHeight(x: number, z: number, seed: number): number {
  const shape = shapeAt(z);
  let h =
    (fbm2(x * HILL_SCALE + 100, z * HILL_SCALE + 100, seed, 4) - 0.5) * shape.hill + shape.base;
  h += (fbm2(x * DETAIL_SCALE, z * DETAIL_SCALE, seed + 7, 2) - 0.5) * 2.2;
  // Flatten each zone's hub settlement into a plateau
  for (const zone of ZONES) {
    const dx = x - zone.hub.x,
      dz = z - zone.hub.z;
    const dHub = Math.sqrt(dx * dx + dz * dz);
    if (dHub < zone.hub.radius * 1.6) {
      const blend = smoothstep(zone.hub.radius * 0.7, zone.hub.radius * 1.6, dHub);
      h = h * blend + BIOME_SHAPE[zone.biome].hubHeight * (1 - blend);
    }
  }
  // Keep dry land everywhere: soft-floor low dips above the water level...
  const minLand = WATER_LEVEL + 1.4;
  if (h < minLand) h = minLand - (minLand - h) * 0.12;
  // ...except the carved lake basins
  for (const zone of ZONES) {
    for (const lake of zone.lakes) {
      const dLake = Math.sqrt((x - lake.x) ** 2 + (z - lake.z) ** 2);
      if (dLake < lake.radius * 1.6) {
        const lakeBlend = smoothstep(lake.radius * 0.55, lake.radius * 1.6, dLake);
        h = h * lakeBlend + (WATER_LEVEL - 4) * (1 - lakeBlend);
      }
    }
  }
  // The Sluice: raise the western mountain, then carve the river last (carve wins
  // so the channel and plunge pool read as water even at the mountain's foot).
  h += sluicePeakOffset(x, z);
  h = sluiceRiverCarve(x, z, h);
  // Grulmaw's Roost: a lone walkable peak in the far south (see GRULMAW_PEAK).
  h += grulmawPeakOffset(x, z);
  return h;
}

// Ground height including instanced dungeon floors (flat, far off-world).
export function groundHeight(x: number, z: number, seed: number): number {
  if (x > DUNGEON_X_THRESHOLD) return DUNGEON_FLOOR_Y;
  return terrainHeight(x, z, seed);
}

// The open-world surface WITHOUT the house entry ramps. The render's step-building math
// (props.ts footprintGround / floorDrop) samples THIS so it still sees the full sill-to-grade
// drop and lays a real flight of stone treads; terrainHeight then overlays the walkable ramp.
// houseStepsOffset also samples this (never terrainHeight) so the ramp math never recurses.
export function terrainHeightNatural(x: number, z: number, seed: number): number {
  let h = baseHeight(x, z, seed);

  // Flatten each camp a little so mobs don't stand on cliffs
  for (const camp of CAMPS) {
    const dx = x - camp.center.x,
      dz = z - camp.center.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < camp.radius * 1.8) {
      const ch = baseHeight(camp.center.x, camp.center.z, seed);
      const blend = smoothstep(camp.radius * 0.8, camp.radius * 1.8, d);
      h = h * blend + ch * (1 - blend);
    }
  }

  // Level the Baked Beaver farm into one flat field (the road-parallel band south of the
  // grotto road, stopping at the mountain foot). The renderer samples this exact function,
  // so the flat you see is the flat you walk and plant on; the garden beds sit on it.
  {
    const b = farmBlend(x, z);
    if (b > 0) {
      const fy = baseHeight(GARDEN_FARM.anchorX, GARDEN_FARM.anchorZ, seed);
      h = h * (1 - b) + fy * b;
    }
  }

  // Mountain ridge walls between zones, pierced by the road pass
  for (const ridge of ZONE_RIDGES) {
    const dz = Math.abs(z - ridge.z);
    if (dz < RIDGE_SIGMA * 3) {
      const profile = Math.exp(-(dz * dz) / (2 * RIDGE_SIGMA * RIDGE_SIGMA));
      const pass = smoothstep(PASS_HALF_WIDTH, PASS_SHOULDER, Math.abs(x - ridge.passX));
      // jagged crest so the wall reads as mountains, not a berm
      const crest = 1 + (fbm2(x * 0.03, ridge.z * 0.03, seed + 19, 2) - 0.5) * 0.7;
      h += RIDGE_HEIGHT * crest * profile * pass;
    }
  }

  // Raise the world rim so the player naturally stays in bounds
  const rimX = smoothstep(WORLD_MAX_X - 30, WORLD_MAX_X, Math.abs(x));
  const rimS = smoothstep(WORLD_MIN_Z + 30, WORLD_MIN_Z, z);
  const rimN = smoothstep(WORLD_MAX_Z - 30, WORLD_MAX_Z, z);
  const rim = Math.max(rimX, rimS, rimN);
  h += rim * 40;
  // Carve the Skeleton Grotto AFTER the rim so its floor wins over the mountainside.
  h = skeletonGrottoOffset(x, z, h);
  h += mirefenImpactCraterOffset(x, z);
  h = sluiceBridgeOffset(x, z, h, seed);
  h = dockDeckOffset(x, z, h);
  return h;
}

// The walkable open-world surface: natural terrain plus the house entry ramps that make the
// plinth steps climbable. This is what the sim moves on and what the terrain mesh renders.
export function terrainHeight(x: number, z: number, seed: number): number {
  const realm = realmAt(x, z);
  if (realm) return realmTerrainHeight(realm, x, z, seed);
  const h = houseStepsOffset(x, z, terrainHeightNatural(x, z, seed), seed);
  return stairsOffset(x, z, h, seed);
}

// A realm's heightfield: the overworld `baseHeight` shape (biome hills/base blend,
// hub plateaus, dry-land floor, lake carves) scoped to the REALM's own zone strip
// and offset terrain seed, MINUS the overworld-only special cases (sluice/grulmaw
// peaks, house/stair ramps). Self-contained so the overworld path (terrainHeight
// above, when realmAt is null) stays byte-identical; only reached for (x,z) inside
// a registered realm band. See docs/design/realms.md. Kept simple for the M1
// prototype; a realm may later carve its own signature terrain here.
export function realmTerrainHeight(realm: RealmDef, x: number, z: number, seed: number): number {
  const rs = seed + realm.terrainSeed;
  const zones = realm.zones;
  // biome shape blend across the realm's own zone bands (mirrors shapeAt)
  let hill = BIOME_SHAPE[zones[0].biome].hill;
  let base = BIOME_SHAPE[zones[0].biome].base;
  for (let i = 0; i + 1 < zones.length; i++) {
    const t = smoothstep(zones[i].zMax - 30, zones[i].zMax + 35, z);
    hill = lerp(hill, BIOME_SHAPE[zones[i + 1].biome].hill, t);
    base = lerp(base, BIOME_SHAPE[zones[i + 1].biome].base, t);
  }
  let h = (fbm2(x * HILL_SCALE + 100, z * HILL_SCALE + 100, rs, 4) - 0.5) * hill + base;
  h += (fbm2(x * DETAIL_SCALE, z * DETAIL_SCALE, rs + 7, 2) - 0.5) * 2.2;
  for (const zone of zones) {
    const dHub = Math.hypot(x - zone.hub.x, z - zone.hub.z);
    if (dHub < zone.hub.radius * 1.6) {
      const blend = smoothstep(zone.hub.radius * 0.7, zone.hub.radius * 1.6, dHub);
      h = h * blend + BIOME_SHAPE[zone.biome].hubHeight * (1 - blend);
    }
  }
  const minLand = WATER_LEVEL + 1.4;
  if (h < minLand) h = minLand - (minLand - h) * 0.12;
  for (const zone of zones) {
    for (const lake of zone.lakes) {
      const dLake = Math.hypot(x - lake.x, z - lake.z);
      if (dLake < lake.radius * 1.6) {
        const lakeBlend = smoothstep(lake.radius * 0.55, lake.radius * 1.6, dLake);
        h = h * lakeBlend + (WATER_LEVEL - 4) * (1 - lakeBlend);
      }
    }
  }
  return h;
}

// Distance from (x,z) to the nearest road polyline segment.
export function roadDistance(x: number, z: number): number {
  let best = Infinity;
  for (const road of ROADS) {
    for (let i = 0; i < road.length - 1; i++) {
      const a = road[i],
        b = road[i + 1];
      const abx = b.x - a.x,
        abz = b.z - a.z;
      const apx = x - a.x,
        apz = z - a.z;
      const len2 = abx * abx + abz * abz;
      const t = len2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apz * abz) / len2)) : 0;
      const dx = apx - abx * t,
        dz = apz - abz * t;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < best) best = d;
    }
  }
  return best;
}

// Deterministic decoration placement (trees, rocks) — used by the renderer,
// kept here so it shares the seed and stays out of mob camps / hubs / roads /
// lakes. Density and mix vary by biome: the vale is wooded, the marsh sparse
// and scrubby, the peaks rocky with hardy pines.
export interface Decoration {
  kind: 'tree' | 'tree2' | 'rock';
  x: number;
  z: number;
  scale: number;
  variant: number;
  biome: BiomeId;
}

const DECORATION_EXCLUSION_RADIUS = 1.2;
const DECORATION_EXCLUSIONS = [
  { x: 2.456450840458274, z: 211.33819991815835 },
  // The Sluice outpost (zone1): keep stray trees off the Baked Beaver statue and
  // the beaver lodge/den footprints so nothing clips the pond-shore landmark. The
  // millpond carve and the road spur clear most of the area; these pin the rest.
  { x: 42, z: 54 }, // Baked Beaver mascot
  { x: 38, z: 60 }, // beaver lodge (inn)
  { x: 46, z: 62 }, // beaver den (house)
  { x: 55.07, z: 58.14 }, // the lone big tree on the outpost's east shore (cleared)
  { x: 38.1, z: 58.12 }, // the tree sprouting through the beaver lodge roof (cleared)
];

function isExcludedDecoration(x: number, z: number): boolean {
  return DECORATION_EXCLUSIONS.some(
    (p) => Math.hypot(x - p.x, z - p.z) < DECORATION_EXCLUSION_RADIUS,
  );
}

// The Sluice bridge deck rises above the water-line decoration cutoff, so keep the
// tree/rock field off its footprint (plus a small margin) or a trunk would sprout
// mid-span. Mirrors how the road/lake/hub gates keep decorations off structures.
function isOnSluiceBridge(x: number, z: number): boolean {
  const b = SLUICE_BRIDGE;
  return Math.abs(x - b.x) < b.halfWidth + 2 && Math.abs(z - b.z) < b.halfSpan + 2;
}

// Keep the tree/rock field off a staircase (plus a small margin) so no trunk sprouts
// through the treads. Mirrors isOnDock/isOnSluiceBridge; uses the same along/perp span
// as stairsOffset with a margin.
function isOnStairs(x: number, z: number): boolean {
  const stairs = PROPS.stairs;
  if (!stairs) return false;
  for (const s of stairs) {
    const ax = s.x2 - s.x1;
    const az = s.z2 - s.z1;
    const runLen = Math.hypot(ax, az);
    if (runLen < 1e-3) continue;
    const ux = ax / runLen;
    const uz = az / runLen;
    const dx = x - s.x1;
    const dz = z - s.z1;
    const along = dx * ux + dz * uz;
    const perp = dx * -uz + dz * ux;
    const halfW = s.halfWidth ?? 2;
    if (along >= -2 && along <= runLen + 2 && Math.abs(perp) <= halfW + 2) return true;
  }
  return false;
}

export function zoneBiomeAt(z: number): BiomeId {
  for (const zone of ZONES) {
    if (z < zone.zMax) return zone.biome;
  }
  return ZONES[ZONES.length - 1].biome;
}

// Biome at (x,z), realm-aware: the realm's own zone biome inside a realm band,
// else the overworld zoneBiomeAt(z). The renderer/map switch to this where realm
// biome must be read (M1.4); zoneBiomeAt(z) stays for overworld-only callers and
// returns identically while REALMS is empty.
export function zoneBiomeAtXZ(x: number, z: number): BiomeId {
  const realm = realmAt(x, z);
  if (!realm) return zoneBiomeAt(z);
  for (const zone of realm.zones) {
    if (z < zone.zMax) return zone.biome;
  }
  return realm.zones[realm.zones.length - 1].biome;
}

export function generateDecorations(seed: number): Decoration[] {
  const out: Decoration[] = [];
  const step = 10;
  const xHalf = WORLD_MAX_X - 14;
  for (let gx = -xHalf; gx < xHalf; gx += step) {
    for (let gz = WORLD_MIN_Z + 14; gz < WORLD_MAX_Z - 14; gz += step) {
      const r = hash2(Math.round(gx), Math.round(gz), seed + 31);
      const biome = zoneBiomeAt(gz);
      // density gate + kind mix per biome
      let kind: Decoration['kind'] | null = null;
      if (biome === 'vale') {
        if (r > 0.48) continue;
        kind = r < 0.3 ? 'tree' : r < 0.4 ? 'tree2' : 'rock';
      } else if (biome === 'marsh') {
        if (r > 0.34) continue;
        kind = r < 0.08 ? 'tree' : r < 0.26 ? 'tree2' : 'rock';
      } else {
        if (r > 0.44) continue;
        kind = r < 0.2 ? 'tree' : r < 0.24 ? 'tree2' : 'rock';
      }
      const ox = (hash2(Math.round(gx), Math.round(gz), seed + 57) - 0.5) * step;
      const oz = (hash2(Math.round(gx), Math.round(gz), seed + 91) - 0.5) * step;
      const x = gx + ox,
        z = gz + oz;
      if (isExcludedDecoration(x, z)) continue;
      if (isOnSluiceBridge(x, z)) continue;
      if (isOnDock(x, z)) continue;
      if (isOnStairs(x, z)) continue;
      if (isOnGrottoFloor(x, z)) continue;
      let inHub = false;
      for (const zone of ZONES) {
        const dx = x - zone.hub.x,
          dz = z - zone.hub.z;
        if (Math.sqrt(dx * dx + dz * dz) < zone.hub.radius + 4) {
          inHub = true;
          break;
        }
      }
      if (inHub) continue;
      if (terrainHeight(x, z, seed) < WATER_LEVEL + 1) continue;
      if (roadDistance(x, z) < 5) continue;
      let inCamp = false;
      for (const c of CAMPS) {
        const dx = x - c.center.x,
          dz = z - c.center.z;
        if (Math.sqrt(dx * dx + dz * dz) < c.radius + 3) {
          inCamp = true;
          break;
        }
      }
      if (inCamp) continue;
      // Strip every tree and rock off the Baked Beaver farm so the whole field reads as
      // open, cleared farmland (matches the flattened terrace in terrainHeight; grass is
      // culled the same way in render/foliage).
      if (inGardenFarm(x, z)) continue;
      out.push({
        kind,
        x,
        z,
        scale: 0.7 + hash2(Math.round(gx), Math.round(gz), seed + 13) * 0.9,
        variant: Math.floor(hash2(Math.round(gx), Math.round(gz), seed + 77) * 3),
        biome,
      });
    }
  }
  return out;
}
