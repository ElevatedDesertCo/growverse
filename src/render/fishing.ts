import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { terrainHeight, WATER_LEVEL } from '../sim/world';

// Fishing tackle visual, a RENDER-ONLY payoff for the local player's 5s fishing
// cast, no sim/IWorld/server state. The sim already runs the whole loop (useItem
// -> startFishing -> cast -> completeFishing -> "You receive: {fish}."); this draws
// the part the player watches: a line arcing from the rod hand to a red-and-white
// bobber riding the water ahead, an occasional nibble twitch, and a catch splash
// when the cast completes.
//
// It reads only what the renderer already has (the local player's rendered pos +
// facing and its cast state) and never mutates anything. Water placement samples
// the SAME deterministic `terrainHeight`/`WATER_LEVEL` the sim uses (the hard
// "terrain height = sim height" invariant) so the bobber can only land on genuinely
// castable water, matching the sim's own ahead-facing water check. Placement RNG is
// a local mulberry32 seeded from the world seed (render forbids Math.random).

// matches sim PLAYER_SWIM_DEPTH: ground this far under the line = castable water
const SWIM_DEPTH = 0.8;
const SEARCH_MIN = 3.5; // start looking this far ahead (past the player's feet)
const SEARCH_MAX = 26; // ...and no farther than this (the sim samples out to 24)
const SEARCH_STEP = 0.6; // ahead-sampling resolution when seeking the shoreline
const BOB_PERIOD = 1.9; // seconds per idle bob cycle
const BOB_AMP = 0.035; // idle vertical bob amplitude (yards)
const NIBBLE_MIN = 1.1; // min idle seconds between nibble twitches
const NIBBLE_MAX = 3.4; // max idle seconds between nibble twitches
const NIBBLE_TIME = 0.55; // how long a nibble dip lasts
const NIBBLE_DIP = 0.17; // how far the bobber dips on a nibble
const SPLASH_TIME = 0.5; // ripple lifetime
const NIBBLE_SPLASH = 0.55; // ripple radius for a nibble
const CATCH_SPLASH = 1.6; // ripple radius for the catch
const LINE_SEGMENTS = 14; // catenary sag resolution
// the cast completes when castRemaining reaches 0; if fishing ends with less than
// this left we treat it as a real catch (splash), otherwise it was cancelled.
const CATCH_REMAINING = 0.35;
const ROD_LENGTH = 1.55; // yards, butt (hand) to tip
const ROD_UP_BIAS = 0.86; // how much the rod points up vs forward (0..1)

export interface FishingView {
  group: THREE.Group;
  /**
   * per-frame: drive the bobber/line for the local player's fishing cast.
   * `px,py,pz` and `facing` are the RENDERED (interpolated) player transform;
   * `fishing` is castingAbility === FISHING_CAST_ID; `castRemaining` is seconds left.
   * `hand` is the mainhand bone's world position (from CharacterVisual) so the rod
   * butt anchors to the real hand; pass null to fall back to a facing-derived guess.
   */
  update(
    px: number,
    py: number,
    pz: number,
    facing: number,
    fishing: boolean,
    castRemaining: number,
    dt: number,
    hand: { x: number; y: number; z: number } | null,
  ): void;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// PURE (unit-testable): the classic red-and-white float, top sphere sitting at the
// water line with a white weighted nose below it, merged so the top and bottom keep
// their own colours via two small meshes (the caller builds them separately).
function bobberTopGeometry(): THREE.BufferGeometry {
  const ball = new THREE.SphereGeometry(0.13, 10, 8);
  const antenna = new THREE.CylinderGeometry(0.012, 0.012, 0.2, 5);
  antenna.translate(0, 0.2, 0);
  return mergeGeometries([ball, antenna]);
}

function bobberNoseGeometry(): THREE.ConeGeometry {
  const nose = new THREE.ConeGeometry(0.12, 0.22, 10);
  nose.rotateX(Math.PI); // point the tip straight down into the water
  nose.translate(0, -0.11, 0);
  return nose;
}

// The rod: a detailed procedural spinning rod as a small group, BUTT at the local
// origin and TIP at (0, ROD_LENGTH, 0) along +Y, so the caller only places the butt in
// the hand and aims +Y up-and-out; the line then hangs off the tip. Parts are merged by
// colour into a handful of solid-lambert meshes (cork grip, tapered graphite blank,
// black fittings + line guides, reel body, metal reel faces/handle) to keep the
// draw-call count low. Sizes are in yards; the reel hangs off the local -Z side.
function buildRod(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'rod';

  const cork: THREE.BufferGeometry[] = [];
  const graphite: THREE.BufferGeometry[] = [];
  const black: THREE.BufferGeometry[] = [];
  const reelBody: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];

