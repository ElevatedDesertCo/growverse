// Visual check for the cross ceremony. Drives a real cross at the Breeding Chamber
// and shoots the fusion mid-effect, then again for a landrace so the two can be
// compared: an ordinary cross should read leaf-green and modest, a landrace gold and
// bigger. Nothing but eyes can check that. Needs `npm run dev` on :5173.
//
// Usage: node scripts/strain_fusion_shot.mjs
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
    '--proxy-bypass-list=<-loopback>',
    ...(process.getuid?.() === 0 ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
  ],
  defaultViewport: { width: 1600, height: 900 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#btn-offline', { timeout: 60000 });
await page.evaluate(() => document.querySelector('#btn-offline').click());
await sleep(400);
await page.type('#char-name', 'Crosser');
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="mage"]').click(),
);
await page.evaluate(() => document.querySelector('#btn-start-offline').click());
await page.waitForFunction(() => !!window.__game?.renderer, { timeout: 60000 });
await sleep(2500);

// Stand at the chamber with two strains in the library and the bud cost in hand.
const setup = await page.evaluate(async () => {
  const sim = window.__game.sim;
  document.querySelector('.tut-skip')?.click();
  const { BASE_STRAINS, NPCS } = await import('/src/sim/data');
  const { baseStrain } = await import('/src/sim/genetics.ts');
  const { terrainHeight } = await import('/src/sim/world');
  const meta = sim.players.get(sim.primaryId);

  const a = baseStrain(BASE_STRAINS.common_bloom, 'shot_a');
  a.name = 'Fen Haze';
  const b = baseStrain(BASE_STRAINS.enriched_bloom, 'shot_b');
  b.name = 'Copper Diesel';
  meta.strains.length = 0;
  meta.strains.push(a, b);

  const m = NPCS.cultivator_marlow.pos;
  sim.player.pos.x = m.x;
  sim.player.pos.z = m.z + 2;
  sim.player.pos.y = terrainHeight(sim.player.pos.x, sim.player.pos.z, sim.cfg.seed);
  sim.addItem('bud_common', 40);
  return { at: [sim.player.pos.x, sim.player.pos.z] };
});
console.log(`standing at the chamber: (${setup.at[0]}, ${setup.at[1]})`);
await sleep(900);

// Fire the ceremony straight at the renderer for each variant so both are captured
// mid-effect at the same phase.
for (const [label, landrace] of [
  ['ordinary', false],
  ['landrace', true],
]) {
  await page.evaluate((isLandrace) => {
    const g = window.__game;
    g.renderer.handleEvent({
      type: 'strainFused',
      entityId: g.sim.player.id,
      childName: isLandrace ? 'True Fen Diesel' : 'Fen Diesel',
      landrace: isLandrace,
    });
  }, landrace);
  await sleep(230);
  await page.screenshot({ path: `tmp/fusion_${label}.png` });
  console.log(`wrote tmp/fusion_${label}.png`);
  await sleep(1400);
}

// And once for real, through the sim, to prove the whole path fires end to end.
const real = await page.evaluate(() => {
  const sim = window.__game.sim;
  sim.breedStrains('shot_a', 'shot_b');
  const evs = sim.tick();
  const fused = evs.find((e) => e.type === 'strainFused');
  const logs = evs.filter((e) => e.type === 'log').map((e) => e.text);
  return { fused: fused ? { name: fused.childName, landrace: fused.landrace } : null, logs };
});
console.log(`real cross emitted: ${JSON.stringify(real.fused)}`);
for (const l of real.logs) console.log(`  ${l}`);
await sleep(200);
await page.screenshot({ path: 'tmp/fusion_real.png' });
console.log('wrote tmp/fusion_real.png');

await browser.close();
