// Tests for the pure stat-feedback detector (stat_feedback.ts): the DOM-free core
// that turns the per-frame stat stream into one-shot heal/mana/xp/level-up pulses.
// It pins the seed-on-first-observation (no login flash), the increase-only firing,
// the regen debounce, the undebounced level-up (which also pulses xp), and
// same-input determinism.

import { describe, expect, it } from 'vitest';
import {
  createStatFeedbackState,
  detectStatPulses,
  type StatFeedbackInput,
  type StatPulses,
} from '../src/ui/stat_feedback';

function out(): StatPulses {
  return { heal: false, mana: false, xp: false, levelUp: false };
}

function input(over: Partial<StatFeedbackInput> = {}): StatFeedbackInput {
  return {
    hp: 100,
    maxHp: 1000,
    resource: 50,
    maxResource: 500,
    lifetimeXp: 0,
    level: 1,
    now: 0,
    ...over,
  };
}

describe('detectStatPulses', () => {
  it('the first observation only seeds the baseline (no flash on login)', () => {
    const state = createStatFeedbackState();
    const p = detectStatPulses(state, input({ hp: 100, resource: 50, lifetimeXp: 200 }), out());
    expect(p).toEqual({ heal: false, mana: false, xp: false, levelUp: false });
    expect(state.seeded).toBe(true);
  });

  it('fires heal only when hp increases', () => {
    const state = createStatFeedbackState();
    detectStatPulses(state, input({ hp: 100, now: 0 }), out());
    // Damage: hp drops, no heal.
    expect(detectStatPulses(state, input({ hp: 60, now: 2000 }), out()).heal).toBe(false);
    // Restore: hp rises, heal fires (debounce window elapsed).
    expect(detectStatPulses(state, input({ hp: 90, now: 4000 }), out()).heal).toBe(true);
  });

  it('debounces a stream of small regen increments', () => {
    const state = createStatFeedbackState();
    detectStatPulses(state, input({ resource: 10, now: 0 }), out());
    // First gain fires.
    expect(detectStatPulses(state, input({ resource: 12, now: 2000 }), out()).mana).toBe(true);
    // A gain within the debounce window is swallowed.
    expect(detectStatPulses(state, input({ resource: 14, now: 2400 }), out()).mana).toBe(false);
    // A gain past the debounce window fires again.
    expect(detectStatPulses(state, input({ resource: 16, now: 3200 }), out()).mana).toBe(true);
  });

  it('bypasses the debounce for a large single heal (a real clutch heal always flashes)', () => {
    const state = createStatFeedbackState();
    detectStatPulses(state, input({ hp: 100, maxHp: 1000, now: 0 }), out());
    // A small regen tick past the debounce window fires and re-arms the debounce.
    expect(detectStatPulses(state, input({ hp: 110, maxHp: 1000, now: 2000 }), out()).heal).toBe(
      true,
    );
    // A big heal (>=15% of max) WITHIN the debounce window still fires.
    const p = detectStatPulses(state, input({ hp: 700, maxHp: 1000, now: 2300 }), out());
    expect(p.heal).toBe(true);
  });

  it('detects an xp gain from lifetime xp (survives the level-bar reset)', () => {
    const state = createStatFeedbackState();
    detectStatPulses(state, input({ lifetimeXp: 500, now: 0 }), out());
    expect(detectStatPulses(state, input({ lifetimeXp: 900, now: 2000 }), out()).xp).toBe(true);
  });

  it('fires level-up immediately (undebounced) and pulses xp too', () => {
    const state = createStatFeedbackState();
    detectStatPulses(state, input({ level: 1, lifetimeXp: 100, now: 0 }), out());
    // A recent xp pulse would normally debounce, but a level-up is not debounced.
    detectStatPulses(state, input({ level: 1, lifetimeXp: 200, now: 100 }), out());
    const p = detectStatPulses(state, input({ level: 2, lifetimeXp: 250, now: 300 }), out());
    expect(p.levelUp).toBe(true);
    expect(p.xp).toBe(true);
  });

  it('is deterministic: equal state + input give equal pulses', () => {
    const a = createStatFeedbackState();
    const b = createStatFeedbackState();
    detectStatPulses(a, input({ hp: 100, now: 0 }), out());
    detectStatPulses(b, input({ hp: 100, now: 0 }), out());
    const pa = detectStatPulses(a, input({ hp: 120, now: 5000 }), out());
    const pb = detectStatPulses(b, input({ hp: 120, now: 5000 }), out());
    expect(pa).toEqual(pb);
  });
});
