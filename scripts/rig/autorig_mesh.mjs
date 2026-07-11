// EXPERIMENTAL: auto-rig an UNRIGGED static humanoid mesh onto the KayKit Rig_Medium
// skeleton, so a plain textured GLB (no bones, no animation) can play the shared clips.
//
// Weights each vertex by proximity to the skeleton's bone SEGMENTS (smooth inverse-distance
// blend across the nearest bones). Preserves the source mesh's UVs + base-color texture.
// The mesh must be a roughly-humanoid T-pose, Y-up; this feet-aligns + height-scales it to
// the skeleton, but CANNOT re-pose an arms-down mesh onto T-pose arm bones (auto-rig quality
// degrades the further the input pose is from the skeleton's T-pose bind).
//
//   node scripts/rig/autorig_mesh.mjs <input.glb> <out.glb> [donor.glb]

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);

async function makeIO() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}

function readSkeleton(doc) {
  const skin = doc.getRoot().listSkins()[0];
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices().getArray();
  const index = new Map();
  const pos = new Map();
  const m = new THREE.Matrix4();
  joints.forEach((j, i) => {
    index.set(j.getName(), i);
    pos.set(
      j.getName(),
      new THREE.Vector3().setFromMatrixPosition(
        m.fromArray(ibm.slice(i * 16, i * 16 + 16)).invert(),
      ),
    );
  });
  return { joints, ibm, index, pos };
}

function boneSegments(J) {
  const p = (n) => J.get(n).clone();
  const lerp = (a, b, t) => a.clone().lerp(b, t);
  const segs = [
    ['hips', p('hips'), p('spine')],
    ['spine', p('spine'), p('chest')],
    ['chest', p('chest'), lerp(p('chest'), p('head'), 0.6)],
    ['head', p('head'), p('head').add(UP.clone().multiplyScalar(0.4))],
  ];
  for (const s of ['l', 'r']) {
    segs.push(
      [`upperarm.${s}`, p(`upperarm.${s}`), p(`lowerarm.${s}`)],
      [`lowerarm.${s}`, p(`lowerarm.${s}`), p(`wrist.${s}`)],
      [`wrist.${s}`, p(`wrist.${s}`), p(`hand.${s}`)],
      [`hand.${s}`, p(`hand.${s}`), p(`handslot.${s}`)],
      [`upperleg.${s}`, p(`upperleg.${s}`), p(`lowerleg.${s}`)],
      [`lowerleg.${s}`, p(`lowerleg.${s}`), p(`foot.${s}`)],
      [`foot.${s}`, p(`foot.${s}`), p(`toes.${s}`)],
    );
  }
  return segs;
}

function distToSegment(pt, a, b) {
  const ab = b.clone().sub(a);
  const t = THREE.MathUtils.clamp(pt.clone().sub(a).dot(ab) / (ab.lengthSq() || 1e-9), 0, 1);
  return pt.distanceTo(a.clone().add(ab.multiplyScalar(t)));
}

function weightsFor(pt, segs, index) {
  const scored = segs
    .map(([name, a, b]) => ({ j: index.get(name), w: 1 / (distToSegment(pt, a, b) + 0.02) ** 4 }))
    .sort((x, y) => y.w - x.w)
    .slice(0, 4);
  const sum = scored.reduce((s, e) => s + e.w, 0) || 1;
  const j = [0, 0, 0, 0];
  const w = [0, 0, 0, 0];
  scored.forEach((e, i) => {
    j[i] = e.j;
    w[i] = e.w / sum;
  });
  return { j, w };
}

/** World-space geometry of the input mesh, grouped by SOURCE material so every part keeps
 *  its own texture (KayKit characters use several part-materials, not one atlas). */
