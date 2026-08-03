// Strain economy E2E: drives the whole cultivation chain in a REAL client, which the
// unit tests only cover in pieces. Plants a strain, harvests it, checks the bud GRADE
// matches the strain's potency, presses the buds into a processed Session, and checks
// Marlow offers his supply ladder. Needs `npm run dev` on :5173.
//
// Usage: node scripts/strain_economy_e2e.mjs [--shot]
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const WANT_SHOT = process.argv.includes('--shot');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('tmp', { recursive: true });

let fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else {
    fail += 1;
    console.log(`  FAIL ${name}${extra ? ` -> ${extra}` : ''}`);
  }
};

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
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => document.querySelector('#btn-offline').click());
await sleep(300);
await page.type('#char-name', 'Grower');
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="mage"]').click(),
);
await page.evaluate(() => document.querySelector('#btn-start-offline').click());
await page.waitForFunction(() => !!window.__game?.renderer, { timeout: 60000 });
await sleep(2500);

const r = await page.evaluate(async () => {
  const sim = window.__game.sim;
  const out = {};
  sim.setPlayerLevel(12);

  const { BASE_STRAINS } = await import('/src/sim/data');
  const { baseStrain } = await import('/src/sim/genetics.ts');

  // sim.strains is a read-only StrainView projection; the mutable library lives on the
  // PlayerMeta, so write there or the plant call sees an empty library.
  const meta = sim.players.get(sim.primaryId);
  const prime = baseStrain(BASE_STRAINS.common_bloom, 'probe_prime');
  prime.genotype = { potency: [3, 3], vigor: [1, 1], yield: [1, 1] };
  prime.name = 'Probe Prime';
  meta.strains.length = 0;
  meta.strains.push(prime);
  out.libraryOk = meta.strains.length === 1;

  // Capture what the sim says when a step is refused, so a failure names its reason.
  out.errors = [];
  const drain = () => {
    for (const ev of sim.tick()) {
      if (ev.type === 'error' || ev.type === 'log') out.errors.push(`${ev.type}: ${ev.text}`);
    }
  };

  // Plant it, force it ready, harvest.
  sim.addItem('common_seed', 1);
  sim.plantStrain(0, prime.id);
  drain();
  const plot = sim.plots[0];
  out.planted = plot.seedItemId;
  out.plotStrain = plot.strainId;
  plot.plantedAt = -100000;
  sim.harvestPlot(0);
  drain();

  out.budPrime = sim.countItem('bud_prime');
  out.budCommon = sim.countItem('bud_common');
  out.bloomExtract = sim.countItem('bloom_extract');

  // Press prime buds into the processed Session. Crafting is station-gated, so stand
  // at the Alchemist first (the refusal is correct behavior, not a bug).
  const { NPCS: N } = await import('/src/sim/data');
  const lab = N.alchemist_sable.pos;
  sim.player.pos.x = lab.x;
  sim.player.pos.z = lab.z;
  meta.copper = 10000; // the recipe carries a copper cost; a fresh character has none
  sim.addItem('bud_prime', 8);
  sim.addItem('bloom_essence', 4);
  const before = sim.countItem('pressed_resin_prime');
  sim.craft('alchemy_pressed_resin_prime');
  drain();
  out.pressedPrime = sim.countItem('pressed_resin_prime') - before;

  // Marlow's ladder should be live content the quest tables know about.
  const { QUESTS, NPCS } = await import('/src/sim/data');
  out.marlowQuests = NPCS.cultivator_marlow?.questIds ?? [];
  out.firstHarvestObj = QUESTS.q_first_harvest?.objectives?.[0]?.itemId;
  out.primeOrderObj = QUESTS.q_prime_order?.objectives?.[0]?.itemId;
  return out;
});

console.log('cultivation chain:');
check('strain library seeded', r.libraryOk);
check('plot planted from the strain', r.planted === 'common_seed', String(r.planted));
check('potency 3 harvests PRIME buds', r.budPrime > 0, `bud_prime=${r.budPrime}`);
check('no common buds from a prime strain', r.budCommon === 0, `bud_common=${r.budCommon}`);
check(
  'growing never yields the foraged extract',
  r.bloomExtract === 0,
  `bloom_extract=${r.bloomExtract}`,
);
console.log('processing:');
check('prime buds press into a prime Session', r.pressedPrime > 0, `made=${r.pressedPrime}`);
console.log('quest demand:');
check(
  'Marlow offers the three-quest ladder',
  r.marlowQuests.length === 3,
  r.marlowQuests.join(','),
);
check('first quest collects common buds', r.firstHarvestObj === 'bud_common', r.firstHarvestObj);
check('last quest collects prime buds', r.primeOrderObj === 'bud_prime', r.primeOrderObj);

if (r.errors?.length) {
  console.log('sim messages:');
  for (const e of r.errors.slice(0, 8)) console.log(`  ${e}`);
}
if (pageErrors.length) {
  console.log(`page errors (${pageErrors.length}):`);
  for (const e of pageErrors.slice(0, 5)) console.log(`  ${e}`);
}
if (WANT_SHOT) {
  await page.screenshot({ path: 'tmp/strain_economy.png' });
  console.log('wrote tmp/strain_economy.png');
}
await browser.close();
console.log(fail === 0 ? 'ECONOMY E2E OK' : `ECONOMY E2E FAILED (${fail})`);
process.exit(fail > 0 ? 1 : 0);
