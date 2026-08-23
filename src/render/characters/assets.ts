// Character asset preparation: preloads manifest glbs, assembles per-key
// model clones (accessory show/hide + weapon attachments), caches tinted
// material variants, and bakes a single static idle-pose geometry per key for
// the far-LOD / shadow-proxy path.
//
// Loading contract: fetches kick off at module import and register with the
// preload registry; main.ts awaits assetsReady() before the Renderer exists,
// so everything here can assume resolved GLTFs synchronously afterwards.
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadGltf, loadTexture } from '../assets/loader';
import { registerPreload } from '../assets/preload';
import { addRimGlow, GFX } from '../gfx';
import { type ArmorDyeSpec, attachArmorDye } from './armor_dye';
import { buildMakeupDecal } from './makeup';
import {
  type AttachDef,
  characterPreloadUrls,
  itemWeaponModelUrl,
  SKIN_EMISSIVE,
  SKINS,
  VISUALS,
  type VisualDef,
  visibleAttachmentsForGraphics,
  visualAssetUrlForGraphics,
} from './manifest';
import {
  bandMaterialSpec,
  DEFAULT_LOOK,
  earringMaterialSpec,
  eyeColor,
  hairColor,
  isArmorMaterial,
  lashColor,
  lipColor,
  MAT_EYE,
  MAT_HAIR,
  MAT_LASH,
  MAT_SKIN,
  MAT_SKIN_DETAIL,
  MAT_STUBBLE,
  MORPH_SLIDER_TARGETS,
  type ModularAppearance,
  type ModularLook,
  makeupSelection,
  modularPartNames,
  morphInfluences,
  outfitDye,
  skinColor,
  stubbleDecals,
  wearsFaceDecal,
} from './modular';
import { optimizeSkinGpuLayout } from './skin_gpu_layout';
import { primeSkinnedSortSpheres } from './skinned_sort_spheres';
import { buildStubbleDecal, headNodeName } from './stubble';

const DEFAULT_TINT_STRENGTH = 0.4;

type HandGrip = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: number;
};

// KayKit adventurer standalone weapon glbs ship a left-hand mesh offset on a
// lone child node. handslot.r/l children in the character glbs carry the
// authored grip — copy those (or this fallback table) after flattening.
const KAYKIT_WEAPON_ACCESSORY: Record<string, string> = {
  axe_1handed: '1H_Axe',
  axe_2handed: '2H_Axe',
  crossbow_1handed: '1H_Crossbow',
  crossbow_2handed: '2H_Crossbow',
  sword_1handed: '1H_Sword',
  sword_2handed: '2H_Sword',
  staff: '2H_Staff',
  dagger: 'Knife',
  wand: '1H_Wand',
  // Per-item weapon variants (ITEM_WEAPON_VARIANTS / public/models/weapons/<key>.glb)
  // come from a different pack than the KayKit generics. Crucially, each variant's
  // mesh ORIGIN is authored AT the grip (the handle/guard): minY is consistent
  // within a family (~-0.4 for swords) while the blade length (maxY) varies. So we
  // do NOT recenter (that would move the grip to mid-blade and make long blades
  // drag); we attach at the origin and only clamp oversized models. VAR_* keys
  // route to applyVariantGrip (no rig node matches them).
  sword_a: 'VAR_SWORD',
  sword_b: 'VAR_SWORD',
  sword_c: 'VAR_SWORD',
  sword_d: 'VAR_SWORD',
  sword_e: 'VAR_SWORD',
  sword_f: 'VAR_SWORD',
  sword_g: 'VAR_SWORD',
  dagger_a: 'VAR_DAGGER',
  dagger_b: 'VAR_DAGGER',
  dagger_c: 'VAR_DAGGER',
  staff_a: 'VAR_STAFF',
  staff_b: 'VAR_STAFF',
  staff_c: 'VAR_STAFF',
  staff_d: 'VAR_STAFF',
  axe_a: 'VAR_AXE',
  axe_b: 'VAR_AXE',
  axe_c: 'VAR_AXE',
  axe_d: 'VAR_AXE',
  hammer_a: 'VAR_AXE',
  hammer_b: 'VAR_AXE',
  hammer_c: 'VAR_AXE',
  hammer_d: 'VAR_AXE',
  halberd: 'VAR_POLEARM',
  // additional distinct models (KayKit Adventurers set + spears/scythe/wands) for
  // weapon variety. adv_* swords/dagger/staff/axe share the variant-pack convention
  // (float geo, origin-at-grip) so they reuse the same family grips.
  adv_sword_1handed: 'VAR_SWORD',
  adv_sword_2handed: 'VAR_SWORD',
  adv_sword_2handed_color: 'VAR_SWORD',
  adv_dagger: 'VAR_DAGGER',
  adv_staff: 'VAR_STAFF',
  adv_druid_staff: 'VAR_STAFF',
  adv_axe_1handed: 'VAR_AXE',
  adv_axe_2handed: 'VAR_AXE',
  spear_a: 'VAR_POLEARM',
  spear_b: 'VAR_POLEARM',
  scythe: 'VAR_POLEARM',
  wand_a: 'VAR_WAND',
  wand_b: 'VAR_WAND',
  adv_wand: 'VAR_WAND',
};

// Per-family grip for the variant pack. The model origin IS the grip, so we attach
// at it: `lift` nudges the grip along the hand bone (tuned against the generic
// look), `maxHeight` clamps an oversized model so a long blade doesn't drag (scale
// is only ever reduced, so normal-size weapons keep their native scale and variety).
interface VariantGrip {
  lift: number;
  maxHeight: number;
}
const VARIANT_GRIPS: Record<string, VariantGrip> = {
  VAR_SWORD: { lift: 0.04, maxHeight: 2.0 },
  VAR_DAGGER: { lift: 0.04, maxHeight: 1.4 },
  VAR_STAFF: { lift: 0.18, maxHeight: 2.4 },
  VAR_AXE: { lift: 0.04, maxHeight: 1.5 },
  VAR_POLEARM: { lift: 0.18, maxHeight: 2.5 },
  VAR_WAND: { lift: 0.04, maxHeight: 1.2 },
};

const KAYKIT_HAND_GRIPS: Record<string, { r: HandGrip; l?: HandGrip }> = {
  '1H_Axe': {
    r: { position: [0.231697, 0.382471, 0], quaternion: [0, 1, 0, 0], scale: 0.622211 },
    l: { position: [-0.231697, 0.382471, 0], quaternion: [0, 0, 0, 1], scale: 0.622211 },
  },
  '2H_Axe': {
    r: { position: [0, 0.4626, 0], quaternion: [0, 1, 0, 0], scale: 0.8623 },
  },
  '1H_Crossbow': {
    r: {
      position: [0.2286, 0.0213, -0.0012],
      quaternion: [0, 0.7071068, 0, 0.7071067],
      scale: 0.6109,
    },
  },
  '2H_Crossbow': {
    r: { position: [0.3381, 0.058, 0], quaternion: [0, 0.7071068, 0, 0.7071067], scale: 0.7204 },
  },
  '1H_Sword': {
    r: { position: [0, 0.555174, 0], quaternion: [0, 1, 0, 0], scale: 0.8876 },
    l: { position: [0, 0.555174, 0], quaternion: [0, 0, 0, 1], scale: 0.8876 },
  },
  '2H_Sword': {
    r: { position: [0, 0.8148, 0], quaternion: [0, 1, 0, 0], scale: 1.1829 },
  },
  '2H_Staff': {
    r: { position: [-0.0427, 0.1769, 0], quaternion: [0, 1, 0, 0], scale: 1.0773 },
  },
  Knife: {
    r: { position: [-0.0095, 0.378, 0], quaternion: [0, 1, 0, 0], scale: 0.6029 },
    l: { position: [0.0095, 0.378, 0], quaternion: [0, 0, 0, 1], scale: 0.6029 },
  },
  '1H_Wand': {
    r: { position: [0, 0.2174, 0], quaternion: [0, 1, 0, 0], scale: 0.4831 },
  },
};

function isHandslotBone(name: string): boolean {
  const n = name.replace(/[[\].:/]/g, '');
  return n === 'handslotr' || n === 'handslotl';
}