function extractGeometry(doc) {
  const groups = new Map(); // srcMaterial|null -> { P, N, UVs, I }
  const groupFor = (mat) => {
    let g = groups.get(mat);
    if (!g) groups.set(mat, (g = { P: [], N: [], UVs: [], I: [] }));
    return g;
  };
  const walk = (node, parent) => {
    const world = parent.clone().multiply(new THREE.Matrix4().fromArray(node.getMatrix()));
    const mesh = node.getMesh();
    if (mesh) {
      const nmat = new THREE.Matrix3().getNormalMatrix(world);
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION')?.getArray();
        if (!pos) continue;
        const g = groupFor(prim.getMaterial() ?? null);
        const nor = prim.getAttribute('NORMAL')?.getArray();
        const uv = prim.getAttribute('TEXCOORD_0')?.getArray();
        const idx = prim.getIndices()?.getArray();
        const base = g.P.length / 3;
        const v = new THREE.Vector3();
        const n = new THREE.Vector3();
        for (let i = 0; i < pos.length / 3; i++) {
          v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(world);
          g.P.push(v.x, v.y, v.z);
          if (nor) {
            n.set(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2])
              .applyMatrix3(nmat)
              .normalize();
            g.N.push(n.x, n.y, n.z);
          } else g.N.push(0, 1, 0);
          g.UVs.push(uv ? uv[i * 2] : 0, uv ? uv[i * 2 + 1] : 0);
        }
        if (idx) for (const ii of idx) g.I.push(base + ii);
        else for (let i = 0; i < pos.length / 3; i++) g.I.push(base + i);
      }
    }
    for (const c of node.listChildren()) walk(c, world);
  };
  for (const sc of doc.getRoot().listScenes())
    for (const n of sc.listChildren()) walk(n, new THREE.Matrix4());
  return groups;
}

/** Copy a source material (+ its textures, deduped) into the donor document. */
function makeMaterialCopier(donor) {
  const texCache = new Map();
  const copyTex = (srcTex) => {
    if (!srcTex) return null;
    if (texCache.has(srcTex)) return texCache.get(srcTex);
    const t = donor
      .createTexture(srcTex.getName() || 'tex')
      .setImage(srcTex.getImage())
      .setMimeType(srcTex.getMimeType());
    texCache.set(srcTex, t);
    return t;
  };
  return (srcMat) => {
    const dm = donor.createMaterial(srcMat?.getName() || 'AutoMat');
    if (!srcMat)
      return dm
        .setBaseColorFactor([0.7, 0.7, 0.72, 1])
        .setRoughnessFactor(0.85)
        .setMetallicFactor(0);
    dm.setBaseColorFactor(srcMat.getBaseColorFactor())
      .setRoughnessFactor(srcMat.getRoughnessFactor())
      .setMetallicFactor(srcMat.getMetallicFactor());
    const bt = copyTex(srcMat.getBaseColorTexture());
    if (bt) dm.setBaseColorTexture(bt);
    const et = copyTex(srcMat.getEmissiveTexture?.());
    if (et) dm.setEmissiveTexture(et);
    const ef = srcMat.getEmissiveFactor?.();
    if (ef?.some((c) => c > 0)) dm.setEmissiveFactor(ef);
    if (srcMat.getDoubleSided?.()) dm.setDoubleSided(true);
    const am = srcMat.getAlphaMode?.();
    if (am && am !== 'OPAQUE') dm.setAlphaMode(am);
    return dm;
  };
}

