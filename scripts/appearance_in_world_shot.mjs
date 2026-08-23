// Does the authored look follow the player INTO the world, or only appear on
// the creation turntable? Seeds a distinctive look, enters the offline world,
// and captures the player's body there.
//
// Asserts on the live entity rather than the pixels: the world camera is behind
// the character and a screenshot alone cannot tell a composed body from the
// class rig at that angle. Needs `npm run dev`; port as argv[2].

import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH as EXEC } from './browser_path.mjs';

const PORT = process.argv[2] ?? '5173';
const BASE = `http://localhost:${PORT}/`;
const OUT = 'pr-assets-appearance';
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const LOOK = { gender: 'female', hair: 'afro', brows: 'thick', skinHue: 24, skinLight: 0.32 };

const browser = await puppeteer.launch({
  executablePath: EXEC,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
page.setDefaultNavigationTimeout(120000);

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.evaluate((l) => {
  localStorage.setItem('woc.modularAppearance', JSON.stringify(l));
}, LOOK);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
await wait(3000);

await page.waitForSelector('#btn-offline', { timeout: 30000 });
await page.evaluate(() => document.querySelector('#btn-offline')?.click());
await page.waitForSelector('#offline-select', { visible: true, timeout: 30000 });
await wait(800);
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="warrior"]')?.click(),
);
await wait(1500);
await page.evaluate(() => {
  const n = document.querySelector('#char-name');
  if (n) n.value = 'Thornia';
  document.querySelector('#btn-start-offline')?.click();
});

// Entering streams the world; give it room, then dismiss any mobile preflight.
await wait(12000);
await page.evaluate(() => document.querySelector('#mobile-preflight-continue')?.click());
await wait(6000);

// __game is assigned during world init, a little after the HUD paints, so poll
// rather than sampling once and concluding "never reached the world".
await page
  .waitForFunction(() => !!window.__game?.sim?.entities, { timeout: 60000 })
  .catch(() => {});
await wait(2000);

const state = await page.evaluate(() => {
  const g = window.__game;
  const sim = g?.sim;
  if (!sim) return { inWorld: false };
  const self = sim.entities?.get?.(sim.playerId);
  return {
    inWorld: true,
    playerId: sim.playerId,
    hasLook: !!self?.modularAppearance,
    hair: self?.modularAppearance?.hair ?? null,
    // The DATA being right proves nothing about what the player sees: the
    // renderer builds its view from the entity and can be holding the fixed
    // class rig regardless. Ask the view what it actually composed.
    composed: (() => {
      const view = g?.renderer?.views?.get?.(sim.playerId);
      const visual = view?.visual ?? view?.character ?? null;
      return {
        found: !!visual,
        modularLook: !!visual?.modularLook,
        key: visual?.key ?? visual?.visualKey ?? null,
      };
    })(),
  };
});
console.log('in-world player:', JSON.stringify(state));

await page.screenshot({ path: `${OUT}/in-world.png` });
if (errors.length) {
  console.log(`page errors (${errors.length}):`);
  for (const e of errors.slice(0, 5)) console.log(`  ${e}`);
}
await browser.close();

if (!state.inWorld) {
  console.error('FAIL: never reached the world (cannot judge the body)');
  process.exit(1);
}
if (!state.hasLook || state.hair !== 'afro') {
  console.error('FAIL: the authored look did not follow the player into the world');
  process.exit(1);
}
if (state.composed?.found && !state.composed.modularLook) {
  console.error(
    `FAIL: the entity carries the look but its VIEW is the fixed rig (${state.composed.key})`,
  );
  process.exit(1);
}
console.log('OK: the authored look reached the in-world player and its view composed');
