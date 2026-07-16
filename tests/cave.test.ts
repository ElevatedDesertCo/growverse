import { describe, expect, it } from 'vitest';
import { isBlocked } from '../src/sim/colliders';
import { SKELETON_CAVE, terrainHeight } from '../src/sim/world';

// Wither Hollow (SKELETON_CAVE): one const drives the terrain carve (skeletonCaveOffset),
// the render mesh (render/cave.ts), and the movement colliders (colliders.ts). These tests
// pin the load-bearing facts: the carve digs a flat, level lair floor with a steep mountain
// cliff behind the back wall; the flank walls, back wall, and mouth jambs block; and the
// mouth (low-x, between the jambs) stays open so the player can walk in to fight the husks.
const SEED = 20061;
const c = SKELETON_CAVE;
const xMouth = c.x - c.half;
const xBack = c.x + c.half;

describe('wither hollow cave', () => {
  it('carves a flat, level lair floor across the pad', () => {
    const pts: [number, number][] = [
      [c.x, c.z],
      [c.x - 4, c.z],
      [c.x + 4, c.z],
      [c.x, c.z - 4],
      [c.x, c.z + 4],
      [xMouth, c.z],
    ];
    for (const [x, z] of pts) {
      expect(terrainHeight(x, z, SEED)).toBeCloseTo(c.floorY, 3);
    }
  });

  it('rises into a steep mountain cliff behind the back wall', () => {
    // just past the recess back the world-rim mountain climbs far above the lair floor,
    // so the back reads as bored into the hillside (not an open field on all sides).
    expect(terrainHeight(xBack + 8, c.z, SEED)).toBeGreaterThan(c.floorY + 15);
  });

  it('blocks the flank walls, back wall, and mouth jambs', () => {
    // flank walls (mid-run, along each side)
    expect(isBlocked(SEED, c.x, c.z + c.mouthHalf + c.wallThick)).toBe(true); // north flank
    expect(isBlocked(SEED, c.x, c.z - c.mouthHalf - c.wallThick)).toBe(true); // south flank
    // back wall
    expect(isBlocked(SEED, xBack, c.z)).toBe(true);
    // mouth jambs
    expect(isBlocked(SEED, xMouth, c.z - c.mouthHalf)).toBe(true);
    expect(isBlocked(SEED, xMouth, c.z + c.mouthHalf)).toBe(true);
  });

  it('leaves the mouth open and the lair chamber walkable', () => {
    // the mouth opening between the jambs (on the centre lane) is clear
    expect(isBlocked(SEED, xMouth, c.z)).toBe(false);
    // the interior lair floor where the husks muster is clear
    expect(isBlocked(SEED, c.x, c.z)).toBe(false);
    expect(isBlocked(SEED, c.x - 2, c.z)).toBe(false);
  });
});
