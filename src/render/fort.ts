import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SKELETON_FORT, terrainHeight } from '../sim/world';
import { surfaceMat } from './gfx';

// The Skeleton Grotto fort: a huge ruined stone stronghold raised on the flat grotto
// floor (the `SKELETON_FORT` primitive in sim/world.ts), where the Wither Husk host
// musters. This module skins that ONE const: a square curtain wall with a crenellated
// walk, a round corner tower under a conical roof at each angle, a tall crenellated keep
// with a peaked roof and a tattered banner at the center, a FRONT gatehouse on the low-x
// (grotto mouth) side, and a REAR sally-port on the high-x side lined up with the crypt
// cave-mouth. The colliders (colliders.ts) derive their wall segments, towers, and keep
// from the SAME const with the same arithmetic, so what you see is what you bump.
//
// All geometry is static and merged per material into a handful of meshes (one draw call
// each), built once. Every surface is seated off a single `baseY` sampled from
// terrainHeight at the fort center, which is the dead-flat grotto floor, so the fort sits
// flush on the ground the sim walks on.

export interface FortView {
  group: THREE.Group;
}

const STONE = 0x8a8378; // weathered grey curtain stone
const STONE_DARK = 0x6f6a61; // shadowed lower courses / keep
const ROOF = 0x3f3a33; // slate-dark conical + peaked roofs
const WOOD = 0x4a3722; // gate leaves, portcullis, banner pole
const BANNER = 0x6d1f24; // deep blood-red tattered banner

// Push a box of size (w,h,d) centered at (x,y,z), yawed by rot, into `list`.
function box(
  list: THREE.BufferGeometry[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rot = 0,
): void {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationY(rot));
  g.translate(x, y, z);
  list.push(g);
}

// Push an upright cylinder (radius r, height h) centered on (x,z) with its base at baseY.
function cyl(
  list: THREE.BufferGeometry[],
  r: number,
  h: number,
  x: number,
  baseY: number,
  z: number,
  sides = 12,
): void {
  const g = new THREE.CylinderGeometry(r, r, h, sides);
  g.translate(x, baseY + h / 2, z);
  list.push(g);
}

// Push a cone (radius r, height h) with its base at y=baseTop, optionally yawed (for a
// square pyramid, pass sides=4 and rot=Math.PI/4 so its faces align to the walls).
function cone(
  list: THREE.BufferGeometry[],
  r: number,
  h: number,
  x: number,
  baseTop: number,
  z: number,
  sides = 12,
  rot = 0,
): void {
  const g = new THREE.ConeGeometry(r, h, sides);
  if (rot) g.applyMatrix4(new THREE.Matrix4().makeRotationY(rot));
  g.translate(x, baseTop + h / 2, z);
  list.push(g);
}

// Lay a row of merlons (crenellation teeth) along a straight wall top, from world point
// (x1,z1) to (x2,z2), skipping any [gapLo,gapHi] span given along the run axis. `axis`
// is which world axis the wall runs along ('x' or 'z').
function merlons(
  list: THREE.BufferGeometry[],
  f: typeof SKELETON_FORT,
  topY: number,
  axis: 'x' | 'z',
  fixed: number, // the constant coordinate (z for an x-run wall, x for a z-run wall)
  lo: number,
  hi: number,
  gap?: [number, number],
): void {
  const merlonW = 0.9;
  const step = 1.8; // tooth + embrasure
  const thick = f.wallHalfThick * 2 + 0.1;
  const h = f.merlonH;
  const y = topY + h / 2;
  for (let p = lo + step / 2; p <= hi - step / 2 + 1e-6; p += step) {
    if (gap && p > gap[0] - merlonW && p < gap[1] + merlonW) continue;
    if (axis === 'x') box(list, merlonW, h, thick, p, y, fixed);
    else box(list, thick, h, merlonW, fixed, y, p);
  }
}

