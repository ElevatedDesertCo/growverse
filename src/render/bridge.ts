import * as THREE from 'three';
import { SLUICE_BRIDGE, terrainHeight, WATER_LEVEL } from '../sim/world';
import { surfaceMat } from './gfx';

// The Sluice dam-crossing: a straight beaver-log dam thrown across the river at the
// corridor crossing (the `SLUICE_BRIDGE` primitive in sim/world.ts). The walkable
// crest IS the crossing, the raised causeway terrain, so the deck you walk is the
// deck you see; this module dresses that causeway as a densely woven beaver dam.
// A solid packed-mud core fills the body so nothing shows through, then large and
// medium logs plus small woven branches skin both water faces, tight enough that
// there are no gaps. The crest is a tight corduroy of cross-logs (butted along the
// span, tops flush with the walkable terrain) so the deck you walk reads as one
// continuous, connected surface with no dip or step. Low log curbs sit on the two
// parapet colliders (colliders.ts, same const). Static geometry, built once, no
// per-frame work.

export interface BridgeView {
  group: THREE.Group;
}

const LOG_LIGHT = 0x6f5238;
const LOG_MED = 0x5c4530;
const LOG_DARK = 0x4a3722;
const BRANCH_COLOR = 0x74593c;
// Deep shadow-brown so the packed interior recedes behind the logs and reads as the
// dark voids of a log jam, not a lit earthen berm.
const MUD_COLOR = 0x2a2216;