export async function autorig(inputPath, outPath, donorPath) {
  const io = await makeIO();
  const donor = await io.read(donorPath);
  const skel = readSkeleton(donor);
  const input = await io.read(inputPath);
  const groups = [...extractGeometry(input).entries()].map(([mat, g]) => ({ mat, ...g }));

  // Feet-align + height-scale + centerline over the COMBINED bounds (one transform for all
  // groups). Robust to arm pose, unlike bbox-center, which the wide T-pose arm span skews.
  const bb = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const g of groups)
    for (let i = 0; i < g.P.length; i += 3) bb.expandByPoint(v.set(g.P[i], g.P[i + 1], g.P[i + 2]));
  const meshH = bb.max.y - bb.min.y || 1;
  const rootY = skel.pos.get('root').y;
  const headY = skel.pos.get('head').y;
  const jvals = [...skel.pos.values()];
  const cx = jvals.reduce((s, p) => s + p.x, 0) / jvals.length;
  const cz = jvals.reduce((s, p) => s + p.z, 0) / jvals.length;
  const scale = ((headY - rootY) * 1.28) / meshH; // skeleton feet->head is ~1.28x the joint span
  const meshCx = (bb.min.x + bb.max.x) / 2;
  const meshCz = (bb.min.z + bb.max.z) / 2;
  const segs = boneSegments(skel.pos);
  const pt = new THREE.Vector3();

  const root = donor.getRoot();
  const buffer = root.listBuffers()[0] ?? donor.createBuffer();
  const skin = donor.createSkin('AutoRig');
  for (const jnt of skel.joints) skin.addJoint(jnt);
  skin.setSkeleton(skel.joints[0]);
  skin.setInverseBindMatrices(
    donor
      .createAccessor('AutoIBM')
      .setType('MAT4')
      .setArray(Float32Array.from(skel.ibm))
      .setBuffer(buffer),
  );
  const acc = (type, arr) => donor.createAccessor().setType(type).setArray(arr).setBuffer(buffer);
  const copyMaterial = makeMaterialCopier(donor);
  const mesh = donor.createMesh('AutoBody');

  let totalVerts = 0;
  for (const g of groups) {
    const n = g.P.length / 3;
    if (!n) continue;
    totalVerts += n;
    const joints = new Uint16Array(n * 4);
    const weights = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      // align this vertex, then weight it to the skeleton
      const px = (g.P[i * 3] - meshCx) * scale + cx;
      const py = (g.P[i * 3 + 1] - bb.min.y) * scale + rootY;
      const pz = (g.P[i * 3 + 2] - meshCz) * scale + cz;
      g.P[i * 3] = px;
      g.P[i * 3 + 1] = py;
      g.P[i * 3 + 2] = pz;
      const { j, w } = weightsFor(pt.set(px, py, pz), segs, skel.index);
      joints.set(j, i * 4);
      weights.set(w, i * 4);
    }
    mesh.addPrimitive(
      donor
        .createPrimitive()
        .setAttribute('POSITION', acc('VEC3', Float32Array.from(g.P)))
        .setAttribute('NORMAL', acc('VEC3', Float32Array.from(g.N)))
        .setAttribute('TEXCOORD_0', acc('VEC2', Float32Array.from(g.UVs)))
        .setAttribute('JOINTS_0', acc('VEC4', joints))
        .setAttribute('WEIGHTS_0', acc('VEC4', weights))
        .setIndices(acc('SCALAR', Uint32Array.from(g.I)))
        .setMaterial(copyMaterial(g.mat)),
    );
  }

  for (const node of root.listNodes().filter((x) => x.getMesh() && x.getSkin())) {
    const m = node.getMesh();
    const s = node.getSkin();
    node.dispose();
    m.dispose();
    if (s !== skin) s.dispose();
  }
  root.listScenes()[0].addChild(donor.createNode('AutoBody').setMesh(mesh).setSkin(skin));
  await io.write(outPath, donor);
  return { verts: totalVerts, primitives: groups.length };
}

const isMain =
  process.argv[1] &&
  (await import('node:url')).fileURLToPath(import.meta.url) ===
    (await import('node:path')).resolve(process.argv[1]);
if (isMain) {
  const [, , input, out, donor] = process.argv;
  const donorPath =
    donor ??
    (await import('node:path')).resolve(process.cwd(), 'public/models/chars/players/knight.glb');
  if (!input || !out) {
    console.error('usage: node scripts/rig/autorig_mesh.mjs <input.glb> <out.glb> [donor.glb]');
    process.exit(2);
  }
  console.log(`auto-rigged ${(await autorig(input, out, donorPath)).verts} verts -> ${out}`);
}
