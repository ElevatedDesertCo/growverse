// Render a character GLB playing a clip as an animated GIF (proof that a rig actually
// MOVES, which a still cannot show). Reuses the Guide model path + window.renderAnim from
// stills_render_entry.js; encodes with the bundled ffmpeg.
//
//   node scripts/rig/render_anim.mjs <out.gif> <public-relative-url> [clip] [frames] [fps]
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
const [, , outGif, url, clip = 'Walking_A', framesArg = '30', fpsArg = '30'] = process.argv;
if (!outGif || !url) {
  console.error('usage: node scripts/rig/render_anim.mjs <out.gif> <url> [clip] [frames] [fps]');
  process.exit(2);
}
const frames = Number(framesArg);
const fps = Number(fpsArg);

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
const server = http.createServer(async (req, res) => {
  const u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u === '/__a.html') {
    res.setHeader('content-type', 'text/html');
    res.end(HARNESS);
    return;
  }
  if (u === '/__b.js') {
    res.setHeader('content-type', 'text/javascript');
    res.end(bundleJs);
    return;
  }
  const fp = path.normalize(path.join(publicDir, u));
  if (fp !== publicDir && !fp.startsWith(publicDir + path.sep)) {
    res.statusCode = 403;
    res.end('no');
    return;
  }
  try {
    res.end(await readFile(fp));
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
await page.goto(`${origin}/__a.html`, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction('window.__ready === true', { timeout: 20000 });

const dataUrls = await page.evaluate(
  (u, c, f, r) => window.renderAnim({ url: u }, c, f, r),
  url,
  clip,
  frames,
  fps,
);
await browser.close();
server.close();

// Encode with sharp (the Playwright ffmpeg build cannot decode PNG). sharp's array-join
// animation API stitches the frames into a real multi-page GIF/WebP.
const SIZE = 300;
const frameBufs = await Promise.all(
  dataUrls.map((d) =>
    sharp(Buffer.from(d.split(',')[1], 'base64'))
      .resize(SIZE)
      .flatten({ background: '#2a2a33' })
      .png()
      .toBuffer(),
  ),
);
mkdirSync(path.dirname(path.resolve(outGif)), { recursive: true });
const ext = path.extname(outGif).slice(1).toLowerCase() === 'webp' ? 'webp' : 'gif';
await sharp(frameBufs, { join: { animated: true } })
  [ext]({ loop: 0, delay: Math.round(1000 / fps) })
  .toFile(path.resolve(outGif));
console.log(`wrote ${outGif} (${frameBufs.length} frames of ${clip})`);