// Deterministic 0..1 hash so the weave is stable per seed (no Math.random in render).
function h3(a: number, b: number, c: number): number {
  const s = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

// A packed-mud core following the causeway crest: a solid ribbon from below the
// waterline up to the walkable crown, slightly inset from the log faces so any gap
// between logs reveals mud, never sky or water. Rings along z, each a filled quad.
function buildCore(seed: number, baseY: number): THREE.BufferGeometry {
  const b = SLUICE_BRIDGE;
  const zStart = b.z - b.halfSpan;
  const zEnd = b.z + b.halfSpan;
  const half = b.halfWidth - 0.25;
  const segs = 40;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const z = zStart + ((zEnd - zStart) * i) / segs;
    const topY = Math.max(baseY + 0.2, terrainHeight(b.x, z, seed) + 0.05);
    pos.push(b.x - half, baseY, z); // 0 left base
    pos.push(b.x - half, topY, z); // 1 left top
    pos.push(b.x + half, topY, z); // 2 right top
    pos.push(b.x + half, baseY, z); // 3 right base
  }
  const ring = (i: number) => i * 4;
  for (let i = 0; i < segs; i++) {
    const a = ring(i);
    const c = ring(i + 1);
    idx.push(a + 0, a + 1, c + 1, a + 0, c + 1, c + 0); // left face
    idx.push(a + 1, a + 2, c + 2, a + 1, c + 2, c + 1); // top
    idx.push(a + 2, a + 3, c + 3, a + 2, c + 3, c + 2); // right face
  }
  const last = ring(segs);
  idx.push(0, 3, 2, 0, 2, 1); // start cap
  idx.push(last + 0, last + 1, last + 2, last + 0, last + 2, last + 3); // end cap
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// One instanced set of unit cylinders (radius 1, length 1 along local Y) placed by
// a list of matrices; the caller varies size/rotation per instance. One draw call
// for the whole set.
function stickMesh(mats: THREE.Matrix4[], color: number, sides: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(1, 1, 1, sides);
  const mesh = new THREE.InstancedMesh(geo, surfaceMat({ color, roughness: 0.93 }), mats.length);
  for (let i = 0; i < mats.length; i++) mesh.setMatrixAt(i, mats[i]);
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function buildBridge(seed: number): BridgeView {
  const b = SLUICE_BRIDGE;
  const group = new THREE.Group();
  const zStart = b.z - b.halfSpan;
  const zEnd = b.z + b.halfSpan;
  const baseY = WATER_LEVEL - 1.2; // logs/core start well below the waterline

  // ---- packed-mud core (fills the body so no gap shows through) ----------------
  const core = new THREE.Mesh(
    buildCore(seed, baseY),
    surfaceMat({ color: MUD_COLOR, roughness: 1 }),
  );
  group.add(core);

  // Instance buckets, split by material so the weave reads as varied timber.
  const light: THREE.Matrix4[] = [];
  const med: THREE.Matrix4[] = [];
  const dark: THREE.Matrix4[] = [];
  const branch: THREE.Matrix4[] = [];

  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  // Push a cylinder: length `len` along the given world axis ('z' or 'x'), radius
  // `rad`, centred at (x,y,z), with small pitch/yaw tilts for a hand-stacked look.
  const push = (
    arr: THREE.Matrix4[],
    x: number,
    y: number,
    z: number,
    len: number,
    rad: number,
    axis: 'z' | 'x',
    tilt: number,
    yaw: number,
  ) => {
    if (axis === 'z') eul.set(Math.PI / 2 + tilt, yaw, 0);
    else eul.set(0, 0, Math.PI / 2 + tilt);
    q.setFromEuler(eul);
    pos.set(x, y, z);
    scl.set(rad, len, rad);
    arr.push(new THREE.Matrix4().compose(pos, q, scl));
  };

  // ---- the two water faces: dense overlapping courses of big + medium logs ------
  // Rows overlap vertically (rowH < log diameter) so the face is solid timber, and
  // each course is broken into staggered logs along z with jitter so it reads woven.
  // Two staggered course-passes per face (offset half a step in z and half a row in
  // y) so logs overlap tightly with no dirt showing between them.
  const rowH = 0.36;
  for (const side of [-1, 1] as const) {
    for (let pass = 0; pass < 2; pass++) {
      for (let z = zStart + 0.5 + pass * 0.35; z <= zEnd - 0.5; z += 0.7) {
        const crestY = terrainHeight(b.x, z, seed) + 0.05;
        const rows = Math.max(0, Math.round((crestY - baseY) / rowH));
        for (let r = 0; r < rows; r++) {
          const t = rows > 1 ? r / (rows - 1) : 0; // 0 base .. 1 crest
          const y = baseY + r * rowH + rowH * (0.5 + pass * 0.5);
          if (y > crestY) continue;
          // batter: the face leans inward toward the crest (a stable dam profile)
          const faceX = b.x + side * (b.halfWidth + 0.05 - t * 0.7);
          const jz = (h3(z, r + pass * 7, side + 3) - 0.5) * 0.6; // stagger along the course
          const big = h3(z, r, 5) > 0.5;
          const len = big ? 1.6 + h3(z, r, 1) * 0.8 : 1.1 + h3(z, r, 2) * 0.6;
          const rad = big ? 0.36 + h3(z, r, 7) * 0.1 : 0.24 + h3(z, r, 9) * 0.08;
          const tilt = (h3(z, r + pass, 11) - 0.5) * 0.2;
          const yaw = (h3(z, r + pass, 13) - 0.5) * 0.3;
          const bucket = h3(z, r, 15) < 0.34 ? dark : big ? light : med;
          push(bucket, faceX, y, z + jz, len, rad, 'z', tilt, yaw);
        }
      }
    }
  }

  // ---- front-to-back tie logs (along x) lacing the two faces together ----------
  for (let z = zStart + 1.0; z <= zEnd - 1.0; z += 1.5) {
    const crestY = terrainHeight(b.x, z, seed) + 0.05;
    const ties = Math.max(1, Math.round((crestY - baseY) / 1.1));
    for (let k = 0; k < ties; k++) {
      const y = baseY + 0.7 + k * 1.1 + (h3(z, k, 4) - 0.5) * 0.4;
      if (y > crestY - 0.2) continue;
      const rad = 0.19 + h3(z, k, 6) * 0.08;
      push(med, b.x, y, z + (h3(z, k, 8) - 0.5) * 0.7, b.halfWidth * 2.0, rad, 'x', 0, 0);
    }
  }

  // ---- dense woven branches thatched over both faces to kill any remaining gap --
  for (const side of [-1, 1] as const) {
    for (let z = zStart + 0.3; z <= zEnd - 0.3; z += 0.34) {
      const crestY = terrainHeight(b.x, z, seed) + 0.05;
      const span = crestY - baseY;
      if (span <= 0.3) continue;
      const count = Math.max(2, Math.round(span / 0.42));
      for (let k = 0; k < count; k++) {
        const y = baseY + 0.15 + h3(z, k, side + 20) * span;
        const t = (y - baseY) / span;
        const faceX = b.x + side * (b.halfWidth + 0.14 - t * 0.7);
        const yaw = (h3(z, k, 21) - 0.5) * 1.4; // branches criss-cross at all angles
        const tilt = (h3(z, k, 22) - 0.5) * 0.7;
        const len = 0.9 + h3(z, k, 23) * 1.1;
        push(
          branch,
          faceX,
          y,
          z + (h3(z, k, 24) - 0.5) * 0.5,
          len,
          0.08 + h3(z, k, 25) * 0.06,
          'z',
          tilt,
          yaw,
        );
      }
    }
  }

  // ---- the walkable crest: a tight corduroy of cross-logs laid ACROSS the path and
  // butted along z, so the deck reads as ONE continuous, connected surface with no
  // gaps or dips. Every log spans the full deck width and all tops sit at the same
  // small height above the walkable terrain (the arch the player actually walks): the
  // per-log radius varies for a hand-hewn look but the CENTER is dropped by that radius
  // so the tops stay flush course to course. `terrainHeight` gives the arch, so the
  // corduroy hugs the causeway crown and ramps without a step anywhere.
  const CREST_TOP = 0.08; // deck-log tops sit this far proud of the walkable terrain
  const crestLen = b.halfWidth * 2 + 0.7; // overhang the parapets a touch, like a real dam
  for (let z = zStart + 0.35; z <= zEnd - 0.35; z += 0.42) {
    const rad = 0.24 + h3(z, 0, 30) * 0.07;
    const y = terrainHeight(b.x, z, seed) + CREST_TOP - rad; // top stays flush across courses
    const tilt = (h3(z, 0, 32) - 0.5) * 0.04; // barely-there, keeps the surface even
    const bucket = h3(z, 0, 33) < 0.3 ? dark : Math.round(z) % 2 === 0 ? light : med;
    push(bucket, b.x + (h3(z, 0, 34) - 0.5) * 0.12, y, z, crestLen, rad, 'x', tilt, 0);
  }
  // thin runner sticks tucked into the grooves between courses, low enough to stay
  // flush with the deck: they lace the corduroy together without breaking the surface.
  for (const lane of [-1, 1] as const) {
    const cx = b.x + lane * (b.halfWidth * 0.5);
    for (let z = zStart + 0.7; z <= zEnd - 0.5; z += 1.5) {
      const y = terrainHeight(b.x, z, seed) - 0.04;
      push(
        branch,
        cx,
        y,
        z,
        1.4 + h3(z, lane, 41) * 0.5,
        0.11,
        'z',
        0,
        (h3(z, lane, 43) - 0.5) * 0.1,
      );
    }
  }

  // ---- low log curbs on the two parapet colliders (the wall you see == you bump)-
  for (const side of [-1, 1] as const) {
    for (let z = zStart + 0.8; z <= zEnd - 0.4; z += 1.6) {
      const y = terrainHeight(b.x, z, seed) + 0.42;
      push(dark, b.x + side * (b.halfWidth - 0.2), y, z, 1.9, 0.2, 'z', 0, 0);
    }
  }

  group.add(stickMesh(light, LOG_LIGHT, 7));
  group.add(stickMesh(med, LOG_MED, 7));
  group.add(stickMesh(dark, LOG_DARK, 6));
  group.add(stickMesh(branch, BRANCH_COLOR, 5));

  return { group };
}
