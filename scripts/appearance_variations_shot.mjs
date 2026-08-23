// Proof that the customizer actually drives the composed body: drive real
// clicks through the form, capture the turntable after each, and assert the
// rendered pixels genuinely CHANGED between variations.
//
// A screenshot of a character proves nothing on its own (the fixed class rig
// looks like a character too). What proves the feature works is the same
// preview rendering differently after each edit, so every capture here is
// hashed and compared, and the run fails if a variation left the body
// identical. Needs `npm run dev`; pass the port as argv[2].

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

const browser = await puppeteer.launch({
  executablePath: EXEC,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader'],
});

const page = await browser.newPage();
const modularFetches = [];
page.on('response', (r) => {
  if (r.url().includes('warrior_modular.glb')) modularFetches.push(r.status());
});

await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
page.setDefaultNavigationTimeout(120000);
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await wait(3000);

await page.waitForSelector('#btn-offline', { timeout: 30000 });
await page.evaluate(() => document.querySelector('#btn-offline')?.click());
await page.waitForSelector('#offline-select', { visible: true, timeout: 30000 });
await wait(800);
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="warrior"]')?.click(),
);
await wait(2500);

const HOST = '#offline-appearance';
const PREVIEW = '#offline-preview-container';

/** Click the nth control matching a selector inside the customizer. */
const clickIn = (sel, idx = 0) =>
  page.evaluate(
    (host, s, i) => {
      const els = [...document.querySelector(host).querySelectorAll(s)];
      const el = els[i];
      if (!el) return null;
      el.click();
      return (el.textContent ?? el.getAttribute('aria-label') ?? '').trim() || `#${i}`;
    },
    HOST,
    sel,
    idx,
  );

/** Open a tab by its visible label. */
const openTab = (label) =>
  page.evaluate(
    (host, want) => {
      const tabs = [...document.querySelector(host).querySelectorAll('[role="tab"], .ac-tab')];
      const t = tabs.find((x) => (x.textContent ?? '').trim().toLowerCase().startsWith(want));
      if (t) t.click();
      return !!t;
    },
    HOST,
    label,
  );

const shots = [];
async function capture(name, note) {
  await wait(1200); // let the compose + a few frames land
  const path = `${OUT}/variation-${name}.png`;
  const el = await page.$(PREVIEW);
  await el.screenshot({ path });
  const digest = sha(path);
  shots.push({ name, note, path, digest });
  console.log(`  captured ${name.padEnd(12)} ${digest}  (${note})`);
}

console.log('capturing variations:');
await openTab('body');
await capture('01-default', 'stored look on mount');

const gender = await clickIn('.ac-seg-btn:not(.sel)', 0);
await capture('02-gender', `body toggle -> ${gender}`);

// Skin tone: the swatch strip on the Body tab.
const tone = await clickIn('.ac-sw, .ac-swatch', 6);
await capture('03-skin-tone', `skin swatch -> ${tone}`);

await openTab('hair');
const hair1 = await clickIn('.ac-step-btn', 1); // step the hair style forward
await capture('04-hair', `hair stepped ${hair1}`);
const hair2 = await clickIn('.ac-step-btn', 1);
await capture('05-hair-again', `hair stepped ${hair2}`);

await openTab('face');
const brow = await clickIn('.ac-step-btn', 3);
await capture('06-face', `face control ${brow}`);

console.log(`\nmodular part library fetches: ${JSON.stringify(modularFetches)}`);
if (!modularFetches.includes(200)) {
  console.error('FAIL: the part library never loaded, so nothing composed');
  await browser.close();
  process.exit(1);
}

// The whole point: consecutive variations must not be pixel-identical.
const unique = new Set(shots.map((s) => s.digest));
console.log(`\ndistinct rendered bodies: ${unique.size} of ${shots.length} captures`);
let identical = 0;
for (let i = 1; i < shots.length; i++) {
  if (shots[i].digest === shots[i - 1].digest) {
    console.error(`  UNCHANGED: ${shots[i].name} renders identically to ${shots[i - 1].name}`);
    identical++;
  }
}
const stored = await page.evaluate(() => localStorage.getItem('woc.modularAppearance'));
console.log(`\npersisted look: ${stored ? `${stored.slice(0, 160)}...` : '(none)'}`);

await browser.close();
if (identical > 0) {
  console.error(`\nFAIL: ${identical} variation(s) did not change the body`);
  process.exit(1);
}
console.log(`\nOK: every edit changed the rendered body. Screenshots in ${OUT}/`);
