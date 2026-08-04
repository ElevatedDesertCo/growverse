// Rendered touch-target + window-focus check for the HUD's hand-rolled panels.
//
// Two contracts from src/ui/CLAUDE.md that only a real browser can settle, because both
// depend on COMPUTED layout and live focus rather than on source text:
//
//   TOUCH   every tappable control inside a window measures at least 40x40 CSS px on a
//           phone viewport, and every input is at least 16px font (the iOS auto-zoom
//           floor). Sibling of scripts/mobile_input_zoom_check.mjs, which covers the
//           input-font floor across the whole shell.
//   FOCUS   opening a window traps Tab inside it and closing it returns focus to the
//           opener. Tab is also the game's target-nearest key, so the trap must engage
//           only once focus is already inside the window.
//
// Portrait AND landscape: a landscape phone is not a desktop, and the repo's mobile rules
// gate on touch capability rather than width.
//
// Usage: npm run dev, then `node scripts/mobile_touch_target_check.mjs`.
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TAP_MIN = 40; // src/ui/CLAUDE.md preferred floor (WCAG 2.2 SC 2.5.8 minimum is 24)
const FONT_MIN = 16; // below this iOS Safari auto-zooms the page on focus

let fail = 0;
const check = (name, ok, extra = '') => {
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  ${extra}` : ''}`);
};

const VIEWPORTS = [
  ['portrait', 390, 844],
  ['landscape', 844, 390],
];
// The hand-rolled panels this check covers, by Hud opener and root element.
const WINDOWS = [
  ['garden', 'openGarden', '#garden-window'],
  ['breeding', 'openBreeding', '#breeding-window'],
  ['cup', 'openCup', '#cup-window'],
  ['character', 'toggleChar', '#char-window'],
];

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
});

