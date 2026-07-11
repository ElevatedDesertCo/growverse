// Procedural character generator (Tier C, in-code bodies).
//
// Builds a brand-new low-poly character mesh and GRAFTS it onto the KayKit Rig_Medium
// skeleton extracted from a donor GLB (knight.glb), keeping the donor's animation clips.
// The result is a fully-original silhouette that animates with the default clean clips,
// no external mesh, no Blender. Geometry is rigidly skinned (each vertex bound 100% to
// one bone, exactly like the Combat Mech's parts), so a crisp faceted look articulates
// cleanly. See docs/design/custom-character-pipeline.md.
//
// A recipe (scripts/rig/character_recipes.mjs) receives a `Body` builder plus a `joints`
// position map and adds boxes/segments bound to named bones. This engine turns that into
// a GLB written under public/models/chars/custom/.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import * as THREE from 'three';

// --- color ----------------------------------------------------------------
// glTF baseColorFactor / emissiveFactor are LINEAR; convert authored sRGB hex.
function srgbToLinear(hex) {
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return [lin(r), lin(g), lin(b)];
}

// --- geometry primitives (flat-shaded boxes) ------------------------------
// A unit box centered at origin: 6 faces x 4 verts, per-face normals (flat shading).
const BOX_FACES = [
  {
    n: [0, 0, 1],
    v: [
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ],
  },
  {
    n: [0, 0, -1],
    v: [
      [1, -1, -1],
      [-1, -1, -1],
      [-1, 1, -1],
      [1, 1, -1],
    ],
  },
  {
    n: [1, 0, 0],
    v: [
      [1, -1, 1],
      [1, -1, -1],
      [1, 1, -1],
      [1, 1, 1],
    ],
  },
  {
    n: [-1, 0, 0],
    v: [
      [-1, -1, -1],
      [-1, -1, 1],
      [-1, 1, 1],
      [-1, 1, -1],
    ],
  },
  {
    n: [0, 1, 0],
    v: [
      [-1, 1, 1],
      [1, 1, 1],
      [1, 1, -1],
      [-1, 1, -1],
    ],
  },
  {
    n: [0, -1, 0],
    v: [
      [-1, -1, -1],
      [1, -1, -1],
      [1, -1, 1],
      [-1, -1, 1],
    ],
  },
];

/**
 * The mesh accumulator. Parts are grouped by material index; each part is a box placed by
 * a full transform (translate * rotate * scale) and rigidly bound to one joint.
 */
class Body {
  constructor(jointIndexByName, jointPos) {
    this.jointIndex = jointIndexByName;
    this.pos = jointPos; // Map<name, THREE.Vector3>
    // per material index: { positions:[], normals:[], joints:[], weights:[], indices:[] }
    this.groups = new Map();
  }

  jointPos(name) {
    const p = this.pos.get(name);
    if (!p) throw new Error(`unknown bone "${name}"`);
    return p.clone();
  }

  _group(mat) {
    let g = this.groups.get(mat);
    if (!g) {
      g = { positions: [], normals: [], joints: [], weights: [], indices: [] };
      this.groups.set(mat, g);
    }
    return g;
  }

  /**
   * Add an oriented box.
   * @param {object} o
   * @param {THREE.Vector3|number[]} o.center  box center (bind-world space)
   * @param {number[]} o.size    [w,h,d] full extents
   * @param {string} o.joint     bone name to bind every vertex to (rigid)
   * @param {number} o.mat       material index
   * @param {THREE.Quaternion} [o.quat]  orientation (default identity)
   */
  box({ center, size, joint, mat, quat }) {
    const ji = this.jointIndex.get(joint);
    if (ji === undefined) throw new Error(`unknown bone "${joint}"`);
    const g = this._group(mat);
    const c = center instanceof THREE.Vector3 ? center : new THREE.Vector3(...center);
    const q = quat ?? new THREE.Quaternion();
    const half = new THREE.Vector3(size[0] / 2, size[1] / 2, size[2] / 2);
    const nm = new THREE.Matrix3().setFromMatrix4(
      new THREE.Matrix4().makeRotationFromQuaternion(q),
    );
    const tmp = new THREE.Vector3();
    for (const face of BOX_FACES) {
      const base = g.positions.length / 3;
      const n = tmp
        .set(...face.n)
        .applyMatrix3(nm)
        .clone()
        .normalize();
      for (const corner of face.v) {
        const v = new THREE.Vector3(corner[0] * half.x, corner[1] * half.y, corner[2] * half.z)
          .applyQuaternion(q)
          .add(c);
        g.positions.push(v.x, v.y, v.z);
        g.normals.push(n.x, n.y, n.z);
        g.joints.push(ji, 0, 0, 0);
        g.weights.push(1, 0, 0, 0);
      }
      g.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  /**
   * A tapered box spanning two points, bound to `joint`. Length axis follows p0->p1, so a
   * limb segment placed between two bones rotates with the bone it is bound to.
   */
  segment({ from, to, joint, mat, width, depth }) {
    const a = from instanceof THREE.Vector3 ? from.clone() : new THREE.Vector3(...from);
    const b = to instanceof THREE.Vector3 ? to.clone() : new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length() || 1e-4;
    dir.normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const center = a.clone().add(b).multiplyScalar(0.5);
    this.box({ center, size: [width, len, depth ?? width], joint, mat, quat });
  }
}

// --- donor skeleton -------------------------------------------------------
export async function makeIO() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}

/** Read the donor, returning its doc + the shared 23-joint skeleton data. */
export async function readDonorSkeleton(io, donorPath) {
  const doc = await io.read(donorPath);
  const root = doc.getRoot();
  // Every skinned part-mesh shares the same 23 joints; take the first skin's ordering.
  const donorSkin = root.listSkins()[0];
  const joints = donorSkin.listJoints();
  const ibmArray = donorSkin.getInverseBindMatrices().getArray();
  const jointIndexByName = new Map();
  const jointPos = new Map();
  const m = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  joints.forEach((j, i) => {
    jointIndexByName.set(j.getName(), i);
    m.fromArray(ibmArray, i * 16);
    inv.copy(m).invert();
    jointPos.set(j.getName(), new THREE.Vector3().setFromMatrixPosition(inv));
  });
  return { doc, joints, ibmArray, jointIndexByName, jointPos };
}

// --- graft ----------------------------------------------------------------
/**
 * Replace all of the donor's part-meshes with one new skinned mesh built from `body`,
 * over a fresh skin covering the same 23 joints (so the kept clips still drive it).
 */
function graft(doc, donorSkel, body, materials) {
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0] ?? doc.createBuffer();

