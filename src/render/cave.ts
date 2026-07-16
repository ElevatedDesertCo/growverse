import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKELETON_CAVE, terrainHeight } from '../sim/world';
import { surfaceMat } from './gfx';

// Wither Hollow: the Wither Husk host's cave SYSTEM, bored deep into the foot of the world-rim
// mountain north of the Skeleton Grotto (the `SKELETON_CAVE` primitive in sim/world.ts). This
// module skins that ONE const's KEYHOLE footprint: a roofed entrance tunnel on the field side
// (rough jambs, rubble walls, a chunky overhang roof, hanging stalactites) that opens through a
// rock throat into a wide, DEEP, open-topped inner chamber (tall rough rock walls, stalagmite
// columns, wall ledges, boulder rubble, and the husks' bone piles + skull totem deep at the
// back). The inner chamber is left open-topped so it stays sky-lit and playable at depth. The
// colliders (colliders.ts) derive their jambs, tunnel walls, shoulder walls, chamber walls, and
// back wall from the SAME const with the same arithmetic, so what you see is what you bump. The
// terrain carve (skeletonCaveOffset) supplies the flat lair floor and the steep mountain cliffs
// that wall the tunnel and chamber; this mesh dresses those cliffs with rock and adds the tunnel
// roof the heightfield cannot. All geometry is static, merged per material into a handful of
// one-draw meshes, built once and seated off a single `baseY` (the flat floor) at the centre.

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

  const zMouthN = c.z + c.mouthHalf; // tunnel wall centreline, north
  const zMouthS = c.z - c.mouthHalf; // tunnel wall centreline, south
  const zChamN = c.z + c.chamberHalf; // chamber wall centreline, north
  const zChamS = c.z - c.chamberHalf; // chamber wall centreline, south
  const ceilY = baseY + c.archH; // underside of the tunnel overhang roof

  // A run of jittered rubble wall boxes from (x0..x1) along x, centred on z, of nominal height
  // `hh`; the lower course is dark (shadowed) with a proud, yawed cap block on top. Used for
  // both the low tunnel walls and the tall open-chamber walls.
  const rubbleWallX = (x0: number, x1: number, zc: number, hh: number, steps: number): void => {
    const span = x1 - x0;
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const bx = x0 + t * span;
      const h = hh * (0.85 + rnd() * 0.3);
      const w = span / steps + 0.6;
      const jz = zc + (rnd() - 0.5) * 0.6;
      box(rockDark, w, h, c.wallThick * 2 + 0.4, bx, baseY + h / 2, jz, (rnd() - 0.5) * 0.25);
      box(
        rock,
        w * 0.7,
        h * 0.35,
        c.wallThick * 2,
        bx + (rnd() - 0.5) * 0.6,
        baseY + h + h * 0.1,
        jz,
        (rnd() - 0.5) * 0.5,
      );
    }
  };

  // ---- mouth jambs: two tall rough rock pillars framing the entrance ----------------
  for (const jz of [zMouthS, zMouthN]) {
    cyl(rock, c.jambR, c.archH + 1.4, c.mouthX, baseY, jz, 7);
    boulder(rock, c.jambR * 0.9, c.mouthX, baseY + c.archH + 1.2, jz);
    boulder(rockDark, c.jambR * 0.7, c.mouthX + 0.4, baseY + c.archH + 1.9, jz - 0.3);
  }

  // ---- entrance tunnel: low rubble walls, mouth to throat, each side ----------------
  rubbleWallX(c.mouthX, c.throatX, zMouthS, c.archH, 5);
  rubbleWallX(c.mouthX, c.throatX, zMouthN, c.archH, 5);

  // ---- tunnel overhang roof: chunky jittered slabs bridging mouth to throat --------
  {
    const slabs = 4;
    const span = c.throatX - c.mouthX;
    for (let i = 0; i < slabs; i++) {
      const t = (i + 0.5) / slabs;
      const rx = c.mouthX + t * span;
      const lift = (1 - t) * 0.8; // roof lifts toward the mouth so the entrance is tallest
      box(
        rockDark,
        span / slabs + 1.2,
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
    box(rock, 1.6, 1.8, c.mouthHalf * 2 + 1.2, c.mouthX, ceilY + 0.9, c.z);
    boulder(rock, 1.5, c.mouthX + 0.3, ceilY + 1.9, c.z);
  }

  // ---- tunnel stalactites hanging from the roof underside --------------------------
  for (let i = 0; i < 5; i++) {
    const sx = c.mouthX + 1.5 + rnd() * (c.throatX - c.mouthX - 3);
    const sz = c.z + (rnd() - 0.5) * (c.mouthHalf * 1.5);
    spike(rockDark, 0.4 + rnd() * 0.25, 1.6 + rnd() * 1.4, sx, ceilY + 0.2, sz, false);
  }

  // ---- shoulder walls: the rock step where the tunnel opens into the wide chamber ---
  // Each runs along z from the tunnel edge (mouthHalf) out to the chamber edge (chamberHalf),
  // at x = throatX, so the chamber reads as a bigger room stepped back off the tunnel.
  for (const s of [-1, 1]) {
    const z0 = c.z + s * c.mouthHalf;
    const z1 = c.z + s * c.chamberHalf;
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const bz = z0 + t * (z1 - z0);
      const h = c.archH + 3 + rnd() * 3;
      box(
        rockDark,
        c.wallThick * 2 + 0.5,
        h,
        Math.abs(z1 - z0) / steps + 0.6,
        c.throatX,
        baseY + h / 2,
        bz,
      );
    }
  }

  // ---- inner chamber: tall open-topped rough rock walls, throat to back, each side --
  // Taller than the tunnel and left OPEN at the top (no roof) so the chamber is sky-lit; the
  // terrain carve raises the true mountain cliff behind these, this just dresses the base.
  rubbleWallX(c.throatX, c.backX, zChamS, c.archH + 6, 7);
  rubbleWallX(c.throatX, c.backX, zChamN, c.archH + 6, 7);

  // ---- back wall: a tall rough rock mass closing the deep end of the chamber --------
  {
    const steps = 7;
    const span = c.chamberHalf * 2 + c.wallThick * 2;
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const bz = c.z - span / 2 + t * span;
      const h = c.archH + 6 + rnd() * 3;
      box(rockDark, c.wallThick * 2 + 0.6, h, span / steps + 0.6, c.backX, baseY + h / 2, bz);
    }
    // boulders spilling down the back into the chamber floor
    for (let i = 0; i < 6; i++)
      boulder(
        rock,
        0.9 + rnd() * 0.7,
        c.backX - 1.2 - rnd() * 1.5,
        baseY + 0.5 + rnd() * 0.7,
        c.z + (rnd() - 0.5) * (c.chamberHalf * 1.6),
      );
  }

  // ---- wall ledges: rough rock shelves jutting from the chamber flanks --------------
  for (let i = 0; i < 5; i++) {
    const s = i % 2 === 0 ? 1 : -1;
    const lx = c.throatX + 3 + rnd() * (c.backX - c.throatX - 5);
    const ly = baseY + 2 + rnd() * (c.archH * 0.6);
    box(
      rock,
      2 + rnd() * 1.5,
      0.7,
      2.5,
      lx,
      ly,
      c.z + s * (c.chamberHalf - 1),
      (rnd() - 0.5) * 0.4,
    );
  }

  // ---- stalagmite columns rising from the chamber floor (some tall pillars) ---------
  for (let i = 0; i < 8; i++) {
    const sx = c.throatX + 1.5 + rnd() * (c.backX - c.throatX - 3);
    const sz = c.z + (rnd() - 0.5) * (c.chamberHalf * 1.7);
    const tall = rnd() < 0.35;
    spike(rock, 0.5 + rnd() * 0.4, tall ? 4 + rnd() * 3 : 1.4 + rnd() * 1.4, sx, baseY, sz, true);
  }

  // ---- boulder rubble scattered through the chamber and mouth -----------------------
  for (let i = 0; i < 12; i++) {
    const bx = c.mouthX + rnd() * (c.backX - c.mouthX);
    const spread = bx < c.throatX ? c.mouthHalf * 1.6 : c.chamberHalf * 1.7;
    const bz = c.z + (rnd() - 0.5) * spread;
    const r = 0.6 + rnd() * 0.9;
    boulder(rock, r, bx, baseY + r * 0.55, bz);
  }

  // ---- bone piles + skull totem: the husks' muster, deep at the back of the chamber -
  const pile = (cx: number, cz: number, bones: number, skulls: number): void => {
    for (let i = 0; i < bones; i++) {
      box(
        bone,
        0.14,
        0.14,
        1.4 + rnd() * 0.8,
        cx + (rnd() - 0.5) * 2.2,
        baseY + 0.14 + rnd() * 0.2,
        cz + (rnd() - 0.5) * 2.2,
        rnd() * Math.PI,
      );
    }
    for (let i = 0; i < skulls; i++) {
      const g = new THREE.IcosahedronGeometry(0.32, 0);
      g.translate(cx + (rnd() - 0.5) * 1.8, baseY + 0.4 + rnd() * 0.2, cz + (rnd() - 0.5) * 1.8);
      bone.push(g);
    }
  };
  {
    const cx = c.backX - 6; // deep in the chamber, short of the back wall
    const cz = c.z;
    pile(cx, cz, 12, 4);
    pile(cx - 5, cz + c.chamberHalf * 0.5, 7, 2); // a second heap off to one side
    // a bone totem pole with a crowning skull
    cyl(bone, 0.14, 2.8, cx, baseY, cz + 0.2, 6);
    const skull = new THREE.IcosahedronGeometry(0.4, 0);
    skull.translate(cx, baseY + 2.95, cz + 0.2);
    bone.push(skull);
    // a sickly ember bowl at the totem foot (emissive; a cosmetic glow, not a light source)
    const bowl = new THREE.CylinderGeometry(0.55, 0.35, 0.38, 10);
    bowl.translate(cx, baseY + 0.2, cz - 1.1);
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
