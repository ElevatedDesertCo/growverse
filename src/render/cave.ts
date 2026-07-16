import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKELETON_CAVE, terrainHeight } from '../sim/world';
import { loadTexture } from './assets/loader';
import { registerPreload } from './assets/preload';
import { GFX, surfaceMat } from './gfx';

// Wither Hollow: the Wither Husk host's cave SYSTEM, bored deep into the foot of the world-rim
// mountain north of the Skeleton Grotto (the `SKELETON_CAVE` primitive in sim/world.ts). This
// module skins that ONE const's KEYHOLE footprint: a roofed entrance tunnel on the field side
// that opens through a rock throat into a wide, DEEP, open-topped inner chamber where the husks
// muster (bone piles + skull totem deep at the back).
//
// It is meant to read as a NATURAL cave gouged from the hillside, not a built structure, so the
// rock is skinned with the SAME earth material the terrain paints the mountain with: the
// `Rock051` colour + normal maps over a warm ochre tint, world-scaled so it tiles like the
// cliff face behind it. The walls are not clean slabs but clusters of overlapping, tilted
// boulders and rough chunks that dress the base of the carved cliff, so the mesh blends into the
// mountainside the heightfield already raises (the terrain carve supplies the tall cliffs; this
// only needs to face their lower reaches and add the tunnel roof the heightfield cannot).
//
// The colliders (colliders.ts) derive their jambs, tunnel/chamber walls, shoulder step, and back
// wall from the SAME const with the same arithmetic, so what you see is what you bump. All
// geometry is static, merged per material into a handful of one-draw meshes, built once and
// seated off a single `baseY` (the flat floor) sampled at the chamber centre.

export interface CaveView {
  group: THREE.Group;
}

// Warm earthy tints matching the sun-baked vale mountainside (multiply the near-grey Rock051
// albedo). Lit rock reads as ochre-tan like the cliffs; the shadowed interior is a deeper brown.
const ROCK = 0xbfad8a; // sunlit ochre-tan rock (matches the mountain splat)
const ROCK_DARK = 0x8c7856; // shadowed interior / lower courses, deeper earth-brown
const BONE = 0xcfc8b6; // bleached bone and skulls
const EMBER = 0x74b83a; // sickly green ritual ember (emissive)

// The mountain's rock earth material, loaded once and shared read-only with the terrain (same
// cache key). Only kicked on tiers that use textured PBR surfaces; on low tier the cave falls
// back to the flat earthy tint. World-space tiling is baked into each geometry's UVs (tileUv),
// so the shared texture's own repeat is left untouched.
let ROCK_TEX: THREE.Texture | null = null;
let ROCK_NRM: THREE.Texture | null = null;
if (GFX.terrainSplat) {
  registerPreload(
    loadTexture('/textures/terrain/Rock051_Color.jpg', { srgb: true, repeat: true }).then((t) => {
      t.anisotropy = 8;
      ROCK_TEX = t;
      return t;
    }),
  );
  registerPreload(
    loadTexture('/textures/terrain/Rock051_NormalGL.jpg', { repeat: true }).then((t) => {
      t.anisotropy = 4;
      ROCK_NRM = t;
      return t;
    }),
  );
}

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

// Bake world-space tiling into a geometry's UVs so the shared rock texture repeats at a
// consistent ~TILE units regardless of the piece's size (avoids stretch on big walls). Scaled by
// the largest extent, which is a good-enough proxy for a low-poly flat-shaded rock look.
const TILE = 3.5;
const tmpSize = new THREE.Vector3();
function tileUv(g: THREE.BufferGeometry): void {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv) return;
  g.computeBoundingBox();
  const s = Math.max(0.5, g.boundingBox!.getSize(tmpSize).length() / Math.sqrt(3));
  const scale = s / TILE;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * scale, uv.getY(i) * scale);
  uv.needsUpdate = true;
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
  tileUv(g);
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
  tileUv(g);
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
  tileUv(g);
  if (!apexUp) g.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.PI));
  g.translate(x, y + (apexUp ? h / 2 : -h / 2), z);
  list.push(g);
}