function handSide(bone: string): 'r' | 'l' {
  return bone.replace(/[[\].:/]/g, '').endsWith('l') ? 'l' : 'r';
}

function kaykitAccessoryFor(url: string): string | null {
  const base =
    url
      .split('/')
      .pop()
      ?.replace(/\.glb$/, '') ?? '';
  return KAYKIT_WEAPON_ACCESSORY[base] ?? null;
}

function findAccessoryNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  return root.getObjectByName(name) ?? root.getObjectByName(name.replace(/[[\].:/]/g, '')) ?? null;
}

function accessoryNodeName(accessory: string, side: 'r' | 'l'): string {
  if (side === 'l' && accessory === 'Knife') return 'Knife_Offhand';
  if (side === 'l' && accessory === '1H_Sword') return '1H_Sword_Offhand';
  return accessory;
}

function copyAccessoryTransform(payload: THREE.Object3D, ref: THREE.Object3D): void {
  payload.position.copy(ref.position);
  payload.quaternion.copy(ref.quaternion);
  payload.scale.copy(ref.scale);
}

function applyHandGrip(
  payload: THREE.Object3D,
  root: THREE.Object3D,
  bone: string,
  url: string,
): void {
  const accessory = kaykitAccessoryFor(url);
  if (!accessory) return;
  const side = handSide(bone);
  const ref = findAccessoryNode(root, accessoryNodeName(accessory, side));
  if (ref) {
    copyAccessoryTransform(payload, ref);
    return;
  }
  const grips = KAYKIT_HAND_GRIPS[accessory];
  if (!grips) return;
  const grip = side === 'l' ? (grips.l ?? grips.r) : grips.r;
  payload.position.set(...grip.position);
  payload.quaternion.set(...grip.quaternion);
  payload.scale.setScalar(grip.scale);
}

function flattenWeaponScene(src: THREE.Object3D): THREE.Object3D {
  if (src.children.length !== 1) return src;
  const holder = new THREE.Group();
  const child = src.children[0];
  holder.scale.copy(child.scale);
  child.scale.set(1, 1, 1);
  child.position.set(0, 0, 0);
  child.rotation.set(0, 0, 0);
  src.remove(child);
  holder.add(child);
  return holder;
}

// Marks the holder group of the equipped-weapon attachment (the `weaponSlot`
// entry), so setHeldWeapon can find and replace exactly that prop without
// touching fixed offhands (rogue's second dagger, the warlock spellbook).
const SWAP_WEAPON_TAG = 'swapWeaponHolder';

// Grip for a variant-pack weapon. Its origin is authored AT the grip, so we attach
// at the origin (no recenter) and only clamp an oversized model so its blade does
// not drag. `lift` nudges along the hand bone; the side picks the 180-degree flip.
const variantBox = new THREE.Box3();
function variantGripFor(url: string): VariantGrip | null {
  const accessory = kaykitAccessoryFor(url);
  return accessory ? (VARIANT_GRIPS[accessory] ?? null) : null;
}
function applyVariantGrip(payload: THREE.Object3D, bone: string, grip: VariantGrip): void {
  variantBox.setFromObject(payload);
  const height = variantBox.max.y - variantBox.min.y;
  const scale = height > 1e-3 ? Math.min(1, grip.maxHeight / height) : 1;
  const left = handSide(bone) === 'l';
  payload.position.set(0, grip.lift, 0);
  payload.quaternion.set(0, left ? 0 : 1, 0, left ? 1 : 0);
  payload.scale.setScalar(scale);
}

function attachProp(
  root: THREE.Object3D,
  bone: THREE.Object3D,
  att: AttachDef,
  markSwap = false,
): void {
  const payload = flattenWeaponScene(cloneSkinned(resolvedGltf(att.url).scene));
  payload.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.userData.weaponMesh = true;
  });
  if (markSwap) payload.userData[SWAP_WEAPON_TAG] = true;
  const variantGrip = isHandslotBone(att.bone) ? variantGripFor(att.url) : null;
  if (variantGrip) {
    applyVariantGrip(payload, att.bone, variantGrip);
  } else if (att.position || att.rotationY !== undefined) {
    if (att.position) payload.position.set(...att.position);
    if (att.rotationY !== undefined) payload.rotation.y = att.rotationY;
  } else if (att.gripRef) {
    const ref = findAccessoryNode(root, att.gripRef);
    if (ref) copyAccessoryTransform(payload, ref);
  } else if (isHandslotBone(att.bone)) {
    applyHandGrip(payload, root, att.bone, att.url);
  }
  bone.add(payload);
}

// The AttachDef for the swappable mainhand slot, with the equipped item's model
// substituted when one is mapped (else the class default). The grip resolves from
// the item model's own family (KAYKIT_WEAPON_ACCESSORY), so any base position/
// rotationY/gripRef override is dropped for the substituted model.
function swapAttachDef(base: AttachDef, weaponItemId: string | null | undefined): AttachDef {
  const url = itemWeaponModelUrl(weaponItemId);
  return url ? { url, bone: base.bone } : base;
}

function resolveBone(root: THREE.Object3D, name: string): THREE.Object3D | null {
  return root.getObjectByName(name) ?? root.getObjectByName(name.replace(/[[\].:/]/g, '')) ?? null;
}

// The character's mainhand bone (right hand, falling back to left), for anchoring a
// world-space held prop like the fishing rod. Sanitized-name aware like every other
// bone lookup here (GLTFLoader strips the authored "handslot.r" to "handslotr").
export function resolveHandBone(root: THREE.Object3D): THREE.Object3D | null {
  return resolveBone(root, 'handslotr') ?? resolveBone(root, 'handslotl');
}

// Toggle the "weapons stowed" fishing stance: hide (or restore) every held weapon
// mesh so the character reads as holding a fishing rod instead of a sword/staff/bow.
// A reversible visibility flip (cheap, keeps the mixer/materials), unlike
// setHeldWeapon which rebuilds the attachment graph. Covers all nine classes: every
// attached weapon mesh is tagged `weaponMesh` at attach time, fixed offhands included.
export function setFishingStance(root: THREE.Object3D, active: boolean): void {
  root.traverse((o) => {
    if (o.userData.weaponMesh) o.visible = !active;
  });
}

// ---------------------------------------------------------------------------
// Preload
// ---------------------------------------------------------------------------

const gltfByUrl = new Map<string, GLTF>();

function assetUrl(url: string): string {
  return visualAssetUrlForGraphics(url, GFX.standardMaterials);
}

// Preload the character/weapon GLBs. characterPreloadUrls() is tier-INDEPENDENT (see
// manifest.ts): buildProps-style placement resolves asset URLs against the LIVE GFX
// tier via assetUrl(), and resolvedGltf() throws "character asset not preloaded"
// synchronously, so the preload set must be a superset of any tier's placement set or
// world entry crashes (the character-side twin of the v0.16.0 props P0).
const preloadUrls = characterPreloadUrls(GFX.standardMaterials);

for (const url of preloadUrls) {
  registerPreload(
    loadGltf(url).then((g) => {
      gltfByUrl.set(url, g);
    }),
  );
}

// Skin textures: player alternate body atlases, loaded sRGB + flipY=false so
// they line up with the glTF-embedded UVs. These load on every tier so skin
// selection previews and cosmetics keep distinct colours even on low graphics.
const skinTexByUrl = new Map<string, THREE.Texture>();
const skinEmisTexByUrl = new Map<string, THREE.Texture>();

/** Load a skin/emissive atlas with the glTF body-UV conventions (sRGB, no flip). */
function loadSkinTexInto(url: string, into: Map<string, THREE.Texture>): Promise<void> {
  return loadTexture(url, { srgb: true }).then((t) => {
    t.flipY = false;
    t.needsUpdate = true;
    into.set(url, t);
  });
}

// Boot sweep skips lazyPreload keys (e.g. the cosmetic mech) - those load on
// demand via preloadMechAssets().
const bootSkinUrls = new Set<string>();
for (const [key, list] of Object.entries(SKINS)) {
  if (VISUALS[key]?.lazyPreload) continue;
  for (const u of list) if (u) bootSkinUrls.add(u);
}
for (const url of bootSkinUrls) registerPreload(loadSkinTexInto(url, skinTexByUrl));

