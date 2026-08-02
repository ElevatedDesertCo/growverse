// Visual capture of the authored ability VFX. Unlike ability_vfx_probe.mjs (which
// counts primitives), this drives the REAL frame loop and screenshots mid-effect, so
// the HDR/bloom tuning can actually be looked at: the specs were authored against
// upstream's post chain, and this fork's bloom strength differs.
//
// Needs `npm run dev` on :5173. Writes tmp/vfx_<ability>.png.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('tmp', { recursive: true });

// One per archetype family, so a bad tier shows up somewhere in the set.
const SHOTS = [
  { id: 'pyroblast', school: 'fire', fx: 'projectile', wait: 260 },
  { id: 'frost_nova', school: 'frost', fx: 'nova', wait: 200 },
  { id: 'arcane_explosion', school: 'arcane', fx: 'nova', wait: 200 },
  { id: 'battle_shout', school: 'physical', fx: 'nova', wait: 240 },
  { id: 'commanding_shout', school: 'physical', fx: 'nova', wait: 240 },
  { id: 'rend', school: 'physical', fx: 'tick', wait: 200 },
];

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
await page.type('#char-name', 'Caster');
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="mage"]').click(),
);
await page.evaluate(() => document.querySelector('#btn-start-offline').click());
await page.waitForFunction(() => !!window.__game?.renderer, { timeout: 60000 });
await sleep(2500);

// Clear the tutorial toast and pull the camera back so the effect is not behind the
// character's head.
await page.evaluate(() => {
  document.querySelector('.tut-skip')?.click();
  const g = window.__game;
  g.sim.setPlayerLevel(20);
});
await sleep(600);

for (const s of SHOTS) {
  await page.evaluate((spec) => {
    const g = window.__game;
    const self = g.sim.player.id;
    g.renderer.handleEvent({
      type: 'spellfx',
      sourceId: self,
      targetId: self,
      school: spec.school,
      fx: spec.fx,
      ability: spec.id,
    });
  }, s);
  await sleep(s.wait);
  await page.screenshot({ path: `tmp/vfx_${s.id}.png` });
  console.log(`wrote tmp/vfx_${s.id}.png`);
  await sleep(900); // let the effect finish before the next one
}

await browser.close();
