// Hand-written declarations so the Vitest suite (typechecked by tsc: `tests` is in the
// tsconfig include) can import this plain-ESM script core. Keep in sync with
// skeleton_diff.mjs.

export interface SkeletonDiff {
  matched: string[];
  missing: string[];
  extra: string[];
  coverage: number;
  ok: boolean;
}

export function compareSkeletons(
  donorAnimatedBones: Iterable<string>,
  targetBones: Iterable<string>,
  opts?: { minCoverage?: number },
): SkeletonDiff;

export function formatSkeletonDiff(
  diff: SkeletonDiff,
  names?: { donorName?: string; targetName?: string },
): string;
