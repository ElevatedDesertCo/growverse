// Screenshot of the Grow Station crafting window showing the profession-gated
// Trellis Frame recipe (Logging). Offline flow, opens the craft window on Marlow.
// Needs `npm run dev`. Writes tmp/craft_profession*.png.

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

import { BROWSER_PATH as EDGE } from './browser_path.mjs';
import { enterOfflineGame } from './enter_offline_game.mjs';

const URL = (process.env.GAME_URL ?? 'http://localhost:5173') + '/?gfx=low';
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
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push('CONSOLE: ' + m.text()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
await enterOfflineGame(page, { charClass: 'warrior', charName: 'Growmancer' });
const booted = await page
  .waitForFunction(() => window.__game?.sim?.player, { timeout: 60000, polling: 500 })
  .then(() => true)
  .catch(() => false);
if (!booted) {
  console.log('BOOT FAILED: ' + (errors.join('\n') || '(none)'));
  await browser.close();
  process.exit(1);
}
await wait(1000);
await page.evaluate(() => document.querySelector('.tut-skip')?.click());
await wait(300);

const opened = await page.evaluate(() => {
  const g = window.__game;
  const sim = g.sim;
  // Low Logging so the Trellis Frame gate (10) shows as unmet; some timber in bags.
  const meta = sim.primary;
  if (meta?.professions) meta.professions.logging = 5;
  try {
    sim.addItem('rough_timber', 8, sim.playerId);
    sim.addItem('bloom_essence', 4, sim.playerId);
  } catch {}
  // Find Marlow (the Grow Station attendant), stand next to him (the per-frame
  // proximity check closes the window otherwise), then open the craft window.
  const marlow = [...sim.entities.values()].find((e) => e.templateId === 'cultivator_marlow');
  if (!marlow) return false;
  const p = sim.player;
  p.pos.x = marlow.pos.x + 2;
  p.pos.z = marlow.pos.z;
  p.pos.y = marlow.pos.y;
  p.prevPos = { ...p.pos };
  sim.rebucket(p);
  g.hud.openCrafting(marlow.id);
  return true;
});
await wait(600);
if (!opened) {
  console.log('Could not find Marlow / open crafting');
  await browser.close();
  process.exit(1);
}

// Scroll the Trellis Frame recipe (profession-gated) into view.
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#craft-window .craft-recipe')];
  const trellis = rows.find((r) => /Trellis/i.test(r.textContent ?? ''));
  trellis?.scrollIntoView({ block: 'center' });
});
await wait(250);
await page.screenshot({ path: 'tmp/craft_profession.png' });
// Crop to the craft window.
const box = await page.evaluate(() => {
  const el = document.querySelector('#craft-window');
  if (!el || el.style.display === 'none') return null;
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
if (box && box.width > 0) {
  await page.screenshot({
    path: 'tmp/craft_profession_crop.png',
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: box.width,
      height: Math.min(box.height, 860),
    },
  });
  console.log('craft window cropped');
}
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
console.log('wrote tmp/craft_profession.png');
await browser.close();
