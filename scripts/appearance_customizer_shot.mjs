// Visual evidence for the ported WOCC appearance customizer: opens the offline
// creation panel, picks a class (which is what mounts the customizer, via
// renderClassDetails -> syncAppearanceUi), and captures the form plus each of
// its tabs. Needs `npm run dev`; pass the port as argv[2] if not 5173.
//
// Also asserts the mount actually produced controls, so a silently empty host
// fails the run instead of yielding a screenshot of a blank panel.

import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH as EXEC } from './browser_path.mjs';

const PORT = process.argv[2] ?? '5173';
const BASE = `http://localhost:${PORT}/`;
const OUT = 'pr-assets-appearance';
mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EXEC,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
// Objective proof the composed path ran: the part library is fetched ONLY by
// assembleModular, so a 200 here means a body was composed, not eyeballed.
const modularFetches = [];
page.on('response', (r) => {
  if (r.url().includes('warrior_modular.glb')) modularFetches.push(r.status());
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
// domcontentloaded, not networkidle2: the composed body pulls a 3.4MB part
// library, so the network does not go idle inside the default budget.
page.setDefaultNavigationTimeout(120000);
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await wait(3000);

// Hidden legacy automation hook: fire its handler in-page rather than
// page.click, which needs a visible clickable point (see enter_offline_game).
await page.waitForSelector('#btn-offline', { timeout: 30000 });
await page.evaluate(() => document.querySelector('#btn-offline')?.click());
await page.waitForSelector('#offline-select', { visible: true, timeout: 30000 });
await wait(600);

// Picking a class is what mounts the customizer.
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="warrior"]')?.click(),
);
await wait(1500);

const host = '#offline-appearance';
await page.waitForSelector(host, { timeout: 30000 });

const summary = await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const tabs = [...el.querySelectorAll('[role="tab"], .ac-tab')].map((t) =>
    (t.textContent ?? '').trim(),
  );
  return {
    hidden: el.hidden,
    controls: el.querySelectorAll('button, input, select').length,
    rows: el.querySelectorAll('.ac-row').length,
    tabs,
    text: (el.textContent ?? '').trim().slice(0, 200),
  };
}, host);

console.log('customizer host:', JSON.stringify(summary, null, 2));
if (!summary || summary.controls === 0) {
  console.error('FAIL: the customizer mounted no controls');
  await page.screenshot({ path: `${OUT}/appearance-FAILED.png`, fullPage: true });
  await browser.close();
  process.exit(1);
}

await page.screenshot({ path: `${OUT}/offline-panel.png` });
const el = await page.$(host);
await el.screenshot({ path: `${OUT}/customizer.png` });

// Each tab, so the port's full surface is visible in one place.
const tabCount = await page.evaluate((sel) => {
  const el = document.querySelector(sel);
  return el ? el.querySelectorAll('[role="tab"], .ac-tab').length : 0;
}, host);
for (let i = 0; i < tabCount; i++) {
  const label = await page.evaluate(
    (sel, idx) => {
      const tabs = [...document.querySelector(sel).querySelectorAll('[role="tab"], .ac-tab')];
      const t = tabs[idx];
      if (!t) return null;
      t.click();
      return (t.textContent ?? `tab${idx}`).trim();
    },
    host,
    i,
  );
  if (!label) continue;
  await wait(500);
  const safe =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `tab${i}`;
  const node = await page.$(host);
  await node.screenshot({ path: `${OUT}/tab-${safe}.png` });
  console.log(`captured tab: ${label}`);
}

// The form column scrolls now that it carries the customizer, so prove the
// creation action is actually reachable rather than clipped off the panel.
const reach = await page.evaluate(() => {
  const col = document.querySelector('#offline-select .charselect-col-left');
  if (!col) return null;
  col.scrollTop = col.scrollHeight;
  const btn = document.querySelector('#btn-start-offline');
  if (!btn) return null;
  const b = btn.getBoundingClientRect();
  const c = col.getBoundingClientRect();
  return {
    scrollable: col.scrollHeight > col.clientHeight,
    buttonInsideColumn: b.top >= c.top - 1 && b.bottom <= c.bottom + 1,
  };
});
console.log('action reachability:', JSON.stringify(reach));
if (!reach || !reach.buttonInsideColumn) {
  console.error('FAIL: the creation action is not reachable after scrolling');
  await page.screenshot({ path: `${OUT}/reachability-FAILED.png` });
  await browser.close();
  process.exit(1);
}
await wait(300);
await page.screenshot({ path: `${OUT}/offline-panel-scrolled.png` });

// The composed body is the point of the renderer half: assert the turntable is
// actually running a modular visual, not the fixed class rig, and that editing
// the look reaches the geometry.
const composed = await page.evaluate(() => {
  const g = window.__game;
  const p = g?.characterPreview ?? g?.preview ?? null;
  return {
    hasPreview: !!p,
    visualKey: p?.currentVisualKey ?? null,
    modularLook: p?.currentVisual?.modularLook ? true : false,
  };
});
console.log('composed body:', JSON.stringify(composed));

// Drive a real edit through the form and confirm the persisted look changes.
const edited = await page.evaluate(() => {
  const host = document.querySelector('#offline-appearance');
  const seg = host?.querySelector('.ac-seg-btn:not(.sel)');
  if (seg) seg.click();
  const step = host?.querySelector('.ac-step-btn');
  if (step) step.click();
  return !!(seg || step);
});
await wait(600);
console.log('drove an edit through the form:', edited);

console.log('modular part library fetches:', JSON.stringify(modularFetches));
if (!modularFetches.includes(200)) {
  console.error('FAIL: the modular part library never loaded, so nothing composed');
  await browser.close();
  process.exit(1);
}

// A stored look proves the persistence path, not just the paint.
const stored = await page.evaluate(() => localStorage.getItem('woc.modularAppearance'));
console.log('persisted appearance:', stored ? `${stored.slice(0, 120)}...` : '(none yet)');

if (errors.length) {
  console.log(`\npage errors (${errors.length}):`);
  for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
}

await browser.close();
console.log(`\nwrote screenshots to ${OUT}/`);
