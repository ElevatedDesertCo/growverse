// Turn Meshy AI GLB exports into game-ready creature assets.
//
// Meshy exports are RENDER quality, not game quality: a single enemy is
// ~400k-800k triangles, 20-40 MB, with a 2k-4k baked texture, and (for the
// "biped" rigged sets) every animation clip lives in its OWN 30+ MB file that
// re-embeds the full mesh. The repo's creatures are 2k-7k tris / 0.1-0.5 MB
// with all clips in ONE file. This script closes that gap, fully in Node (no
// Blender, no browser): it can
//   1. consolidate a folder of same-skeleton per-clip GLBs into one multi-clip
//      GLB (clips grafted by bone NAME, so a shared Meshy/Mixamo rig just works),
//   2. decimate the mesh with meshopt simplification to a target ratio,
//   3. resize + recompress the texture to webp,
//   4. meshopt-compress the geometry,
// matching what the game loader expects (meshopt + EXT_texture_webp), the same
// tail combine_fbx_to_glb.mjs uses.
//
// USAGE
//   Folder mode (rigged multi-clip set, e.g. a Meshy "biped" download):
//     node scripts/decimate_meshy_glb.mjs <inputDir> <out.glb> [options]
//       - every *.glb in the folder is one clip on a shared skeleton; the first
//         (alphabetically, or --base) is the mesh base, the rest graft their clip
//       - clip names come from the filename (Meshy boilerplate stripped), remapped
//         via the built-in CLIP_ALIASES (Walking->Walk, Running->Run, ...)
//   Single mode (one static or single-clip GLB, e.g. a "*_texture.glb"):
//     node scripts/decimate_meshy_glb.mjs <in.glb> <out.glb> [options]
//
// OPTIONS
//   --ratio <n>        meshopt simplify target ratio (default 0.02; lower = fewer tris)
//   --error <n>        simplify error budget, relative to mesh size (default 0.02)
//   --weld <n>         weld tolerance before simplify (default 0.0001)
//   --webp-size <px>   resize the texture to px square, webp (default 1024; 0 = keep)
//   --height <n>       normalize model height to n world units (default: keep native)
//   --strip-root       lock root horizontal motion (in-place loop; server-driven mobs)
//   --base <file>      force this GLB as the mesh base (folder mode)
//   --clip f=Name      override the clip name for file f (repeatable, folder mode)
//   --no-meshopt       skip meshopt geometry compression (debug)
//   -h, --help         show this help
//
// Growverse creature convention: --strip-root --webp-size 1024, plus meshopt.

import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample, simplify, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

// Meshy clip filenames -> repo clip names (see src/render/characters/manifest.ts
// ClipMaps: ENEMY7 wants Idle/Walk/Run/Attack/HitRecieve/Death). Anything not
// listed keeps its stripped filename token, PascalCased.
const CLIP_ALIASES = {
  Walking: 'Walk',
  Running: 'Run',
  Angry_Ground_Stomp: 'Attack',
  Angry_Ground_Stomp_1: 'Attack2',
  Angry_Ground_Stomp_2: 'Attack3',
  Regular_Jump: 'Jump',
  Back_Jump: 'JumpBack',
  Run_and_Jump: 'RunJump',
  Jump_Over_Obstacle_2: 'JumpObstacle',
  Idle: 'Idle',
  Death: 'Death',
  Dying: 'Death',
  Hit: 'HitRecieve',
  HitReact: 'HitRecieve',
};

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
  console.log(
    readFileSync(new URL(import.meta.url))
      .toString()
      .split('\n')
      .filter((l) => l.startsWith('//'))
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'),
  );
  process.exit(argv.length === 0 ? 1 : 0);
}
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(name);
const VALUE_FLAGS = new Set([
  '--ratio',
  '--error',
  '--weld',
  '--webp-size',
  '--height',
  '--base',
  '--clip',
]);
const clipOverrides = new Map();
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--clip' && argv[i + 1]) {
    const [f, name] = argv[i + 1].split('=');
    clipOverrides.set(basename(f), name);
  }
}
const positionals = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    if (VALUE_FLAGS.has(a)) i++;
    continue;
  }
  positionals.push(a);
}
const [input, out] = positionals;
if (!input || !out) {
  console.error('usage: decimate_meshy_glb.mjs <inputDir|in.glb> <out.glb>  (see --help)');
  process.exit(1);
}

const RATIO = Number(opt('--ratio', 0.02));
const ERROR = Number(opt('--error', 0.02));
const WELD = Number(opt('--weld', 0.0001));
const WEBP = Number(opt('--webp-size', 1024));
const HEIGHT = opt('--height', null) != null ? Number(opt('--height', null)) : null;
const STRIP_ROOT = flag('--strip-root');
const WANT_MESHOPT = !flag('--no-meshopt');

