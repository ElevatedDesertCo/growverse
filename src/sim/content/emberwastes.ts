// The Emberwastes: realm 1, a portal-reached desert dimension (see
// docs/design/realms.md). This is the M1-prototype STUB: just the RealmDef so the
// portal transition + realm-scoped terrain have a real target. It occupies a far
// coordinate band with its own zone strip and terrain seed, and (for now) reuses
// the `vale` biome, which already renders as a sun-baked desert. M1.4 fills it in
// (more sub-zones, the Caravanserai town, mobs, the Sunflare-Bulb seed loop, the
// quest arc, the dungeon) and places the actual portal objects.

import type { RealmDef, ZoneDef } from '../types';

const SUNMOURN_DUNES: ZoneDef = {
  id: 'sunmourn_dunes',
  name: 'Sunmourn Dunes',
  zMin: -560,
  zMax: 780,
  levelRange: [8, 11],
  biome: 'vale',
  hub: { x: 12000, z: 20, radius: 14, name: 'Caravanserai' },
  graveyard: { x: 12000, z: 8 },
  lakes: [],
  pois: [],
  welcome: '',
};

export const EMBERWASTES_REALM: RealmDef = {
  id: 'emberwastes',
  name: 'The Emberwastes',
  // A far, otherwise-unused band (well past the dungeon/arena/delve x-bands).
  band: { xMin: 11820, xMax: 12180, zMin: -560, zMax: 780 },
  terrainSeed: 71000,
  zones: [SUNMOURN_DUNES],
  hubPos: { x: 12000, z: 20 }, // the Caravanserai (portal arrival)
  returnPortalPos: { x: 12000, z: 14 }, // the return gate, just south of the hub
  entryPortalPos: { x: 0, z: -30 }, // the overworld-side gate (Bloomhaven south)
  unlock: { minLevel: 8 },
};
