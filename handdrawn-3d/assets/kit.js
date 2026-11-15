// handdrawn kit — 3D scenes drawn by hand: flat marker tones + wobbly ink on cream paper, as SVG.
// Plain JS, no dependencies. Runs in Node and in the browser (ES module).
// MIT licence. Written from scratch; the 3D approach (orthographic camera, three flat tones by face normal,
// painter's sorting of separate solids) was studied from Colorfigures by April Zhu (MIT), no code copied.
//
//   import { createKit } from './kit.js';
//   const k = createKit({ seed: 7, width: 1000, height: 1000, t: 0, camera: { yaw: 45, pitch: 35.26 }, view });
//   k.box([0, 0, 0], [100, 60, 80], { fill: 'red' });
//   const svg = k.toSVG();
//
// World: x right, y back, z up (ground z = 0). Sheet: x right, y down. render.mjs frames the drawing (view).

/* ------------------------------------------------------------------ random */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ------------------------------------------------------------------ small maths */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const fmt = (n) => { const r = Math.round(n * 10) / 10; return (r === 0 ? 0 : r).toString(); };
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

// compact path data: absolute start, then relative steps on a 0.1 grid (rounding the absolute points first, so
// the steps add up exactly). Numbers drop the leading 0 and use '-' as a separator, like SVG minifiers do.
function encodePath(P, close) {
  if (!P.length) return '';
  const r = (v) => Math.round(v * 10);
  const num = (n) => { let s = (n / 10).toString(); if (s.startsWith('0.')) s = s.slice(1); else if (s.startsWith('-0.')) s = '-' + s.slice(2); return s; };
  let px = r(P[0][0]), py = r(P[0][1]);
  let out = 'M' + num(px) + (py < 0 ? '' : ' ') + num(py) + 'l';
  let first = true;
  for (let i = 1; i < P.length; i++) {
    const x = r(P[i][0]), y = r(P[i][1]), dx = x - px, dy = y - py;
    if (!dx && !dy) continue;
    const a = num(dx), b = num(dy);
    out += (first || a[0] === '-' ? '' : ' ') + a + (b[0] === '-' ? '' : ' ') + b;
    first = false; px = x; py = y;
  }
  if (first) out += '0 0';
  return out + (close ? 'z' : '');
}
function polyLen(P) { let L = 0; for (let i = 1; i < P.length; i++) L += dist(P[i - 1], P[i]); return L; }

function resample(P, step) {
  if (P.length < 2) return P.map((p) => [p[0], p[1]]);
  const out = [[P[0][0], P[0][1]]];
  let need = step;
  for (let i = 1; i < P.length; i++) {
    let a = P[i - 1], b = P[i];
    let seg = dist(a, b);
    let pos = 0;
    while (seg - pos >= need) {
      pos += need;
      const t = pos / seg;
      out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
      need = step;
    }
    need -= seg - pos;
  }
  const last = P[P.length - 1];
  if (dist(out[out.length - 1], last) > step * 0.25) out.push([last[0], last[1]]);
  else out[out.length - 1] = [last[0], last[1]];
  return out;
}

