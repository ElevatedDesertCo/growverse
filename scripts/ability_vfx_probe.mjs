// Ability VFX probe: proves the authored per-ability VFX arm is actually wired and
// firing in a REAL client, which no Vitest can show. Boots the offline game, then for
// every ability that carries a spec it synthesizes the spellfx event the sim would
// emit and asserts two things:
//
//   1. the painter CLAIMS the event (handleSpellfx returns true), so the generic
//      school-colored fallback is not silently running instead, and
//   2. the claim SPAWNED primitives (the per-ability stat counter moved), so a claim
//      that draws nothing is caught too.
//
// Ported from upstream (levy-street/world-of-claudecraft) and reduced: upstream reads
// a dedicated window.__game.abilityVfxStats hook, while this reaches the painter
// through the renderer already on window.__game. Needs `npm run dev` on :5173.
//
// Usage: node scripts/ability_vfx_probe.mjs [--shot]
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const WANT_SHOT = process.argv.includes('--shot');
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
    // CI/container runs are root; puppeteer refuses the zygote sandbox there.
    ...(process.getuid?.() === 0 ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
  ],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(`console: ${m.text()}`);
});

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => document.querySelector('#btn-offline').click());
await sleep(300);
await page.type('#char-name', 'Probe');
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="mage"]').click(),
);
await page.evaluate(() => document.querySelector('#btn-start-offline').click());
await page.waitForFunction(() => !!window.__game?.renderer, { timeout: 60000 });
await sleep(2500);

const result = await page.evaluate(async () => {
  const g = window.__game;
  const renderer = g.renderer;
  const sim = g.sim;
  const painter = renderer.abilityVfx;
  if (!painter) return { fatal: 'renderer.abilityVfx is undefined (the arm is not wired)' };

  const specs = (await import('/src/render/ability_vfx_specs.ts')).ABILITY_VFX_SPECS;
  const { ABILITIES } = await import('/src/sim/data');
  const self = sim.player.id;

  const unclaimed = [];
  const silent = [];
  let claimed = 0;

  for (const id of Object.keys(specs)) {
    const def = ABILITIES[id];
    if (!def) continue; // pet-command specs (feed_pet / abandon_pet) have no ability
    // Self as both source and target: those anchors always resolve, so a miss here is
    // the painter declining, never a missing entity view.
    const ev = {
      type: 'spellfx',
      sourceId: self,
      targetId: self,
      school: def.school ?? 'arcane',
      fx: 'nova',
      ability: id,
    };
    const was = painter.statsSnapshot()[id];
    const took = painter.handleSpellfx(ev);
    if (!took) {
      unclaimed.push(id);
      continue;
    }
    claimed += 1;
    // Drive frames BEFORE measuring: several archetypes (buffs, strikes, shouts) spawn
    // through the archetype sequencer on update(), not synchronously at claim time, so
    // an immediate snapshot reads them as dry when they are merely staged.
    for (let i = 0; i < 40; i++) painter.update(1 / 20);
    const now = painter.statsSnapshot()[id];
    if (!now || now.primitives <= (was?.primitives ?? 0)) silent.push(id);
  }

  const stats = painter.statsSnapshot();
  const totalPrimitives = Object.values(stats).reduce((n, s) => n + s.primitives, 0);
  return {
    specCount: Object.keys(specs).length,
    claimed,
    unclaimed,
    silent,
    totalPrimitives,
  };
});

if (result.fatal) {
  console.error(`FATAL: ${result.fatal}`);
  await browser.close();
  process.exit(1);
}

console.log(`specs:            ${result.specCount}`);
console.log(`claimed:          ${result.claimed}`);
console.log(`unclaimed:        ${result.unclaimed.length}`);
console.log(`claimed-but-dry:  ${result.silent.length}`);
console.log(`total primitives: ${result.totalPrimitives}`);
if (result.unclaimed.length) console.log(`  unclaimed: ${result.unclaimed.join(' ')}`);
if (result.silent.length) console.log(`  dry: ${result.silent.join(' ')}`);
if (pageErrors.length) {
  console.log(`page errors (${pageErrors.length}):`);
  for (const e of pageErrors.slice(0, 10)) console.log(`  ${e}`);
}

if (WANT_SHOT) {
  await page.screenshot({ path: 'tmp/ability_vfx_probe.png' });
  console.log('wrote tmp/ability_vfx_probe.png');
}

await browser.close();
const ok =
  result.unclaimed.length === 0 && result.silent.length === 0 && result.totalPrimitives > 0;
console.log(ok ? 'PROBE OK' : 'PROBE FAILED');
process.exit(ok ? 0 : 1);