/** Resolved skin texture for a visual key + skin index, or null for the model's
 *  embedded default (index 0, unknown key, or an atlas that is not loaded yet). */
export function skinTexture(key: string, skinIndex: number): THREE.Texture | null {
  const url = SKINS[key]?.[skinIndex] ?? null;
  return url ? (skinTexByUrl.get(url) ?? null) : null;
}

/** Ensure the alternate atlas for (key, skinIndex) is loaded. Returns a promise
 *  that resolves once it is cached (so the caller can re-read `skinTexture` and
 *  re-apply), or null when there is nothing to wait for — the skin has no atlas
 *  (embedded default) or it is already loaded. Hardens live skin swaps against a
 *  not-yet-loaded atlas (otherwise the body shows the default until a relog). */
export function ensureSkinTexture(key: string, skinIndex: number): Promise<void> | null {
  // applySkinMaterials consumes BOTH the base atlas and (when the skin has one)
  // the emissive atlas — warm whichever of the two is missing so a glow skin
  // doesn't re-apply with a not-yet-loaded emissive map.
  const baseUrl = SKINS[key]?.[skinIndex] ?? null;
  const emisUrl = SKIN_EMISSIVE[key]?.[skinIndex] ?? null;
  const pending: Promise<void>[] = [];
  if (baseUrl && !skinTexByUrl.has(baseUrl)) pending.push(loadSkinTexInto(baseUrl, skinTexByUrl));
  if (emisUrl && !skinEmisTexByUrl.has(emisUrl))
    pending.push(loadSkinTexInto(emisUrl, skinEmisTexByUrl));
  if (pending.length === 0) return null;
  return Promise.all(pending).then(() => undefined);
}

/** Resolved emissive (glow) map for a visual key + skin index, or null when the
 *  skin has no glow (most do) / it isn't loaded / low tier. */
export function skinEmissiveTexture(key: string, skinIndex: number): THREE.Texture | null {
  const url = SKIN_EMISSIVE[key]?.[skinIndex] ?? null;
  return url ? (skinEmisTexByUrl.get(url) ?? null) : null;
}

// Lazy fetch for cosmetic-only bodies (the Combat Mech) — the GLB plus every
// chroma + emissive map. Memoized: opening the preview repeatedly is free. Kept
// out of the boot sweep so the ~4 MB asset set never delays every client's load.
let mechAssetsPromise: Promise<void> | null = null;
export function preloadMechAssets(): Promise<void> {
  if (mechAssetsPromise) return mechAssetsPromise;
  const def = VISUALS.player_mech;
  if (!def) return Promise.resolve();
  const jobs: Promise<unknown>[] = [
    loadGltf(def.url).then((g) => {
      gltfByUrl.set(def.url, g);
    }),
  ];
  for (const url of SKINS.player_mech ?? []) if (url) jobs.push(loadSkinTexInto(url, skinTexByUrl));
  if (GFX.standardMaterials) {
    for (const url of SKIN_EMISSIVE.player_mech ?? [])
      if (url) jobs.push(loadSkinTexInto(url, skinEmisTexByUrl));
  }
  mechAssetsPromise = Promise.all(jobs).then(() => undefined);
  return mechAssetsPromise;
}

export function mechAssetsReady(): boolean {
  const def = VISUALS.player_mech;
  if (!def || !gltfByUrl.has(assetUrl(def.url))) return false;
  const skinsReady = (SKINS.player_mech ?? []).every((url) => !url || skinTexByUrl.has(url));
  if (!GFX.standardMaterials) return skinsReady;
  return (
    skinsReady &&
    (SKIN_EMISSIVE.player_mech ?? []).every((url) => !url || skinEmisTexByUrl.has(url))
  );
}

function resolvedGltf(url: string): GLTF {
  const resolvedUrl = assetUrl(url);
  const g = gltfByUrl.get(resolvedUrl);
  if (!g) throw new Error(`character asset not preloaded: ${resolvedUrl}`);
  return g;
}

// ---------------------------------------------------------------------------
// Per-url source optimization: KayKit characters ship six skinned body parts
// sharing one skeleton and one material — merge them into a single SkinnedMesh
// once per asset so every instance costs ~1 body draw instead of ~6.
// ---------------------------------------------------------------------------

const optimizedSceneCache = new Map<string, THREE.Object3D>();

function optimizedScene(url: string): THREE.Object3D {
  const hit = optimizedSceneCache.get(url);
  if (hit) return hit;
  const root = cloneSkinned(resolvedGltf(url).scene);
  mergeSkinnedParts(root);
  optimizedSceneCache.set(url, root);
  return root;
}

const BIND_EPS = 1e-3;

function sameBindData(a: THREE.SkinnedMesh, b: THREE.SkinnedMesh): boolean {
  const ia = a.skeleton.boneInverses,
    ib = b.skeleton.boneInverses;
  if (ia.length !== ib.length) return false;
  for (let m = 0; m < ia.length; m++) {
    const ea = ia[m].elements,
      eb = ib[m].elements;
    for (let i = 0; i < 16; i++) if (Math.abs(ea[i] - eb[i]) > BIND_EPS) return false;
  }
  const ba = a.bindMatrix.elements,
    bb = b.bindMatrix.elements;
  for (let i = 0; i < 16; i++) if (Math.abs(ba[i] - bb[i]) > BIND_EPS) return false;
  return true;
}

// Meshopt + KHR_mesh_quantization assets (the Meshy-rigged raiders) leave some
// skinned-mesh parts with u16-normalized UV/position attributes while their
// siblings stay Float32; mergeGeometries bails on the mismatched array types
// (console spam + parts left unmerged = extra draw calls). Rebuild each part's
// geometry with a canonical attribute type set (float everywhere, integer
// skinIndex) so every part in a bucket agrees before the merge.
function copyAttr(
  attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  out: Float32Array | Uint16Array,
): void {
  const n = attr.itemSize;
  for (let i = 0; i < attr.count; i++) {
    out[i * n] = attr.getX(i);
    if (n > 1) out[i * n + 1] = attr.getY(i);
    if (n > 2) out[i * n + 2] = attr.getZ(i);
    if (n > 3) out[i * n + 3] = attr.getW(i);
  }
}

function canonicalGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  for (const name of Object.keys(src.attributes)) {
    const attr = src.getAttribute(name);
    // skinIndex must stay an integer index into the skeleton; everything else
    // (position/normal/uv/skinWeight/color/tangent) canonicalizes to Float32
    const out =
      name === 'skinIndex'
        ? new Uint16Array(attr.count * attr.itemSize)
        : new Float32Array(attr.count * attr.itemSize);
    copyAttr(attr, out);
    geo.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize));
  }
  if (src.index) geo.setIndex(src.index.clone());
  return geo;
}

function mergeSkinnedParts(root: THREE.Object3D): void {
  // bucket by bone set / material / parent / local transform, then split
  // buckets by approximate bind-data equality (float noise must not block a
  // merge, while genuinely different bind poses must never share vertices —
  // the skeleton pack's parts carry per-part bind data)
  const groups = new Map<string, THREE.SkinnedMesh[][]>();
  root.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || !sm.visible) return;
    const mat = sm.material as THREE.Material;
    if (Array.isArray(sm.material)) return; // never happens via GLTFLoader
    const bones = sm.skeleton.bones.map((b) => b.uuid).join(',');
    const key = `${bones}|${mat.uuid}|${sm.parent?.uuid}|${sm.matrix.elements.join(',')}`;
    let buckets = groups.get(key);
    if (!buckets) {
      buckets = [];
      groups.set(key, buckets);
    }
    const bucket = buckets.find((b) => sameBindData(b[0], sm));
    if (bucket) bucket.push(sm);
    else buckets.push([sm]);
  });
  for (const parts of [...groups.values()].flat()) {
    if (parts.length < 2) continue;
    const names = new Set(parts.flatMap((p) => Object.keys(p.geometry.attributes)));
    if (![...names].every((n) => parts.every((p) => p.geometry.getAttribute(n)))) continue;
    const geo = mergeGeometries(
      parts.map((p) => canonicalGeometry(p.geometry)),
      false,
    );
    if (!geo) continue;
    const first = parts[0];
    const merged = new THREE.SkinnedMesh(geo, first.material);
    merged.name = `${first.name}_bodymerged`;
    merged.position.copy(first.position);
    merged.quaternion.copy(first.quaternion);
    merged.scale.copy(first.scale);
    merged.bind(first.skeleton, first.bindMatrix);
    first.parent!.add(merged);
    for (const p of parts) p.removeFromParent();
  }
}