function signedArea(P) {
  let s = 0;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
}
// Douglas-Peucker: drop points closer than tol to the line through their neighbours
function simplify(P, tol) {
  if (P.length < 4) return P;
  const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
  const stack = [[0, P.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = P[a][0], ay = P[a][1], dx = P[b][0] - ax, dy = P[b][1] - ay, L = Math.hypot(dx, dy) || 1e-9;
    let md = 0, mi = -1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((P[i][0] - ax) * dy - (P[i][1] - ay) * dx) / L; if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return P.filter((_, i) => keep[i]);
}
function bboxOf(P) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// Catmull-Rom through points. A point given as [x, y, 'c'] is a sharp corner.
function catmull(points, closed, step = 2) {
  const P = points;
  const n = P.length;
  if (n < 2) return P.map((p) => [p[0], p[1]]);
  const corner = (i) => P[(i + n) % n][2] === 'c' || P[(i + n) % n][2] === true;
  const out = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p1 = P[i], p2 = P[(i + 1) % n];
    let p0 = closed ? P[(i - 1 + n) % n] : P[i - 1] || p1;
    let p3 = closed ? P[(i + 2) % n] : P[i + 2] || p2;
    if (corner(i)) p0 = p1;
    if (corner(i + 1)) p3 = p2;
    const L = dist(p1, p2);
    const m = Math.max(2, Math.ceil(L / step));
    for (let j = 0; j < m; j++) {
      const t = j / m, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push([P[n - 1][0], P[n - 1][1]]);
  return out;
}

// One side of a line through a polygon: parameter intervals [t0,t1] where the line is inside.
function lineIntervals(poly, o, d) {
  const ts = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const wx = a[0] - o[0], wy = a[1] - o[1];
    const t = (wx * ey - wy * ex) / den;
    const u = (wx * d[1] - wy * d[0]) / den;
    if (u >= 0 && u < 1) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  const iv = [];
  for (let i = 0; i + 1 < ts.length; i += 2) iv.push([ts[i], ts[i + 1]]);
  return iv;
}
function subtractIntervals(A, B) {
  let out = A.map((x) => x.slice());
  for (const [b0, b1] of B) {
    const next = [];
    for (const [a0, a1] of out) {
      if (b1 <= a0 || b0 >= a1) { next.push([a0, a1]); continue; }
      if (b0 > a0) next.push([a0, b0]);
      if (b1 < a1) next.push([b1, a1]);
    }
    out = next;
  }
  return out;
}

/* ------------------------------------------------------------------ colour */

const PALETTE = {
  ink: '#2c2620', paper: '#f4ecdc',
  red: '#d9705f', brick: '#bf5a4c', coral: '#ea9580', orange: '#e8a35f', ochre: '#ddb25f',
  yellow: '#efd47e', cream: '#f6e8c8', sage: '#a9bf93', green: '#82ad78', leaf: '#93b86f',
  olive: '#a7a865', teal: '#79aea6', mint: '#b9d8c4', sky: '#aac8df', blue: '#7f9fcf', navy: '#617399',
  lilac: '#bba8cf', plum: '#9c7598', pink: '#efb3ac', blush: '#f3c4b8', sand: '#e3d0a9',
  wood: '#c99d6e', brown: '#a07757', chocolate: '#7e5c46', grey: '#b5afa5', stone: '#d0c9bd',
  charcoal: '#6d665f', white: '#fbf8f1', shadow: '#d9ccb3', skin: '#f2cdb0', tan: '#d9a77f',
};
// chromatic pigments that arbitrary colours are pulled toward
const PIGMENTS = ['red', 'coral', 'orange', 'ochre', 'yellow', 'sage', 'green', 'leaf', 'teal', 'sky', 'blue', 'navy', 'lilac', 'plum', 'pink', 'wood', 'brown'];

function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('');
const s2l = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const l2s = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function rgbToOklch(rgb) {
  const [r, g, b] = rgb.map(s2l);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}
function oklchToRgb([L, C, h]) {
  const A = C * Math.cos((h * Math.PI) / 180), B = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => l2s(Math.max(0, c)));
}
function inGamut(rgb) { return rgb.every((v) => v >= -0.002 && v <= 1.002); }
function fromOklch(lch) {
  let [L, C, h] = lch;
  let rgb = oklchToRgb([L, C, h]);
  let lo = 0, hi = C;
  if (!inGamut(rgb)) { for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (inGamut(oklchToRgb([L, mid, h]))) lo = mid; else hi = mid; } rgb = oklchToRgb([L, lo, h]); }
  return toHex(rgb);
}
const hueDiff = (a, b) => ((b - a + 540) % 360) - 180;
const PIGMENT_LCH = PIGMENTS.map((n) => rgbToOklch(hexToRgb(PALETTE[n])));

/** Pull any colour into the marker look: lift lightness, cap chroma, pull hue toward the nearest pigment. */
const KIT_MADE = new Set(); // colours the kit already produced (soften/darker/lighter): never re-soften them
const made = (hex) => { KIT_MADE.add(hex); return hex; };
function soften(c) {
  if (c == null || c === false || c === 'none') return null;
  if (PALETTE[c]) return PALETTE[c];
  if (KIT_MADE.has(c)) return c;
  if (typeof c !== 'string' || c[0] !== '#') return PALETTE.grey;
  let [L, C, h] = rgbToOklch(hexToRgb(c));
  L = 0.5 + 0.47 * L;               // nothing darker than a soft grey, nothing glaring white
  C = Math.min(C * 0.8, 0.105);
  if (C > 0.02) {
    let best = PIGMENT_LCH[0], bd = 999;
    for (const p of PIGMENT_LCH) { const d = Math.abs(hueDiff(h, p[2])); if (d < bd) { bd = d; best = p; } }
    h = (h + hueDiff(h, best[2]) * 0.45 + 360) % 360;
  }
  return made(fromOklch([L, C, h]));
}
/** Same hue, darker (for the shaded side). amt ≈ 0.05–0.15. */
function darker(c, amt = 0.075) {
  const [L, C, h] = rgbToOklch(hexToRgb(soften(c)));
  return made(fromOklch([L - amt, Math.min(C * 1.12 + 0.008, 0.14), h + hueDiff(h, 40) * 0.08]));
}
function lighter(c, amt = 0.06) {
  const [L, C, h] = rgbToOklch(hexToRgb(soften(c)));
  return made(fromOklch([Math.min(0.97, L + amt), C * 0.85, h]));
}
// ink is not softened (it is the one dark)
function inkColor(c) { if (!c || c === true) return PALETTE.ink; return PALETTE[c] || c; }

/* ------------------------------------------------------------------ stroke font (Latin + Vietnamese) */
// Units: baseline y=0, x-height −5, cap height −7, descender +2.6. Size s ⇒ 1 unit = s/10 px.
// Stroke kinds: L polyline, C smooth spline, O ellipse arc (cx cy rx ry a0 a1, degrees, y down), D dot (x y).
const GLYPHS = {
  ' ': [2.6, ''],
  a: [5, 'O 2 -2.5 2 2.5 -20 350;L 4 -5 4 -0.1'],
  b: [4.8, 'L 0 -7.4 0 0;O 2 -2.5 2 2.5 190 550'],
  c: [4.5, 'O 2.2 -2.5 2.2 2.5 -40 -322'],
  d: [5, 'O 2 -2.5 2 2.5 -10 350;L 4 -7.4 4 -0.1'],
  e: [4.7, 'C 0.2 -2.5 2.3 -2.6 4.2 -2.7 4.1 -3.9 3.3 -4.9 2.1 -5 0.8 -4.6 0.1 -3.1 0.3 -1.3 1.3 -0.2 2.6 0 3.8 -0.6'],
  f: [3.4, 'C 3.4 -7.1 2.4 -7.4 1.6 -6.8 1.4 -5.6 1.4 0;L 0 -4.9 3 -4.9'],
  g: [5, 'O 2 -2.5 2 2.5 -20 350;C 4 -5 4 0.8 3.4 2.2 2 2.6 0.5 2.1'],
  h: [4.8, 'L 0 -7.4 0 0;C 0 -3 0.9 -4.7 2.3 -5 3.6 -4.5 4 -3 4 0'],
  i: [1.4, 'L 0.4 -5 0.4 0;D 0.4 -6.6'],
  ı: [1.4, 'L 0.4 -5 0.4 0'],
  j: [2.4, 'C 1.6 -5 1.6 1.5 1.1 2.4 0 2.6 -0.7 2.1;D 1.6 -6.6'],
  k: [4.3, 'L 0 -7.4 0 0;L 3.6 -5 0.2 -2.2 3.8 0'],
  l: [1.9, 'C 0.3 -7.4 0.3 -1.2 0.6 -0.3 1.4 0'],
  m: [6.8, 'L 0 -5 0 0;C 0 -3.2 0.7 -4.8 1.7 -5 2.7 -4.6 3 -3.3 3 0;C 3 -3.3 3.7 -4.8 4.7 -5 5.7 -4.6 6 -3.3 6 0'],
  n: [4.8, 'L 0 -5 0 0;C 0 -3 0.9 -4.7 2.3 -5 3.6 -4.5 4 -3 4 0'],
  o: [4.8, 'O 2.1 -2.5 2.1 2.5 -100 275'],
  p: [4.8, 'L 0 -5 0 2.6;O 2 -2.5 2 2.5 190 550'],
  q: [5, 'O 2 -2.5 2 2.5 -20 350;L 4 -5 4 2.6'],
  r: [3.4, 'L 0 -5 0 0;C 0 -2.8 0.8 -4.6 2 -5 3.2 -4.8'],
  s: [4.1, 'C 3.5 -4.4 2.5 -5 1.2 -4.9 0.4 -4.2 0.6 -3.2 1.8 -2.6 3 -2.1 3.5 -1.1 2.9 -0.2 1.6 0 0.2 -0.5'],
  t: [3.2, 'C 1.2 -6.6 1.2 -1 1.7 -0.1 2.8 0;L 0 -4.9 2.8 -4.9'],
  u: [4.8, 'C 0 -5 0 -1.9 0.6 -0.4 2 0 3.3 -0.5 4 -2.1;L 4 -5 4 0'],
  v: [4.4, 'L 0 -5 2 0 4 -5'],
  w: [6.4, 'L 0 -5 1.5 0 3 -4 4.5 0 6 -5'],
  x: [4.4, 'L 0 -5 4 0;L 4 -5 0 0'],
  y: [4.4, 'L 0 -5 2 -0.3;L 4 -5 1.2 2.6'],
  z: [4.4, 'L 0 -5 4 -5 0 0 4.2 0'],
  A: [5.4, 'L 0 0 2.5 -7 5 0;L 1 -2.6 4 -2.6'],
  B: [4.8, 'L 0 0 0 -7;C 0 -7 2.6 -7 3.6 -6.2 3.6 -4.6 2.6 -3.8 0.1 -3.8;C 0.1 -3.8 3 -3.8 4.2 -2.8 4.2 -1 3 0 0 0'],
  C: [6, 'O 3 -3.5 3 3.5 -40 -322'],
  D: [5.4, 'L 0 0 0 -7;C 0 -7 2.5 -7 4.3 -5.6 4.9 -3.5 4.3 -1.4 2.5 0 0 0'],
  E: [4.6, 'L 4 -7 0 -7 0 0 4 0;L 0 -3.6 3.2 -3.6'],
  F: [4.4, 'L 4 -7 0 -7 0 0;L 0 -3.6 3.2 -3.6'],
  G: [6.6, 'O 3 -3.5 3 3.5 -40 -358;L 3.6 -3.3 6 -3.3 6 -0.3'],
  H: [5.4, 'L 0 -7 0 0;L 4.6 -7 4.6 0;L 0 -3.6 4.6 -3.6'],
  I: [1.2, 'L 0.4 -7 0.4 0'],
  J: [3.8, 'C 3 -7 3 -1.6 2.4 -0.3 1.4 0 0.3 -0.5 0 -1.4'],
  K: [4.8, 'L 0 -7 0 0;L 4.2 -7 0.2 -3.2 4.4 0'],
  L: [4.2, 'L 0 -7 0 0 3.8 0'],
  M: [6.6, 'L 0 0 0.3 -7 3 -2.2 5.7 -7 6 0'],
  N: [5.4, 'L 0 0 0 -7 4.6 0 4.6 -7'],
  O: [6.6, 'O 3.2 -3.5 3.2 3.5 -100 275'],
  P: [4.8, 'L 0 0 0 -7;C 0 -7 2.8 -7 4.1 -6 4.1 -4.4 2.8 -3.3 0.1 -3.3'],
  Q: [6.6, 'O 3.2 -3.5 3.2 3.5 -100 275;L 3.6 -1.4 6.2 0.6'],
  R: [5, 'L 0 0 0 -7;C 0 -7 2.8 -7 4.1 -6 4.1 -4.4 2.8 -3.3 0.1 -3.3;L 2 -3.3 4.4 0'],
  S: [5, 'C 4.4 -6.2 3.4 -7 2 -7 0.6 -6.4 0.6 -5 1.8 -4 3.2 -3.4 4.4 -2.2 4 -0.6 2.4 0 0.2 -0.8'],
  T: [5.4, 'L 0 -7 5 -7;L 2.5 -7 2.5 0'],
  U: [5.6, 'C 0 -7 0 -2.2 0.8 -0.4 2.4 0 4 -0.4 4.8 -2.2 4.8 -7'],
  V: [5.4, 'L 0 -7 2.5 0 5 -7'],
  W: [7, 'L 0 -7 1.6 0 3.3 -5.2 5 0 6.6 -7'],
  X: [5, 'L 0 -7 4.6 0;L 4.6 -7 0 0'],
  Y: [5.2, 'L 0 -7 2.4 -3.4 4.8 -7;L 2.4 -3.4 2.4 0'],
  Z: [5.2, 'L 0 -7 4.6 -7 0 0 4.8 0'],
  0: [5, 'O 2.4 -3.5 2.4 3.5 -100 275'],
  1: [3, 'L 0.4 -5.6 2 -7 2 0'],
  2: [4.6, 'C 0.3 -5.6 1 -6.8 2.3 -7 3.6 -6.6 4 -5.3 3.4 -3.8 0 0;L 0 0 4.2 0'],
  3: [4.6, 'C 0.3 -6.4 1.6 -7 3 -6.9 3.8 -6 3.4 -4.4 1.6 -3.8;C 1.6 -3.8 3.6 -3.4 4.2 -1.8 3.4 -0.3 1.8 0 0.2 -0.7'],
  4: [4.8, 'L 3.2 0 3.2 -7 0 -2.2 4.4 -2.2'],
  5: [4.6, 'L 4 -7 0.6 -7 0.3 -3.7;C 0.3 -3.7 1.5 -4.4 2.9 -4.3 4.1 -3.3 4.2 -1.6 3.2 -0.2 1.6 0 0 -0.6'],
  6: [4.6, 'C 3.8 -6.8 2.4 -7 1 -6 0.2 -3.5 0.3 -1.4 1.5 -0.1 2.6 0 3.9 -0.8 4.1 -2.2 3.4 -3.7 2 -4 0.4 -3'],
  7: [4.6, 'L 0 -7 4.2 -7 1.4 0'],
  8: [4.6, 'O 2.2 -5.3 1.7 1.7 90 455;O 2.2 -1.8 2.1 1.8 -90 275'],
  9: [4.6, 'C 4 -4 2.8 -3.2 1.2 -3.3 0.2 -4.6 0.6 -6.4 2 -7 3.4 -6.7 4 -5.2 4 -3 3.5 -1 2 0 0.6 -0.4'],
  '.': [1.6, 'D 0.5 -0.35'],
  ',': [1.6, 'C 0.7 -0.5 0.6 0.5 -0.1 1.4'],
  ':': [1.6, 'D 0.5 -4;D 0.5 -0.35'],
  ';': [1.6, 'D 0.6 -4;C 0.7 -0.5 0.6 0.5 -0.1 1.4'],
  '!': [1.6, 'L 0.5 -7 0.5 -2.2;D 0.5 -0.35'],
  '?': [4, 'C 0.2 -6 1.2 -7 2.6 -6.9 3.6 -5.8 3.2 -4.4 1.8 -3.4 1.8 -2;D 1.8 -0.35'],
  '-': [3.4, 'L 0.2 -2.6 2.9 -2.6'],
  '–': [4.6, 'L 0.2 -2.6 4.2 -2.6'],
  '—': [6.6, 'L 0.2 -2.6 6.2 -2.6'],
  "'": [1.2, 'L 0.5 -7.4 0.4 -5.6'],
  '’': [1.6, 'C 0.7 -7.4 0.7 -6.4 0 -5.4'],
  '‘': [1.6, 'C 0.6 -5.4 0 -6.4 0.6 -7.4'],
  '"': [2.4, 'L 0.5 -7.4 0.4 -5.6;L 1.8 -7.4 1.7 -5.6'],
  '“': [3, 'C 0.6 -5.4 0 -6.4 0.6 -7.4;C 2 -5.4 1.4 -6.4 2 -7.4'],
  '”': [3, 'C 0.7 -7.4 0.7 -6.4 0 -5.4;C 2.1 -7.4 2.1 -6.4 1.4 -5.4'],
  '(': [2.4, 'C 1.8 -7.6 0.4 -5.5 0.1 -2.5 0.4 0.4 1.8 2.2'],
  ')': [2.4, 'C 0 -7.6 1.4 -5.5 1.7 -2.5 1.4 0.4 0 2.2'],
  '/': [3.6, 'L 0 1 3.4 -7.4'],
  '+': [4.4, 'L 0 -3 4 -3;L 2 -5 2 -1'],
  '=': [4.2, 'L 0 -3.8 3.8 -3.8;L 0 -1.8 3.8 -1.8'],
  '×': [4, 'L 0.2 -4.6 3.4 -1.4;L 3.4 -4.6 0.2 -1.4'],
  '*': [3.8, 'L 1.7 -7 1.7 -3.6;L 0.2 -6.2 3.2 -4.4;L 3.2 -6.2 0.2 -4.4'],
  '%': [5.6, 'L 0.4 0 4.8 -7;O 1.2 -5.6 1 1.3 0 365;O 4.1 -1.4 1 1.3 0 365'],
  '&': [5, 'C 4.6 0 1.4 -3.6 0.8 -5 1.2 -6.6 2.4 -7 3.4 -6.2 3.2 -4.8 0.6 -2.6 0.4 -0.8 1.6 0 3 -0.4 4.6 -2.4'],
  '#': [5.2, 'L 1.6 -7 1 0;L 3.8 -7 3.2 0;L 0.2 -4.8 4.8 -4.8;L 0 -2.2 4.6 -2.2'],
  '°': [2.4, 'O 1.1 -6.2 0.9 0.9 0 365'],
  '·': [1.6, 'D 0.5 -2.6'],
  '→': [6.8, 'L 0 -2.6 6.2 -2.6;L 4.6 -4 6.2 -2.6 4.6 -1.2'],
  '←': [6.8, 'L 6.2 -2.6 0 -2.6;L 1.6 -4 0 -2.6 1.6 -1.2'],
  '↑': [4, 'L 2 0 2 -7;L 0.6 -5.4 2 -7 3.4 -5.4'],
  '↓': [4, 'L 2 -7 2 0;L 0.6 -1.6 2 0 3.4 -1.6'],
  'đ': [5.4, 'O 2 -2.5 2 2.5 -10 350;L 4 -7.4 4 -0.1;L 2.6 -6.3 5.2 -6.3'],
  'Đ': [5.8, 'L 0.4 0 0.4 -7;C 0.4 -7 2.9 -7 4.7 -5.6 5.3 -3.5 4.7 -1.4 2.9 0 0.4 0;L -0.6 -3.5 2.2 -3.5'],
  '$': [4.6, 'C 4 -5.8 3.2 -6.4 2 -6.4 0.8 -5.8 0.8 -4.6 2 -3.8 3.2 -3.2 4 -2.2 3.6 -0.8 2.2 -0.3 0.4 -0.9;L 2.2 -7.4 2.2 0.7'],
};
// mark x-centre overrides for bowls offset from the advance width
const MARK_X = { a: 2, d: 2, q: 2, g: 2, o: 2.1, u: 2, y: 2.2, i: 0.4, ı: 0.4, e: 2.2, A: 2.5, O: 3.2, U: 2.4, I: 0.4, E: 2, Y: 2.4 };
// where the horn (ơ ư) attaches
const HORN_AT = { o: [3.7, -4.4], u: [4, -5], O: [5.6, -6.2], U: [4.8, -7] };
// combining marks, drawn around (0,0) = mark anchor
const MARKS = {
  0x0301: { pos: 'above', h: 1.7, d: 'L -0.5 0 0.9 -1.7', dx: 0.35 },          // acute  sắc
  0x0300: { pos: 'above', h: 1.7, d: 'L 0.5 0 -0.9 -1.7', dx: -0.2 },          // grave  huyền
  0x0309: { pos: 'above', h: 2.1, d: 'C -0.6 -1.6 -0.1 -2.1 0.6 -1.9 0.6 -1.1 0 -0.6 0 -0.1', dx: 0.3 }, // hook  hỏi
  0x0303: { pos: 'above', h: 1.1, d: 'C -1.4 -0.2 -0.9 -1 -0.3 -0.9 0.3 -0.3 0.9 -0.2 1.4 -1', dx: 0 },  // tilde  ngã
  0x0323: { pos: 'below', h: 1.2, d: 'D 0 0.6', dx: 0 },                        // dot below  nặng
  0x0302: { pos: 'above', h: 1.5, d: 'L -1.3 0 0 -1.5 1.3 0', dx: 0 },          // circumflex  â ê ô
  0x0306: { pos: 'above', h: 1.3, d: 'C -1.3 -1.3 -0.7 -0.2 0 0 0.7 -0.2 1.3 -1.3', dx: 0 }, // breve  ă
  0x0308: { pos: 'above', h: 0.6, d: 'D -0.9 -0.3;D 0.9 -0.3', dx: 0 },          // diaeresis
  0x031B: { pos: 'horn' },                                                       // horn  ơ ư
};
const HORN_D = 'C 0 0 0.9 -0.3 1.2 -1.1 0.9 -1.8';

function parseStrokes(def) {
  if (!def) return [];
  return def.split(';').map((s) => {
    const parts = s.trim().split(/\s+/);
    const kind = parts[0];
    const nums = parts.slice(1).map(Number);
    if (kind === 'O') {
      const [cx, cy, rx, ry, a0, a1] = nums;
      const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 12));
      const pts = [];
      for (let i = 0; i <= n; i++) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
      return { kind: 'L', pts };
    }
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    return { kind, pts };
  });
}
const GLYPH_CACHE = {};
function glyph(ch) {
  if (GLYPH_CACHE[ch]) return GLYPH_CACHE[ch];
  const g = GLYPHS[ch];
  if (!g) return null;
  return (GLYPH_CACHE[ch] = { w: g[0], strokes: parseStrokes(g[1]) });
}