  // rubber butt cap at the very end (in the hand)
  black.push(new THREE.SphereGeometry(0.036, 10, 8));

  // cork fore-grip
  const grip = new THREE.CylinderGeometry(0.03, 0.034, 0.3, 12);
  grip.translate(0, 0.15, 0);
  cork.push(grip);

  // reel seat: a black collar above the grip
  const seat = new THREE.CylinderGeometry(0.024, 0.028, 0.1, 12);
  seat.translate(0, 0.35, 0);
  black.push(seat);

  // reel foot/arm dropping below the seat to the spool
  const arm = new THREE.BoxGeometry(0.024, 0.02, 0.1);
  arm.translate(0, 0.335, -0.05);
  black.push(arm);

  // reel body (spool), axis along local X so a round face shows to each side
  const body = new THREE.CylinderGeometry(0.066, 0.066, 0.052, 16);
  body.rotateZ(Math.PI / 2);
  body.translate(0, 0.3, -0.11);
  reelBody.push(body);

  // two metal spool faces
  for (const sx of [0.03, -0.03]) {
    const face = new THREE.CylinderGeometry(0.072, 0.072, 0.012, 18);
    face.rotateZ(Math.PI / 2);
    face.translate(sx, 0.3, -0.11);
    metal.push(face);
  }

  // reel handle: a metal arm off the +X face plus a black knob
  const handleArm = new THREE.BoxGeometry(0.055, 0.012, 0.012);
  handleArm.translate(0.06, 0.3, -0.15);
  metal.push(handleArm);
  const knob = new THREE.CylinderGeometry(0.014, 0.014, 0.03, 8);
  knob.rotateZ(Math.PI / 2);
  knob.translate(0.088, 0.3, -0.175);
  black.push(knob);

  // tapered graphite blank from the reel seat to the tip
  const blankBottom = 0.4;
  const blankLen = ROD_LENGTH - blankBottom;
  const blank = new THREE.CylinderGeometry(0.006, 0.02, blankLen, 8);
  blank.translate(0, blankBottom + blankLen / 2, 0);
  graphite.push(blank);

  // line guides encircling the blank, plus a smaller tip guide
  for (const gy of [0.6, 0.86, 1.12, 1.36]) {
    const ring = new THREE.TorusGeometry(0.022, 0.005, 6, 12);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, gy, 0);
    black.push(ring);
  }
  const tipRing = new THREE.TorusGeometry(0.018, 0.006, 6, 12);
  tipRing.rotateX(Math.PI / 2);
  tipRing.translate(0, ROD_LENGTH - 0.02, 0);
  black.push(tipRing);

  const add = (geos: THREE.BufferGeometry[], color: number): void => {
    if (geos.length === 0) return;
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos);
    g.add(new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color })));
  };
  add(cork, 0xcaa66e); // cork tan
  add(graphite, 0x26262c); // graphite blank
  add(black, 0x141417); // fittings, guides, knob
  add(reelBody, 0x3b3e45); // reel body
  add(metal, 0x9aa0a8); // spool faces + handle arm

  return g;
}

// A flat expanding ring for the surface splash, laid in the XZ plane (mirrors fish.ts).
function splashGeometry(): THREE.RingGeometry {
  const ring = new THREE.RingGeometry(0.5, 1, 16);
  ring.rotateX(-Math.PI / 2);
  return ring;
}

