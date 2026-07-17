// Pure, host-agnostic view model for the character window's OVERVIEW tab: the
// grower's dashboard that aggregates commune standing, active Bloom Sessions, and
// the strain library into one read-only summary always reachable from the sheet
// (the Breeding window at the Grow Station stays the place to DO breeding work).
//
// The pure-core half of the pure-core + thin-painter split (reference
// professions_view.ts / breeding_view.ts). It turns three IWorld reads into
// ready-to-paint rows:
//   - reputation: the ReputationView[] standings, each with its fill percent;
//   - sessions:   the player's ACTIVE Bloom Session buffs, derived from the aura
//                 strip (every `elixir_*` aura, minus the couch-lock tradeoff twin),
//                 each with a remaining-fraction percent for its timer bar;
//   - strains:    the expressed-phenotype library rows.
//
// DOM-free, Three-free, i18n-free, and free of any RNG or wall-clock call, so it
// stays deterministic and tests/overview_view.test.ts can drive it directly with
// both a Sim-shaped and a ClientWorld-mirror-shaped read. The painter owns the
// localized labels, the bar CSS, and all number/duration formatting.

import type { ReputationView, StrainView } from '../sim/types';

// A Bloom Session aura is applied with the id `elixir_<itemId>` (see
// src/sim/sessions.ts); the restful profile adds a second `elixir_<itemId>_couchlock`
// slow as its tradeoff. The dashboard shows the buff, not the tradeoff twin.
const SESSION_AURA_PREFIX = 'elixir_';
const COUCHLOCK_AURA_SUFFIX = '_couchlock';

/** The minimal aura shape the overview reads (a structural subset of Entity.auras). */
export interface OverviewAuraInput {
  id: string;
  name: string;
  remaining: number;
  duration: number;
}

/** One commune-standing row: the faction, its tier, and the fill toward the next. */
export interface OverviewRepRow {
  factionId: string;
  name: string;
  tier: string;
  /** Fill toward the next tier as a whole percent (0..100), clamped. */
  pct: number;
  points: number;
  /** Absolute points to reach the next tier, or null at the exalted cap. */
  nextThreshold: number | null;
  /** At the exalted cap (the bar reads full, no "to next"). */
  atMax: boolean;
}

/** One active Bloom Session: the buff name and how much of its duration is left. */
export interface OverviewSessionRow {
  id: string;
  name: string;
  /** Whole seconds remaining, rounded up (0 shows as spent, but such an aura is gone). */
  remaining: number;
  /** Remaining fraction of the full duration as a whole percent (0..100), clamped. */
  pct: number;
}

/** One strain-library row: the expressed phenotype (raw genotype stays server-side). */
export interface OverviewStrainRow {
  id: string;
  name: string;
  landrace: boolean;
  potency: number;
  vigor: number;
  yield: number;
}

export interface OverviewView {
  reputation: OverviewRepRow[];
  sessions: OverviewSessionRow[];
  strains: OverviewStrainRow[];
}

function clampPercent(n: number): number {
  const p = Math.round(n);
  return p < 0 ? 0 : p > 100 ? 100 : p;
}

/**
 * Build the overview view from the three IWorld reads.
 *
 * `reputation` and `strains` are pass-through reads (identical in both worlds);
 * `auras` is the player's live aura strip, filtered here to the active Bloom Session
 * buffs (every `elixir_*` aura except the couch-lock tradeoff twin) so the dashboard
 * shows one row per running Session with a timer-bar fill. All ordering follows the
 * input order, which both worlds keep stable.
 */
export function buildOverviewView(
  reputation: readonly ReputationView[],
  strains: readonly StrainView[],
  auras: readonly OverviewAuraInput[],
): OverviewView {
  const repRows: OverviewRepRow[] = reputation.map((r) => ({
    factionId: r.factionId,
    name: r.name,
    tier: r.tier,
    pct: clampPercent(r.progress * 100),
    points: r.points,
    nextThreshold: r.nextThreshold,
    atMax: r.nextThreshold === null,
  }));

  const sessions: OverviewSessionRow[] = [];
  for (const a of auras) {
    if (!a.id.startsWith(SESSION_AURA_PREFIX)) continue;
    if (a.id.endsWith(COUCHLOCK_AURA_SUFFIX)) continue;
    const pct = a.duration > 0 ? clampPercent((a.remaining / a.duration) * 100) : 0;
    sessions.push({ id: a.id, name: a.name, remaining: Math.max(0, Math.ceil(a.remaining)), pct });
  }

  const strainRows: OverviewStrainRow[] = strains.map((s) => ({
    id: s.id,
    name: s.name,
    landrace: s.landrace,
    potency: s.potency,
    vigor: s.vigor,
    yield: s.yield,
  }));

  return { reputation: repRows, sessions, strains: strainRows };
}
