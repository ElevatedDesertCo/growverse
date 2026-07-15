// Walkable stone staircases (src/sim/world.ts stairsOffset): each PROPS.stairs entry carves a
// straight, uniform-grade ramp up a steep hillside from the FOOT (x1,z1) to the TOP landing
// (x2,z2), so the render treads (render/props.ts, which sample the same terrainHeight) sit on a
// climbable incline. The player rides terrainHeight, so these tests assert the ramp climbs at a
// grade the sim move gate never blocks, meets natural grade flush at both ends, and never
// disturbs the world away from a stair. Uses the fixed client world seed so it reflects the
// real vale.

import { describe, expect, it } from 'vitest';
import { PROPS } from '../src/sim/data';
import { PLAYER_MAX_CLIMB_SLOPE } from '../src/sim/pathfind';
import { terrainHeight, terrainHeightNatural } from '../src/sim/world';

const SEED = 20061; // src/main.ts WORLD_SEED: Growverse is a fixed, persistent place

const stairs = PROPS.stairs ?? [];

describe('walkable stone staircases', () => {
  it('at least one staircase exists (so stairsOffset is exercised)', () => {
    expect(stairs.length).toBeGreaterThan(0);
  });

  it('climbs at a grade the move gate never blocks', () => {
    for (const s of stairs) {
      const ax = s.x2 - s.x1;
      const az = s.z2 - s.z1;
      const runLen = Math.hypot(ax, az);
      const ux = ax / runLen;
      const uz = az / runLen;
      // Walk the centreline foot -> top in small sim-scale steps; every uphill step's
      // rise/run must stay within the climb gate, or the sim would wall the player off.
      const STEP = 0.3;
      let prev = terrainHeight(s.x1, s.z1, SEED);
      for (let along = STEP; along <= runLen; along += STEP) {
        const x = s.x1 + ux * along;
        const z = s.z1 + uz * along;
        const h = terrainHeight(x, z, SEED);
        const rise = h - prev;
        if (rise > 0) expect(rise / STEP).toBeLessThanOrEqual(PLAYER_MAX_CLIMB_SLOPE);
        prev = h;
      }
    }
  });

  it('meets natural grade flush at the foot and the top landing', () => {
    for (const s of stairs) {
      expect(terrainHeight(s.x1, s.z1, SEED)).toBeCloseTo(
        terrainHeightNatural(s.x1, s.z1, SEED),
        2,
      );
      expect(terrainHeight(s.x2, s.z2, SEED)).toBeCloseTo(
        terrainHeightNatural(s.x2, s.z2, SEED),
        2,
      );
    }
  });

  it('actually lifts the mid-run surface toward the straight ramp', () => {
    // The vale stair cuts across a hollowed channel, so mid-run the ramp should raise the
    // walk surface above the natural dip (proving the ramp is present, not a no-op).
    for (const s of stairs) {
      const mx = (s.x1 + s.x2) / 2;
      const mz = (s.z1 + s.z2) / 2;
      const footY = terrainHeightNatural(s.x1, s.z1, SEED);
      const topY = terrainHeightNatural(s.x2, s.z2, SEED);
      const rampMid = (footY + topY) / 2;
      expect(terrainHeight(mx, mz, SEED)).toBeCloseTo(rampMid, 1);
    }
  });

  it('leaves the open world untouched away from any staircase', () => {
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

  it('is deterministic (same seed, same surface)', () => {
    for (const s of stairs) {
      const mx = (s.x1 + s.x2) / 2;
      const mz = (s.z1 + s.z2) / 2;
      expect(terrainHeight(mx, mz, SEED)).toBe(terrainHeight(mx, mz, SEED));
    }
  });
});
