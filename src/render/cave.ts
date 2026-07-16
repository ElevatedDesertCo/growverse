import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKELETON_CAVE, terrainHeight } from '../sim/world';
import { surfaceMat } from './gfx';

// Wither Hollow: the Wither Husk host's cave lair, gouged into the foot of the world-rim
// mountain north of the Skeleton Grotto (the `SKELETON_CAVE` primitive in sim/world.ts).
// This module skins that ONE const: two rough rock jambs framing the mouth, a rubble side
// wall down each flank, a rock back-wall closing the recess, a chunky overhang roof with
// hanging stalactites, stalagmites and boulder rubble on the floor, and a bone-pile / skull
// totem centrepiece with a sickly ember. The colliders (colliders.ts) derive their jambs,
// side walls, and back wall from the SAME const with the same arithmetic, so what you see
// is what you bump. The terrain carve (skeletonCaveOffset) supplies the flat lair floor and
// the steep mountain cliff behind the back wall; this mesh adds the roof the heightfield
// cannot. All geometry is static, merged per material into a handful of one-draw meshes,
// built once and seated off a single `baseY` (the flat lair floor) at the cave centre.

export interface CaveView {
  group: THREE.Group;
}

const ROCK = 0x615c54; // weathered grey-brown cave rock
const ROCK_DARK = 0x3a3732; // shadowed interior, back wall, stalactites, lower courses
const BONE = 0xcfc8b6; // bleached bone and skulls
const EMBER = 0x74b83a; // sickly green ritual ember (emissive)

// Deterministic tiny PRNG (mulberry32) so the organic jitter is reproducible per seed and
// never touches Math.random (render is allowed rng, but reproducible geometry is cleaner).
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Push a box of size (w,h,d) centred at (x,y,z), optionally yawed and tilted, into `list`.
function box(
  list: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rotY = 0,
  rotZ = 0,
): void {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotZ) g.applyMatrix4(new THREE.Matrix4().makeRotationZ(rotZ));
  if (rotY) g.applyMatrix4(new THREE.Matrix4().makeRotationY(rotY));
  g.translate(x, y, z);
  list.push(g);
}

// Push an upright cylinder (radius r, height h) centred on (x,z) with its base at baseY.
function cyl(
  list: THREE.BufferGeometry[],
  r: number,
  h: number,
  x: number,
  baseY: number,
  z: number,
  sides = 8,
): void {
  const g = new THREE.CylinderGeometry(r, r, h, sides);
  g.translate(x, baseY + h / 2, z);
  list.push(g);
}

// Push a cone (radius r, height h). apexUp=true is a stalagmite (base at baseY); apexUp=false
// is a stalactite (base at ceilY, tip hanging down).
function spike(
  list: THREE.BufferGeometry[],
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
  apexUp: boolean,
  sides = 7,
): void {
  const g = new THREE.ConeGeometry(r, h, sides);
  if (!apexUp) g.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI));
  g.translate(x, y + (apexUp ? h / 2 : -h / 2), z);
  list.push(g);
}

// Push a faceted low-poly boulder (icosahedron) of radius r centred at (x,y,z).
function boulder(list: THREE.BufferGeometry[], r: number, x: number, y: number, z: number): void {
  const g = new THREE.IcosahedronGeometry(r, 0);
  g.scale(1, 0.8, 1);
  g.translate(x, y, z);
  list.push(g);
}

