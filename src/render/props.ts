import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PROPS, WORLD_MIN_Z } from '../sim/data';
import { hash2 } from '../sim/rng';
import { terrainHeight, WATER_LEVEL } from '../sim/world';
import { loadGltf } from './assets/loader';
import { registerPreload } from './assets/preload';
import { GFX, sharedUniforms, surfaceMat } from './gfx';

// Static world props: buildings, tents, campfires, mines, ruins, docks,
// fences, graveyards — all real CC0 glTF assets (Quaternius medieval village +
// fantasy props, Kenney nature/pirate/graveyard/fantasy-town kits).
//
// Placement comes from the per-zone content modules (merged into PROPS by
// sim/data.ts) — the collider grid uses the same defs, so positions/footprints
// must not move. Each asset is scaled so its VISUAL footprint matches the
// analytic collider footprint (building w×d with the door on local +z, tent
// r=1.5*scale, crate 0.65, campfire 0.85, mud hut 1.1, ruin column 0.6, ...).
//
// Batching: repeated non-hideable kinds (headstones, fence modules, small
// dressing) become InstancedMesh per (asset part × z-band); one-off compositions
// and camera-ghost props stay as groups or are baked into world space and merged
// per (material, z-band). Converted materials are deduped per (kit, name) so
// the merge collapses to a handful of draws. Animated campfire flames + fire
// PointLights stay live objects.

export interface PropsResult {
  group: THREE.Group;
  flames: THREE.Mesh[]; // animated campfire flames
  fireLights: THREE.PointLight[];
  /**
   * Hides merged/instanced prop bands that sit entirely past the fog far plane,
   * and hides any camera-ghost prop crossing the current eye-to-camera segment
   * so the chase cam can pass through props without a wall in view.
   */
  update(
    camX: number,
    camY: number,
    camZ: number,
    eyeX: number,
    eyeY: number,
    eyeZ: number,
    fogFar: number,
  ): void;
}

const MERGE_BAND_DEPTH = GFX.standardMaterials ? 180 : 90;

// ---------------------------------------------------------------------------
// Asset registry — loads kick off at module import; main.ts awaits
// assetsReady() before the Renderer is constructed, so buildProps() can read
// the resolved GLTFs synchronously.
// ---------------------------------------------------------------------------

interface PropAssetDef {
  url: string;
  /** material-dedup namespace (one kit shares flat materials across files) */
  kit: string;
  /** pre-rotation (radians) baked into geometry so the door/opening faces +z */
  yaw?: number;
  /** drop parts whose material name matches (e.g. the market cart's awning) */
  strip?: RegExp;
}

const PROP_ASSET_DEFS: Record<string, PropAssetDef> = {
  house1: { url: '/models/props/house_1.glb', kit: 'village' },
  house2: { url: '/models/props/house_2.glb', kit: 'village', yaw: -Math.PI / 2 },
  house3: { url: '/models/props/house_3.glb', kit: 'village' },
  blacksmith: { url: '/models/props/blacksmith.glb', kit: 'village' },
  inn: { url: '/models/props/inn.glb', kit: 'village' },
  bellTower: { url: '/models/props/bell_tower.glb', kit: 'village' },
  well: { url: '/models/props/well.glb', kit: 'village' },
  fence: { url: '/models/props/fence.glb', kit: 'village' },
  bonfire: { url: '/models/props/bonfire.glb', kit: 'village' },
  oreRocks: { url: '/models/props/ore_rocks.glb', kit: 'ore' },
  tentOpen: { url: '/models/props/tent_open.glb', kit: 'tent', yaw: Math.PI },
  tentSmall: { url: '/models/props/tent_small.glb', kit: 'tent', yaw: Math.PI },
  rockTallA: { url: '/models/props/rock_tall_a.glb', kit: 'minerock' },
  rockTallH: { url: '/models/props/rock_tall_h.glb', kit: 'minerock' },
  rockLargeD: { url: '/models/props/rock_large_d.glb', kit: 'minerock' },
  rockLargeF: { url: '/models/props/rock_large_f.glb', kit: 'minerock' },
  mushroomRed: { url: '/models/props/mushroom_red.glb', kit: 'shroom' },
  mushroomTan: { url: '/models/props/mushroom_tan.glb', kit: 'shroom' },
  rowboat: { url: '/models/props/rowboat.glb', kit: 'pirate' },
  timberPillar: { url: '/models/props/timber_pillar.glb', kit: 'town' },
  crateWooden: { url: '/models/props/crate_wooden.glb', kit: 'qprops' },
  farmCrate: { url: '/models/props/farmcrate_apple.glb', kit: 'qprops' },
  barrel: { url: '/models/props/barrel.glb', kit: 'qprops' },
  anvil: { url: '/models/props/anvil.glb', kit: 'qprops' },
  weaponStand: { url: '/models/props/weapon_stand.glb', kit: 'qprops' },
  lanternWall: { url: '/models/props/lantern_wall.glb', kit: 'qprops' },
  // Meshy-generated portal door used as the overworld Reliquary Hill marker;
  // has its own backing slab so the animated shader plane sits on the front face.
  // yaw: Math.PI if the model loads backwards after inspecting in-game.
  delveEntrance2: { url: '/models/dungeon/delve_entrance_2.glb', kit: 'dungeon' },
  // Meshy-generated Elevated Obelisk: a tall stone waystone marking a settlement
  // or rift site (see PROPS.obelisks). Its own kit so its stone shares no material
  // with the CC0 village set.
  obelisk: { url: '/models/props/elevated_obelisk.glb', kit: 'obelisk' },
  // Meshy-generated Ropebound Spiked Stakes: a lashed cluster of sharpened stakes
  // used as an Ashen Maw perimeter barricade (see PROPS.spikeBarricades). Its own
  // kit so the raider timber shares no material with the CC0 village/tent sets.
  spikedStakes: { url: '/models/props/ashen_spiked_stakes.glb', kit: 'ashencamp' },
};

type PropKey = keyof typeof PROP_ASSET_DEFS;

const loadedProps = new Map<string, GLTF>();
const ALL_PROP_KEYS = Object.keys(PROP_ASSET_DEFS) as PropKey[];

// The props the renderer actually RENDERS at the low graphics tier: a subset, since
// low gfx drops the decorative/secondary props (anvils, extra rocks, statues, ...);
// procedural props like the graveyards shed their own detail on low. Medium and
// higher render every entry in
// PROP_ASSET_DEFS. This list scopes ONLY the per-tier work (material prewarm); it is
// deliberately NOT the preload set (see preloadPropKeys below).
const LOW_TIER_PROP_KEYS: readonly PropKey[] = [
  'house1',
  'house2',
  'house3',
  'blacksmith',
  'inn',
  'bellTower',
  'well',
  'fence',
  'bonfire',
  'oreRocks',
  'tentOpen',
  'tentSmall',
  'rockLargeD',
  'mushroomRed',
  'rowboat',
  'timberPillar',
  'crateWooden',
  'barrel',
  'delveEntrance2', // delve entrance portal, a landmark, so keep it on low gfx too
  'obelisk', // waystone landmark, keep it visible on low gfx too
];

/**
 * The props to PRELOAD, given the graphics tier guessed when this module was first
 * imported. This MUST be tier-INDEPENDENT.
 *
 * buildProps() places props from the LIVE GFX tier, which is resolved later: the
 * Renderer calls initGfxTier() (which reassigns the GFX global from the real WebGL
 * context) AFTER this module froze its import-time GFX best-guess. If the import-time
 * guess comes in LOWER than the render tier (e.g. a weak/hybrid-GPU probe guesses low,
 * the high-performance renderer then resolves medium+), a tier-SCOPED preload set
 * would omit props that buildProps then places, and propAsset() throws "prop asset
 * not preloaded", the v0.16.0 farmCrate crash on world entry (red "Could not start
 * the renderer" overlay). So every tier preloads the full PROP_ASSET_DEFS, mirroring
 * foliage.ts, which sources its one frozen MODEL_URLS list for both preload and
 * placement and is structurally immune to this class of bug. Because every placement
 * key is typed PropKey (a key of PROP_ASSET_DEFS), the full set is provably a superset
 * of anything buildProps can place, on every tier and device.
 *
 * The arg is retained to document the invariant and to let the guard test assert it at
 * the lowest (most dangerous) import tier; the result intentionally ignores it.
 */
function preloadPropKeys(_importTierStandardMaterials: boolean): Set<PropKey> {
  return new Set<PropKey>(ALL_PROP_KEYS);
}

// Headless sim/test imports never fetch; the browser kicks loads immediately.
if (typeof window !== 'undefined') {
  const preloadKeys = preloadPropKeys(GFX.standardMaterials);
  for (const [key, def] of Object.entries(PROP_ASSET_DEFS)) {
    if (!preloadKeys.has(key as PropKey)) continue;
    registerPreload(
      loadGltf(def.url).then((gltf) => {
        loadedProps.set(key, gltf);
      }),
    );
  }
}

/** Test-only window into the preload/prewarm key sets (see tests/render_asset_preload). */
export const propPreloadInternalsForTest = {
  allPropKeys: ALL_PROP_KEYS,
  lowTierPropKeys: LOW_TIER_PROP_KEYS,
  preloadPropKeys,
};

// Per-material look overrides, keyed `${kit}:${name}` (falls back to name).
// Kenney/Quaternius flat materials need small nudges to sit in our lighting.
const MAT_OVERRIDES: Record<
  string,
  {
    color?: number;
    emissive?: number;
    emissiveIntensity?: number;
    metalness?: number;
    roughness?: number;
    // drop the source colormap so `color` paints flat, for Kenney palette-atlas
    // kits whose swatch is too saturated to retint by multiply (e.g. the pirate
    // dock's bright-orange plank cell). The colormap carries no grain detail, so
    // nothing is lost but the swatch hue.
    noMap?: boolean;
  }
> = {
  'village:Windows': { emissive: 0x2a3c55, emissiveIntensity: 1.1, roughness: 0.4 },
  'village:Bell': { metalness: 0.6, roughness: 0.35 },
  // Bloomhaven desert-settlement regrade: the CC0 village kit ships as a cool
  // grey-green-slate medieval hamlet (reads as vanilla WoCC). Regrade the whole
  // shared kit to a sun-baked adobe town, warm clay roofs, sandstone masonry,
  // bleached timber, so the starter town is unmistakably a desert place. Keyed
  // by material name, so it recolors every village-kit prop game-wide (on brand:
  // Growverse is one desert world).
  'village:RoofTiles': { color: 0xbf7446, roughness: 0.95 }, // grey-green slate -> baked clay
  'village:RoofTiles_Red': { color: 0xa85a34, roughness: 0.95 }, // unify onto deep terracotta
  'village:Plaster': { color: 0xdcc6a0, roughness: 0.96 }, // cream stucco -> pale adobe
  'village:Stone_Light': { color: 0xcdb488, roughness: 0.92 }, // pale sandstone
  'village:Stone': { color: 0xb89b6f, roughness: 0.92 }, // mid sandstone
  'village:Stone_Dark': { color: 0x8f7550, roughness: 0.92 }, // shadowed mud-brick
  'village:Wood': { color: 0x8a6a45, roughness: 0.9 }, // weathered desert timber
  'village:Wood_Light': { color: 0xb2946a, roughness: 0.9 }, // sun-bleached wood
  'village:Wood_Side': { color: 0x9c7d54, roughness: 0.9 },
  'village:DarkWood': { color: 0x6f5637, roughness: 0.9 },
  'village:Beige': { color: 0xd8c39a, roughness: 0.9 }, // warm sand cloth/trim
  'ore:Stone_Dark': { color: 0xb87333, metalness: 0.45, roughness: 0.5 },
  // bandit/cult tents: weathered canvas instead of Kenney's toy red
  'tent:colorRed': { color: 0x9c8662 },
  'tent:colorRedDark': { color: 0x6e5c42 },
  // murloc huts: a giant mushroom recolored to read as a woven thatch dome
  'shroom:colorRed': { color: 0xb29459 },
  'shroom:_defaultMat': { color: 0xc9b896 },
  // mine mound: Kenney nature rocks are beige dirt + teal grass — regrade to
  // granite with a dull moss cap so the pile reads as blasted rock
  'minerock:dirt': { color: 0x82868a },
  'minerock:grass': { color: 0x77846a },
  'minerock:_defaultMat': { color: 0x6f7376 },
  // Elevated Obelisk ships materialless (GLTFLoader's white default): grade it to
  // weathered desert sandstone so the waystone reads as carved stone, not plastic.
  'obelisk:': { color: 0xc2a878, roughness: 0.82, metalness: 0 },
  // pirate-kit rowboat ships a salmon/orange palette-atlas swatch that clashes with
  // Bloomhaven's weathered timber; drop the atlas and paint the boat flat on the same
  // warm bleached-wood tone as the village Wood override. (The dock deck is procedural,
  // so this now only touches the moored rowboat.)
  'pirate:colormap': { color: 0x8a6a45, roughness: 0.9, metalness: 0, noMap: true },
};

// ---------------------------------------------------------------------------
// Extraction: GLTF scene -> world-baked float-attribute geometry + converted
// shared materials. Geometries are CLONES — the cached GLTF stays pristine
// for any other consumer, and the static merge may freely dispose ours.
// ---------------------------------------------------------------------------

interface AssetPart {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}
interface PropAsset {
  parts: AssetPart[];
  size: THREE.Vector3;
}

const extractCache = new Map<string, PropAsset>();
const matConvCache = new Map<string, THREE.Material>();

/** denormalized float copy — meshopt/quantized attrs must not be transformed in place */
function toFloatAttr(
  attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  itemSize: number,
): THREE.BufferAttribute {
  const out = new Float32Array(attr.count * itemSize);
  for (let i = 0; i < attr.count; i++) {
    out[i * itemSize] = attr.getX(i);
    if (itemSize > 1) out[i * itemSize + 1] = attr.getY(i);
    if (itemSize > 2) out[i * itemSize + 2] = attr.getZ(i);
  }
  return new THREE.BufferAttribute(out, itemSize);
}

function convertMaterial(
  src: THREE.Material,
  kit: string,
  hasVertexColors: boolean,
): THREE.Material {
  const s = src as THREE.MeshStandardMaterial; // basic (unlit) shares the fields we read
  const ov = MAT_OVERRIDES[`${kit}:${s.name}`] ?? MAT_OVERRIDES[s.name];
  // hasVertexColors must key the cache: kits share material names between
  // COLOR_0 meshes (trim 'Vertex' props) and colorless ones — a shared
  // vertexColors:true material would render the colorless meshes black
  const key = `${kit}|${s.name}|${s.color?.getHexString() ?? ''}|${s.map ? 'm' : ''}|${hasVertexColors ? 'v' : ''}|${GFX.standardMaterials ? 's' : 'l'}`;
  const cached = matConvCache.get(key);
  if (cached) return cached;
  const color =
    ov?.color !== undefined
      ? new THREE.Color(ov.color)
      : (s.color?.clone() ?? new THREE.Color(0xffffff));
  const map = ov?.noMap ? null : (s.map ?? null);
  let mat: THREE.Material;
  if (GFX.standardMaterials) {
    mat = new THREE.MeshStandardMaterial({
      color,
      map,
      vertexColors: hasVertexColors,
      normalMap: s.normalMap ?? null,
      roughnessMap: s.roughnessMap ?? null,
      metalnessMap: s.metalnessMap ?? null,
      aoMap: s.aoMap ?? null,
      roughness: ov?.roughness ?? (s.isMeshStandardMaterial ? s.roughness : 0.9),
      metalness: ov?.metalness ?? (s.isMeshStandardMaterial ? Math.min(s.metalness, 0.85) : 0),
      emissive: new THREE.Color(ov?.emissive ?? 0x000000),
      emissiveIntensity: ov?.emissiveIntensity ?? 1,
    });
  } else {
    mat = new THREE.MeshLambertMaterial({
      color,
      map,
      vertexColors: hasVertexColors,
      emissive: new THREE.Color(ov?.emissive ?? 0x000000),
      emissiveIntensity: (ov?.emissiveIntensity ?? 1) * 0.6,
    });
  }
  mat.name = `${kit}:${s.name}`;
  matConvCache.set(key, mat);
  return mat;
}

/** parts of a loaded asset, world-baked (incl. yaw), origin centered at the
 *  footprint center with min-y at 0, materials converted + deduped */