// ---------------------------------------------------------------------------
// Clone assembly: accessory visibility + weapon attachments
// ---------------------------------------------------------------------------

/** Tag a face decal (stubble / makeup) and its whole subtree, so passes that
 *  walk the composed body can tell an authored decal from body geometry. */
function markFaceDecal(decal: THREE.Object3D): void {
  decal.userData.faceDecal = true;
  decal.traverse((o) => {
    o.userData.faceDecal = true;
  });
}

/** Attach every prop a def declares: the equipped item's model in a swappable
 *  slot, the authored model everywhere else. Shared by the fixed-rig and
 *  composed-body assembly paths so bone resolution lives in one place. */
function attachAllProps(root: THREE.Object3D, def: VisualDef, weaponItemId: string | null): void {
  // Weapons and held props are gameplay-readable silhouettes, not decoration.
  // Low tier still downgrades body/material cost, but keeps attachments visible.
  const attachments = visibleAttachmentsForGraphics(def);
  for (let i = 0; i < attachments.length; i++) {
    const isSwap = def.weaponSlots?.includes(i) ?? false;
    // Swappable slots take the equipped item's model (when given); every other
    // attachment is fixed (the warlock's spellbook offhand). The rogue lists both
    // hand slots so a dagger shows in both.
    const att = isSwap ? swapAttachDef(attachments[i], weaponItemId) : attachments[i];
    // GLTFLoader sanitizes node names (PropertyBinding strips [].:/ chars),
    // so the authored "handslot.r" arrives as "handslotr" — try both
    const bone = resolveBone(root, att.bone);
    if (!bone) continue; // manifest/bone mismatch — ship without the prop
    attachProp(root, bone, att, isSwap);
  }
}

// ---------------------------------------------------------------------------
// Modular composition
//
// The modular GLB carries EVERY part (both genders, every hair/brow, every
// armour slot piece) on one shared Rig_Medium. A composed body is the parsed
// scene pruned to the picked nodes and then run through the same
// mergeSkinnedParts pass as a class rig, so a fully-kitted character still
// costs one draw per MATERIAL (skin / hair / eye / plate), not one per part.
// The pruned+merged result is cached per part set, because most players share a
// handful of loadouts; only the recolour below is per character, and that is a
// material swap over shared geometry.
// ---------------------------------------------------------------------------

/** One cached composed part set: the merged root every character with this set
 *  is cloned from, a live-clone count, and the far-LOD bake taken off it. */
interface ModularVariant {
  root: THREE.Object3D;
  /** The GLB this was pruned from: needed at eviction to tell the geometry
   *  this variant MINTED from the geometry it merely points at. */
  url: string;
  /** Live composed clones still drawn from this root's geometry. */
  refs: number;
  // Upstream also hangs the baked idle-pose far LOD off this entry
  // (ModularFarBake). That crowd-LOD subsystem is not ported here, so a
  // variant is just the merged root plus its refcount.
}

// BOUNDED AND REFCOUNTED, and it used to be neither.
//
// The cache is keyed by PART SET, and the original reasoning ("creation only
// walks a few dozen") held while a single character composed: the local player.
// Now every peer composes, so what mints entries is no longer one player at a
// turntable but the population of a zone (a distinct set per distinct look),
// and it grows for as long as the session lasts as players come and go. At
// ~6.7k merged vertices a set, an evening in a capital would run to hundreds of
// megabytes of geometry nothing on screen is using.
//
// Eviction has to be refcounted rather than plain-LRU because SkeletonUtils
// clones SHARE geometry with the root they came from, so disposing a root that
// a live character is still drawn from would blank that character. Every clone
// is therefore retained in assembleModular and released in
// CharacterVisual.dispose, and only entries with NO live clone are eligible.
// When every entry is live the cache is allowed past the cap rather than
// breaking a body on screen: the bound is on garbage, not on the crowd.
const modularVariantCache = new Map<string, ModularVariant>();
/** Retained clones over the cap keep their variant; only idle ones are dropped. */
const MODULAR_VARIANT_CACHE_MAX = 96;
/** Dev-only tripwire on live (unevictable) variants: the one growth the cap
 *  cannot bound, and the signal that a release site was missed. */
const MODULAR_VARIANT_WARN_AT = 128;

/** The cache key for a composed part set: the GLB plus the picked node names. */
function modularVariantKey(url: string, names: readonly string[]): string {
  return `${url}|${names.join(',')}`;
}

/** Every BufferGeometry the parsed GLB owns, memoized against the PARSED SCENE.
 *
 *  This is the set a variant must NOT dispose. A variant root is a
 *  SkeletonUtils clone, which SHARES geometry with its source, and
 *  mergeSkinnedParts only mints new geometry for the buckets it can prove safe:
 *  it refuses anything carrying morph targets (head, eyes, ears, lashes, brows,
 *  mouth) and skips buckets of one. Every one of those meshes is still pointing
 *  at the parsed scene's buffers, which every other variant and every future
 *  compose also point at, and nothing re-creates them. Disposing one would be
 *  the recolorCache bug in a worse place.
 *
 *  Keyed by scene OBJECT, not by url, and that is the whole point of the
 *  WeakMap: a url-keyed memo is a promise that a url always parses to the same
 *  buffers, which nothing enforces. Re-parse a character GLB (a hot reload, an
 *  asset-cache eviction, any future re-fetch) and a variant built from the new
 *  scene would be diffed against the OLD scene's set, so every one of its
 *  unmerged parts reads as "minted here" and eviction frees the live parse's
 *  buffers: exactly the bug this predicate exists to close, re-opened by a stale
 *  key. Against the scene object the question cannot be asked of the wrong
 *  parse, and a dropped parse takes its entry with it. */
const sourceGeometryCache = new WeakMap<THREE.Object3D, Set<THREE.BufferGeometry>>();

/**
 * The geometries an evicted variant is allowed to free: the ones it MINTED,
 * never the ones it merely points at.
 *
 * Exported for the test rather than for a caller: this predicate is the whole
 * safety of eviction, and getting it wrong is silent (a body keeps rendering
 * until the renderer next needs the buffer). `shared` is the parsed GLB's own
 * geometry set: see sourceGeometries for why so much of a variant is still in
 * it.
 */
export function variantOwnedGeometries(
  root: THREE.Object3D,
  shared: ReadonlySet<THREE.BufferGeometry>,
): THREE.BufferGeometry[] {
  const owned: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry && !shared.has(mesh.geometry)) owned.push(mesh.geometry);
  });
  return owned;
}

// Exported for the test rather than for a caller (test seam, no behavior change):
// evictModularVariants diffs against this set to know what a variant may free.
export function sourceGeometries(url: string): Set<THREE.BufferGeometry> {
  const scene = resolvedGltf(url).scene;
  const hit = sourceGeometryCache.get(scene);
  if (hit) return hit;
  const owned = new Set<THREE.BufferGeometry>();
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) owned.add(mesh.geometry);
  });
  sourceGeometryCache.set(scene, owned);
  return owned;
}

/** Drop idle variants, least-recently-used first, until the cache is back under
 *  the cap. Map iteration is insertion order and every hit re-inserts, so the
 *  head is the least recently composed. */
