import { describe, expect, it } from 'vitest';
import { ZONES } from '../src/sim/data';
import { nearestSubzone, SUBZONE_DEADBAND, SUBZONE_RADIUS } from '../src/ui/subzone';

const pois = [
  { x: 0, z: 0, label: 'Eastbrook' },
  { x: 100, z: 0, label: 'Boar Meadow' },
];

describe('nearestSubzone', () => {
  it('returns null in open wilderness, far from every landmark', () => {
    expect(nearestSubzone(50, 50, pois, null)).toBeNull();
  });

  it('picks the landmark the player is standing in', () => {
    expect(nearestSubzone(5, 5, pois, null)).toBe('Eastbrook');
    expect(nearestSubzone(100, 3, pois, null)).toBe('Boar Meadow');
  });

  it('picks the nearer of two in-range landmarks', () => {
    const close = [
      { x: 0, z: 0, label: 'A' },
      { x: 20, z: 0, label: 'B' },
    ];
    expect(nearestSubzone(2, 0, close, null)).toBe('A');
    expect(nearestSubzone(18, 0, close, null)).toBe('B');
  });

  it('keeps the current subzone within the dead-band (hysteresis)', () => {
    // just past the enter-radius but inside radius+deadband of Eastbrook
    const x = SUBZONE_RADIUS + SUBZONE_DEADBAND - 1;
    expect(nearestSubzone(x, 0, pois, null)).toBeNull();
    expect(nearestSubzone(x, 0, pois, 'Eastbrook')).toBe('Eastbrook');
  });

  it('drops the subzone once clear of the dead-band', () => {
    const x = SUBZONE_RADIUS + SUBZONE_DEADBAND + 1;
    expect(nearestSubzone(x, 0, pois, 'Eastbrook')).toBeNull();
  });
});

// The cultivation district is a single place in a player's head (beds, Breeding Chamber,
// Extraction Lab, Cup grounds), but it is spatially wedged between two unrelated
// landmarks. Before it had a POI of its own the banner read "The Lodge" at the Chamber
// and "The Withered Bloom" at the Lab. Pin the real zone data so moving any of the three
// POIs, or the district, cannot quietly hand the district back to a neighbour.
describe('The Grow Terrace covers the whole cultivation district', () => {
  const zone1 = ZONES.find((z) => z.pois.some((p) => p.label === 'The Grow Terrace'));

  it('is declared in zone 1', () => {
    expect(zone1).toBeDefined();
  });

  const stations: Array<[string, number, number]> = [
    ['the Breeding Chamber', 60, 45],
    ['the Extraction Lab', 74, 45],
    ['Cultivator Marlow', 60, 50],
    ['the bed grid centre', 60, 60],
    ['the Cup grounds', 60, 70],
  ];
  for (const [what, x, z] of stations) {
    it(`names ${what}`, () => {
      expect(nearestSubzone(x, z, zone1?.pois ?? [], null)).toBe('The Grow Terrace');
    });
  }

  // The other half of the contract: a POI wide enough to cover the district must not
  // reach past it. The Sluice outpost is the nearest neighbour that could be swallowed
  // (it keeps its own Baked Beaver banner, which is what it read before this POI too).
  it('does not reach the Sluice outpost', () => {
    expect(nearestSubzone(38, 60, zone1?.pois ?? [], null)).not.toBe('The Grow Terrace');
  });
});
