// The 5 procedural Tier C characters. Each recipe declares its materials (authored sRGB
// hex) and a build(body, ctx) that adds boxes/segments bound to the shared Rig_Medium
// bones. Geometry is authored in bind-world space (recipes read live bone positions from
// `ctx.joints`), so nothing is hardcoded to the skeleton's offset. See
// docs/design/custom-character-pipeline.md and gen_character.mjs.
import * as THREE from 'three';

// --- small helpers ---------------------------------------------------------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const add = (p, x, y, z) => p.clone().add(V(x, y, z));
const mid = (a, b) => a.clone().add(b).multiplyScalar(0.5);
const SIDES = ['l', 'r'];

/** A box centered at bone `bone`'s position plus an offset, bound to `bone`. */
function blob(body, J, bone, size, mat, off = [0, 0, 0]) {
  body.box({ center: add(J.get(bone), ...off), size, joint: bone, mat });
}
/** A limb segment from bone `a`'s pos to bone `b`'s pos, bound to `bind`. */
function seg(body, J, a, b, bind, mat, w, d) {
  body.segment({ from: J.get(a), to: J.get(b), joint: bind, mat, width: w, depth: d ?? w });
}

/**
 * Shared humanoid scaffold: torso, head base, arms, legs, at caller-chosen thicknesses.
 * Recipes call this then add their unique silhouette (horns, cloak, wings, crown, ...).
 */
function scaffold(body, J, m, d) {
  // torso: pelvis (hips), belly (spine), chest (chest)
  const chest = J.get('chest');
  const spine = J.get('spine');
  blob(body, J, 'hips', [d.torsoW, 0.5 * d.torsoH, d.torsoD], m.body, [0, -0.1, 0]);
  body.box({
    center: mid(spine, chest),
    size: [d.torsoW * d.taper, d.torsoH, d.torsoD],
    joint: 'spine',
    mat: m.body,
  });
  blob(body, J, 'chest', [d.torsoW * d.shoulder, 0.5 * d.torsoH, d.torsoD], m.body, [0, 0.05, 0]);
  // head base cube (recipes add crowns/horns/visors on top)
  blob(body, J, 'head', d.head, m.head, [0, d.head[1] * 0.5, 0]);
  // neck
  body.box({
    center: mid(chest, J.get('head')),
    size: [d.neck, 0.18, d.neck],
    joint: 'chest',
    mat: m.head,
  });

  for (const s of SIDES) {
    // arm: upper, fore, hand
    seg(body, J, `upperarm.${s}`, `lowerarm.${s}`, `upperarm.${s}`, m.body, d.arm, d.arm);
    seg(
      body,
      J,
      `lowerarm.${s}`,
      `wrist.${s}`,
      `lowerarm.${s}`,
      m.body,
      d.arm * 0.85,
      d.arm * 0.85,
    );
    blob(body, J, `hand.${s}`, [d.hand, d.hand, d.hand], m.accent);
    // leg: thigh, shin
    seg(body, J, `upperleg.${s}`, `lowerleg.${s}`, `upperleg.${s}`, m.body, d.leg, d.leg);
    seg(body, J, `lowerleg.${s}`, `foot.${s}`, `lowerleg.${s}`, m.body, d.leg * 0.85, d.leg * 0.85);
    if (d.feet) {
      // foot: a block from ankle forward past the toes
      const f = J.get(`foot.${s}`);
      const t = J.get(`toes.${s}`);
      body.box({
        center: add(mid(f, t), 0, -0.02, 0.12),
        size: [d.leg * 1.1, 0.16, d.footLen],
        joint: `foot.${s}`,
        mat: m.accent,
      });
    }
  }
}

