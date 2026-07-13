import { describe, expect, it } from 'vitest';
import { FISHING_SAMPLE_DISTANCES, facesFishableWater } from '../src/sim/fishing_water';
import { Sim } from '../src/sim/sim';
import { FISHING_CAST_ID } from '../src/sim/types';
import { terrainHeight } from '../src/sim/world';

// The world runs on this fixed seed (src/main.ts WORLD_SEED); pick coordinates
// against it so the terrain math is the same one the live game samples.
const WORLD_SEED = 20061;

// A shore point south of the Deepfen Shallows lake (center is around x=-110,z=310).
// Standing here on dry ground, facing north puts open water within the ahead-sample
// window; facing south (away) or standing inland does not.
const SHORE = { x: -110, z: 360 };
const FACE_LAKE = Math.atan2(SHORE.x - SHORE.x, 310 - SHORE.z); // toward the lake center
const FACE_AWAY = Math.atan2(SHORE.x - SHORE.x, SHORE.z - 310); // away from the water
const INLAND = { x: 500, z: 0 }; // high dry mountains, no water in any direction

describe('facesFishableWater', () => {
  it('exposes the ahead-sample distances the cast pre-check walks', () => {
    expect(FISHING_SAMPLE_DISTANCES).toEqual([4, 8, 12, 16, 20, 24]);
  });

  it('is true when facing open water deep enough to fish', () => {
    expect(facesFishableWater(SHORE, FACE_LAKE, WORLD_SEED)).toBe(true);
  });

  it('is false when facing away from the water toward dry shore', () => {
    expect(facesFishableWater(SHORE, FACE_AWAY, WORLD_SEED)).toBe(false);
  });

  it('is false on dry inland ground in every direction', () => {
    for (let i = 0; i < 8; i++) {
      const facing = (i * Math.PI) / 4;
      expect(facesFishableWater(INLAND, facing, WORLD_SEED)).toBe(false);
    }
  });

  it('agrees with Sim.hasFishableWaterAhead for the same pos/facing/seed', () => {
    const sim = new Sim({ seed: WORLD_SEED, playerClass: 'warrior', autoEquip: true });
    const p = sim.player;
    for (const [pos, facing] of [
      [SHORE, FACE_LAKE],
      [SHORE, FACE_AWAY],
      [INLAND, 0],
    ] as const) {
      p.pos.x = pos.x;
      p.pos.z = pos.z;
      p.pos.y = terrainHeight(pos.x, pos.z, sim.cfg.seed);
      p.prevPos = { ...p.pos };
      p.facing = facing;
      const viaSim = (
        sim as unknown as { hasFishableWaterAhead(e: typeof p): boolean }
      ).hasFishableWaterAhead(p);
      const viaLeaf = facesFishableWater(p.pos, p.facing, sim.cfg.seed);
      expect(viaSim).toBe(viaLeaf);
    }
  });
});

describe('fishing pole cast gate', () => {
  it('using the pole over fishable water starts the fishing cast', () => {
    const sim = new Sim({ seed: WORLD_SEED, playerClass: 'warrior', autoEquip: true });
    const p = sim.player;
    p.pos.x = SHORE.x;
    p.pos.z = SHORE.z;
    p.pos.y = terrainHeight(SHORE.x, SHORE.z, sim.cfg.seed);
    p.prevPos = { ...p.pos };
    p.facing = FACE_LAKE;
    sim.addItem('simple_fishing_pole', 1);

    sim.useItem('simple_fishing_pole');

    expect(p.castingAbility).toBe(FISHING_CAST_ID);
  });

  it('using the pole while facing dry ground does not start a cast', () => {
    const sim = new Sim({ seed: WORLD_SEED, playerClass: 'warrior', autoEquip: true });
    const p = sim.player;
    p.pos.x = SHORE.x;
    p.pos.z = SHORE.z;
    p.pos.y = terrainHeight(SHORE.x, SHORE.z, sim.cfg.seed);
    p.prevPos = { ...p.pos };
    p.facing = FACE_AWAY;
    sim.addItem('simple_fishing_pole', 1);

    sim.useItem('simple_fishing_pole');

    expect(p.castingAbility).not.toBe(FISHING_CAST_ID);
  });
});
