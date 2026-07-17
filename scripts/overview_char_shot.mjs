// Desktop + mobile screenshot of the character sheet's new OVERVIEW tab (commune
// standing, active Bloom Sessions, strain library). Offline flow (no server). Seeds
// reputation, a couple of library strains, and an active session buff so all three
// panels render, opens the character window, clicks the Overview tab, and captures it.
// Needs `npm run dev`. Writes PNGs to tmp/. MOBILE=1 for the phone viewport.

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

import { BROWSER_PATH as EDGE } from './browser_path.mjs';
import { enterOfflineGame } from './enter_offline_game.mjs';

const URL = (process.env.GAME_URL ?? 'http://localhost:5173') + '/?gfx=low';
const CLASS = process.env.GAME_CLASS ?? 'warrior';
fs.mkdirSync('tmp', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const MOBILE = process.env.MOBILE === '1';
const page = await browser.newPage();
await page.setViewport(
  MOBILE
    ? { width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : { width: 1280, height: 1180, deviceScaleFactor: 2 },
);
if (MOBILE) {
  const cdp = await page.target().createCDPSession();
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }] });
}

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tap = (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
await enterOfflineGame(page, { charClass: CLASS, charName: 'Growmancer' });
const booted = await page
  .waitForFunction(() => window.__game?.sim?.player, { timeout: 60000, polling: 500 })
  .then(() => true)
  .catch(() => false);
if (!booted) {
  await page.screenshot({ path: 'tmp/overview_boot_fail.png' });
  console.log('BOOT FAILED. errors:\n' + (errors.join('\n') || '(none)'));
  await browser.close();
  process.exit(1);
}
await wait(1200);

// God-mode the camera, then seed all three Overview panels: commune standing (a
// friendly-tier points total), a small strain library, and one active Bloom Session.
await page.evaluate(() => {
  const sim = window.__game.sim;
  const p = sim.player;
  p.maxHp = 99999;
  p.hp = 99999;
  p.level = 12;
  const meta = sim.primary;
  if (meta) {
    // Commune standing: 900 points sits in Friendly, partway to Honored (500..1500).
    meta.reputation.baked_beaver = 900;
    // A few library strains (expressed phenotype comes from the dominant allele).
    meta.strains.length = 0;
    meta.strains.push(
      {
        id: 'demo1',
        baseId: 'enriched_bloom',
        name: 'Emerald Haze',
        genotype: { potency: [3, 2], vigor: [2, 1], yield: [2, 2] },
        landrace: false,
      },
      {
        id: 'demo2',
        baseId: 'prime_bloom',
        name: 'Sunset Kush',
        genotype: { potency: [4, 3], vigor: [3, 3], yield: [3, 2] },
        landrace: true,
      },
      {
        id: 'demo3',
        baseId: 'common_bloom',
        name: 'Valley Common',
        genotype: { potency: [1, 0], vigor: [1, 1], yield: [1, 0] },
        landrace: false,
      },
    );
    if (meta.professions) {
      meta.professions.mining = 34;
      meta.professions.herbalism = 67;
      meta.professions.logging = 8;
    }
  }
  // An active Bloom Session buff on the player (the id prefix is what the overview
  // filters on; a real session applies this via the elixir/aura path).
  p.auras.push({
    id: 'elixir_lively_bloom_tonic',
    name: 'Lively Bloom',
    kind: 'buff_haste',
    remaining: 214,
    duration: 300,
    value: 1.12,
    sourceId: p.id,
    school: 'nature',
  });
  // Grant a spread of bag items so the Gear tab's embedded inventory renders full too.
  for (const [id, n] of [
    ['rough_timber', 12],
    ['copper_ore', 8],
    ['bloom_essence', 5],
    ['lively_bloom_tonic', 2],
  ]) {
    try {
      sim.addItem(id, n, sim.playerId);
    } catch {}
  }
});

await tap('.tut-skip');
await wait(300);

// Open the character sheet.
if (MOBILE) {
  await page
    .waitForSelector('#mobile-preflight-continue', { visible: true, timeout: 5000 })
    .catch(() => {});
  await tap('#mobile-preflight-continue');
  await wait(300);
  await tap('#mobile-more');
  await wait(400);
  await tap('#mobile-char');
} else {
  await tap('#mm-char');
}
await wait(700);

// Switch to the Overview tab.
await page.evaluate(() => {
  const btn = document.querySelector('#char-window [data-tab="overview"]');
  if (btn) btn.click();
});
await wait(500);

const SUF = MOBILE ? '_mobile' : '';
await page.screenshot({ path: `tmp/overview_char${SUF}.png` });

// Tight crop of just the overview dashboard.
const box = await page.evaluate(() => {
  const el = document.querySelector('#char-window .char-overview');
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
await wait(200);
if (box && box.width > 0 && box.height > 0) {
  await page.screenshot({
    path: `tmp/overview_panel${SUF}.png`,
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: box.width,
      height: Math.min(box.height, 900),
    },
  });
  console.log('overview dashboard found + cropped');
} else {
  console.log('WARNING: .char-overview not found (tab may not have switched)');
}

if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
console.log(`wrote tmp/overview_char${SUF}.png`);
await browser.close();