/* ------------------------------------------------------------------ the kit */

const WEIGHTS = { outline: 2.3, detail: 1.6, fine: 1.1, hatch: 0.9, bold: 3.2 };
const LIGHT = [-Math.SQRT1_2, -Math.SQRT1_2]; // light comes from the top-left

export function createKit(opts = {}) {
  const W = opts.width || 1000, H = opts.height || 1000;
  const seed = opts.seed == null ? 1 : opts.seed;
  const t = opts.t || 0;
  const duration = opts.duration || 16 / 12;   // seconds per loop (frames / fps), for follow()

  const body = [];
  const defs = [];
  let idn = 0;
  let scope = 'root';
  const counters = { root: 0 };
  let M = [1, 0, 0, 1, 0, 0]; // affine: x' = a x + c y + e, y' = b x + d y + f
  let groupScale = 1;

  function rng() {
    counters[scope] = (counters[scope] || 0) + 1;
    return mulberry32(hashStr(seed + '|' + scope + '|' + counters[scope]));
  }
  // composition randomness (shape irregularity) must NOT change with the seed, or "different seed ⇒ same composition" breaks
  // keep it tied to call identity only
  function shapeRng() {
    counters[scope + '#s'] = (counters[scope + '#s'] || 0) + 1;
    return mulberry32(hashStr('shape|' + scope + '|' + counters[scope + '#s']));
  }
  const tx = (p) => [M[0] * p[0] + M[2] * p[1] + M[4], M[1] * p[0] + M[3] * p[1] + M[5]];
  const txAll = (P) => P.map(tx);

  /* -------------------- ink */

  function inkPoly(pts, w, r, o = {}) {
    let P = resample(pts, 2.5);
    let L = polyLen(P);
    if (L < 1.2) {
      const c = pts[0], rr = Math.max(w * 0.75, 1);
      return blobPath(c, rr, r);
    }
    const wob = o.wobble == null ? 1 : o.wobble;
    // overshoot both ends
    const os = o.overshoot == null ? 1 : o.overshoot;
    const k0 = Math.min(1, L / 40);
    const e0 = os * (0.5 + r() * 2.2) * k0, e1 = os * (0.8 + r() * 3.2) * k0;
    const a = P[0], a2 = P[Math.min(3, P.length - 1)];
    const z = P[P.length - 1], z2 = P[Math.max(0, P.length - 4)];
    const d0 = norm([a[0] - a2[0], a[1] - a2[1]]), d1 = norm([z[0] - z2[0], z[1] - z2[1]]);
    const pre = [], post = [];
    for (let e = e0; e > 0.5; e -= 2.5) pre.push([a[0] + d0[0] * e, a[1] + d0[1] * e]);
    for (let e = 2.5; e <= e1 + 0.01; e += 2.5) post.push([z[0] + d1[0] * e, z[1] + d1[1] * e]);
    P = pre.concat(P, post);
    // the hand: a damped spring chasing the points (rounds corners, runs on)
    const stiff = clamp((0.34 + 0.5 * (1 - Math.min(1, L / 120))) * (o.stiff || 1), 0.2, 0.92);
    const damp = 0.48;
    let px = P[0][0], py = P[0][1], vx = 0, vy = 0;
    const F = [[px, py]];
    for (let i = 1; i < P.length; i++) {
      vx = vx * damp + (P[i][0] - px) * stiff; vy = vy * damp + (P[i][1] - py) * stiff;
      px += vx; py += vy; F.push([px, py]);
    }
    for (let j = 0; j < 3; j++) {
      const q = P[P.length - 1];
      vx = vx * damp + (q[0] - px) * stiff; vy = vy * damp + (q[1] - py) * stiff;
      px += vx; py += vy; F.push([px, py]);
    }
    const S = resample(F, 2);
    const n = S.length;
    if (n < 2) return blobPath(pts[0], w, r);
    const s = [0];
    for (let i = 1; i < n; i++) s.push(s[i - 1] + dist(S[i - 1], S[i]));
    const T = s[n - 1] || 1;
    // wobble: slow bow + mid wobble + fine tremor
    const A1 = wob * (0.7 + r() * 1.5) * Math.min(1, T / 200), l1 = Math.max(240, T * (1 + r() * 1.5)), f1 = r() * TAU;
    const A2 = wob * (0.3 + r() * 0.35) * Math.min(1, T / 50), l2 = 45 + r() * 60, f2 = r() * TAU;
    const A3 = wob * 0.16, l3 = 9 + r() * 7, f3 = r() * TAU;
    const lw = 30 + r() * 50, fw = r() * TAU, fw2 = r() * TAU;
    const inLen = Math.min(7, T * 0.25), outLen = Math.min(26, T * 0.4);
    const L1 = [], R1 = [];
    let hw0 = 0, hwN = 0, t0 = [1, 0], tN = [1, 0];
    for (let i = 0; i < n; i++) {
      const pa = S[Math.max(0, i - 1)], pb = S[Math.min(n - 1, i + 1)];
      const tg = norm([pb[0] - pa[0], pb[1] - pa[1]]);
      const nm = [-tg[1], tg[0]];
      const si = s[i];
      const off = A1 * Math.sin((TAU * si) / l1 + f1) + A2 * Math.sin((TAU * si) / l2 + f2) + A3 * Math.sin((TAU * si) / l3 + f3);
      const pin = 0.45 + 0.55 * smooth(si / (inLen || 1));
      const swell = 1 + 0.2 * Math.exp(-si / (T * 0.15 + 6));
      const pout = 1 - 0.62 * smooth((si - (T - outLen)) / (outLen || 1));
      const noise = 1 + 0.12 * Math.sin((TAU * si) / lw + fw) + 0.06 * Math.sin((TAU * si) / (lw * 0.37) + fw2);
      const hw = (w / 2) * pin * swell * pout * noise * (o.pressure || 1);
      const cx = S[i][0] + nm[0] * off, cy = S[i][1] + nm[1] * off;
      L1.push([cx + nm[0] * hw, cy + nm[1] * hw]);
      R1.push([cx - nm[0] * hw, cy - nm[1] * hw]);
      if (i === 0) { hw0 = hw; t0 = tg; }
      if (i === n - 1) { hwN = hw; tN = tg; }
    }
    const c0 = [(L1[0][0] + R1[0][0]) / 2 - t0[0] * hw0 * 0.9, (L1[0][1] + R1[0][1]) / 2 - t0[1] * hw0 * 0.9];
    const cN = [(L1[n - 1][0] + R1[n - 1][0]) / 2 + tN[0] * hwN * 0.9, (L1[n - 1][1] + R1[n - 1][1]) / 2 + tN[1] * hwN * 0.9];
    const ring = simplify([c0, ...L1], 0.18).concat(simplify([cN, ...R1.reverse()], 0.18));
    return encodePath(ring, true);
  }
  function blobPath(c, rr, r) {
    const pts = [];
    const ph = r() * TAU;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const q = rr * (1 + 0.12 * Math.sin(a * 2 + ph));
      pts.push([c[0] + Math.cos(a) * q, c[1] + Math.sin(a) * q]);
    }
    return encodePath(pts, true);
  }
  // open a closed loop at a random point; overrun past the start (or stop just short)
  function openLoop(P, r) {
    const Q = resample(P.concat([P[0]]), 2.5);
    Q.pop();
    const n = Q.length;
    if (n < 3) return Q;
    const start = Math.floor(r() * n);
    const rot = Q.slice(start).concat(Q.slice(0, start));
    const per = polyLen(Q.concat([Q[0]]));
    const over = r() < 0.78 ? (3 + r() * 9) * Math.min(1, per / 120) : -(0.5 + r() * 2.5);
    if (over > 0) {
      let acc = 0, i = 0;
      rot.push(rot[0]);
      while (acc < over && i < n - 1) { acc += 2.5; rot.push(rot[(i + 1) % n]); i++; }
    } else {
      let drop = Math.round(-over / 2.5);
      while (drop-- > 0 && rot.length > 4) rot.pop();
      rot.push(rot[0]);
      rot.pop();
    }
    return rot;
  }
  function weightOf(wt) { return typeof wt === 'number' ? wt : WEIGHTS[wt || 'outline'] || WEIGHTS.outline; }
  function emitInk(sheetPts, closed, o = {}) {
    const r = rng();
    const w = weightOf(o.weight);
    const pts = closed ? openLoop(sheetPts, r) : sheetPts;
    const d = inkPoly(pts, w, r, { overshoot: closed ? 0.35 : o.overshoot, wobble: o.wobble, stiff: o.stiff, pressure: o.pressure });
    body.push(`<path d="${d}" fill="${inkColor(o.ink)}"${o.opacity != null ? ` opacity="${o.opacity}"` : ''}/>`);
  }

  /* -------------------- wash */

  // flat marker colour (no texture): the hand-made feel comes from the uneven, off-register edge
  function patternFor(color) { return soften(color); }
  function washPoly(sheetPts, r, o = {}) {
    // gentle wobble, inset that comes and goes (paper shows at the edge), whole thing off-register
    let P = resample(sheetPts.concat([sheetPts[0]]), 4);
    P.pop();
    if (P.length < 3) P = sheetPts;
    const area = Math.abs(signedArea(P));
    const size = Math.sqrt(area);
    const sgn = signedArea(P) > 0 ? 1 : -1;
    const k = Math.min(1, size / 60);
    const reg = o.register == null ? 1 : o.register;
    const ang = r() * TAU, mag = (1.1 + r() * 0.9) * k * reg;
    const dx = Math.cos(ang) * mag, dy = Math.sin(ang) * mag;
    const per = polyLen(P.concat([P[0]]));
    const l1 = 60 + r() * 90, f1 = r() * TAU, f2 = r() * TAU;
    const n = P.length;
    const out = [];
    let s = 0;
    for (let i = 0; i < n; i++) {
      const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
      const tg = norm([b[0] - a[0], b[1] - a[1]]);
      const nm = [tg[1] * sgn, -tg[0] * sgn]; // inward
      if (i > 0) s += dist(P[i - 1], P[i]);
      const inset = k * (0.9 + 1.3 * Math.sin((TAU * s) / l1 + f1) + 0.4 * Math.sin((TAU * s) / (l1 * 0.31) + f2)) * (o.inset == null ? 1 : o.inset);
      out.push([P[i][0] + nm[0] * inset + dx, P[i][1] + nm[1] * inset + dy]);
    }
    return out;
  }
  const pathD = (P, close = true) => encodePath(P, close);

  /* -------------------- shapes */

  function mkShape(pts, closed = true, extra = {}) {
    const s = { pts, closed, ...extra };
    s.bbox = bboxOf(pts);
    return s;
  }
  const geo = {
    poly: (points) => mkShape(points.map((p) => [p[0], p[1]]), true),
    path: (points) => mkShape(points.map((p) => [p[0], p[1]]), false),
    spline: (points, closed = false) => mkShape(catmull(points, closed), closed),
    ellipse(cx, cy, rx, ry = rx, o = {}) {
      const r = shapeRng();
      const per = TAU * Math.sqrt((rx * rx + ry * ry) / 2);
      const n = Math.max(18, Math.ceil(per / 3));
      const irr = o.irregular == null ? 0.025 : o.irregular;
      const ph = r() * TAU, ph2 = r() * TAU;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const q = 1 + irr * (Math.sin(a * 2 + ph) + 0.5 * Math.sin(a * 3 + ph2));
        pts.push([cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q]);
      }
      return mkShape(pts, true, { cx, cy, rx, ry });
    },
    circle: (cx, cy, r, o) => geo.ellipse(cx, cy, r, r, o),
    rect: (x, y, w, h) => mkShape([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true),
    roundRect(x, y, w, h, rad = Math.min(w, h) * 0.15) {
      rad = Math.min(rad, w / 2, h / 2);
      const pts = [];
      const corner = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const a = ((a0 + i * 15) * Math.PI) / 180; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); } };
      corner(x + w - rad, y + rad, -90); corner(x + w - rad, y + h - rad, 0); corner(x + rad, y + h - rad, 90); corner(x + rad, y + rad, 180);
      return mkShape(pts, true);
    },
    blob(cx, cy, r, o = {}) {
      const rnd = shapeRng();
      const rx = o.rx || r, ry = o.ry || r * (o.squash || 1);
      const bumps = o.bumps || 0, bump = o.bump == null ? 0.12 : o.bump;
      const irr = o.irregular == null ? 0.05 : o.irregular;
      const ph = rnd() * TAU, ph2 = rnd() * TAU, rot = o.bumps ? rnd() * TAU : 0;
      const per = TAU * Math.max(rx, ry);
      const n = Math.max(24, Math.ceil(per / 2.5));
      const pts = [];
      const bv = [];
      for (let i = 0; i < bumps; i++) bv.push(0.75 + rnd() * 0.5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        let q = 1 + irr * (Math.sin(a * 2 + ph) * 0.7 + Math.sin(a * 3 + ph2) * 0.5);
        if (bumps) {
          const u = ((a + rot) / TAU) * bumps;
          const j = Math.floor(u) % bumps;
          q += bump * bv[(j + bumps) % bumps] * (Math.abs(Math.sin(Math.PI * u)) - 0.64);
        }
        pts.push([cx + Math.cos(a) * rx * q, cy + Math.sin(a) * ry * q]);
      }
      return mkShape(pts, true, { cx, cy, rx, ry });
    },
    arc(cx, cy, rx, ry, a0, a1) {
      if (a1 === undefined) { a1 = a0; a0 = ry; ry = rx; }
      const span = Math.abs(a1 - a0);
      const n = Math.max(6, Math.ceil(((span / 360) * TAU * Math.max(rx, ry)) / 3));
      const pts = [];
      for (let i = 0; i <= n; i++) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
      return mkShape(pts, false);
    },
    // a tube along a centreline: handles, stems, tails, arms, branches. width number or [start, end]
    tube(points, width, o = {}) {
      const C = resample(catmull(points, false), 2);
      const n = C.length;
      const [w0, w1] = Array.isArray(width) ? width : [width, width];
      const Ls = [], Rs = [];
      const S = polyLen(C);
      let s = 0;
      for (let i = 0; i < n; i++) {
        if (i) s += dist(C[i - 1], C[i]);
        const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)];
        const tg = norm([b[0] - a[0], b[1] - a[1]]);
        const hw = lerp(w0, w1, S ? s / S : 0) / 2;
        Ls.push([C[i][0] - tg[1] * hw, C[i][1] + tg[0] * hw]);
        Rs.push([C[i][0] + tg[1] * hw, C[i][1] - tg[0] * hw]);
      }
      const cap = (c, from, hw, tgSign, tg) => {
        const out = [];
        const ang = Math.atan2(from[1] - c[1], from[0] - c[0]);
        for (let j = 1; j < 8; j++) { const a = ang + (tgSign * Math.PI * j) / 8; out.push([c[0] + Math.cos(a) * hw, c[1] + Math.sin(a) * hw]); }
        return out;
      };
      const round = o.cap !== 'flat';
      const pts = [...Ls];
      if (round) pts.push(...cap(C[n - 1], Ls[n - 1], w1 / 2, -1));
      pts.push(...Rs.reverse());
      if (round) pts.push(...cap(C[0], Rs[Rs.length - 1], w0 / 2, -1));
      return mkShape(pts, true, { centre: C });
    },
  };

  /* -------------------- drawing */

  function shapeOf(x) { return x && x.pts ? x : null; }

  function fill(shape, color, o = {}) {
    shape = shapeOf(shape);
    if (!shape || !color) return;
    const r = rng();
    const P = washPoly(txAll(shape.pts), r, o);
    body.push(`<path d="${pathD(P)}" fill="${patternFor(color)}"${o.opacity != null ? ` opacity="${o.opacity}"` : ''}/>`);
    return P;
  }
  function ink(shape, o = {}) {
    shape = shapeOf(shape);
    if (!shape) return;
    emitInk(txAll(shape.pts), o.closed == null ? shape.closed : o.closed, o);
  }
  // the region of the shape facing away from the light (bottom-right crescent), as a translated copy to subtract
  function shadeOffset(sheetPts, amount) {
    const bb = bboxOf(sheetPts);
    const d = Math.min(bb.w, bb.h) * (amount == null ? 0.2 : amount);
    return [LIGHT[0] * d, LIGHT[1] * d];
  }
  function shade(shape, color, o = {}) {
    shape = shapeOf(shape);
    if (!shape || !color) return;
    const r = rng();
    const base = o.clip || washPoly(txAll(shape.pts), r, { register: 0.5, inset: 0.6 });
    const off = o.offset || shadeOffset(base, o.amount);
    const moved = washPoly(base.map((p) => [p[0] + off[0], p[1] + off[1]]), r, { register: 0.3, inset: -1.2 });
    const id = (opts.idPrefix || '') + 'c' + ++idn;
    defs.push(`<clipPath id="${id}"><path d="${pathD(base)}"/></clipPath>`);
    body.push(`<path clip-path="url(#${id})" fill-rule="evenodd" d="${pathD(base)}${pathD(moved.slice().reverse())}" fill="${patternFor(o.raw ? color : darker(color, o.depth))}"/>`);
  }
  function hatch(shape, o = {}) {
    shape = shapeOf(shape);
    if (!shape) return;
    const r = rng();
    const P = txAll(shape.pts);
    const ang = ((o.angle == null ? -45 : o.angle) * Math.PI) / 180; // -45: lines rise to the right "/"
    const d = [Math.cos(ang), Math.sin(ang)];
    const nrm = [-d[1], d[0]];
    const gap = o.spacing || 7;
    const bb = bboxOf(P);
    const c = [bb.cx, bb.cy];
    const R = Math.hypot(bb.w, bb.h) / 2 + 2;
    const region = o.region || 'shade';
    let sub = null;
    if (region === 'shade') { const off = o.offset || shadeOffset(P, o.amount); sub = P.map((p) => [p[0] + off[0], p[1] + off[1]]); }
    const inset = o.inset == null ? 2.5 : o.inset;
    const w = weightOf(o.weight || 'hatch');
    const ds = [];
    for (let k = -R; k <= R; k += gap) {
      const kk = k + (r() - 0.5) * gap * 0.35;
      const o0 = [c[0] + nrm[0] * kk, c[1] + nrm[1] * kk];
      let iv = lineIntervals(P, o0, d);
      if (sub) iv = subtractIntervals(iv, lineIntervals(sub, o0, d));
      for (const [a0, a1] of iv) {
        const s0 = a0 + inset + r() * 2.5, s1 = a1 - inset - r() * 3;
        if (s1 - s0 < 3) continue;
        const pts = [[o0[0] + d[0] * s0, o0[1] + d[1] * s0], [o0[0] + d[0] * s1, o0[1] + d[1] * s1]];
        const rr = rng();
        ds.push(inkPoly(pts, w, rr, { overshoot: 0.2, wobble: 0.5, stiff: 1.5 }));
      }
    }
    if (ds.length) body.push(`<path d="${ds.join('')}" fill="${inkColor(o.ink)}"${o.opacity != null ? ` opacity="${o.opacity}"` : ` opacity="0.85"`}/>`);
  }

  /** Draw a shape: wash (+ shaded side) (+ hatching) then ink. */
  function draw(shape, o = {}) {
    shape = shapeOf(shape);
    if (!shape) return shape;
    if (shape.closed && o.fill) {
      const P = fill(shape, o.fill, o);
      if (o.shade) shade(shape, o.fill, { clip: P, amount: typeof o.shade === 'number' ? o.shade : undefined, depth: o.shadeDepth });
    }
    if (o.hatch) hatch(shape, typeof o.hatch === 'object' ? o.hatch : {});
    if (o.ink !== false) ink(shape, o);
    return shape;
  }

  /* -------------------- text */

  function textWidth(str, size = 22, o = {}) {
    const u = size / 10, tr = o.tracking == null ? 0.7 : o.tracking;
    let w = 0;
    for (const ch of str.normalize('NFD')) {
      const cp = ch.codePointAt(0);
      if (MARKS[cp]) continue;
      const g = glyph(ch) || glyph('?');
      w += (g.w + tr) * u;
    }
    return Math.max(0, w - tr * u);
  }
  function text(str, x, y, o = {}) {
    const size = o.size || 22, u = size / 10;
    const lh = (o.lineHeight || 1.45) * size;
    const lines = String(str).split('\n');
    const w = weightOf(o.weight || Math.max(1.0, 0.55 + size * 0.036));
    const color = inkColor(o.ink);
    const tr = o.tracking == null ? 0.7 : o.tracking;
    const r = rng();
    const ds = [];
    let maxW = 0;
    lines.forEach((line, li) => {
      const lw = textWidth(line, size, o);
      maxW = Math.max(maxW, lw);
      let cx = o.align === 'right' ? x - lw : o.align === 'center' ? x - lw / 2 : x;
      const by = y + li * lh;
      const chars = [...line.normalize('NFD')];
      for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        let g = glyph(ch);
        const marks = [];
        while (i + 1 < chars.length && MARKS[chars[i + 1].codePointAt(0)]) marks.push(chars[++i].codePointAt(0));
        if (!g) g = glyph('?');
        if (marks.length && (ch === 'i' || ch === 'j') && marks.some((m) => MARKS[m].pos === 'above')) g = glyph('ı');
        const jy = (r() - 0.5) * 0.35, rot = (r() - 0.5) * 0.06;
        const cosr = Math.cos(rot), sinr = Math.sin(rot);
        const ox = cx, oy = by;
        const place = (p) => { const X = p[0], Y = p[1] + jy; return tx([ox + (X * cosr - Y * sinr) * u, oy + (X * sinr + Y * cosr) * u]); };
        const strokes = g.strokes.slice();
        // marks
        const upper = ch !== ch.toLowerCase();
        let top = upper ? -7 : ch === 'ı' || 'aceimnorsuvwxzy'.includes(ch) ? -5 : -7.4;
        const mx = MARK_X[ch] != null ? MARK_X[ch] : (g.w - 0.6) / 2;
        let stacked = 0;
        for (const m of marks) {
          const mk = MARKS[m];
          if (mk.pos === 'horn') {
            const at = HORN_AT[ch] || [g.w - 0.6, top + 0.6];
            strokes.push(...parseStrokes(HORN_D).map((s) => ({ kind: s.kind, pts: s.pts.map((p) => [p[0] + at[0], p[1] + at[1]]) })));
            continue;
          }
          if (mk.pos === 'below') {
            strokes.push(...parseStrokes(mk.d).map((s) => ({ kind: s.kind, pts: s.pts.map((p) => [p[0] + mx, p[1] + 0.9]) })));
            continue;
          }
          const gap = upper ? 0.9 : 1.1;
          const baseY = top - gap;
          const dx = stacked ? mk.dx + 0.6 : 0;
          strokes.push(...parseStrokes(mk.d).map((s) => ({ kind: s.kind, pts: s.pts.map((p) => [p[0] + mx + dx, p[1] + baseY]) })));
          top = baseY - mk.h + 0.2;
          stacked++;
        }
        for (const s of strokes) {
          if (s.kind === 'D') { const c = place(s.pts[0]); ds.push(blobPath(c, w * 0.85, r)); continue; }
          const pts = s.kind === 'C' ? catmull(s.pts, false, 0.3) : s.pts;
          ds.push(inkPoly(pts.map(place), w, rng(), { overshoot: 0.25, wobble: 0.22, stiff: 2.2, pressure: 1 }));
        }
        cx += (g.w + tr) * u;
      }
    });
    if (ds.length) body.push(`<path d="${ds.join('')}" fill="${color}"/>`);
    const capH = 0.7 * size;
    const x0 = o.align === 'right' ? x - maxW : o.align === 'center' ? x - maxW / 2 : x;
    return { x: x0, y: y - capH, w: maxW, h: capH + (lines.length - 1) * lh + 0.26 * size };
  }
  function title(str, o = {}) {
    const x = o.x == null ? 60 : o.x, y = o.y == null ? 96 : o.y;
    const size = o.size || 50;
    const b = text(str, x, y, { size, tracking: 0.35, weight: o.weight });
    if (o.sub) text(o.sub, x + 2, y + size * 0.62, { size: o.subSize || 21, tracking: 1.0 });
    return b;
  }
  /** Margin note with a hand-drawn leader line to a point on the drawing. */
  function label(str, o = {}) {
    const size = o.size || 21;
    const b = text(str, o.x, o.y, { size, align: o.align, tracking: o.tracking == null ? 0.9 : o.tracking });
    if (o.to) {
      const T = o.to;
      const cands = [
        [b.x - 9, b.y + b.h * 0.42], [b.x + b.w + 9, b.y + b.h * 0.42],
        [b.x + b.w / 2, b.y + b.h + 8], [b.x + b.w / 2, b.y - 9],
      ];
      let best = cands[0], bd = Infinity;
      for (const c of cands) { const d = dist(c, T); if (d < bd) { bd = d; best = c; } }
      const L = dist(best, T);
      const nx = -(T[1] - best[1]) / L, ny = (T[0] - best[0]) / L;
      const bend = (o.bend == null ? 0.1 : o.bend) * L;
      const mid = [(best[0] + T[0]) / 2 + nx * bend, (best[1] + T[1]) / 2 + ny * bend];
      const end = [T[0] - ((T[0] - mid[0]) / dist(mid, T)) * 5, T[1] - ((T[1] - mid[1]) / dist(mid, T)) * 5];
      const pts = catmull([best, mid, end], false);
      emitInk(txAll(pts), false, { weight: 'fine', overshoot: 0.3 });
      const r = rng();
      body.push(`<path d="${blobPath(tx(T), 2.6, r)}" fill="${PALETTE.ink}"/>`);
    }
    return b;
  }

  /** Give a part its own random stream, so editing one part does not re-roll the wobble of every later part. */
  function scoped(name, fn) {
    const prev = scope;
    scope = prev + '/' + name;
    try { return fn(); } finally { scope = prev; }
  }

  /* ================================================================ 3D
   * World: x right, y back (away from the viewer at yaw 0), z up. Ground is z = 0. Units are free: the
   * picture is framed automatically (render.mjs measures every frame first, so moving parts don't make
   * the framing jump). Every solid is a mesh of flat faces; each face gets one of three flat tones from
   * the way it meets the light, neighbouring faces with the same tone merge into one marker wash, and the
   * ink follows the silhouette (heavy) and the sharp creases (lighter). Solids are sorted back to front
   * against each other; there is no depth buffer, so parts are kept as separate convex-ish solids.
   */
  const cam = { yaw: 45, pitch: ISO_PITCH, ...(opts.camera || {}) };
  let CB = camBasis(cam.yaw, cam.pitch);
  const view = opts.view || { scale: 1, ox: 0, oy: 0 };
  const proj = (p) => [view.ox + view.scale * dot3(p, CB.R), view.oy - view.scale * dot3(p, CB.U)];
  const depthOf = (p) => dot3(p, CB.V);
  const lightW = () => unit3(add3(add3(mul3(CB.R, LIGHT_CAM[0]), mul3(CB.U, LIGHT_CAM[1])), mul3(CB.V, LIGHT_CAM[2])));

  const items = [];     // solids and 3D lines, sorted at the end
  const overlays = [];  // labels and steam, drawn on top in call order
  let xf = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }; // current 3D transform (group)
  const applyXf = (p, X = xf) => {
    const m = X.m;
    return [m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + X.t[0], m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + X.t[1], m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + X.t[2]];
  };

  function group3(o, fn) {
    const prev = xf;
    const about = o.about || [0, 0, 0], at = o.at || [0, 0, 0];
    const s = o.scale == null ? [1, 1, 1] : typeof o.scale === 'number' ? [o.scale, o.scale, o.scale] : o.scale;
    const R = rotMatrix(o.rotate);
    // local: p -> at + about + R · (s ⊙ (p - about))
    const Lm = [R[0] * s[0], R[1] * s[1], R[2] * s[2], R[3] * s[0], R[4] * s[1], R[5] * s[2], R[6] * s[0], R[7] * s[1], R[8] * s[2]];
    const Rab = [Lm[0] * about[0] + Lm[1] * about[1] + Lm[2] * about[2], Lm[3] * about[0] + Lm[4] * about[1] + Lm[5] * about[2], Lm[6] * about[0] + Lm[7] * about[1] + Lm[8] * about[2]];
    const Lt = [at[0] + about[0] - Rab[0], at[1] + about[1] - Rab[1], at[2] + about[2] - Rab[2]];
    const pm = prev.m;
    const m = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m.push(pm[r * 3] * Lm[c] + pm[r * 3 + 1] * Lm[3 + c] + pm[r * 3 + 2] * Lm[6 + c]);
    xf = { m, t: applyXf(Lt, prev) };
    try { return fn(); } finally { xf = prev; }
  }

  /* ---- meshes */

  // V: local points, F: faces as index lists (counter-clockwise seen from outside). Returns a handle.
  function addMesh(V, F, o = {}, kind = 'solid', tags = null) {
    const local = o.rotate || o.scale ? (fn) => group3({ about: o.pivot || o.at || [0, 0, 0], rotate: o.rotate, scale: o.scale }, fn) : (fn) => fn();
    return local(() => {
      const W = V.map((p) => applyXf(p));
      let ftags = tags || F.map(() => 0);
      let faces = F.map((f) => dedupeRing(f));
      ftags = ftags.filter((_, i) => faces[i].length >= 3);
      faces = faces.filter((f) => f.length >= 3);
      const edges = new Map();
      faces.forEach((f, fi) => f.forEach((a, i) => {
        const b = f[(i + 1) % f.length], key = a < b ? a + ',' + b : b + ',' + a;
        if (!edges.has(key)) edges.set(key, []);
        edges.get(key).push(fi);
      }));
      let closed = true;
      for (const l of edges.values()) if (l.length !== 2) { closed = false; break; }
      if (closed && o.open !== true) {
        // make every face point outward (signed volume must be positive)
        let vol = 0;
        for (const f of faces) for (let i = 1; i + 1 < f.length; i++) vol += dot3(W[f[0]], cross3(W[f[i]], W[f[i + 1]]));
        if (vol < 0) faces = faces.map((f) => f.slice().reverse());
      }
      const bb = bbox3(W);
      const item = {
        kind, name: o.name || kind, V: W, F: faces, tags: ftags, edges, closed: (closed && o.open !== true) || !!o.single, o,
        bb, layer: o.layer || 0, children: [], scope: scope + '/' + (o.name || kind) + '#' + items.length,
      };
      if (o.in && o.in._item) { item.contents = true; o.in._item.children.push(item); }
      else if (o.on && o.on._item) o.on._item.children.push(item); else items.push(item);
      return { _item: item, box: bb, top: bb.max[2], bottom: bb.min[2], center: [(bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2, (bb.min[2] + bb.max[2]) / 2] };
    });
  }

  // a surface of revolution around the local z axis. profile [[r, z], ...] bottom to top
  function latheMesh(profile, o = {}) {
    const n = o.segments || 40;
    const V = [], F = [], rings = [], ringOf = [];
    for (const [r, z] of profile) {
      if (r <= 1e-9) { rings.push([V.length]); V.push([0, 0, z]); continue; }
      const ring = [];
      for (let j = 0; j < n; j++) { const a = (j / n) * TAU; ring.push(V.length); V.push([r * Math.cos(a), r * Math.sin(a), z]); }
      rings.push(ring);
    }
    const at = (ring, j) => ring[ring.length === 1 ? 0 : ((j % n) + n) % n];
    for (let i = 0; i + 1 < rings.length; i++) {
      for (let j = 0; j < n; j++) { F.push([at(rings[i], j), at(rings[i], j + 1), at(rings[i + 1], j + 1), at(rings[i + 1], j)]); ringOf.push(i + 1); }
    }
    const first = rings[0], last = rings[rings.length - 1];
    if (first.length > 1 && o.bottom !== false) { F.push(first.slice().reverse()); ringOf.push(0); }
    if (last.length > 1 && o.top !== false) { F.push(last.slice()); ringOf.push(rings.length); }
    return { V, F, ringOf };
  }
  // straight prism: polygon [[u, v], ...] in the local x-y plane, from z0 to z1
  function prismMesh(poly, z0, z1) {
    if (signedArea(poly) < 0) poly = poly.slice().reverse();
    const n = poly.length, V = [], F = [];
    for (const [u, v] of poly) V.push([u, v, z0]);
    for (const [u, v] of poly) V.push([u, v, z1]);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; F.push([i, j, n + j, n + i]); }
    F.push(Array.from({ length: n }, (_, i) => n - 1 - i));
    F.push(Array.from({ length: n }, (_, i) => n + i));
    return { V, F };
  }
  const AXIS = {
    z: (p) => p,
    x: (p) => [p[2], p[1], -p[0]],  // local z → world +x
    y: (p) => [p[0], p[2], -p[1]],  // local z → world +y
    '-z': (p) => [p[0], -p[1], -p[2]],
    '-x': (p) => [-p[2], p[1], p[0]],
    '-y': (p) => [p[0], -p[2], p[1]],
  };
  const place = (V, at = [0, 0, 0], axis = 'z') => V.map((p) => add3(AXIS[axis](p), at));

  function tubeMesh(C, radii, o) {
      const n = o.segments || 14;
      const V = [], F = [];
      let normal = null;
      for (let i = 0; i < C.length; i++) {
        const tg = unit3(sub3(C[Math.min(C.length - 1, i + 1)], C[Math.max(0, i - 1)]));
        if (!normal) { const up = Math.abs(tg[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; normal = unit3(cross3(cross3(tg, up), tg)); }
        else normal = unit3(sub3(normal, mul3(tg, dot3(normal, tg)))); // parallel transport
        const bi = cross3(tg, normal);
        const rr = radii[i];
        for (let j = 0; j < n; j++) {
          const a = (j / n) * TAU;
          V.push(add3(C[i], add3(mul3(normal, Math.cos(a) * rr), mul3(bi, Math.sin(a) * rr))));
        }
      }
      for (let i = 0; i + 1 < C.length; i++) for (let j = 0; j < n; j++) {
        const a = i * n + j, b = i * n + ((j + 1) % n);
        F.push([a, a + n, b + n, b]);
      }
      if (o.caps !== false) {
        F.push(Array.from({ length: n }, (_, j) => j));
        F.push(Array.from({ length: n }, (_, j) => (C.length - 1) * n + (n - 1 - j)));
      }
      return addMesh(V, F, { crease: 50, ...o, open: o.caps === false ? true : o.open }, 'tube');
    }

  /* ---- render one solid into sheet SVG strings */

  function weightFor(item) {
    if (item.o.weight) return [item.o.weight, item.o.creaseWeight || 'fine'];
    const P = item.V.map(proj), b = bboxOf(P), d = Math.hypot(b.w, b.h);
    if (d > 170) return ['outline', 'detail'];
    if (d > 70) return ['detail', 'fine'];
    return ['fine', 0.9];
  }

  function renderSolid(item, out) {
    scopedRender(item.scope, () => {
      const o = item.o;
      const P = item.V.map(proj);
      const Lw = lightW();
      const base = o.fill || 'stone';
      const tones = o.flat ? [soften(base), soften(base), soften(base)]
        : [lighter(base, o.light == null ? 0.05 : o.light), soften(base), darker(base, o.dark == null ? 0.1 : o.dark)];
      const ins = o.inside || base;
      const insideTones = o.inside ? [soften(ins), darker(ins, 0.06), darker(ins, 0.13)] : [darker(ins, 0.07), darker(ins, 0.12), darker(ins, 0.17)];
      const cosCrease = Math.cos(((o.crease == null ? 32 : o.crease) * Math.PI) / 180);
      const singleSided = item.closed;
      const faces = item.F.map((f, fi) => {
        const pts = f.map((i) => item.V[i]);
        const n = newell(pts);
        const c = avg3(pts);
        const facing = dot3(n, CB.V);
        let vis, side = 1, nn = n;
        if (singleSided) vis = facing > 1e-6;
        else { vis = Math.abs(facing) > 1e-6; if (facing < 0) { side = -1; nn = mul3(n, -1); } }
        const d = dot3(nn, Lw);
        const tone = d > 0.62 ? 0 : d > -0.12 ? 1 : 2;
        const inner = item.tags[fi] === 1 || (side < 0 && !singleSided);
        return { f, n, nn, c, vis, side, tone, inner, depth: depthOf(c) };
      });
      // regions: neighbouring visible faces, same side and tone, meeting smoothly
      const parent = faces.map((_, i) => i);
      const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
      const smoothAt = (a, b) => dot3(a.n, b.n) * (a.side * b.side) > cosCrease;
      for (const l of item.edges.values()) {
        if (l.length !== 2) continue;
        const [a, b] = l.map((i) => faces[i]);
        if (a.vis && b.vis && a.side === b.side && a.tone === b.tone && a.inner === b.inner && smoothAt(a, b)) parent[find(l[0])] = find(l[1]);
      }
      const regions = new Map();
      faces.forEach((fc, i) => {
        if (!fc.vis) return;
        const r = find(i);
        if (!regions.has(r)) regions.set(r, { faces: [], depth: 0, ink: [] });
        regions.get(r).faces.push(i);
      });
      const list = [...regions.values()];
      for (const rg of list) rg.depth = rg.faces.reduce((s, i) => s + faces[i].depth, 0) / rg.faces.length;
      list.sort((a, b) => a.depth - b.depth);
      // a container with contents (coffee in a mug, bread in a slot): its inside first, then the contents, then the rest
      const contents = item.children.filter((c) => c.contents);
      if (contents.length) {
        const inner = list.filter((rg) => faces[rg.faces[0]].inner), outer = list.filter((rg) => !faces[rg.faces[0]].inner);
        list.length = 0; list.push(...inner, ...outer);
        list.innerCount = inner.length;
      }
      list.forEach((rg, k) => { rg.order = k; for (const i of rg.faces) faces[i].region = rg; });
      // ink edges, each owned by the nearest region it touches
      const [wSil, wCrease] = weightFor(item);
      for (const [key, l] of item.edges) {
        const vf = l.filter((i) => faces[i].vis);
        if (!vf.length) continue;
        let kind = null;
        if (l.length === 1) kind = 'sil';
        else if (l.length === 2) {
          const [a, b] = l.map((i) => faces[i]);
          if (vf.length === 1) kind = 'sil';
          else if (a.side !== b.side) kind = 'sil';
          else if (!smoothAt(a, b)) kind = 'crease';
        } else kind = 'crease';
        if (!kind) continue;
        let owner = faces[vf[0]].region;
        for (const i of vf) if (faces[i].region.order > owner.order) owner = faces[i].region;
        const [a, b] = key.split(',').map(Number);
        owner.ink.push([a, b, kind]);
      }
      // tone bands on a curved surface follow the facets in steps: smooth the band edges (only where two
      // neighbouring visible faces meet smoothly; silhouette and crease points stay put)
      const PF = P.map((p) => p.slice());
      {
        const fixed = new Set(), nb = new Map();
        for (const rg of list) for (const [a, b] of rg.ink) { fixed.add(a); fixed.add(b); }
        for (const [key, l] of item.edges) {
          if (l.length !== 2) continue;
          const [fa, fb] = l.map((i) => faces[i]);
          if (!fa.vis || !fb.vis || fa.region === fb.region || fa.side !== fb.side || !smoothAt(fa, fb)) continue;
          const [a, b] = key.split(',').map(Number);
          for (const [u, v] of [[a, b], [b, a]]) { if (!nb.has(u)) nb.set(u, []); nb.get(u).push(v); }
        }
        const free = [...nb.keys()].filter((v) => nb.get(v).length === 2 && !fixed.has(v));
        for (let it = 0; it < 10; it++) {
          const nx = free.map((v) => { const [a, b] = nb.get(v); return [(PF[a][0] + PF[b][0]) / 2, (PF[a][1] + PF[b][1]) / 2]; });
          free.forEach((v, i) => { PF[v] = [(PF[v][0] + nx[i][0]) / 2, (PF[v][1] + nx[i][1]) / 2]; });
        }
      }
      const inkOn = o.ink !== false;
      list.forEach((rg, ri) => {
        if (contents.length && ri === list.innerCount) for (const c of contents) renderItem(c, out);
        const f0 = faces[rg.faces[0]];
        const color = f0.inner ? insideTones[f0.tone] : tones[f0.tone];
        // one path per region; a ring-shaped region (a rim) has a hole, so all its loops go in one even-odd path
        const loops = regionLoops(rg.faces.map((i) => faces[i].f)).map((l) => l.map((i) => PF[i]))
          .filter((l) => l.length >= 3 && Math.abs(signedArea(l)) >= 0.5);
        if (loops.length) {
          const r = rng();
          const ang = r() * TAU, mag = 0.9 * r();
          const ds = loops.map((l) => pathD(simplify(washPoly(l, r, { inset: 0.35, register: 0 }), 0.15).map((p) => [p[0] + Math.cos(ang) * mag, p[1] + Math.sin(ang) * mag])));
          out.push(`<path d="${ds.join('')}" fill="${color}"${loops.length > 1 ? ' fill-rule="evenodd"' : ''}/>`);
          if (o.hatch && f0.tone === 2) for (const l of loops) hatchInto(l, typeof o.hatch === 'object' ? o.hatch : {}, out);
        }
        if (!inkOn) return;
        for (const [kind, w] of [['sil', wSil], ['crease', wCrease]]) {
          const E = rg.ink.filter((e) => e[2] === kind);
          if (!E.length || (kind === 'crease' && o.creases === false)) continue;
          for (const chain of chainEdges(E, P)) inkInto(chain.map((i) => P[i]), false, { weight: w, ink: o.inkColor }, out);
        }
      });
      if (contents.length && list.innerCount === list.length) for (const c of contents) renderItem(c, out);
      renderShadowsOn(item, out);
      for (const ch of item.children) if (!ch.contents) renderItem(ch, out);
    });
  }

  function renderLine(item, out) {
    scopedRender(item.scope, () => {
      if (item.normal && dot3(item.normal, CB.V) <= 0) return;
      inkInto(item.pts.map(proj), !!item.o.closed, { weight: item.o.weight || 'detail', ink: item.o.ink }, out);
    });
  }
  const renderItem = (it, out) => (it.kind === 'line' ? renderLine(it, out) : renderSolid(it, out));

  function scopedRender(name, fn) { const prev = scope; scope = name; try { fn(); } finally { scope = prev; } }
  function inkInto(sheetPts, closed, o, out) {
    const save = body.length;
    emitInk(sheetPts, closed, o);
    out.push(...body.splice(save));
  }
  function hatchInto(sheetPts, o, out) {
    const save = body.length;
    hatch({ pts: sheetPts, closed: true }, { region: 'all', spacing: 8, ...o });
    out.push(...body.splice(save));
  }

  /* ---- ground shadows */
  function shadowOf(item, zOn) {
    if (item.o.shadow === false || item.kind === 'line') return null;
    const Lw = lightW();
    const hz = Math.hypot(Lw[0], Lw[1]) || 1;
    const dir = [-Lw[0] / hz, -Lw[1] / hz];
    const z0 = zOn != null ? zOn : typeof item.o.shadow === 'object' && item.o.shadow.z != null ? item.o.shadow.z : 0;
    const k0 = typeof item.o.shadow === 'object' && item.o.shadow.length != null ? item.o.shadow.length : 0.4;
    const pts = item.V.map((p) => { const h = Math.max(0, p[2] - z0); return proj([p[0] + dir[0] * h * k0, p[1] + dir[1] * h * k0, z0]); });
    return hull2(pts);
  }

  // the solid this one stands on (its top meets this one's bottom, footprints overlap), if any
  function supportOf(it) {
    if (it.kind === 'line' || it.bb.min[2] < 0.5 || (typeof it.o.shadow === 'object' && it.o.shadow.z != null)) return null;
    let best = null;
    for (const s of items) {
      if (s === it || s.kind === 'line') continue;
      const tol = 1 + 0.03 * Math.max(s.bb.max[2] - s.bb.min[2], it.bb.max[2] - it.bb.min[2]) + 0.08 * (it.bb.max[2] - it.bb.min[2]); // a rocking thing dips a little
      if (Math.abs(s.bb.max[2] - it.bb.min[2]) > tol) continue;
      if (s.bb.min[0] >= it.bb.max[0] || it.bb.min[0] >= s.bb.max[0] || s.bb.min[1] >= it.bb.max[1] || it.bb.min[1] >= s.bb.max[1]) continue;
      const area = (s.bb.max[0] - s.bb.min[0]) * (s.bb.max[1] - s.bb.min[1]);
      if (area < 0.3 * (it.bb.max[0] - it.bb.min[0]) * (it.bb.max[1] - it.bb.min[1])) continue; // a foot doesn't carry the shadow
      if (!best || area > best.area) best = { s, area };
    }
    return best && best.s;
  }
  function renderShadowsOn(sup, out) {
    if (!sup.shadowsOn || !sup.shadowsOn.length) return;
    scopedRender(sup.scope + '/shadows', () => {
      const top = sup.bb.max[2], tolZ = 0.5 + 0.15 * (top - sup.bb.min[2]); // the upper band (a dome's top is only a point)
      const clip = hull2(sup.V.filter((p) => p[2] >= top - tolZ).map(proj));
      const id = (opts.idPrefix || '') + 'sh' + ++idn;
      defs.push(`<clipPath id="${id}"><path d="${pathD(clip)}"/></clipPath>`);
      const ds = sup.shadowsOn.map((h) => pathD(washPoly(h, rng(), { inset: 0.3, register: 0.4 }))).join('');
      out.push(`<path clip-path="url(#${id})" d="${ds}" fill="${soften('shadow')}" style="mix-blend-mode:multiply" opacity="0.85"/>`);
    });
  }

  /* ---- sorting between solids */
  function screenBox(it) { if (!it._sb) it._sb = bboxOf((it.V || it.pts).map(proj)); return it._sb; }
  function before(a, b) {
    // true if a must be drawn before b
    if (a.layer !== b.layer) return a.layer < b.layer;
    let best = null, bw = 0;
    for (let i = 0; i < 3; i++) {
      const vi = CB.V[i];
      if (Math.abs(vi) < 1e-6) continue;
      const gab = b.bb.min[i] - a.bb.max[i], gba = a.bb.min[i] - b.bb.max[i];
      const tol = 1e-6 * (1 + Math.abs(a.bb.max[i]));
      if (gab >= -tol || gba >= -tol) {
        const w = Math.abs(vi);
        if (w > bw) { bw = w; best = gab >= -tol ? vi > 0 : vi < 0; } // b beyond a along +i → b nearer if vi > 0
      }
    }
    if (best != null) return best;
    return depthOf(mid3(a.bb)) < depthOf(mid3(b.bb));
  }
  function sortItems(list) {
    const n = list.length;
    const after = list.map(() => []); // edges i -> j: i before j
    const indeg = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const A = screenBox(list[i]), B = screenBox(list[j]);
      if (A.x + A.w < B.x - 2 || B.x + B.w < A.x - 2 || A.y + A.h < B.y - 2 || B.y + B.h < A.y - 2) {
        if (list[i].layer === list[j].layer) continue;
      }
      if (before(list[i], list[j])) { after[i].push(j); indeg[j]++; } else { after[j].push(i); indeg[i]++; }
    }
    const key = (i) => [list[i].layer, depthOf(mid3(list[i].bb))];
    const cmp = (i, j) => { const a = key(i), b = key(j); return a[0] - b[0] || a[1] - b[1]; };
    const done = new Array(n).fill(false), order = [];
    while (order.length < n) {
      let ready = [];
      for (let i = 0; i < n; i++) if (!done[i] && indeg[i] <= 0) ready.push(i);
      if (!ready.length) { // a cycle: break it at the farthest remaining item
        for (let i = 0; i < n; i++) if (!done[i]) ready.push(i);
        ready = [ready.sort(cmp)[0]];
      }
      ready.sort(cmp);
      const i = ready[0];
      done[i] = true; order.push(list[i]);
      for (const j of after[i]) indeg[j]--;
    }
    return order;
  }

  /* ---- overlays: labels in the margins, steam */
  function render3D() {
    const out = [];
    // shadows first, all one flat colour so overlaps merge
    const shadowCol = soften('shadow');
    for (const it of items) it.shadowsOn = [];
    const ground = [];
    for (const it of items) {
      const sup = supportOf(it);
      const h = shadowOf(it, sup ? sup.bb.max[2] : undefined);
      if (!h || h.length < 3) continue;
      if (sup) sup.shadowsOn.push(h); else ground.push(h);
    }
    if (ground.length) scopedRender('ground-shadows', () => {
      const ds = ground.map((h) => pathD(washPoly(h, rng(), { inset: 0.3, register: 0.6 }))).join('');
      out.push(`<path d="${ds}" fill="${shadowCol}"/>`);
    });
    for (const it of sortItems(items)) renderItem(it, out);
    // drawing bounds (for label placement)
    const allPts = [];
    for (const it of items) { const b = screenBox(it); allPts.push([b.x, b.y], [b.x + b.w, b.y + b.h]); }
    const DB = allPts.length ? bboxOf(allPts) : { x: W / 2, y: H / 2, w: 0, h: 0 };
    const auto = { left: [], right: [] };
    for (const ov of overlays) {
      if (ov.kind !== 'label' || ov.o.x != null) continue;
      const T = proj(ov.o.to);
      const side = ov.o.side || (T[0] < DB.x + DB.w / 2 ? 'left' : 'right');
      auto[side].push({ ov, T });
    }
    for (const side of ['left', 'right']) {
      const L = auto[side].sort((a, b) => a.T[1] - b.T[1]);
      let prevY = -Infinity;
      for (const a of L) {
        const size = a.ov.o.size || 21;
        let y = Math.max(a.T[1] + size * 0.3 + (a.ov.o.dy || 0), prevY + size * 1.9);
        y = clamp(y, size * 2, H - size);
        prevY = y;
        const gap = a.ov.o.gap || 70;
        a.ov.place = side === 'left'
          ? { x: Math.max(30 + textWidth(a.ov.str, size), DB.x - gap), y, align: 'right' }
          : { x: Math.min(W - 30 - textWidth(a.ov.str, size), DB.x + DB.w + gap), y, align: 'left' };
      }
    }
    for (const ov of overlays) {
      scopedRender('overlay#' + ov.n, () => {
        const save = body.length;
        if (ov.kind === 'label') {
          const p = ov.place || { x: ov.o.x, y: ov.o.y, align: ov.o.align };
          label(ov.str, { ...ov.o, x: p.x, y: p.y, align: p.align, to: ov.o.to ? proj(ov.o.to) : null });
        } else if (ov.kind === 'steam') drawSteam(ov.at, ov.o);
        out.push(...body.splice(save));
      });
    }
    return out;
  }

  function drawSteam(at, o) {
    const [x, y] = proj(at);
    const n = o.n || 3, hgt = (o.h || 120) * view.scale, sp = (o.spread || 26) * view.scale;
    const tt = o.t == null ? t : o.t;
    for (let i = 0; i < n; i++) {
      const ph = TAU * (tt + i / n);
      const xx = x + (i - (n - 1) / 2) * sp;
      const pts = [];
      for (let j = 0; j <= 6; j++) {
        const f = j / 6;
        pts.push([xx + Math.sin(f * 5 + ph) * (6 + f * 8) * Math.min(2, view.scale), y - f * hgt * (0.8 + 0.2 * Math.sin(ph + i))]);
      }
      emitInk(catmull(pts, false), false, { weight: 'detail', ink: o.ink || 'charcoal' });
    }
  }

  /* -------------------- the kit object */

  const solidOpts = (o) => o || {};
  let ovN = 0;
  const k = {
    W, H, width: W, height: H, t, seed,
    palette: PALETTE, weights: WEIGHTS,
    soften, darker, lighter,
    lerp, clamp, smooth,
    rand(a = 0, b = 1) { return lerp(a, b, shapeRng()()); },
    pick(arr) { return arr[Math.floor(shapeRng()() * arr.length)]; },
    /** Loop helpers for animation: wave(t) = sin over one loop, pulse = 0..1..0. */
    wave: (phase = 0, tt = t) => Math.sin(TAU * (tt + phase)),
    pulse: (phase = 0, tt = t) => 0.5 - 0.5 * Math.cos(TAU * (tt + phase)),

    /** Camera: { yaw: 45, pitch: 35.26 }. yaw 0 = straight from the front; pitch 0 = level, 90 = from above. */
    camera(c = {}) { Object.assign(cam, c); CB = camBasis(cam.yaw, cam.pitch); for (const it of items) it._sb = null; return { ...cam }; },

    group: group3,
    scope: scoped,

    /** Any closed mesh: V = [[x, y, z], …], F = faces as index lists. For shapes the primitives can't make
     *  (liquid in a tipped container, cut by its level surface). */
    mesh(V, F, o = {}) { return addMesh(V, F, o, 'mesh'); },
    follow: (tt, src, o) => follow(tt, src, o, duration),
    accel: (p, u) => accelOf(p, u, duration),
    duration,

    /** Box. at = centre of the bottom face, size = [w (x), d (y), h (z)]. { round: r } rounds the vertical edges. */
    box(at, size, o = {}) {
      const [w, d, h] = size;
      const poly = o.round ? roundRectPoly(-w / 2, -d / 2, w / 2, d / 2, Math.min(o.round, w / 2, d / 2)) : [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
      const m = prismMesh(poly, 0, h);
      return addMesh(place(m.V, at, o.axis || 'z'), m.F, solidOpts({ ...o, at }), 'box');
    },
    /** Prism from a 2D outline [[u, v], …] (any shape, e.g. k.shapes.*), extruded h along axis ('z' default, 'x' or 'y'). */
    extrude(at, outline, h, o = {}) {
      const m = prismMesh(outline, 0, h);
      return addMesh(place(m.V, at, o.axis || 'z'), m.F, { ...o, at }, 'extrude');
    },
    /** Surface of revolution: profile [[radius, height], …] from the bottom up. { top: false } leaves it open. */
    lathe(at, profile, o = {}) {
      let prof = profile;
      if (o.smooth) prof = catmull(profile.map((p) => [p[0], p[1]]), false, 3);
      const nOuter = prof.length; // rim ring = last outer ring; inside starts at the rim's inner edge
      if (o.wall) { // a container with walls: outside up, over the rim, inside down to a floor
        const w = o.wall, z0 = prof[0][1], zt = prof[prof.length - 1][1];
        const inner = prof.slice(1).reverse().map(([r, z]) => [Math.max(0, r - w), z]).filter(([, z]) => z > z0 + (o.floor || w));
        const fl = o.floor || w;
        const rFloor = Math.max(0, (inner.length ? inner[inner.length - 1][0] : prof[0][0] - w));
        prof = [...prof, ...inner, [rFloor, z0 + fl], [0, z0 + fl]];
        if (zt <= z0) prof = profile;
      }
      const m = latheMesh(prof, { segments: o.segments, top: o.wall ? false : o.top, bottom: o.bottom });
      // with walls, the faces after the rim (ring nOuter onward) are the inside
      const tags = o.wall ? m.F.map((_, i) => (m.ringOf[i] > nOuter ? 1 : 0)) : null;
      return addMesh(place(m.V, at, o.axis || 'z'), m.F, { crease: 40, ...o, at, open: o.top === false && !o.wall ? true : o.open }, 'lathe', tags);
    },
    /** Cylinder (or a cone/frustum with { r2 }). at = centre of the base, along axis 'z' (default), 'x' or 'y'. */
    cylinder(at, r, h, o = {}) {
      const prof = [[r, 0], [o.r2 == null ? r : o.r2, h]];
      const m = latheMesh(prof, { segments: o.segments || 36, top: o.top, bottom: o.bottom });
      return addMesh(place(m.V, at, o.axis || 'z'), m.F, { crease: 40, ...o, at, open: o.top === false || o.bottom === false ? true : o.open }, 'cylinder');
    },
    /** Sphere at its centre. { scale: [sx, sy, sz] } squashes it into an ellipsoid. */
    sphere(at, r, o = {}) {
      const n = o.rings || 14, prof = [];
      for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (Math.PI * i) / n; prof.push([Math.cos(a) * r, Math.sin(a) * r]); }
      prof[0][0] = 0; prof[n][0] = 0;
      const m = latheMesh(prof, { segments: o.segments || 32 });
      return addMesh(place(m.V, at), m.F, { crease: 60, ...o, at }, 'sphere');
    },
    /** Round tube along a smooth 3D path: handles, pipes, legs, cables, stems. r or [r0, r1]. */
    tube(points, r, o = {}) {
      const C0 = o.straight ? points : catmull3(points, o.step || 6);
      const [r0, r1] = Array.isArray(r) ? r : [r, r];
      let L0 = 0; const s0 = [0];
      for (let i = 1; i < C0.length; i++) { L0 += len3(sub3(C0[i], C0[i - 1])); s0.push(L0); }
      const radAt = (u) => lerp(r0, r1, L0 ? u / L0 : 0);
      // where the path runs inside a solid drawn earlier (a spout into a pot, a handle into a mug), cut it at
      // the surface: the joint becomes a clean line instead of an end poking through
      let runs = [C0.map((p, i) => ({ p, u: s0[i] }))];
      if (o.cut !== false) {
        const hosts = items.filter((it) => it.closed && it.kind !== 'line');
        const inside = (p) => { const w = applyXf(p); return hosts.some((h) => pointInMesh(h, w)); };
        const flags = C0.map(inside);
        if (flags.some(Boolean)) {
          runs = [];
          let cur = null;
          const edge = (a, b, ua, ub) => { // a inside, b outside: bisect for the surface
            let lo = 0, hi = 1;
            for (let it = 0; it < 12; it++) { const m = (lo + hi) / 2; if (inside(add3(a, mul3(sub3(b, a), m)))) lo = m; else hi = m; }
            return { p: add3(a, mul3(sub3(b, a), hi)), u: lerp(ua, ub, hi) };
          };
          for (let i = 0; i < C0.length; i++) {
            if (flags[i]) { if (cur) { cur.push(edge(C0[i], C0[i - 1], s0[i], s0[i - 1])); runs.push(cur); cur = null; } continue; }
            if (!cur) { cur = []; if (i > 0) cur.push(edge(C0[i - 1], C0[i], s0[i - 1], s0[i])); }
            cur.push({ p: C0[i], u: s0[i] });
          }
          if (cur) runs.push(cur);
          runs = runs.filter((r) => r.length >= 2);
        }
      }
      let handle = null;
      for (const run of runs) handle = tubeMesh(run.map((q) => q.p), run.map((q) => radAt(q.u)), o) || handle;
      return handle;
    },
    /** Flat panel through 3D points (a sign, a blade, a page). { thick } gives it thickness. { on: solid } sticks it on that solid's face. */
    panel(points, o = {}) {
      const n0 = unit3(newell(points));
      if (o.thick) {
        const off = mul3(n0, o.thick);
        const n = points.length, V = [...points, ...points.map((p) => add3(p, off))], F = [];
        for (let i = 0; i < n; i++) { const j = (i + 1) % n; F.push([i, n + i, n + j, j]); }
        F.push(Array.from({ length: n }, (_, i) => n - 1 - i));
        F.push(Array.from({ length: n }, (_, i) => n + i));
        return addMesh(V, F, o, 'panel');
      }
      let pts = points;
      if (o.on && o.on._item) { // a decal: make it face away from the solid it sits on
        const host = o.on._item, hc = mid3(host.bb), pc = avg3(points.map((p) => applyXf(p)));
        if (dot3(unit3(applyXf(n0, { m: xf.m, t: [0, 0, 0] })), sub3(pc, hc)) < 0) pts = points.slice().reverse();
      }
      return addMesh(pts, [pts.map((_, i) => i)], { ...o, open: !o.on, single: !!o.on }, 'panel');
    },
    /** Ink line through 3D points (seams, grooves, a lid gap, a crack). { on: solid, normal } draws it with that solid, hidden when the normal faces away. */
    line(points, o = {}) {
      const pts = (o.smooth ? catmull3(points, 4) : points).map((p) => applyXf(p));
      const item = { kind: 'line', pts, o, children: [], bb: bbox3(pts), layer: o.layer || 0, normal: o.normal ? unit3(applyXf(o.normal, { m: xf.m, t: [0, 0, 0] })) : null, scope: scope + '/line#' + items.length };
      if (o.on && o.on._item) o.on._item.children.push(item); else items.push(item);
      return item;
    },
    /** 2D outlines for extrude / box: rect, roundRect, circle, ellipse, poly, spline (closed, smooth). */
    shapes: {
      rect: (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]],
      roundRect: (w, h, r) => roundRectPoly(-w / 2, -h / 2, w / 2, h / 2, Math.min(r, w / 2, h / 2)),
      circle: (r, n = 32) => Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * TAU), r * Math.sin((i / n) * TAU)]),
      ellipse: (rx, ry, n = 32) => Array.from({ length: n }, (_, i) => [rx * Math.cos((i / n) * TAU), ry * Math.sin((i / n) * TAU)]),
      spline: (pts) => catmull(pts, true, 4),
    },
    /** Where a 3D point lands on the sheet (after framing). */
    at: (p) => proj(applyXf(p)),

    /** Steam / smoke wisps rising from a 3D point. Loops with t. { n: 3, h: 120, spread: 26 } (h, spread in world units). */
    steam(at, o = {}) { overlays.push({ kind: 'steam', at: applyXf(at), o, n: ovN++ }); },
    /** Margin note with a leader line to a 3D point: { to: [x, y, z], side: 'left'|'right', dy, size }. Placed in the margin
     *  automatically (stacked so they don't collide); give { x, y } (sheet units) to place it by hand. */
    label(str, o = {}) { overlays.push({ kind: 'label', str, o: { ...o, to: o.to ? applyXf(o.to) : null }, n: ovN++ }); },
    text, textWidth, title,

    /** For render.mjs: the drawing's extent at scale 1, before framing. */
    measure() {
      const pts = [];
      for (const it of items) {
        for (const p of it.V || it.pts) pts.push([dot3(p, CB.R), -dot3(p, CB.U)]);
        for (const c of it.children || []) for (const p of c.V || c.pts) pts.push([dot3(p, CB.R), -dot3(p, CB.U)]);
      }
      for (const ov of overlays) if (ov.kind === 'steam') {
        const p = ov.at; pts.push([dot3(p, CB.R), -dot3(p, CB.U) - (ov.o.h || 120)]);
      }
      const labels = { left: 0, right: 0, any: 0 };
      for (const ov of overlays) if (ov.kind === 'label') { labels.any++; if (ov.o.side) labels[ov.o.side]++; }
      return { box: pts.length ? bboxOf(pts) : null, labels, title: hasTitle };
    },
    /** Raw pieces, for combining frames (see svgDocument). */
    parts() {
      const save = body.splice(0);
      const three = render3D();
      return { defs: defs.slice(), body: [...three, ...save] };
    },
    toSVG(o = {}) {
      return svgDocument([k.parts()], { W, H, seed, size: o.size, transparent: o.transparent || opts.transparent, paper: o.paper, grid: o.grid });
    },
  };
  let hasTitle = false;
  const title0 = k.title;
  k.title = (...a) => { hasTitle = true; return title0(...a); };
  return k;
}

