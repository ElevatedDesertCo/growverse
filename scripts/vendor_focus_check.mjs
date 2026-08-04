// Does the Tab cycle actually span the vendor window AND its co-opened bag grid?
//
// The vendor and crafting windows are the only HUD windows that open a SECOND container as
// part of one interaction (#bags: you buy from one side and sell from the other), so their
// focus trap uses FocusTrapOptions.coRoots. tests/focus_manager.test.ts covers the co-root
// cycle against a fake DOM; this covers the real wiring, where the containers are actual
// elements and the trap is driven by a real keydown on the document.
//
// Usage: npm run dev, then `node scripts/vendor_focus_check.mjs`.
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (n, ok, extra = '') => {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${extra ? `  ${extra}` : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--proxy-bypass-list=<-loopback>',
    // CI runs as a normal user; a local root shell cannot start Chrome's sandbox.
    ...(process.getuid?.() === 0 ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
  ],
  defaultViewport: { width: 1400, height: 900 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto(process.env.GAME_URL ?? 'http://localhost:5173', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
await page.waitForSelector('#btn-offline', { timeout: 60000 });
await page.evaluate(() => document.querySelector('#btn-offline').click());
await sleep(500);
await page.type('#char-name', 'Grower');
await page.evaluate(() =>
  document.querySelector('#offline-select .mini-class[data-class="mage"]').click(),
);
await page.evaluate(() => document.querySelector('#btn-start-offline').click());
await page.waitForFunction(() => !!window.__game?.renderer, { timeout: 60000 });
await sleep(2500);
await page.evaluate(() => document.querySelector('.tut-skip')?.click());

// Open a real vendor: find the first NPC with a vendor table.
const opened = await page.evaluate(async () => {
  const { NPCS } = await import('/src/sim/data');
  const sim = window.__game.sim;
  for (const id of Object.keys(NPCS)) {
    if (!NPCS[id]?.vendorItems?.length) continue;
    const ent = [...sim.entities.values()].find((e) => e.templateId === id);
    if (!ent) continue;
    // Stand ON the vendor: the HUD closes the window when the player walks out of
    // interact range, so opening it from across the map closes itself a frame later.
    sim.player.pos.x = ent.pos.x + 1;
    sim.player.pos.z = ent.pos.z + 1;
    sim.player.pos.y = ent.pos.y;
    sim.player.prevPos = { ...sim.player.pos };
    sim.addItem('baked_bread', 5);
    window.__game.hud.openVendor(ent.id);
    return id;
  }
  return null;
});
check('a vendor NPC was found and opened', opened !== null, String(opened));
await sleep(800);

const state = await page.evaluate(() => {
  const v = document.querySelector('#vendor-window');
  const b = document.querySelector('#bags');
  const vis = (e) => !!e && getComputedStyle(e).display !== 'none';
  return { vendorVisible: vis(v), bagsVisible: vis(b) };
});
check(
  'vendor window and bag grid are both open',
  state.vendorVisible && state.bagsVisible,
  JSON.stringify(state),
);

// Walk the whole Tab cycle and record which container each stop belongs to.
const walk = await page.evaluate(async () => {
  const v = document.querySelector('#vendor-window');
  const b = document.querySelector('#bags');
  const first = v.querySelector('button:not([disabled]), input, select, [href]');
  if (!first) return { err: 'no focusable in vendor window' };
  first.focus();
  const seen = [];
  for (let i = 0; i < 40; i++) {
    const a = document.activeElement;
    seen.push(v.contains(a) ? 'vendor' : b.contains(a) ? 'bags' : 'OUTSIDE');
    // Drive the real trap: dispatch a Tab keydown the document listener sees.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  }
  return { seen };
});
if (walk.err) {
  check('tab walk ran', false, walk.err);
} else {
  const uniq = [...new Set(walk.seen)];
  check('the cycle never leaves the two containers', !uniq.includes('OUTSIDE'), uniq.join(','));
  check('the cycle reaches the bag grid', walk.seen.includes('bags'), `stops: ${uniq.join(',')}`);
  check('the cycle reaches the vendor window', walk.seen.includes('vendor'));
}

// Closing the vendor must release focus rather than leave it on a hidden control.
await page.evaluate(() => window.__game.hud.closeVendor());
await sleep(300);
const stranded = await page.evaluate(() => {
  const v = document.querySelector('#vendor-window');
  const b = document.querySelector('#bags');
  const a = document.activeElement;
  return (!!v && v.contains(a)) || (!!b && b.contains(a) && getComputedStyle(b).display === 'none');
});
check('closing releases focus from the hidden vendor', !stranded);

await browser.close();
console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail > 0 ? 1 : 0);