for (const [vpName, w, h] of VIEWPORTS) {
  const page = await browser.newPage();
  await page.setViewport({
    width: w,
    height: h,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#btn-offline', { timeout: 60000 });
  await page.evaluate(() => document.querySelector('#btn-offline').click());
  await sleep(500);
  await page.type('#char-name', 'Grower');
  await page.evaluate(() =>
    document.querySelector('#offline-select .mini-class[data-class="mage"]').click(),
  );
  await page.evaluate(() => document.querySelector('#btn-start-offline').click());
  // On a touch viewport the shell interposes a "Play in Landscape Fullscreen" preflight
  // before the game boots; without dismissing it the renderer never appears.
  await page.waitForSelector('#mobile-preflight-continue', { timeout: 30000 }).catch(() => {});
  await sleep(400);
  await page.evaluate(() => document.querySelector('#mobile-preflight-continue')?.click());
  await page.waitForFunction(() => !!window.__game?.renderer, { timeout: 60000 });
  await sleep(2500);
  await page.evaluate(() => document.querySelector('.tut-skip')?.click());

  // Seed so each window renders real rows rather than an empty state: an empty window has
  // no controls to measure and would pass the size check vacuously.
  await page.evaluate(async () => {
    const sim = window.__game.sim;
    const { BASE_STRAINS } = await import('/src/sim/data');
    const { baseStrain } = await import('/src/sim/genetics.ts');
    const meta = sim.players.get(sim.primaryId);
    meta.strains.length = 0;
    ['Fen Haze', 'Copper Diesel', 'Vale Kush'].forEach((n, i) => {
      const s = baseStrain(
        i % 2 ? BASE_STRAINS.enriched_bloom : BASE_STRAINS.common_bloom,
        `v${i}`,
      );
      s.name = n;
      s.mastery = [0, 40, 100][i];
      meta.strains.push(s);
    });
    for (const id of ['bud_common', 'bud_fine', 'bud_prime', 'epic_bud']) sim.addItem(id, 40);
    sim.addItem('common_seed', 6);
    sim.plantSeed(0, 'common_seed');
  });

  console.log(`\n=== ${vpName} ${w}x${h} ===`);
  for (const [name, method, sel] of WINDOWS) {
    const opened = await page.evaluate((a) => {
      const hud = window.__game.hud;
      // Opening a window does not close its siblings, so reset to a known state.
      for (let i = 0; i < 12 && hud.closeAll(); i++);
      if (typeof hud[a] !== 'function') return false;
      hud[a]();
      return true;
    }, method);
    check(`${name}: Hud.${method}() exists`, opened);
    if (!opened) continue;
    await sleep(700);

    const r = await page.evaluate(
      (a) => {
        const [s, tapMin, fontMin] = a;
        const el = document.querySelector(s);
        if (!el) return { missing: true };
        const de = document.documentElement;
        const small = [];
        for (const c of el.querySelectorAll('button, input, select, [role="button"], a[href]')) {
          const b = c.getBoundingClientRect();
          if (b.width === 0 && b.height === 0) continue; // not rendered
          if (b.width < tapMin || b.height < tapMin) {
            small.push(
              `${c.tagName.toLowerCase()}.${c.className || '?'} ${Math.round(b.width)}x${Math.round(b.height)}`,
            );
          }
        }
        const smallFont = [];
        for (const c of el.querySelectorAll('input, select, textarea')) {
          const fs = Number.parseFloat(getComputedStyle(c).fontSize);
          if (fs < fontMin) smallFont.push(`${c.tagName.toLowerCase()} ${fs}px`);
        }
        return {
          pageOverflowX: de.scrollWidth > de.clientWidth,
          offRight: Math.round(el.getBoundingClientRect().right - de.clientWidth),
          small: [...new Set(small)],
          smallFont: [...new Set(smallFont)],
        };
      },
      [sel, TAP_MIN, FONT_MIN],
    );
    check(`${name}: no horizontal page overflow`, !r.missing && !r.pageOverflowX);
    check(
      `${name}: fits the viewport width`,
      !r.missing && r.offRight <= 0,
      `right overhang ${r.offRight}px`,
    );
    check(
      `${name}: every control at least ${TAP_MIN}x${TAP_MIN}`,
      (r.small ?? []).length === 0,
      (r.small ?? []).join(' | '),
    );
    check(
      `${name}: every input at least ${FONT_MIN}px`,
      (r.smallFont ?? []).length === 0,
      (r.smallFont ?? []).join(' | '),
    );

    // Focus: the window must take focus into itself and hand it back on close. Drive a
    // real Tab from inside the window and assert focus stayed in; then close and assert
    // focus is no longer stranded on a hidden element.
    const focusResult = await page.evaluate(async (s) => {
      const el = document.querySelector(s);
      if (!el) return { missing: true };
      const focusables = [...el.querySelectorAll('button:not([disabled]), [href], input, select')];
      if (focusables.length === 0) return { noFocusables: true };
      focusables[0].focus();
      const startedInside = el.contains(document.activeElement);
      return { startedInside, count: focusables.length };
    }, sel);
    if (!focusResult.missing && !focusResult.noFocusables) {
      check(`${name}: focus can enter the window`, focusResult.startedInside === true);
      // Tab from the LAST focusable: native order would leave the window, the trap wraps.
      await page.evaluate((s) => {
        const el = document.querySelector(s);
        const f = [...el.querySelectorAll('button:not([disabled]), [href], input, select')];
        f[f.length - 1]?.focus();
      }, sel);
      await page.keyboard.press('Tab');
      await sleep(120);
      const stayedInside = await page.evaluate(
        (s) => document.querySelector(s)?.contains(document.activeElement) ?? false,
        sel,
      );
      check(`${name}: Tab wraps inside the window instead of escaping`, stayedInside);
      await page.evaluate(() => {
        for (let i = 0; i < 12 && window.__game.hud.closeAll(); i++);
      });
      await sleep(200);
      const strandedOnHidden = await page.evaluate((s) => {
        const el = document.querySelector(s);
        return !!el && el.contains(document.activeElement);
      }, sel);
      check(`${name}: closing releases focus from the hidden window`, !strandedOnHidden);
    }
  }
  await page.close();
}

await browser.close();
console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
process.exit(fail > 0 ? 1 : 0);
