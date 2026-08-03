// Pure, host-agnostic view model for the Vale Cup window.
//
// The pure-core half of the pure-core + thin-consumer split (reference garden_view.ts /
// breeding_view.ts). It owns what the Cup window decides and what is worth testing
// without a DOM: the ranked board, whether this grower has already posted, which of their
// strains and bud grades can be entered, and the PROJECTED score for the current pick.
//
// The projected score is the load-bearing piece. The Cup reads four axes at once
// (genetics, grade, mastery, landrace), so a player choosing blind cannot tell whether
// their mastered common-bud strain beats their fresh prime-bud one. Showing the number
// before they spend ten buds turns the entry screen into the actual decision.
//
// DOM-free and i18n-free so tests/cup_view.test.ts can drive it directly, same-input
// same-output against a Sim- and a ClientWorld-shaped read. The server always re-validates
// the entry, so this is purely presentational.

import { CUP_ENTRY_BUD_COUNT, CUP_GRADE_ORDER, type CupStanding, type ItemDef } from '../sim/types';

export interface CupStrainOption {
  id: string;
  name: string;
  landrace: boolean;
  mastery: number;
  /** What this strain would score with the currently selected bud grade. */
  projectedScore: number;
}

export interface CupBudOption {
  itemId: string;
  item: ItemDef;
  /** How many the player is carrying. */
  count: number;
  /** They hold at least CUP_ENTRY_BUD_COUNT of this grade. */
  enough: boolean;
}

export interface CupBoardRow extends CupStanding {
  /** This row is the viewing player's own entry, so the window can mark it. */
  isSelf: boolean;
}

export interface CupView {
  season: number;
  secondsRemaining: number;
  board: CupBoardRow[];
  /** This grower's entry for the running season, or null if they have not posted. */
  ownEntry: CupBoardRow | null;
  best: number;
  strains: CupStrainOption[];
  buds: CupBudOption[];
  selectedStrainId: string | null;
  selectedBudId: string | null;
  /** Buds one entry costs, so the window states the price rather than hardcoding it. */
  entryCost: number;
  /** A strain and an affordable grade are picked and this grower has not posted yet. */
  canEnter: boolean;
  /** The score the current pick would post. 0 when the pick is incomplete. */
  projectedScore: number;
}

/** The strain shape the view needs: the IWorld StrainView, narrowed to what it reads. */
export interface CupStrainInput {
  id: string;
  name: string;
  landrace: boolean;
  mastery: number;
}

/**
 * Build the structured Cup view.
 *
 * `score` is injected rather than imported so this core stays free of the sim's scoring
 * module: the caller passes the same pure `cupScore` the server will run, which keeps the
 * projection honest (it cannot drift from the authoritative formula) without this file
 * depending on sim logic.
 */
export function buildCupView(
  standings: readonly CupStanding[],
  season: number,
  secondsRemaining: number,
  best: number,
  selfPid: number,
  strains: readonly CupStrainInput[],
  budCounts: Readonly<Record<string, number>>,
  items: Record<string, ItemDef>,
  selectedStrainId: string | null,
  selectedBudId: string | null,
  score: (strainId: string, budItemId: string) => number,
): CupView {
  const board: CupBoardRow[] = standings.map((s) => ({ ...s, isSelf: s.pid === selfPid }));
  const ownEntry = board.find((r) => r.isSelf) ?? null;

  // Only the grades the Cup accepts, in its own weakest-first order, and only ones the
  // player is actually carrying: an empty grade in the picker is a dead button.
  const buds: CupBudOption[] = CUP_GRADE_ORDER.filter((id) => (budCounts[id] ?? 0) > 0)
    .map((id) => ({
      itemId: id,
      item: items[id],
      count: budCounts[id] ?? 0,
      enough: (budCounts[id] ?? 0) >= CUP_ENTRY_BUD_COUNT,
    }))
    .filter((b): b is CupBudOption => b.item !== undefined);

  // Keep the picks valid: a released strain or a grade that ran out clears itself, so the
  // window never offers an entry the server would reject.
  const bud = buds.some((b) => b.itemId === selectedBudId) ? selectedBudId : null;
  const strainId = strains.some((s) => s.id === selectedStrainId) ? selectedStrainId : null;

  const strainRows: CupStrainOption[] = strains.map((s) => ({
    id: s.id,
    name: s.name,
    landrace: s.landrace,
    mastery: s.mastery,
    projectedScore: bud ? score(s.id, bud) : 0,
  }));

  const projectedScore = strainId && bud ? score(strainId, bud) : 0;
  const affordable = bud !== null && (budCounts[bud] ?? 0) >= CUP_ENTRY_BUD_COUNT;
  return {
    season,
    secondsRemaining,
    board,
    ownEntry,
    best,
    strains: strainRows,
    buds,
    selectedStrainId: strainId,
    selectedBudId: bud,
    entryCost: CUP_ENTRY_BUD_COUNT,
    canEnter: ownEntry === null && strainId !== null && affordable,
    projectedScore,
  };
}