function propAsset(key: PropKey): PropAsset {
  const cached = extractCache.get(key);
  if (cached) return cached;
  const def = PROP_ASSET_DEFS[key];
  const gltf = loadedProps.get(key);
  if (!gltf) throw new Error(`prop asset not preloaded: ${key} (${def.url})`);
  gltf.scene.updateMatrixWorld(true);
  const parts: AssetPart[] = [];
  const yawM = def.yaw ? new THREE.Matrix4().makeRotationY(def.yaw) : null;
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const srcMat = mesh.material as THREE.Material;
    if (def.strip?.test(srcMat.name)) return;
    const src = mesh.geometry;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', toFloatAttr(src.getAttribute('position'), 3));
    if (src.getAttribute('normal'))
      geo.setAttribute('normal', toFloatAttr(src.getAttribute('normal'), 3));
    const uv = src.getAttribute('uv');
    geo.setAttribute(
      'uv',
      uv
        ? toFloatAttr(uv, 2)
        : new THREE.BufferAttribute(
            new Float32Array((src.getAttribute('position') as THREE.BufferAttribute).count * 2),
            2,
          ),
    );
    // authored vertex tints (trim-kit 'Vertex' materials depend on them);
    // toFloatAttr denormalizes the uint8 COLOR_0, alpha is 1.0 kit-wide
    const col = src.getAttribute('color');
    if (col) geo.setAttribute('color', toFloatAttr(col, 3));
    if (src.index) geo.setIndex(src.index.clone());
    geo.applyMatrix4(mesh.matrixWorld);
    if (yawM) geo.applyMatrix4(yawM);
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    parts.push({ geo, mat: convertMaterial(srcMat, def.kit, !!col) });
  });
  if (!parts.length) throw new Error(`prop asset has no meshes: ${key}`);
  // normalize origin: xz-center at 0, base at y=0
  const box = new THREE.Box3();
  for (const p of parts) {
    p.geo.computeBoundingBox();
    box.union(p.geo.boundingBox as THREE.Box3);
  }
  const cx = (box.min.x + box.max.x) / 2,
    cz = (box.min.z + box.max.z) / 2;
  for (const p of parts) {
    p.geo.translate(-cx, -box.min.y, -cz);
    p.geo.computeBoundingBox();
    p.geo.computeBoundingSphere();
  }
  const asset: PropAsset = { parts, size: box.getSize(new THREE.Vector3()) };
  extractCache.set(key, asset);
  return asset;
}

export function buildPropMaterialPrewarmGroup(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'prop-material-prewarm';
  group.visible = true;
  group.userData.renderCategory = 'prewarm';
  const seen = new Set<string>();
  let idx = 0;
  const instanceMatrix = new THREE.Matrix4();
  const place = (obj: THREE.Object3D): void => {
    const col = idx % 10;
    const row = Math.floor(idx / 10) % 8;
    const layer = Math.floor(idx / 80);
    obj.position.set((col - 4.5) * 1.2, row * 0.85, -8 - layer * 1.5);
    obj.scale.setScalar(0.08);
    obj.frustumCulled = false;
    group.add(obj);
    idx++;
  };
  // castShadow so the depth/shadow program variant compiles too (ultra renders a
  // shadow pass; structures cast shadows live). instanceColor covers the tinted
  // instance variant the way the live placed props do; the plain InstancedMesh
  // and Mesh cover the untinted and non-instanced paths.
  const white = new THREE.Color(1, 1, 1);
  // Prewarm only the props that actually render at the LIVE tier (this runs after
  // initGfxTier via the Renderer, so GFX is authoritative here, unlike the import-time
  // best-guess): low renders the LOW_TIER_PROP_KEYS subset, medium+ renders the full
  // catalog. Keying off the live tier rather than an import-frozen guess means a low
  // import guess on a medium+ renderer still prewarms every prop it will draw, so the
  // props the low subset omits do not take a first-frame shader-compile hitch.
  const prewarmKeys = GFX.standardMaterials ? ALL_PROP_KEYS : LOW_TIER_PROP_KEYS;
  for (const key of prewarmKeys) {
    const asset = propAsset(key);
    for (const part of asset.parts) {
      const matKey = `${part.mat.uuid}:${part.geo.getAttribute('color') ? 'color' : 'plain'}`;
      if (seen.has(matKey)) continue;
      seen.add(matKey);
      const mesh = new THREE.Mesh(part.geo, part.mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      place(mesh);
      const instanced = new THREE.InstancedMesh(part.geo, part.mat, 1);
      instanced.setMatrixAt(0, instanceMatrix.identity());
      instanced.instanceMatrix.needsUpdate = true;
      instanced.castShadow = true;
      instanced.receiveShadow = true;
      place(instanced);
      const tinted = new THREE.InstancedMesh(part.geo, part.mat, 1);
      tinted.setMatrixAt(0, instanceMatrix.identity());
      tinted.setColorAt(0, white);
      tinted.instanceMatrix.needsUpdate = true;
      if (tinted.instanceColor) tinted.instanceColor.needsUpdate = true;
      tinted.castShadow = true;
      tinted.receiveShadow = true;
      place(tinted);
    }
  }
  return group;
}

// ---------------------------------------------------------------------------
// deterministic per-prop rand streams (no native random — placement is shared
// with colliders/tests via the world seed)
// ---------------------------------------------------------------------------

function propRand(x: number, z: number, n: number): number {
  return hash2(Math.round(x * 37), Math.round(z * 37) + n * 7919, 0x517cc1);
}

function keyRand(key: number, n: number): number {
  return hash2(Math.round(key * 97), n * 7919, 0x9e3779);
}

type Scale = number | [number, number, number];

function setScale(o: THREE.Object3D, s: Scale): void {
  if (typeof s === 'number') o.scale.setScalar(s);
  else o.scale.set(s[0], s[1], s[2]);
}

// ---------------------------------------------------------------------------
// Delve-mouth portal: a self-animating red "void" sheet that fills the entrance
// arch, driven by the shared uTime clock (no per-frame JS plumbing, same
// pattern as the Drowned-Temple water in dungeon.ts). A churning swirl + a
// global breathing pulse take a deep near-black red up to a hot bright red; the
// circular alpha mask hides the plane's rectangular edges so it reads as a glowing
// mouth. On the composer tiers the hot core is pushed past 1.0 (uHdr) so it
// blooms; on low/headless (no composer) the colour stays saturated so it still
// reads without bloom.
// ---------------------------------------------------------------------------
const DELVE_PORTAL_VERT = /* glsl */ `
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
const DELVE_PORTAL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDim;
  uniform vec3 uBright;
  uniform float uHdr;
  varying vec2 vUv;
  varying vec3 vWPos;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    vec2 p = vUv * 2.0 - 1.0; // centre-origin -1..1
    float r = length(p);

    // spinning vortex: angular phase + time rotates concentric rings inward
    float angle  = atan(p.y, p.x) / (2.0 * PI); // 0..1 around the disc
    float vortex = sin((angle + uTime * 0.10) * PI * 12.0 + r * 10.0 - uTime * 2.0) * 0.5 + 0.5;

    // three churning noise layers for organic variation
    float swirl = sin(p.x * 5.0 + uTime * 1.0)
                + sin(p.y * 6.0 - uTime * 0.85)
                + sin((p.x + p.y) * 4.5 + uTime * 0.65);
    float churn = 0.5 + 0.28 * (swirl / 3.0);

    // slow ominous breathing pulse
    float pulse = 0.5 + 0.5 * sin(uTime * 0.85);

    // hot crimson outer rim (baked, distinct from the purple mid-zone)
    vec3 rimCol = vec3(0.85, 0.04, 0.10) * uHdr;

    // zone blending: void core (uDim) → purple swirl (uBright) → crimson rim
    float toPurple  = smoothstep(0.06, 0.55, r);
    float toCrimson = smoothstep(0.45, 0.85, r);
    float ringEnergy = vortex * churn * smoothstep(0.90, 0.05, r);

    vec3 col = uDim;
    col = mix(col, uBright, toPurple  * (0.55 + 0.45 * ringEnergy));
    col = mix(col, rimCol,  toCrimson * (0.45 + 0.55 * pulse));
    col += uBright * smoothstep(0.28, 0.0, r) * 0.6 * uHdr; // purple core bloom

    // fill the whole opening as a dark solid portal; feather only the outer rim
    vec2 e = abs(p);
    float fill = (1.0 - smoothstep(0.76, 1.0, e.x)) * (1.0 - smoothstep(0.76, 1.0, e.y));
    float alpha = fill * (0.93 + 0.07 * pulse);

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

let delvePortalMat: THREE.ShaderMaterial | null = null;
function delvePortalMaterial(): THREE.ShaderMaterial {
  if (delvePortalMat) return delvePortalMat;
  delvePortalMat = new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: sharedUniforms.uTime,
      uDim: { value: new THREE.Color(0x03000a) }, // near-void purple-black core
      uBright: { value: new THREE.Color(0x6e0a85) }, // deep purple swirl
      uHdr: { value: GFX.composer ? 2.8 : 1.0 },
    },
    vertexShader: DELVE_PORTAL_VERT,
    fragmentShader: DELVE_PORTAL_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide, // only the town-facing front glows; the dark vault sits behind it
    fog: true,
  });
  return delvePortalMat;
}

// Embers drifting up out of the delve mouth, a deterministic point cloud whose
// whole motion (rise + sideways waver + life fade) is a function of uTime, so it
// self-animates with no per-frame JS. Additive + HDR-boosted so it glows and
// blooms on composer tiers; reads as warm sparks on low too.
const DELVE_EMBER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uRise;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aDrift;
  varying float vLife;
  void main() {
    float t = fract(uTime * aSpeed + aPhase); // 0..1 life cycle
    vLife = t;
    vec3 pos = position;
    pos.y += t * uRise;                                  // rise
    pos.x += sin((t + aPhase) * 6.2831) * aDrift;        // lazy sideways waver
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (95.0 / max(-mv.z, 1.0)) * (0.45 + 0.55 * sin(t * 3.14159));
    gl_Position = projectionMatrix * mv;
  }
`;
const DELVE_EMBER_FRAG = /* glsl */ `
  uniform float uHdr;
  varying float vLife;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    float fade = sin(vLife * 3.14159);                   // fade in then out over life
    vec3 col = mix(vec3(1.0, 0.16, 0.09), vec3(1.0, 0.5, 0.18), vLife) * uHdr;
    gl_FragColor = vec4(col, soft * fade * 0.85);
  }
`;

function buildDelveEmbers(
  cx: number,
  baseY: number,
  cz: number,
  halfW: number,
  riseY: number,
): THREE.Points {
  const N = GFX.standardMaterials ? 48 : 28; // lighter on low
  const positions = new Float32Array(N * 3);
  const phase = new Float32Array(N);
  const speed = new Float32Array(N);
  const drift = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    positions[i * 3] = (hash2(i * 1.7, cx, 0x656d62) - 0.5) * halfW * 2;
    positions[i * 3 + 1] = hash2(i * 2.3, cz, 0x656d62) * 1.5; // start low in the mouth
    positions[i * 3 + 2] = (hash2(i * 3.1, cx + cz, 0x656d62) - 0.5) * 0.6;
    phase[i] = hash2(i * 4.5, cx, 0x656d62);
    speed[i] = 0.05 + hash2(i * 5.9, cz, 0x656d62) * 0.09;
    drift[i] = 0.3 + hash2(i * 6.7, cx, 0x656d62) * 0.7;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setAttribute('aDrift', new THREE.BufferAttribute(drift, 1));
  // motion happens in the shader, so bound it manually or it culls at rest
  geo.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, riseY / 2, 0),
    Math.max(halfW, riseY) + 1.5,
  );
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: sharedUniforms.uTime,
      uRise: { value: riseY },
      uHdr: { value: GFX.composer ? 2.0 : 1.0 },
    },
    vertexShader: DELVE_EMBER_VERT,
    fragmentShader: DELVE_EMBER_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.position.set(cx, baseY, cz);
  pts.renderOrder = 4; // over the void + vault
  return pts;
}

// The Baked Beaver mascot: an absurdly huge beaver built from static primitives.
// Buck teeth, paddle tail, and galaxy-blue glowing eyes that match the Baked Beaver
// signature (0x5b6ee1, passed in as `glowMat` so the caller controls tier intensity).
// Returned centred at local origin with its feet near y=0 and its face toward local
// +z; the caller positions/rotates/scales it. Shared by the dam-crest perch and the
// standalone town-edge landmark, so the mascot reads identically everywhere. `faceZ`
// nudges the whole beaver forward (the dam uses it for the crest's downstream lean).
export function buildBeaverMascot(glowMat: THREE.Material, faceZ = 0): THREE.Group {
  const furMat = surfaceMat({ color: 0x6a4a30, roughness: 1 });
  const bellyMat = surfaceMat({ color: 0xa8895f, roughness: 1 });
  const tailMat = surfaceMat({ color: 0x3e2c1c, roughness: 0.95 });
  const toothMat = surfaceMat({ color: 0xf2ecd8, roughness: 0.7 });
  const noseMat = surfaceMat({ color: 0x2a1c12, roughness: 0.85 });
  const bv = new THREE.Group();
  const crestZ = faceZ;
  // seated body: a chonky ellipsoid
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.55, 14, 12), furMat);
  body.scale.set(1.05, 1.3, 0.95);
  body.position.set(0, 1.6, crestZ);
  bv.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1.02, 12, 10), bellyMat);
  belly.scale.set(1, 1.2, 0.7);
  belly.position.set(0, 1.35, crestZ + 0.85);
  bv.add(belly);
  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.12, 14, 12), furMat);
  head.position.set(0, 3.55, crestZ + 0.35);
  bv.add(head);
  for (const sx of [-0.62, 0.62]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), furMat);
    ear.position.set(sx, 4.5, crestZ + 0.2);
    bv.add(ear);
  }
  // muzzle + nose + buck teeth
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), bellyMat);
  muzzle.scale.set(1.1, 0.85, 0.9);
  muzzle.position.set(0, 3.2, crestZ + 1.25);
  bv.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), noseMat);
  nose.position.set(0, 3.45, crestZ + 1.7);
  bv.add(nose);
  for (const sx of [-0.18, 0.18]) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.14), toothMat);
    tooth.position.set(sx, 2.72, crestZ + 1.55);
    bv.add(tooth);
  }
  // glowing Baked-Beaver-blue eyes
  for (const sx of [-0.44, 0.44]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 8), glowMat);
    eye.position.set(sx, 3.75, crestZ + 1.15);
    bv.add(eye);
  }
  // front paws resting on the belly
  for (const sx of [-0.7, 0.7]) {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), furMat);
    paw.position.set(sx, 1.35, crestZ + 1.15);
    bv.add(paw);
  }
  // flat paddle tail sloping down behind the body
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.24, 2.7), tailMat);
  tail.position.set(0, 0.55, crestZ - 1.35);
  tail.rotation.x = -0.5;
  bv.add(tail);
  return bv;
}