export function buildFishing(seed: number): FishingView {
  const group = new THREE.Group();
  group.name = 'fishing';
  group.visible = false;
  const rng = mulberry32(seed ^ 0x9e3f7b21);

  // --- bobber (top ball + weighted nose) ---
  const bobber = new THREE.Group();
  const topMat = new THREE.MeshLambertMaterial({ color: 0xd23b2f }); // classic red
  const noseMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }); // white
  const top = new THREE.Mesh(bobberTopGeometry(), topMat);
  const nose = new THREE.Mesh(bobberNoseGeometry(), noseMat);
  bobber.add(top, nose);
  bobber.visible = false;
  group.add(bobber);

  // --- rod (procedural spinning rod held in the local player's hand) ---
  const rod = buildRod();
  rod.visible = false;
  group.add(rod);
  // reused per-frame scratch so aiming the rod allocates nothing
  const rodUp = new THREE.Vector3(0, 1, 0);
  const rodAim = new THREE.Vector3();
  const rodQuat = new THREE.Quaternion();

  // --- line (catenary from rod tip to bobber) ---
  const linePos = new Float32Array((LINE_SEGMENTS + 1) * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setDrawRange(0, LINE_SEGMENTS + 1);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xeef3f6,
    transparent: true,
    opacity: 0.55,
  });
  const line = new THREE.Line(lineGeo, lineMat);
  line.frustumCulled = false;
  line.visible = false;
  group.add(line);

  // --- splash ring (shared by nibble ripples + the catch) ---
  const splash = new THREE.Mesh(
    splashGeometry(),
    new THREE.MeshBasicMaterial({
      color: 0xdff1ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  splash.visible = false;
  group.add(splash);

  const depthAt = (x: number, z: number): number => WATER_LEVEL - terrainHeight(x, z, seed);

  // cast state (render-only, tracked across frames)
  let active = false;
  let bx = 0;
  let bz = 0; // bobber XZ (frozen at cast start)
  let bobPhase = 0;
  let nibbleTimer = 0; // idle countdown to the next nibble
  let nibbleAt = -1; // -1 idle; else seconds into the active dip
  let lastRemaining = 0; // castRemaining seen on the last fishing frame

  let splashAt = -1;
  let splashX = 0;
  let splashZ = 0;
  let splashMax = CATCH_SPLASH;

  // find the nearest castable water straight ahead; falls back to SEARCH_MAX so a
  // bobber always appears (the sim only starts a cast when water is genuinely ahead).
  const seekWater = (px: number, pz: number, facing: number): void => {
    const ax = Math.sin(facing);
    const az = Math.cos(facing);
    let dist = SEARCH_MAX;
    for (let d = SEARCH_MIN; d <= SEARCH_MAX; d += SEARCH_STEP) {
      const x = px + ax * d;
      const z = pz + az * d;
      if (depthAt(x, z) >= SWIM_DEPTH) {
        dist = d + 1.2; // nudge a touch past the shoreline into open water
        break;
      }
    }
    bx = px + ax * dist;
    bz = pz + az * dist;
    nibbleTimer = NIBBLE_MIN + rng() * (NIBBLE_MAX - NIBBLE_MIN);
    nibbleAt = -1;
    bobPhase = rng() * Math.PI * 2;
  };

  const startSplash = (x: number, z: number, maxR: number): void => {
    splashAt = 0;
    splashX = x;
    splashZ = z;
    splashMax = maxR;
  };

  const animateSplash = (dt: number): void => {
    if (splashAt < 0) {
      splash.visible = false;
      return;
    }
    splashAt += dt;
    const u = splashAt / SPLASH_TIME;
    if (u >= 1) {
      splashAt = -1;
      splash.visible = false;
      return;
    }
    const s = 0.25 + u * splashMax;
    splash.position.set(splashX, WATER_LEVEL + 0.02, splashZ);
    splash.scale.set(s, 1, s);
    (splash.material as THREE.MeshBasicMaterial).opacity = (1 - u) * 0.7;
    splash.visible = true;
  };

  // place + aim the rod in the player's hand; sets the world-space rod TIP (`tip`) so
  // the line hangs from the tip, not the fist. The butt sits at the mainhand bone's
  // real world position when the renderer supplies it (so the rod is genuinely held
  // and tracks the casting arm), falling back to a facing-derived guess otherwise; the
  // rod points up-and-out over the water. Scratch vectors are reused (no per-frame alloc).
  const tip = { x: 0, y: 0, z: 0 };
  const placeRod = (
    px: number,
    py: number,
    pz: number,
    facing: number,
    hand: { x: number; y: number; z: number } | null,
  ): void => {
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    let handX: number;
    let handY: number;
    let handZ: number;
    if (hand) {
      handX = hand.x;
      handY = hand.y;
      handZ = hand.z;
    } else {
      const rx = Math.cos(facing); // right = forward rotated -90 deg
      const rz = -Math.sin(facing);
      handX = px + fx * 0.34 + rx * 0.2;
      handZ = pz + fz * 0.34 + rz * 0.2;
      handY = py + 1.42;
    }
    // aim: mostly up, leaning forward over the water
    const fwd = 1 - ROD_UP_BIAS;
    rodAim.set(fx * fwd, ROD_UP_BIAS, fz * fwd).normalize();
    rodQuat.setFromUnitVectors(rodUp, rodAim);
    rod.position.set(handX, handY, handZ);
    rod.quaternion.copy(rodQuat);
    tip.x = handX + rodAim.x * ROD_LENGTH;
    tip.y = handY + rodAim.y * ROD_LENGTH;
    tip.z = handZ + rodAim.z * ROD_LENGTH;
  };

  // draw the sagging line from the rod tip to the top of the bobber
  const drawLine = (bobberTopY: number): void => {
    const dx = bx - tip.x;
    const dz = bz - tip.z;
    const span = Math.hypot(dx, dz);
    const sag = Math.min(0.5, span * 0.06);
    for (let i = 0; i <= LINE_SEGMENTS; i++) {
      const t = i / LINE_SEGMENTS;
      const x = tip.x + dx * t;
      const z = tip.z + dz * t;
      const y = tip.y + (bobberTopY - tip.y) * t - sag * Math.sin(Math.PI * t);
      linePos[i * 3] = x;
      linePos[i * 3 + 1] = y;
      linePos[i * 3 + 2] = z;
    }
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.computeBoundingSphere();
  };

  return {
    group,
    update(px, py, pz, facing, fishing, castRemaining, dt, hand): void {
      // edge-detect the cast so the bobber freezes where it first landed
      if (fishing && !active) {
        active = true;
        seekWater(px, pz, facing);
      } else if (!fishing && active) {
        active = false;
        // completed cast (little time left) rewards a splash; a cancel does not
        if (lastRemaining <= CATCH_REMAINING) {
          startSplash(bx, bz, CATCH_SPLASH);
        }
        bobber.visible = false;
        line.visible = false;
        rod.visible = false;
      }
      if (fishing) lastRemaining = castRemaining;

      group.visible = active || splashAt >= 0;

      if (active) {
        bobPhase += dt;
        // idle bob, plus a periodic nibble dip that yanks the float under
        let y = WATER_LEVEL + Math.sin((bobPhase * Math.PI * 2) / BOB_PERIOD) * BOB_AMP;
        if (nibbleAt >= 0) {
          nibbleAt += dt;
          const nu = nibbleAt / NIBBLE_TIME;
          if (nu >= 1) {
            nibbleAt = -1;
            nibbleTimer = NIBBLE_MIN + rng() * (NIBBLE_MAX - NIBBLE_MIN);
          } else {
            // dip down then bob back up over the twitch
            y -= NIBBLE_DIP * Math.sin(Math.PI * nu);
          }
        } else {
          nibbleTimer -= dt;
          if (nibbleTimer <= 0) {
            nibbleAt = 0;
            startSplash(bx, bz, NIBBLE_SPLASH); // a small ring as it tugs
          }
        }
        // the nose sinks a hair with the ball so the whole float rides the dip
        bobber.position.set(bx, y, bz);
        bobber.visible = true;
        line.visible = true;
        rod.visible = true;
        placeRod(px, py, pz, facing, hand);
        drawLine(y + 0.13);
      }

      animateSplash(dt);
    },
  };
}