export function buildCave(seed: number): CaveView {
  const c = SKELETON_CAVE;
  const group = new THREE.Group();
  const baseY = terrainHeight(c.x, c.z, seed); // the flat lair floor (skeletonCaveOffset pins it)
  const rnd = mulberry32(Math.floor(seed) ^ 0x57a1e);

  const rock: THREE.BufferGeometry[] = [];
  const rockDark: THREE.BufferGeometry[] = [];
  const bone: THREE.BufferGeometry[] = [];
  const ember: THREE.BufferGeometry[] = [];

  const xMouth = c.x - c.half; // low-x wall: the open mouth, facing the field
  const xBack = c.x + c.half; // high-x wall: the recess back, into the mountain
  const zN = c.z + c.mouthHalf + c.wallThick; // north flank wall centreline
  const zS = c.z - c.mouthHalf - c.wallThick; // south flank wall centreline
  const ceilY = baseY + c.archH; // underside of the overhang roof at the mouth

  // ---- mouth jambs: two rough rock pillars framing the entrance --------------------
  for (const jz of [c.z - c.mouthHalf, c.z + c.mouthHalf]) {
    cyl(rock, c.jambR, c.archH + 1.4, xMouth, baseY, jz, 7);
    // a couple of stacked boulders crown each jamb so it reads as piled rock, not a post
    boulder(rock, c.jambR * 0.9, xMouth, baseY + c.archH + 1.2, jz);
    boulder(rockDark, c.jambR * 0.7, xMouth + 0.4, baseY + c.archH + 1.9, jz - 0.3);
  }

  // ---- flank walls: a run of jittered rubble boxes down each side -------------------
  for (const sz of [zS, zN]) {
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const bx = xMouth + t * (xBack - xMouth);
      const h = c.archH * (0.82 + rnd() * 0.3);
      const w = (xBack - xMouth) / steps + 0.6;
      const jz = sz + (rnd() - 0.5) * 0.5;
      // lower course is darker (shadowed), an upper cap block sits proud and yawed
      box(rockDark, w, h, c.wallThick * 2 + 0.4, bx, baseY + h / 2, jz, (rnd() - 0.5) * 0.3);
      box(
        rock,
        w * 0.7,
        h * 0.4,
        c.wallThick * 2,
        bx + (rnd() - 0.5) * 0.6,
        baseY + h + h * 0.12,
        jz,
        (rnd() - 0.5) * 0.5,
      );
    }
  }

  // ---- back wall: a tall rough rock mass closing the recess (mountain behind it) ----
  {
    const steps = 5;
    const span = c.mouthHalf * 2 + c.wallThick * 2;
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const bz = c.z - span / 2 + t * span;
      const h = c.archH + 1.5 + rnd() * 1.6;
      box(rockDark, c.wallThick * 2 + 0.6, h, span / steps + 0.6, xBack, baseY + h / 2, bz);
    }
    // a few boulders spilling down the back into the chamber
    for (let i = 0; i < 4; i++)
      boulder(
        rock,
        0.9 + rnd() * 0.6,
        xBack - 0.9,
        baseY + 0.5 + rnd() * 0.6,
        c.z + (rnd() - 0.5) * 6,
      );
  }

  // ---- overhang roof: chunky jittered slabs bridging mouth to back ------------------
  {
    const slabs = 4;
    for (let i = 0; i < slabs; i++) {
      const t = (i + 0.5) / slabs;
      const rx = xMouth + t * (xBack - xMouth);
      // the roof lifts a touch toward the mouth so the entrance is the tallest point
      const lift = (1 - t) * 0.8;
      const w = (xBack - xMouth) / slabs + 1.2;
      box(
        rockDark,
        w,
        1.4 + rnd() * 0.5,
        c.mouthHalf * 2 + c.wallThick * 2 + 0.6,
        rx,
        ceilY + lift + 0.6,
        c.z + (rnd() - 0.5) * 0.4,
        0,
        (rnd() - 0.5) * 0.12,
      );
    }
    // arch lintel: a thick rough beam bridging the two mouth jambs at the top
    box(rock, 1.6, 1.8, c.mouthHalf * 2 + 1.2, xMouth, ceilY + 0.9, c.z);
    boulder(rock, 1.5, xMouth + 0.3, ceilY + 1.9, c.z);
  }

  // ---- stalactites hanging from the roof underside ---------------------------------
  for (let i = 0; i < 6; i++) {
    const sx = xMouth + 1.5 + rnd() * (c.half * 2 - 3);
    const sz = c.z + (rnd() - 0.5) * (c.mouthHalf * 1.6);
    spike(rockDark, 0.4 + rnd() * 0.25, 1.6 + rnd() * 1.4, sx, ceilY + 0.2, sz, false);
  }

  // ---- stalagmites rising from the floor -------------------------------------------
  for (let i = 0; i < 5; i++) {
    const sx = xMouth + 2 + rnd() * (c.half * 2 - 4);
    const sz = c.z + (rnd() - 0.5) * (c.mouthHalf * 1.5);
    spike(rock, 0.45 + rnd() * 0.3, 1.2 + rnd() * 1.3, sx, baseY, sz, true);
  }

  // ---- boulder rubble scattered at the mouth and inside ----------------------------
  for (let i = 0; i < 7; i++) {
    const bx = xMouth - 0.5 + rnd() * (c.half * 2);
    const bz = c.z + (rnd() - 0.5) * (c.mouthHalf * 1.7);
    const r = 0.6 + rnd() * 0.7;
    boulder(rock, r, bx, baseY + r * 0.55, bz);
  }

  // ---- bone-pile / skull totem centrepiece, deeper in the chamber ------------------
  {
    const cx = c.x + 1.5;
    const cz = c.z;
    // a low heap of criss-crossed long bones
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI;
      box(
        bone,
        0.14,
        0.14,
        1.4 + rnd() * 0.8,
        cx + (rnd() - 0.5) * 1.8,
        baseY + 0.14 + rnd() * 0.2,
        cz + (rnd() - 0.5) * 1.8,
        a,
      );
    }
    // a couple of skulls perched on the heap
    for (let i = 0; i < 3; i++) {
      const g = new THREE.IcosahedronGeometry(0.32, 0);
      g.translate(cx + (rnd() - 0.5) * 1.4, baseY + 0.4 + rnd() * 0.2, cz + (rnd() - 0.5) * 1.4);
      bone.push(g);
    }
    // a bone totem pole with a crowning skull
    cyl(bone, 0.12, 2.4, cx, baseY, cz + 0.2, 6);
    const skull = new THREE.IcosahedronGeometry(0.36, 0);
    skull.translate(cx, baseY + 2.55, cz + 0.2);
    bone.push(skull);
    // a sickly ember bowl at the totem foot (emissive; a cosmetic glow, not a light source)
    const bowl = new THREE.CylinderGeometry(0.5, 0.32, 0.35, 10);
    bowl.translate(cx, baseY + 0.18, cz - 0.9);
    ember.push(bowl);
  }

  // ---- merge each material bucket into one mesh ------------------------------------
  const add = (
    bucket: THREE.BufferGeometry[],
    color: number,
    rough: number,
    emissive = 0x000000,
    emissiveIntensity = 1,
  ) => {
    if (bucket.length === 0) return;
    const merged = mergeGeometries(
      bucket.map((g) => g.toNonIndexed()),
      false,
    );
    if (!merged) return;
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(
      merged,
      surfaceMat({ color, roughness: rough, flatShading: true, emissive, emissiveIntensity }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(rock, ROCK, 0.97);
  add(rockDark, ROCK_DARK, 0.98);
  add(bone, BONE, 0.8);
  add(ember, EMBER, 0.6, EMBER, 0.9);

  return { group };
}
