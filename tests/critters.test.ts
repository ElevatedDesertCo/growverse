import { describe, expect, it } from 'vitest';
import { buildCritters, causewayPopScale } from '../src/render/critters';

// The Eastbrook Vale / Mirefen Marsh boundary runs along the causeway at z=180.
// Ambient critters thin out across this band (see critters.ts), so the active
// pool tapers to a sparse floor centred on the crossing.
const CAUSEWAY_Z = 180;
const DUNGEON_X = 700; // x beyond DUNGEON_X_THRESHOLD (600) = indoors

describe('critter causeway population taper', () => {
  it('is full in the open vale/marsh and sparse on the causeway', () => {
    // Deep in Eastbrook and deep in Mirefen: full density.
    expect(causewayPopScale(0)).toBeCloseTo(1, 6);
    expect(causewayPopScale(360)).toBeCloseTo(1, 6);
    // On the causeway boundary: thinned to the floor.
    expect(causewayPopScale(CAUSEWAY_Z)).toBeLessThan(0.5);
    // Strictly fewer near the crossing than away from it.
    expect(causewayPopScale(CAUSEWAY_Z)).toBeLessThan(causewayPopScale(0));
  });

  it('tapers monotonically as the player approaches the causeway', () => {
    let prev = causewayPopScale(0);
    for (let z = 20; z <= CAUSEWAY_Z; z += 20) {
      const cur = causewayPopScale(z);
      expect(cur).toBeLessThanOrEqual(prev + 1e-9);
      prev = cur;
    }
  });

  it('never shows more critters than the tapered cap allows', () => {
    const { group, update } = buildCritters(1234);
    const pool = group.children.length;
    const countVisible = () => group.children.filter((m) => m.visible).length;
    // Settle the pool at each sample position, then assert the visible count
    // respects the per-position active cap.
    for (const z of [0, 120, CAUSEWAY_Z, 240, 360]) {
      for (let i = 0; i < 20; i++) update(0, z, 0.1);
      const cap = Math.round(pool * causewayPopScale(z));
      expect(countVisible()).toBeLessThanOrEqual(cap);
    }
  });

  it('never pops in clustered at the player spawn origin', () => {
    // Regression: critters init at (0,0) and, if the player spawns at town center,
    // the old code showed them all sitting on the origin and dispersing outward.
    // After the fix each critter must scatter into the SPAWN ring (>=16yd) before
    // it is ever made visible, so nothing is visible right on top of the player.
    const { group, update } = buildCritters(20061);
    // A few frames from the player standing at world origin (town center).
    for (let i = 0; i < 5; i++) update(0, 0, 0.1);
    const clustered = group.children.filter(
      (m) => m.visible && Math.hypot(m.position.x, m.position.z) < 12,
    );
    expect(clustered.length).toBe(0);
  });

  it('hides the whole pool inside an instance', () => {
    const { group, update } = buildCritters(7);
    update(DUNGEON_X, 0, 0.1);
    expect(group.visible).toBe(false);
    update(0, 0, 0.1);
    expect(group.visible).toBe(true);
  });
});