export function buildFort(seed: number): FortView {
  const f = SKELETON_FORT;
  const group = new THREE.Group();
  const baseY = terrainHeight(f.x, f.z, seed); // the flat grotto floor

  const stone: THREE.BufferGeometry[] = [];
  const stoneDark: THREE.BufferGeometry[] = [];
  const roof: THREE.BufferGeometry[] = [];
  const wood: THREE.BufferGeometry[] = [];
  const cloth: THREE.BufferGeometry[] = [];

  const wallTop = baseY + f.wallH;
  const th = f.wallHalfThick * 2; // wall thickness
  const xW = f.x - f.half; // low-x (front / gate) wall
  const xE = f.x + f.half; // high-x (rear / sally) wall
  const zS = f.z - f.half; // low-z (south) wall
  const zN = f.z + f.half; // high-z (north) wall

  // Front (low-x) wall gate gap and rear (high-x) sally gap, both centered on z=f.z.
  const gateLo = f.z - f.gateHalf;
  const gateHi = f.z + f.gateHalf;
  const sallyLo = f.z - f.sallyHalf;
  const sallyHi = f.z + f.sallyHalf;

  // ---- curtain walls (solid stone boxes, corner to corner) ---------------------
  // South and north walls run full length along x (no gaps).
  box(stone, f.half * 2 + th, f.wallH, th, f.x, baseY + f.wallH / 2, zS);
  box(stone, f.half * 2 + th, f.wallH, th, f.x, baseY + f.wallH / 2, zN);
  // Front (low-x) wall: two z-segments flanking the gate gap.
  const frontSegS = (zS + gateLo) / 2;
  const frontSegN = (zN + gateHi) / 2;
  box(stone, th, f.wallH, gateLo - zS, xW, baseY + f.wallH / 2, frontSegS);
  box(stone, th, f.wallH, zN - gateHi, xW, baseY + f.wallH / 2, frontSegN);
  // Rear (high-x) wall: two z-segments flanking the sally-port.
  const rearSegS = (zS + sallyLo) / 2;
  const rearSegN = (zN + sallyHi) / 2;
  box(stone, th, f.wallH, sallyLo - zS, xE, baseY + f.wallH / 2, rearSegS);
  box(stone, th, f.wallH, zN - sallyHi, xE, baseY + f.wallH / 2, rearSegN);

  // A darker lower plinth course around the whole square so the base reads grounded.
  const plinthH = 1.4;
  box(stoneDark, f.half * 2 + th + 0.3, plinthH, 0.3, f.x, baseY + plinthH / 2, zS - 0.15);
  box(stoneDark, f.half * 2 + th + 0.3, plinthH, 0.3, f.x, baseY + plinthH / 2, zN + 0.15);
  box(stoneDark, 0.3, plinthH, f.half * 2 + th + 0.3, xW - 0.15, baseY + plinthH / 2, f.z);
  box(stoneDark, 0.3, plinthH, f.half * 2 + th + 0.3, xE + 0.15, baseY + plinthH / 2, f.z);

  // ---- crenellations along every wall walk -------------------------------------
  merlons(stone, f, wallTop, 'x', zS, xW, xE); // south
  merlons(stone, f, wallTop, 'x', zN, xW, xE); // north
  merlons(stone, f, wallTop, 'z', xW, zS, zN, [gateLo, gateHi]); // front, skip gate
  merlons(stone, f, wallTop, 'z', xE, zS, zN, [sallyLo, sallyHi]); // rear, skip sally

  // ---- round corner towers under conical roofs ---------------------------------
  const corners: [number, number][] = [
    [xW, zS],
    [xE, zS],
    [xW, zN],
    [xE, zN],
  ];
  for (const [cx, cz] of corners) {
    cyl(stone, f.towerR, f.towerH, cx, baseY, cz, 14);
    // a merlon ring crowning the tower body
    const ringN = 10;
    for (let i = 0; i < ringN; i++) {
      const a = (i / ringN) * Math.PI * 2;
      const mx = cx + Math.cos(a) * (f.towerR - 0.1);
      const mz = cz + Math.sin(a) * (f.towerR - 0.1);
      box(stone, 0.6, f.merlonH, 0.6, mx, baseY + f.towerH + f.merlonH / 2, mz, a);
    }
    // conical roof, its eaves slightly proud of the tower
    cone(roof, f.towerR + 0.5, 3.2, cx, baseY + f.towerH + f.merlonH, cz, 14);
  }

  // ---- gatehouse: two square towers framing the front gate ---------------------
  const gateTowerH = f.wallH + 2.5;
  for (const gz of [gateLo, gateHi]) {
    box(stone, 2.4, gateTowerH, 2.4, xW, baseY + gateTowerH / 2, gz);
    // small merlons on the gate-tower caps
    for (const dx of [-0.7, 0.7])
      for (const dz of [-0.7, 0.7])
        box(stone, 0.6, f.merlonH, 0.6, xW + dx, baseY + gateTowerH + f.merlonH / 2, gz + dz);
  }
  // gate lintel spanning the two towers, and the twin timber gate leaves beneath it
  box(stone, 2.4, 1.4, f.gateHalf * 2 + 1.0, xW, baseY + gateTowerH - 0.7, f.z);
  for (const side of [-1, 1]) {
    box(
      wood,
      0.5,
      f.wallH - 0.6,
      f.gateHalf - 0.15,
      xW,
      baseY + (f.wallH - 0.6) / 2,
      f.z + side * (f.gateHalf / 2),
    );
  }

  // ---- central keep ------------------------------------------------------------
  const kh = f.keepHalf;
  box(stoneDark, kh * 2, f.keepH, kh * 2, f.x, baseY + f.keepH / 2, f.z);
  // keep crenellations
  merlons(stone, f, baseY + f.keepH, 'x', f.z - kh, f.x - kh, f.x + kh);
  merlons(stone, f, baseY + f.keepH, 'x', f.z + kh, f.x - kh, f.x + kh);
  merlons(stone, f, baseY + f.keepH, 'z', f.x - kh, f.z - kh, f.z + kh);
  merlons(stone, f, baseY + f.keepH, 'z', f.x + kh, f.z - kh, f.z + kh);
  // a square pyramid roof rising from just inside the parapet
  cone(roof, kh * 1.35, 5.5, f.x, baseY + f.keepH + f.merlonH, f.z, 4, Math.PI / 4);
  // banner pole + tattered cloth at the apex
  const apex = baseY + f.keepH + f.merlonH + 5.5;
  cyl(wood, 0.12, 3.0, f.x, apex, f.z, 6);
  box(cloth, 0.08, 2.0, 1.6, f.x + 0.2, apex + 1.6, f.z, 0);

  // ---- merge each material bucket into one mesh --------------------------------
  const add = (bucket: THREE.BufferGeometry[], color: number, rough: number, flat: boolean) => {
    if (bucket.length === 0) return;
    const merged = mergeGeometries(
      bucket.map((g) => g.toNonIndexed()),
      false,
    );
    if (!merged) return;
    merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, surfaceMat({ color, roughness: rough, flatShading: flat }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(stone, STONE, 0.95, true);
  add(stoneDark, STONE_DARK, 0.98, true);
  add(roof, ROOF, 0.9, false);
  add(wood, WOOD, 0.92, false);
  add(cloth, BANNER, 0.85, false);

  return { group };
}