function evictModularVariants(): void {
  if (modularVariantCache.size <= MODULAR_VARIANT_CACHE_MAX) return;
  for (const [key, entry] of modularVariantCache) {
    if (modularVariantCache.size <= MODULAR_VARIANT_CACHE_MAX) break;
    if (entry.refs > 0) continue;
    modularVariantCache.delete(key);
    // Now provably unreferenced, so the buffers this variant MINTED can go
    // back: dropping the map entry alone would leak them (three.js frees a
    // geometry on dispose(), not on GC). Only the minted ones: see
    // sourceGeometries for what the unmerged parts are still pointing at.
    for (const geo of variantOwnedGeometries(entry.root, sourceGeometries(entry.url))) {
      geo.dispose();
    }
    // (Upstream also frees the entry's far-LOD bake here.)
  }
  if (import.meta.env?.DEV && modularVariantCache.size >= MODULAR_VARIANT_WARN_AT) {
    console.warn(
      `[modular] ${modularVariantCache.size} composed variants live at once (cap ${MODULAR_VARIANT_CACHE_MAX}); every one is still on screen`,
    );
  }
}

/** Note that a composed clone is no longer drawn, freeing its part set to be
 *  evicted. Called from CharacterVisual.dispose; safe on any root (a
 *  non-composed one carries no key). */
export function releaseModularVariant(root: THREE.Object3D): void {
  const key = root.userData.modularVariantKey as string | undefined;
  if (!key) return;
  root.userData.modularVariantKey = undefined;
  const entry = modularVariantCache.get(key);
  if (!entry || entry.refs === 0) return;
  entry.refs--;
  // Sweeping only on a miss leaves a cache that went over the cap while every
  // entry was live sitting there forever if it then only ever hits. Going idle
  // is the other moment eviction can make progress, so take it.
  if (entry.refs === 0) evictModularVariants();
}

/** Composed-body cache occupancy, for the crowd-perf probe on `window.__game`:
 *  how many part sets are cached, how many of those a live character is still
 *  drawn from (and so cannot be evicted), and how many recoloured materials are
 *  warm. Read beside `renderer.webgl.info` when checking a throng. */
export function modularCacheStats(): { variants: number; live: number; recolors: number } {
  let live = 0;
  for (const entry of modularVariantCache.values()) if (entry.refs > 0) live++;
  return { variants: modularVariantCache.size, live, recolors: recolorCache.size };
}

function modularVariant(url: string, names: readonly string[]): ModularVariant {
  const key = modularVariantKey(url, names);
  const hit = modularVariantCache.get(key);
  if (hit) {
    // re-insert so the eviction sweep above reads insertion order as recency
    modularVariantCache.delete(key);
    modularVariantCache.set(key, hit);
    return hit;
  }
  const root = cloneSkinned(resolvedGltf(url).scene);
  const keep = new Set(names);
  const drop: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!(o as THREE.SkinnedMesh).isSkinnedMesh) return;
    if (keep.has(o.name)) return;
    // A part with more than one MATERIAL exports as a multi-primitive glTF mesh,
    // and GLTFLoader expands that into a GROUP named after the node holding one
    // SkinnedMesh per primitive, each named after the mesh datablock, not the
    // node. The mouth is the only such part (skin for the lips, dark for the
    // mouth line and cavity, white for the teeth), and matching on the mesh's
    // own name alone dropped every one of them: the parts list asks for
    // `M_Mouth_neutral` and the meshes are called `M_Mouth_neutral011`.
    if (o.parent && keep.has(o.parent.name)) return;
    drop.push(o);
  });
  for (const o of drop) o.removeFromParent();
  // the Group an unpicked multi-primitive part arrived in is now empty
  const empty: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o !== root && o.type === 'Group' && o.children.length === 0) empty.push(o);
  });
  for (const o of empty) o.removeFromParent();
  mergeSkinnedParts(root);
  primeSkinnedSortSpheres(root);
  // Sweep BEFORE inserting, never after. The new entry is born at refs 0 and
  // the caller only retains it once this returns, so a sweep run after the
  // insert reaches the newest entry last, finds it unreferenced, and disposes
  // the very root it is about to hand back: the caller then clones a disposed
  // root, the far bake writes to an orphaned entry forever, and the release
  // finds nothing. Trimming first cannot see it at all.
  evictModularVariants();
  const entry: ModularVariant = { root, url, refs: 0 };
  modularVariantCache.set(key, entry);
  return entry;
}

// Bounded, because a colour WHEEL is a continuous input: dragging it emits a
// new hex every pointermove, and each distinct hex would otherwise strand a
// material here forever. (Its downstream twin in tintedMaterial's cache, keyed
// off this material's uuid, becomes a dead-source entry when the LRU evicts
// here; the tinted cache reclaims those through its own idle bound, see
// tinted_material_cache_core.ts.) An LRU keeps a drag's worth of shades warm,
// and re-picking a recent colour is still free.
//
// SIZED FOR A CROWD, NOT FOR ONE COLOUR PICKER. 48 was a drag's worth of shades
// for the single character being authored. Now every peer composes, and the
// keys are (source material x colour) across everyone in view: skin, skin
// detail, hair, stubble, eye, lash, lipstick and an outfit dye per person. A
// populated zone blows past 48 immediately, and each eviction means the next
// character with that colour rebuilds a material that was already made.
const RECOLOR_CACHE_MAX = 512;
const recolorCache = new Map<string, THREE.Material>();

function armorDyed(src: THREE.Material, dye: ArmorDyeSpec): THREE.Material {
  const mat = src.clone() as THREE.MeshStandardMaterial;
  attachArmorDye(mat, dye);
  return mat;
}

/** Per-character skin/hair colour. Applied BEFORE applyMaterials so the clone
 *  it snapshots as "source" already carries the tint (and so the low-graphics
 *  Lambert path inherits it too). Any other material passes straight through. */
