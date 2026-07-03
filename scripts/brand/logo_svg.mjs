// Growverse brand logo, hand-built SVG (cosmic desert: ochre dunes, gold
// lettering, sage-green sacred sprout, soft purple cosmos). Three layouts:
// horizontal (title/hero), square (social/app tile), emblem (favicons/PWA).
// Rendered to PNG by render_logo.mjs via headless Chrome (fonts resolve there).

const GOLD_TOP = '#f9e7ae';
const GOLD_MID = '#e2b243';
const GOLD_DEEP = '#8f6118';
const OUTLINE = '#2b1706';
const SKY_IN = '#4a3575';
const SKY_OUT = '#171026';
const DUNE_LIT = '#d29147';
const DUNE_SHADE = '#8a5a26';
const LEAF = '#9fce6d';
const LEAF_DEEP = '#5d8f3a';
const SUN = '#ffb347';

export const DEFS = `
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${GOLD_TOP}"/>
      <stop offset="0.45" stop-color="${GOLD_MID}"/>
      <stop offset="1" stop-color="${GOLD_DEEP}"/>
    </linearGradient>
    <linearGradient id="goldRim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff3c9"/>
      <stop offset="0.5" stop-color="#c8922e"/>
      <stop offset="1" stop-color="#6e4a12"/>
    </linearGradient>
    <radialGradient id="sky" cx="0.5" cy="0.42" r="0.75">
      <stop offset="0" stop-color="${SKY_IN}"/>
      <stop offset="1" stop-color="${SKY_OUT}"/>
    </radialGradient>
    <linearGradient id="dune" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${DUNE_LIT}"/>
      <stop offset="1" stop-color="${DUNE_SHADE}"/>
    </linearGradient>
    <linearGradient id="leaf" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${LEAF}"/>
      <stop offset="1" stop-color="${LEAF_DEEP}"/>
    </linearGradient>
    <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${SUN}" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="${SUN}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${SUN}" stop-opacity="0"/>
    </radialGradient>
    <filter id="softGlowGreen" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="softGlowGold" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="dropShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>`;

// Star positions inside the emblem disc (deterministic, hand-placed).
const STARS = [
  [-120, -118, 2.6],
  [-70, -150, 1.8],
  [-16, -122, 2.2],
  [42, -152, 1.7],
  [96, -118, 2.6],
  [136, -66, 1.8],
  [-152, -58, 1.9],
  [-96, -66, 1.4],
  [24, -88, 1.5],
  [78, -62, 1.9],
  [-44, -66, 1.6],
  [148, -12, 1.4],
  [-148, -4, 1.5],
];

// The emblem: golden ring, purple cosmos, warm sun, dunes, sacred sprout.
// Draws centered at (0,0) with ring radius r.
export function emblem(r = 200) {
  const inner = r - 14;
  const stars = STARS.map(
    ([x, y, s]) =>
      `<circle cx="${(x * r) / 200}" cy="${(y * r) / 200}" r="${(s * r) / 200}" fill="#efe6ff" opacity="0.9"/>`,
  ).join('');
  const k = r / 200; // scale factor for interior artwork authored at r=200
  const clipId = `disc${Math.round(r)}`;
  return `
  <clipPath id="${clipId}"><circle r="${inner}"/></clipPath>
  <g filter="url(#dropShadow)">
    <circle r="${inner}" fill="url(#sky)"/>
    <g clip-path="url(#${clipId})">
    <g>${stars}</g>
    <circle cx="0" cy="${52 * k}" r="${118 * k}" fill="url(#sunGlow)"/>
    <circle cx="0" cy="${52 * k}" r="${44 * k}" fill="${SUN}" opacity="0.9"/>
    <path d="M ${-inner} ${70 * k} Q ${-90 * k} ${18 * k} ${-10 * k} ${64 * k} T ${inner} ${52 * k} L ${inner} ${inner * 1.2} L ${-inner} ${inner * 1.2} Z" fill="url(#dune)"/>
    <path d="M ${-inner} ${104 * k} Q ${-30 * k} ${58 * k} ${60 * k} ${100 * k} T ${inner} ${92 * k} L ${inner} ${inner * 1.2} L ${-inner} ${inner * 1.2} Z" fill="${DUNE_SHADE}" opacity="0.85"/>
    <g filter="url(#softGlowGreen)">
      <path d="M 0 ${86 * k} C ${-4 * k} ${40 * k} ${4 * k} ${10 * k} 0 ${-34 * k}" stroke="url(#leaf)" stroke-width="${9 * k}" fill="none" stroke-linecap="round"/>
      <path d="M 0 ${30 * k} C ${-34 * k} ${22 * k} ${-56 * k} ${-6 * k} ${-58 * k} ${-34 * k} C ${-28 * k} ${-30 * k} ${-6 * k} ${-6 * k} 0 ${30 * k} Z" fill="url(#leaf)"/>
      <path d="M 0 ${30 * k} C ${34 * k} ${22 * k} ${56 * k} ${-6 * k} ${58 * k} ${-34 * k} C ${28 * k} ${-30 * k} ${6 * k} ${-6 * k} 0 ${30 * k} Z" fill="url(#leaf)"/>
      <path d="M 0 ${-24 * k} C ${-14 * k} ${-52 * k} ${-8 * k} ${-78 * k} 0 ${-96 * k} C ${8 * k} ${-78 * k} ${14 * k} ${-52 * k} 0 ${-24 * k} Z" fill="url(#leaf)"/>
    </g>
    <circle r="${inner}" fill="none" stroke="${OUTLINE}" stroke-width="${6 * k}"/>
    <circle r="${r}" fill="none" stroke="url(#goldRim)" stroke-width="${20 * k}"/>
    <circle r="${r}" fill="none" stroke="${OUTLINE}" stroke-width="${2.5 * k}" transform="scale(${(r + 10 * k) / r})"/>
    <circle r="${r - 10 * k}" fill="none" stroke="#fff3c9" stroke-width="${2 * k}" opacity="0.55"/>
    ${[0, 90, 180, 270]
      .map(
        (a) =>
          `<g transform="rotate(${a}) translate(0 ${-r})"><path d="M 0 ${-16 * k} L ${12 * k} 0 L 0 ${16 * k} L ${-12 * k} 0 Z" fill="url(#gold)" stroke="${OUTLINE}" stroke-width="${2.5 * k}"/></g>`,
      )
      .join('')}
  </g>`;
}