// `delveLabel` resolves a delve id to its localized display name for the carved
// entrance sign. Passed in by renderer.ts (the only render-side i18n surface) so
// props.ts itself stays string-table-free; falls back to the id if absent.
export function buildProps(seed: number, delveLabel?: (delveId: string) => string): PropsResult {
  const group = new THREE.Group();
  const flames: THREE.Mesh[] = [];
  const fireLights: THREE.PointLight[] = [];

  const ground = (x: number, z: number) => terrainHeight(x, z, seed);

  // Camera-ghost props (see colliders.ts `camGhost`) stay individual and
  // un-merged so they can be hidden while the camera ray passes through their
  // footprint. Footprints mirror the colliders so what hides is exactly what
  // the camera passes through.
  const hideables: Hideable[] = [];
  const keepFromMerge = new Set<THREE.Object3D>();
  /**
   * Mark `g` un-mergeable and register it as hide-when-camera-crossed. Each
   * mesh's material is cloned so flipping colour/depth writes hides only this
   * structure (and leaves the shadow pass untouched).
   */
  function registerHideable(g: THREE.Group, fp: Footprint): void {
    const matMap = new Map<THREE.Material, ToggleMat>();
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      keepFromMerge.add(mesh);
      if (lowProps) return;
      const src = mesh.material as THREE.Material;
      let tm = matMap.get(src);
      if (!tm) {
        const mat = src.clone();
        tm = { mat, depthWrite: mat.depthWrite };
        matMap.set(src, tm);
      }
      mesh.material = tm.mat;
    });
    hideables.push({ group: g, mats: [...matMap.values()], hidden: false, ...fp });
  }

  // live small materials (decals / glow) — shared, never per-instance
  const usePbr = GFX.standardMaterials;
  const lowProps = !usePbr;
  const recessMat = surfaceMat({ color: 0x14100b, roughness: 1 });
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const lanternMat = surfaceMat({
    color: 0xffcc66,
    emissive: 0xff9933,
    emissiveIntensity: usePbr ? 2 : 1.2,
    roughness: 0.4,
  });

  // emissive glass / black hole-fillers opt out of shadow casting; shadowed()
  // runs after the builders so a plain `castShadow = false` would be clobbered
  const noShadow = new Set<THREE.Mesh>();
  function shadowed<T extends THREE.Object3D>(o: T): T {
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        (c as THREE.Mesh).castShadow = !noShadow.has(c as THREE.Mesh);
        (c as THREE.Mesh).receiveShadow = true;
      }
    });
    return o;
  }

  /** add one asset's meshes under `parent` with a local transform */
  function addParts(
    parent: THREE.Object3D,
    key: PropKey,
    opts: {
      x?: number;
      y?: number;
      z?: number;
      rot?: number;
      scale: Scale;
      euler?: THREE.Euler;
    },
  ): THREE.Group {
    const a = propAsset(key);
    const holder = new THREE.Group();
    for (const p of a.parts) holder.add(new THREE.Mesh(p.geo, p.mat));
    holder.position.set(opts.x ?? 0, opts.y ?? 0, opts.z ?? 0);
    if (opts.euler) holder.quaternion.setFromEuler(opts.euler);
    else if (opts.rot) holder.rotation.y = opts.rot;
    setScale(holder, opts.scale);
    parent.add(holder);
    return holder;
  }

  // ---- instancing: repeated kinds collect matrices per (asset × z-band) ----
  const instanceBatches = new Map<string, { key: PropKey; mats: THREE.Matrix4[] }>();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3();

  function addInstance(
    key: PropKey,
    x: number,
    y: number,
    z: number,
    rot: THREE.Euler | number,
    scale: Scale,
  ): void {
    tmpPos.set(x, y, z);
    tmpQuat.setFromEuler(typeof rot === 'number' ? new THREE.Euler(0, rot, 0) : rot);
    if (typeof scale === 'number') tmpScale.setScalar(scale);
    else tmpScale.set(scale[0], scale[1], scale[2]);
    const band = Math.floor((z - WORLD_MIN_Z) / MERGE_BAND_DEPTH);
    const bucketKey = `${key}:${band}`;
    let bucket = instanceBatches.get(bucketKey);
    if (!bucket) {
      bucket = { key, mats: [] };
      instanceBatches.set(bucketKey, bucket);
    }
    bucket.mats.push(new THREE.Matrix4().compose(tmpPos, tmpQuat, tmpScale));
  }

  // ---- buildings: village houses / inn / composed chapel ------------------
  const housePool: PropKey[] = ['house1', 'house2', 'blacksmith'];
  const houseHeight: Record<string, number> = {
    house1: 8.0,
    house2: 7.6,
    blacksmith: 6.6,
    inn: 7.6,
  };

  // Seat a building on the LOWEST corner of its footprint, not just its center.
  // The house foundations are flat, so a center-seated house floats on its
  // downhill side over sloped ground (the waterfront outposts). Sampling the
  // four rotated footprint corners and dropping to the minimum keeps the
  // downhill edge flush with the terrain (the uphill edge tucks into the slope)
  // so nothing floats. On the flat town plateau all four corners match, so this
  // is a no-op there. (Local->world uses the three.js rotation.y convention,
  // mirroring pointInsideFootprint / colliders.rotY.)
  const seatGround = (b: (typeof PROPS.buildings)[number]) => {
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const hw = b.w / 2;
    const hd = b.d / 2;
    let lo = Infinity;
    for (const lx of [-hw, hw]) {
      for (const lz of [-hd, hd]) {
        const wx = b.x + lx * c + lz * s;
        const wz = b.z - lx * s + lz * c;
        lo = Math.min(lo, ground(wx, wz));
      }
    }
    return lo;
  };

  for (const b of PROPS.buildings) {
    const key = b.x * 13.7 + b.z * 3.1;
    const y = seatGround(b);
    // roof Y mirrors the camera collider height in colliders.ts
    const roofY = y + (b.kind === 'chapel' ? 10.8 : b.kind === 'inn' ? 7.8 : 8.0);
    if (b.kind === 'chapel') {
      // composed chapel: tall bell tower at the rear + squat stone entry hall
      // in front; the hall door lands on the footprint's +z edge.
      const g = new THREE.Group();
      const tower = propAsset('bellTower');
      addParts(g, 'bellTower', {
        z: -0.75,
        scale: [(b.w * 0.98) / tower.size.x, 10.6 / tower.size.y, (b.d * 0.72) / tower.size.z],
      });
      const hall = propAsset('house3');
      addParts(g, 'house3', {
        z: b.d / 2 - 1.62,
        scale: [(b.w * 0.9) / hall.size.x, 2.5 / hall.size.y, 3.2 / hall.size.z],
      });
      g.position.set(b.x, y - 0.12, b.z);
      g.rotation.y = b.rot;
      group.add(shadowed(g));
      registerHideable(g, obbFootprint(b.x, b.z, b.w / 2, b.d / 2, b.rot, roofY));
      continue;
    }
    const asset: PropKey =
      b.kind === 'inn' ? 'inn' : housePool[Math.floor(keyRand(key, 3) * 0.999 * housePool.length)];
    const a = propAsset(asset);
    const g = new THREE.Group();
    addParts(g, asset, { scale: [b.w / a.size.x, houseHeight[asset] / a.size.y, b.d / a.size.z] });
    g.position.set(b.x, y - 0.12, b.z);
    g.rotation.y = b.rot;
    group.add(shadowed(g));
    registerHideable(g, obbFootprint(b.x, b.z, b.w / 2, b.d / 2, b.rot, roofY));
  }

  // ---- market stalls: a Growverse-ORIGINAL procedural vendor booth ---------
  // Not a CC0 pack model: Bloomhaven's market booth is built from primitives so
  // the town square carries 1-of-1 geometry rather than a reskinned Quaternius
  // stand. Four timber posts (taller at the back) carry a striped canvas awning
  // that slopes to the front, over a plank counter with a front apron, a back
  // shelf, and a scalloped valance trimming the eave. Two awning colourways
  // (warm terracotta / dusty sage, both over cream) alternate per stall so a row
  // of booths never reads as one repeated model. Shared geo/materials so the
  // whole market collapses cheaply. Side wares (anvil/crate/barrel) still flank
  // the booth via the existing dressing props below.
  const stallPostMat = surfaceMat({ color: 0x5a4331, roughness: 0.9 });
  const stallPlankMat = surfaceMat({ color: 0x8a6a49, roughness: 0.82 });
  const stallBeamMat = surfaceMat({ color: 0x6e523b, roughness: 0.86 });
  const stallCanvasCream = surfaceMat({ color: 0xd8c9a6, roughness: 0.95 });
  const stallCanvasWarm = surfaceMat({ color: 0xb5613e, roughness: 0.95 });
  const stallCanvasCool = surfaceMat({ color: 0x6f7d6a, roughness: 0.95 });
  const stallGoodsMat = surfaceMat({ color: 0x9a7b53, roughness: 0.9 });
  const STALL_STRIPS = 7;
  const stallStripW = 3.0 / STALL_STRIPS;
  const stallRoofDepth = 1.75;
  const stallTilt = Math.atan2(0.33, 1.5); // back edge high, front eave low
  const postGeoBack = new THREE.BoxGeometry(0.1, 2.1, 0.1);
  const postGeoFront = new THREE.BoxGeometry(0.1, 1.75, 0.1);
  const counterTopGeo = new THREE.BoxGeometry(2.7, 0.1, 0.52);
  const counterApronGeo = new THREE.BoxGeometry(2.7, 0.82, 0.06);
  const shelfGeo = new THREE.BoxGeometry(2.7, 0.1, 0.34);
  const backBoardGeo = new THREE.BoxGeometry(2.7, 0.66, 0.05);
  const stallBeamGeo = new THREE.BoxGeometry(2.7, 0.08, 0.08);
  const stripGeo = new THREE.BoxGeometry(stallStripW * 0.96, 0.045, stallRoofDepth);
  const valanceTabGeo = new THREE.BoxGeometry(0.26, 0.17, 0.016);
  const goodsGeoA = new THREE.BoxGeometry(0.34, 0.3, 0.34);
  const goodsGeoB = new THREE.BoxGeometry(0.26, 0.24, 0.26);
  PROPS.stalls.forEach((s, i) => {
    const key = s.x * 7.7 + s.z * 2.3;
    const g = new THREE.Group();
    const stripe = i % 2 === 0 ? stallCanvasWarm : stallCanvasCool;
    // four corner posts (back pair taller so the awning slopes toward the front)
    for (const dx of [-1.3, 1.3]) {
      const bp = new THREE.Mesh(postGeoBack, stallPostMat);
      bp.position.set(dx, 1.05, -0.7);
      g.add(bp);
      const fp = new THREE.Mesh(postGeoFront, stallPostMat);
      fp.position.set(dx, 0.875, 0.7);
      g.add(fp);
    }
    // plank counter across the front, with a front apron board
    const counter = new THREE.Mesh(counterTopGeo, stallPlankMat);
    counter.position.set(0, 0.92, 0.62);
    g.add(counter);
    const apron = new THREE.Mesh(counterApronGeo, stallBeamMat);
    apron.position.set(0, 0.5, 0.86);
    g.add(apron);
    // back shelf + low back board
    if (!lowProps) {
      const shelf = new THREE.Mesh(shelfGeo, stallPlankMat);
      shelf.position.set(0, 1.15, -0.6);
      g.add(shelf);
      const board = new THREE.Mesh(backBoardGeo, stallBeamMat);
      board.position.set(0, 1.5, -0.68);
      g.add(board);
    }
    // support beams at the awning line, then the striped canvas roof
    const backBeam = new THREE.Mesh(stallBeamGeo, stallBeamMat);
    backBeam.position.set(0, 2.05, -0.72);
    g.add(backBeam);
    const frontBeam = new THREE.Mesh(stallBeamGeo, stallBeamMat);
    frontBeam.position.set(0, 1.72, 0.72);
    g.add(frontBeam);
    const roof = new THREE.Group();
    for (let k = 0; k < STALL_STRIPS; k++) {
      const strip = new THREE.Mesh(stripGeo, k % 2 === 0 ? stallCanvasCream : stripe);
      strip.position.x = -1.5 + (k + 0.5) * stallStripW;
      roof.add(strip);
    }
    roof.position.set(0, 1.925, 0);
    roof.rotation.x = stallTilt;
    g.add(roof);
    // scalloped valance tabs hanging from the front eave
    if (!lowProps) {
      for (let k = 0; k < 9; k++) {
        const tab = new THREE.Mesh(valanceTabGeo, k % 2 === 0 ? stripe : stallCanvasCream);
        tab.position.set(-1.35 + k * 0.3375, 1.645, 0.85);
        g.add(tab);
      }
    }
    if (!lowProps && (i === 1 || i === 4)) {
      // Smith Haldren (z1) / Armorer Hode (z3): forge dressing flanking the
      // booth. The booth is 2.8 wide (1.4 half-width) with corner posts, so the
      // dressing centre must clear that plus its own half-width to avoid clipping
      // the booth or its posts; 2.7yd out with smaller scales keeps them fully
      // BESIDE the booth (and z=0 centres them away from the front where the smith
      // stands).
      addParts(g, 'anvil', { x: 2.7, z: 0, rot: 0.9, scale: 1.15 });
      addParts(g, 'weaponStand', { x: -2.7, z: 0, rot: 0.5 + Math.PI, scale: 1.05 });
    } else if (!lowProps) {
      // wares flank the counter (sides), clear of the booth box and the
      // vendor NPC who stands at the front (+z) of the stall
      addParts(g, 'farmCrate', { x: 2.7, z: 0, rot: keyRand(key, 2) * Math.PI, scale: 1.4 });
      addParts(g, 'barrel', { x: -2.7, z: 0, rot: keyRand(key, 3) * Math.PI, scale: 1.1 });
      // a little stacked goods on the counter top so the market reads as trading
      const goodA = new THREE.Mesh(goodsGeoA, stallGoodsMat);
      goodA.position.set(-0.7 + keyRand(key, 4) * 0.3, 1.12, 0.5);
      goodA.rotation.y = (keyRand(key, 5) - 0.5) * 0.6;
      g.add(goodA);
      const goodB = new THREE.Mesh(goodsGeoB, stallPlankMat);
      goodB.position.set(0.65 - keyRand(key, 6) * 0.3, 1.09, 0.56);
      goodB.rotation.y = (keyRand(key, 7) - 0.5) * 0.6;
      g.add(goodB);
    }
    g.position.set(s.x, ground(s.x, s.z) - 0.06, s.z);
    g.rotation.y = s.rot;
    group.add(shadowed(g));
    registerHideable(g, circleFootprint(s.x, s.z, s.r, ground(s.x, s.z) + 2.4));
  });

  // ---- wells ---------------------------------------------------------------
  for (const w of PROPS.wells) {
    const g = new THREE.Group();
    const a = propAsset('well');
    addParts(g, 'well', { scale: [2.6 / a.size.x, 3.6 / a.size.y, 2.9 / a.size.z] });
    g.position.set(w.x, ground(w.x, w.z) - 0.1, w.z);
    g.rotation.y = propRand(w.x, w.z, 1) * Math.PI;
    group.add(shadowed(g));
    registerHideable(g, circleFootprint(w.x, w.z, w.r, ground(w.x, w.z) + 3.7));
  }

  // ---- Elevated Obelisks: tall stone waystone landmarks --------------------
  for (const o of PROPS.obelisks ?? []) {
    const targetH = o.y ?? 6;
    const a = propAsset('obelisk');
    const s = targetH / a.size.y; // uniform scale off the model's height
    const g = new THREE.Group();
    addParts(g, 'obelisk', {
      scale: s,
      rot: propRand(o.x, o.z, 1) * Math.PI * 2,
    });
    g.position.set(o.x, ground(o.x, o.z) - 0.06, o.z);
    group.add(shadowed(g));
    registerHideable(
      g,
      circleFootprint(o.x, o.z, Math.max(0.8, a.size.x * s * 0.5), ground(o.x, o.z) + targetH),
    );
  }

  // ---- Ashen Maw ward-totems: a Growverse-ORIGINAL procedural prop ----------
  // Not a CC0 pack model: a skull-topped raider stake built from primitives, so
  // the warcamp is marked by 1-of-1 geometry rather than a reskinned KayKit asset.
  // A leaning ashwood post carries a bleached skull (faceted, sunken sockets, a
  // dropped jaw), a bone crossbar hung with charms, and a weathered ash pennant.
  // Shared geo/materials across every stake so the whole ring collapses cheaply.
  if ((PROPS.wardStakes ?? []).length > 0) {
    const woodMat = surfaceMat({ color: 0x33261b, roughness: 0.96 });
    const boneMat = surfaceMat({ color: 0xd8ccb0, roughness: 0.72 });
    const charmMat = surfaceMat({ color: 0xc4b596, roughness: 0.82 });
    const pennantMat = surfaceMat({ color: 0x6a5940, roughness: 1 });
    const stakeGeo = new THREE.CylinderGeometry(0.05, 0.1, 2.4, 6);
    const skullGeo = new THREE.IcosahedronGeometry(0.19, 0);
    const jawGeo = new THREE.BoxGeometry(0.15, 0.07, 0.13);
    const crossGeo = new THREE.BoxGeometry(0.72, 0.05, 0.05);
    const cordGeo = new THREE.BoxGeometry(0.014, 0.18, 0.014);
    const charmGeo = new THREE.BoxGeometry(0.06, 0.15, 0.02);
    const socketGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const pennantGeo = new THREE.BoxGeometry(0.02, 0.32, 0.44);
    for (const w of PROPS.wardStakes ?? []) {
      const y = ground(w.x, w.z);
      const g = new THREE.Group();
      const stake = new THREE.Mesh(stakeGeo, woodMat);
      stake.position.y = 1.2;
      g.add(stake);
      // bone crossbar + two hung charms
      const cross = new THREE.Mesh(crossGeo, boneMat);
      cross.position.y = 1.72;
      g.add(cross);
      for (const dx of [-0.31, 0.31]) {
        const cord = new THREE.Mesh(cordGeo, woodMat);
        cord.position.set(dx, 1.62, 0);
        g.add(cord);
        const charm = new THREE.Mesh(charmGeo, charmMat);
        charm.position.set(dx, 1.47, 0);
        charm.rotation.z = (propRand(w.x + dx, w.z, 4) - 0.5) * 0.5;
        g.add(charm);
      }
      // skull at the crown, faceted, with sunken sockets and a dropped jaw
      const skull = new THREE.Mesh(skullGeo, boneMat);
      skull.position.y = 2.34;
      skull.rotation.set(0.12, propRand(w.x, w.z, 5) * Math.PI * 2, 0);
      g.add(skull);
      const jaw = new THREE.Mesh(jawGeo, boneMat);
      jaw.position.set(0, 2.18, 0.11);
      g.add(jaw);
      for (const dx of [-0.07, 0.07]) {
        const socket = new THREE.Mesh(socketGeo, recessMat);
        socket.position.set(dx, 2.37, 0.15);
        g.add(socket);
      }
      // weathered ash pennant lashed below the crossbar, drooping to one side
      const pennant = new THREE.Mesh(pennantGeo, pennantMat);
      pennant.position.set(0.02, 1.28, 0.28);
      pennant.rotation.set(0, 0, 0.22);
      g.add(pennant);
      // deterministic lean + base yaw so a ring of stakes never reads as a fence
      const lean = (propRand(w.x, w.z, 6) - 0.5) * 0.16;
      g.position.set(w.x, y - 0.05, w.z);
      g.rotation.set(lean, w.rot ?? propRand(w.x, w.z, 7) * Math.PI * 2, lean * 0.6, 'YZX');
      group.add(shadowed(g));
      registerHideable(g, circleFootprint(w.x, w.z, 0.45, y + 2.55, 1.0));
    }
  }

  // ---- Ashen Maw war-standard: a Growverse-ORIGINAL procedural centerpiece -----
  // The warcamp's ceremonial heart, raised over Sarn the Hollowed. Not a CC0/Meshy
  // GLB: a grander sibling of the ward-totem built from the SAME primitive palette
  // so it reads as the same clan's craft. A thick ashwood post carries a climbing
  // stack of three bleached skulls (the crown skull jawed, sockets sunken), a broad
  // bone crossbar hung with charms, a large drooping ash war-banner, and a small
  // skull-cairn heaped at the foot. Shared geo/materials so a standard costs little.
  if ((PROPS.warStandards ?? []).length > 0) {
    const woodMat = surfaceMat({ color: 0x33261b, roughness: 0.96 });
    const boneMat = surfaceMat({ color: 0xd8ccb0, roughness: 0.72 });
    const charmMat = surfaceMat({ color: 0xc4b596, roughness: 0.82 });
    const pennantMat = surfaceMat({ color: 0x6a5940, roughness: 1 });
    const postGeo = new THREE.CylinderGeometry(0.09, 0.17, 3.7, 8);
    const crossGeo = new THREE.BoxGeometry(1.35, 0.06, 0.06);
    const cordGeo = new THREE.BoxGeometry(0.016, 0.2, 0.016);
    const charmGeo = new THREE.BoxGeometry(0.07, 0.18, 0.024);
    const jawGeo = new THREE.BoxGeometry(0.18, 0.08, 0.15);
    const socketGeo = new THREE.SphereGeometry(0.055, 6, 6);
    const bannerGeo = new THREE.BoxGeometry(0.03, 0.82, 1.02);
    // three trophy skulls climb the post; the fourth crowns it
    const skullRungs: [number, number][] = [
      [1.32, 0.2],
      [2.12, 0.21],
      [2.94, 0.24],
    ];
    // a small cairn heaped at the foot
    const cairnSkulls: [number, number, number][] = [
      [0.34, 0.14, 0.16],
      [-0.3, 0.12, 0.24],
      [0.06, 0.1, -0.32],
    ];
    for (const w of PROPS.warStandards ?? []) {
      const y = ground(w.x, w.z);
      const g = new THREE.Group();
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.y = 1.85;
      g.add(post);
      // climbing skull stack, each faceted with sunken sockets facing out
      for (let i = 0; i < skullRungs.length; i++) {
        const [sy, sr] = skullRungs[i];
        const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(sr, 0), boneMat);
        skull.position.set(0, sy, 0.04);
        skull.rotation.set(0.1, propRand(w.x + i, w.z, 5) * Math.PI * 2, 0);
        g.add(skull);
        for (const dx of [-0.075, 0.075]) {
          const socket = new THREE.Mesh(socketGeo, recessMat);
          socket.position.set(dx, sy + 0.02, 0.04 + sr * 0.78);
          g.add(socket);
        }
      }
      // the crown skull gets a dropped jaw
      const jaw = new THREE.Mesh(jawGeo, boneMat);
      jaw.position.set(0, 2.76, 0.22);
      g.add(jaw);
      // broad bone crossbar near the top with three hung charms
      const cross = new THREE.Mesh(crossGeo, boneMat);
      cross.position.y = 3.36;
      g.add(cross);
      for (const dx of [-0.58, 0, 0.58]) {
        const cord = new THREE.Mesh(cordGeo, woodMat);
        cord.position.set(dx, 3.25, 0);
        g.add(cord);
        const charm = new THREE.Mesh(charmGeo, charmMat);
        charm.position.set(dx, 3.08, 0);
        charm.rotation.z = (propRand(w.x + dx, w.z, 4) - 0.5) * 0.5;
        g.add(charm);
      }
      // large ash war-banner lashed below the crossbar, drooping forward
      const banner = new THREE.Mesh(bannerGeo, pennantMat);
      banner.position.set(0.03, 2.92, 0.32);
      banner.rotation.set(0.14, 0, 0.05);
      g.add(banner);
      // skull-cairn heaped at the foot to seat the standard
      for (let i = 0; i < cairnSkulls.length; i++) {
        const [cx, cy, cz] = cairnSkulls[i];
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), boneMat);
        s.position.set(cx, cy, cz);
        s.rotation.set(
          propRand(w.x + cx, w.z, 6) * 1.2,
          propRand(w.x, w.z + cz, 7) * Math.PI * 2,
          0,
        );
        g.add(s);
      }
      const lean = (propRand(w.x, w.z, 6) - 0.5) * 0.06;
      g.position.set(w.x, y - 0.05, w.z);
      g.rotation.set(lean, w.rot ?? propRand(w.x, w.z, 7) * Math.PI * 2, lean * 0.5, 'YZX');
      group.add(shadowed(g));
      registerHideable(g, circleFootprint(w.x, w.z, 0.75, y + 3.9, 1.0));
    }
  }

  // ---- Ashen Maw spiked-stake barricades: a custom Meshy GLB, not a CC0 pack --
  // A ropebound cluster of sharpened stakes dropped along the warcamp approach and
  // perimeter. Uniform-scaled off the model height; a deterministic yaw so a line
  // of them never reads as a repeated stamp.
  for (const b of PROPS.spikeBarricades ?? []) {
    const targetH = b.h ?? 1.6;
    const a = propAsset('spikedStakes');
    const s = targetH / a.size.y;
    const g = new THREE.Group();
    addParts(g, 'spikedStakes', {
      scale: s,
      rot: b.rot ?? propRand(b.x, b.z, 8) * Math.PI * 2,
    });
    g.position.set(b.x, ground(b.x, b.z) - 0.05, b.z);
    group.add(shadowed(g));
    registerHideable(
      g,
      circleFootprint(b.x, b.z, Math.max(0.7, a.size.x * s * 0.5), ground(b.x, b.z) + targetH),
    );
  }

  // ---- The Dam: a colossal Growverse-ORIGINAL procedural beaver dam ----------
  // The driftwood town literally named "The Dam" is dwarfed by an actual, absurd
  // beaver dam holding back The Reservoir: a long triangular mud berm packed with
  // crisscrossed gnawed logs, a crown of chewed stakes, and galaxy-blue glow
  // chinks tying it to the Beavers. Built from primitives (no GLB); the OBB
  // collider (colliders.ts) uses the same crest line so barrier == geometry.
  const dams = PROPS.beaverDams ?? [];
  // `PROPS.beaverDams` holds the segments of EVERY dam in the world merged into one
  // flat array (e.g. the Sluice U near Bloomhaven and the colossal U at The Dam
  // colony far to the south). Cluster the segments back into separate dams by
  // proximity: the arms of one dam share endpoints and sit within a stone's throw,
  // while distinct dams are hundreds of yards apart. Each dam then gets ONE beaver on
  // its OWN middle segment, facing its OWN centroid (out over the water it holds).
  const damMid = (dd: { x1: number; z1: number; x2: number; z2: number }) => ({
    x: (dd.x1 + dd.x2) / 2,
    z: (dd.z1 + dd.z2) / 2,
  });
  const DAM_GROUP_DIST_SQ = 120 * 120; // >> an arm's span, << the gap between dams
  const damGroups: number[][] = [];
  for (let i = 0; i < dams.length; i++) {
    const mi = damMid(dams[i]);
    const g = damGroups.find((grp) =>
      grp.some((j) => {
        const mj = damMid(dams[j]);
        return (mj.x - mi.x) ** 2 + (mj.z - mi.z) ** 2 <= DAM_GROUP_DIST_SQ;
      }),
    );
    if (g) g.push(i);
    else damGroups.push([i]);
  }
  // segment index -> the centroid its beaver should face (only the middle segment of
  // each group is present; every other segment has no beaver).
  const damBeaverFace = new Map<number, { cx: number; cz: number }>();
  for (const grp of damGroups) {
    let cx = 0;
    let cz = 0;
    for (const j of grp) {
      const m = damMid(dams[j]);
      cx += m.x;
      cz += m.z;
    }
    cx /= grp.length;
    cz /= grp.length;
    damBeaverFace.set(grp[Math.floor(grp.length / 2)], { cx, cz });
  }
  for (let di = 0; di < dams.length; di++) {
    const d = dams[di];
    const ddx = d.x2 - d.x1;
    const ddz = d.z2 - d.z1;
    const len = Math.hypot(ddx, ddz);
    if (len < 1e-6) continue;
    const cx = (d.x1 + d.x2) / 2;
    const cz = (d.z1 + d.z2) / 2;
    const h = d.h ?? 8;
    const rot = Math.atan2(-ddz, ddx); // local +x runs along the crest (matches collider)
    const baseHalf = 2.35; // half the mud base spread (~4.7m), under DAM_HALF_DEPTH*2
    const y = ground(cx, cz);

    const mudMat = surfaceMat({ color: 0x5b4a36, roughness: 1 });
    const logMat = surfaceMat({ color: 0x6a4f37, roughness: 0.92 });
    const logDkMat = surfaceMat({ color: 0x513c28, roughness: 0.95 });
    const stakeMat = surfaceMat({ color: 0x7a5c3f, roughness: 0.9 });
    const glowMat = surfaceMat({
      color: 0x5b6ee1,
      emissive: 0x5b6ee1,
      emissiveIntensity: usePbr ? 1.6 : 1.0,
      roughness: 0.5,
    });

    const g = new THREE.Group();

    // A dam built from STACKED LOGS, not a solid berm: gnawed logs laid ALONG the
    // crest (local +x) in brick-staggered rows climbing to the crest, tied every
    // other row with a few front-to-back cross-logs, so it reads as a beaver
    // log-jam. Logs are merged per material into two draw calls. A low packed-mud
    // footing grounds the stack into the bank (NOT a full-height wall). Local
    // space: +x along the crest (length), y up, z the up/downstream thickness.
    const logM = new THREE.Matrix4();
    const logQ = new THREE.Quaternion();
    const logE = new THREE.Euler();
    const logP = new THREE.Vector3();
    const logS = new THREE.Vector3(1, 1, 1);
    const logGeos: THREE.BufferGeometry[] = [];
    const logDkGeos: THREE.BufferGeometry[] = [];
    const placeLog = (
      geo: THREE.CylinderGeometry,
      dark: boolean,
      px: number,
      py: number,
      pz: number,
      ex: number,
      ey: number,
      ez: number,
    ): void => {
      logE.set(ex, ey, ez, 'ZYX');
      logQ.setFromEuler(logE);
      logP.set(px, py, pz);
      (dark ? logDkGeos : logGeos).push(geo.applyMatrix4(logM.compose(logP, logQ, logS)));
    };

    // low packed-mud footing (grounds the logs at the waterline; ~0.9m tall)
    const footGeo = new THREE.BoxGeometry(len, 0.9, baseHalf * 1.7);
    const foot = new THREE.Mesh(footGeo, mudMat);
    foot.position.set(0, 0.35, 0);
    g.add(foot);

    const ROW_H = 0.72;
    const rows = Math.max(3, Math.round(h / ROW_H));
    for (let row = 0; row < rows; row++) {
      const ly = 0.7 + row * ROW_H;
      if (ly > h + 0.2) break;
      const taper = 1 - 0.5 * (ly / h); // the stack narrows toward the crest
      const zSpread = baseHalf * Math.max(0.35, taper);
      let x = -len / 2 - (row % 2) * 1.5; // brick-stagger alternate rows
      let li = 0;
      while (x < len / 2) {
        const logLen = 3.0 + propRand(cx + row, cz + li, 20) * 2.8;
        const px = x + logLen / 2;
        const zside = (row + li) % 2 === 0 ? 1 : -1;
        const pz = zside * zSpread * (0.4 + propRand(cx + li, cz + row, 21) * 0.45);
        const r = 0.3 + propRand(cx + row, cz - li, 22) * 0.14;
        const dark = (row + li) % 3 === 0;
        placeLog(
          new THREE.CylinderGeometry(r, r * 0.88, logLen, 7),
          dark,
          px,
          ly,
          pz,
          (propRand(cx + li, cz + row, 23) - 0.5) * 0.22, // slight pitch
          (propRand(cx + row, cz + li, 24) - 0.5) * 0.28, // yaw into the weave
          Math.PI / 2 + (propRand(cx - li, cz + row, 25) - 0.5) * 0.12,
        );
        x += logLen * (0.66 + propRand(cx + row, cz + li, 26) * 0.22); // overlap
        li++;
      }
      // every other row: a few cross-logs running front-to-back tie the stack
      if (row % 2 === 1) {
        const nCross = Math.max(1, Math.round(len / 9));
        for (let c = 0; c < nCross; c++) {
          const cxpos =
            -len / 2 + ((c + 0.5) / nCross) * len + (propRand(cx + c, cz + row, 27) - 0.5) * 2;
          placeLog(
            new THREE.CylinderGeometry(0.24, 0.24, baseHalf * 1.8, 6),
            true,
            cxpos,
            ly + 0.12,
            0,
            Math.PI / 2,
            0,
            0,
          );
        }
      }
    }
    if (logGeos.length > 0) g.add(new THREE.Mesh(mergeGeometries(logGeos, false), logMat));
    if (logDkGeos.length > 0) g.add(new THREE.Mesh(mergeGeometries(logDkGeos, false), logDkMat));

    // Crown of gnawed vertical stakes poking up along the crest.
    const stakeCount = Math.max(4, Math.round(len / 6));
    for (let i = 0; i < stakeCount; i++) {
      const sx = -len / 2 + ((i + 0.5) / stakeCount) * len + (propRand(cx, cz + i, 10) - 0.5) * 2;
      const sh = 0.9 + propRand(cx + i, cz, 11) * 1.1;
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, sh, 6), stakeMat);
      stake.position.set(sx, h - 0.2 + sh / 2, baseHalf * 0.2 + (propRand(cx, cz - i, 12) - 0.5));
      stake.rotation.set((propRand(cx + i, cz + i, 13) - 0.5) * 0.4, 0, 0);
      g.add(stake);
    }

    // Galaxy-blue glow chinks tucked into the downstream face (Beaver signature).
    const chinkCount = Math.max(3, Math.round(len / 12));
    for (let i = 0; i < chinkCount; i++) {
      const gx =
        -len / 2 + ((i + 0.5) / chinkCount) * len + (propRand(cx, cz + i * 3, 14) - 0.5) * 3;
      const gy = 0.8 + propRand(cx + i, cz, 15) * (h - 1.8);
      const chink = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.14 + propRand(cx, cz + i, 16) * 0.1, 0),
        glowMat,
      );
      chink.position.set(gx, gy, (1 - gy / h) * (baseHalf - 0.3) + 0.15);
      g.add(chink);
    }

    // The mascot gag: an absurdly huge beaver perched on the crest, surveying its
    // absurdly huge dam. Sized ~5m so it reads as the landmark's namesake from across
    // the zone. Rendered on every tier (one cheap static instance): it IS the
    // landmark's identity, not sheddable cosmetic richness. The mascot geometry is
    // shared with the standalone town-edge landmark via buildBeaverMascot. Only ONE
    // beaver per dam: it perches on that dam's middle segment (see the clustering
    // above), facing out over the water THAT dam holds.
    const beaverFace = damBeaverFace.get(di);
    if (beaverFace) {
      const bv = buildBeaverMascot(glowMat, baseHalf * 0.2); // faceZ = crest downstream lean
      // perch the beaver on the crest, near center, and turn it to face this dam's
      // own centroid (out over the water it holds) with a tiny deterministic tilt. The
      // model's front is +z; subtracting the segment yaw `rot` converts the desired
      // WORLD facing into this rotated group's local frame. A single-segment dam has
      // no concave side to infer, so it falls back to facing downstream (local -z).
      bv.position.set((propRand(cx, cz, 17) - 0.5) * len * 0.2, h - 0.3, 0);
      const solo = Math.abs(beaverFace.cx - cx) < 1e-6 && Math.abs(beaverFace.cz - cz) < 1e-6;
      const faceYaw = solo ? Math.PI : Math.atan2(beaverFace.cx - cx, beaverFace.cz - cz) - rot;
      bv.rotation.y = faceYaw + (propRand(cx, cz, 18) - 0.5) * 0.4;
      g.add(bv);
    }

    g.position.set(cx, y - 0.35, cz);
    g.rotation.y = rot;
    group.add(shadowed(g));
    registerHideable(g, obbFootprint(cx, cz, len / 2, baseHalf, rot, y + h));
  }

  // ---- standalone Baked Beaver mascots: town-edge landmark statues -----------
  // The same procedural beaver, planted on open ground (no dam) so a new player
  // wandering out of Bloomhaven sights it as a marquee landmark. One cheap static
  // instance each, every tier: it is the town's mascot identity, not sheddable
  // cosmetic richness.
  for (const m of PROPS.beaverMascots ?? []) {
    const gy = ground(m.x, m.z);
    const s = m.scale ?? 1;
    const glowMat = surfaceMat({
      color: 0x5b6ee1,
      emissive: 0x5b6ee1,
      emissiveIntensity: usePbr ? 1.6 : 1.0,
      roughness: 0.5,
    });
    const bv = buildBeaverMascot(glowMat, 0);
    bv.scale.setScalar(s);
    // seat the beaver's feet on the ground (its lowest geometry sits ~0.3 above the
    // local origin), then face and place it.
    bv.position.set(m.x, gy - 0.3 * s, m.z);
    bv.rotation.y = m.rot ?? 0;
    group.add(shadowed(bv));
    registerHideable(bv, obbFootprint(m.x, m.z, 1.7 * s, 1.7 * s, m.rot ?? 0, gy + 5 * s));
  }

  // ---- graveyards: Growverse-ORIGINAL procedural weathered headstones --------
  // A 3x2 cluster of desert-sandstone markers per anchor (rounded slab, stone
  // cross, plain bevel slab, and a broken leaning stub), each on a low dirt mound
  // with a clinging moss patch, tilted deterministically so no two read alike.
  // Replaces the CC0 Kenney graveyard-kit GLBs so the Bloomhaven churchyard (and
  // the zone2/zone3 grave plots) read 1-of-1. Built from primitives; no GLB.
  if (PROPS.graveyards.length > 0) {
    const gStoneA = surfaceMat({ color: 0x8f877c, roughness: 0.95 });
    const gStoneB = surfaceMat({ color: 0x7c756a, roughness: 0.95 });
    const gMoss = surfaceMat({ color: 0x5f6b4e, roughness: 1 });
    const gDirt = surfaceMat({ color: 0x584838, roughness: 1 });
    const slabGeo = new THREE.BoxGeometry(0.62, 0.95, 0.15);
    const capGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.15, 14);
    const crossVGeo = new THREE.BoxGeometry(0.2, 1.0, 0.16);
    const crossHGeo = new THREE.BoxGeometry(0.62, 0.2, 0.16);
    const stubGeo = new THREE.BoxGeometry(0.6, 0.5, 0.16);
    const moundGeo = new THREE.CylinderGeometry(0.55, 0.68, 0.12, 10);
    const mossGeo = new THREE.BoxGeometry(0.5, 0.18, 0.02);
    for (const gy of PROPS.graveyards) {
      for (let i = 0; i < 6; i++) {
        const gx = gy.x + (i % 3) * 2.2,
          gz = gy.z + Math.floor(i / 3) * 2.6;
        const y = ground(gx, gz);
        const g = new THREE.Group();
        const stoneMat = propRand(gx, gz, 6) < 0.5 ? gStoneA : gStoneB;
        if (!lowProps) {
          const mound = new THREE.Mesh(moundGeo, gDirt);
          mound.position.y = 0.05;
          mound.scale.set(1, 1, 0.85);
          g.add(mound);
        }
        const shape = i % 4;
        if (shape === 0) {
          const slab = new THREE.Mesh(slabGeo, stoneMat);
          slab.position.y = 0.55;
          g.add(slab);
          const cap = new THREE.Mesh(capGeo, stoneMat);
          cap.rotation.x = Math.PI / 2;
          cap.position.y = 1.0;
          g.add(cap);
        } else if (shape === 1) {
          const v = new THREE.Mesh(crossVGeo, stoneMat);
          v.position.y = 0.6;
          g.add(v);
          const h = new THREE.Mesh(crossHGeo, stoneMat);
          h.position.y = 0.82;
          g.add(h);
        } else if (shape === 2) {
          const slab = new THREE.Mesh(slabGeo, stoneMat);
          slab.scale.set(1.15, 0.85, 1);
          slab.position.y = 0.48;
          g.add(slab);
        } else {
          const stub = new THREE.Mesh(stubGeo, stoneMat);
          stub.position.y = 0.3;
          stub.rotation.z = (propRand(gx, gz, 7) - 0.4) * 0.5;
          g.add(stub);
        }
        // a moss patch clinging to the face of the upright stones (skip on low)
        if (!lowProps && shape !== 3) {
          const moss = new THREE.Mesh(mossGeo, gMoss);
          moss.position.set((propRand(gx, gz, 8) - 0.5) * 0.3, 0.28, 0.09);
          g.add(moss);
        }
        const s = 0.95 + keyRand(gx * 3 + gz, 4) * 0.25;
        g.scale.setScalar(s);
        g.position.set(gx, y - 0.06, gz);
        g.rotation.set(
          (propRand(gx, gz, 1) - 0.5) * 0.16,
          i * 0.4 + (propRand(gx, gz, 2) - 0.5) * 0.5,
          (propRand(gx, gz, 3) - 0.5) * 0.18,
        );
        group.add(shadowed(g));
      }
    }
  }

  // ---- town fences: village fence module repeated along the run ------------
  for (const f of PROPS.fences) {
    const len = Math.hypot(f.x2 - f.x1, f.z2 - f.z1);
    const n = Math.max(1, Math.round(len / 2.35));
    const dirx = (f.x2 - f.x1) / len,
      dirz = (f.z2 - f.z1) / len;
    const yaw = Math.atan2(-dirz, dirx); // module length runs along local +x
    for (let i = 0; i < n; i++) {
      const x0 = f.x1 + (f.x2 - f.x1) * (i / n),
        z0 = f.z1 + (f.z2 - f.z1) * (i / n);
      const x1 = f.x1 + (f.x2 - f.x1) * ((i + 1) / n),
        z1 = f.z1 + (f.z2 - f.z1) * ((i + 1) / n);
      const g0 = ground(x0, z0),
        g1 = ground(x1, z1);
      const pitch = Math.atan2(g1 - g0, len / n);
      const mx = (x0 + x1) / 2,
        mz = (z0 + z1) / 2;
      const sy = 2.9 + (propRand(mx, mz, 1) - 0.5) * 0.5;
      addInstance('fence', mx, (g0 + g1) / 2 - 0.05, mz, new THREE.Euler(0, yaw, pitch, 'YZX'), [
        3.0,
        sy,
        3.0,
      ]);
    }
  }

  // ---- campfires: hideable bonfire base + live animated flame + light ------
  const flamePts = [
    [0, 0],
    [0.16, 0.1],
    [0.27, 0.28],
    [0.3, 0.45],
    [0.22, 0.66],
    [0.1, 0.84],
    [0.001, 0.95],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const flameGeo = new THREE.LatheGeometry(flamePts, 7);
  for (const [x, z] of PROPS.campfires) {
    const y = ground(x, z);
    const g = new THREE.Group();
    addParts(g, 'bonfire', { y: -0.05, rot: propRand(x, z, 1) * Math.PI * 2, scale: 4.3 });
    const flame = new THREE.Mesh(
      flameGeo,
      new THREE.MeshLambertMaterial({
        color: 0xffaa33,
        emissive: 0xff6600,
        emissiveIntensity: usePbr ? 2.2 : 1.4,
        transparent: true,
        opacity: 0.92,
      }),
    );
    flame.position.y = 0.16;
    flame.scale.setScalar(1.15);
    g.add(flame);
    flames.push(flame);
    noShadow.add(flame);
    const light = new THREE.PointLight(0xff8830, 12, 16, 2);
    light.position.y = 1.2;
    g.add(light);
    fireLights.push(light);
    g.position.set(x, y, z);
    group.add(shadowed(g));
    registerHideable(g, circleFootprint(x, z, 0.85, y + 1.45, 2.4));
  }

  // ---- Ashen Maw cookfires: a Growverse-ORIGINAL procedural raider hearth ------
  // A blackened-stone ring around a low log pyre, NOT the shared CC0 bonfire.glb
  // the other zones burn. Reuses the same animated flame + fire-light pattern as
  // the campfires above (pushed into `flames`/`fireLights` so the renderer flickers
  // them and sheds embers for free), so only the warcamp hearths read as 1-of-1.
  if ((PROPS.raiderCookfires ?? []).length > 0) {
    const logMat = surfaceMat({ color: 0x33261b, roughness: 0.96 });
    const charMat = surfaceMat({ color: 0x1a140d, roughness: 1 });
    const stoneMat = surfaceMat({ color: 0x463f38, roughness: 1 });
    const emberMat = new THREE.MeshLambertMaterial({
      color: 0xff7a2a,
      emissive: 0xff5010,
      emissiveIntensity: usePbr ? 1.9 : 1.2,
    });
    const stoneGeo = new THREE.IcosahedronGeometry(0.17, 0);
    const logGeo = new THREE.CylinderGeometry(0.075, 0.095, 1.0, 6);
    const emberGeo = new THREE.CylinderGeometry(0.34, 0.4, 0.08, 10);
    for (const [x, z] of PROPS.raiderCookfires ?? []) {
      const y = ground(x, z);
      const g = new THREE.Group();
      // ring of blackened stones ringing the pit (deterministic size + lean)
      const stoneN = 7;
      for (let i = 0; i < stoneN; i++) {
        const a = (i / stoneN) * Math.PI * 2 + propRand(x + i, z, 8) * 0.3;
        const stone = new THREE.Mesh(stoneGeo, stoneMat);
        const sc = 0.75 + propRand(x, z + i, 9) * 0.55;
        stone.position.set(Math.cos(a) * 0.55, 0.1 * sc, Math.sin(a) * 0.55);
        stone.scale.set(sc, sc * 0.8, sc);
        stone.rotation.set(propRand(x + i, z + i, 10) * Math.PI, a, 0);
        g.add(stone);
      }
      // glowing ember bed sunk in the pit
      const bed = new THREE.Mesh(emberGeo, emberMat);
      bed.position.y = 0.06;
      g.add(bed);
      // a low pyre of crossed charred logs (a couple burnt black, the rest wood)
      const logN = 5;
      for (let i = 0; i < logN; i++) {
        const a = (i / logN) * Math.PI + propRand(x, z + i, 11) * 0.4;
        const log = new THREE.Mesh(logGeo, propRand(x + i, z, 12) < 0.35 ? charMat : logMat);
        log.position.set(
          Math.cos(a) * 0.12,
          0.16 + propRand(x + i, z + i, 13) * 0.06,
          Math.sin(a) * 0.12,
        );
        log.rotation.set(Math.PI / 2 + (propRand(x, z + i, 14) - 0.5) * 0.5, a, 0, 'ZYX');
        g.add(log);
      }
      // live flame + warm point light, same handling as the stock campfire
      const flame = new THREE.Mesh(
        flameGeo,
        new THREE.MeshLambertMaterial({
          color: 0xffaa33,
          emissive: 0xff6600,
          emissiveIntensity: usePbr ? 2.2 : 1.4,
          transparent: true,
          opacity: 0.92,
        }),
      );
      flame.position.y = 0.28;
      flame.scale.setScalar(1.05);
      g.add(flame);
      flames.push(flame);
      noShadow.add(flame);
      const light = new THREE.PointLight(0xff8830, 12, 16, 2);
      light.position.y = 1.1;
      g.add(light);
      fireLights.push(light);
      g.position.set(x, y, z);
      group.add(shadowed(g));
      registerHideable(g, circleFootprint(x, z, 0.8, y + 1.2, 2.2));
    }
  }

  // ---- bandit/war tents: Kenney ridge tents, opening on +z, hideable -------
  for (const t of PROPS.tents) {
    const kind: PropKey = propRand(t.x, t.z, 2) < 0.55 ? 'tentOpen' : 'tentSmall';
    const a = propAsset(kind);
    const s = (3.0 * t.scale) / Math.max(a.size.x, a.size.z);
    const y = ground(t.x, t.z);
    const g = new THREE.Group();
    addParts(g, kind, { scale: [s, s * 1.32, s] });
    g.position.set(t.x, y - 0.06, t.z);
    g.rotation.set(
      (propRand(t.x, t.z, 3) - 0.5) * 0.06,
      t.rot,
      (propRand(t.x, t.z, 4) - 0.5) * 0.06,
    );
    group.add(shadowed(g));
    registerHideable(g, circleFootprint(t.x, t.z, 1.5 * t.scale, y + 3.4 * t.scale, 3.0 * t.scale));
  }

  // ---- Ashen Maw raider tents: a Growverse-ORIGINAL procedural hide-and-pole ---
  // lean-to (ridge tent), NOT the shared CC0 Kenney `tent_*.glb` the other zones
  // pitch. Two hide roof panels over a lashed ridge pole, crossed A-frame poles at
  // each end, a closed back gable flap, and clan trophies (a bone skull finial and
  // a dried-blood war pennant) so the warcamp reads 1-of-1. Front opening on +z to
  // match the stock tent yaw. Built once at unit scale; each tent scales its group
  // (the warlord's tent is the largest) and faces via `rot`.
  if ((PROPS.raiderTents ?? []).length > 0) {
    const poleMat = surfaceMat({ color: 0x33261b, roughness: 0.96 });
    const hideMat = surfaceMat({ color: 0x6a5940, roughness: 1 });
    const hideMat2 = surfaceMat({ color: 0x5a4a37, roughness: 1 });
    const boneMat = surfaceMat({ color: 0xd8ccb0, roughness: 0.72 });
    const charmMat = surfaceMat({ color: 0xc4b596, roughness: 0.82 });
    const pennantMat = surfaceMat({ color: 0x6b2b22, roughness: 1 });
    const tentLen = 2.6;
    const halfW = 1.15;
    const ridgeH = 1.7;
    const slope = Math.hypot(halfW, ridgeH);
    const panelAngle = Math.atan2(halfW, ridgeH);
    const halfLen = tentLen / 2;
    const ridgeGeo = new THREE.CylinderGeometry(0.05, 0.05, tentLen + 0.5, 6);
    const poleGeo = new THREE.CylinderGeometry(0.045, 0.065, slope, 6);
    const roofGeo = new THREE.BoxGeometry(0.05, slope, tentLen);
    const gableGeo = new THREE.BoxGeometry(1.55, 1.2, 0.05);
    const skullGeo = new THREE.IcosahedronGeometry(0.16, 0);
    const jawGeo = new THREE.BoxGeometry(0.13, 0.06, 0.11);
    const pennantGeo = new THREE.BoxGeometry(0.02, 0.32, 0.42);
    const cordGeo = new THREE.BoxGeometry(0.014, 0.2, 0.014);
    const charmGeo = new THREE.BoxGeometry(0.06, 0.15, 0.02);
    for (const t of PROPS.raiderTents ?? []) {
      const y = ground(t.x, t.z);
      const g = new THREE.Group();
      // lashed ridge pole running front-to-back, overhanging the front a touch
      const ridge = new THREE.Mesh(ridgeGeo, poleMat);
      ridge.rotation.x = Math.PI / 2;
      ridge.position.set(0, ridgeH, 0.1);
      g.add(ridge);
      // two hide roof panels sloping from the ridge down to each eave
      const left = new THREE.Mesh(roofGeo, hideMat);
      left.position.set(-halfW / 2, ridgeH / 2, 0);
      left.rotation.z = -panelAngle;
      g.add(left);
      const right = new THREE.Mesh(roofGeo, hideMat2);
      right.position.set(halfW / 2, ridgeH / 2, 0);
      right.rotation.z = panelAngle;
      g.add(right);
      // crossed A-frame support poles at the front and back eaves
      for (const ez of [halfLen, -halfLen]) {
        const pl = new THREE.Mesh(poleGeo, poleMat);
        pl.position.set(-halfW / 2, ridgeH / 2, ez);
        pl.rotation.z = -panelAngle;
        g.add(pl);
        const pr = new THREE.Mesh(poleGeo, poleMat);
        pr.position.set(halfW / 2, ridgeH / 2, ez);
        pr.rotation.z = panelAngle;
        g.add(pr);
      }
      // closed hide flap across the back gable
      const gable = new THREE.Mesh(gableGeo, hideMat2);
      gable.position.set(0, 0.6, -halfLen + 0.03);
      g.add(gable);
      // bone skull finial lashed at the front ridge peak, jaw dropped
      const skull = new THREE.Mesh(skullGeo, boneMat);
      skull.position.set(0, ridgeH + 0.04, halfLen + 0.18);
      skull.rotation.set(0.1, propRand(t.x, t.z, 21) * Math.PI * 2, 0);
      g.add(skull);
      const jaw = new THREE.Mesh(jawGeo, boneMat);
      jaw.position.set(0, ridgeH - 0.08, halfLen + 0.22);
      g.add(jaw);
      // dried-blood war pennant + a bone charm hung from the front ridge, side
      // chosen deterministically so the row of tents never mirrors identically
      const side = propRand(t.x, t.z, 22) < 0.5 ? -1 : 1;
      const pennant = new THREE.Mesh(pennantGeo, pennantMat);
      pennant.position.set(side * 0.3, ridgeH - 0.24, halfLen + 0.05);
      pennant.rotation.z = side * 0.2;
      g.add(pennant);
      const cord = new THREE.Mesh(cordGeo, poleMat);
      cord.position.set(-side * 0.32, ridgeH - 0.16, halfLen + 0.02);
      g.add(cord);
      const charm = new THREE.Mesh(charmGeo, charmMat);
      charm.position.set(-side * 0.32, ridgeH - 0.32, halfLen + 0.02);
      charm.rotation.z = (propRand(t.x, t.z, 23) - 0.5) * 0.5;
      g.add(charm);
      // deterministic lean so a column of tents never reads as a stamped-out grid
      const leanX = (propRand(t.x, t.z, 24) - 0.5) * 0.05;
      const leanZ = (propRand(t.x, t.z, 25) - 0.5) * 0.05;
      g.scale.setScalar(t.scale);
      g.position.set(t.x, y - 0.05, t.z);
      g.rotation.set(leanX, t.rot, leanZ);
      group.add(shadowed(g));
      registerHideable(
        g,
        circleFootprint(t.x, t.z, 1.5 * t.scale, y + 3.4 * t.scale, 3.0 * t.scale),
      );
    }
  }

  // ---- crates: camp clutter (wooden crate / barrel mix), hideable ----------
  PROPS.crates.forEach(([x, z], i) => {
    const kind: PropKey = i % 3 === 2 ? 'barrel' : 'crateWooden';
    const s = kind === 'barrel' ? 1.25 : 1.3 + propRand(x, z, 5) * 0.15;
    const y = ground(x, z);
    const g = new THREE.Group();
    addParts(g, kind, {
      scale: s,
      euler: new THREE.Euler((propRand(x, z, 7) - 0.5) * 0.05, ((x * 13 + z * 7) % 1) * Math.PI, 0),
    });
    g.position.set(x, y - 0.04, z);
    group.add(shadowed(g));
    registerHideable(g, circleFootprint(x, z, 0.65, y + 1.35));
  });

  // ---- murloc mud huts: giant swamp mushrooms, doorway facing camp center --
  const hutCenter = PROPS.mudHuts.reduce(
    (acc, [hx, hz]) => ({
      x: acc.x + hx / PROPS.mudHuts.length,
      z: acc.z + hz / PROPS.mudHuts.length,
    }),
    { x: 0, z: 0 },
  );
  for (const [x, z] of PROPS.mudHuts) {
    const y = ground(x, z);
    const g = new THREE.Group();
    const sxz = 13 + propRand(x, z, 15) * 3;
    const sy = 10.5 + propRand(x, z, 16) * 3;
    addParts(g, 'mushroomRed', {
      y: -0.15,
      scale: [sxz, sy, sxz],
      euler: new THREE.Euler(
        (propRand(x, z, 13) - 0.5) * 0.1,
        propRand(x, z, 12) * Math.PI * 2,
        (propRand(x, z, 14) - 0.5) * 0.1,
      ),
    });
    // doorway decal aimed at the camp heart
    const face = Math.atan2(hutCenter.x - x, hutCenter.z - z);
    const doorway = new THREE.Mesh(new THREE.CircleGeometry(0.62, 8, 0, Math.PI), recessMat);
    doorway.position.set(Math.sin(face) * 1.0, 0.04, Math.cos(face) * 1.0);
    doorway.rotation.y = face;
    doorway.rotation.x = -0.14;
    noShadow.add(doorway);
    g.add(doorway);
    if (!lowProps) {
      // toadstool cluster at the foot
      const a2 = face + 0.9 + propRand(x, z, 18);
      addParts(g, 'mushroomTan', {
        x: Math.sin(a2) * 1.7,
        y: -0.05,
        z: Math.cos(a2) * 1.7,
        rot: propRand(x, z, 19) * Math.PI * 2,
        scale: 2.6 + propRand(x, z, 20) * 1.4,
      });
    }
    g.position.set(x, y, z);
    group.add(shadowed(g));
    registerHideable(g, circleFootprint(x, z, 1.1, y + 12.5, sxz));
  }

  // ---- ruin rings: a Growverse-ORIGINAL procedural stone ruin --------------
  // Not a CC0 pack model: weathered sandstone columns (some capitalled and
  // whole, some snapped to jagged stubs with rubble at the foot), plus a
  // toppled statue head, a broken stepped pedestal, and a fallen shaft at the
  // ring's heart, all built from primitives so each ruin is 1-of-1 geometry.
  // Shared geo/materials across the ring so a ruin collapses cheaply.
  const ruinStone = surfaceMat({ color: 0xb8ab8f, roughness: 0.96 });
  const ruinStoneDk = surfaceMat({ color: 0x968a70, roughness: 0.98 });
  const ruinMoss = surfaceMat({ color: 0x66724f, roughness: 1 });
  const plinthGeo = new THREE.CylinderGeometry(0.6, 0.66, 0.35, 8);
  const abacusGeo = new THREE.BoxGeometry(1.12, 0.22, 1.12);
  const echinusGeo = new THREE.CylinderGeometry(0.56, 0.42, 0.26, 12);
  const capSliverGeo = new THREE.CylinderGeometry(0.34, 0.4, 0.18, 12);
  const rubbleGeo = new THREE.BoxGeometry(0.36, 0.32, 0.34);
  const mossGeo = new THREE.BoxGeometry(0.5, 0.7, 0.04);
  // a weathered column of shaft-height h; a capital adds echinus + abacus, a
  // break instead caps the snapped shaft with a tilted sliver
  const buildColumn = (h: number, capital: boolean): THREE.Group => {
    const c = new THREE.Group();
    const plinth = new THREE.Mesh(plinthGeo, ruinStoneDk);
    plinth.position.y = 0.175;
    c.add(plinth);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, h, 12), ruinStone);
    shaft.position.y = 0.35 + h / 2;
    c.add(shaft);
    if (capital) {
      const ech = new THREE.Mesh(echinusGeo, ruinStone);
      ech.position.y = 0.35 + h + 0.13;
      c.add(ech);
      const ab = new THREE.Mesh(abacusGeo, ruinStoneDk);
      ab.position.y = 0.35 + h + 0.37;
      c.add(ab);
    } else {
      const cap = new THREE.Mesh(capSliverGeo, ruinStoneDk);
      cap.position.y = 0.35 + h + 0.06;
      cap.rotation.z = 0.14;
      c.add(cap);
    }
    return c;
  };
  for (const r of PROPS.ruinRings) {
    for (let i = 0; i < r.columns; i++) {
      const ang = (i / r.columns) * Math.PI * 2;
      const x = r.x + Math.sin(ang) * r.ringR,
        z = r.z + Math.cos(ang) * r.ringR;
      const intact = i % 4 === 1;
      const h = intact ? 4.0 + (i % 2) * 0.5 : 1.6 + (i % 3) * 0.8;
      const y = ground(x, z);
      const g = buildColumn(h, intact);
      // snapped stubs shed a couple of tumbled rubble chunks at the foot
      if (!intact && !lowProps)
        for (let k = 0; k < 2; k++) {
          const rub = new THREE.Mesh(
            rubbleGeo,
            propRand(x + k, z, 9) < 0.5 ? ruinStone : ruinStoneDk,
          );
          rub.position.set(
            (propRand(x, z, 10 + k) - 0.5) * 1.2,
            0.16,
            (propRand(x, z, 20 + k) - 0.5) * 1.2,
          );
          rub.rotation.set(
            propRand(x, z, 30 + k) * Math.PI,
            propRand(x, z, 40 + k) * Math.PI,
            propRand(x, z, 50 + k) * Math.PI,
          );
          rub.scale.setScalar(0.7 + propRand(x, z, 60 + k) * 0.6);
          g.add(rub);
        }
      // a weathered moss streak clings to every third shaft
      if (!lowProps && i % 3 === 0) {
        const moss = new THREE.Mesh(mossGeo, ruinMoss);
        moss.position.set(0, 0.35 + h * 0.4, 0.42);
        g.add(moss);
      }
      g.position.set(x, y - 0.1, z);
      g.rotation.set(
        0,
        propRand(x, z, 8) * Math.PI,
        (i % 3 === 0 ? 0.1 : 0.03) * (i % 2 ? 1 : -1),
        'YZX',
      );
      group.add(shadowed(g));
      registerHideable(g, circleFootprint(x, z, 0.7, y + h + 0.6, 2.2));
    }
    if (lowProps) continue;
    // toppled relics at the ring's heart: a half-buried head, a broken stepped
    // pedestal, and a fallen shaft lying across the rubble
    const fy = ground(r.x - 2, r.z - 3);
    const g = new THREE.Group();
    const head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), ruinStone);
    skull.scale.set(0.9, 1.15, 0.95);
    head.add(skull);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.3), ruinStoneDk);
    brow.position.set(0, 0.35, 0.72);
    head.add(brow);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.5, 0.3), ruinStone);
    nose.position.set(0, 0.05, 0.82);
    head.add(nose);
    for (const dx of [-0.32, 0.32]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), recessMat);
      eye.position.set(dx, 0.22, 0.78);
      head.add(eye);
    }
    head.position.set(-0.4, -0.35, 0.3);
    head.rotation.set(0.34, propRand(r.x, r.z, 30) * Math.PI * 2, 0.22);
    g.add(head);
    const ped = new THREE.Group();
    ped.add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 1.5), ruinStoneDk));
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.1), ruinStone);
    step.position.y = 0.5;
    ped.add(step);
    const stub = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.7), ruinStoneDk);
    stub.position.set(0.2, 0.95, -0.1);
    stub.rotation.z = 0.2;
    ped.add(stub);
    ped.position.set(2.1, -0.1, -1.3);
    ped.rotation.set(0.12, propRand(r.x, r.z, 31) * Math.PI, -0.16, 'YZX');
    g.add(ped);
    const fallen = buildColumn(3.4, false);
    fallen.position.set(-1.2, 0.55, -2.2);
    fallen.rotation.set(Math.PI / 2 - 0.06, 0.6 + (propRand(r.x, r.z, 32) - 0.5) * 0.4, 0, 'YXZ');
    g.add(fallen);
    g.position.set(r.x - 2, fy, r.z - 3);
    group.add(shadowed(g));
  }

  // ---- mine entrances: timber portal, rock mound, ore cart, lantern --------
  for (const m of PROPS.mines) {
    const g = new THREE.Group();
    const abandonedCrypt = m.x < -140 && m.z > 590 && m.z < 630;
    for (const sx of [-1.45, 1.45]) {
      addParts(g, 'timberPillar', { x: sx, scale: [3.4, 3.5, 3.4] });
    }
    // lintel + cap beam: the same square timber laid across the posts
    addParts(g, 'timberPillar', {
      y: 3.42,
      x: -2.2,
      euler: new THREE.Euler(0, 0, -Math.PI / 2),
      scale: [3.6, 4.4, 3.6],
    });
    addParts(g, 'timberPillar', {
      y: 3.85,
      x: -2.45,
      euler: new THREE.Euler(0, 0, -Math.PI / 2),
      scale: [3.0, 4.9, 3.0],
    });
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.1), holeMat);
    hole.position.set(0, 1.55, -0.2);
    noShadow.add(hole);
    g.add(hole);
    // boulder mound swallowing the portal (same mound the collider blocks):
    // pairs of mid-sized granite rocks per anchor read as a rubble pile where
    // one giant scaled rock would read as a box
    const mound: [number, number, number, number][] = abandonedCrypt
      ? [
          [0.2, 1.35, -3.2, 2.35],
          [-2.8, 0.25, -2.35, 1.75],
          [2.65, 0.3, -2.3, 1.75],
          [-1.7, 0.1, -1.25, 1.15],
          [1.75, 0.1, -1.2, 1.1],
          [0.2, 2.8, -4.15, 2.0],
          [-1.35, 1.45, -3.45, 1.55],
          [1.45, 1.5, -3.35, 1.5],
          [0, 0.15, -1.85, 1.2],
          [-3.45, 0.6, -3.5, 1.15],
          [3.35, 0.65, -3.45, 1.1],
          [0.1, 3.35, -2.85, 1.25],
        ]
      : [
          [0, 1.4, -3.0, 2.6],
          [-2.7, 0.3, -2.0, 1.9],
          [2.7, 0.35, -2.2, 2.0],
          [-1.6, 0.1, -1.0, 1.2],
          [1.8, 0.1, -0.9, 1.1],
          [0.3, 3.0, -4.2, 2.3],
          [-1.4, 1.6, -3.4, 1.8],
          [1.5, 1.7, -3.2, 1.7],
          [0, 0.2, -1.6, 1.4],
        ];
    const rockKinds: PropKey[] = lowProps
      ? ['rockLargeD']
      : ['rockTallA', 'rockLargeD', 'rockTallH', 'rockLargeF'];
    for (let i = 0; i < mound.length; i++) {
      const [rx, ry, rz, rr] = mound[i];
      const kind = rockKinds[(i * 2 + 1) % rockKinds.length];
      const a = propAsset(kind);
      addParts(g, kind, {
        x: rx,
        y: ry,
        z: rz,
        scale: (2.1 * rr) / Math.max(a.size.x, a.size.z),
        euler: new THREE.Euler(
          (propRand(m.x, m.z, i + 80) - 0.5) * 0.5,
          propRand(m.x, m.z, i + 70) * Math.PI,
          (propRand(m.x, m.z, i + 90) - 0.5) * 0.5,
        ),
      });
    }
    // ore cart + raw copper ore in the bed. A Growverse-ORIGINAL procedural
    // mine cart (not a CC0 pack model): a plank box on four wheels built from
    // primitives, so the mine is dressed with 1-of-1 geometry. The ore piles
    // stay the shared ore-rock prop (also used across the mines).
    if (!abandonedCrypt) {
      const cartWood = surfaceMat({ color: 0x6b4f36, roughness: 0.9 });
      const cartPlank = surfaceMat({ color: 0x82623f, roughness: 0.85 });
      const cartIron = surfaceMat({ color: 0x2b2622, roughness: 0.7 });
      const cartG = new THREE.Group();
      // plank bed floor + four side/end boards forming an open-topped box
      const bed = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 1.0), cartPlank);
      bed.position.y = 0.55;
      cartG.add(bed);
      for (const dz of [-0.5, 0.5]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.08), cartWood);
        side.position.set(0, 0.72, dz);
        cartG.add(side);
      }
      for (const dx of [-0.85, 0.85]) {
        const end = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.0), cartWood);
        end.position.set(dx, 0.72, 0);
        cartG.add(end);
      }
      // corner posts + a pair of iron axles carrying four spoked wheels
      for (const dx of [-0.82, 0.82])
        for (const dz of [-0.46, 0.46]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 0.1), cartWood);
          post.position.set(dx, 0.55, dz);
          cartG.add(post);
        }
      const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 12);
      const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.16, 8);
      for (const dx of [-0.6, 0.6]) {
        const axle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.24), cartIron);
        axle.position.set(dx, 0.35, 0);
        cartG.add(axle);
        for (const dz of [-0.56, 0.56]) {
          const wheel = new THREE.Mesh(wheelGeo, cartWood);
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(dx, 0.35, dz);
          cartG.add(wheel);
          const hub = new THREE.Mesh(hubGeo, cartIron);
          hub.rotation.x = Math.PI / 2;
          hub.position.set(dx, 0.35, dz);
          cartG.add(hub);
        }
      }
      cartG.position.set(2.8, 0, 1.6);
      cartG.rotation.y = 0.5;
      g.add(cartG);
      addParts(g, 'oreRocks', { x: 2.75, y: 0.78, z: 1.55, rot: 0.9, scale: 2.6 });
      addParts(g, 'oreRocks', { x: 3.4, z: 0.4, rot: 2.2, scale: 1.8 });
    }
    if (!lowProps) {
      // hanging lantern on the right post
      addParts(g, 'lanternWall', { x: 1.45, y: 2.0, z: 0.28, scale: 1.25 });
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.26, 6), lanternMat);
      glass.position.set(1.45, 2.52, 1.32);
      noShadow.add(glass);
      g.add(glass);
    }
    g.position.set(m.x, ground(m.x, m.z), m.z);
    g.rotation.y = m.rot;
    group.add(shadowed(g));
    // mound circle behind the portal — same offset/radius as the collider
    const mx = m.x - 3.4 * Math.sin(m.rot),
      mz = m.z - 3.4 * Math.cos(m.rot);
    registerHideable(g, circleFootprint(mx, mz, 5, ground(mx, mz) + 5.2));
  }

  // ---- fishing docks: a walkable plank pier out over the water, moored rowboat,
  // stone hut. The deck rides the raised dock-deck terrain (sim/world.ts
  // `dockDeckOffset`), so the planks you see ARE the surface you walk on; pilings drop
  // from the deck edges into the water and a low rail runs both sides. Local -z faces
  // the water (matches the terrain offset's local frame).
  const dockPlankMat = surfaceMat({ color: 0x8a6a45, roughness: 0.92 }); // weathered desert timber (matches village Wood)
  const dockPlankMat2 = surfaceMat({ color: 0x775638, roughness: 0.92 }); // alternating board tone for plank seams
  const dockPostMat = surfaceMat({ color: 0x5a4228, roughness: 0.95 });
  const dockPostGeo = new THREE.CylinderGeometry(0.14, 0.17, 1, 6); // underwater support pilings
  const railPostGeo = new THREE.BoxGeometry(0.2, 1, 0.2); // square milled newel posts
  const railBeamGeo = new THREE.BoxGeometry(0.16, 0.14, 1); // rectangular rail beams (long axis +z)
  const DOCK_PILE_BOTTOM = WATER_LEVEL - 2.6;
  const DOCK_HALFW = 2.4; // walkable half-width, must match sim/world.ts DOCK_HALFW
  const DECK_HALFW = 2.5; // visual half-width: overhangs the walkable strip so the raised terrain lip never shows as a sandbar (the overhang hangs over water, unreachable)
  const DECK_THICK = 0.3;
  const DECK_LIFT = 0.05; // seat the boards a hair ABOVE the walkable terrain so plank tops never z-fight with the ground mesh
  const DECK_Z_SHORE = 3.9; // shore end of the boards (local +z): buried well onto land past the graded ramp (sim DOCK_BACK=2.8) so the deck meets the ground with no raw dirt seam
  const DECK_Z_TIP = -7.7; // water tip (local -z), at the terrain tip-taper start so the deck stays full-height
  const N_PLANKS = 26;
  const deckPlankGeo = new THREE.BoxGeometry(DECK_HALFW * 2, DECK_THICK, 0.72);
  for (const d of PROPS.docks) {
    const y = ground(d.x, d.z);
    const g = new THREE.Group();
    const key = d.x * 3.3 + d.z * 1.7;
    const dc = Math.cos(d.rot);
    const ds = Math.sin(d.rot);
    // local (lx,lz) -> world, matching the group's position + rotation.y = d.rot
    const worldOf = (lx: number, lz: number): [number, number] => [
      d.x + lx * dc + lz * ds,
      d.z - lx * ds + lz * dc,
    ];
    // solid plank deck: overlapping cross-boards, each seated so its TOP sits just above
    // the walkable terrain here (sim/world.ts dockDeckOffset). Over the water that is the
    // flat raised deck; at the shore it follows the natural ramp up onto land. Alternate
    // boards ride a touch higher (DECK_LIFT vs DECK_LIFT*2), which both breaks the coplanar
    // overlap that was z-fighting as the camera moved AND reads as weathered plank relief;
    // the boards overhang the raised strip so it never shows a sandy terrain lip.
    const plankStep = (DECK_Z_TIP - DECK_Z_SHORE) / N_PLANKS;
    for (let i = 0; i <= N_PLANKS; i++) {
      const lz = DECK_Z_SHORE + i * plankStep;
      const [wx, wz] = worldOf(0, lz);
      const top = ground(wx, wz);
      const plank = new THREE.Mesh(deckPlankGeo, i % 2 ? dockPlankMat2 : dockPlankMat);
      const lift = i % 2 ? DECK_LIFT * 2 : DECK_LIFT;
      plank.position.set(0, top - y - DECK_THICK / 2 + lift, lz);
      g.add(plank);
    }
    // The deck TOP profile, sampled at the deck CENTER (lx=0). This is the key to a clean
    // railing: the sim's dockDeckOffset only raises the deck fully in the middle and blends
    // OUT toward the edges, so sampling terrain at the rail line (the outer edge) returned a
    // noisy, partially-raised height that made the rail sawtooth. The center profile is flat
    // over the water span and a smooth ramp at the shore, so every post/rail/skirt reads off
    // it for a level, uniform railing.
    const deckTopAt = (lz: number): number => {
      const [wx, wz] = worldOf(0, lz);
      return ground(wx, wz) - y;
    };
    // solid substrate ribbon under the boards + a fascia skirt down BOTH long edges: a dense
    // chain of overlapping boxes whose TOP tracks the deck profile and whose body drops
    // SUB_DEPTH below. The wide substrate backs the shore-ramp riser gaps (no dirt shows
    // through the boards from above) and the edge skirts are outset past the board edge and
    // hang down past the terrain, hiding the raised-earth embankment beside the shore ramp so
    // no dirt shows from the sides either. Everything is wood, from every angle.
    const SUB_STEPS = N_PLANKS * 2; // dense: no gap between substrate boxes
    const SUB_DEPTH = 1.4; // tall enough to seal any shore-ramp riser and skirt the embankment
    const subStep = (DECK_Z_TIP - DECK_Z_SHORE) / SUB_STEPS;
    const subGeo = new THREE.BoxGeometry(DECK_HALFW * 2, SUB_DEPTH, Math.abs(subStep) + 0.28);
    const skirtGeo = new THREE.BoxGeometry(0.16, SUB_DEPTH, Math.abs(subStep) + 0.28);
    for (let i = 0; i <= SUB_STEPS; i++) {
      const lz = DECK_Z_SHORE + i * subStep;
      const top = deckTopAt(lz);
      const sub = new THREE.Mesh(subGeo, dockPlankMat2);
      // seat the box TOP a hair below the deck top so it backs the risers
      sub.position.set(0, top - SUB_DEPTH / 2 - 0.02, lz);
      g.add(sub);
      for (const side of [-1, 1]) {
        const skirt = new THREE.Mesh(skirtGeo, dockPlankMat);
        skirt.position.set(side * (DECK_HALFW + 0.06), top - SUB_DEPTH / 2 - 0.02, lz);
        g.add(skirt);
      }
    }
    // Railing: square newel posts down both long edges connected by three stacked
    // rectangular rail beams (top, mid, kick). Post heights and beam heights are all offset
    // from the CENTER-sampled deck profile (deckTopAt), so over the flat water span the rail
    // is dead level and it ramps smoothly with the deck at the shore, uniform height end to
    // end. The rails hug the two long edges only, so the shore end face stays open to walk on.
    const N_RAIL_POSTS = 12;
    const RAIL_Z_SHORE = DECK_Z_SHORE - 0.35; // first post at the shore end of the boards
    const RAIL_Z_TIP = DECK_Z_TIP; // last post at the water tip: rails reach the deck end
    const RAIL_HEIGHTS = [1.12, 0.72, 0.32]; // top, mid, kick beam heights above the deck
    const RAIL_POST_H = 1.24; // newel post height above the deck (a touch above the top rail)
    const railLx = DECK_HALFW - 0.18;
    for (const side of [-1, 1] as const) {
      const lx = side * railLx;
      const nodes: { lz: number; deckTop: number }[] = [];
      for (let i = 0; i < N_RAIL_POSTS; i++) {
        const lz = RAIL_Z_SHORE + (i / (N_RAIL_POSTS - 1)) * (RAIL_Z_TIP - RAIL_Z_SHORE);
        const deckTop = deckTopAt(lz);
        nodes.push({ lz, deckTop });
        // support piling dropping from the deck into the water (kept round like a real pile)
        const pileBottom = DOCK_PILE_BOTTOM - y;
        const pile = new THREE.Mesh(dockPostGeo, dockPostMat);
        pile.position.set(lx, (deckTop + pileBottom) / 2, lz);
        pile.scale.y = Math.max(0.3, deckTop - pileBottom);
        g.add(pile);
        // square newel post standing proud of the deck
        const post = new THREE.Mesh(railPostGeo, dockPostMat);
        post.position.set(lx, deckTop + RAIL_POST_H / 2, lz);
        post.scale.y = RAIL_POST_H;
        g.add(post);
      }
      // connect consecutive posts with three box rail beams that ramp with the deck. A beam
      // long axis is +z; to align it along the (z,y) segment rotate about X by atan2(-dy,dz).
      for (let i = 0; i < N_RAIL_POSTS - 1; i++) {
        const a = nodes[i];
        const b = nodes[i + 1];
        const dz = b.lz - a.lz;
        for (const railH of RAIL_HEIGHTS) {
          const y0 = a.deckTop + railH;
          const y1 = b.deckTop + railH;
          const dy = y1 - y0;
          const beam = new THREE.Mesh(railBeamGeo, dockPostMat);
          beam.position.set(lx, (y0 + y1) / 2, (a.lz + b.lz) / 2);
          beam.rotation.x = Math.atan2(-dy, dz);
          beam.scale.z = Math.hypot(dz, dy) + 0.02; // slight overlap into the posts, no gaps
          g.add(beam);
        }
      }
    }
    // shoreside hut: seat it on the natural ground under its OWN footprint (offset
    // from the deck origin), so it is not left floating at the group origin height
    const hut = propAsset('house3');
    const [hutWx, hutWz] = worldOf(d.hutLocal.x, d.hutLocal.z);
    addParts(g, 'house3', {
      x: d.hutLocal.x,
      z: d.hutLocal.z,
      y: ground(hutWx, hutWz) - y,
      scale: [(d.hutLocal.hw * 2) / hut.size.x, 2.6 / hut.size.y, (d.hutLocal.hd * 2) / hut.size.z],
    });
    if (!lowProps) {
      // supply clutter organized on the ground beside the shoreside shack (off the
      // walkable deck), a tidy row of barrels and a crate against the shack's west wall
      const clutter: [number, number, 'barrel' | 'crateWooden', number, number][] = [
        [d.hutLocal.x - 1.9, d.hutLocal.z + 1.2, 'barrel', 0.95, 5],
        [d.hutLocal.x - 1.7, d.hutLocal.z - 1.2, 'barrel', 1.15, 6],
        [d.hutLocal.x - 1.8, d.hutLocal.z, 'crateWooden', 0.9, 7],
      ];
      for (const [clx, clz, kind, sc, seedIdx] of clutter) {
        const [cwx, cwz] = worldOf(clx, clz);
        addParts(g, kind, {
          x: clx,
          y: ground(cwx, cwz) - y + 0.02,
          z: clz,
          rot: keyRand(key, seedIdx) * Math.PI,
          scale: sc,
        });
      }
    }
    // rowboat moored beside the deck's far end: floats at water level when the
    // shore dips below it, otherwise sits hauled up on the bank
    const boatLx = DECK_HALFW + 1.8,
      boatLz = -5.0;
    const boatWx = d.x + boatLx * Math.cos(d.rot) + boatLz * Math.sin(d.rot);
    const boatWz = d.z - boatLx * Math.sin(d.rot) + boatLz * Math.cos(d.rot);
    const boatGround = ground(boatWx, boatWz);
    const isAfloat = boatGround < WATER_LEVEL - 0.1;
    addParts(g, 'rowboat', {
      x: boatLx,
      z: boatLz,
      y: (isAfloat ? WATER_LEVEL + 0.22 : boatGround + 0.08) - y,
      rot: 0.5 + (keyRand(key, 8) - 0.5) * 0.4,
      scale: 1.35,
      euler: isAfloat
        ? undefined
        : new THREE.Euler(0.04, 0.5 + (keyRand(key, 8) - 0.5) * 0.4, 0.16),
    });
    g.position.set(d.x, y, d.z);
    g.rotation.y = d.rot;
    group.add(shadowed(g));
    // stone hut OBB — same offset/extents/rotation as the collider
    const hc = Math.cos(d.rot),
      hs = Math.sin(d.rot);
    const hx = d.x + d.hutLocal.x * hc + d.hutLocal.z * hs;
    const hz = d.z - d.hutLocal.x * hs + d.hutLocal.z * hc;
    registerHideable(
      g,
      obbFootprint(hx, hz, d.hutLocal.hw, d.hutLocal.hd, d.rot, ground(hx, hz) + 2.9),
    );
  }

  // ---- delve entrance: Meshy portal-door + animated void + carved name lintel -
  // Town/hub is +z (north) of Reliquary Hill. The portal-door model sits just
  // south of Brother Halven facing +z; it has its own stone backing slab so the
  // animated shader plane (FrontSide) reads as a solid void from the approach and
  // is invisible from behind. The carved name slab rides the model's crown.
  // All render-only, players enter by talking to Halven; leaveDelve drops them
  // back at archZ (doorPos.z - 4).
  const delvePortals: THREE.Mesh[] = [];
  for (const dm of PROPS.delveMarkers ?? []) {
    if (!loadedProps.has('delveEntrance2')) continue;
    const gy = ground(dm.x, dm.z);

    // Portal-door model with its own backing slab, no separate vault sphere needed.
    // Rotation 0 = portal face toward +z (town); add yaw: Math.PI to the asset def
    // if the model loads backwards after inspecting in-game.
    const arch = propAsset('delveEntrance2');
    const SX = 3.6,
      SY = 3.6,
      SZ = 3.6;
    const archZ = dm.z - 4; // south of Halven (also the leaveDelve drop: doorPos.z - 4)
    const ag = new THREE.Group();
    for (const part of arch.parts) {
      const m = new THREE.Mesh(part.geo, part.mat);
      m.castShadow = true;
      m.receiveShadow = true;
      ag.add(m);
    }
    ag.scale.set(SX, SY, SZ);
    ag.position.set(dm.x, gy, archZ);
    group.add(ag);

    // portal opening: doorway is roughly half the model's width and a bit over
    // half its height; the animated shader plane sits on the town-facing front face.
    // Tune these fractions after seeing the model in-game.
    const openW = arch.size.x * SX * 0.5;
    const openH = arch.size.y * SY * 0.55;
    const openCY = gy + arch.size.y * SY * 0.32; // centre of the doorway opening
    const townFaceZ = archZ + (arch.size.z * SZ) / 2; // model's +z front face

    // opaque dark backsplash filling the doorway behind the void plane, so no
    // red leaks through from the rear and you can't see daylight through the
    // opening, the portal reads as a solid one-way threshold. Slightly larger
    // than the opening to cover the gap, recessed a touch into the model.
    const backsplash = new THREE.Mesh(
      new THREE.PlaneGeometry(openW * 1.1, openH * 1.1),
      new THREE.MeshBasicMaterial({ color: 0x05030a, side: THREE.DoubleSide }),
    );
    backsplash.position.set(dm.x, openCY, townFaceZ - 0.35);
    group.add(backsplash);

    // swirling void plane, FrontSide, drawn over the dark backsplash so the
    // animated vortex reads against true black from the town approach.
    const portal = new THREE.Mesh(new THREE.PlaneGeometry(openW, openH), delvePortalMaterial());
    portal.position.set(dm.x, openCY, townFaceZ - 0.05);
    portal.renderOrder = 3;
    group.add(portal);
    delvePortals.push(portal);

    // deep purple glow spilling from the mouth, matches the new portal palette.
    const mouthLight = new THREE.PointLight(0x7010b0, 8, 18, 2);
    mouthLight.position.set(dm.x, gy + 2.4, townFaceZ + 0.4);
    mouthLight.userData.baseIntensity = 8;
    group.add(mouthLight);
    fireLights.push(mouthLight);

    // embers drifting up out of the mouth (self-animating; not a mesh, so the
    // static merge skips it automatically)
    group.add(buildDelveEmbers(dm.x, gy + 1.0, townFaceZ + 0.2, openW * 0.34, openH * 0.85));

    // two flaming braziers flanking the mouth, a tended-entrance read. Reuse
    // the campfire flame + fire-light pattern so the renderer flickers them and
    // sheds embers for free; the warm torch orange plays off the red void.
    const postMat = surfaceMat({ color: 0x2a2622, roughness: 1 });
    const bowlMat = surfaceMat({ color: 0x191512, roughness: 1 });
    for (const side of [-1, 1]) {
      const bx = dm.x + side * (openW * 0.5 + 0.7);
      const bz = townFaceZ + 0.5; // just in front of the mouth, on the town side
      const by = ground(bx, bz);
      const bg = new THREE.Group();
      const postH = 2.0;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.33, postH, 8), postMat);
      post.position.y = postH / 2;
      bg.add(post);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.26, 0.38, 10), bowlMat);
      bowl.position.y = postH + 0.1;
      bg.add(bowl);
      const flame = new THREE.Mesh(
        flameGeo,
        new THREE.MeshLambertMaterial({
          color: 0xffaa33,
          emissive: 0xff6a1e,
          emissiveIntensity: usePbr ? 2.2 : 1.4,
          transparent: true,
          opacity: 0.92,
        }),
      );
      flame.position.y = postH + 0.28;
      flame.scale.setScalar(0.72);
      bg.add(flame);
      flames.push(flame);
      noShadow.add(flame);
      const light = new THREE.PointLight(0xff8a3a, 9, 13, 2);
      light.position.y = postH + 0.55;
      light.userData.baseIntensity = 8;
      bg.add(light);
      fireLights.push(light);
      bg.position.set(bx, by, bz);
      group.add(shadowed(bg));
    }

    // (ruin-column dressing removed, the portal-door model has its own pillars,
    // so flanking rubble columns just cluttered and overpowered the silhouette.
    // Mossy boulders flanking the approach feet keep it grounded without competing.)
    const rubble: { kind: PropKey; dx: number; dz: number; s: Scale; rot?: number }[] = [
      { kind: 'rockLargeD', dx: -8.5, dz: -1.8, s: 1.7, rot: 2.1 },
      { kind: 'rockLargeD', dx: 8.0, dz: 2.2, s: 1.45, rot: 0.7 },
    ];
    for (const rb of rubble) {
      const rx = dm.x + rb.dx,
        rz = archZ + rb.dz;
      const rgrp = new THREE.Group();
      addParts(rgrp, rb.kind, { scale: rb.s, rot: rb.rot });
      rgrp.position.set(rx, ground(rx, rz) - 0.08, rz);
      group.add(shadowed(rgrp));
    }

    // ---- carved name slab as the arch's town-facing lintel-sign ------------
    const slabY = gy + arch.size.y * SY * 0.8; // mounted on the crown, above the mouth
    const slabZ = townFaceZ + 0.1; // proud of the town face so it never z-fights the arch

    // stone backing box
    const backMat = surfaceMat({ color: 0x3a3530 });
    const backing = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.9, 0.18), backMat);
    backing.position.set(dm.x, slabY, slabZ);
    backing.castShadow = true;
    group.add(backing);

    // grimy canvas inscription on the town-facing (+z) surface
    const CW = 512,
      CH = 96;
    const cv = document.createElement('canvas');
    cv.width = CW;
    cv.height = CH;
    const ctx = cv.getContext('2d')!;

    ctx.fillStyle = '#2b2722';
    ctx.fillRect(0, 0, CW, CH);
    ctx.strokeStyle = '#16120e';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, CW - 12, CH - 12);

    // horizontal grime streaks (deterministic)
    for (let i = 0; i < 10; i++) {
      const gx = hash2(dm.x + i * 1.3, dm.z, 0x6d61726b) * CW;
      const gy2 = hash2(dm.z + i * 1.7, dm.x, 0x6d61726b) * CH;
      const gw = 20 + hash2(i * 3.1, dm.x + dm.z, 0x6d61726b) * 55;
      ctx.fillStyle = `rgba(6,4,2,${0.22 + hash2(i * 5.9, dm.z, 0x6d61726b) * 0.32})`;
      ctx.fillRect(gx - gw / 2, gy2 - 1.8, gw, 3.6);
    }

    // carved text, shadow pass then bright pass for depth illusion. Shrink the
    // font until the (localized) name fits inside the slab border so a long title
    // like "THE COLLAPSED RELIQUARY" is never clipped at the canvas edges.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = (delveLabel ? delveLabel(dm.delveId) : dm.delveId).toUpperCase();
    const maxTextW = CW - 44; // inside the 6px stroke + breathing room
    // Step down until it fits (kerning/hinting make a single proportional guess
    // unreliable for wide-glyph locales, e.g. CJK names), with a 16px floor.
    let fontPx = 34;
    ctx.font = `bold ${fontPx}px Georgia, "Times New Roman", serif`;
    while (fontPx > 16 && ctx.measureText(label).width > maxTextW) {
      fontPx -= 1;
      ctx.font = `bold ${fontPx}px Georgia, "Times New Roman", serif`;
    }
    ctx.fillStyle = '#120f0b';
    ctx.fillText(label, CW / 2 + 2, CH / 2 + 2);
    ctx.fillStyle = '#7d6e59';
    ctx.fillText(label, CW / 2, CH / 2);

    const tex = new THREE.CanvasTexture(cv);
    const faceMat = new THREE.MeshBasicMaterial({ map: tex });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.78), faceMat);
    // sit flush on the town-facing face of the backing (PlaneGeometry faces +z)
    face.position.set(dm.x, slabY, slabZ + 0.1);
    group.add(face);
  }

  // ---- flush instanced batches ---------------------------------------------
  const cullables: PropCullable[] = [];
  for (const batch of instanceBatches.values()) {
    const a = propAsset(batch.key);
    for (const part of a.parts) {
      const im = new THREE.InstancedMesh(part.geo, part.mat, batch.mats.length);
      for (let i = 0; i < batch.mats.length; i++) im.setMatrixAt(i, batch.mats[i]);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      im.computeBoundingBox();
      group.add(im);
      const bounds = cullableBounds(im, im.boundingBox, im.boundingSphere);
      if (bounds) cullables.push(bounds);
    }
  }

  // animated flames + camera-ghost props (hidden individually) stay un-merged
  const keep = new Set<THREE.Object3D>(flames);
  for (const m of keepFromMerge) keep.add(m);
  for (const p of delvePortals) keep.add(p); // shader-driven void: keep its transparency/renderOrder
  const staticMeshes = mergeStaticMeshes(group, keep);
  for (const sm of staticMeshes) {
    const bounds = cullableBounds(sm, sm.geometry.boundingBox, sm.geometry.boundingSphere);
    if (bounds) cullables.push(bounds);
  }

  return {
    group,
    flames,
    fireLights,
    update(
      camX: number,
      camY: number,
      camZ: number,
      eyeX: number,
      eyeY: number,
      eyeZ: number,
      fogFar: number,
    ): void {
      for (const c of cullables) {
        c.obj.visible = cullableVisible(c, camX, camZ, fogFar);
      }
      for (const h of hideables) {
        const dx = camX - h.x,
          dz = camZ - h.z;
        if (Math.hypot(dx, dz) - h.cull >= fogFar) {
          h.group.visible = false; // fully fogged: drop it (shadow is out of range too)
          continue;
        }
        // Hide from the camera while still casting a shadow: disable colour +
        // depth writes, not the object.
        const hide = cameraSegmentHitsFootprint(h, eyeX, eyeY, eyeZ, camX, camY, camZ);
        if (h.mats.length === 0) {
          h.hidden = hide;
          h.group.visible = !hide;
          continue;
        }
        h.group.visible = true;
        if (hide !== h.hidden) {
          h.hidden = hide;
          for (const m of h.mats) {
            m.mat.colorWrite = !hide;
            m.mat.depthWrite = hide ? false : m.depthWrite;
          }
        }
      }
    },
  };
}

