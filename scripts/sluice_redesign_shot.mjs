// Visual check for the redesigned Sluice: (1) the outpost on the pond's north shore,
// (2) the river running west, (3) the mountain waterfall at the river's west end.
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
for (let i = 0; i < 30; i++) {
  const ready = await page.evaluate(() => !!(window.__game && window.__game.sim));
  if (ready) break;
  await new Promise((r) => setTimeout(r, 500));
}
const ok = await page.evaluate(() => !!(window.__game && window.__game.sim));
if (!ok) {
  console.log('GAME NOT READY');
  await browser.close();
  process.exit(1);
}

async function shot(name, x, z, lookX, lookZ, y = null) {
  await page.evaluate(
    (px, pz, lx, lz, py) => {
      const p = window.__game.sim.player;
      p.pos.x = px;
      p.pos.z = pz;
      if (py != null) p.pos.y = py;
      p.facing = Math.atan2(lx - px, lz - pz);
    },
    x,
    z,
    lookX,
    lookZ,
    y,
  );
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: `tmp/sluice-${name}.png` });
  console.log(`wrote tmp/sluice-${name}.png (stand ${x},${z} look ${lookX},${lookZ})`);
}

// 1. From the pond's south (townward) shore, look north across the water at the
//    outpost + mascot on the far shore (dam is on this near side).
await shot('outpost', 30, 6, 34, 55);
// 2. From the pond, look west up the river toward the mountain + waterfall.
await shot('river', 48, 24, 120, 24);
// 3. Close on the waterfall / mountain from partway up the river.
await shot('waterfall', 120, 24, 160, 24);
// 4. Elevated look at the whole valley from the east.
await shot('valley', 20, 24, 150, 24, 40);

await browser.close();
console.log('done');
