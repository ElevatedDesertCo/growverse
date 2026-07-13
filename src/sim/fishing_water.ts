import { PLAYER_SWIM_DEPTH } from './pathfind';
import { groundHeight, WATER_LEVEL } from './world';

// Ahead-facing sample distances (yards) for the "is there open water in front of
// me" test that gates a fishing cast. Shared by the sim's authoritative check
// (Sim.hasFishableWaterAhead) and the client's F-to-cast pre-check so the two can
// never drift.
export const FISHING_SAMPLE_DISTANCES = [4, 8, 12, 16, 20, 24];

// True if any ahead sample sits over water deep enough to fish (ground at least
// PLAYER_SWIM_DEPTH below the water line). Pure and deterministic: the same terrain
// math the sim and renderer already share, so a client can pre-check where F should
// cast without duplicating the constants or forking the result.
export function facesFishableWater(
  pos: { x: number; z: number },
  facing: number,
  seed: number,
): boolean {
  const sin = Math.sin(facing);
  const cos = Math.cos(facing);
  return FISHING_SAMPLE_DISTANCES.some(
    (d) => groundHeight(pos.x + sin * d, pos.z + cos * d, seed) < WATER_LEVEL - PLAYER_SWIM_DEPTH,
  );
}
