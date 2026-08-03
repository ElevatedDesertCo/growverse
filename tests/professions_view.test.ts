// Pure view core for the character sheet's professions panel
// (src/ui/professions_view.ts): turns the world's ProfessionView[] into ordered,
// ready-to-paint rows with a clamped fill percent. DOM/i18n-free, so this drives
// it directly with both a Sim-shaped and a ClientWorld-mirror-shaped array.
//
// Written against PROFESSION_IDS rather than a hardcoded roster: adding a skill
// should not need this file edited, only the panel to grow a row.

import { describe, expect, it } from 'vitest';
import { PROFESSION_IDS, type ProfessionId, type ProfessionView } from '../src/sim/types';
import { buildProfessionsView } from '../src/ui/professions_view';

// A full-roster input: every profession at 0 except the ones named in `skills`.
const view = (skills: Partial<Record<ProfessionId, number>>, max = 100): ProfessionView[] =>
  PROFESSION_IDS.map((id) => ({ id, skill: skills[id] ?? 0, max }));

describe('professions view core', () => {
  it('emits one row per profession in canonical PROFESSION_IDS order', () => {
    // Each profession gets a distinct skill, fed REVERSED, so the assertion proves the
    // core re-orders to the canonical sequence rather than echoing the input order.
    const input: ProfessionView[] = PROFESSION_IDS.map((id, i) => ({
      id,
      skill: i + 1,
      max: 100,
    })).reverse();
    const rows = buildProfessionsView(input).rows;
    expect(rows.map((r) => r.id)).toEqual([...PROFESSION_IDS]);
    expect(rows.map((r) => r.skill)).toEqual(PROFESSION_IDS.map((_, i) => i + 1));
  });

  it('computes the fill percent as a clamped whole number', () => {
    const rows = buildProfessionsView(view({ mining: 0, herbalism: 50, logging: 100 })).rows;
    expect(rows.find((r) => r.id === 'mining')?.pct).toBe(0);
    expect(rows.find((r) => r.id === 'herbalism')?.pct).toBe(50);
    expect(rows.find((r) => r.id === 'logging')?.pct).toBe(100);
  });

  it('rounds a partial skill to the nearest percent', () => {
    // 33 / 100 rounds to 33; 1 / 3 rounds to 33 as well.
    expect(buildProfessionsView(view({ mining: 33 })).rows[0].pct).toBe(33);
    expect(buildProfessionsView(view({ mining: 1 }, 3)).rows[0].pct).toBe(33);
  });

  it('never exceeds 100 or drops below 0 even with out-of-range input', () => {
    const rows = buildProfessionsView(view({ mining: 150, herbalism: -10 })).rows;
    expect(rows.find((r) => r.id === 'mining')?.pct).toBe(100);
    expect(rows.find((r) => r.id === 'herbalism')?.pct).toBe(0);
  });

  it('a zero ceiling yields 0 percent (no divide-by-zero)', () => {
    const rows = buildProfessionsView(view({ mining: 5 }, 0)).rows;
    for (const r of rows) expect(r.pct).toBe(0);
  });

  it('renders a profession missing from the input at 0 skill', () => {
    const partial: ProfessionView[] = [{ id: 'mining', skill: 7, max: 100 }];
    const rows = buildProfessionsView(partial).rows;
    expect(rows.map((r) => r.id)).toEqual([...PROFESSION_IDS]);
    expect(rows.find((r) => r.id === 'herbalism')).toEqual({
      id: 'herbalism',
      skill: 0,
      max: 0,
      pct: 0,
    });
    expect(rows.find((r) => r.id === 'mining')?.skill).toBe(7);
  });
});
