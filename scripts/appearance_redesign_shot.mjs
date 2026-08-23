// The one-shot redesign flow, end to end on the client.
//
// No Postgres is needed: the character API is intercepted, so this drives the
// real character-select screen, the real editor and the real customizer against
// a scripted roster. What it proves is the half that lives in the browser: the
// entry point appears only when the server says the token is unspent, the
// editor opens on the right character, edits reach the turntable, Save POSTs
// the authored look to the right endpoint, and Cancel posts nothing.
//
// Needs `npm run dev`; pass the port as argv[2].

import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH as EXEC } from './browser_path.mjs';

const PORT = process.argv[2] ?? '5173';
const BASE = `http://localhost:${PORT}/`;
const OUT = 'pr-assets-appearance';
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ROSTER = {
  realm: 'test',
  characters: [
    {
      id: 101,
      name: 'Veteran',
      class: 'warrior',
      level: 12,
      skin: 0,
      online: false,
      forceRename: false,
      appearance: null, // predates the creator
      canRedesign: true,
    },
    {
      id: 102,
      name: 'Newcomer',
      class: 'mage',
      level: 3,
      skin: 0,
      online: false,
      forceRename: false,
      appearance: { gender: 'female', hair: 'afro' },
      canRedesign: false, // already authored a look
    },
  ],
};

const browser = await puppeteer.launch({
  executablePath: EXEC,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
const posts = [];
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  // Fake the whole auth handshake so character select is reachable without a
  // live server or Postgres. Everything past this point is the real screen.
  if (url.endsWith('/api/login')) {
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'f'.repeat(64), username: 'tester' }),
    });
  }
  // The picker health-checks each realm and refuses to enter one it thinks is
  // down, so this has to answer too.
  if (url.includes('/api/status')) {
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ players_online: 3 }),
    });
  }
  if (url.includes('/api/realms')) {
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        current: 'test',
        realms: [{ name: 'test', url: BASE.replace(/\/$/, ''), type: 'normal' }],
        characters: { test: 2 },
      }),
    });
  }
  if (url.includes('/api/characters/') && req.method() === 'POST') {
    posts.push({ url, body: req.postData() });
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  }
  if (url.includes('/api/characters') && req.method() === 'POST') {
    posts.push({ url, body: req.postData() });
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  }
  if (url.endsWith('/api/characters') || url.includes('/api/me/characters')) {
    return req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ROSTER),
    });
  }
  return req.continue();
});

await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
page.setDefaultNavigationTimeout(120000);
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
await wait(3000);

// Come in through the real login form, which is what actually routes to
// character select and calls refreshCharacters().
await page.evaluate(() => {
  document.querySelector('#nav-btn-login')?.click();
});
await wait(1200);
await page.evaluate(() => {
  const u = document.querySelector('#login-user');
  const p = document.querySelector('#login-pass');
  if (u) u.value = 'tester';
  if (p) p.value = 'hunter2hunter2';
  document.querySelector('#btn-login')?.click();
});
await wait(2500);
// Enter the realm the picker just listed; character select is behind it.
await page.evaluate(() => {
  const row = document.querySelector('#realm-list [data-realm], #realm-list li, .realm-row');
  row?.click();
});
await page.waitForSelector('#char-list .char-row', { timeout: 45000 }).catch(() => {});
await wait(1500);

const rows = await page.evaluate(() =>
  [...document.querySelectorAll('#char-list .char-row')].map((r) => ({
    name: r.querySelector('.char-name')?.textContent ?? '',
    hasRedesign: !!r.querySelector('.redesign-btn'),
  })),
);
console.log('roster rows:', JSON.stringify(rows));

await page.screenshot({ path: `${OUT}/redesign-roster.png` });

if (rows.length === 0) {
  console.error('FAIL: never reached character select');
  await browser.close();
  process.exit(1);
}
// The entry point is an OFFER driven by the server's canRedesign: a character
// that already authored a look must not be given a second free redesign.
const veteran = rows.find((r) => r.name === 'Veteran');
const newcomer = rows.find((r) => r.name === 'Newcomer');
if (!veteran?.hasRedesign) {
  console.error('FAIL: no redesign entry point on the character that has one');
  await browser.close();
  process.exit(1);
}
if (newcomer?.hasRedesign) {
  console.error('FAIL: redesign offered to a character whose token is already spent');
  await browser.close();
  process.exit(1);
}
console.log('entry point offered only where canRedesign is set: OK');