// Push a faceted low-poly boulder (icosahedron) of radius r centred at (x,y,z), squashed and
// randomly tumbled so no two read the same. `rnd` drives the tumble; pass null for an axis-true
// boulder (used where orientation matters).
function boulder(
  list: THREE.BufferGeometry[],
  r: number,
  x: number,
  y: number,
  z: number,
  rnd: (() => number) | null = null,
): void {
  const g = new THREE.IcosahedronGeometry(r, 0);
  g.scale(1, 0.78 + (rnd ? rnd() * 0.3 : 0), 1);
  tileUv(g);
  if (rnd) {
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(rnd() * Math.PI));
    g.applyMatrix4(new THREE.Matrix4().makeRotationZ((rnd() - 0.5) * 0.6));
  }
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

  // A natural rock wall dressing the base of a carved cliff: overlapping tilted boulders in two
  // rough courses along a line, with a few tumbled chunk-boxes filling the mass behind them, so
  // it reads as piled/broken rock rather than a slab. `along` is the run axis; (a0,a1) is the
  // run, `fixed` is the constant coordinate, `hh` is roughly how tall to build the rubble.
  const rockWall = (along: 'x' | 'z', a0: number, a1: number, fixed: number, hh: number): void => {
    const span = Math.abs(a1 - a0);
    const step = 2.2;
    const n = Math.max(2, Math.round(span / step));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const p = a0 + (a1 - a0) * t;
      const jitter = (rnd() - 0.5) * 1.2;
      const px = along === 'x' ? p : fixed + jitter;
      const pz = along === 'x' ? fixed + jitter : p;
      // base course: a big squashed boulder sitting on the floor
      const r0 = hh * 0.22 + rnd() * 1.1;
      boulder(rnd() < 0.5 ? rock : rockDark, r0, px, baseY + r0 * 0.7, pz, rnd);
      // a tumbled filler chunk giving the wall bulk (tilted, never a clean vertical)
      box(
        rockDark,
        r0 * 1.6,
        hh * (0.55 + rnd() * 0.4),
        r0 * 1.6,
        along === 'x' ? p : fixed + (rnd() - 0.5) * 1.0,
        baseY + hh * 0.4,
        along === 'x' ? fixed + (rnd() - 0.5) * 1.0 : p,
        (rnd() - 0.5) * 0.5,
        (rnd() - 0.5) * 0.35,
      );
      // second course: a medium boulder perched proud of the base
      const r1 = hh * 0.16 + rnd() * 0.8;
      boulder(
        rnd() < 0.5 ? rock : rockDark,
        r1,
        px + (rnd() - 0.5) * 1.0,
        baseY + r0 + r1 * 0.5,
        pz + (rnd() - 0.5) * 1.0,
        rnd,
      );
      // an occasional cap boulder higher up, tying the dressing into the cliff behind
      if (rnd() < 0.5) {
        const r2 = hh * 0.12 + rnd() * 0.6;
        boulder(
          rock,
          r2,
          px + (rnd() - 0.5) * 1.4,
          baseY + r0 + r1 + r2 * 0.4,
          pz + (rnd() - 0.5) * 1.4,
          rnd,
        );
      }
    }
  };

  // ---- mouth jambs: two chunky rough boulder stacks framing the entrance ------------
  for (const jz of [zMouthS, zMouthN]) {
    cyl(rockDark, c.jambR, c.archH * 0.5, c.mouthX, baseY, jz, 7); // rough core
    boulder(rock, c.jambR, c.mouthX, baseY + c.archH * 0.45, jz, rnd);
    boulder(rock, c.jambR * 0.85, c.mouthX + 0.4, baseY + c.archH * 0.75, jz - 0.3, rnd);
    boulder(rockDark, c.jambR * 0.7, c.mouthX - 0.3, baseY + c.archH + 0.4, jz + 0.3, rnd);
  }

  // ---- entrance tunnel: low broken-rock walls, mouth to throat, each side -----------
  rockWall('x', c.mouthX, c.throatX, zMouthS, c.archH * 0.85);
  rockWall('x', c.mouthX, c.throatX, zMouthN, c.archH * 0.85);

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
        1.6 + rnd() * 0.7,
        c.mouthHalf * 2 + c.wallThick * 2 + 0.8,
        rx,
        ceilY + lift + 0.6,
        c.z + (rnd() - 0.5) * 0.4,
        0,
        (rnd() - 0.5) * 0.14,
      );
      // a boulder or two riding the roof so its top edge is broken, not a clean beam
      boulder(
        rock,
        0.9 + rnd() * 0.7,
        rx + (rnd() - 0.5) * 1.5,
        ceilY + lift + 1.6,
        c.z + (rnd() - 0.5) * 3,
        rnd,
      );
    }
    // arch lintel: a thick rough beam bridging the mouth jambs, crowned with rubble
    box(rock, 2.0, 2.0, c.mouthHalf * 2 + 1.4, c.mouthX, ceilY + 0.9, c.z, 0, (rnd() - 0.5) * 0.1);
    boulder(rockDark, 1.6, c.mouthX + 0.3, ceilY + 2.0, c.z, rnd);
  }

  // ---- tunnel stalactites hanging from the roof underside --------------------------
  for (let i = 0; i < 6; i++) {
    const sx = c.mouthX + 1.5 + rnd() * (c.throatX - c.mouthX - 3);
    const sz = c.z + (rnd() - 0.5) * (c.mouthHalf * 1.5);
    spike(rockDark, 0.4 + rnd() * 0.3, 1.6 + rnd() * 1.6, sx, ceilY + 0.2, sz, false);
  }

  // ---- shoulder walls: broken rock stepping the tunnel out into the wide chamber ----
  for (const s of [-1, 1]) {
    const z0 = c.z + s * c.mouthHalf;
    const z1 = c.z + s * c.chamberHalf;
    rockWall('z', z0, z1, c.throatX, c.archH * 0.95);
  }

  // ---- inner chamber: tall broken-rock walls dressing the carved cliffs, each side --
  // Open-topped (no roof) so the chamber stays sky-lit; these face the LOWER cliff and the
  // terrain carve raises the true mountain wall above and behind them.
  rockWall('x', c.throatX, c.backX, zChamS, c.archH);
  rockWall('x', c.throatX, c.backX, zChamN, c.archH);

  // ---- back wall: a broken rock face closing the deep end of the chamber -----------
  rockWall('z', zChamS, zChamN, c.backX, c.archH);
  for (let i = 0; i < 8; i++)
    boulder(
      rock,
      0.9 + rnd() * 0.9,
      c.backX - 1.5 - rnd() * 2.5,
      baseY + 0.5 + rnd() * 0.9,
      c.z + (rnd() - 0.5) * (c.chamberHalf * 1.7),
      rnd,
    );

  // ---- wall ledges: rough rock shelves jutting from the chamber flanks --------------
  for (let i = 0; i < 6; i++) {
    const s = i % 2 === 0 ? 1 : -1;
    const lx = c.throatX + 3 + rnd() * (c.backX - c.throatX - 5);
    const ly = baseY + 2.5 + rnd() * (c.archH * 0.55);
    boulder(rockDark, 1.6 + rnd() * 1.0, lx, ly, c.z + s * (c.chamberHalf - 1.5), rnd);
  }

  // ---- stalagmite columns rising from the chamber floor (some tall pillars) ---------
  for (let i = 0; i < 10; i++) {
    const sx = c.throatX + 1.5 + rnd() * (c.backX - c.throatX - 3);
    const sz = c.z + (rnd() - 0.5) * (c.chamberHalf * 1.7);
    const tall = rnd() < 0.35;
    spike(rock, 0.5 + rnd() * 0.5, tall ? 4 + rnd() * 4 : 1.4 + rnd() * 1.6, sx, baseY, sz, true);
  }

  // ---- boulder rubble scattered through the chamber and mouth -----------------------
  for (let i = 0; i < 18; i++) {
    const bx = c.mouthX + rnd() * (c.backX - c.mouthX);
    const spread = bx < c.throatX ? c.mouthHalf * 1.6 : c.chamberHalf * 1.7;
    const bz = c.z + (rnd() - 0.5) * spread;
    const r = 0.6 + rnd() * 1.1;
    boulder(rnd() < 0.6 ? rock : rockDark, r, bx, baseY + r * 0.55, bz, rnd);
  }

  // ---- bone piles + skull totem: the husks' muster, deep at the back of the chamber -
  const pile = (cx: number, cz: number, bones: number, skulls: number): void => {
    for (let i = 0; i < bones; i++) {
      box(
        bone,
        0.14,
        0.14,
        1.4 + rnd() * 0.8,
        cx + (rnd() - 0.5) * 2.4,
        baseY + 0.14 + rnd() * 0.2,
        cz + (rnd() - 0.5) * 2.4,
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
    const cx = c.backX - 7; // deep in the chamber, short of the back wall
    const cz = c.z;
    pile(cx, cz, 14, 5);
    pile(cx - 6, cz + c.chamberHalf * 0.5, 8, 3); // a second heap off to one side
    pile(cx - 4, cz - c.chamberHalf * 0.5, 6, 2); // and a third
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
    textured: boolean,
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
      surfaceMat({
        color,
        roughness: rough,
        flatShading: true,
        emissive,
        emissiveIntensity,
        map: textured ? (ROCK_TEX ?? undefined) : undefined,
        normalMap: textured ? (ROCK_NRM ?? undefined) : undefined,
      }),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(rock, ROCK, 0.95, true);
  add(rockDark, ROCK_DARK, 0.97, true);
  add(bone, BONE, 0.8, false);
  add(ember, EMBER, 0.6, false, EMBER, 0.9);

  return { group };
}
