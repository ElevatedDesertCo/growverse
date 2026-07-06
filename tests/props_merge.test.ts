import { describe, expect, it } from 'vitest';
import { TEMPLE_PROPS } from '../src/sim/content/temple';
import { ZONE1_PROPS } from '../src/sim/content/zone1';
import { ZONE2_PROPS } from '../src/sim/content/zone2';
import { ZONE3_PROPS } from '../src/sim/content/zone3';
import { PROPS } from '../src/sim/data';
import type { ZonePropsDef } from '../src/sim/types';

// Guards the `mergeProps()` optional-field trap in src/sim/data.ts: it rebuilds
// the runtime PROPS field-by-field, so any per-zone prop array NOT explicitly
// spread there is silently dropped before it reaches the renderer/colliders.
// This has bitten twice (delveMarkers, then the Ashen Maw camp fields). The test
// below fails the moment a new source field is added to a zone but forgotten in
// mergeProps: it proves every source array survives the merge with its full count.
const SOURCES: ZonePropsDef[] = [ZONE1_PROPS, ZONE2_PROPS, ZONE3_PROPS, TEMPLE_PROPS];

describe('mergeProps preserves every per-zone prop array', () => {
  // Every array-valued key that appears in ANY source set must exist in the
  // merged PROPS with a length equal to the sum of that key across all sources.
  const keys = new Set<string>();
  for (const s of SOURCES) {
    for (const [k, v] of Object.entries(s)) if (Array.isArray(v)) keys.add(k);
  }

  for (const key of keys) {
    it(`carries all "${key}" entries through the merge`, () => {
      const expected = SOURCES.reduce((n, s) => {
        const v = (s as unknown as Record<string, unknown>)[key];
        return n + (Array.isArray(v) ? v.length : 0);
      }, 0);
      const merged = (PROPS as unknown as Record<string, unknown>)[key];
      expect(Array.isArray(merged), `PROPS.${key} must be an array (dropped in mergeProps?)`).toBe(
        true,
      );
      expect((merged as unknown[]).length, `PROPS.${key} lost entries in mergeProps`).toBe(
        expected,
      );
    });
  }

  // Explicit regression pins for the Growverse-original Ashen Maw camp props that
  // were silently dropped before: they must reach the runtime tables non-empty.
  it('keeps the Ashen Maw 1-of-1 camp props non-empty', () => {
    expect((PROPS.wardStakes ?? []).length).toBeGreaterThan(0);
    expect((PROPS.spikeBarricades ?? []).length).toBeGreaterThan(0);
    expect((PROPS.warStandards ?? []).length).toBeGreaterThan(0);
    expect((PROPS.raiderCookfires ?? []).length).toBeGreaterThan(0);
    expect((PROPS.raiderTents ?? []).length).toBeGreaterThan(0);
  });
});
