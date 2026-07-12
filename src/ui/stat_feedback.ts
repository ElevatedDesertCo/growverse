// Pure, DOM-free detector of one-shot player-stat FEEDBACK pulses (the heal glow,
// the mana shimmer, the xp-gain pulse, the level-up flourish) from the per-frame
// stat stream. It compares the current stat snapshot against the last one it saw
// and returns which cosmetic pulses should fire THIS call. Gradual regen ticks are
// DEBOUNCED so a steady drip of small increments reads as an occasional shimmer,
// never a constant strobe; a level-up is a discrete, rare event and fires
// immediately (undebounced).
//
// Host-agnostic (the caller passes `now`, a UI-timing ms clock) so a Vitest drives
// it directly; the thin DOM consumer (stat_feedback_fx.ts) turns a StatPulses set
// into event-driven .animate() calls. Allocation-light: the detector mutates a
// caller-owned state object and writes into a reused `out` object, so the per-frame
// call allocates nothing.

export interface StatFeedbackInput {
  /** Current health (absolute). */
  hp: number;
  /** Max health, used to size the "significant jump" that bypasses the debounce so a
   *  real clutch heal always flashes even right after a regen tick. */
  maxHp: number;
  /** Current primary resource (absolute); only treated as mana by the caller when
   *  the class actually uses mana (rage/energy gains are not shimmered). */
  resource: number;
  /** Max primary resource, for the same significant-jump bypass on mana gains. */
  maxResource: number;
  /** Monotonic lifetime XP total (server-authoritative), so an xp gain is detected
   *  even across a level boundary where the level-bar xp resets. */
  lifetimeXp: number;
  /** Current level. */
  level: number;
  /** UI-timing clock in ms (performance.now at the call site). */
  now: number;
}

export interface StatPulses {
  heal: boolean;
  mana: boolean;
  xp: boolean;
  levelUp: boolean;
}

export interface StatFeedbackState {
  hp: number;
  resource: number;
  lifetimeXp: number;
  level: number;
  lastHealAt: number;
  lastManaAt: number;
  lastXpAt: number;
  /** false until the first observation seeds the baseline (so login/respawn does
   *  not fire a spurious flash on the very first frame). */
  seeded: boolean;
}

// Minimum gap between successive glow/shimmer/pulse firings, so a stream of small
// regen increments reads as an occasional pulse rather than a per-tick strobe.
const PULSE_DEBOUNCE_MS = 1100;

// A single increase of at least this FRACTION of max bypasses the debounce: a real
// clutch heal / big mana return should always flash, even if it lands right after a
// small regen tick that just spent the debounce window.
const SIGNIFICANT_JUMP_FRAC = 0.15;

export function createStatFeedbackState(): StatFeedbackState {
  return {
    hp: 0,
    resource: 0,
    lifetimeXp: 0,
    level: 0,
    lastHealAt: 0,
    lastManaAt: 0,
    lastXpAt: 0,
    seeded: false,
  };
}

/**
 * Detect the pulses that should fire this call, updating `state` in place and
 * writing the result into the reused `out` object (returned for convenience).
 * Deterministic: same (state, input) always yields the same out + state mutation.
 */
export function detectStatPulses(
  state: StatFeedbackState,
  input: StatFeedbackInput,
  out: StatPulses,
): StatPulses {
  out.heal = false;
  out.mana = false;
  out.xp = false;
  out.levelUp = false;

  // First observation only seeds the baseline; it never fires (no login flash).
  if (!state.seeded) {
    state.seeded = true;
    state.hp = input.hp;
    state.resource = input.resource;
    state.lifetimeXp = input.lifetimeXp;
    state.level = input.level;
    return out;
  }

  // A pulse fires on any increase once the debounce has elapsed, OR immediately for a
  // large single jump (a real heal / mana return) regardless of the debounce.
  const bigHp = input.hp - state.hp >= SIGNIFICANT_JUMP_FRAC * Math.max(1, input.maxHp);
  if (input.hp > state.hp && (bigHp || input.now - state.lastHealAt >= PULSE_DEBOUNCE_MS)) {
    out.heal = true;
    state.lastHealAt = input.now;
  }
  const bigMana =
    input.resource - state.resource >= SIGNIFICANT_JUMP_FRAC * Math.max(1, input.maxResource);
  if (
    input.resource > state.resource &&
    (bigMana || input.now - state.lastManaAt >= PULSE_DEBOUNCE_MS)
  ) {
    out.mana = true;
    state.lastManaAt = input.now;
  }
  if (input.lifetimeXp > state.lifetimeXp && input.now - state.lastXpAt >= PULSE_DEBOUNCE_MS) {
    out.xp = true;
    state.lastXpAt = input.now;
  }
  // Level up is a discrete, rare event: fire immediately (undebounced), and pulse
  // the xp bar too (the fresh level bar reads as an xp gain).
  if (input.level > state.level) {
    out.levelUp = true;
    out.xp = true;
    state.lastXpAt = input.now;
  }

  state.hp = input.hp;
  state.resource = input.resource;
  state.lifetimeXp = input.lifetimeXp;
  state.level = input.level;
  return out;
}
