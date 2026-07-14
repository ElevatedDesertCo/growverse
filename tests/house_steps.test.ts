// House entry ramps (src/sim/world.ts houseStepsOffset): a plinth-seated house renders a
// flight of cosmetic stone steps down its door (+z) edge (render/props.ts addSteps). The
// player rides terrainHeight, so terrainHeight raises a walkable ramp under those steps from
// the seated sill down to natural grade, held under MAX_CLIMB_SLOPE so the sim's move gate
// (sim.ts: blocks a step whose rise/run exceeds MAX_CLIMB_SLOPE) never treats it as a cliff.
// These tests assert the ramp is climbable, only ever raises, and never disturbs the walls or
// the world away from a door. Uses the fixed client world seed so it reflects the real town.

import { describe, expect, it } from 'vitest';
import { PROPS } from '../src/sim/data';
import { PLAYER_MAX_CLIMB_SLOPE } from '../src/sim/pathfind';
import { terrainHeight, terrainHeightNatural } from '../src/sim/world';

const SEED = 20061; // src/main.ts WORLD_SEED: Growverse is a fixed, persistent place

type Building = (typeof PROPS.buildings)[number];

// Mirror render/props.ts: seat the sill at the highest footprint corner (sampled from the
// NATURAL surface), and measure the drop to the stair foot a touch past the door edge.
function seatAndDrop(b: Building): { hi: number; foot: number; drop: number } {
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  const hw = b.w / 2;
  const hd = b.d / 2;
  let hi = -Infinity;
  for (const lx of [-hw, hw]) {
    for (const lz of [-hd, hd]) {
      const wx = b.x + lx * c + lz * s;
      const wz = b.z - lx * s + lz * c;
      hi = Math.max(hi, terrainHeightNatural(wx, wz, SEED));
    }
  }
  const doorProbe = b.d / 2 + 1.2;
  const foot = terrainHeightNatural(b.x + doorProbe * s, b.z + doorProbe * c, SEED);
  return { hi, foot, drop: hi - foot };
}

// A world point on the door-approach centerline, `along` yards out past the door edge.
function doorPoint(b: Building, along: number): { x: number; z: number } {
  const s = Math.sin(b.rot);
  const c = Math.cos(b.rot);
  const lz = b.d / 2 + along;
  return { x: b.x + lz * s, z: b.z + lz * c };
}

// The render lays steps only when the door drop clears the same 0.5yd gate the ramp uses.
const steppedBuildings = PROPS.buildings.filter((b) => seatAndDrop(b).drop > 0.5);

describe('house entry ramps', () => {
  it('some town houses actually need steps (so the ramp is exercised)', () => {
    expect(steppedBuildings.length).toBeGreaterThan(0);
  });

  it('the door approach climbs at a grade the move gate never blocks', () => {
    for (const b of steppedBuildings) {
      // Walk inward from the stair foot toward the wall in sim-scale steps, sampling the
      // walkable surface. Every UPHILL step's rise/run must stay within the climb gate, or
      // the sim would wall the player off partway up. Start just outside the wall OBB
      // (|local z| <= d/2 is solid) and stop before it.
      const STEP = 0.3;
      let prev = terrainHeight(doorPoint(b, 6).x, doorPoint(b, 6).z, SEED);
      for (let along = 6 - STEP; along >= 0.2; along -= STEP) {
        const p = doorPoint(b, along);
        const h = terrainHeight(p.x, p.z, SEED);
        const rise = h - prev;
        if (rise > 0) {
          expect(rise / STEP).toBeLessThanOrEqual(PLAYER_MAX_CLIMB_SLOPE);
        }
        prev = h;
      }
    }
  });

  it('raises the door approach up toward the sill (the ramp exists)', () => {
    for (const b of steppedBuildings) {
      const { hi } = seatAndDrop(b);
      // Just outside the wall the ramp should have lifted the ground well above natural,
      // up near the seated sill so there is no unclimbable lip at the threshold.
      const p = doorPoint(b, 0.3);
      const ramped = terrainHeight(p.x, p.z, SEED);
      const natural = terrainHeightNatural(p.x, p.z, SEED);
      expect(ramped).toBeGreaterThan(natural + 0.2);
      expect(ramped).toBeGreaterThan(hi - 0.6);
    }
  });

  it('only ever raises: terrainHeight >= natural everywhere sampled', () => {
    for (const b of steppedBuildings) {
      for (let along = 0; along <= 6; along += 0.25) {
        for (const off of [-2, -1, 0, 1, 2]) {
          const s = Math.sin(b.rot);
          const c = Math.cos(b.rot);
          const lz = b.d / 2 + along;
          const x = b.x + off * c + lz * s;
          const z = b.z - off * s + lz * c;
          expect(terrainHeight(x, z, SEED)).toBeGreaterThanOrEqual(
            terrainHeightNatural(x, z, SEED),
          );
        }
      }
    }
  });

  it('never disturbs the walls (footprint interior stays natural)', () => {
    for (const b of PROPS.buildings) {
      // building centre and the four mid-wall points are all inside/at the footprint edge
      expect(terrainHeight(b.x, b.z, SEED)).toBe(terrainHeightNatural(b.x, b.z, SEED));
    }
  });

  it('leaves the open world untouched away from any door', () => {
    // a scatter of points well clear of the town buildings
    const pts = [
      { x: 120, z: 120 },
      { x: -140, z: -60 },
      { x: 0, z: 200 },
      { x: 80, z: -200 },
    ];
    for (const p of pts) {
      expect(terrainHeight(p.x, p.z, SEED)).toBe(terrainHeightNatural(p.x, p.z, SEED));
    }
  });
});