function clipNameFromFile(p) {
  const over = clipOverrides.get(basename(p));
  if (over) return over;
  let stem = basename(p, extname(p));
  // strip Meshy boilerplate: "Meshy_AI_<Name>_biped_Animation_<Clip>_withSkin"
  stem = stem.replace(/^Meshy_AI_.*?_Animation_/i, '').replace(/_withSkin$/i, '');
  if (CLIP_ALIASES[stem]) return CLIP_ALIASES[stem];
  const tok = stem || 'Clip';
  return tok.charAt(0).toUpperCase() + tok.slice(1);
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

// ---- build (or read) the consolidated document -----------------------------
const isDir = statSync(input).isDirectory();
let doc;
if (isDir) {
  const files = readdirSync(input)
    .filter((f) => /\.glb$/i.test(f))
    .sort();
  if (files.length === 0) {
    console.error(`no .glb files in ${input}`);
    process.exit(1);
  }
  const baseName = opt('--base', null) ? basename(opt('--base', null)) : files[0];
  const rest = files.filter((f) => f !== baseName);
  doc = await io.read(join(input, baseName));
  const buf = doc.getRoot().listBuffers()[0];
  const nodesByName = new Map();
  for (const n of doc.getRoot().listNodes()) nodesByName.set(n.getName(), n);
  const baseAnim = doc.getRoot().listAnimations()[0];
  if (baseAnim) baseAnim.setName(clipNameFromFile(baseName));
  console.log(`base ${baseName} -> ${baseAnim ? baseAnim.getName() : '(no clip)'}`);
  for (const f of rest) {
    const src = await io.read(join(input, f));
    const srcAnim = src.getRoot().listAnimations()[0];
    if (!srcAnim) continue;
    const clip = clipNameFromFile(f);
    const anim = doc.createAnimation(clip);
    let missing = 0;
    for (const ch of srcAnim.listChannels()) {
      const s = ch.getSampler();
      const tgt = nodesByName.get(ch.getTargetNode().getName());
      if (!tgt) {
        missing++;
        continue;
      }
      const inAcc = doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(Float32Array.from(s.getInput().getArray()))
        .setBuffer(buf);
      const outAcc = doc
        .createAccessor()
        .setType(s.getOutput().getType())
        .setArray(Float32Array.from(s.getOutput().getArray()))
        .setBuffer(buf);
      const ns = doc
        .createAnimationSampler()
        .setInput(inAcc)
        .setOutput(outAcc)
        .setInterpolation(s.getInterpolation());
      const nc = doc
        .createAnimationChannel()
        .setTargetNode(tgt)
        .setTargetPath(ch.getTargetPath())
        .setSampler(ns);
      anim.addSampler(ns).addChannel(nc);
    }
    console.log(`  +${f} -> ${clip}${missing ? ` (${missing} unmatched bones)` : ''}`);
  }
} else {
  doc = await io.read(input);
}

// ---- root-motion strip (optional) ------------------------------------------
if (STRIP_ROOT) {
  // Zero out the root node's translation X/Z animation so the loop plays in place.
  const roots = new Set(['Hips', 'Root', 'Armature', 'mixamorigHips']);
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      if (ch.getTargetPath() !== 'translation') continue;
      if (!roots.has(ch.getTargetNode().getName())) continue;
      const outAcc = ch.getSampler().getOutput();
      const arr = Float32Array.from(outAcc.getArray());
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = 0;
        arr[i + 2] = 0;
      }
      outAcc.setArray(arr);
    }
  }
}

// ---- normalize height (optional) -------------------------------------------
if (HEIGHT != null) {
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  // crude AABB from mesh vertices via position accessors
  let min = Infinity;
  let max = -Infinity;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const arr = pos.getArray();
      for (let i = 1; i < arr.length; i += 3) {
        if (arr[i] < min) min = arr[i];
        if (arr[i] > max) max = arr[i];
      }
    }
  }
  const span = max - min;
  if (span > 0 && Number.isFinite(span)) {
    const s = HEIGHT / span;
    for (const node of scene.listChildren()) {
      const t = node.getScale();
      node.setScale([t[0] * s, t[1] * s, t[2] * s]);
    }
    console.log(`height: native ${span.toFixed(2)} -> ${HEIGHT} (scale ${s.toFixed(3)})`);
  }
}

// ---- decimate + compress ---------------------------------------------------
const transforms = [
  weld({ tolerance: WELD }),
  simplify({ simplifier: MeshoptSimplifier, ratio: RATIO, error: ERROR }),
  resample(),
  prune(),
  dedup(),
];
if (WEBP > 0) {
  const sharp = (await import('sharp')).default;
  const { textureCompress } = await import('@gltf-transform/functions');
  transforms.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [WEBP, WEBP] }));
}
if (WANT_MESHOPT) transforms.push(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
await doc.transform(...transforms);

mkdirSync(dirname(out), { recursive: true });
await io.write(out, doc);
const clips = doc
  .getRoot()
  .listAnimations()
  .map((a) => a.getName());
console.log(`wrote ${out}  clips: [${clips.join(', ') || 'none'}]`);
