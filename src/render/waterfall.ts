import * as THREE from 'three';
import { SLUICE_PEAK, SLUICE_RIVER, terrainHeight, WATER_LEVEL } from '../sim/world';
import { GFX, sharedUniforms } from './gfx';

// The Sluice waterfall: a scrolling water ribbon spilling the whole west face of the
// mountain (a carve/raise primitive in sim/world.ts) into the river's plunge pool,
// plus a foam disc where it lands. Procedural (no texture/asset gate): the falling
// sheet and foam are generated in-shader and animate off the one shared
// `sharedUniforms.uTime` clock, so this pays no per-frame CPU and needs no update().
//
// The face is CONCAVE (steep at the foot, laying back toward the rounded summit), so
// a flat plane can only cover the lower third before it would punch into the rock.
// Instead the ribbon is a curved curtain whose spine SAMPLES the real terrain profile
// (`terrainHeight`) from the pool up to just below the summit and floats a hair off
// the face along its outward normal, so the sheet hugs the whole escarpment and its
// crest actually reaches the top of the mountain.

const FALLS_WIDTH_BASE = 9; // spreads at the plunge
const FALLS_WIDTH_TOP = 5; // narrower at the crest lip
const FALLS_BOTTOM = WATER_LEVEL - 0.5; // just below the pool surface so it feeds it
const FALLS_FRONT = 0.7; // how far the sheet floats off the rock, along the face normal
const CREST_BELOW_SUMMIT = 4; // stop a touch below the rounded top

export interface WaterfallView {
  meshes: THREE.Mesh[];
}

// Ordered points up the mountain's west face at the river centerline, from the
// waterline to just below the summit. Increasing in both x and height.
function faceProfile(seed: number): { x: number; y: number }[] {
  const z = SLUICE_RIVER.z;
  const topY = terrainHeight(SLUICE_PEAK.x, z, seed) - CREST_BELOW_SUMMIT;
  const pts: { x: number; y: number }[] = [];
  for (let x = SLUICE_RIVER.xWest - 2; x <= SLUICE_PEAK.x; x += 0.25) {
    const y = terrainHeight(x, z, seed);
    if (y < FALLS_BOTTOM) continue; // still under the pool
    pts.push({ x, y });
    if (y >= topY) break; // reached the crest
  }
  return pts;
}

// A curved curtain hugging the face: two vertices per profile point, offset off the
// rock along the local outward normal, tapering narrower toward the crest.
function buildRibbonGeo(seed: number): { geo: THREE.BufferGeometry; footX: number } {
  const z = SLUICE_RIVER.z;
  const pts = faceProfile(seed);
  const n = pts.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    // outward normal (toward the viewer, -x side of the up-going tangent)
    const nx = -ty;
    const ny = tx;
    const px = p.x + nx * FALLS_FRONT;
    const py = p.y + ny * FALLS_FRONT;
    const v = n > 1 ? i / (n - 1) : 0; // 0 pool .. 1 crest
    const halfW = (FALLS_WIDTH_BASE + (FALLS_WIDTH_TOP - FALLS_WIDTH_BASE) * v) * 0.5;
    pos.push(px, py, z - halfW);
    uv.push(0, v);
    pos.push(px, py, z + halfW);
    uv.push(1, v);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    const c = (i + 1) * 2;
    idx.push(a, a + 1, c + 1, a, c + 1, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, footX: pts.length ? pts[0].x : SLUICE_RIVER.xWest };
}

const SHEET_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWPos;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWPos = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

