import { describe, expect, it } from 'vitest';
// The Tier C custom-character pipeline core (scripts/rig/): pure bone-set comparison,
// no GLB IO, so it is unit-testable here. The scripts that read real GLBs
// (validate_skeleton.mjs / bake_clips.mjs) are thin consumers of this.
import { compareSkeletons, formatSkeletonDiff } from '../scripts/rig/skeleton_diff.mjs';

describe('compareSkeletons (Tier C rig compatibility)', () => {
  it('reports full coverage when the target carries every animated donor bone', () => {
    const donor = ['hips', 'spine', 'head', 'upperarm.l'];
    const target = ['hips', 'spine', 'head', 'upperarm.l', 'extra_horn']; // extra bone is fine
    const d = compareSkeletons(donor, target);
    expect(d.ok).toBe(true);
    expect(d.coverage).toBe(1);
    expect(d.missing).toEqual([]);
    expect(d.matched).toEqual(['head', 'hips', 'spine', 'upperarm.l']);
    expect(d.extra).toEqual(['extra_horn']);
  });

  it('flags missing animated bones and fails ok at the default (require all)', () => {
    const donor = ['hips', 'spine', 'head', 'upperarm.l'];
    const target = ['hips', 'spine']; // missing head + upperarm.l
    const d = compareSkeletons(donor, target);
    expect(d.ok).toBe(false);
    expect(d.missing).toEqual(['head', 'upperarm.l']);
    expect(d.coverage).toBeCloseTo(0.5);
  });

  it('honors a relaxed minCoverage threshold', () => {
    const donor = ['a', 'b', 'c', 'd'];
    const target = ['a', 'b', 'c']; // 0.75 coverage
    expect(compareSkeletons(donor, target, { minCoverage: 0.7 }).ok).toBe(true);
    expect(compareSkeletons(donor, target, { minCoverage: 0.8 }).ok).toBe(false);
  });

  it('dedupes donor bones and treats an empty donor as trivially covered', () => {
    expect(compareSkeletons([], ['x']).ok).toBe(true);
    expect(compareSkeletons(['a', 'a', 'b'], ['a', 'b']).coverage).toBe(1);
  });

  it('formats a report that names the missing bones', () => {
    const d = compareSkeletons(['hips', 'head'], ['hips']);
    const report = formatSkeletonDiff(d, { targetName: 'candidate' });
    expect(report).toContain('head');
    expect(report).toMatch(/MISSING on candidate/);
  });
});
