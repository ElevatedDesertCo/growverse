// Pure skeleton-compatibility comparison for the Tier C custom-character pipeline.
//
// A fully-custom body inherits the default clean animations by sharing the KayKit
// Rig_Medium skeleton: identical bone NAMES so the donor's clips retarget onto it.
// This module answers "does this candidate carry every bone the donor animates?"
// with no file IO, so it is unit-testable in plain Node (tests/rig_skeleton_diff.test.ts).
// Callers (scripts/rig/validate_skeleton.mjs, scripts/rig/bake_clips.mjs) extract the
// bone-name lists from GLBs and hand them here.
//
// See scripts/rig/CLAUDE.md and docs/design/custom-character-pipeline.md.

/**
 * @typedef {Object} SkeletonDiff
 * @property {string[]} matched  donor animated bones also present on the target (sorted)
 * @property {string[]} missing  donor animated bones ABSENT on the target: they will NOT animate (sorted)
 * @property {string[]} extra    target bones the donor never animates: informational, e.g. new accessory/mesh nodes (sorted)
 * @property {number}   coverage matched / donorAnimatedCount, in [0,1] (1 when the donor animates nothing)
 * @property {boolean}  ok       coverage >= minCoverage (default 1: every animated donor bone is present)
 */

/**
 * Compare a donor rig's ANIMATED bones against a candidate target's bones.
 *
 * The set that matters for animation fidelity is the bones the donor's clips actually
 * drive, not every node, so pass `donorAnimatedBones` (the node names targeted by donor
 * animation channels), not the whole node list. Any target bone missing from that set
 * would sit frozen once the clips are baked on.
 *
 * @param {Iterable<string>} donorAnimatedBones
 * @param {Iterable<string>} targetBones
 * @param {{ minCoverage?: number }} [opts]
 * @returns {SkeletonDiff}
 */
export function compareSkeletons(donorAnimatedBones, targetBones, opts = {}) {
  const minCoverage = opts.minCoverage ?? 1;
  const donorSet = [...new Set(donorAnimatedBones)];
  const donorLookup = new Set(donorSet);
  const targetSet = new Set(targetBones);
  const matched = donorSet.filter((b) => targetSet.has(b));
  const missing = donorSet.filter((b) => !targetSet.has(b));
  const extra = [...targetSet].filter((b) => !donorLookup.has(b));
  const coverage = donorSet.length === 0 ? 1 : matched.length / donorSet.length;
  return {
    matched: matched.sort(),
    missing: missing.sort(),
    extra: extra.sort(),
    coverage,
    ok: coverage >= minCoverage,
  };
}

/**
 * Format a SkeletonDiff as a human-readable multi-line report.
 * @param {SkeletonDiff} diff
 * @param {{ donorName?: string, targetName?: string }} [names]
 * @returns {string}
 */
export function formatSkeletonDiff(diff, names = {}) {
  const donorName = names.donorName ?? 'donor';
  const targetName = names.targetName ?? 'target';
  const total = diff.matched.length + diff.missing.length;
  const pct = (diff.coverage * 100).toFixed(1);
  const lines = [
    `skeleton coverage: ${diff.matched.length}/${total} animated bones matched (${pct}%)`,
  ];
  if (diff.missing.length) {
    lines.push(`  MISSING on ${targetName} (these bones will NOT animate):`);
    for (const b of diff.missing) lines.push(`    - ${b}`);
  }
  if (diff.extra.length) {
    lines.push(
      `  extra on ${targetName} (not animated by ${donorName}; e.g. new accessory/mesh nodes):`,
    );
    for (const b of diff.extra) lines.push(`    + ${b}`);
  }
  return lines.join('\n');
}
