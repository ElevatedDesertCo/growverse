// Showcase: compose several deliberately different characters and capture each,
// so the range the creator covers is visible in one place.
//
// Each look is seeded into storage BEFORE the app boots and applied on mount,
// which also pins the regression that sent this back once already: the panel
// mounts its customizer before the preview exists, so a look that only reaches
// the body on a later edit means the player is greeted by the stock class rig
// instead of their saved character. Every capture is hashed and the run fails
// if two looks render identically. Needs `npm run dev`; port as argv[2].

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH as EXEC } from './browser_path.mjs';

const PORT = process.argv[2] ?? '5173';
const BASE = `http://localhost:${PORT}/`;
const OUT = 'pr-assets-appearance';
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12);

const LOOKS = [
  {
    name: 'afro-warrior',
    cls: 'warrior',
    look: {
      gender: 'female',
      hair: 'afro',
      brows: 'thick',
      skinHue: 24,
      skinSat: 0.6,
      skinLight: 0.32,
    },
  },
  {
    name: 'braided-mage',
    cls: 'mage',
    look: {
      gender: 'female',
      hair: 'warriorbraid',
      brows: 'arched',
      skinHue: 28,
      skinSat: 0.4,
      skinLight: 0.7,
    },
  },
  {
    name: 'mohawk-rogue',
    cls: 'rogue',
    look: {
      gender: 'male',
      hair: 'mohawk',
      beard: 'goatee',
      brows: 'angled',
      skinHue: 20,
      skinSat: 0.5,
      skinLight: 0.5,
    },
  },
  {
    name: 'bearded-paladin',
    cls: 'paladin',
    look: {
      gender: 'male',
      hair: 'sweptback',
      beard: 'full',
      brows: 'bushy',
      skinHue: 26,
      skinSat: 0.45,
      skinLight: 0.62,
    },
  },
];

const browser = await puppeteer.launch({
  executablePath: EXEC,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader'],
});

const shots = [];
for (const { name, cls, look } of LOOKS) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  page.setDefaultNavigationTimeout(120000);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate((l) => {
    localStorage.setItem('woc.modularAppearance', JSON.stringify(l));
  }, look);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await wait(3000);

  await page.waitForSelector('#btn-offline', { timeout: 30000 });
  await page.evaluate(() => document.querySelector('#btn-offline')?.click());
  await page.waitForSelector('#offline-select', { visible: true, timeout: 30000 });
  await wait(800);
  await page.evaluate(
    (c) => document.querySelector(`#offline-select .mini-class[data-class="${c}"]`)?.click(),
    cls,
  );
  await wait(3000);

  const path = `${OUT}/showcase-${name}.png`;
  const el = await page.$('#offline-preview-container');
  await el.screenshot({ path });
  const digest = sha(path);
  shots.push({ name, digest });
  console.log(`  ${name.padEnd(18)} ${cls.padEnd(8)} ${digest}`);
  await page.close();
}

const unique = new Set(shots.map((s) => s.digest));
console.log(`\ndistinct composed characters: ${unique.size} of ${shots.length}`);
await browser.close();
if (unique.size !== shots.length) {
  console.error('FAIL: two seeded looks composed to the same body');
  process.exit(1);
}
console.log(`OK: every seeded look composed its own character. Screenshots in ${OUT}/`);