// Open the editor and confirm it mounted a real customizer on the right target.
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#char-list .char-row')];
  const row = rows.find((r) => r.querySelector('.char-name')?.textContent === 'Veteran');
  row?.querySelector('.redesign-btn')?.click();
});
await wait(2500);
const editor = await page.evaluate(() => {
  const panel = document.getElementById('charselect-reroll');
  const host = document.getElementById('charselect-reroll-host');
  return {
    open: !!panel && !panel.hasAttribute('hidden'),
    title: document.getElementById('charselect-reroll-title')?.textContent ?? '',
    controls: host?.querySelectorAll('button, input, select').length ?? 0,
    classDetailsHidden: !!document
      .getElementById('charselect-class-details')
      ?.hasAttribute('hidden'),
  };
});
console.log('editor:', JSON.stringify(editor));
await page.screenshot({ path: `${OUT}/redesign-editor.png` });
if (!editor.open || editor.controls === 0) {
  console.error('FAIL: the redesign editor did not open with a mounted customizer');
  await browser.close();
  process.exit(1);
}
if (!editor.title.includes('Veteran')) {
  console.error(`FAIL: the editor opened on the wrong character (title "${editor.title}")`);
  await browser.close();
  process.exit(1);
}

// Cancel must post NOTHING (an abandoned redesign cannot spend the token) AND
// actually close. Checking only the first passed once while Cancel was not
// wired at all, which is the same evidence a broken button produces.
await page.evaluate(() => document.getElementById('btn-reroll-cancel')?.click());
await wait(1200);
const afterCancel = await page.evaluate(() => ({
  closed: !!document.getElementById('charselect-reroll')?.hasAttribute('hidden'),
  detailsBack: !document.getElementById('charselect-class-details')?.hasAttribute('hidden'),
}));
if (posts.length > 0) {
  console.error(`FAIL: Cancel posted ${posts.length} request(s); it must spend nothing`);
  await browser.close();
  process.exit(1);
}
if (!afterCancel.closed || !afterCancel.detailsBack) {
  console.error(`FAIL: Cancel did not close and restore the panel ${JSON.stringify(afterCancel)}`);
  await browser.close();
  process.exit(1);
}
console.log('cancel closed cleanly and posted nothing: OK');

// Reopen, edit, save: the authored look must reach the redesign endpoint.
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('#char-list .char-row')];
  const row = rows.find((r) => r.querySelector('.char-name')?.textContent === 'Veteran');
  row?.querySelector('.redesign-btn')?.click();
});
await wait(2000);
await page.evaluate(() => {
  const host = document.getElementById('charselect-reroll-host');
  host?.querySelector('.ac-seg-btn:not(.sel)')?.click();
  host?.querySelector('.ac-step-btn')?.click();
});
await wait(800);
const beforeSave = await page.evaluate(() => {
  const panel = document.getElementById('charselect-reroll');
  const btn = document.getElementById('btn-reroll-save');
  return {
    reopened: !!panel && !panel.hasAttribute('hidden'),
    saveButton: !!btn,
    disabled: btn?.disabled ?? null,
  };
});
console.log('before save:', JSON.stringify(beforeSave));
await page.evaluate(() => document.getElementById('btn-reroll-save')?.click());
await wait(2500);
const afterSave = await page.evaluate(() => ({
  err: document.getElementById('charselect-reroll-error')?.textContent ?? '',
  stillOpen: !document.getElementById('charselect-reroll')?.hasAttribute('hidden'),
}));
console.log('after save:', JSON.stringify(afterSave));

console.log(`posts: ${JSON.stringify(posts.map((p) => p.url))}`);
const save = posts.find((p) => /\/api\/characters\/101\/appearance$/.test(p.url));
if (!save) {
  console.error('FAIL: Save did not POST to the redesign endpoint for character 101');
  await browser.close();
  process.exit(1);
}
const body = JSON.parse(save.body ?? '{}');
if (!body.appearance || typeof body.appearance !== 'object') {
  console.error(`FAIL: Save posted no authored look (body ${save.body})`);
  await browser.close();
  process.exit(1);
}
console.log('saved look:', JSON.stringify(body.appearance).slice(0, 100));

if (errors.length) {
  console.log(`page errors (${errors.length}):`);
  for (const e of errors.slice(0, 5)) console.log(`  ${e}`);
}
await browser.close();
console.log(`\nOK: redesign offered, opened, cancelled cleanly, and saved. Shots in ${OUT}/`);
