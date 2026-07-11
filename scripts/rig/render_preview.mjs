// Render preview PNGs of arbitrary character GLBs, reusing the Guide's own model assembly
// (buildModel via scripts/wiki/stills_render_entry.js) so a preview matches the in-game
// look and, crucially, POSES the idle clip: broken skinning renders blank/exploded, so
// this doubles as the correctness check for gen_character.mjs.
//
//   node scripts/rig/render_preview.mjs <out-dir> <url1> [url2 ...]
//
// urls are public-relative (e.g. models/chars/custom/custom_golem.glb). Needs a browser
// (BROWSER_PATH / browser_path.mjs). Pattern mirrors scripts/wiki/render_model_stills.mjs.
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import * as esbuild from 'esbuild';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { BROWSER_PATH } from '../browser_path.mjs';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const [, , outDirArg, ...urls] = process.argv;
if (!outDirArg || urls.length === 0) {
  console.error('usage: node scripts/rig/render_preview.mjs <out-dir> <url1> [url2 ...]');
  process.exit(2);
}
const outDir = path.resolve(outDirArg);
mkdirSync(outDir, { recursive: true });

const bundled = await esbuild.build({
  entryPoints: [path.join(root, 'scripts', 'wiki', 'stills_render_entry.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  define: { 'import.meta.env.DEV': 'true', 'import.meta.env.PROD': 'false' },
  write: false,
  logLevel: 'silent',
});
const bundleJs = bundled.outputFiles[0].text;

const HARNESS = `<!doctype html><html><head><meta charset="utf8"><style>html,body{margin:0;background:#2a2a33}</style></head><body><script src="/__b.js"></script></body></html>`;
const MIME = {
  '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
};
const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/__p.html') {
    res.setHeader('content-type', 'text/html');
    res.end(HARNESS);
    return;
  }
  if (url === '/__b.js') {
    res.setHeader('content-type', 'text/javascript');
    res.end(bundleJs);
    return;
  }
  const filePath = path.normalize(path.join(publicDir, url));
  if (filePath !== publicDir && !filePath.startsWith(publicDir + path.sep)) {
    res.statusCode = 403;
    res.end('no');
    return;
  }
  try {
    const buf = await readFile(filePath);
    res.setHeader(
      'content-type',
      MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    );
    res.end(buf);
  } catch {
    res.statusCode = 404;
    res.end('nf');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: [
    '--use-angle=swiftshader',
    '--use-gl=angle',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--no-sandbox',
  ],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('PAGEERR', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('CONSOLE', m.text()));
await page.goto(`${origin}/__p.html`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction('window.__ready === true', { timeout: 20000 });

for (const url of urls) {
  const name = path.basename(url).replace(/\.glb$/, '');
  try {
    const clip = process.env.CLIP || 'Idle';
    const dataUrl = await page.evaluate(
      (u, c) => window.renderStill({ url: u, idle: c }, null),
      url,
      clip,
    );
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    const alpha = (await sharp(png).stats()).channels[3];
    const out = path.join(outDir, `${name}.png`);
    await sharp(png).resize(360, 360).flatten({ background: '#2a2a33' }).png().toFile(out);
    console.log(`ok ${name}  (alpha max ${alpha.max}) -> ${out}`);
  } catch (e) {
    console.error(`FAIL ${name}: ${e.message}`);
  }
}
await browser.close();
server.close();
