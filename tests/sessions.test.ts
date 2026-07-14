// Bloom Sessions: spark tonics apply their buff instantly, the restful profile carries
// a couch-lock movement tradeoff, and the edible lozenge takes hold only after its
// onset delay. Covers src/sim/sessions.ts + the elixir item path.

import { beforeEach, describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import type { Aura, Entity, PlayerClass } from '../src/sim/types';

const makeSim = (cls: PlayerClass = 'warrior', seed = 42) =>
  new Sim({ seed, playerClass: cls, autoEquip: true });
const aura = (p: Entity, name: string): Aura | undefined => p.auras.find((a) => a.name === name);

describe('Bloom Sessions', () => {
  let sim: Sim;
  beforeEach(() => {
    sim = makeSim('warrior');
  });

  it('a spark tonic applies its buff instantly and consumes one item', () => {
    sim.addItem('lively_bloom_tonic', 2);
    sim.useItem('lively_bloom_tonic');
    const buff = aura(sim.player, 'Lively Bloom');
    expect(buff).toBeDefined();
    expect(buff?.kind).toBe('buff_haste');
    expect(sim.player.pendingSession).toBeNull();
    expect(sim.countItem('lively_bloom_tonic')).toBe(1);
  });

  it('the restful tonic also applies a couch-lock slow that reduces move speed', () => {
    sim.addItem('restful_bloom_tonic', 1);
    const baseSpeed = (sim as unknown as { moveSpeedMult(e: Entity): number }).moveSpeedMult(
      sim.player,
    );
    sim.useItem('restful_bloom_tonic');
    expect(aura(sim.player, 'Restful Bloom')?.kind).toBe('buff_sta');
    const couchLock = aura(sim.player, 'Couch-Lock');
    expect(couchLock?.kind).toBe('slow');
    const slowedSpeed = (sim as unknown as { moveSpeedMult(e: Entity): number }).moveSpeedMult(
      sim.player,
    );
    expect(slowedSpeed).toBeLessThan(baseSpeed);
  });

  it('a spark buff_sta tonic raises stamina after a recalc tick', () => {
    sim.addItem('restful_bloom_tonic', 1);
    const before = sim.player.stats.sta;
    sim.useItem('restful_bloom_tonic');
    sim.tick(); // updateAuras recalcs stats while the buff is active
    expect(sim.player.stats.sta).toBe(before + 10);
  });

  it('an edible lozenge does NOT buff on use; it takes hold after its onset', () => {
    sim.addItem('slow_bloom_lozenge', 1);
    sim.useItem('slow_bloom_lozenge');
    // On use: item consumed, pending set, but no buff yet.
    expect(sim.countItem('slow_bloom_lozenge')).toBe(0);
    expect(sim.player.pendingSession).not.toBeNull();
    expect(aura(sim.player, 'Slow-Bloom')).toBeUndefined();
    // Onset is 12s. Tick just under it: still pending, still no buff.
    for (let i = 0; i < 20 * 11; i++) sim.tick();
    expect(sim.player.pendingSession).not.toBeNull();
    expect(aura(sim.player, 'Slow-Bloom')).toBeUndefined();
    // Tick past the onset: the buff takes hold and the pending slot clears.
    for (let i = 0; i < 20 * 2; i++) sim.tick();
    expect(sim.player.pendingSession).toBeNull();
    expect(aura(sim.player, 'Slow-Bloom')?.kind).toBe('buff_allstats');
  });

  it('a spark buff expires after its duration', () => {
    sim.addItem('lively_bloom_tonic', 1);
    sim.useItem('lively_bloom_tonic');
    expect(aura(sim.player, 'Lively Bloom')).toBeDefined();
    // Duration is 300s; tick a bit past it.
    for (let i = 0; i < 20 * 305; i++) sim.tick();
    expect(aura(sim.player, 'Lively Bloom')).toBeUndefined();
  });

  it('is deterministic: two identical run-throughs match aura state', () => {
    const run = () => {
      const s = makeSim('mage');
      s.addItem('balanced_bloom_tonic', 1);
      s.useItem('balanced_bloom_tonic');
      for (let i = 0; i < 20 * 5; i++) s.tick();
      return s.player.auras.map((a) => `${a.name}:${a.kind}:${a.value}`).sort();
    };
    expect(run()).toEqual(run());
  });
});
