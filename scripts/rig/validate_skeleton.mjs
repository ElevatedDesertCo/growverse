// Validate that a candidate character GLB can inherit a donor's animation clips, by
// checking bone-name compatibility. This is the Tier C "fail loudly" gate: it exits 1
// when the candidate is missing bones the donor animates, so a custom body never
// silently ships a frozen or smeared walk.
//
//   node scripts/rig/validate_skeleton.mjs <candidate.glb> [donor.glb] [--min-coverage 1]
//
// The donor defaults to the KayKit Rig_Medium reference (knight.glb), which carries the
// canonical clip set every player body shares. Exit codes: 0 ok, 1 incompatible,
// 2 usage/precondition error.
//
// The helpers (makeIO / animatedBoneNames / allNodeNames) are exported so bake_clips.mjs
// reuses them; importing this module has no side effects (main runs only as a CLI).
//
// See docs/design/custom-character-pipeline.md.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { compareSkeletons, formatSkeletonDiff } from './skeleton_diff.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
export const DEFAULT_DONOR = resolve(ROOT, 'public/models/chars/players/knight.glb');

/** A gltf-transform NodeIO with the meshopt codec registered (donor GLBs are meshopt-compressed). */
export async function makeIO() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}

/** The node names targeted by any animation channel in the doc (the bones that actually move). */
export function animatedBoneNames(doc) {
  const names = new Set();
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode();
      if (node) names.add(node.getName());
    }
  }
  return names;
}

/** Every node name in the doc (a superset of the skinned bones plus mesh/accessory nodes). */
export function allNodeNames(doc) {
  return doc
    .getRoot()
    .listNodes()
    .map((n) => n.getName());
}

function parseArgs(argv) {
  const positional = [];
  let minCoverage = 1;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--min-coverage') minCoverage = Number(argv[++i]);
    else positional.push(argv[i]);
  }
  return { candidate: positional[0], donor: positional[1] ?? DEFAULT_DONOR, minCoverage };
}

async function main() {
  const { candidate, donor, minCoverage } = parseArgs(process.argv.slice(2));
  if (!candidate) {
    console.error(
      'usage: node scripts/rig/validate_skeleton.mjs <candidate.glb> [donor.glb] [--min-coverage 1]',
    );
    process.exit(2);
  }
  const io = await makeIO();
  const [donorDoc, candDoc] = await Promise.all([io.read(donor), io.read(candidate)]);

  const donorBones = animatedBoneNames(donorDoc);
  if (donorBones.size === 0) {
    console.error(
      `donor ${donor} carries no animation clips; pass a donor that has the clip set (e.g. knight.glb).`,
    );
    process.exit(2);
  }

  const diff = compareSkeletons(donorBones, allNodeNames(candDoc), { minCoverage });
  console.log(`donor:     ${donor}`);
  console.log(`candidate: ${candidate}`);
  console.log(formatSkeletonDiff(diff, { donorName: 'donor', targetName: 'candidate' }));
  if (!diff.ok) {
    console.error(
      `\nFAIL: candidate is missing ${diff.missing.length} animated bone(s); baked clips would leave them frozen.`,
    );
    console.error(
      'Re-rig the mesh to the donor skeleton (identical bone names) and re-export, then re-run.',
    );
    process.exit(1);
  }
  console.log(
    '\nOK: candidate carries every animated bone; the donor clips will retarget cleanly.',
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