// A falling curtain: braided vertical streaks scrolling down, a bright foam lip at the
// crest and churn at the plunge, a translucent blue body so the cliff shows faintly
// through the veil rather than a flat white slab.
const SHEET_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWPos;
  #include <common>
  #include <fog_pars_fragment>
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    // vUv.y: 0 at the pool, 1 at the crest. Water falls downward (toward y=0).
    float fall = uTime * 0.95;
    // a gentle sideways sway of the whole sheet as it pours
    float sway = sin(vUv.y * 5.0 - uTime * 0.8) * 0.02;
    float ux = vUv.x + sway;
    // braided vertical strands: several columns scrolling down at varied speeds
    float streak = 0.0;
    float rope = 0.0;
    for (float i = 0.0; i < 5.0; i += 1.0) {
      float col = ux * (7.0 + i * 2.0) + hash(i) * 10.0;
      float speed = 0.7 + hash(i + 3.0) * 1.0;
      float phase = (vUv.y * (7.0 + i) - fall * speed) * 6.283;
      float s = sin(col * 3.1416 + phase);
      streak += smoothstep(0.5, 1.0, s);
      rope += smoothstep(0.85, 1.0, s); // tighter bright cores
    }
    streak = clamp(streak * 0.4, 0.0, 1.0);
    rope = clamp(rope * 0.5, 0.0, 1.0);
    // translucent blue-white body, brightening along the strands and their cores
    vec3 body = mix(vec3(0.42, 0.66, 0.92), vec3(0.86, 0.95, 1.04), streak);
    body = mix(body, vec3(1.05, 1.07, 1.10), rope);
    // crest foam (top lip) and plunge churn (bottom)
    float crest = smoothstep(0.86, 1.0, vUv.y);
    float plunge = smoothstep(0.22, 0.0, vUv.y) * (0.6 + 0.4 * sin(uTime * 6.0 + vUv.x * 20.0));
    float foam = clamp(crest + plunge, 0.0, 1.0);
    vec3 col = mix(body, vec3(1.12), foam);
    // taper the ribbon at its z-edges so it reads as a channel with soft sides
    float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
    // veil-like: translucent between strands, near-opaque along cores + foam
    float alpha = (0.5 + 0.34 * streak + 0.28 * rope + 0.45 * foam) * edge;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const POOL_FOAM_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWPos;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    // concentric expanding rings of churn where the falls strike the pool
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float rings = sin(r * 14.0 - uTime * 5.0) * 0.5 + 0.5;
    float churn = rings * smoothstep(1.0, 0.2, r);
    float alpha = churn * smoothstep(1.0, 0.55, r) * 0.7;
    gl_FragColor = vec4(vec3(1.02), clamp(alpha, 0.0, 0.85));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function fogUniforms(): Record<string, THREE.IUniform> {
  return THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
}

// Build the falling ribbon + plunge-pool foam. Kept lightweight (two meshes, shared
// uTime) so it is affordable on every tier; on the low water tier it still animates.
export function buildWaterfall(seed: number): WaterfallView {
  const meshes: THREE.Mesh[] = [];

  const { geo, footX } = buildRibbonGeo(seed);
  const sheetMat = new THREE.ShaderMaterial({
    uniforms: { ...fogUniforms(), uTime: sharedUniforms.uTime },
    vertexShader: SHEET_VERT,
    fragmentShader: SHEET_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  // geometry is already in world space (spine sampled from terrain); identity transform
  const sheet = new THREE.Mesh(geo, sheetMat);
  meshes.push(sheet);

  // Plunge-pool foam: a flat disc lying on the water where the ribbon lands.
  const foamGeo = new THREE.PlaneGeometry(FALLS_WIDTH_BASE + 3, FALLS_WIDTH_BASE + 3, 1, 1).rotateX(
    -Math.PI / 2,
  );
  const foamMat = new THREE.ShaderMaterial({
    uniforms: { ...fogUniforms(), uTime: sharedUniforms.uTime },
    vertexShader: SHEET_VERT,
    fragmentShader: POOL_FOAM_FRAG,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  const foam = new THREE.Mesh(foamGeo, foamMat);
  // a step out into the pool (lower x) from the ribbon foot, just above the surface
  foam.position.set(footX - 2.5, WATER_LEVEL + 0.06, SLUICE_RIVER.z);
  meshes.push(foam);

  // On the low tier keep only the ribbon (drop the extra pool-foam draw).
  return { meshes: GFX.standardMaterials ? meshes : [sheet] };
}