function recolored(
  src: THREE.Material,
  look: ModularLook,
  onMouth = false,
  onJewel = false,
  onBand = false,
): THREE.Material {
  // JEWELLERY MATERIAL. The piercing sets ride the knight atlas by default,
  // which is what gives a set its authored per-piece metals; when the player
  // names a material instead, the whole set becomes that one substance (what
  // the Fit Studio bakes when a designer names a preset). Caught here rather
  // than by material name because the material IS the shared atlas, the E2
  // node name is the only thing that distinguishes an earring from a pauldron.
  //
  // A hair band is on the same path but answers to bandMaterialSpec, which
  // does not check the earring SLOT: the band is worn with the hair, so it
  // takes the picked metal even on a character wearing no piercings.
  const jewel = onJewel
    ? onBand
      ? bandMaterialSpec(look.app)
      : earringMaterialSpec(look.app)
    : null;
  if (jewel) {
    const jkey = `jewel|${jewel.color}|${jewel.metalness}|${jewel.roughness}`;
    const hit = recolorCache.get(jkey);
    if (hit) {
      recolorCache.delete(jkey);
      recolorCache.set(jkey, hit);
      return hit;
    }
    const jm = src.clone() as THREE.MeshStandardMaterial;
    jm.name = `mod_jewel_${jewel.color.toString(16)}`;
    if ('color' in jm) jm.color.setHex(jewel.color);
    // the atlas swatch would otherwise multiply the picked colour
    if ('map' in jm) jm.map = null;
    if ('metalness' in jm) jm.metalness = jewel.metalness;
    if ('roughness' in jm) jm.roughness = jewel.roughness;
    // metalness/roughness are standard-tier only: the low tier rebuilds
    // materials as Lambert (see tintedMaterial), which has neither. The
    // COLOUR survives there, so the pick still reads.
    recolorCache.set(jkey, jm);
    return jm;
  }
  // LIPSTICK. The mouth part carries the lip body on `mod_skin` (so a bare mouth
  // matches the face) and the mouth line on `mod_mouth`. Painting the first of
  // those is the whole feature, the shape is already a pair of lips, so there
  // is nothing to mask and nothing to add. It has to be caught HERE rather than
  // by a decal because the part stands proud of the head: paint on the head at
  // the lip band renders behind the lips.
  const lip =
    onMouth && src.name === MAT_SKIN
      ? lipColor(makeupSelection(look.app, look.worn).lipstick)
      : null;
  const hex =
    lip !== null
      ? lip
      : src.name === MAT_SKIN || src.name === MAT_SKIN_DETAIL
        ? skinColor(look.app)
        : src.name === MAT_HAIR || src.name === MAT_STUBBLE
          ? hairColor(look.app)
          : src.name === MAT_EYE
            ? eyeColor(look.app)
            : src.name === MAT_LASH
              ? lashColor(look.app)
              : null;
  // Armour rides the same clone-cache but dyes in the SHADER rather than via
  // material.color: a multiply tint over a coloured atlas can only darken,
  // while the dye rotates the set's cloth band to the picked colorway.
  const dye = hex === null ? outfitDye(src.name, look.app.outfit) : null;
  if (hex === null && dye === null) return src;
  const key = hex !== null ? `${src.uuid}|${hex}` : `${src.uuid}|outfit:${look.app.outfit}`;
  const cached = recolorCache.get(key);
  if (cached) {
    // refresh recency
    recolorCache.delete(key);
    recolorCache.set(key, cached);
    return cached;
  }
  const mat =
    dye !== null
      ? (armorDyed(src, dye) as THREE.MeshStandardMaterial)
      : (src.clone() as THREE.MeshStandardMaterial);
  if (hex !== null) mat.color.setHex(hex);
  // HAIR IS DOUBLE-SIDED. The sculpts ship as the designer anchored them
  // (hairimp.FAITHFUL_SCULPT), and a sculpt is a one-sided open shell: seen
  // from inside, through the gaps between strands, up under a fringe, along
  // the hollow of a ponytail, a single-sided face is simply not drawn and
  // reads as a hole in the hair. The Fit Studio previews these sculpts
  // DoubleSide for the same reason, so this is also what makes the game match
  // the tool. It replaces the build-time inner wall (close_shell), which cost
  // geometry and arrived shredded on hanging styles.
  // `side` survives the low tier: tintedMaterial's Lambert rebuild copies it.
  if (src.name === MAT_HAIR) mat.side = THREE.DoubleSide;
  recolorCache.set(key, mat);
  while (recolorCache.size > RECOLOR_CACHE_MAX) {
    const oldestKey = recolorCache.keys().next().value as string | undefined;
    if (oldestKey === undefined) break;
    recolorCache.delete(oldestKey);
    // NOT disposed, and the old dispose() here was a live-object bug the moment
    // peers started composing. assembleModular assigns these instances straight
    // onto the clone's meshes, so a cached material is SHARED by every character
    // wearing that colour: evicting one while ten peers are drawn with it
    // dropped the renderer's state for a material still in the scene, and it had
    // to be re-initialized on the next frame.
    //
    // Dropping the reference alone is the whole job here, and it leaks nothing
    // worth naming: these are colour-only clones that own no GPU buffer of their
    // own (their textures belong to the source material, and to stubble.ts for
    // the decal map), and the dye variant pins customProgramCacheKey to one
    // string, so every dyed material in the game shares a single compiled
    // program however many colourways are live. What is reclaimed on eviction is
    // the JS object, once nothing on screen points at it.
  }
  return mat;
}

/**
 * Add the stubble/buzz decal, if the look wears one.
 *
 * It is added to the CLONE rather than to the cached variant because it adds no
 * part name: buzz and bald pick the same nodes and so share one cached variant,
 * and the decal is the only thing that tells them apart. It has to go on before
 * the recolour sweep below, which is what paints it the hair colour, and before
 * `applyMorphs`, which drives it off the head's own morph dictionary.
 */
function attachStubbleDecal(root: THREE.Object3D, look: ModularLook): void {
  const sel = stubbleDecals(look.app, look.worn);
  if (!sel.scalp && !sel.beard) return;
  const name = headNodeName(look.app.gender);
  let head: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!head && (o as THREE.SkinnedMesh).isSkinnedMesh && o.name === name) {
      head = o as THREE.SkinnedMesh;
    }
  });
  if (!head) return;
  const decal = buildStubbleDecal(head, sel);
  // Sibling, not child: the head is skinned, so a child would inherit its
  // (bind-pose) transform on top of the skinning it already does.
  if (decal) {
    markFaceDecal(decal);
    (head as THREE.SkinnedMesh).parent?.add(decal);
  }
}

/**
 * Blush and eyeshadow, on the same terms as the stubble decal above, cut from
 * the head's own surface at compose time, added as a SIBLING of the head, and
 * driven by the head's morph dictionary so a face slider moves the paint with
 * the skin.
 *
 * Lipstick is not here: it is a tint on the mouth part, applied by the recolour
 * sweep (see `recolored`), because the mouth is a part standing proud of the
 * skin and a decal on the head at the lip band renders behind it.
 */
function attachMakeupDecal(root: THREE.Object3D, look: ModularLook): void {
  const sel = makeupSelection(look.app, look.worn);
  if (!wearsFaceDecal(sel)) return;
  const name = headNodeName(look.app.gender);
  let head: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!head && (o as THREE.SkinnedMesh).isSkinnedMesh && o.name === name) {
      head = o as THREE.SkinnedMesh;
    }
  });
  if (!head) return;
  const decal = buildMakeupDecal(head, sel);
  if (decal) {
    markFaceDecal(decal);
    (head as THREE.SkinnedMesh).parent?.add(decal);
  }
}

/** Compose a modular character: pick parts, recolour skin/hair, attach weapons. */
export function assembleModular(
  def: VisualDef,
  look: ModularLook,
  weaponItemId?: string | null,
  offhandItemId?: string | null,
): THREE.Object3D {
  const names = modularPartNames(look.app, look.worn);
  const variant = modularVariant(def.url, names);
  const root = cloneSkinned(variant.root);
  attachStubbleDecal(root, look);
  attachMakeupDecal(root, look);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    // Only PLATE is a "body mesh" here: that flag gates the legacy per-class
    // skin-atlas swap (SKINS/skinTexture), which must never repaint the
    // colour-picked skin and hair.
    if (mats.some((m) => m && isArmorMaterial(m.name))) mesh.userData.bodyMesh = true;
    // The mouth part is the one place `mod_skin` must not be the skin tone,
    // that primitive is the lips. GLTFLoader suffixes a multi-primitive mesh
    // (`M_Mouth_neutral_1`), so match on the node's stem rather than equality.
    const onMouth = mesh.name.includes('_Mouth_');
    // GLTFLoader suffixes multi-primitive meshes, so match the stem
    const onJewel = mesh.name.startsWith('E2_');
    // ...and a hair band is the E2_ subset that must ignore the earring slot
    const onBand = mesh.name.startsWith('E2_band_');
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => recolored(m, look, onMouth, onJewel, onBand))
      : recolored(mesh.material, look, onMouth, onJewel, onBand);
  });
  applyMorphs(root, look);
  attachAllProps(root, def, weaponItemId ?? null);
  // Upstream captures root.userData.farMaterials here, the material slots the
  // far-LOD bake resolves against. Without that subsystem there is nothing to
  // resolve, so the capture is omitted rather than left writing a value no one
  // reads.
  // Retain LAST, after every throw point above. attachAllProps throws for a
  // streamed weapon GLB that has not landed yet, and that throw is a designed
  // path: the fail-soft visual build catches it and the retry gate re-attempts
  // on a cooldown. A retain taken before it leaked one ref per attempt with no
  // dispose ever running, which made the entry permanently unevictable: the
  // precise failure the cap exists to prevent. Down here, a throw anywhere in
  // assembly means no ref was ever taken, so there is nothing to leak.
  root.userData.modularVariantKey = modularVariantKey(def.url, names);
  variant.refs++;
  return root;
}

/**
 * Push the face sliders onto the morph targets by NAME.
 *
 * Safe to do on the shared-geometry clone: three copies `morphTargetInfluences`
 * per instance in Mesh.copy(), so two characters can wear different faces off
 * one buffer. That is the whole reason the face is morphs rather than a CPU
 * deform: a deform would mint a variant per slider position, turning a cache
 * keyed by a discrete part set into one keyed by a continuous input.
 */
function applyMorphs(root: THREE.Object3D, look: ModularLook): void {
  const want = morphInfluences(look.app);
  if (!want.size) return;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const dict = mesh.morphTargetDictionary;
    const infl = mesh.morphTargetInfluences;
    if (!dict || !infl) return;
    for (const [name, value] of want) {
      const i = dict[name];
      if (i !== undefined) infl[i] = value;
    }
  });
}

