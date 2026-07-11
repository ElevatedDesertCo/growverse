import * as THREE from 'three';
import { SLUICE_RIVER, WATER_LEVEL } from '../sim/world';
import { GFX, sharedUniforms } from './gfx';

// The Sluice waterfall: a scrolling water ribbon spilling down the steep east face
// of the western mountain (a carve/raise primitive in sim/world.ts) into the river's
// plunge pool, plus a foam disc where it lands. Procedural (no texture/asset gate):
// the falling sheet and foam are generated in-shader and animate off the one shared
// `sharedUniforms.uTime` clock, so this pays no per-frame CPU and needs no update().
//
// Placement tracks the sim primitives so the visual and the heightfield never drift:
// the ribbon sits just west (toward the mountain) of the river's plunge pool at the
// river centerline z, spanning from the pool waterline up the cliff face.

// Where the ribbon lands: right at the pool waterline, standing just in front of the
// cliff foot so it reads as spilling INTO the pool (not buried in the bank). Sampled at
// z=24: water ends ~x154.7 (h -4.5), then the face shoots up x155->x160 (h -3.3 -> +43).
// Foot at x154.3 keeps the ribbon's base in open water, one step east of the cliff base.
const FALLS_X = SLUICE_RIVER.xWest + 4.3; // ~154.3, foot in the pool at the cliff base
const FALLS_Z = SLUICE_RIVER.z; // river centerline (roughly level)
const FALLS_WIDTH = 8;
const FALLS_TOP = 26; // ribbon crest height above the pool (backed by the +40 cliff)
const FALLS_BOTTOM = WATER_LEVEL - 0.5; // just below the pool surface so it reads as feeding it

export interface WaterfallView {
  meshes: THREE.Mesh[];
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

// A falling curtain: vertical UV scroll for the plunge, layered streaks for the
// braided flow, brighter foam at the crest lip and where it hits the pool.
const SHEET_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWPos;
  #include <common>
  #include <fog_pars_fragment>
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    // vUv.y: 0 at the pool, 1 at the crest. Water falls downward (toward y=0).
    float fall = uTime * 0.9;
    // braided vertical streaks: several columns scrolling down at varied speeds
    float streak = 0.0;
    for (float i = 0.0; i < 4.0; i += 1.0) {
      float col = vUv.x * (6.0 + i * 2.0) + hash(i) * 10.0;
      float speed = 0.7 + hash(i + 3.0) * 0.9;
      float s = sin(col * 3.1416 + (vUv.y * (7.0 + i) - fall * speed) * 6.283);
      streak += smoothstep(0.55, 1.0, s);
    }
    streak = clamp(streak * 0.45, 0.0, 1.0);
    // base body tint: bright blue-white water, whiter (foamier) toward the streaks so
    // it stands out against the sunlit tan cliff behind it rather than washing into it
    vec3 body = mix(vec3(0.60, 0.80, 0.96), vec3(1.02, 1.04, 1.08), streak);
    // crest foam (top) where the water tips over, and plunge foam (bottom)
    float crest = smoothstep(0.80, 1.0, vUv.y);
    float plunge = smoothstep(0.26, 0.0, vUv.y) * (0.6 + 0.4 * sin(uTime * 6.0 + vUv.x * 20.0));
    float foam = clamp(crest + plunge, 0.0, 1.0);
    vec3 col = mix(body, vec3(1.1), foam);
    // taper the ribbon at its vertical edges so it reads as a channel, not a slab
    float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    float alpha = (0.82 + 0.18 * streak + 0.4 * foam) * edge;
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
export function buildWaterfall(): WaterfallView {
  const meshes: THREE.Mesh[] = [];

  // The falling curtain: a vertical plane facing east (-X), toward a player
  // approaching up the river from the pond. Local plane XY -> world (Z width, Y height).
  const sheetGeo = new THREE.PlaneGeometry(FALLS_WIDTH, FALLS_TOP - FALLS_BOTTOM, 1, 12);
  sheetGeo.rotateY(-Math.PI / 2); // normal now points -X (east)
  const sheetMat = new THREE.ShaderMaterial({
    uniforms: { ...fogUniforms(), uTime: sharedUniforms.uTime },
    vertexShader: SHEET_VERT,
    fragmentShader: SHEET_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  const sheet = new THREE.Mesh(sheetGeo, sheetMat);
  sheet.position.set(FALLS_X, (FALLS_TOP + FALLS_BOTTOM) / 2, FALLS_Z);
  meshes.push(sheet);

  // Plunge-pool foam: a flat disc lying on the water where the ribbon lands.
  const foamGeo = new THREE.PlaneGeometry(FALLS_WIDTH + 3, FALLS_WIDTH + 3, 1, 1).rotateX(
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
  foam.position.set(FALLS_X - 3, WATER_LEVEL + 0.06, FALLS_Z);
  meshes.push(foam);

  // On the low tier keep only the ribbon (drop the extra pool-foam draw).
  return { meshes: GFX.standardMaterials ? meshes : [sheet] };
}