// --- 1. Stoneheart Golem: bulky rock brute, glowing core ------------------
const GOLEM = {
  name: 'Stoneheart Golem',
  materials: [
    { color: 0x9aa0a8, roughness: 0.95 }, // 0 granite
    { color: 0x767c84, roughness: 0.95 }, // 1 dark stone
    { color: 0x6fa552, roughness: 0.8 }, // 2 moss
    { color: 0x3ff0df, emissive: 0x2fd8c8, roughness: 0.4 }, // 3 crystal core
  ],
  build(body, { joints: J }) {
    scaffold(
      body,
      J,
      { body: 0, head: 1, accent: 1 },
      {
        torsoW: 1.15,
        torsoH: 0.95,
        torsoD: 0.85,
        taper: 1.05,
        shoulder: 1.25,
        head: [0.62, 0.5, 0.6],
        neck: 0.34,
        arm: 0.42,
        leg: 0.5,
        hand: 0.5,
        feet: true,
        footLen: 0.6,
      },
    );
    // boulder shoulders + brow + moss patches + glowing chest core
    for (const s of SIDES) {
      blob(body, J, `upperarm.${s}`, [0.62, 0.5, 0.62], 0, [s === 'l' ? 0.12 : -0.12, 0.12, 0]);
      blob(body, J, `hand.${s}`, [0.62, 0.55, 0.62], 1); // heavy fists
    }
    blob(body, J, 'head', [0.66, 0.14, 0.2], 1, [0, 0.34, 0.28]); // brow ridge
    blob(body, J, 'chest', [0.28, 0.34, 0.2], 3, [0, 0.02, 0.42]); // core
    blob(body, J, 'chest', [0.5, 0.2, 0.3], 2, [0, 0.34, -0.1]); // moss on back-shoulders
    blob(body, J, 'hips', [0.3, 0.2, 0.3], 2, [0.3, 0.1, -0.1]);
  },
};

// --- 2. Hollow Wraith: tall thin spectre, hooded, no feet -----------------
const WRAITH = {
  name: 'Hollow Wraith',
  materials: [
    { color: 0x2a2450, roughness: 0.6 }, // 0 robe indigo
    { color: 0x1a1636, roughness: 0.6 }, // 1 shadow
    { color: 0xcfd2e6, roughness: 0.5 }, // 2 pale face
    { color: 0x54f0ff, emissive: 0x40e6ff, roughness: 0.3 }, // 3 ghost light eyes
  ],
  build(body, { joints: J }) {
    scaffold(
      body,
      J,
      { body: 0, head: 2, accent: 1 },
      {
        torsoW: 0.62,
        torsoH: 1.05,
        torsoD: 0.5,
        taper: 0.8,
        shoulder: 1.05,
        head: [0.42, 0.44, 0.42],
        neck: 0.16,
        arm: 0.2,
        leg: 0.24,
        hand: 0.22,
        feet: false,
      },
    );
    // legs taper to wisps instead of feet
    for (const s of SIDES) {
      const lo = J.get(`lowerleg.${s}`);
      body.box({
        center: add(lo, 0, -0.5, 0),
        size: [0.1, 0.7, 0.1],
        joint: `lowerleg.${s}`,
        mat: 1,
      });
    }
    // hood: a peaked shroud over the head
    blob(body, J, 'head', [0.5, 0.34, 0.5], 0, [0, 0.5, -0.02]);
    blob(body, J, 'head', [0.34, 0.34, 0.34], 0, [0, 0.78, -0.05]);
    blob(body, J, 'head', [0.2, 0.24, 0.2], 0, [0, 1.0, -0.08]);
    // glowing eyes
    for (const dx of [-0.11, 0.11]) blob(body, J, 'head', [0.09, 0.06, 0.06], 3, [dx, 0.2, 0.24]);
    // ragged cloak panels hanging from chest + hips
    blob(body, J, 'chest', [0.66, 0.9, 0.08], 1, [0, -0.5, -0.28]);
    blob(body, J, 'hips', [0.56, 0.8, 0.08], 0, [0, -0.4, -0.24]);
  },
};

