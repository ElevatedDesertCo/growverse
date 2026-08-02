// Pure view core for the character sheet's Overview tab (src/ui/overview_view.ts):
// aggregates the commune-standing, active-Bloom-Session, and strain-library reads
// into ready-to-paint rows. DOM/i18n-free, so this drives it directly with both a
// Sim-shaped and a ClientWorld-mirror-shaped read.

import { describe, expect, it } from 'vitest';
import type { ReputationView, StrainView } from '../src/sim/types';
import { buildOverviewView, type OverviewAuraInput } from '../src/ui/overview_view';

const rep = (
  points: number,
  tier: ReputationView['tier'],
  nextThreshold: number | null,
  progress: number,
): ReputationView => ({
  factionId: 'baked_beaver',
  name: 'Baked Beaver',
  points,
  tier,
  tierIndex: 0,
  progress,
  nextThreshold,
});

const strain = (id: string, over: Partial<StrainView> = {}): StrainView => ({
  id,
  baseId: 'common_bloom',
  mastery: 0,
  name: id,
  landrace: false,
  potency: 10,
  vigor: 12,
  yield: 14,
  ...over,
});

const aura = (id: string, remaining: number, duration: number, name = id): OverviewAuraInput => ({
  id,
  name,
  remaining,
  duration,
});

describe('overview view core', () => {
  it('maps a reputation read to a clamped fill percent and a to-next threshold', () => {
    const view = buildOverviewView([rep(750, 'friendly', 1500, 0.5)], [], []);
    expect(view.reputation).toHaveLength(1);
    const r = view.reputation[0];
    expect(r.pct).toBe(50);
    expect(r.nextThreshold).toBe(1500);
    expect(r.atMax).toBe(false);
    expect(r.tier).toBe('friendly');
  });

  it('marks the exalted cap as atMax (null threshold, full bar)', () => {
    const view = buildOverviewView([rep(6000, 'exalted', null, 1)], [], []);
    expect(view.reputation[0].atMax).toBe(true);
    expect(view.reputation[0].pct).toBe(100);
  });

  it('clamps an out-of-range progress into 0..100', () => {
    expect(buildOverviewView([rep(0, 'neutral', 500, -0.2)], [], []).reputation[0].pct).toBe(0);
    expect(buildOverviewView([rep(0, 'neutral', 500, 1.4)], [], []).reputation[0].pct).toBe(100);
  });

  it('keeps only active Bloom Session buffs, dropping non-session auras', () => {
    const view = buildOverviewView(
      [],
      [],
      [
        aura('elixir_lively_bloom_tonic', 150, 300, 'Lively Bloom'),
        aura('warrior_battle_shout', 60, 120, 'Battle Shout'),
        aura('elixir_balanced_bloom_tonic', 300, 600, 'Balanced Bloom'),
      ],
    );
    expect(view.sessions.map((s) => s.name)).toEqual(['Lively Bloom', 'Balanced Bloom']);
    expect(view.sessions[0].pct).toBe(50);
    expect(view.sessions[1].pct).toBe(50);
  });

  it('drops the couch-lock tradeoff twin so a restful session shows one row', () => {
    const view = buildOverviewView(
      [],
      [],
      [
        aura('elixir_restful_bloom_tonic', 480, 600, 'Restful Bloom'),
        aura('elixir_restful_bloom_tonic_couchlock', 480, 600, 'Couch-Lock'),
      ],
    );
    expect(view.sessions).toHaveLength(1);
    expect(view.sessions[0].name).toBe('Restful Bloom');
    expect(view.sessions[0].remaining).toBe(480);
  });

  it('rounds remaining seconds up and clamps the timer fill', () => {
    const view = buildOverviewView([], [], [aura('elixir_x', 12.1, 60)]);
    expect(view.sessions[0].remaining).toBe(13);
    expect(view.sessions[0].pct).toBe(20);
  });

  it('a zero-duration session yields 0 percent (no divide-by-zero)', () => {
    const view = buildOverviewView([], [], [aura('elixir_x', 5, 0)]);
    expect(view.sessions[0].pct).toBe(0);
  });

  it('passes strain rows through with the expressed phenotype', () => {
    const view = buildOverviewView(
      [],
      [strain('s1', { landrace: true, potency: 20, vigor: 5, yield: 8 }), strain('s2')],
      [],
    );
    expect(view.strains.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(view.strains[0]).toMatchObject({ landrace: true, potency: 20, vigor: 5, yield: 8 });
    expect(view.strains[1].landrace).toBe(false);
  });

  it('handles the fully empty grower (no rep, no sessions, no strains)', () => {
    const view = buildOverviewView([], [], []);
    expect(view.reputation).toEqual([]);
    expect(view.sessions).toEqual([]);
    expect(view.strains).toEqual([]);
  });
});
