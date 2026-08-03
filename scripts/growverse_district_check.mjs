// Placement + layout verification for the whole cultivation arc.
//
// The Vitest suite proves the LOGIC of the grow loop, but it cannot see whether the
// Cup Steward is standing knee-deep in a hillside or whether eleven profession rows
// still fit on the character sheet. This script checks both halves:
//
//   NUMERIC   every new NPC sits on the terrain (its y matches terrainHeight there),
//             every new building rests on the leveled farm ground (corner height spread),
//             every new building actually made it into the rendered scene graph, and no
//             two stations are close enough to be reachable from one spot.
//   VISUAL    a screenshot of the grow district and of every window the arc added,
//             because layout is the thing only eyes can judge.
//
// Numeric first on purpose: "the NPC is 3yd underground" is a number, and a number
// fails loudly, whereas a screenshot needs someone to notice.
//
// Usage: npm run dev, then `node scripts/growverse_district_check.mjs`.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('tmp/district', { recursive: true });

let fail = 0;
const check = (name, ok, extra = '') => {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  ${extra}` : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: [
    '--window-size=1600,900',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--proxy-bypass-list=<-loopback>',
    ...(process.getuid?.() === 0 ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
  ],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
const pageErrors = [];
// The sandbox routes outbound HTTPS through a proxy, so third-party beacons (analytics,
// fonts) log transport failures that say nothing about the game. Keep only game errors.
const NETWORK_NOISE =
  /net::ERR_|Failed to (?:load resource|fetch)|ERR_PROXY|\b40[357]\b|\b50[023]\b/i;
const noteError = (text) => {
  if (!NETWORK_NOISE.test(text)) pageErrors.push(text);
};
page.on('pageerror', (e) => noteError(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') noteError(`console: ${m.text()}`);
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#btn-offline', { timeout: 60000 });
await page.evaluate(() => document.querySelector('#btn-offline').click());
await sleep(400);
await page.type('#char-name', 'Grower');
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="mage"]').click(),
);
await page.evaluate(() => document.querySelector('#btn-start-offline').click());
await page.waitForFunction(() => !!window.__game?.renderer, { timeout: 60000 });
await sleep(2500);
await page.evaluate(() => document.querySelector('.tut-skip')?.click());

// ---- Numeric placement ------------------------------------------------------------
const placement = await page.evaluate(async () => {
  const { NPCS } = await import('/src/sim/data');
  const { terrainHeight } = await import('/src/sim/world');
  const { ZONE1_PROPS } = await import('/src/sim/content/zone1');
  const sim = window.__game.sim;
  const seed = sim.cfg.seed;

  // The NPCs this arc added, plus Marlow as the known-good control: if the control
  // fails the same check, the check is wrong, not the placement.
  const ids = [
    'cultivator_marlow',
    'glyphwright_orrin',
    'extractor_rell',
    'cup_steward_wilder',
    'alchemist_sable',
  ];
  const npcs = ids.map((id) => {
    const def = NPCS[id];
    const ent = [...sim.entities.values()].find((e) => e.templateId === id);
    return {
      id,
      def: def ? { x: def.pos.x, z: def.pos.z } : null,
      spawned: !!ent,
      y: ent ? ent.pos.y : null,
      ground: def ? terrainHeight(def.pos.x, def.pos.z, seed) : null,
    };
  });

  // Every building's four corners, so a floating or tilted footprint shows as spread.
  const buildings = (ZONE1_PROPS.buildings ?? []).map((b) => {
    const hw = b.w / 2;
    const hd = b.d / 2;
    const corners = [
      [b.x - hw, b.z - hd],
      [b.x + hw, b.z - hd],
      [b.x - hw, b.z + hd],
      [b.x + hw, b.z + hd],
    ].map(([x, z]) => terrainHeight(x, z, seed));
    return {
      kind: b.kind,
      x: b.x,
      z: b.z,
      w: b.w,
      d: b.d,
      spread: Math.max(...corners) - Math.min(...corners),
    };
  });

  // Pairwise NPC distance: two stations closer than the interact gate (7yd) would mean
  // one spot reaches both, which is the bug that moved Orrin once already.
  const pairs = [];
  for (let i = 0; i < npcs.length; i++) {
    for (let j = i + 1; j < npcs.length; j++) {
      const a = npcs[i];
      const b = npcs[j];
      if (!a.def || !b.def) continue;
      pairs.push({
        a: a.id,
        b: b.id,
        d: Math.hypot(a.def.x - b.def.x, a.def.z - b.def.z),
      });
    }
  }
  return { npcs, buildings, pairs };
});

console.log('\n--- NPC placement ---');
for (const n of placement.npcs) {
  check(`${n.id} spawned`, n.spawned);
  if (!n.spawned || n.y === null) continue;
  const dy = Math.abs(n.y - n.ground);
  check(`${n.id} stands on the terrain`, dy < 1.5, `|y - ground| = ${dy.toFixed(2)}yd`);
}

console.log('\n--- Building footprints (corner height spread) ---');
// Only the grow-district buildings are ASSERTED. props.ts deliberately seats a house at
// its highest footprint corner and fills the downhill wedge with a stone plinth, so a
// nonzero spread on the town ring is handled, not a bug. The two grow buildings sit
// inside the leveled GARDEN_FARM terrace, so for them flat is the actual contract and a
// spread means the terrace stopped covering the footprint.
const GROW_BUILDINGS = [
  [60, 45, 'the Breeding Chamber'],
  [74, 45, 'the Extraction Lab'],
];
for (const [gx, gz, label] of GROW_BUILDINGS) {
  const b = placement.buildings.find((q) => q.x === gx && q.z === gz);
  check(`${label} is declared at (${gx}, ${gz})`, !!b);
  if (b)
    check(
      `${label} rests on level farm ground`,
      b.spread <= 0.1,
      `spread ${b.spread.toFixed(3)}yd`,
    );
}
for (const b of placement.buildings) {
  if (b.spread > 0.5) {
    console.log(
      `  note: ${b.kind} at (${b.x}, ${b.z}) sits on a slope, spread ${b.spread.toFixed(3)}yd (plinth-seated)`,
    );
  }
}

// A declared building that never reaches the scene graph draws nothing, and no numeric
// footprint check would notice. Walk the rendered scene for geometry standing at each
// grow building's coordinates.
console.log('\n--- Buildings reached the rendered scene ---');
const built = await page.evaluate((targets) => {
  const scene = window.__game.renderer.scene;
  const out = {};
  if (!scene) return out;
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (o.type !== 'Mesh') return;
    const e = o.matrixWorld.elements;
    for (const [tx, tz, label] of targets) {
      if (Math.hypot(e[12] - tx, e[14] - tz) < 4) out[label] = (out[label] ?? 0) + 1;
    }
  });
  return out;
}, GROW_BUILDINGS);
for (const [, , label] of GROW_BUILDINGS) {
  check(
    `${label} has geometry in the scene`,
    (built[label] ?? 0) > 0,
    `${built[label] ?? 0} meshes`,
  );
}

console.log('\n--- Station separation (interact gate is 7yd) ---');
for (const p of placement.pairs) {
  if (p.d >= 7) continue;
  check(`${p.a} and ${p.b} are not both reachable from one spot`, false, `${p.d.toFixed(1)}yd`);
}
console.log(`  (closest pair: ${Math.min(...placement.pairs.map((p) => p.d)).toFixed(1)}yd)`);

// ---- Visual: the grow district ----------------------------------------------------
console.log('\n--- Screenshots ---');
// God-mode so nothing interrupts the tour, then walk the district.
await page.evaluate(() => {
  const p = window.__game.sim.player;
  p.hp = p.maxHp = 100000;
});

const spots = [
  ['grow_field_north', 60, 78, Math.PI],
  ['cup_steward', 60, 76, Math.PI],
  ['extraction_lab', 74, 56, Math.PI],
  ['breeding_chamber', 60, 38, 0],
  ['town_west_quarter', -26, -2, 1.9],
];
for (const [name, x, z, facing] of spots) {
  await page.evaluate(
    (a) => {
      const g = window.__game;
      g.sim.player.pos.x = a[0];
      g.sim.player.pos.z = a[1];
      g.sim.player.facing = a[2];
      g.sim.player.prevPos = { ...g.sim.player.pos };
      // The chase camera owns its own yaw; the player's facing does NOT steer it (mouselook
      // does, and camera_follow then pushes the yaw back onto the player). Setting only
      // sim.player.facing leaves the camera pointing wherever it already was, which makes
      // every screenshot below a picture of the wrong direction.
      g.input.camYaw = a[2];
    },
    [x, z, facing],
  );
  await sleep(1400);
  await page.screenshot({ path: `tmp/district/${name}.png` });
  console.log(`  wrote tmp/district/${name}.png`);
}

// ---- Visual: every window the arc added -------------------------------------------
// Seed the player so each window has real content rather than an empty state.
await page.evaluate(async () => {
  const sim = window.__game.sim;
  const { BASE_STRAINS } = await import('/src/sim/data');
  const { baseStrain } = await import('/src/sim/genetics.ts');
  const meta = sim.players.get(sim.primaryId);
  meta.strains.length = 0;
  const names = ['Fen Haze', 'Copper Diesel', 'Vale Kush', 'Marsh Amber'];
  names.forEach((n, i) => {
    const s = baseStrain(i % 2 ? BASE_STRAINS.enriched_bloom : BASE_STRAINS.common_bloom, `v${i}`);
    s.name = n;
    s.mastery = [0, 34, 71, 100][i];
    if (i === 3) s.landrace = true;
    s.lineage = i > 1 ? ['Fen Haze', 'Copper Diesel'] : undefined;
    s.breeder = i > 1 ? 'Grower' : undefined;
    meta.strains.push(s);
  });
  for (const id of ['bud_common', 'bud_fine', 'bud_prime', 'epic_bud']) sim.addItem(id, 40);
  sim.addItem('common_seed', 6);
  // Every profession at a different level so the panel shows real bars, not zeros.
  const profs = meta.professions;
  Object.keys(profs).forEach((k, i) => {
    profs[k] = [4, 17, 31, 48, 12, 63, 25, 9, 77, 55, 41][i] ?? 20;
  });
  // A growing plot mid-tend, so the Garden window shows the Tend control.
  sim.plantSeed(0, 'common_seed');
  sim.plantSeed(1, 'common_seed');
  // A few Cup entries so the board is not empty.
  const { cupSeasonAt } = await import('/src/sim/cup.ts');
  sim.cupEntries.length = 0;
  const season = cupSeasonAt(sim.time);
  sim.cupEntries.push(
    {
      season,
      pid: 999,
      growerName: 'Thistledown',
      strainName: 'Ridge Amber',
      budItemId: 'bud_prime',
      score: 412,
    },
    {
      season,
      pid: sim.player.id,
      growerName: 'Grower',
      strainName: 'Vale Kush',
      budItemId: 'bud_fine',
      score: 268,
    },
    {
      season,
      pid: 998,
      growerName: 'Bram',
      strainName: 'Fen Diesel',
      budItemId: 'bud_common',
      score: 155,
    },
  );
});

// Each entry names the Hud method AND the root element it is supposed to reveal. The
// root is not decoration: an opener that silently does nothing (a renamed method, an
// early return) leaves the previous window on screen, and every "does it overflow"
// check then passes against a page that never opened the window at all.
const windows = [
  ['win_character', 'toggleChar', '#char-window'],
  ['win_garden', 'openGarden', '#garden-window'],
  ['win_breeding', 'openBreeding', '#breeding-window'],
  ['win_cup', 'openCup', '#cup-window'],
];
for (const [name, method, rootSel] of windows) {
  try {
    const called = await page.evaluate(
      (a) => {
        const hud = window.__game.hud;
        // Opening a window deliberately does NOT close its siblings (closeOtherWindows
        // only clears transient overlays), so without this the previous window is still
        // on screen and each screenshot is a picture of a stack.
        for (let i = 0; i < 12 && hud.closeAll(); i++);
        if (typeof hud[a[0]] !== 'function') return false;
        hud[a[0]]();
        return true;
      },
      [method],
    );
    check(`${name} has a Hud.${method}() opener`, called);
    if (!called) continue;
    await sleep(700);
    const shown = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { present: false };
      const cs = getComputedStyle(el);
      return {
        present: true,
        visible: cs.display !== 'none' && cs.visibility !== 'hidden',
        w: el.getBoundingClientRect().width,
      };
    }, rootSel);
    check(
      `${name} actually shows ${rootSel}`,
      shown.present && shown.visible && shown.w > 0,
      JSON.stringify(shown),
    );
    await page.screenshot({ path: `tmp/district/${name}.png` });
    console.log(`  wrote tmp/district/${name}.png`);
    // Overflow check: a window that scrolls its own body is fine, one that pushes the
    // PAGE horizontally is a layout bug.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    check(`${name} does not overflow the page horizontally`, !overflow);
  } catch (e) {
    check(`${name} opens`, false, String(e.message).slice(0, 120));
  }
}

console.log('\n--- Page errors ---');
check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));

await browser.close();
console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail > 0 ? 1 : 0);