// --- 3. Emberling Imp: small round fiend, horns, tail, wings ---------------
const IMP = {
  name: 'Emberling Imp',
  materials: [
    { color: 0xd8582e, roughness: 0.7 }, // 0 ember skin
    { color: 0x9c3a1e, roughness: 0.7 }, // 1 deep red
    { color: 0x2b2320, roughness: 0.6 }, // 2 charcoal horns
    { color: 0xffd23f, emissive: 0xffb020, roughness: 0.4 }, // 3 glowing eyes/belly
  ],
  build(body, { joints: J }) {
    scaffold(
      body,
      J,
      { body: 0, head: 0, accent: 1 },
      {
        torsoW: 1.0,
        torsoH: 0.8,
        torsoD: 0.95,
        taper: 1.15,
        shoulder: 0.95,
        head: [0.66, 0.6, 0.62],
        neck: 0.2,
        arm: 0.26,
        leg: 0.3,
        hand: 0.3,
        feet: true,
        footLen: 0.42,
      },
    );
    // round glowing belly
    blob(body, J, 'spine', [0.5, 0.4, 0.3], 3, [0, -0.15, 0.4]);
    // two curved horns (angled segments) off the head
    for (const s of SIDES) {
      const h = add(J.get('head'), s === 'l' ? 0.18 : -0.18, 0.5, 0);
      body.segment({
        from: h,
        to: add(h, s === 'l' ? 0.18 : -0.18, 0.42, -0.12),
        joint: 'head',
        mat: 2,
        width: 0.14,
        depth: 0.14,
      });
      // glowing eyes
      blob(body, J, 'head', [0.1, 0.08, 0.06], 3, [s === 'l' ? 0.14 : -0.14, 0.24, 0.3]);
    }
    // little bat wings off the chest, swept back
    for (const s of SIDES) {
      const c = add(J.get('chest'), s === 'l' ? 0.3 : -0.3, 0.1, -0.2);
      body.box({
        center: c,
        size: [0.5, 0.6, 0.06],
        joint: 'chest',
        mat: 1,
        quat: new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), s === 'l' ? -0.6 : 0.6),
      });
    }
    // pointed tail from the hips
    let p = add(J.get('hips'), 0, -0.1, -0.3);
    for (let i = 0; i < 3; i++) {
      const nx = add(p, 0, -0.05 - i * 0.02, -0.28);
      body.segment({
        from: p,
        to: nx,
        joint: 'hips',
        mat: 1,
        width: 0.16 - i * 0.04,
        depth: 0.16 - i * 0.04,
      });
      p = nx;
    }
  },
};

// --- 4. Chrome Sentinel: sleek android, visor, antenna --------------------
const SENTINEL = {
  name: 'Chrome Sentinel',
  // Metals need an env map to read as chrome; the guide/still light rig has none, so keep
  // metallic modest and the base light so the plates read bright there and shinier in-game.
  materials: [
    { color: 0xdfe4ea, metallic: 0.35, roughness: 0.3 }, // 0 chrome
    { color: 0x4a515c, metallic: 0.3, roughness: 0.45 }, // 1 dark joint
    { color: 0x37d6ff, emissive: 0x2fccff, roughness: 0.3 }, // 2 cyan trim
    { color: 0xaab2c0, metallic: 0.35, roughness: 0.35 }, // 3 steel
  ],
  build(body, { joints: J }) {
    scaffold(
      body,
      J,
      { body: 0, head: 3, accent: 1 },
      {
        torsoW: 0.7,
        torsoH: 1.0,
        torsoD: 0.55,
        taper: 0.7,
        shoulder: 1.0,
        head: [0.44, 0.42, 0.46],
        neck: 0.16,
        arm: 0.26,
        leg: 0.32,
        hand: 0.26,
        feet: true,
        footLen: 0.5,
      },
    );
    // broad angular pauldrons
    for (const s of SIDES) {
      blob(body, J, `upperarm.${s}`, [0.44, 0.3, 0.5], 0, [s === 'l' ? 0.16 : -0.16, 0.2, 0]);
      blob(body, J, `lowerleg.${s}`, [0.36, 0.2, 0.4], 2, [0, 0.1, 0.02]); // knee light
      blob(body, J, `lowerarm.${s}`, [0.3, 0.16, 0.3], 2, [0, 0, 0]); // elbow light
    }
    // visor: dark head band + a cyan slit
    blob(body, J, 'head', [0.48, 0.16, 0.06], 1, [0, 0.2, 0.24]);
    blob(body, J, 'head', [0.4, 0.06, 0.05], 2, [0, 0.2, 0.27]);
    // chest core + collar trim
    blob(body, J, 'chest', [0.2, 0.2, 0.12], 2, [0, 0.05, 0.32]);
    blob(body, J, 'chest', [0.6, 0.08, 0.5], 1, [0, 0.36, 0]);
    // antenna
    const top = add(J.get('head'), 0.12, 0.5, 0);
    body.segment({
      from: top,
      to: add(top, 0.02, 0.4, 0),
      joint: 'head',
      mat: 3,
      width: 0.05,
      depth: 0.05,
    });
    blob(body, J, 'head', [0.09, 0.09, 0.09], 2, [0.14, 0.92, 0]);
  },
};