/** One material we flip on/off, remembering its original depth-write state. */
interface ToggleMat {
  mat: THREE.Material;
  depthWrite: boolean;
}

// A prop that the camera ghosts through and the renderer hides whenever the
// eye-to-camera segment crosses its footprint (below `topY`). Either a circle
// (`r`) or an OBB (`hw`/`hd`/`rot`), matching the collider it mirrors. "Hidden"
// disables colour/depth writes rather than `visible = false`, so the structure
// stays in the shadow pass and keeps casting its shadow.
interface Hideable {
  group: THREE.Group;
  mats: ToggleMat[]; // cloned per-structure so the toggle is local
  hidden: boolean;
  x: number; // footprint centre (world XZ)
  z: number;
  topY: number; // roof height; a camera above this never hides the structure
  cull: number; // bounding radius for the fog-far cull
  r?: number; // circle footprint
  hw?: number; // OBB half-extents + yaw
  hd?: number;
  rot?: number;
}

type Footprint = Omit<Hideable, 'group' | 'mats' | 'hidden'>;

function circleFootprint(x: number, z: number, r: number, topY: number, cull = r): Footprint {
  return { x, z, r, topY, cull };
}

function obbFootprint(
  x: number,
  z: number,
  hw: number,
  hd: number,
  rot: number,
  topY: number,
): Footprint {
  return { x, z, hw, hd, rot, topY, cull: Math.hypot(hw, hd) };
}