/**
 * Re-push the face/body SLIDER morphs onto a body that is already built.
 *
 * The reason the sliders are out of `modularBuildSignature`: they are
 * per-instance influences over shared geometry, so moving one is a few float
 * writes rather than a dispose plus a fresh clone, materials and decals. The
 * creation turntable emits on every `input` event (a face slider steps in 5%,
 * so one drag is about 40 of them), which rebuilt the whole character each
 * time.
 *
 * Writes EVERY slider target rather than only the non-zero half the build path
 * uses: this runs over a body that already carries influences, so a slider
 * returning to neutral has to clear the one it set.
 */
export function applyModularSliderMorphs(root: THREE.Object3D, app: ModularAppearance): void {
  const want = morphInfluences(app);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const dict = mesh.morphTargetDictionary;
    const infl = mesh.morphTargetInfluences;
    if (!dict || !infl) return;
    for (const name of MORPH_SLIDER_TARGETS) {
      const i = dict[name];
      if (i !== undefined) infl[i] = want.get(name) ?? 0;
    }
  });
}

/** Fresh SkeletonUtils clone of a manifest entry with its kit applied.
 *  Pure model space — normalization (scale/yaw/feet offset) happens upstream. */
export function assembleModel(
  def: VisualDef,
  weaponItemId?: string | null,
  look?: ModularLook | null,
): THREE.Object3D {
  // A `modular` def is a part LIBRARY, not a finished character, so it composes
  // rather than clones. A look handed to a fixed rig is ignored here, which is
  // what lets every caller pass one unconditionally.
  if (def.modular) {
    return assembleModular(def, look ?? DEFAULT_LOOK, weaponItemId);
  }
  const root = cloneSkinned(optimizedScene(def.url));
  // tag the character's own meshes (body + accessories share one texture atlas)
  // so a skin override hits them but not the separate weapons attached below
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.userData.bodyMesh = true;
  });
  // KayKit characters ship every accessory mesh visible; keep only the kit
  if (def.show) {
    const keep = new Set(def.show);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh && !keep.has(o.name)) {
        o.visible = false;
      }
    });
  }
  attachAllProps(root, def, weaponItemId ?? null);
  // Re-orient mis-baked built-in weapon nodes (e.g. the golem axe) in place.
  for (const fix of def.weaponFix ?? []) {
    const node =
      root.getObjectByName(fix.node) ?? root.getObjectByName(fix.node.replace(/[[\].:/]/g, ''));
    if (!node) continue;
    if (fix.rotX) node.rotateX(fix.rotX);
    if (fix.rotY) node.rotateY(fix.rotY);
    if (fix.rotZ) node.rotateZ(fix.rotZ);
  }
  return root;
}

/** Replace the equipped-weapon attachment(s) on an already-assembled model in place,
 *  for a runtime gear swap. No-op for visuals without `weaponSlots` (hunter keeps its
 *  crossbow; mobs/NPCs are fixed). Re-attaches every swap slot (the rogue has two, so
 *  both hands update). The caller must re-apply materials and re-snapshot the
 *  original-material map afterwards (see CharacterVisual.setWeapon), since the new
 *  weapon meshes start on the source GLB's raw materials. */
export function setHeldWeapon(
  root: THREE.Object3D,
  def: VisualDef,
  weaponItemId: string | null,
): void {
  if (!def.weaponSlots?.length) return;
  const stale: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o.userData[SWAP_WEAPON_TAG]) stale.push(o);
  });
  for (const o of stale) o.removeFromParent();
  for (const i of def.weaponSlots) {
    const base = def.attach?.[i];
    if (!base) continue;
    const att = swapAttachDef(base, weaponItemId);
    const bone = resolveBone(root, att.bone);
    if (!bone) continue;
    attachProp(root, bone, att, true);
  }
}

// ---------------------------------------------------------------------------
// Tinted material cache (shared across all instances; never disposed)
// ---------------------------------------------------------------------------

const matCache = new Map<string, THREE.Material>();
const tintScratch = new THREE.Color();
const lowReadabilityWhite = new THREE.Color(0xffffff);
const weaponHighlight = new THREE.Color(0xfff0c2);
type MaterialRole = 'body' | 'weapon';

function applyLowReadabilityLift(
  mat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshBasicMaterial,
  role: MaterialRole,
): void {
  const lift = role === 'weapon' ? 0.14 : 0.075;
  const emissive = role === 'weapon' ? 0.075 : 0.045;
  mat.color.lerp(role === 'weapon' ? weaponHighlight : lowReadabilityWhite, lift);
  if ((mat as THREE.MeshLambertMaterial).isMeshLambertMaterial) {
    const lambert = mat as THREE.MeshLambertMaterial;
    lambert.emissive = mat.color.clone().multiplyScalar(emissive);
  }
}

function applyWeaponMaterialPolish(
  mat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshBasicMaterial,
): void {
  mat.color.lerp(weaponHighlight, 0.08);
  const std = mat as THREE.MeshStandardMaterial;
  if (std.isMeshStandardMaterial) {
    std.roughness = Math.min(std.roughness, 0.55);
    std.metalness = Math.max(std.metalness, 0.12);
    std.emissive.copy(mat.color).multiplyScalar(0.025);
  }
}

export function tintedMaterial(
  src: THREE.Material,
  tint: number | null,
  strength: number,
  skinTex: THREE.Texture | null = null,
  emisTex: THREE.Texture | null = null,
  role: MaterialRole = 'body',
): THREE.Material {
  const key = `${src.uuid}|${tint ?? 'n'}|${tint === null ? 0 : strength}|${GFX.standardMaterials ? 's' : 'l'}|${skinTex ? skinTex.uuid : 'n'}|${emisTex ? emisTex.uuid : 'n'}|${role}`;
  const cached = matCache.get(key);
  if (cached) return cached;

  const s = src as THREE.MeshStandardMaterial;
  let mat: THREE.MeshStandardMaterial | THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
  if (GFX.standardMaterials) {
    mat = s.clone();
    addRimGlow(mat); // dungeon silhouette rim (uRimBoost contract)
  } else {
    if ((src as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
      mat = (src as THREE.MeshBasicMaterial).clone();
    } else {
      // low tier: Lambert with the same texture map — no PBR, no rim
      mat = new THREE.MeshLambertMaterial({
        map: s.map ?? null,
        color: s.color ? s.color.clone() : new THREE.Color(0xffffff),
        transparent: s.transparent,
        opacity: s.opacity,
        side: s.side,
      });
    }
  }
  if (tint !== null) {
    // subtle pull toward the template color — hard multiplies turn the
    // hand-painted textures muddy
    mat.color.lerp(tintScratch.set(tint), strength);
  }
  if (skinTex) mat.map = skinTex; // alternate body atlas, same UVs as the default
  // Emissive glow map (mech epics): standard tier only - Lambert/Basic don't
  // glow, and adding a map where none existed needs a shader recompile.
  if (emisTex && GFX.standardMaterials) {
    const sm = mat as THREE.MeshStandardMaterial;
    sm.emissiveMap = emisTex;
    sm.emissive = new THREE.Color(0xffffff);
    sm.emissiveIntensity = 1.0;
    sm.needsUpdate = true;
  }
  if (role === 'weapon') applyWeaponMaterialPolish(mat);
  if (!GFX.standardMaterials) applyLowReadabilityLift(mat, role);
  matCache.set(key, mat);
  return mat;
}

function tintFor(def: VisualDef, entityColor: number): number | null {
  if (def.tint === undefined) return null;
  return def.tint === 'entity' ? entityColor : def.tint;
}

/** Swap every mesh material in an assembled clone for the shared tinted
 *  (and tier-appropriate) variant. Returns nothing — mutates the clone. */
export function applyMaterials(
  root: THREE.Object3D,
  def: VisualDef,
  entityColor: number,
  skinTex: THREE.Texture | null = null,
  emisTex: THREE.Texture | null = null,
): void {
  const tint = tintFor(def, entityColor);
  const strength = def.tintStrength ?? DEFAULT_TINT_STRENGTH;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const role: MaterialRole = mesh.userData.weaponMesh ? 'weapon' : 'body';
    const materialTint = role === 'weapon' ? null : tint;
    // skin/emissive override only touches the character's own atlas meshes, not weapons
    const sk = skinTex && mesh.userData.bodyMesh ? skinTex : null;
    const em = emisTex && mesh.userData.bodyMesh ? emisTex : null;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) =>
        tintedMaterial(m, materialTint, strength, sk, em, role),
      );
    } else {
      mesh.material = tintedMaterial(mesh.material, materialTint, strength, sk, em, role);
    }
  });
}

