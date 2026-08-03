// Visual check for the Breeding Chamber: stands the player at Marlow, the chamber's
// keeper, and shoots the building behind him plus the garden field in front. Verifies
// by eye what no test can: that the footprint sits FLUSH on the terrain rather than
// floating or sunk, and that it does not swallow Marlow or block the field path.
// Needs `npm run dev` on :5173.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('tmp', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: [
    '--window-size=1600,900',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    // Sandboxed runs export a proxy; localhost must bypass it or the dev server
    // is unreachable from inside the browser.
    '--proxy-bypass-list=<-loopback>',
    ...(process.getuid?.() === 0 ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
  ],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => document.querySelector('#btn-offline').click());
await sleep(300);
await page.type('#char-name', 'Breeder');
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="mage"]').click(),
);
await page.evaluate(() => document.querySelector('#btn-start-offline').click());
await page.waitForFunction(() => !!window.__game?.renderer, { timeout: 60000 });
await sleep(2500);

const info = await page.evaluate(async () => {
  const g = window.__game;
  const sim = g.sim;
  document.querySelector('.tut-skip')?.click();
  const { NPCS } = await import('/src/sim/data');
  const { terrainHeight } = await import('/src/sim/world');
  const m = NPCS.cultivator_marlow.pos;
  // Stand a little south-east of Marlow looking north, so the chamber is in frame
  // together with him and the first rows of beds.
  sim.player.pos.x = m.x + 9;
  sim.player.pos.z = m.z - 9;
  sim.player.pos.y = terrainHeight(sim.player.pos.x, sim.player.pos.z, sim.cfg.seed);
  sim.player.facing = Math.atan2(m.x - sim.player.pos.x, m.z - sim.player.pos.z);
  // Corner heights of the chamber footprint: a spread near zero means it rests flush.
  const c = { x: 60, z: 45, w: 7, d: 6 };
  const hs = [
    terrainHeight(c.x - c.w / 2, c.z - c.d / 2, sim.cfg.seed),
    terrainHeight(c.x + c.w / 2, c.z - c.d / 2, sim.cfg.seed),
    terrainHeight(c.x - c.w / 2, c.z + c.d / 2, sim.cfg.seed),
    terrainHeight(c.x + c.w / 2, c.z + c.d / 2, sim.cfg.seed),
  ];
  return { corners: hs, spread: Math.max(...hs) - Math.min(...hs), marlow: m };
});

console.log(`chamber corner heights: ${info.corners.map((h) => h.toFixed(2)).join(', ')}`);
console.log(`corner spread:          ${info.spread.toFixed(3)} yd`);
console.log(`Marlow at:              (${info.marlow.x}, ${info.marlow.z})`);

await sleep(1200);
await page.screenshot({ path: 'tmp/breeding_chamber.png' });
console.log('wrote tmp/breeding_chamber.png');
await browser.close();