function pointInsideFootprint(h: Hideable, x: number, z: number): boolean {
  const dx = x - h.x,
    dz = z - h.z;
  if (h.r !== undefined) return dx * dx + dz * dz < h.r * h.r;
  // world -> OBB local (three.js rotation.y convention), mirrors colliders.rotY
  const c = Math.cos(h.rot!),
    s = Math.sin(h.rot!);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) < h.hw! && Math.abs(lz) < h.hd!;
}

function segmentCircleEntry(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  r: number,
): number {
  const dx = bx - ax,
    dz = bz - az;
  const a = dx * dx + dz * dz;
  if (a < 1e-12) return Infinity;
  const fx = ax - cx,
    fz = az - cz;
  const c = fx * fx + fz * fz - r * r;
  if (c < 0) return 0;
  const b = 2 * (fx * dx + fz * dz);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  return (-b - Math.sqrt(disc)) / (2 * a);
}

function segmentObbEntry(h: Hideable, ax: number, az: number, bx: number, bz: number): number {
  const c = Math.cos(h.rot!),
    s = Math.sin(h.rot!);
  const adx = ax - h.x,
    adz = az - h.z;
  const bdx = bx - h.x,
    bdz = bz - h.z;
  const lax = adx * c - adz * s;
  const laz = adx * s + adz * c;
  const lbx = bdx * c - bdz * s;
  const lbz = bdx * s + bdz * c;
  if (Math.abs(lax) < h.hw! && Math.abs(laz) < h.hd!) return 0;

  const dx = lbx - lax,
    dz = lbz - laz;
  let tmin = -Infinity,
    tmax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (lax < -h.hw! || lax > h.hw!) return Infinity;
  } else {
    let t1 = (-h.hw! - lax) / dx,
      t2 = (h.hw! - lax) / dx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (Math.abs(dz) < 1e-9) {
    if (laz < -h.hd! || laz > h.hd!) return Infinity;
  } else {
    let t1 = (-h.hd! - laz) / dz,
      t2 = (h.hd! - laz) / dz;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (tmax < tmin || tmax < 0) return Infinity;
  return tmin;
}

function cameraSegmentHitsFootprint(
  h: Hideable,
  eyeX: number,
  eyeY: number,
  eyeZ: number,
  camX: number,
  camY: number,
  camZ: number,
): boolean {
  if (
    (eyeY < h.topY && pointInsideFootprint(h, eyeX, eyeZ)) ||
    (camY < h.topY && pointInsideFootprint(h, camX, camZ))
  ) {
    return true;
  }
  const t =
    h.r !== undefined
      ? segmentCircleEntry(eyeX, eyeZ, camX, camZ, h.x, h.z, h.r)
      : segmentObbEntry(h, eyeX, eyeZ, camX, camZ);
  if (t < 0 || t > 1) return false;
  return eyeY + (camY - eyeY) * t < h.topY;
}

interface PropCullable {
  obj: THREE.Object3D;
  hasBox: boolean;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cz: number;
  r: number;
}

function cullableBounds(
  obj: THREE.Object3D,
  box: THREE.Box3 | null,
  sphere: THREE.Sphere | null,
): PropCullable | undefined {
  if (box) {
    const fallback = sphere ?? box.getBoundingSphere(new THREE.Sphere());
    return {
      obj,
      hasBox: true,
      minX: box.min.x,
      maxX: box.max.x,
      minZ: box.min.z,
      maxZ: box.max.z,
      cx: fallback.center.x,
      cz: fallback.center.z,
      r: fallback.radius,
    };
  }
  if (!sphere) return undefined;
  return {
    obj,
    hasBox: false,
    minX: sphere.center.x - sphere.radius,
    maxX: sphere.center.x + sphere.radius,
    minZ: sphere.center.z - sphere.radius,
    maxZ: sphere.center.z + sphere.radius,
    cx: sphere.center.x,
    cz: sphere.center.z,
    r: sphere.radius,
  };
}

function cullableVisible(c: PropCullable, camX: number, camZ: number, fogFar: number): boolean {
  const dx = camX < c.minX ? c.minX - camX : camX > c.maxX ? camX - c.maxX : 0;
  const dz = camZ < c.minZ ? c.minZ - camZ : camZ > c.maxZ ? camZ - c.maxZ : 0;
  if (Math.hypot(dx, dz) < fogFar) return true;
  if (c.hasBox) return false;
  return Math.hypot(c.cx - camX, c.cz - camZ) - c.r < fogFar;
}

// Bake every static prop mesh into world space and merge per
// (material, castShadow, z-band). Flames (animated) and InstancedMeshes
// survive untouched, as do the PointLights (not meshes). The merged meshes
// replace the originals on the same group; emptied sub-groups are left in
// place (they carry lights). Geometries are de-indexed before merging so
// indexed glTF extracts and procedural shapes can share a bucket.
function mergeStaticMeshes(group: THREE.Group, keep: Set<THREE.Object3D>): THREE.Mesh[] {
  group.updateMatrixWorld(true);
  interface Bucket {
    material: THREE.Material;
    castShadow: boolean;
    geoms: THREE.BufferGeometry[];
  }
  const buckets = new Map<string, Bucket>();
  const merged: THREE.Mesh[] = [];
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || keep.has(mesh) || (mesh as THREE.InstancedMesh).isInstancedMesh) return;
    const material = mesh.material as THREE.Material;
    const worldZ = mesh.matrixWorld.elements[14];
    const band = Math.floor((worldZ - WORLD_MIN_Z) / MERGE_BAND_DEPTH);
    const key = `${material.uuid}:${mesh.castShadow ? 1 : 0}:${band}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material, castShadow: mesh.castShadow, geoms: [] };
      buckets.set(key, bucket);
    }
    // clone/de-index: extracted geometries are shared across placements, so
    // the bake must never mutate them in place
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    bucket.geoms.push(geo.applyMatrix4(mesh.matrixWorld));
    merged.push(mesh);
  });
  for (const mesh of merged) mesh.removeFromParent();
  const out: THREE.Mesh[] = [];
  for (const bucket of buckets.values()) {
    const geo = mergeGeometries(bucket.geoms, false);
    if (!geo) continue;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, bucket.material);
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    out.push(mesh);
  }
  return out;
}
