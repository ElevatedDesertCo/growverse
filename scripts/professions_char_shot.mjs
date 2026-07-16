// Desktop screenshot of the character sheet's new Professions panel.
// Offline flow (no server), max graphics. Sets a few gathering skills so the
// bars render partly filled, opens the character window, and captures it.
// Needs `npm run dev`. Writes a PNG to tmp/.

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
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
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
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'pointer', value: 'coarse' }],
  });
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
  await page.screenshot({ path: 'tmp/professions_boot_fail.png' });
  console.log('BOOT FAILED. errors:\n' + (errors.join('\n') || '(none)'));
  await browser.close();
  process.exit(1);
}
await wait(1200);

// God-mode so nothing kills the camera, bump the level, and set a spread of
// gathering skills so each profession bar renders at a distinct fill.
await page.evaluate(() => {
  const sim = window.__game.sim;
  const p = sim.player;
  p.maxHp = 99999;
  p.hp = 99999;
  p.level = 12;
  const meta = sim.primary;
  if (meta?.professions) {
    meta.professions.mining = 34;
    meta.professions.herbalism = 67;
    meta.professions.logging = 8;
  }
  // Grant a spread of bag items so the embedded inventory grid renders full.
  for (const [id, n] of [
    ['rough_timber', 12],
    ['copper_ore', 8],
    ['bloom_essence', 5],
    ['common_seed', 3],
    ['roasted_boar', 2],
    ['bloom_juice', 4],
  ]) {
    try {
      sim.addItem(id, n, sim.playerId);
    } catch {}
  }
});

await tap('.tut-skip');
await wait(300);

// Open the character sheet: on mobile through the More tray, on desktop the
// minimap 'C' button (the shipped left-click-portrait also opens it).
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

const SUF = MOBILE ? '_mobile' : '';
await page.screenshot({ path: `tmp/professions_char${SUF}.png` });

// Also capture just the professions panel, tightly cropped, if present.
// Scroll it into view first (on a short mobile viewport it sits below the fold).
const box = await page.evaluate(() => {
  const el = document.querySelector('.char-professions');
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
await wait(200);
if (box && box.width > 0) {
  await page.screenshot({
    path: `tmp/professions_panel${SUF}.png`,
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
  });
  console.log('professions panel found + cropped');
} else {
  console.log('WARNING: .char-professions not found in the char window');
}

// Capture the embedded bags section (scrolled into view).
const bagsBox = await page.evaluate(() => {
  const el = document.querySelector('.char-bags-slot');
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
await wait(200);
if (bagsBox && bagsBox.width > 0 && bagsBox.height > 0) {
  await page.screenshot({
    path: `tmp/embedded_bags${SUF}.png`,
    clip: {
      x: Math.max(0, bagsBox.x),
      y: Math.max(0, bagsBox.y),
      width: bagsBox.width,
      height: Math.min(bagsBox.height, 700),
    },
  });
  console.log('embedded bags found + cropped');
}

if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
console.log(`wrote tmp/professions_char${SUF}.png`);
await browser.close();
