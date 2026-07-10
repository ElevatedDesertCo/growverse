// Bake a donor rig's animation clip set onto a target character GLB that shares the
// donor's skeleton (identical bone names). This is the general Tier C tool: ANY
// humanoid mesh rigged to the KayKit Rig_Medium skeleton inherits the full clean clip
// set, so a fully-custom body animates exactly like the default classes. It generalizes
// the original mech-specific bake (scripts/bake_mech_anims.mjs now delegates here).
//
//   node scripts/rig/bake_clips.mjs <target.glb> [donor.glb] [--force] [--min-coverage 1]
//
// It validates skeleton compatibility FIRST and refuses to bake below --min-coverage
// (default 1: every animated donor bone must exist on the target), unless --force. The
// donor defaults to knight.glb (the Rig_Medium clip reference). The target is rewritten
// in place; mesh, material, skin, and node graph are untouched (only clips change).
//
// See docs/design/custom-character-pipeline.md.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSkeletons, formatSkeletonDiff } from './skeleton_diff.mjs';
import { allNodeNames, animatedBoneNames, DEFAULT_DONOR, makeIO } from './validate_skeleton.mjs';

/**
 * Copy every animation clip from donorDoc onto targetDoc, retargeting channels by bone
 * NAME. Channels whose bone is absent on the target are skipped (and reported). Clears
 * any clips already on the target first, so re-runs are idempotent (never duplicate).
 * Mutates targetDoc; returns { copiedAnims, copiedChannels, skipped }.
 */
export function bakeClips(donorDoc, targetDoc) {
  for (const anim of targetDoc.getRoot().listAnimations()) anim.dispose();

  const targetNodesByName = new Map();
  for (const node of targetDoc.getRoot().listNodes()) targetNodesByName.set(node.getName(), node);

  const buffer = targetDoc.getRoot().listBuffers()[0] ?? targetDoc.createBuffer();
  const cloneAccessor = (src) =>
    targetDoc
      .createAccessor(src.getName())
      .setType(src.getType())
      .setArray(src.getArray().slice())
      .setNormalized(src.getNormalized())
      .setBuffer(buffer);

  let copiedAnims = 0;
  let copiedChannels = 0;
  const skipped = new Set();
  for (const srcAnim of donorDoc.getRoot().listAnimations()) {
    const anim = targetDoc.createAnimation(srcAnim.getName());
    const samplerMap = new Map();
    for (const srcSampler of srcAnim.listSamplers()) {
      const sampler = targetDoc
        .createAnimationSampler()
        .setInterpolation(srcSampler.getInterpolation())
        .setInput(cloneAccessor(srcSampler.getInput()))
        .setOutput(cloneAccessor(srcSampler.getOutput()));
      samplerMap.set(srcSampler, sampler);
      anim.addSampler(sampler);
    }
    for (const srcChannel of srcAnim.listChannels()) {
      const srcNode = srcChannel.getTargetNode();
      const name = srcNode ? srcNode.getName() : '';
      const dstNode = name ? targetNodesByName.get(name) : null;
      if (!dstNode) {
        skipped.add(name || '(none)');
        continue;
      }
      anim.addChannel(
        targetDoc
          .createAnimationChannel()
          .setTargetNode(dstNode)
          .setTargetPath(srcChannel.getTargetPath())
          .setSampler(samplerMap.get(srcChannel.getSampler())),
      );
      copiedChannels++;
    }
    copiedAnims++;
  }
  return { copiedAnims, copiedChannels, skipped: [...skipped] };
}

/**
 * Read donor + target GLBs, validate skeleton compatibility, and (if it passes or
 * --force) bake the clips and write the target in place.
 * @param {{ target: string, donor?: string, force?: boolean, minCoverage?: number }} opts
 */
export async function bakeClipsCli(opts) {
  const { target, donor = DEFAULT_DONOR, force = false, minCoverage = 1 } = opts;
  if (!target) throw new Error('bakeClipsCli: a target GLB path is required');

  const io = await makeIO();
  const [donorDoc, targetDoc] = await Promise.all([io.read(donor), io.read(target)]);

  const donorBones = animatedBoneNames(donorDoc);
  if (donorBones.size === 0) {
    console.error(
      `donor ${donor} carries no animation clips; pass a donor that has the clip set (e.g. knight.glb).`,
    );
    process.exit(2);
  }

  const diff = compareSkeletons(donorBones, allNodeNames(targetDoc), { minCoverage });
  console.log(`donor:  ${donor}`);
  console.log(`target: ${target}`);
  console.log(formatSkeletonDiff(diff, { donorName: 'donor', targetName: 'target' }));
  if (!diff.ok && !force) {
    console.error(
      `\nREFUSING to bake: target is missing ${diff.missing.length} animated bone(s) ` +
        `(coverage ${(diff.coverage * 100).toFixed(1)}% < ${(minCoverage * 100).toFixed(1)}%).`,
    );
    console.error(
      'Re-rig to the donor skeleton and re-export, or pass --force to bake the partial set anyway.',
    );
    process.exit(1);
  }

  const { copiedAnims, copiedChannels, skipped } = bakeClips(donorDoc, targetDoc);
  await io.write(target, targetDoc);
  console.log(`\nBaked ${copiedAnims} clips (${copiedChannels} channels) into ${target}`);
  if (skipped.length)
    console.log(`  skipped channels for bones absent on the target: ${skipped.join(', ')}`);
}

function parseArgs(argv) {
  const positional = [];
  let force = false;
  let minCoverage = 1;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--force') force = true;
    else if (argv[i] === '--min-coverage') minCoverage = Number(argv[++i]);
    else positional.push(argv[i]);
  }
  return { target: positional[0], donor: positional[1] ?? DEFAULT_DONOR, force, minCoverage };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.target) {
    console.error(
      'usage: node scripts/rig/bake_clips.mjs <target.glb> [donor.glb] [--force] [--min-coverage 1]',
    );
    process.exit(2);
  }
  await bakeClipsCli(args);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
