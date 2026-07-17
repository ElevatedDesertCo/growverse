import { describe, expect, it } from 'vitest';
import { isBlocked } from '../src/sim/colliders';
import { SKELETON_CAVE, terrainHeight } from '../src/sim/world';

// Wither Hollow (SKELETON_CAVE): one const drives the terrain carve (skeletonCaveOffset),
// the render mesh (render/cave.ts), and the movement colliders (colliders.ts). These tests
// pin the load-bearing facts of the KEYHOLE cave system: the carve digs a flat, level floor
// the whole way from the entrance mouth, through the narrow tunnel, into the wide DEEP inner
// chamber; the mountain walls the tunnel and chamber as steep, unclimbable rock cliffs on
// every side except the mouth; the tunnel walls, chamber walls, shoulder step, back wall, and
// mouth jambs block; and the mouth (low-x, between the jambs) stays open so the player can
// walk in to fight the husks mustered deep in the chamber.
const SEED = 20061;
const c = SKELETON_CAVE;

describe('wither hollow cave', () => {
  it('carves a flat, level floor from the mouth through the tunnel into the deep chamber', () => {
    const pts: [number, number][] = [
      [c.mouthX, c.z], // entrance mouth
      [(c.mouthX + c.throatX) / 2, c.z], // mid tunnel
      [c.throatX, c.z], // throat
      [c.x, c.z], // chamber centre
      [c.x, c.z - 6], // chamber, off-centre (well inside chamberHalf)
      [c.x, c.z + 6],
      [c.backX - 2, c.z], // deep at the back
    ];
    for (const [x, z] of pts) {
      expect(terrainHeight(x, z, SEED)).toBeCloseTo(c.floorY, 1);
    }
  });

  it('rises into steep, unclimbable mountain cliffs walling the chamber', () => {
    // just past the back wall and past each deep-chamber flank the world-rim mountain climbs
    // far above the floor, so the cave reads as bored DEEP into the hillside (not an alcove).
    const xDeep = (c.throatX + c.backX) / 2; // sample the flanks deep in the chamber
    expect(terrainHeight(c.backX + 6, c.z, SEED)).toBeGreaterThan(c.floorY + 15); // behind back
    expect(terrainHeight(xDeep, c.z + c.chamberHalf + 6, SEED)).toBeGreaterThan(c.floorY + 15); // N
    expect(terrainHeight(xDeep, c.z - c.chamberHalf - 6, SEED)).toBeGreaterThan(c.floorY + 15); // S
  });

  it('blocks the tunnel walls, chamber walls, shoulder step, back wall, and mouth jambs', () => {
    // tunnel flank walls (mid-tunnel, along each side)
    const xTunnel = (c.mouthX + c.throatX) / 2;
    expect(isBlocked(SEED, xTunnel, c.z + c.mouthHalf + c.wallThick)).toBe(true);
    expect(isBlocked(SEED, xTunnel, c.z - c.mouthHalf - c.wallThick)).toBe(true);
    // deep chamber flank walls (mid-chamber, along each side)
    const xChamber = (c.throatX + c.backX) / 2;
    expect(isBlocked(SEED, xChamber, c.z + c.chamberHalf + c.wallThick)).toBe(true);
    expect(isBlocked(SEED, xChamber, c.z - c.chamberHalf - c.wallThick)).toBe(true);
    // shoulder step at the throat (between mouthHalf and chamberHalf, off the centre lane)
    expect(isBlocked(SEED, c.throatX, c.z + (c.mouthHalf + c.chamberHalf) / 2)).toBe(true);
    // back wall
    expect(isBlocked(SEED, c.backX, c.z)).toBe(true);
    // mouth jambs
    expect(isBlocked(SEED, c.mouthX, c.z - c.mouthHalf)).toBe(true);
    expect(isBlocked(SEED, c.mouthX, c.z + c.mouthHalf)).toBe(true);
  });

  it('leaves the mouth open and the tunnel + chamber walkable', () => {
    // the mouth opening between the jambs (on the centre lane) is clear
    expect(isBlocked(SEED, c.mouthX, c.z)).toBe(false);
    // the tunnel lane is clear
    expect(isBlocked(SEED, (c.mouthX + c.throatX) / 2, c.z)).toBe(false);
    // the interior chamber floor where the husks muster is clear
    expect(isBlocked(SEED, c.x, c.z)).toBe(false);
    expect(isBlocked(SEED, c.backX - 6, c.z)).toBe(false);
  });
});
