import { describe, expect, it } from 'vitest';
import { realmAt, zoneAtXZ } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import type { RealmDef, ZoneDef } from '../src/sim/types';
import { realmTerrainHeight } from '../src/sim/world';

// M1.2: realm-scoped terrain. The realm registry (data.ts REALMS) is empty for
// now, so realmAt is always null at runtime and the overworld heightfield is
// byte-identical (guarded by tests/parity). Here we drive the realm-terrain path
// directly with a fixture realm to prove it is deterministic and self-contained.

const zone = (
  id: string,
  zMin: number,
  zMax: number,
  biome: ZoneDef['biome'],
  hub: { x: number; z: number },
): ZoneDef => ({
  id,
  name: id,
  zMin,
  zMax,
  levelRange: [8, 18],
  biome,
  hub: { x: hub.x, z: hub.z, radius: 12, name: `${id} hub` },
  graveyard: { x: hub.x, z: hub.z - 10 },
  lakes: [],
  pois: [],
  welcome: '',
});

const REALM: RealmDef = {
  id: 'test_realm',
  name: 'Test Realm',
  band: { xMin: 9000, xMax: 9360, zMin: -200, zMax: 400 },
  terrainSeed: 4242,
  zones: [
    zone('tr_a', -200, 100, 'vale', { x: 9100, z: 20 }),
    zone('tr_b', 100, 400, 'peaks', { x: 9260, z: 300 }),
  ],
  hubPos: { x: 9100, z: 20 },
  returnPortalPos: { x: 9100, z: 24 },
  entryPortalPos: { x: 0, z: -20 },
};

describe('realms: realm-scoped terrain (M1.2)', () => {
  it('realmTerrainHeight is deterministic', () => {
    expect(realmTerrainHeight(REALM, 9120, 40, 20061)).toBe(
      realmTerrainHeight(REALM, 9120, 40, 20061),
    );
  });

  it('produces finite, dry-ish terrain across the realm band', () => {
    for (const [x, z] of [
      [9100, 20],
      [9200, 150],
      [9050, -50],
      [9300, 380],
    ]) {
      const h = realmTerrainHeight(REALM, x, z, 20061);
      expect(Number.isFinite(h)).toBe(true);
      expect(h).toBeGreaterThan(-20);
      expect(h).toBeLessThan(80);
    }
  });

  it('flattens the realm hub to its biome hub height', () => {
    // at the exact hub center the plateau blend fully overrides the noise
    expect(realmTerrainHeight(REALM, 9100, 20, 20061)).toBeCloseTo(1.5, 5);
  });

  it('the per-realm terrain seed changes the field', () => {
    const other: RealmDef = { ...REALM, terrainSeed: 1 };
    expect(realmTerrainHeight(REALM, 9120, 40, 20061)).not.toBe(
      realmTerrainHeight(other, 9120, 40, 20061),
    );
  });

  it('realmAt resolves the registered Emberwastes band and is null in the overworld', () => {
    expect(realmAt(12000, 20)?.id).toBe('emberwastes'); // inside the registered realm band
    expect(realmAt(0, 0)).toBeNull(); // overworld (parity-safe path)
    expect(realmAt(9120, 40)).toBeNull(); // the local fixture band is NOT registered
    // zoneAtXZ falls back to a real overworld zone in the overworld
    expect(typeof zoneAtXZ(0, 0).id).toBe('string');
  });
});

// Satisfy the Emberwastes unlock gate (level 8 + the intro quest done) so a test can
// step through the portal. Mirrors what completing q_ember_intro at level 8 leaves.
const qualifyForEmberwastes = (sim: Sim): void => {
  sim.setPlayerLevel(8);
  const meta = (
    sim as unknown as { ctx: { resolve(): { meta: { questLog: Map<string, unknown> } } } }
  ).ctx.resolve().meta;
  meta.questLog.set('q_ember_intro', { questId: 'q_ember_intro', counts: [4], state: 'done' });
};

describe('realms: portal transition (M1.3)', () => {
  it('enterRealm teleports to the hub and leaveRealm returns to the overworld gate', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warrior' });
    expect(sim.currentRealmId()).toBe('overworld');
    qualifyForEmberwastes(sim);

    sim.enterRealm('emberwastes');
    const hub = sim.player.pos;
    expect(Math.hypot(hub.x - 12000, hub.z - 20)).toBeLessThan(2);
    expect(sim.currentRealmId()).toBe('emberwastes');

    sim.leaveRealm();
    const back = sim.player.pos;
    expect(Math.hypot(back.x - 0, back.z - -30)).toBeLessThan(2);
    expect(sim.currentRealmId()).toBe('overworld');
  });

  it('enterRealm with an unknown realm id is a no-op', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warrior' });
    const before = { ...sim.player.pos };
    sim.enterRealm('nowhere');
    expect(sim.player.pos.x).toBe(before.x);
    expect(sim.player.pos.z).toBe(before.z);
  });
});

describe('realms: unlock gate (M2 polish)', () => {
  it('blocks a player who is under level or has not finished the intro quest', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warrior' });
    const before = { ...sim.player.pos };
    sim.enterRealm('emberwastes'); // level 1, no intro quest
    expect(sim.currentRealmId()).toBe('overworld');
    expect(sim.player.pos.x).toBe(before.x);
    expect(sim.player.pos.z).toBe(before.z);
  });

  it('blocks a level-8 player who still lacks the intro quest', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warrior' });
    sim.setPlayerLevel(8);
    sim.enterRealm('emberwastes');
    expect(sim.currentRealmId()).toBe('overworld');
  });

  it('admits a level-8 player who has finished the intro quest', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warrior' });
    qualifyForEmberwastes(sim);
    sim.enterRealm('emberwastes');
    expect(sim.currentRealmId()).toBe('emberwastes');
  });
});
