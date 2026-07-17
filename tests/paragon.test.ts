import { describe, expect, it } from 'vitest';
import {
  isValidParagon,
  PARAGON_NODES,
  PARAGON_START_LEVEL,
  type ParagonAllocation,
  paragonPointsAvailable,
  paragonPointsSpent,
  sanitizeParagon,
  withParagon,
} from '../src/sim/content/paragon';
import { emptyModifiers } from '../src/sim/content/talents';
import { Sim } from '../src/sim/sim';
import { MAX_LEVEL, virtualLevel, xpToReachLevel } from '../src/sim/types';

const makeSim = (cls = 'warrior', seed = 42) =>
  new Sim({ seed, playerClass: cls, autoEquip: true });

describe('paragon point economy (pure)', () => {
  it('grants no points at or below the start level, one per level above', () => {
    expect(paragonPointsAvailable(PARAGON_START_LEVEL)).toBe(0);
    expect(paragonPointsAvailable(PARAGON_START_LEVEL + 1)).toBe(1);
    expect(paragonPointsAvailable(MAX_LEVEL)).toBe(MAX_LEVEL - PARAGON_START_LEVEL);
  });

  it('keeps growing into the infinite virtual levels past the cap', () => {
    expect(paragonPointsAvailable(MAX_LEVEL + 50)).toBe(MAX_LEVEL + 50 - PARAGON_START_LEVEL);
    expect(paragonPointsAvailable(MAX_LEVEL + 50)).toBeGreaterThan(
      paragonPointsAvailable(MAX_LEVEL),
    );
  });

  it('counts spent points and validates against the budget', () => {
    const alloc: ParagonAllocation = { para_might: 3, para_barrier: 2 };
    expect(paragonPointsSpent(alloc)).toBe(5);
    expect(isValidParagon(alloc, 5)).toBe(true);
    expect(isValidParagon(alloc, 4)).toBe(false); // over budget
    expect(isValidParagon({ not_a_node: 1 }, 10)).toBe(false); // unknown node
    expect(isValidParagon({ para_might: -1 }, 10)).toBe(false); // negative
    expect(isValidParagon({ para_might: 1.5 }, 10)).toBe(false); // non-integer
  });

  it('sanitizes over-budget / unknown allocations by trimming in node order', () => {
    const trimmed = sanitizeParagon({ para_might: 5, para_barrier: 5, bogus: 9 }, 6);
    expect(paragonPointsSpent(trimmed)).toBe(6);
    expect(trimmed.bogus).toBeUndefined();
    expect(trimmed.para_might).toBe(5); // first node fills first
    expect(trimmed.para_barrier).toBe(1);
  });
});

describe('withParagon (stat fold)', () => {
  it('adds per-point node stats onto the base bundle, leaving base untouched', () => {
    const base = emptyModifiers();
    const might = PARAGON_NODES.find((n) => n.id === 'para_might')!;
    const folded = withParagon(base, { para_might: 4 });
    expect(folded.stats.str).toBe((might.per.str ?? 0) * 4);
    expect(base.stats.str).toBe(0); // base never mutated
  });

  it('returns the base reference for an empty allocation (no cost)', () => {
    const base = emptyModifiers();
    expect(withParagon(base, {})).toBe(base);
  });
});

describe('paragon on the Sim (allocation + stats + persistence)', () => {
  const atCap = (sim: Sim) => {
    sim.setPlayerLevel(MAX_LEVEL);
    // push lifetime XP well past the cap so there are paragon points to spend
    (sim as any).grantXp(xpToReachLevel(MAX_LEVEL + 20));
  };

  it('exposes a growing point budget past the cap and rejects over-spend', () => {
    const sim = makeSim();
    atCap(sim);
    const { total, spent } = sim.paragonPoints();
    expect(total).toBe(paragonPointsAvailable(virtualLevel(sim.lifetimeXp)));
    expect(total).toBeGreaterThan(0);
    expect(spent).toBe(0);
    // cannot spend more than the budget
    expect(sim.applyParagon({ para_might: total + 1 })).toBe(false);
    expect(sim.applyParagon({ bogus_node: 1 })).toBe(false);
  });

  it('allocation raises the matching stat and respec refunds it', () => {
    const sim = makeSim();
    atCap(sim);
    const strBefore = sim.player.stats.str;
    expect(sim.applyParagon({ para_might: 5 })).toBe(true);
    expect(sim.paragonPoints().spent).toBe(5);
    const might = PARAGON_NODES.find((n) => n.id === 'para_might')!;
    expect(sim.player.stats.str).toBe(strBefore + (might.per.str ?? 0) * 5);
    // respec refunds and reverts the stat
    expect(sim.respecParagon()).toBe(true);
    expect(sim.paragonPoints().spent).toBe(0);
    expect(sim.player.stats.str).toBe(strBefore);
  });

  it('persists the allocation across a serialize/reload round-trip', () => {
    const sim = makeSim();
    atCap(sim);
    expect(sim.applyParagon({ para_might: 3, para_fortitude: 2 })).toBe(true);
    const state = sim.serializeCharacter(sim.playerId)!;
    expect(state.paragon).toEqual({ para_might: 3, para_fortitude: 2 });

    const sim2 = makeSim();
    const pid = sim2.addPlayer('warrior', 'Reload', { state });
    expect(sim2.paragonAllocation(pid)).toEqual({ para_might: 3, para_fortitude: 2 });
    const might = PARAGON_NODES.find((n) => n.id === 'para_might')!;
    // the loaded character's Strength reflects the folded paragon points
    const reloaded = sim2.entities.get(pid)!;
    expect(reloaded.stats.str).toBeGreaterThanOrEqual((might.per.str ?? 0) * 3);
  });

  it('a talent respec preserves paragon stats (folded into the same bundle)', () => {
    const sim = makeSim();
    atCap(sim);
    sim.applyParagon({ para_might: 4 });
    const withPara = sim.player.stats.str;
    sim.respec(); // talent respec must not drop paragon
    expect(sim.player.stats.str).toBe(withPara);
  });
});