// Arched wordmark. Chrome renders the font; Herculanum ships with macOS and
// has the right adventure-caps feel, with strong serif fallbacks elsewhere.
export function wordmark(cx, cy, width, fontSize, arcId) {
  const half = width / 2;
  const dip = width * 0.055;
  const font = `font-family="Herculanum, 'Copperplate', 'Trajan Pro', Georgia, serif" font-size="${fontSize}" font-weight="700" letter-spacing="${fontSize * 0.06}"`;
  const path = `M ${cx - half} ${cy} Q ${cx} ${cy - dip * 2} ${cx + half} ${cy}`;
  const text = (extra) =>
    `<text ${font} ${extra} text-anchor="middle"><textPath href="#${arcId}" startOffset="50%">GROWVERSE</textPath></text>`;
  return `
  <path id="${arcId}" d="${path}" fill="none"/>
  <g filter="url(#dropShadow)">
    ${text(`fill="none" stroke="${OUTLINE}" stroke-width="${fontSize * 0.14}" stroke-linejoin="round"`)}
    <g filter="url(#softGlowGold)">${text('fill="url(#gold)"')}</g>
    ${text(`fill="none" stroke="#fff3c9" stroke-width="${fontSize * 0.012}" opacity="0.5"`)}
  </g>`;
}

// Side flourishes flanking the wordmark.
function flourish(x, y, w, flip) {
  const s = flip ? -1 : 1;
  return `
  <g stroke="url(#gold)" stroke-width="7" fill="none" stroke-linecap="round" filter="url(#softGlowGold)">
    <path d="M ${x} ${y} q ${s * w * 0.6} -10 ${s * w} 4"/>
    <path d="M ${x + s * w * 0.2} ${y + 18} q ${s * w * 0.45} -6 ${s * w * 0.62} 8"/>
  </g>
  <circle cx="${x + s * w}" cy="${y + 4}" r="7" fill="url(#gold)" stroke="${OUTLINE}" stroke-width="2"/>`;
}

// 1200x800, emblem above an arched wordmark (matches the old logo layout).
export function horizontalLogo() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  ${DEFS}
  <g transform="translate(600 300)">${emblem(240)}</g>
  ${wordmark(600, 700, 1080, 148, 'arcH')}
  ${flourish(30, 720, 130, false)}
  ${flourish(1170, 720, 130, true)}
</svg>`;
}

// 1254x1254 square tile: emblem large, wordmark beneath.
export function squareLogo() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1254 1254" width="1254" height="1254">
  ${DEFS}
  <g transform="translate(627 500)">${emblem(330)}</g>
  ${wordmark(627, 1130, 1130, 152, 'arcS')}
</svg>`;
}

// 1024x1024 emblem only, for favicons and PWA icons.
export function emblemIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  ${DEFS}
  <g transform="translate(512 512)">${emblem(455)}</g>
</svg>`;
}
