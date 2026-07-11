// Visual check for the Baked Beaver landmark near Bloomhaven: enter offline, walk to
// the beaver mascot at (24,30), screenshot the mascot + subzone banner, then confirm
// the minimap landmark marker fires.

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

import { BROWSER_PATH as EDGE } from './browser_path.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
fs.mkdirSync('tmp', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--window-size=1600,900', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => document.querySelector('#btn-offline')?.click());
await new Promise((r) => setTimeout(r, 1200));
await page.focus('#char-name');
await page.type('#char-name', 'Wanderer', { delay: 20 });
await new Promise((r) => setTimeout(r, 200));
await page.evaluate(() => {
  const el =
    document.querySelector('#offline-select [data-class="warrior"]') ||
    document.querySelector('#offline-select .mini-class');
  if (el) el.click();
});
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => document.querySelector('#btn-start-offline')?.click());
// poll up to 15s for the game world to come alive
for (let i = 0; i < 30; i++) {
  const ready = await page.evaluate(() => !!(window.__game && window.__game.sim));
  if (ready) break;
  await new Promise((r) => setTimeout(r, 500));
}
const ok = await page.evaluate(() => !!(window.__game && window.__game.sim));
if (!ok) {
  console.log(
    'GAME NOT READY; start button state:',
    await page.evaluate(() => ({
      startDisabled: document.querySelector('#btn-start-offline')?.disabled,
      name: document.querySelector('#char-name')?.value,
      selected: document.querySelector('#offline-select .mini-class.selected')?.dataset?.class,
    })),
  );
}

// Stand a few yards south of the beaver (24,30) and face it (+Z north).
await page.evaluate(() => {
  const g = window.__game;
  const p = g.sim.player;
  p.pos.x = 24;
  p.pos.z = 22;
  p.pos.y = g.sim.player.pos.y;
  // face toward +Z (the beaver is north of us): facing = atan2(dx, dz)
  p.facing = Math.atan2(24 - 24, 30 - 22);
});
await new Promise((r) => setTimeout(r, 800));

const info = await page.evaluate(() => {
  const banner = document.querySelector('#subzone-banner');
  return {
    banner: banner ? banner.textContent : '(no banner el)',
    px: window.__game.sim.player.pos.x,
    pz: window.__game.sim.player.pos.z,
  };
});
console.log('player at', info.px, info.pz, '| subzone banner =', JSON.stringify(info.banner));
await page.screenshot({ path: 'tmp/beaver-landmark.png' });

// Stand right on top so the minimap marker is well within the rim, screenshot minimap.
await page.evaluate(() => {
  const p = window.__game.sim.player;
  p.pos.x = 20;
  p.pos.z = 26;
});
await new Promise((r) => setTimeout(r, 600));
const mini = await page.$('#minimap');
if (mini) await mini.screenshot({ path: 'tmp/beaver-minimap.png' });
console.log('wrote tmp/beaver-landmark.png + tmp/beaver-minimap.png');

await browser.close();
console.log('done');