  // 1) Fresh skin over the same joints + IBMs, so JOINTS_0 indices match our ordering.
  const skin = doc.createSkin('CustomRig');
  for (const j of donorSkel.joints) skin.addJoint(j);
  skin.setSkeleton(donorSkel.joints[0]);
  const ibm = doc
    .createAccessor('CustomIBM')
    .setType('MAT4')
    .setArray(Float32Array.from(donorSkel.ibmArray))
    .setBuffer(buffer);
  skin.setInverseBindMatrices(ibm);

  // 2) Build the new mesh, one primitive per material group.
  const mesh = doc.createMesh('CustomBody');
  const matDefs = materials.map((spec, i) => {
    const mat = doc.createMaterial(`custom_${i}`);
    mat.setBaseColorFactor([...srgbToLinear(spec.color), 1]);
    mat.setRoughnessFactor(spec.roughness ?? 0.75);
    mat.setMetallicFactor(spec.metallic ?? 0);
    if (spec.emissive) mat.setEmissiveFactor(srgbToLinear(spec.emissive));
    return mat;
  });
  for (const [matIdx, g] of body.groups) {
    if (!g.positions.length) continue;
    const prim = doc.createPrimitive();
    prim.setAttribute(
      'POSITION',
      doc
        .createAccessor()
        .setType('VEC3')
        .setArray(Float32Array.from(g.positions))
        .setBuffer(buffer),
    );
    prim.setAttribute(
      'NORMAL',
      doc.createAccessor().setType('VEC3').setArray(Float32Array.from(g.normals)).setBuffer(buffer),
    );
    prim.setAttribute(
      'JOINTS_0',
      doc.createAccessor().setType('VEC4').setArray(Uint16Array.from(g.joints)).setBuffer(buffer),
    );
    prim.setAttribute(
      'WEIGHTS_0',
      doc.createAccessor().setType('VEC4').setArray(Float32Array.from(g.weights)).setBuffer(buffer),
    );
    prim.setIndices(
      doc
        .createAccessor()
        .setType('SCALAR')
        .setArray(Uint32Array.from(g.indices))
        .setBuffer(buffer),
    );
    prim.setMaterial(matDefs[matIdx]);
    mesh.addPrimitive(prim);
  }

  // 3) Remove the donor's original part-meshes + their skins; attach ours to the scene.
  const originalMeshNodes = root.listNodes().filter((n) => n.getMesh() && n.getSkin());
  const scene = root.listScenes()[0];
  const oldSkins = new Set();
  const oldMeshes = new Set();
  for (const n of originalMeshNodes) {
    oldSkins.add(n.getSkin());
    oldMeshes.add(n.getMesh());
    n.dispose();
  }
  for (const mm of oldMeshes) mm.dispose();
  for (const s of oldSkins) if (s !== skin) s.dispose();

  const node = doc.createNode('CustomBody').setMesh(mesh).setSkin(skin);
  scene.addChild(node);
}

/**
 * Generate one character GLB.
 * @param {object} recipe  { name, materials:[{color,emissive?,metallic?,roughness?}], build(body, ctx) }
 * @param {{ donorPath: string, outPath: string }} opts
 */
export async function generateCharacter(recipe, { donorPath, outPath }) {
  const io = await makeIO();
  const donorSkel = await readDonorSkeleton(io, donorPath);
  const body = new Body(donorSkel.jointIndexByName, donorSkel.jointPos);
  recipe.build(body, { joints: donorSkel.jointPos, THREE });
  graft(donorSkel.doc, donorSkel, body, recipe.materials);
  await io.write(outPath, donorSkel.doc);
  let verts = 0;
  for (const g of body.groups.values()) verts += g.positions.length / 3;
  return { name: recipe.name, outPath, verts, primitives: body.groups.size };
}

export { Body, srgbToLinear };
