// Renders the Growverse SVG logos (logo_svg.mjs) to transparent PNG masters in
// tmp/brand/ via headless Chrome (so fonts and filters rasterize correctly).
// Pass --emit to also derive every shipped public/ brand file with sharp.
// Usage: node scripts/brand/render_logo.mjs [--emit]
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from '../browser_path.mjs';
import { emblemIcon, horizontalLogo, squareLogo } from './logo_svg.mjs';

fs.mkdirSync('tmp/brand', { recursive: true });

const MASTERS = [
  ['logo-horizontal', horizontalLogo(), 1200, 800],
  ['logo-square', squareLogo(), 1254, 1254],
  ['emblem', emblemIcon(), 1024, 1024],
];

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: ['--window-size=1400,1400', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  defaultViewport: { width: 1400, height: 1400, deviceScaleFactor: 2 },
});
const page = await browser.newPage();

for (const [name, svg, w, h] of MASTERS) {
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  const el = await page.$('svg');
  await el.screenshot({ path: `tmp/brand/${name}.png`, omitBackground: true });
  console.log(`rendered tmp/brand/${name}.png (${w * 2}x${h * 2} at 2x)`);
}
await browser.close();

if (process.argv.includes('--emit')) {
  const { default: sharp } = await import('sharp');
  // The shipped logo files (growverse-logo*.png/webp, growverse_logo_square.webp)
  // are derived from the painted master art, not from these vector layouts; this
  // script owns only the small-size icon set where vector stays crisp.
  const jobs = [
    // [master, out, width, height, format]
    ['emblem', 'public/icon-512.png', 512, 512, 'png'],
    ['emblem', 'public/icon-192.png', 192, 192, 'png'],
    ['emblem', 'public/apple-touch-icon.png', 180, 180, 'png'],
    ['emblem', 'public/favicon-32x32.png', 32, 32, 'png'],
    ['emblem', 'public/favicon-16x16.png', 16, 16, 'png'],
  ];
  for (const [master, out, w, h, fmt] of jobs) {
    let img = sharp(`tmp/brand/${master}.png`).resize(w, h, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    img = fmt === 'webp' ? img.webp({ quality: 92 }) : img.png();
    await img.toFile(out);
    console.log(`emitted ${out} (${w}x${h})`);
  }
  // favicon.ico: a single 32x32 PNG-encoded ICO built by hand (valid ICO with
  // an embedded PNG, understood by every modern browser).
  const png32 = await sharp('tmp/brand/emblem.png')
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  header.writeUInt8(32, 6); // width
  header.writeUInt8(32, 7); // height
  header.writeUInt8(0, 8); // palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bpp
  header.writeUInt32LE(png32.length, 14); // bytes
  header.writeUInt32LE(22, 18); // offset
  fs.writeFileSync('public/favicon.ico', Buffer.concat([header, png32]));
  console.log('emitted public/favicon.ico');
}