/* ------------------------------------------------------------------ 3D helpers */

const ISO_PITCH = (Math.atan(1 / Math.SQRT2) * 180) / Math.PI; // 35.26°: true isometric
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
const unit3 = (a) => { const l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const avg3 = (P) => mul3(P.reduce((s, p) => add3(s, p), [0, 0, 0]), 1 / P.length);
const mid3 = (b) => mul3(add3(b.min, b.max), 0.5);
// light, in camera space (right, up, toward the viewer): from the upper left, a little in front
const LIGHT_CAM = unit3([-0.55, 0.75, 0.45]);

function camBasis(yaw, pitch) {
  const y = (yaw * Math.PI) / 180, p = (pitch * Math.PI) / 180;
  const cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p);
  return { V: [sy * cp, -cy * cp, sp], R: [cy, sy, 0], U: [-sp * sy, sp * cy, cp] };
}
/* -------------------- secondary motion: second-order dynamics (same as the 2D kit). y chases a driving signal
 * like a mass on a spring: f = Hz, z = damping (0.2 rings, 0.5–0.7 alive, 1 no overshoot), r = start (0 eases in,
 * 1 at once, <0 anticipates). Run once over `warm` loops and cached, so it loops seamlessly. */
function secondOrderLoop(xs, dt, f, z, r, warm) {
  const k1 = z / (Math.PI * f), k2 = 1 / ((2 * Math.PI * f) ** 2), k3 = (r * z) / (2 * Math.PI * f);
  const n = xs.length, dim = xs[0].length, sub = 4, h = dt / sub;
  const k2s = Math.max(k2, (h * h) / 2 + (h * k1) / 2, h * k1);
  const y = xs[0].slice(), yd = new Array(dim).fill(0), out = [];
  for (let loop = 0; loop <= warm; loop++)
    for (let i = 0; i < n; i++) {
      const x = xs[i], xp = xs[(i - 1 + n) % n];
      for (let d = 0; d < dim; d++) {
        const xd = (x[d] - xp[d]) / dt;
        for (let s = 0; s < sub; s++) { y[d] += h * yd[d]; yd[d] += (h * (x[d] + k3 * xd - y[d] - k1 * yd[d])) / k2s; }
      }
      if (loop === warm) out.push(y.slice());
    }
  return out;
}
const FOLLOW_CACHE = new Map();
function follow(t, src, o = {}, duration = 1.33) {
  const n = o.samples || 240, f = o.f == null ? 2 : o.f, z = o.z == null ? 0.5 : o.z, r = o.r || 0, warm = o.warm || 3;
  const probe = [0, 0.13, 0.29, 0.41, 0.58, 0.71, 0.86].map(src);
  const key = `${o.key || src}|${n},${f},${z},${r},${warm},${duration}|${JSON.stringify(probe)}`;
  let table = FOLLOW_CACHE.get(key);
  if (!table) {
    table = secondOrderLoop(Array.from({ length: n }, (_, i) => [].concat(src(i / n))), duration / n, f, z, r, warm);
    if (FOLLOW_CACHE.size > 200) FOLLOW_CACHE.clear();
    FOLLOW_CACHE.set(key, table);
  }
  const u = (((t % 1) + 1) % 1) * n, i = Math.floor(u), a = table[i % n], b = table[(i + 1) % n], w = u - i;
  const v = a.map((ai, d) => ai + (b[d] - ai) * w);
  return Array.isArray(probe[0]) ? v : v[0];
}
function accelOf(p, u, duration, du = 1 / 480) {
  const a = p(u - du), b = p(u), c = p(u + du), dt2 = (du * duration) ** 2;
  return a.map((_, i) => (a[i] - 2 * b[i] + c[i]) / dt2);
}
function rotMatrix(r) {
  let m = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (!r) return m;
  const mul = (a, b) => { const o = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]); return o; };
  const axisAngle = (ax, deg) => {
    const [x, y, z] = unit3(ax), a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), C = 1 - c;
    return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
  };
  if (typeof r === 'number') return axisAngle([0, 0, 1], r);
  if (Array.isArray(r)) return axisAngle(r[0], r[1]);
  if (r.x) m = mul(axisAngle([1, 0, 0], r.x), m);
  if (r.y) m = mul(axisAngle([0, 1, 0], r.y), m);
  if (r.z) m = mul(axisAngle([0, 0, 1], r.z), m);
  return m;
}
function bbox3(P) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of P) for (let i = 0; i < 3; i++) { if (p[i] < min[i]) min[i] = p[i]; if (p[i] > max[i]) max[i] = p[i]; }
  return { min, max };
}
function newell(P) {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return unit3([x, y, z]);
}
function dedupeRing(f) {
  const o = [];
  for (const i of f) if (o[o.length - 1] !== i) o.push(i);
  while (o.length > 1 && o[0] === o[o.length - 1]) o.pop();
  return o;
}
function roundRectPoly(x0, y0, x1, y1, r) {
  if (r <= 0) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const pts = [], c = (cx, cy, a0) => { for (let i = 0; i <= 5; i++) { const a = ((a0 + i * 18) * Math.PI) / 180; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  c(x1 - r, y0 + r, -90); c(x1 - r, y1 - r, 0); c(x0 + r, y1 - r, 90); c(x0 + r, y0 + r, 180);
  return pts;
}
function catmull3(points, step = 6) {
  if (points.length < 3) return points.map((p) => p.slice());
  const out = [];
  const P = [points[0], ...points, points[points.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    const n = Math.max(2, Math.ceil(len3(sub3(p2, p1)) / step));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  out.push(points[points.length - 1].slice());
  return out;
}
function hull2(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (P.length < 3) return P;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop();
  return lo.concat(up);
}
// is a world point inside a closed mesh? (ray cast along a skewed direction, counting crossings)
const RAY = unit3([0.1234, 0.2345, 0.9643]);
function pointInMesh(item, p) {
  const b = item.bb;
  if (p[0] < b.min[0] || p[0] > b.max[0] || p[1] < b.min[1] || p[1] > b.max[1] || p[2] < b.min[2] || p[2] > b.max[2]) return false;
  let hits = 0;
  for (const f of item.F) for (let i = 1; i + 1 < f.length; i++) {
    const a = item.V[f[0]], e1 = sub3(item.V[f[i]], a), e2 = sub3(item.V[f[i + 1]], a);
    const h = cross3(RAY, e2), det = dot3(e1, h);
    if (Math.abs(det) < 1e-12) continue;
    const sv = sub3(p, a), u = dot3(sv, h) / det;
    if (u < 0 || u > 1) continue;
    const q = cross3(sv, e1), v = dot3(RAY, q) / det;
    if (v < 0 || u + v > 1) continue;
    if (dot3(e2, q) / det > 1e-9) hits++;
  }
  return hits % 2 === 1;
}
// outline loops (vertex index lists) of a set of faces: their edges that no other face in the set shares
function regionLoops(faces) {
  const dir = new Set();
  for (const f of faces) for (let i = 0; i < f.length; i++) dir.add(f[i] + ',' + f[(i + 1) % f.length]);
  const next = new Map();
  for (const f of faces) for (let i = 0; i < f.length; i++) {
    const a = f[i], b = f[(i + 1) % f.length];
    if (dir.has(b + ',' + a)) continue;
    if (!next.has(a)) next.set(a, []);
    next.get(a).push(b);
  }
  const loops = [];
  for (const start of [...next.keys()]) {
    while (next.get(start) && next.get(start).length) {
      const loop = [start];
      let cur = start, guard = 0;
      while (guard++ < 100000) {
        const l = next.get(cur);
        if (!l || !l.length) break;
        const nx = l.pop();
        if (nx === start) break;
        loop.push(nx); cur = nx;
      }
      if (loop.length >= 3) loops.push(loop);
    }
  }
  return loops;
}
// join edges [a, b] into polylines, going straight on at junctions and lifting the pen at sharp corners
function chainEdges(E, P, sharpDeg = 55) {
  const adj = new Map();
  E.forEach(([a, b], i) => { for (const v of [a, b]) { if (!adj.has(v)) adj.set(v, []); adj.get(v).push(i); } });
  const used = new Array(E.length).fill(false);
  const other = (i, v) => (E[i][0] === v ? E[i][1] : E[i][0]);
  const turn = (a, b, c) => {
    const u = [P[b][0] - P[a][0], P[b][1] - P[a][1]], w = [P[c][0] - P[b][0], P[c][1] - P[b][1]];
    const lu = Math.hypot(...u) || 1, lw = Math.hypot(...w) || 1;
    return Math.acos(clamp((u[0] * w[0] + u[1] * w[1]) / (lu * lw), -1, 1)) * (180 / Math.PI);
  };
  const walk = (v0, e0) => {
    const pts = [v0];
    let v = v0, e = e0;
    for (;;) {
      used[e] = true;
      const nx = other(e, v);
      pts.push(nx);
      let best = -1, bt = 1e9;
      for (const c of adj.get(nx)) {
        if (used[c]) continue;
        const tt = turn(v, nx, other(c, nx));
        if (tt < bt) { bt = tt; best = c; }
      }
      if (best < 0 || bt > sharpDeg) break;
      v = nx; e = best;
    }
    return pts;
  };
  const chains = [];
  const starts = [...adj.keys()].sort((a, b) => (adj.get(a).length % 2 ? 0 : 1) - (adj.get(b).length % 2 ? 0 : 1));
  for (const v of starts) for (const e of adj.get(v)) if (!used[e]) chains.push(walk(v, e));
  return chains;
}


function norm(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }

/**
 * Build the SVG document. frames: [{defs, body}]. One frame = a still. Several = a looping CSS animation
 * (fps, frames shown in turn). Paper and grid are shared.
 */
export function svgDocument(frames, o) {
  const { W, H } = o;
  const size = o.size || W;
  const pxH = Math.round((size * H) / W);
  const paperOn = !o.transparent;
  const pseed = (hashStr('paper' + o.seed) % 997) + 1;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${pxH}" viewBox="0 0 ${W} ${H}">`);
  parts.push('<defs>');
  if (paperOn) {
    parts.push(`<filter id="mottle" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="${pseed + 7}"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.3  1.2 0 0 0 -0.5"/></filter>`);
  }
  const seen = new Set();
  for (const f of frames) for (const d of f.defs) { if (!seen.has(d)) { seen.add(d); parts.push(d); } }
  parts.push('</defs>');
  if (paperOn) {
    parts.push(`<rect width="${W}" height="${H}" fill="${o.paper ? soften(o.paper) : PALETTE.paper}"/>`);
    parts.push(`<rect width="${W}" height="${H}" filter="url(#mottle)" opacity="0.16"/>`);
  }
  if (frames.length === 1) parts.push(...frames[0].body);
  else {
    const n = frames.length, dt = 1 / (o.fps || 10), dur = n * dt;
    parts.push(`<style>.hd-f{visibility:hidden;animation:hd-fr ${fmt(dur * 1000)}ms step-end infinite}` +
      `@keyframes hd-fr{0%{visibility:visible}${(100 / n).toFixed(3)}%{visibility:hidden}100%{visibility:hidden}}</style>`);
    frames.forEach((f, i) => {
      // frame 0 is also the static fallback (renderers without CSS animation show it)
      parts.push(`<g class="hd-f" style="animation-delay:${fmt(i * dt * 1000)}ms${i === 0 ? ';visibility:visible' : ''}">`);
      parts.push(...f.body);
      parts.push('</g>');
    });
  }
  if (o.grid) parts.push(gridSVG(W, H));
  parts.push('</svg>');
  return parts.join('\n');
}

function gridSVG(W, H) {
  const g = ['<g id="grid" font-family="sans-serif" font-size="13" fill="#3070c0" stroke="#3070c0">'];
  for (let x = 0; x <= W; x += 50) g.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke-width="${x % 100 ? 0.4 : 0.9}" stroke-opacity="0.45"/>`);
  for (let y = 0; y <= H; y += 50) g.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke-width="${y % 100 ? 0.4 : 0.9}" stroke-opacity="0.45"/>`);
  for (let x = 100; x < W; x += 100) g.push(`<text x="${x + 3}" y="14" stroke="none">${x}</text>`);
  for (let y = 100; y < H; y += 100) g.push(`<text x="3" y="${y - 3}" stroke="none">${y}</text>`);
  g.push('</g>');
  return g.join('');
}

export { soften, darker, lighter, PALETTE, mulberry32, camBasis, ISO_PITCH };
