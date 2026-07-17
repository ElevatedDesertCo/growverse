// Pure, host-agnostic view model for the character window's PROFESSIONS panel.
//
// The pure-core half of the pure-core + thin-painter split (root CLAUDE.md
// Conventions; reference char_view.ts / vendor_view.ts). Scope is deliberately
// narrow: it turns the world's ProfessionView[] (Mining / Herbalism / Logging,
// each a skill out of a shared ceiling) into the ordered, ready-to-paint rows the
// char window draws: one row per profession, in the canonical PROFESSION_IDS
// order, with the skill, the ceiling, and the fill fraction precomputed.
//
// DOM-free, Three-free, i18n-free, and free of any RNG or wall-clock call, so it
// stays deterministic and tests/professions_view.test.ts can drive it directly
// with both a Sim-shaped and a ClientWorld-mirror-shaped professions array. The
// painter owns the localized labels, the bar CSS, and the number formatting.

import { PROFESSION_IDS, type ProfessionId, type ProfessionView } from '../sim/types';

/** One profession row: the skill, its ceiling, and the 0..100 fill percent. */
export interface ProfessionRow {
  id: ProfessionId;
  skill: number;
  max: number;
  /** Fill fraction as a whole percent (0..100), clamped, for the skill bar. */
  pct: number;
}

/** The professions panel model: one row per profession, canonical order. */
export interface ProfessionsView {
  rows: ProfessionRow[];
}

function clampPercent(skill: number, max: number): number {
  if (max <= 0) return 0;
  const pct = Math.round((skill / max) * 100);
  return pct < 0 ? 0 : pct > 100 ? 100 : pct;
}

/**
 * Build the professions view from the world's ProfessionView[]. Rows come out in
 * the canonical PROFESSION_IDS order regardless of the input order, so the panel
 * is stable; a profession missing from the input renders at 0 (defensive, though
 * both worlds always emit the full set).
 */
export function buildProfessionsView(professions: readonly ProfessionView[]): ProfessionsView {
  const byId = new Map<ProfessionId, ProfessionView>();
  for (const p of professions) byId.set(p.id, p);
  const rows = PROFESSION_IDS.map((id) => {
    const view = byId.get(id);
    const skill = view ? view.skill : 0;
    const max = view ? view.max : 0;
    return { id, skill, max, pct: clampPercent(skill, max) };
  });
  return { rows };
}
