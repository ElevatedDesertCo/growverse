// Pure view core for the character sheet's professions panel
// (src/ui/professions_view.ts): turns the world's ProfessionView[] into ordered,
// ready-to-paint rows with a clamped fill percent. DOM/i18n-free, so this drives
// it directly with both a Sim-shaped and a ClientWorld-mirror-shaped array.

import { describe, expect, it } from 'vitest';
import { PROFESSION_IDS, type ProfessionView } from '../src/sim/types';
import { buildProfessionsView } from '../src/ui/professions_view';

const view = (mining: number, herbalism: number, logging: number, max = 100): ProfessionView[] => [
  { id: 'mining', skill: mining, max },
  { id: 'herbalism', skill: herbalism, max },
  { id: 'logging', skill: logging, max },
];

describe('professions view core', () => {
  it('emits one row per profession in canonical PROFESSION_IDS order', () => {
    // Feed them SHUFFLED to prove the core re-orders to the canonical sequence.
    const shuffled: ProfessionView[] = [
      { id: 'logging', skill: 3, max: 100 },
      { id: 'mining', skill: 1, max: 100 },
      { id: 'herbalism', skill: 2, max: 100 },
    ];
    const rows = buildProfessionsView(shuffled).rows;
    expect(rows.map((r) => r.id)).toEqual([...PROFESSION_IDS]);
    expect(rows.map((r) => r.skill)).toEqual([1, 2, 3]); // mining, herbalism, logging
  });

  it('computes the fill percent as a clamped whole number', () => {
    const rows = buildProfessionsView(view(0, 50, 100)).rows;
    expect(rows.find((r) => r.id === 'mining')?.pct).toBe(0);
    expect(rows.find((r) => r.id === 'herbalism')?.pct).toBe(50);
    expect(rows.find((r) => r.id === 'logging')?.pct).toBe(100);
  });

  it('rounds a partial skill to the nearest percent', () => {
    // 33 / 100 rounds to 33; 1 / 3 rounds to 33 as well.
    expect(buildProfessionsView(view(33, 0, 0)).rows[0].pct).toBe(33);
    expect(buildProfessionsView(view(1, 0, 0, 3)).rows[0].pct).toBe(33);
  });

  it('never exceeds 100 or drops below 0 even with out-of-range input', () => {
    const rows = buildProfessionsView(view(150, -10, 100)).rows;
    expect(rows.find((r) => r.id === 'mining')?.pct).toBe(100);
    expect(rows.find((r) => r.id === 'herbalism')?.pct).toBe(0);
  });

  it('a zero ceiling yields 0 percent (no divide-by-zero)', () => {
    const rows = buildProfessionsView(view(5, 0, 0, 0)).rows;
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