export function tintedFarMaterials(
  def: VisualDef,
  entityColor: number,
  srcMats: THREE.Material[],
): THREE.Material[] {
  const tint = tintFor(def, entityColor);
  const strength = def.tintStrength ?? DEFAULT_TINT_STRENGTH;
  return srcMats.map((m) => tintedMaterial(m, tint, strength));
}

// ---------------------------------------------------------------------------
// Per-key prepared data: normalization transform + baked idle-pose geometry
// ---------------------------------------------------------------------------

export interface PreparedVisual {
  key: string;
  def: VisualDef;
  /** uniform scale that brings the asset to def.height world units */
  normScale: number;
  /** lifts feet (or hover gap) onto the pivot plane, post-scale */
  yOffset: number;
  /** clip name -> clip, resolved from the source gltf */
  clips: Map<string, THREE.AnimationClip>;
  /** static idle-pose geometry in normalized space (far LOD + shadow proxy) */
  idleGeo: THREE.BufferGeometry | null;
  /** source materials aligned with idleGeo groups */
  idleSrcMats: THREE.Material[];
  /** click-capsule radius in world units (from measured XZ body extents —
   *  long/wide creatures like wolves need far more than a humanoid sliver) */
  clickRadius: number;
}

const prepared = new Map<string, PreparedVisual>();

export function prepareVisual(key: string): PreparedVisual {
  const hit = prepared.get(key);
  if (hit) return hit;
  const def = VISUALS[key];
  if (!def) throw new Error(`unknown visual key: ${key}`);
  const gltf = resolvedGltf(def.url);

  const clips = new Map<string, THREE.AnimationClip>();
  for (const clip of gltf.animations) clips.set(clip.name, clip);
  for (const url of def.animUrls ?? []) {
    for (const clip of resolvedGltf(url).animations) clips.set(clip.name, clip);
  }

  // Pose a throwaway clone mid-idle, measure it, and bake the static mesh.
  const temp = assembleModel(def);
  const idle = clips.get(def.clips.idle);
  if (idle) {
    const mixer = new THREE.AnimationMixer(temp);
    mixer.clipAction(idle).play();
    mixer.update(Math.min(0.5, idle.duration * 0.5));
    temp.updateMatrixWorld(true);
    temp.traverse((o) => {
      const sm = o as THREE.SkinnedMesh;
      if (sm.isSkinnedMesh) sm.skeleton.update();
    });
    mixer.stopAllAction();
    mixer.uncacheRoot(temp);
  } else {
    temp.updateMatrixWorld(true);
  }

  // body bounds from the skinned meshes only (weapons would skew the height)
  const bounds = new THREE.Box3();
  const v = new THREE.Vector3();
  temp.traverse((o) => {
    const sm = o as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh || !meshChainVisible(sm, temp)) return;
    const pos = sm.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos as THREE.BufferAttribute, i);
      sm.applyBoneTransform(i, v);
      v.applyMatrix4(sm.matrixWorld);
      bounds.expandByPoint(v);
    }
  });
  // Non-skinned models (procedural form GLBs animated by node transforms, with no
  // skeleton — e.g. the chicken-cow Travel Form) contribute no skinned meshes, so
  // the pass above leaves bounds empty; rawHeight then collapses to 1e-3 and
  // normScale explodes (~1500x), rendering the form off-screen/invisible. Fall back
  // to the plain posed mesh geometry. Only triggers when there are zero skinned
  // meshes, so skinned creatures/players are unaffected.
  if (bounds.isEmpty()) {
    temp.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (
        !mesh.isMesh ||
        (mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh ||
        !meshChainVisible(mesh, temp)
      )
        return;
      const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        v.applyMatrix4(mesh.matrixWorld);
        bounds.expandByPoint(v);
      }
    });
  }
  const rawHeight = Math.max(1e-3, bounds.max.y - bounds.min.y);
  const normScale = def.height / rawHeight;
  const yOffset = (def.hover ?? 0) - bounds.min.y * normScale;
  const clickRadius = Math.min(
    2.2,
    Math.max(
      0.5,
      Math.max(bounds.max.x, -bounds.min.x, bounds.max.z, -bounds.min.z) * normScale * 0.9,
    ),
  );

  const norm = new THREE.Matrix4()
    .makeTranslation(0, yOffset, 0)
    .multiply(new THREE.Matrix4().makeRotationY(def.yaw ?? 0))
    .multiply(new THREE.Matrix4().makeScale(normScale, normScale, normScale));

  const { geo, mats } = bakeStaticPose(temp, norm);

  const prep: PreparedVisual = {
    key,
    def,
    normScale,
    yOffset,
    clips,
    idleGeo: geo,
    idleSrcMats: mats,
    clickRadius,
  };
  prepared.set(key, prep);
  return prep;
}

function meshChainVisible(o: THREE.Object3D, stopAt: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = o;
  while (cur) {
    if (!cur.visible) return false;
    if (cur === stopAt) return true;
    cur = cur.parent;
  }
  return true;
}

/** Bake every visible mesh of a posed clone into one static BufferGeometry
 *  (skinned verts via applyBoneTransform), normalized into world units. */
function bakeStaticPose(
  root: THREE.Object3D,
  norm: THREE.Matrix4,
): { geo: THREE.BufferGeometry | null; mats: THREE.Material[] } {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const v = new THREE.Vector3();
  const full = new THREE.Matrix4();

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !meshChainVisible(mesh, root)) return;
    const srcGeo = mesh.geometry;
    const srcPos = srcGeo.getAttribute('position') as THREE.BufferAttribute;
    if (!srcPos) return;
    const out = new THREE.BufferGeometry();
    const baked = new Float32Array(srcPos.count * 3);
    const skinned = (mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh
      ? (mesh as unknown as THREE.SkinnedMesh)
      : null;
    full.multiplyMatrices(norm, mesh.matrixWorld);
    for (let i = 0; i < srcPos.count; i++) {
      v.fromBufferAttribute(srcPos, i);
      if (skinned) {
        skinned.applyBoneTransform(i, v);
        v.applyMatrix4(skinned.matrixWorld).applyMatrix4(norm);
      } else {
        v.applyMatrix4(full);
      }
      baked[i * 3] = v.x;
      baked[i * 3 + 1] = v.y;
      baked[i * 3 + 2] = v.z;
    }
    out.setAttribute('position', new THREE.BufferAttribute(baked, 3));
    const uv = srcGeo.getAttribute('uv');
    // dequantize to Float32 so u16-normalized parts (meshopt/quantized rigs)
    // merge cleanly with their Float32 siblings; baked position is already float
    if (uv) {
      const uvArr = new Float32Array(uv.count * 2);
      copyAttr(uv, uvArr);
      out.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    }
    if (srcGeo.index) out.setIndex(srcGeo.index.clone());
    out.computeVertexNormals();
    geos.push(out);
    // GLTFLoader emits one Mesh per primitive — materials are never arrays here
    mats.push(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material);
  });

  if (geos.length === 0) return { geo: null, mats: [] };
  // uv presence must agree for merging — drop uvs entirely if any geo lacks them
  const allHaveUv = geos.every((g) => g.getAttribute('uv'));
  if (!allHaveUv) for (const g of geos) g.deleteAttribute('uv');
  const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, true);
  if (geos.length === 1) {
    geo.clearGroups();
    geo.addGroup(0, geo.index ? geo.index.count : geo.getAttribute('position').count, 0);
  }
  return { geo, mats };
}
