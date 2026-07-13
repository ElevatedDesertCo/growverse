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

// The client's catch popup is driven by a structured `fishCatch` SimEvent (no
// text, so the sim stays language-agnostic). Lock the emit contract: a resolved
// cast always emits exactly one fishCatch, carrying the caught item id (or null
// on a miss) so the HUD can show the fish icon + localized name.
describe('completeFishing fishCatch event', () => {
  type FishCatch = { type: 'fishCatch'; itemId: string | null; rare: boolean };
  // Drive completeFishing directly on a seeded Sim and capture the fishCatch it
  // emits. `players` is a Map<entityId, PlayerMeta>; `completeFishing(p, meta)`
  // is private, reached via the standard test cast-to-any escape hatch.
  const resolveCast = (seed: number): FishCatch => {
    const s = new Sim({ seed, playerClass: 'warrior', autoEquip: true });
    const p = s.player;
    const meta = (s as unknown as { players: Map<number, unknown> }).players.get(p.id);
    p.pos.x = SHORE.x;
    p.pos.z = SHORE.z;
    const events: FishCatch[] = [];
    const orig = (s as unknown as { emit(ev: unknown): void }).emit.bind(s);
    (s as unknown as { emit(ev: unknown): void }).emit = (ev: unknown): void => {
      if ((ev as { type?: string }).type === 'fishCatch') events.push(ev as FishCatch);
      orig(ev);
    };
    (s as unknown as { completeFishing(e: typeof p, m: unknown): void }).completeFishing(p, meta);
    // Exactly one fishCatch per resolved cast, always.
    expect(events).toHaveLength(1);
    const ev = events[0];
    // A caught fish is added to the bag, so its id must be a real item; a miss
    // (null id) is never flagged rare.
    if (ev.itemId === null) expect(ev.rare).toBe(false);
    else expect(s.countItem(ev.itemId)).toBeGreaterThan(0);
    return ev;
  };

  it('emits exactly one fishCatch per cast, covering both a catch and a miss', () => {
    let sawCatch = false;
    let sawMiss = false;
    for (let seed = 0; seed < 60 && !(sawCatch && sawMiss); seed++) {
      const ev = resolveCast(seed);
      if (ev.itemId === null) sawMiss = true;
      else sawCatch = true;
    }
    expect(sawCatch).toBe(true);
    expect(sawMiss).toBe(true);
  });
});
