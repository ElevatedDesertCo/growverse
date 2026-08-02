// Pure view core for the Vale Cup window (src/ui/cup_view.ts): the ranked board, whether
// this grower has posted, which strains and grades can be entered, and the PROJECTED
// score for the current pick. DOM/i18n-free, so this drives it directly.

import { describe, expect, it } from 'vitest';
import { CUP_ENTRY_BUD_COUNT, type CupStanding, type ItemDef } from '../src/sim/types';
import { buildCupView, type CupStrainInput } from '../src/ui/cup_view';

const ITEMS: Record<string, ItemDef> = {
  bud_common: {
    id: 'bud_common',
    name: 'Common Bud',
    kind: 'junk',
    quality: 'common',
    sellValue: 4,
  },
  bud_fine: { id: 'bud_fine', name: 'Fine Bud', kind: 'junk', quality: 'uncommon', sellValue: 9 },
  bud_prime: { id: 'bud_prime', name: 'Prime Bud', kind: 'junk', quality: 'rare', sellValue: 18 },
};
const strain = (id: string, mastery = 0, landrace = false): CupStrainInput => ({
  id,
  name: `Strain ${id}`,
  landrace,
  mastery,
});
const standing = (pid: number, rank: number, score: number): CupStanding => ({
  rank,
  pid,
  growerName: `G${pid}`,
  strainName: `S${pid}`,
  score,
});
// A stand-in scorer: the real one is the sim's pure cupScore (covered in cup.test.ts);
// here it only has to be a function of the two picks so the wiring is observable.
const scorer = (strainId: string, budItemId: string) => strainId.length * 10 + budItemId.length;

const build = (
  over: {
    standings?: CupStanding[];
    self?: number;
    strains?: CupStrainInput[];
    buds?: Record<string, number>;
    pickStrain?: string | null;
    pickBud?: string | null;
  } = {},
) =>
  buildCupView(
    over.standings ?? [],
    3,
    600,
    120,
    over.self ?? 1,
    over.strains ?? [strain('a'), strain('b')],
    over.buds ?? { bud_common: CUP_ENTRY_BUD_COUNT },
    ITEMS,
    over.pickStrain ?? null,
    over.pickBud ?? null,
    scorer,
  );

describe('cup view core', () => {
  it('passes the season, countdown, and personal best straight through', () => {
    const v = build();
    expect(v.season).toBe(3);
    expect(v.secondsRemaining).toBe(600);
    expect(v.best).toBe(120);
    expect(v.entryCost).toBe(CUP_ENTRY_BUD_COUNT);
  });

  it('marks the viewing grower own row and surfaces it as ownEntry', () => {
    const v = build({ standings: [standing(2, 1, 50), standing(1, 2, 40)], self: 1 });
    expect(v.board.map((r) => r.isSelf)).toEqual([false, true]);
    expect(v.ownEntry?.pid).toBe(1);
    expect(v.ownEntry?.rank).toBe(2);
  });

  it('has no ownEntry when this grower has not posted', () => {
    expect(build({ standings: [standing(2, 1, 50)], self: 1 }).ownEntry).toBeNull();
  });

  it('offers only grades the player is carrying, in CUP_GRADE_ORDER', () => {
    const v = build({ buds: { bud_prime: 3, bud_common: 40 } });
    expect(v.buds.map((b) => b.itemId)).toEqual(['bud_common', 'bud_prime']);
    expect(v.buds.find((b) => b.itemId === 'bud_common')?.enough).toBe(true);
    expect(v.buds.find((b) => b.itemId === 'bud_prime')?.enough).toBe(false);
  });

  it('projects a score per strain once a grade is picked, and zero before', () => {
    const before = build();
    expect(before.strains.every((s) => s.projectedScore === 0)).toBe(true);
    const after = build({ pickBud: 'bud_common' });
    expect(after.strains.every((s) => s.projectedScore > 0)).toBe(true);
    expect(after.strains[0].projectedScore).toBe(scorer('a', 'bud_common'));
  });

  it('reports the projected score for the CURRENT pair', () => {
    const v = build({ pickStrain: 'b', pickBud: 'bud_common' });
    expect(v.projectedScore).toBe(scorer('b', 'bud_common'));
    expect(v.canEnter).toBe(true);
  });

  it('clears a pick that no longer names something the player has', () => {
    // A released strain and a grade that ran out both self-clear, so the window never
    // offers an entry the server would reject.
    const v = build({ pickStrain: 'gone', pickBud: 'bud_fine', buds: { bud_common: 40 } });
    expect(v.selectedStrainId).toBeNull();
    expect(v.selectedBudId).toBeNull();
    expect(v.canEnter).toBe(false);
    expect(v.projectedScore).toBe(0);
  });

  it('cannot enter without enough of the picked grade', () => {
    const v = build({
      pickStrain: 'a',
      pickBud: 'bud_common',
      buds: { bud_common: CUP_ENTRY_BUD_COUNT - 1 },
    });
    expect(v.canEnter).toBe(false);
  });

  it('cannot enter twice: a posted entry disables it regardless of the picks', () => {
    const v = build({
      standings: [standing(1, 1, 50)],
      self: 1,
      pickStrain: 'a',
      pickBud: 'bud_common',
    });
    expect(v.ownEntry).not.toBeNull();
    expect(v.canEnter).toBe(false);
  });

  it('handles an empty board and an empty library without throwing', () => {
    const v = build({ standings: [], strains: [], buds: {} });
    expect(v.board).toEqual([]);
    expect(v.strains).toEqual([]);
    expect(v.buds).toEqual([]);
    expect(v.canEnter).toBe(false);
  });
});
