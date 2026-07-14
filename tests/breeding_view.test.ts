// Pure-core test for the Breeding window view model. buildBreedingView takes plain data
// (the StrainView[]/ReputationView[]/PlotView[] IWorld reads, identical in both worlds),
// so this drives it directly.

import { describe, expect, it } from 'vitest';
import type { PlotView, ReputationView, StrainView } from '../src/sim/types';
import { MAX_STRAINS } from '../src/sim/types';
import { buildBreedingView } from '../src/ui/breeding_view';

const strain = (id: string, p: number, v: number, y: number, landrace = false): StrainView => ({
  id,
  baseId: 'common_bloom',
  name: `Strain ${id}`,
  landrace,
  potency: p,
  vigor: v,
  yield: y,
});

const rep: ReputationView[] = [
  {
    factionId: 'baked_beaver',
    name: 'The Baked Beaver Commune',
    points: 700,
    tier: 'friendly',
    tierIndex: 1,
    progress: 0.25,
    nextThreshold: 1500,
  },
];

const emptyPlot = (): PlotView => ({
  seedItemId: null,
  stage: 'empty',
  progress: 0,
  secondsRemaining: 0,
});
const growingPlot = (): PlotView => ({
  seedItemId: 'common_seed',
  stage: 'growing',
  progress: 0.5,
  secondsRemaining: 90,
});

describe('buildBreedingView', () => {
  it('maps strains to rows with expressed traits and no picks by default', () => {
    const view = buildBreedingView([strain('a', 1, 2, 3)], rep, [emptyPlot()], null, null);
    expect(view.strains).toHaveLength(1);
    expect(view.strains[0]).toMatchObject({
      id: 'a',
      potency: 1,
      vigor: 2,
      yield: 3,
      selectedAs: null,
    });
    expect(view.reputation).toEqual(rep);
    expect(view.canBreed).toBe(false);
    expect(view.count).toBe(1);
  });

  it('flags the two picked parents and enables breeding for two distinct strains', () => {
    const view = buildBreedingView(
      [strain('a', 1, 1, 1), strain('b', 2, 2, 2)],
      rep,
      [emptyPlot()],
      'a',
      'b',
    );
    expect(view.strains[0].selectedAs).toBe('a');
    expect(view.strains[1].selectedAs).toBe('b');
    expect(view.canBreed).toBe(true);
  });

  it('never breeds a strain with itself, and drops a pick that is not owned', () => {
    const strains = [strain('a', 1, 1, 1)];
    // same strain in both slots -> not breedable
    expect(buildBreedingView(strains, rep, [emptyPlot()], 'a', 'a').canBreed).toBe(false);
    // an unowned pick is cleared
    const view = buildBreedingView(strains, rep, [emptyPlot()], 'a', 'gone');
    expect(view.selectedB).toBeNull();
    expect(view.canBreed).toBe(false);
  });

  it('locates the first empty plot for planting (null when the garden is full)', () => {
    const twoParents = [strain('a', 1, 1, 1), strain('b', 2, 2, 2)];
    expect(
      buildBreedingView(twoParents, rep, [growingPlot(), emptyPlot()], null, null).firstEmptyPlot,
    ).toBe(1);
    expect(
      buildBreedingView(twoParents, rep, [growingPlot(), growingPlot()], null, null).firstEmptyPlot,
    ).toBeNull();
  });

  it('blocks breeding at library capacity even with two valid distinct parents', () => {
    const full: StrainView[] = Array.from({ length: MAX_STRAINS }, (_, i) =>
      strain(`s${i}`, 1, 1, 1),
    );
    const view = buildBreedingView(full, rep, [emptyPlot()], 's0', 's1');
    expect(view.atCapacity).toBe(true);
    expect(view.canBreed).toBe(false);
  });

  it('is a pure function of its inputs (same input -> same output)', () => {
    const strains = [strain('a', 3, 3, 3, true), strain('b', 0, 1, 2)];
    const garden = [emptyPlot(), growingPlot()];
    const a = buildBreedingView(strains, rep, garden, 'a', 'b');
    const b = buildBreedingView(strains, rep, garden, 'a', 'b');
    expect(a).toEqual(b);
  });
});
