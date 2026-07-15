import { describe, expect, it } from 'vitest';
import { isBlocked } from '../src/sim/colliders';
import { DUNGEON_DEFS } from '../src/sim/content/dungeons';
import { SKELETON_FORT, terrainHeight } from '../src/sim/world';

// The huge Skeleton Grotto fort (SKELETON_FORT): one const drives both the render mesh
// (render/fort.ts) and the movement colliders (colliders.ts). These tests pin the load-
// bearing facts: it sits on the dead-flat grotto floor (no terrain edit), its curtain
// walls / towers / keep block, and its FRONT gate + REAR sally-port stay open so the
// courtyard and the hollow_crypt cave-mouth behind it remain reachable.
const SEED = 20061;
const f = SKELETON_FORT;

describe('skeleton grotto fort', () => {
  it('sits on the dead-flat grotto floor (no terrain edit needed)', () => {
    const pts: [number, number][] = [
      [f.x, f.z],
      [f.x - f.half, f.z],
      [f.x + f.half, f.z],
      [f.x, f.z - f.half],
      [f.x, f.z + f.half],
      [f.x - f.half, f.z - f.half],
      [f.x + f.half, f.z + f.half],
    ];
    for (const [x, z] of pts) {
      expect(terrainHeight(x, z, SEED)).toBeCloseTo(f.floorY, 3);
    }
  });

  it('blocks the curtain walls, corner towers, and central keep', () => {
    // solid wall runs (mid-segment, clear of the gate/sally gaps)
    expect(isBlocked(SEED, f.x, f.z - f.half)).toBe(true); // south wall
    expect(isBlocked(SEED, f.x, f.z + f.half)).toBe(true); // north wall
    expect(isBlocked(SEED, f.x - f.half, f.z - 9)).toBe(true); // front wall, south of the gate
    expect(isBlocked(SEED, f.x + f.half, f.z - 9)).toBe(true); // rear wall, south of the sally
    // corner towers
    expect(isBlocked(SEED, f.x - f.half, f.z - f.half)).toBe(true);
    expect(isBlocked(SEED, f.x + f.half, f.z + f.half)).toBe(true);
    // central keep
    expect(isBlocked(SEED, f.x, f.z)).toBe(true);
  });

  it('leaves the front gate and rear sally-port open, courtyard walkable', () => {
    // front gate opening (in the low-x wall, on the grotto mouth side)
    expect(isBlocked(SEED, f.x - f.half, f.z)).toBe(false);
    // rear sally-port opening (in the high-x wall)
    expect(isBlocked(SEED, f.x + f.half, f.z)).toBe(false);
    // open courtyard between the west wall and the keep
    expect(isBlocked(SEED, f.x - 8, f.z)).toBe(false);
  });

  it('keeps the hollow_crypt cave-mouth reachable behind the fort', () => {
    const door = DUNGEON_DEFS.hollow_crypt.doorPos;
    // the door sits on the flat floor just past the rear wall, clear of every collider
    expect(terrainHeight(door.x, door.z, SEED)).toBeCloseTo(f.floorY, 3);
    expect(isBlocked(SEED, door.x, door.z)).toBe(false);
    // and the sally-port lines up with it (same z lane)
    expect(door.z).toBe(f.z);
    expect(door.x).toBeGreaterThan(f.x + f.half);
  });
});
