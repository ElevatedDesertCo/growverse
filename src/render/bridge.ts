import * as THREE from 'three';
import { SLUICE_BRIDGE, terrainHeight } from '../sim/world';
import { surfaceMat } from './gfx';

// The Sluice footbridge: a stone skin laid over the raised terrain causeway that
// `terrainHeight` builds (the `SLUICE_BRIDGE` primitive in sim/world.ts). The deck
// you walk on is the terrain; this module only DRESSES it as masonry, so it samples
// the same `terrainHeight` and floats a hair above it (no second floor). Parapet
// rails match the two OBB colliders in sim/colliders.ts (same const), so the wall
// you see is the wall you bump. Static geometry, no per-frame work.

const DECK_LIFT = 0.07; // sit the stone slab just above the terrain deck
const DECK_INSET = 0.05; // pull the slab edge a touch inside the terrain taper
const RAIL_HEIGHT = 0.72; // parapet top above the deck
const RAIL_THICK = 0.34; // parapet thickness across x
const RAIL_SINK = 0.12; // embed the rail base below the deck so no gap shows
const DECK_SEGMENTS = 48; // z resolution along the span (follows the arch)
const DECK_COLOR = 0xb89b6f; // mid sandstone, matches village:Stone
const RAIL_COLOR = 0x8f7550; // shadowed mud-brick, matches village:Stone_Dark

export interface BridgeView {
  group: THREE.Group;
}

// A stone wall running along z at a fixed x, its base/top following the terrain
// deck. Cross-section is a rectangle in x-y (thickness `thick`, height above the
// terrain `height`); returns the two side faces + a top cap + two end caps.
function buildRail(
  seed: number,
  xCenter: number,
  height: number,
  thick: number,
): THREE.BufferGeometry {
  const b = SLUICE_BRIDGE;
  const zStart = b.z - (b.halfSpan - 0.5);
  const zEnd = b.z + (b.halfSpan - 0.5);
  const segs = DECK_SEGMENTS;
  const x0 = xCenter - thick / 2;
  const x1 = xCenter + thick / 2;
  const positions: number[] = [];
  const indices: number[] = [];
  // For each z ring we store 4 corner vertices: [innerBottom, innerTop, outerTop, outerBottom].
  for (let i = 0; i <= segs; i++) {
    const z = zStart + ((zEnd - zStart) * i) / segs;
    const deckY = terrainHeight(xCenter, z, seed);
    const baseY = deckY - RAIL_SINK;
    const topY = deckY + height;
    positions.push(x0, baseY, z); // 0 inner bottom
    positions.push(x0, topY, z); // 1 inner top
    positions.push(x1, topY, z); // 2 outer top
    positions.push(x1, baseY, z); // 3 outer bottom
  }
  const ring = (i: number) => i * 4;
  for (let i = 0; i < segs; i++) {
    const a = ring(i);
    const c = ring(i + 1);
    // inner face (x0): a0->a1->c1->c0
    indices.push(a + 0, a + 1, c + 1, a + 0, c + 1, c + 0);
    // top face: a1->a2->c2->c1
    indices.push(a + 1, a + 2, c + 2, a + 1, c + 2, c + 1);
    // outer face (x1): a2->a3->c3->c2
    indices.push(a + 2, a + 3, c + 3, a + 2, c + 3, c + 2);
  }
  // end caps (rectangles at first/last ring)
  const last = ring(segs);
  indices.push(0, 3, 2, 0, 2, 1); // start cap
  indices.push(last + 0, last + 1, last + 2, last + 0, last + 2, last + 3); // end cap
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// The deck slab: a grid draped over the raised causeway, lifted just above the
// terrain so the stone reads over the grass/dirt splat the terrain would show.
function buildDeck(seed: number): THREE.BufferGeometry {
  const b = SLUICE_BRIDGE;
  const zStart = b.z - b.halfSpan;
  const zEnd = b.z + b.halfSpan;
  const deckHalf = b.halfWidth - DECK_INSET;
  const nz = DECK_SEGMENTS;
  const nx = 4;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= nz; i++) {
    const z = zStart + ((zEnd - zStart) * i) / nz;
    for (let j = 0; j <= nx; j++) {
      const x = b.x - deckHalf + (2 * deckHalf * j) / nx;
      const y = terrainHeight(x, z, seed) + DECK_LIFT;
      positions.push(x, y, z);
    }
  }
  const row = nx + 1;
  for (let i = 0; i < nz; i++) {
    for (let j = 0; j < nx; j++) {
      const a = i * row + j;
      const c = (i + 1) * row + j;
      indices.push(a, a + 1, c + 1, a, c + 1, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildBridge(seed: number): BridgeView {
  const group = new THREE.Group();
  const b = SLUICE_BRIDGE;

  const deckMat = surfaceMat({ color: DECK_COLOR, roughness: 0.94 });
  const deck = new THREE.Mesh(buildDeck(seed), deckMat);
  group.add(deck);

  const railMat = surfaceMat({ color: RAIL_COLOR, roughness: 0.92 });
  const railX = b.halfWidth - RAIL_THICK / 2; // hug the deck edge, inside the drop
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(
      buildRail(seed, b.x + side * railX, RAIL_HEIGHT, RAIL_THICK),
      railMat,
    );
    group.add(rail);
  }

  return { group };
}