// --- 5. Thornwood Sprout: mossy plant-being, leafy crown ------------------
const SPROUT = {
  name: 'Thornwood Sprout',
  materials: [
    { color: 0x7a5433, roughness: 0.9 }, // 0 bark
    { color: 0x5c3f27, roughness: 0.9 }, // 1 dark bark
    { color: 0x5aa03c, roughness: 0.8 }, // 2 leaf green
    { color: 0xe86fa0, roughness: 0.7 }, // 3 flower
  ],
  build(body, { joints: J }) {
    scaffold(
      body,
      J,
      { body: 0, head: 0, accent: 1 },
      {
        torsoW: 0.9,
        torsoH: 0.9,
        torsoD: 0.8,
        taper: 1.1,
        shoulder: 0.9,
        head: [0.5, 0.5, 0.5],
        neck: 0.22,
        arm: 0.18,
        leg: 0.34,
        hand: 0.24,
        feet: false,
      },
    );
    // splayed root feet
    for (const s of SIDES) {
      const f = J.get(`foot.${s}`);
      for (const dx of [-0.14, 0.14])
        body.segment({
          from: f,
          to: add(f, dx, -0.2, 0.18),
          joint: `foot.${s}`,
          mat: 1,
          width: 0.12,
          depth: 0.12,
        });
      // leaf hands
      blob(body, J, `hand.${s}`, [0.34, 0.1, 0.28], 2);
    }
    // mushroom-cap shoulders
    for (const s of SIDES)
      blob(body, J, `upperarm.${s}`, [0.44, 0.16, 0.44], 2, [s === 'l' ? 0.1 : -0.1, 0.16, 0]);
    // leafy crown: a cluster of angled leaf blades on the head
    const angles = [-0.7, -0.3, 0, 0.3, 0.7];
    for (const a of angles) {
      const c = add(J.get('head'), Math.sin(a) * 0.24, 0.56, Math.cos(a) * 0.05);
      body.box({
        center: c,
        size: [0.16, 0.5, 0.06],
        joint: 'head',
        mat: 2,
        quat: new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), a),
      });
    }
    // a flower bloom on top + eyes
    blob(body, J, 'head', [0.18, 0.14, 0.18], 3, [0, 0.86, 0]);
    for (const dx of [-0.12, 0.12]) blob(body, J, 'head', [0.09, 0.1, 0.06], 1, [dx, 0.2, 0.26]);
  },
};

export const RECIPES = [
  { key: 'custom_golem', ...GOLEM },
  { key: 'custom_wraith', ...WRAITH },
  { key: 'custom_imp', ...IMP },
  { key: 'custom_sentinel', ...SENTINEL },
  { key: 'custom_sprout', ...SPROUT },
];
