import {
  CAMPS,
  DUNGEON_FLOOR_Y,
  DUNGEON_X_THRESHOLD,
  ROADS,
  WORLD_MAX_X,
  WORLD_MAX_Z,
  WORLD_MIN_X,
  WORLD_MIN_Z,
  ZONES,
} from './data';
import { fbm2, hash2 } from './rng';
import type { BiomeId } from './types';

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

// The western mountain that backs the Sluice waterfall: a gaussian peak.
function sluicePeakOffset(x: number, z: number): number {
  const dx = x - SLUICE_PEAK.x;
  const dz = z - SLUICE_PEAK.z;
  const d2 = dx * dx + dz * dz;
  const reach = SLUICE_PEAK.sigma * 3;
  if (d2 >= reach * reach) return 0;
  return SLUICE_PEAK.height * Math.exp(-d2 / (2 * SLUICE_PEAK.sigma * SLUICE_PEAK.sigma));
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

// Raise the Sluice bridge causeway: a gently-arched deck spanning the channel.
// Only ever RAISES terrain (max against the natural surface), ramps to the banks
// at the span ends, and tapers to a crisp edge across x so the river shows on
// either side. Applied last in terrainHeight so nothing washes the deck out.
function sluiceBridgeOffset(x: number, z: number, h: number): number {
  const b = SLUICE_BRIDGE;
  const dx = x - b.x;
  const dz = z - b.z;
  if (Math.abs(dx) >= b.halfWidth || Math.abs(dz) >= b.halfSpan) return h;
  const zt = dz / b.halfSpan;
  const deck = b.deckBase + b.crown * (1 - zt * zt); // parabolic crown, high at center
  const lenBlend = smoothstep(b.halfSpan, b.halfSpan - b.rampZ, Math.abs(dz)); // ramp to banks
  const widthBlend = smoothstep(b.halfWidth, b.halfWidth - b.edge, Math.abs(dx)); // parapet edge
  const blend = lenBlend * widthBlend;
  const target = Math.max(h, deck); // never dig below the natural bank at the ends
  return h + (target - h) * blend;
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
  return h;
}

// Ground height including instanced dungeon floors (flat, far off-world).
export function groundHeight(x: number, z: number, seed: number): number {
  if (x > DUNGEON_X_THRESHOLD) return DUNGEON_FLOOR_Y;
  return terrainHeight(x, z, seed);
}

export function terrainHeight(x: number, z: number, seed: number): number {
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
  h += mirefenImpactCraterOffset(x, z);
  h = sluiceBridgeOffset(x, z, h);
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
  { x: 38, z: 56 }, // beaver lodge (inn)
  { x: 46, z: 58 }, // beaver den (house)
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

export function zoneBiomeAt(z: number): BiomeId {
  for (const zone of ZONES) {
    if (z < zone.zMax) return zone.biome;
  }
  return ZONES[ZONES.length - 1].biome;
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
