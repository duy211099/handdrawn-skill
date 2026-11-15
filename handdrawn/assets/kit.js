// handdrawn kit — hand-drawn 2D SVG illustrations: ink + flat marker wash on cream paper.
// Plain JS, no dependencies. Runs in Node and in the browser (ES module).
// MIT licence. Written from scratch.
//
//   import { createKit } from './kit.js';
//   const k = createKit({ seed: 7, width: 1000, height: 1000 });
//   k.circle(500, 500, 200, { fill: 'red' });
//   const svg = k.toSVG();
//
// Coordinates: sheet units, x right, y down. Draw order is call order (back to front).

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

/* -------------------- timing (Apple-style)
 * Springs, the way SwiftUI describes them: a perceptual `duration` and a `bounce` (0 = no overshoot).
 *   smooth = bounce 0 (SwiftUI .smooth, the default)   snappy = bounce 0.15   bouncy = bounce 0.3
 * A critically damped spring starts at rest, moves quickly, then settles gently: calm on the eyes.
 * Plus the Core Animation curves as cubic-béziers (easeInOut 0.42,0,0.58,1; default 0.25,0.1,0.25,1). */
function springCurve(bounce = 0) {
  const zeta = 1 - clamp(bounce, 0, 0.9), w = 2 * Math.PI * 1.25; // settles (≈99.5%) by p = 1
  const raw = (p) => {
    if (zeta >= 1) return 1 - (1 + w * p) * Math.exp(-w * p);
    const wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * p) * (Math.cos(wd * p) + ((zeta * w) / wd) * Math.sin(wd * p));
  };
  const end = raw(1);
  return (p) => (p <= 0 ? 0 : p >= 1 ? 1 : raw(p) / end);
}
function bezierCurve(x1, y1, x2, y2) {
  const B = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (B(x1, x2, m) < x) lo = m; else hi = m; }
    return B(y1, y2, (lo + hi) / 2);
  };
}
const EASE = {
  linear: (p) => clamp(p, 0, 1),
  smooth: springCurve(0), snappy: springCurve(0.15), bouncy: springCurve(0.3),
  easeInOut: bezierCurve(0.42, 0, 0.58, 1), easeOut: bezierCurve(0, 0, 0.58, 1), easeIn: bezierCurve(0.42, 0, 1, 1),
  default: bezierCurve(0.25, 0.1, 0.25, 1),
  sine: (p) => (1 - Math.cos(Math.PI * clamp(p, 0, 1))) / 2,
};
/**
 * One loop as beats: motion(t, [[value, beats, ease?], …]) starts at the LAST value (so it loops) and moves to each
 * value in turn over its share of the loop; an entry with the same value as before is a hold.
 *   motion(t, [[0, 1], [1, 2, 'smooth'], [1, 1.5], [0, 2, 'smooth']])  → rest, lift, hold, lower
 */
function motion(t, beats) {
  const total = beats.reduce((a, b) => a + b[1], 0);
  let x = (((t % 1) + 1) % 1) * total, from = beats[beats.length - 1][0];
  for (const [to, len, ease] of beats) {
    if (x <= len) { const e = (EASE[ease] || EASE.smooth)(len ? x / len : 1); return from + (to - from) * e; }
    x -= len; from = to;
  }
  return beats[beats.length - 1][0];
}

/* -------------------- secondary motion: second-order dynamics (t3ssel8r, "Giving Personality to Procedural
 * Animations using Math"). y chases a driving signal x like a mass on a spring:
 *   f = natural frequency in Hz (how quickly it responds), z = damping (0 rings forever, 0.3–0.7 alive, 1 no
 *   overshoot), r = initial response (0 eases in, 1 reacts at once, >1 overshoots the start, <0 anticipates).
 * Keyframe only the primary motion; derive everything attached to it (a head that follows the hand, liquid that
 * sloshes, a lid that rattles, a leaf that sways) with follow(), and the cause→effect lag makes it read as physical.
 * Frames are drawn independently, so the simulation is run once per signal and cached: the driver is sampled over
 * one loop, the system runs for `warm` loops (a damped system driven by a looping signal settles into a looping
 * response), and the last loop is kept, so the result joins up seamlessly. */
function secondOrderLoop(xs, dt, f, z, r, warm) {
  const k1 = z / (Math.PI * f), k2 = 1 / ((2 * Math.PI * f) ** 2), k3 = (r * z) / (2 * Math.PI * f);
  const n = xs.length, dim = xs[0].length, sub = 4, h = dt / sub;
  const k2s = Math.max(k2, (h * h) / 2 + (h * k1) / 2, h * k1);       // keeps a stiff spring stable at this step
  const y = xs[0].slice(), yd = new Array(dim).fill(0), out = [];
  for (let loop = 0; loop <= warm; loop++)
    for (let i = 0; i < n; i++) {
      const x = xs[i], xp = xs[(i - 1 + n) % n];
      for (let d = 0; d < dim; d++) {
        const xd = (x[d] - xp[d]) / dt;
        for (let s = 0; s < sub; s++) {                                   // semi-implicit Euler
          y[d] += h * yd[d];
          yd[d] += (h * (x[d] + k3 * xd - y[d] - k1 * yd[d])) / k2s;
        }
      }
      if (loop === warm) out.push(y.slice());
    }
  return out;
}
const FOLLOW_CACHE = new Map();
function follow(t, src, o = {}, duration = 2.4) {
  const n = o.samples || 240, f = o.f == null ? 2 : o.f, z = o.z == null ? 0.5 : o.z, r = o.r || 0, warm = o.warm || 3;
  const raw = (u) => src(u), probe = [0, 0.13, 0.29, 0.41, 0.58, 0.71, 0.86].map(raw);
  const key = `${o.key || src}|${n},${f},${z},${r},${warm},${duration}|${JSON.stringify(probe)}`;   // probes catch closures over different values
  let table = FOLLOW_CACHE.get(key);
  if (!table) {
    const xs = Array.from({ length: n }, (_, i) => [].concat(raw(i / n)));
    table = secondOrderLoop(xs, duration / n, f, z, r, warm);
    if (FOLLOW_CACHE.size > 200) FOLLOW_CACHE.clear();
    FOLLOW_CACHE.set(key, table);
  }
  const u = (((t % 1) + 1) % 1) * n, i = Math.floor(u), a = table[i % n], b = table[(i + 1) % n], w = u - i;
  const v = a.map((ai, d) => ai + (b[d] - ai) * w);
  return Array.isArray(probe[0]) ? v : v[0];
}
/* Acceleration of a looping path p(u) (u = share of the loop, p returns [x, y]), in px/s², by central difference. */
function accelOf(p, u, duration = 2.4, du = 1 / 480) {
  const a = p(u - du), b = p(u), c = p(u + du), dt2 = (du * duration) ** 2;
  return [(a[0] - 2 * b[0] + c[0]) / dt2, (a[1] - 2 * b[1] + c[1]) / dt2];
}
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
  hair: '#7e5c46', rice: '#fbfaf4', tea: '#d2c886', celadon: '#b3d6cf', jade: '#6fa8a0',
  // traditional Chinese colours (中国传统色), as soft marker tones. English or Chinese name, same colour.
  gamboge: '#e8c15f', indigo: '#6f84a3', dai: '#4f5a66', moonwhite: '#e4edef', ivory: '#f1e6cb',
  ink1: '#d6d5d1', ink2: '#a8a9a6', ink3: '#737674',
  '藤黄': '#e8c15f', '赭石': '#ddb25f', '花青': '#6f84a3', '黛': '#4f5a66', '月白': '#e4edef', '牙色': '#f1e6cb',
  '青瓷': '#b3d6cf', '朱砂': '#d36b5a', '石绿': '#8fbf9f', '石青': '#6f97c4', '墨': '#3b3634',
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
  '。': [2.6, 'O 1.1 -0.9 0.9 0.9 0 365'],
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
  0x0304: { pos: 'above', h: 0.5, d: 'L -1.3 -0.3 1.3 -0.3', dx: 0 },            // macron  pinyin tone 1  ā
  0x030C: { pos: 'above', h: 1.5, d: 'L -1.2 -1.5 0 0 1.2 -1.5', dx: 0 },        // caron   pinyin tone 3  ǎ
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

/* ------------------------------------------------------------------ hanzi (Chinese characters) */
// Stroke centrelines in stroke order (Make Me a Hanzi, Arphic PL; see hanzi/README.md). render.mjs loads the data
// and calls registerHanzi(). A character sits in a 10×10-unit em box from y=−8.4 to +1.6 (cap height is −7).
const HAN_EM = 10;
let HANZI = null;
let HANZI_CACHE = {};
export function registerHanzi(data) { HANZI = data; HANZI_CACHE = {}; }
const isHan = (ch) => /\p{Script=Han}/u.test(ch);
function hanziGlyph(ch) {
  if (HANZI_CACHE[ch] !== undefined) return HANZI_CACHE[ch];
  const def = HANZI && HANZI[ch];
  if (!def) return (HANZI_CACHE[ch] = null);
  // data: 512 grid, y up, top of box at 450 → units
  const strokes = def.split('|').map((s) => ({
    kind: 'L',
    pts: s.split(' ').map((p) => { const [x, y] = p.split(',').map(Number); return [(x / 51.2), ((450 - y) / 51.2) - 8.4]; }),
  }));
  return (HANZI_CACHE[ch] = { w: HAN_EM, strokes, han: true });
}
// full-width CJK punctuation → existing glyphs (drawn in a full em)
const CJK_PUNCT = { '，': ',', '。': '。', '、': ',', '！': '!', '？': '?', '：': ':', '；': ';', '（': '(', '）': ')' };
function anyGlyph(ch) {
  if (isHan(ch)) return hanziGlyph(ch);
  if (CJK_PUNCT[ch]) { const g = glyph(CJK_PUNCT[ch]); return g && { w: HAN_EM * 0.6, strokes: g.strokes }; }
  return glyph(ch);
}

/* ------------------------------------------------------------------ pinyin */
const TONE_MARK = { 0x0304: 1, 0x0301: 2, 0x030C: 3, 0x0300: 4 };
const TONE_COMB = { 1: '\u0304', 2: '\u0301', 3: '\u030C', 4: '\u0300' };
/** 'cha2' → 'chá', 'lv4' → 'lǜ', 'ma5'/'ma' → 'ma'. Marked pinyin passes through. */
function markSyllable(s) {
  const m = /^([a-züv:]+)([1-5])$/i.exec(s);
  if (!m) return s;
  let body = m[1].replace(/v|u:/gi, (x) => (x[0] === 'V' || x[0] === 'U' ? 'Ü' : 'ü'));
  const tone = +m[2];
  if (tone === 5) return body;
  const low = body.toLowerCase();
  let at = low.search(/[ae]/);
  if (at < 0) at = low.indexOf('ou');
  if (at < 0) { for (let i = low.length - 1; i >= 0; i--) if ('iouü'.includes(low[i])) { at = i; break; } }
  if (at < 0) return body;
  return (body.slice(0, at + 1) + TONE_COMB[tone] + body.slice(at + 1)).normalize('NFC');
}
/** Split pinyin into syllables (spaces, apostrophes, or numbered "dian4hua4"), each with its tone 1–5. */
const PY_SYL = /(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:iang|iong|uang|ueng|iao|ian|uai|uan|üan|ang|eng|ing|ong|ai|ei|ao|ou|an|en|in|un|ün|ia|ie|iu|ua|uo|ui|üe|ue|er|a|o|e|i|u|ü)(?![aeiouü])|(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:ia|ua|uo|a|o|e|i|u|ü)/gi;
/** 'diànhuà' → ['diàn', 'huà'] (marks kept); falls back to the word unchanged. */
function splitJoined(w) {
  const chars = [...w.normalize('NFC')];
  const base = chars.map((c) => c.normalize('NFD').replace(/[\u0300\u0301\u0304\u030C]/g, '').normalize('NFC')).join('');
  if (base.length !== chars.length) return [w];
  const out = [];
  let m, end = 0;
  PY_SYL.lastIndex = 0;
  while ((m = PY_SYL.exec(base))) { if (m.index !== end) return [w]; out.push(chars.slice(m.index, m.index + m[0].length).join('')); end = m.index + m[0].length; }
  return end === base.length && out.length ? out : [w];
}
function pinyinSyllables(str, want) {
  let raw = String(str).trim().split(/[\s'’]+/).flatMap((w) => w.match(/[^\d]+[1-5]|[^\d]+$/g) || [w]);
  if (want && raw.length !== want) { const alt = raw.flatMap((w) => (/\d$/.test(w) ? [w] : splitJoined(w))); if (alt.length === want) raw = alt; }
  return raw.filter(Boolean).map((s) => {
    const text = markSyllable(s);
    let tone = 5;
    for (const c of text.normalize('NFD')) if (TONE_MARK[c.codePointAt(0)]) tone = TONE_MARK[c.codePointAt(0)];
    return { text, tone };
  });
}
// Pleco-style tone colours, deep enough to read as ink
const TONE_INK = { 1: '#b8473b', 2: '#c27a2c', 3: '#4d8a46', 4: '#3f64a8', 5: '#6d665f' };

/* -------------------- themes
 * classic: cream paper with a faint mottle, warm brown-black ink, hanzi coloured by tone, pinyin under the hanzi.
 * sheng:   the Shēng design system. Paper = `surface` #f7f6f2, flat (no texture); ink = `ink` #191d24; muted text =
 *          `ink-muted`; tones = Pleco colours (1 red, 2 green, 3 blue, 4 purple, neutral gray) on the PINYIN only,
 *          hanzi stay ink; pinyin stacks ABOVE the hanzi, then Hán-Việt and the meaning under it.
 * One theme per process (the renderer calls setTheme once before drawing). */
const THEMES = {
  classic: {
    palette: { ink: '#2c2620', paper: '#f4ecdc', shadow: '#d9ccb3', charcoal: '#6d665f', brick: '#bf5a4c', hair: '#7e5c46' },
    tones: { 1: '#b8473b', 2: '#c27a2c', 3: '#4d8a46', 4: '#3f64a8', 5: '#6d665f' },
    rough: 1, grid: '#d99a8c', texture: true, card: { pinyinAbove: false, colorHanzi: true, muted: 'charcoal', gloss: undefined, note: 'brick' },
  },
  sheng: {
    palette: { ink: '#191d24', paper: '#f7f6f2', shadow: '#dedbd3', charcoal: '#575d68', brick: '#46546a',
               muted: '#575d68', jade: '#6fa8a0', celadon: '#b3d6cf', hair: '#3b3634' }, // black hair: people in China
    tones: { 1: '#c42032', 2: '#2a7a14', 3: '#1f5cc4', 4: '#7b3db8', 5: '#63676f' },
    rough: 0.4, grid: '#8b877d', texture: false, card: { pinyinAbove: true, colorHanzi: false, muted: 'muted', gloss: 'muted', note: 'brick' },
  },
  // 简笔画 colour simple-stroke drawing: flat fills (no shading or hatching), a soft brush outline in warm ink, a small
  // set of traditional colours. Transparent by default (sits on the app's surface); --opaque gives the #F6EFE2 paper.
  jianbihua: {
    palette: (() => {
      const C = { cinnabar: '#C94A3A', persimmon: '#E08A3C', gamboge: '#E9B949', malachite: '#5B9A6E', celadon: '#A8C9B0',
        azurite: '#3E6A9E', ochre: '#A0703F', paperwhite: '#FFFDF7', skin: '#F0CDB0', grey: '#B9B6AF', hair: '#3B3634', blush: '#EBB4A3' };
      const as = (name, ...keys) => Object.fromEntries(keys.map((k) => [k, C[name]]));
      return { ...C, ink: '#2B2B2B', paper: '#F6EFE2', shadow: '#E3D8C4', charcoal: '#3B3634', muted: '#575d68', brick: '#46546a',
        ...as('cinnabar', 'red', '朱砂'), ...as('persimmon', 'coral', 'orange'),
        ...as('gamboge', 'yellow', 'sand', '藤黄'), ...as('ochre', 'wood', 'brown', 'chocolate', 'tan', '赭石'),
        ...as('malachite', 'green', 'leaf', 'olive', '石绿'), ...as('celadon', 'sage', 'mint', 'teal', 'jade', 'tea', '青瓷'),
        ...as('azurite', 'sky', 'blue', 'navy', 'indigo', 'lilac', 'plum', '石青', '花青'),
        ...as('paperwhite', 'white', 'cream', 'rice', 'moonwhite', 'ivory', '月白', '牙色'),
        ...as('grey', 'stone', 'ink1', 'ink2'), ...as('hair', 'ink3', 'dai', '黛', '墨'), ...as('blush', 'pink') };
    })(),
    allowed: ['#2B2B2B', '#C94A3A', '#E08A3C', '#E9B949', '#5B9A6E', '#A8C9B0', '#3E6A9E', '#A0703F', '#FFFDF7', '#F0CDB0', '#B9B6AF', '#3B3634', '#EBB4A3'],
    tones: { 1: '#c42032', 2: '#2a7a14', 3: '#1f5cc4', 4: '#7b3db8', 5: '#63676f' },
    rough: 0.1, stroke: 'brush', flat: true, transparent: true, fit: 0.65, grid: '#8b877d', texture: false,
    card: { pinyinAbove: true, colorHanzi: false, muted: 'muted', gloss: 'muted', note: 'brick' },
  },
};
let THEME = THEMES.classic;
/** The current theme's render defaults (the renderer reads these). */
export function themeInfo() { return { transparent: !!THEME.transparent, fit: THEME.fit || 0, allowed: THEME.allowed || null, flat: !!THEME.flat }; }
// rough: how hand-made the marks look, 0 (clean vector) … 1 (classic). Scales line wobble, pressure noise,
// overshoot, unclosed/overrun loops, the off-register colour wash and its uneven edge, and ground-shadow flicks.
let ROUGH = 1;
// stroke: 'marker' (even felt-tip line, thin start, light taper) or 'brush' (gongbi 工笔: a pressed entry 起笔,
// a slight swell through the middle, a long pointed exit 收笔 — written rather than traced)
let STROKE = 'marker';
export function setTheme(name = 'classic', o = {}) {
  const th = THEMES[name];
  if (!th) throw new Error(`unknown theme ${name} (${Object.keys(THEMES).join(', ')})`);
  Object.assign(PALETTE, th.palette);
  Object.assign(TONE_INK, th.tones);
  THEME = th;
  ROUGH = o.rough != null && !Number.isNaN(+o.rough) ? clamp(+o.rough, 0, 1.5) : th.rough;
  STROKE = o.stroke === 'brush' || o.stroke === 'marker' ? o.stroke : th.stroke || 'marker';
}
export const themes = Object.keys(THEMES);

/* ------------------------------------------------------------------ the kit */

const WEIGHTS = { outline: 2.3, detail: 1.6, fine: 1.1, hatch: 0.9, bold: 3.2 };
const LIGHT = [-Math.SQRT1_2, -Math.SQRT1_2]; // light comes from the top-left

export function createKit(opts = {}) {
  const W = opts.width || 1000, H = opts.height || 1000;
  const seed = opts.seed == null ? 1 : opts.seed;
  const t = opts.t || 0;
  const duration = opts.duration || 2.4;   // seconds per loop (for follow(): real-time springs)

  const body = [];
  const defs = [];
  const fillsUsed = new Set();
  let idn = 0;
  let scope = 'root';
  const counters = { root: 0 };
  let M = [1, 0, 0, 1, 0, 0]; // affine: x' = a x + c y + e, y' = b x + d y + f
  let groupScale = 1;

  let fixedSeed = null; // set by steady(): same wobble in every frame
  function rng() {
    counters[scope] = (counters[scope] || 0) + 1;
    return mulberry32(hashStr((fixedSeed == null ? seed : fixedSeed) + '|' + scope + '|' + counters[scope]));
  }
  /** Draw fn's ink identically in every animation frame (no line boil), e.g. text that must stay easy to read. */
  function steady(fn) {
    const ps = scope, pf = fixedSeed;
    scope = 'steady'; fixedSeed = 'steady';
    try { return fn(); } finally { scope = ps; fixedSeed = pf; }
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
    const wob = (o.wobble == null ? 1 : o.wobble) * ROUGH;
    // overshoot both ends
    const os = (o.overshoot == null ? 1 : o.overshoot) * ROUGH;
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
      let pin, swell, pout;
      if (STROKE === 'brush' && o.closed) {
        // a closed outline: no press or taper (they'd leave a blob and a thin gap where the ends meet)
        pin = 1; pout = 1;
        swell = 1.12 * (0.62 + 0.78 * Math.abs(Math.sin(Math.atan2(tg[1], tg[0]) - 0.6)));
      } else if (STROKE === 'brush') {
        const bOut = Math.min(70, T * 0.5);
        pin = 0.75 + 0.25 * smooth(si / 3);                                  // the tip lands…
        swell = 1.08 + 0.75 * Math.exp(-si / 7) + 0.22 * Math.sin(Math.PI * clamp(si / T, 0, 1)); // …presses (起笔), then a belly
        pout = 1 - 0.95 * smooth((si - (T - bOut)) / (bOut || 1));          // long lift to a fine point (收笔)
        // the brush is held at an angle: strokes across the tip are thick, strokes along it are thin (兰叶描)
        swell *= 0.62 + 0.78 * Math.abs(Math.sin(Math.atan2(tg[1], tg[0]) - 0.6));
      } else {
        pin = 0.45 + 0.55 * smooth(si / (inLen || 1));
        swell = 1 + 0.2 * Math.exp(-si / (T * 0.15 + 6));
        pout = 1 - 0.62 * smooth((si - (T - outLen)) / (outLen || 1));
      }
      const noise = 1 + ROUGH * (0.12 * Math.sin((TAU * si) / lw + fw) + 0.06 * Math.sin((TAU * si) / (lw * 0.37) + fw2));
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
    const over = (r() < 0.78 ? (3 + r() * 9) * Math.min(1, per / 120) : -(0.5 + r() * 2.5)) * ROUGH + (ROUGH < 0.6 ? 1.5 : 0);
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
    const d = inkPoly(pts, w, r, { overshoot: closed ? 0.35 : o.overshoot, wobble: o.wobble, stiff: o.stiff, pressure: o.pressure, closed });
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
    const ang = r() * TAU, mag = (1.1 + r() * 0.9) * k * reg * ROUGH;
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
      const inset = k * (0.4 + 0.5 * ROUGH + ROUGH * (1.3 * Math.sin((TAU * s) / l1 + f1) + 0.4 * Math.sin((TAU * s) / (l1 * 0.31) + f2))) * (o.inset == null ? 1 : o.inset);
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
    fillsUsed.add(patternFor(color));
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
    if (THEME.flat) return;                       // flat colour: no shaded side
    shape = shapeOf(shape);
    if (!shape || !color) return;
    const r = rng();
    const base = o.clip || washPoly(txAll(shape.pts), r, { register: 0.5, inset: 0.6 });
    const off = o.offset || shadeOffset(base, o.amount);
    const moved = washPoly(base.map((p) => [p[0] + off[0], p[1] + off[1]]), r, { register: 0.3, inset: -1.2 });
    // id from the geometry, so a part that doesn't move is byte-identical in every frame (frames share it)
    const bd = pathD(base);
    const id = (opts.idPrefix || '') + 'c' + (hashStr(bd) >>> 0).toString(36);
    defs.push(`<clipPath id="${id}"><path d="${bd}"/></clipPath>`);
    body.push(`<path clip-path="url(#${id})" fill-rule="evenodd" d="${pathD(base)}${pathD(moved.slice().reverse())}" fill="${patternFor(o.raw ? color : darker(color, o.depth))}"/>`);
  }
  function hatch(shape, o = {}) {
    if (THEME.flat) return;
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
      const g = anyGlyph(ch) || glyph('?');
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
        let g = anyGlyph(ch);
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
          const dx = stacked && marks[0] !== 0x0308 ? mk.dx + 0.6 : 0;
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

  /* -------------------- Chinese: big characters + vocab card */

  function cutPoly(P, frac) {
    const L = polyLen(P) * frac;
    const out = [P[0]];
    let acc = 0;
    for (let i = 1; i < P.length; i++) {
      const d = dist(P[i - 1], P[i]);
      if (acc + d >= L) { const f = d ? (L - acc) / d : 0; out.push([lerp(P[i - 1][0], P[i][0], f), lerp(P[i - 1][1], P[i][1], f)]); return out; }
      acc += d; out.push(P[i]);
    }
    return out;
  }
  function inkLine(pts, w, color, o = {}) {
    body.push(`<path d="${inkPoly(txAll(pts), w, rng(), { overshoot: 0.2, wobble: o.wobble == null ? 0.4 : o.wobble, stiff: 1.6 })}" fill="${color}"/>`);
  }
  /** 田字格 practice box: light red frame + dashed centre cross (+ diagonals for 米字格). */
  function tianzige(x, y, s, o = {}) {
    const c = o.color || THEME.grid;
    inkLine([[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y - 1]], 1.3, c, { wobble: 0.6 });
    const dash = (a, b) => {
      const L = dist(a, b), n = Math.max(3, Math.round(L / 14));
      for (let i = 0; i < n; i += 2) {
        const f0 = i / n, f1 = Math.min(1, (i + 1) / n);
        inkLine([[lerp(a[0], b[0], f0), lerp(a[1], b[1], f0)], [lerp(a[0], b[0], f1), lerp(a[1], b[1], f1)]], 0.8, c, { wobble: 0.2 });
      }
    };
    dash([x + s / 2, y + 4], [x + s / 2, y + s - 4]);
    dash([x + 4, y + s / 2], [x + s - 4, y + s / 2]);
    if (o.diagonals) { dash([x + 5, y + 5], [x + s - 5, y + s - 5]); dash([x + s - 5, y + 5], [x + 5, y + s - 5]); }
  }

  /**
   * Chinese characters, large, in hand-inked strokes. With animation, they write themselves in correct stroke
   * order: finished for the first `hold` of the loop (so stills / frame 0 show the whole word), then rewritten.
   * x,y = top-left of the first box (align:'center' → x is the centre). Returns boxes for placing pinyin etc.
   */
  function hanzi(str, o = {}) {
    const chars = [...String(str)].filter((c) => !/\s/.test(c));
    const size = o.size || 160, u = size / HAN_EM;
    const gap = o.gap == null ? size * 0.14 : o.gap;
    const totalW = chars.length * size + (chars.length - 1) * gap;
    const x0 = o.align === 'center' ? o.x - totalW / 2 : o.x, y0 = o.y;
    const w = weightOf(o.weight || Math.max(1.6, size * 0.042));
    const glyphs = chars.map((c) => hanziGlyph(c));
    const N = glyphs.reduce((a, g) => a + (g ? g.strokes.length : 0), 0);
    const hold = o.hold == null ? 0.3 : o.hold;
    const tt = o.t == null ? t : o.t;
    const animated = o.order === true && tt > 0;
    const prog = !animated || tt < hold ? N : clamp((tt - hold) / (1 - hold) / 0.92, 0, 1) * N;
    const boxes = [];
    let k = 0;
    glyphs.forEach((g, i) => {
      const bx = x0 + i * (size + gap), by = y0;
      boxes.push({ x: bx, y: by, w: size, h: size, cx: bx + size / 2, cy: by + size / 2, ch: chars[i] });
      if (o.grid !== false) tianzige(bx, by, size, { diagonals: o.grid === 'mi' });
      const color = inkColor(o.inks ? o.inks[i] : o.ink);
      if (!g) { text('?', bx + size * 0.32, by + size * 0.75, { size: size * 0.7 }); return; }
      const place = (p) => [bx + p[0] * u, by + (p[1] + 8.4) * u];
      for (const s of g.strokes) {
        const P = s.pts.map(place);
        const f = clamp(prog - k, 0, 1);
        k++;
        if (f >= 1) { body.push(`<path d="${inkPoly(txAll(P), w, rng(), { overshoot: 0.15, wobble: 0.3, stiff: 2.4, pressure: 1 })}" fill="${color}"/>`); continue; }
        // not yet written: faint tracing guide
        if (o.ghost !== false) inkLine(P, Math.max(1, w * 0.3), PALETTE.stone, { wobble: 0.2 });
        if (f > 0.02) body.push(`<path d="${inkPoly(txAll(cutPoly(P, f)), w, rng(), { overshoot: 0, wobble: 0.3, stiff: 2.4, pressure: 1 })}" fill="${color}"/>`);
      }
    });
    return { x: x0, y: y0, w: totalW, h: size, boxes, strokes: N };
  }

  /**
   * Vocab card for Vietnamese learners: characters (tone-coloured, stroke order) with, under each one, its pinyin
   * and Hán-Việt reading, then the Vietnamese meaning and an optional note (e.g. a false-friend warning).
   *   k.word({ hanzi: '电话', pinyin: 'diàn huà', hanviet: 'điện thoại', meaning: 'điện thoại', x: 500, y: 200, align: 'center' })
   * pinyin may be numbered ('dian4 hua4'). tone colours: 1 red, 2 orange, 3 green, 4 blue, neutral grey.
   */
  function word(o = {}) {
    if (!o.boil) {
      // card lettering is type, not drawing: always the plain marker line, even when pictures use the brush
      const prev = STROKE; STROKE = 'marker';
      try { return steady(() => word({ ...o, boil: true })); } finally { STROKE = prev; }
    }
    const C = THEME.card;
    const size = o.size || 150;
    const chars = [...String(o.hanzi)].filter((c) => !/\s/.test(c));
    const syl = o.pinyin ? pinyinSyllables(o.pinyin, chars.length) : [];
    const perChar = syl.length === chars.length;
    const tones = o.toneColors !== false && perChar ? syl.map((s) => TONE_INK[s.tone]) : null;
    const hv = o.hanviet ? String(o.hanviet).trim().split(/\s+/) : [];
    const ps = Math.max(18, size * (C.pinyinAbove ? 0.3 : 0.24)), hs = Math.max(15, size * (C.pinyinAbove ? 0.18 : 0.15)), ms = o.meaningSize || Math.max(20, size * 0.2);
    const top = o.y;
    // pinyin above (sheng) needs room first
    const hy = C.pinyinAbove && syl.length ? top + ps * 1.45 : top;
    const hb = hanzi(o.hanzi, { x: o.x, y: hy, size, align: o.align, inks: C.colorHanzi ? tones : null, ink: o.ink, grid: o.grid == null ? false : o.grid, t: o.t, hold: o.hold, order: o.order, ghost: o.ghost });
    const cx = hb.x + hb.w / 2;
    const pinyinRow = (y) => {
      if (perChar) hb.boxes.forEach((b, i) => text(syl[i].text, b.cx, y, { size: ps, align: 'center', ink: tones ? tones[i] : undefined }));
      else text(syl.map((s) => s.text).join(' '), cx, y, { size: ps, align: 'center' });
    };
    let y = hy + size;
    if (syl.length) {
      if (C.pinyinAbove) pinyinRow(top + ps * 0.95);
      else { y += ps * 1.25; pinyinRow(y); y += ps * 0.3; }
    }
    if (hv.length) {
      y += hs * (C.pinyinAbove ? 1.9 : 1.35);
      if (hv.length === chars.length) hb.boxes.forEach((b, i) => text(hv[i].toUpperCase(), b.cx, y, { size: hs, align: 'center', tracking: 1.1, ink: C.muted }));
      else text(hv.join(' ').toUpperCase(), cx, y, { size: hs, align: 'center', tracking: 1.1, ink: C.muted });
    }
    if (o.meaning) { y += ms * 1.9; text(o.meaning, cx, y, { size: ms, align: 'center', ink: C.gloss }); }
    if (o.note) { y += ms * 1.55; text(o.note, cx, y, { size: ms * 0.75, align: 'center', ink: C.note }); }
    return { x: hb.x, y: top, w: hb.w, h: y - top + ms * 0.4, boxes: hb.boxes, bottom: y + ms * 0.4 };
  }

  /* -------------------- groups */

  function group(o, fn) {
    const prev = M, prevS = groupScale;
    const s = o.scale == null ? 1 : o.scale;
    const sx = (o.sx == null ? s : o.sx) * (o.flipX ? -1 : 1), sy = o.sy == null ? s : o.sy;
    const a = ((o.rotate || 0) * Math.PI) / 180;
    const ca = Math.cos(a), sa = Math.sin(a);
    // local = T(x,y) · R · S
    const L = [ca * sx, sa * sx, -sa * sy, ca * sy, o.x || 0, o.y || 0];
    M = [
      prev[0] * L[0] + prev[2] * L[1], prev[1] * L[0] + prev[3] * L[1],
      prev[0] * L[2] + prev[2] * L[3], prev[1] * L[2] + prev[3] * L[3],
      prev[0] * L[4] + prev[2] * L[5] + prev[4], prev[1] * L[4] + prev[3] * L[5] + prev[5],
    ];
    groupScale = prevS * Math.abs(s);
    try { return fn(); } finally { M = prev; groupScale = prevS; }
  }
  /** Give a part its own random stream, so editing one part does not re-roll the wobble of every later part. */
  function scoped(name, fn) {
    const prev = scope;
    scope = prev + '/' + name;
    try { return fn(); } finally { scope = prev; }
  }

  /* -------------------- convenience primitives (geometry + draw) */

  const k = {
    W, H, width: W, height: H, cx: W / 2, cy: H / 2, t, seed,
    palette: PALETTE, weights: WEIGHTS, ease: EASE, motion: (t, beats) => motion(t, beats), spring: springCurve, duration,
    follow: (t, src, o) => follow(t, src, o, duration), accel: (p, u) => accelOf(p, u, duration),
    soften, darker, lighter,
    geo,
    draw, fill, ink, shade, hatch,
    group, scope: scoped,
    toSheet: (x, y) => tx([x, y]),
    rand(a = 0, b = 1) { return lerp(a, b, shapeRng()()); },
    pick(arr) { return arr[Math.floor(shapeRng()() * arr.length)]; },
    lerp, clamp,

    line(...args) {
      let pts, o;
      if (typeof args[0] === 'number') { pts = [[args[0], args[1]], [args[2], args[3]]]; o = args[4] || {}; }
      else { pts = args[0]; o = args[1] || {}; }
      return draw(geo.path(pts), { weight: 'outline', ...o });
    },
    spline(points, o = {}) { return draw(geo.spline(points, !!o.closed), o); },
    poly(points, o = {}) { return draw(geo.poly(points), o); },
    rect(x, y, w, h, o = {}) { return draw(geo.rect(x, y, w, h), o); },
    roundRect(x, y, w, h, rad, o = {}) {
      if (typeof rad === 'object') { o = rad; rad = undefined; }
      return draw(geo.roundRect(x, y, w, h, rad), o);
    },
    ellipse(cx, cy, rx, ry, o = {}) { return draw(geo.ellipse(cx, cy, rx, ry, o), o); },
    circle(cx, cy, r, o = {}) { return draw(geo.ellipse(cx, cy, r, r, o), o); },
    blob(cx, cy, r, o = {}) { return draw(geo.blob(cx, cy, r, o), o); },
    arc(cx, cy, rx, ry, a0, a1, o = {}) {
      if (typeof a1 === 'object' || a1 === undefined) { o = a1 || {}; a1 = a0; a0 = ry; ry = rx; }
      return draw(geo.arc(cx, cy, rx, ry, a0, a1), { weight: 'detail', ...o });
    },
    tube(points, width, o = {}) { return draw(geo.tube(points, width, o), o); },
    dot(x, y, r = 3, o = {}) {
      const rr = rng();
      body.push(`<path d="${blobPath(tx([x, y]), r * groupScale, rr)}" fill="${o.fill ? soften(o.fill) : inkColor(o.ink)}"/>`);
    },

    /**
     * Symmetric silhouette from a half-profile (cups, pots, vases, bottles, bowls).
     * profile: [[halfWidth, y], ...] from top to bottom, y relative to `y`. Add 'c' as a 3rd item for a sharp corner.
     */
    turned(profile, o = {}) {
      const cx = o.cx || 0, y0 = o.y || 0;
      const right = profile.map((p) => [cx + p[0], y0 + p[1], p[2]]);
      const left = profile.slice().reverse().map((p) => [cx - p[0], y0 + p[1], p[2]]);
      // the two ends are corners by default (a flat top and base)
      right[0][2] = right[0][2] || 'c'; right[right.length - 1][2] = right[right.length - 1][2] || 'c';
      left[0][2] = left[0][2] || 'c'; left[left.length - 1][2] = left[left.length - 1][2] || 'c';
      const shape = geo.spline(right.concat(left), true);
      const top = profile[0], bot = profile[profile.length - 1];
      let widest = profile[0];
      for (const p of profile) if (p[0] > widest[0]) widest = p;
      const info = {
        shape,
        top: y0 + top[1], bottom: y0 + bot[1], cx,
        rim: { cx, y: y0 + top[1], rx: top[0], ry: top[0] * (o.rimRatio || 0.17) },
        base: { cx, y: y0 + bot[1], rx: bot[0] },
        widest: { y: y0 + widest[1], hw: widest[0] },
        halfWidthAt(yy) {
          const ry = yy - y0;
          for (let i = 1; i < profile.length; i++) {
            const a = profile[i - 1], b = profile[i];
            if ((ry >= a[1] && ry <= b[1]) || (ry <= a[1] && ry >= b[1])) return lerp(a[0], b[0], (ry - a[1]) / (b[1] - a[1] || 1));
          }
          return 0;
        },
      };
      if (o.draw !== false) {
        draw(shape, { fill: o.fill, shade: o.shade == null ? true : o.shade, hatch: o.hatch, ink: o.ink, weight: o.weight });
        if (o.rim) {
          const R = info.rim;
          const s = geo.ellipse(R.cx, R.y, R.rx, R.ry, { irregular: 0.01 });
          draw(s, { fill: o.inside || darker(o.fill || 'stone', 0.14), weight: 'detail' });
        }
      }
      return info;
    },

    /** Soft ground shadow: a flat wash ellipse, no outline, a few ground flicks. */
    shadow(cx, cy, rx, ry, o = {}) {
      ry = ry || rx * 0.16;
      const s = geo.ellipse(cx, cy, rx, ry, { irregular: 0.04 });
      fill(s, o.color || 'shadow', { opacity: o.opacity == null ? 0.9 : o.opacity, inset: 0.3 });
      if (o.lines !== false) {
        const r = shapeRng();
        const n = Math.round((o.lines || 3) * Math.min(1, ROUGH * 1.2));
        for (let i = 0; i < n; i++) {
          const yy = cy + ry * (0.15 + i * 0.32);
          const half = rx * (0.92 - i * 0.22) * (0.9 + r() * 0.15);
          const x0 = cx + (r() - 0.2) * rx * 0.25;
          k.line(x0 - half * 0.15, yy, x0 + half, yy + (r() - 0.5) * 1.5, { weight: 'fine' });
        }
      }
      return s;
    },

    text, textWidth, title, label, hanzi, word, tianzige, steady,

    /** Raw pieces, for combining frames (see svgDocument). */
    parts() { return { defs: defs.slice(), body: body.slice() }; },
    fillsUsed() { return [...fillsUsed]; },
    /** Finish: the SVG string. size = output pixel width (viewBox stays in sheet units). */
    toSVG(o = {}) {
      return svgDocument([{ defs, body }], { W, H, seed, size: o.size, transparent: o.transparent || opts.transparent, paper: o.paper, grid: o.grid });
    },
  };

  /* -------------------- higher-level pieces */
  installPieces(k, { geo, draw, fill, ink, shade, hatch, group, scoped, rng, shapeRng, body, tx });
  return k;
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
  const texture = paperOn && THEME.texture;
  if (texture) {
    parts.push(`<filter id="mottle" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="2" seed="${pseed + 7}"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.3  1.2 0 0 0 -0.5"/></filter>`);
  }
  const seen = new Set();
  for (const f of frames) for (const d of f.defs) { if (!seen.has(d)) { seen.add(d); parts.push(d); } }
  parts.push('</defs>');
  if (paperOn) {
    parts.push(`<rect width="${W}" height="${H}" fill="${o.paper ? soften(o.paper) : PALETTE.paper}"/>`);
    if (texture) parts.push(`<rect width="${W}" height="${H}" filter="url(#mottle)" opacity="0.16"/>`);
  }
  if (frames.length === 1) parts.push(...frames[0].body);
  else {
    // parts that are the same in every frame are written once, in place; only the runs that change are written
    // per frame (each run is its own set of frame groups), so drawing order is kept and files stay small
    const n = frames.length, dt = 1 / (o.fps || 10), dur = n * dt;
    parts.push(`<style>.hd-f{visibility:hidden;animation:hd-fr ${fmt(dur * 1000)}ms step-end infinite}` +
      `@keyframes hd-fr{0%{visibility:visible}${(100 / n).toFixed(3)}%{visibility:hidden}100%{visibility:hidden}}</style>`);
    const B = frames.map((f) => f.body);
    const holds = new Set();
    const styleAt = parts.length - 1;
    const frameGroups = (slice) => {
      // consecutive identical frames (a held pose) become one group that stays visible for all of them
      let i = 0;
      while (i < n) {
        const body = slice(B[i]).join('\n');
        let k = 1;
        while (i + k < n && slice(B[i + k]).join('\n') === body) k++;
        if (k > 1) holds.add(k);
        // frame 0 is also the static fallback (renderers without CSS animation show it)
        parts.push(`<g class="hd-f${k > 1 ? ' hd-h' + k : ''}" style="animation-delay:${fmt(i * dt * 1000)}ms${i === 0 ? ';visibility:visible' : ''}">`);
        parts.push(body);
        parts.push('</g>');
        i += k;
      }
    };
    if (B.every((b) => b.length === B[0].length)) {
      let i = 0;
      while (i < B[0].length) {
        const same = (j) => B.every((b) => b[j] === B[0][j]);
        if (same(i)) { parts.push(B[0][i]); i++; continue; }
        let j = i;
        while (j < B[0].length && !same(j)) j++;
        const a = i, z = j;
        frameGroups((b) => b.slice(a, z));
        i = j;
      }
    } else {
      // frames differ in length: share only the common start and end
      let pre = 0, post = 0;
      const minLen = Math.min(...B.map((b) => b.length));
      while (pre < minLen && B.every((b) => b[pre] === B[0][pre])) pre++;
      while (post < minLen - pre && B.every((b) => b[b.length - 1 - post] === B[0][B[0].length - 1 - post])) post++;
      parts.push(...B[0].slice(0, pre));
      frameGroups((b) => b.slice(pre, b.length - post));
      if (post) parts.push(...B[0].slice(B[0].length - post));
    }
    for (const k of holds) parts[styleAt] = parts[styleAt].replace('</style>',
      `.hd-h${k}{animation-name:hd-fr${k}}@keyframes hd-fr${k}{0%{visibility:visible}${((100 * k) / n).toFixed(3)}%{visibility:hidden}100%{visibility:hidden}}</style>`);
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

/* ================================================================== pieces */
// Each piece is drawn in its own local units and placed with a group, so it works at any size.
// All take (x, groundY or top, options) in the current coordinates and return anchor points.

function installPieces(k, I) {
  const { geo, draw, group, scoped } = I;

  /** A single leaf. (x, y) = where it joins the stem; angle in degrees (0 = pointing right, -90 = up). */
  k.leaf = (x, y, o = {}) => {
    const len = o.len || 60, wd = (o.width || 0.42) * len;
    return group({ x, y, rotate: o.angle == null ? -45 : o.angle }, () => scoped('leaf', () => {
      const s = geo.spline([[0, 0, 'c'], [len * 0.28, -wd * 0.5], [len * 0.7, -wd * 0.42], [len, 0, 'c'], [len * 0.68, wd * 0.45], [len * 0.26, wd * 0.48]], true);
      draw(s, { fill: o.fill || 'leaf', shade: o.shade == null ? 0.35 : o.shade, weight: o.weight || 'detail' });
      if (o.vein !== false) k.line([[len * 0.06, 0], [len * 0.45, -wd * 0.04], [len * 0.84, -wd * 0.02]].map((p) => p), { weight: 'fine' });
      return { tip: k.toSheet(len, 0) };
    }));
  };

  /** Round shrub sitting on the ground. */
  k.shrub = (x, groundY, o = {}) => {
    const r = o.r || 90;
    return scoped('shrub', () => {
      const s = geo.blob(x, groundY - r * 0.78, r, { squash: 0.82, bumps: o.bumps || 8, bump: 0.13 });
      draw(s, { fill: o.fill || 'green', shade: 0.32 });
      for (let i = 0; i < (o.marks == null ? 5 : o.marks); i++) {
        const a = -2.6 + i * 0.55 + k.rand(-0.2, 0.2), rr = r * k.rand(0.25, 0.6);
        const cx = x + Math.cos(a) * rr, cy = groundY - r * 0.78 + Math.sin(a) * rr * 0.8 + r * 0.25;
        k.arc(cx, cy, r * 0.09, r * 0.06, 200, 340, { weight: 'fine' });
      }
      if (o.flowers) for (let i = 0; i < o.flowers; i++) {
        const a = k.rand(0, TAU), rr = r * k.rand(0.2, 0.7);
        k.circle(x + Math.cos(a) * rr, groundY - r * 0.8 + Math.sin(a) * rr * 0.7, r * 0.06, { fill: o.flowerFill || 'pink', weight: 'fine' });
      }
      return { top: groundY - r * 1.6, cx: x };
    });
  };

  /** Lollipop/cloud tree standing on the ground. h = total height. */
  k.tree = (x, groundY, o = {}) => {
    const h = o.h || 400;
    return group({ x, y: groundY, scale: h / 100 }, () => scoped('tree', () => {
      k.shadow(0, 0, 26, 4, { lines: 2 });
      const trunk = geo.spline([[-5.5, 0, 'c'], [-4, -18], [-3.4, -42, 'c'], [3.4, -42, 'c'], [4, -18], [5.5, 0, 'c']], true);
      draw(trunk, { fill: o.trunk || 'wood', shade: 0.4 });
      k.line([[0.4, -26], [6, -36], [9, -44]], { weight: 'detail' });
      const crown = geo.blob(0, -64, 34, { squash: o.squash || 0.98, bumps: o.bumps || 10, bump: 0.11 });
      draw(crown, { fill: o.fill || 'green', shade: 0.3 });
      const marks = [[-14, -70], [8, -78], [14, -58], [-4, -54], [-18, -52], [2, -88]];
      for (const [mx, my] of marks.slice(0, o.marks == null ? 6 : o.marks)) k.arc(mx, my, 4, 3, 200, 340, { weight: 'fine' });
      if (o.fruit) for (const [fx, fy] of [[-16, -60], [10, -66], [-2, -80], [18, -76], [-8, -46]].slice(0, o.fruit)) k.circle(fx, fy, 3, { fill: o.fruitFill || 'red', weight: 'fine' });
      return { top: k.toSheet(0, -98), crown: k.toSheet(0, -64) };
    }));
  };

  /** Cat. pose 'sit' (front view) or 'sleep' (curled, side view). size = height for sit, length for sleep. */
  k.cat = (x, groundY, o = {}) => {
    const pose = o.pose || 'sit';
    const fillC = o.fill || 'orange';
    const size = o.size || 300;
    const t = o.t == null ? k.t : o.t;
    const sway = o.animate ? Math.sin(TAU * t) : 0;
    if (pose === 'sleep') return group({ x, y: groundY, scale: size / 100, flipX: o.facing === 'left' }, () => scoped('cat-sleep', () => {
      if (o.shadow !== false) k.shadow(0, 0, 54, 5, { lines: 2 });
      // tail behind the body, curling round to the front
      const body = geo.blob(4, -22, 46, { squash: 0.5, irregular: 0.02 });
      draw(body, { fill: fillC, shade: 0.4 });
      if (o.stripes !== false) for (const sx of [-6, 6, 18]) k.arc(sx, -36, 6, 7, 205, 335, { weight: 'detail' });
      k.tube([[48, -14], [44, -3], [20, 1], [-14, 0], [-30, -5 + sway * 2]], [7, 5], { fill: fillC, weight: 'detail' });
      // head resting on the left
      group({ x: -34, y: -26 }, () => {
        k.poly([[-18, -6], [-17, -24], [-6, -15]], { fill: fillC, weight: 'detail' });
        k.poly([[4, -15], [12, -25], [15, -8]], { fill: fillC, weight: 'detail' });
        k.poly([[-15.5, -9], [-15, -19], [-9, -14]], { fill: 'pink', ink: false });
        draw(geo.blob(-2, -2, 17, { squash: 0.82 }), { fill: fillC, shade: 0.35 });
        k.arc(-9, -2, 3.6, 2.4, 20, 160, { weight: 'detail' });
        k.arc(4, -2, 3.6, 2.4, 20, 160, { weight: 'detail' });
        k.poly([[-3.6, 3], [-0.6, 3], [-2.1, 5]], { fill: 'pink', weight: 'fine' });
        k.ellipse(-13, 4, 3.2, 2, { fill: 'blush', ink: false });
        k.ellipse(9, 4, 3.2, 2, { fill: 'blush', ink: false });
      });
      // front paw
      k.ellipse(-20, -4, 7, 4, { fill: fillC, weight: 'detail' });
      return { head: k.toSheet(-36, -28), top: k.toSheet(0, -48), tail: k.toSheet(-32, -6) };
    }));

    return group({ x, y: groundY, scale: size / 100, flipX: o.facing === 'left' }, () => scoped('cat-sit', () => {
      if (o.shadow !== false) k.shadow(4, 0, 42, 5, { lines: 2 });
      // tail: behind the body, sweeping out to the right and curling up
      const tip = [52 + sway * 5, -40 - Math.abs(sway) * 2];
      k.tube([[18, -4], [40, -6], [50, -18], tip], [9, 7], { fill: fillC, weight: 'detail' });
      // body: a soft pear
      const body = geo.spline([[-31, 0, 'c'], [-36, -12], [-30, -32], [-14, -52], [14, -52], [30, -32], [36, -12], [31, 0, 'c']], true);
      draw(body, { fill: fillC, shade: 0.3 });
      // chest patch
      if (o.bib !== false) k.spline([[-9, -50], [-12, -34], [-7, -18], [0, -14], [7, -18], [12, -34], [9, -50]], { closed: true, fill: o.bibFill || 'cream', ink: false });
      // front legs + paws
      k.line([[-6, -26], [-7, -4]], { weight: 'detail' });
      k.line([[6, -26], [7, -4]], { weight: 'detail' });
      k.ellipse(-11, -3, 8.5, 4.6, { fill: fillC, weight: 'detail' });
      k.ellipse(11, -3, 8.5, 4.6, { fill: fillC, weight: 'detail' });
      // ears (behind the head)
      k.poly([[-23, -62], [-20, -91], [-6, -77]], { fill: fillC });
      k.poly([[23, -62], [20, -91], [6, -77]], { fill: fillC });
      k.poly([[-19, -70], [-18.5, -84], [-10, -76]], { fill: 'pink', ink: false });
      k.poly([[19, -70], [18.5, -84], [10, -76]], { fill: 'pink', ink: false });
      // head
      const head = geo.blob(0, -66, 26, { squash: 0.84, irregular: 0.02 });
      draw(head, { fill: fillC, shade: 0.3 });
      if (o.stripes !== false) for (const sx of [-6, 0, 6]) k.line([[sx, -86], [sx * 1.1, -79]], { weight: 'detail' });
      // face
      const eyes = o.eyes || 'open';
      const blink = o.animate && t > 0.86 && t < 0.94;
      if (eyes === 'closed' || blink) {
        k.arc(-10, -66, 5, 3.4, 20, 160, { weight: 'detail' });
        k.arc(10, -66, 5, 3.4, 20, 160, { weight: 'detail' });
      } else {
        k.dot(-10, -66, 3.1);
        k.dot(10, -66, 3.1);
        k.dot(-9, -67.4, 0.9, { fill: 'white' });
        k.dot(11, -67.4, 0.9, { fill: 'white' });
      }
      k.poly([[-2.6, -60], [2.6, -60], [0, -57]], { fill: 'pink', weight: 'fine' });
      k.spline([[-5, -54], [-2.5, -52.5], [0, -54.5], [2.5, -52.5], [5, -54]], { weight: 'fine' });
      k.ellipse(-16, -58, 4.5, 2.6, { fill: 'blush', ink: false });
      k.ellipse(16, -58, 4.5, 2.6, { fill: 'blush', ink: false });
      for (const s of [-1, 1]) {
        k.line([[s * 20, -60], [s * 36, -63]], { weight: 'fine' });
        k.line([[s * 20, -57], [s * 36, -56]], { weight: 'fine' });
      }
      return { head: k.toSheet(0, -66), top: k.toSheet(0, -91), tail: k.toSheet(...tip), paws: k.toSheet(0, -3) };
    }));
  };

  /** Person, front view, cute proportions. h = total height. */
  k.person = (x, groundY, o = {}) => {
    const h = o.h || 400;
    const skin = o.skin || 'skin', shirt = o.shirt || 'blue', pants = o.pants || 'navy', hair = o.hair || 'hair';
    const style = o.hairStyle || (o.bun ? 'bun' : 'short');
    const t = o.t == null ? k.t : o.t;
    // wave: the raised forearm swings left <-> right around the elbow, ±24°, one swing per loop
    const wave = o.wave ? ((o.waveAngle != null ? o.waveAngle : 28 * Math.sin(TAU * t)) * Math.PI) / 180 : null;
    const elbOf = (a) => [25 + 14 * Math.sin(a), -57 - 14 * Math.cos(a)]; // wrist of the waving arm
    return group({ x, y: groundY, scale: h / 100 }, () => scoped('person', () => {
      if (o.shadow !== false) k.shadow(0, 0, 18, 2.6, { lines: 2 });
      // legs
      k.tube([[-5, -36], [-5.5, -18], [-6, -4]], 7.5, { fill: pants, weight: 'detail', cap: 'flat' });
      k.tube([[5, -36], [5.5, -18], [6, -4]], 7.5, { fill: pants, weight: 'detail', cap: 'flat' });
      k.ellipse(-7.5, -2.2, 6, 2.8, { fill: o.shoes || 'charcoal', weight: 'detail' });
      k.ellipse(7.5, -2.2, 6, 2.8, { fill: o.shoes || 'charcoal', weight: 'detail' });
      // arms (behind torso)
      k.tube([[-11, -60], [-15, -48], [-16, -38]], 6, { fill: shirt, weight: 'detail' });
      let rh;
      if (o.rightArm === false) rh = null; // the scene draws its own right arm (from the returned `shoulder`)
      else if (wave == null) {
        rh = [16, -36];
        k.tube([[11, -60], [15, -48], [16, -38]], 6, { fill: shirt, weight: 'detail' });
      } else {
        const elb = [25, -57], L = 14, sx = Math.sin(wave), sy = Math.cos(wave);
        rh = [elb[0] + (L + 2) * sx, elb[1] - (L + 2) * sy];
        k.tube([[11, -61], [18, -59.5], elb], 6, { fill: shirt, weight: 'detail' });              // upper arm
        k.tube([elb, [elb[0] + L * sx, elb[1] - L * sy]], 6, { fill: shirt, weight: 'detail' });   // forearm
      }
      k.circle(-16, -36, 3.4, { fill: skin, weight: 'fine' });
      if (rh == null) { /* no right arm */ } else if (wave == null) k.circle(rh[0], rh[1], 3.4, { fill: skin, weight: 'fine' });
      else {
        // open hand, five fingers spread, palm to the viewer; turns with the forearm
        const wr = [elbOf(wave)[0], elbOf(wave)[1]];
        k.hand(wr[0], wr[1], { size: 7, angle: (wave * 180) / Math.PI, fill: skin });
        rh = [wr[0] + 8 * Math.sin(wave), wr[1] - 8 * Math.cos(wave)];
      }
      // torso
      const torso = geo.spline([[-11, -64], [-12.5, -50], [-12, -34, 'c'], [12, -34, 'c'], [12.5, -50], [11, -64]], true);
      draw(torso, { fill: shirt, shade: 0.35 });
      k.line([[-4, -64], [0, -60], [4, -64]], { weight: 'fine' });
      // hair behind the head (bob, two buns)
      if (style === 'bob') draw(geo.spline([[-13.6, -66, 'c'], [-14.2, -80], [-9, -90], [9, -90], [14.2, -80], [13.6, -66, 'c']], true), { fill: hair, weight: 'detail' });
      if (style === 'buns') { k.circle(-8, -92.5, 3.8, { fill: hair, weight: 'detail' }); k.circle(8, -92.5, 3.8, { fill: hair, weight: 'detail' }); }
      // head
      k.rect(-2.4, -68, 4.8, 5, { fill: skin, ink: false });
      draw(geo.blob(0, -78, 11.5, { squash: 1.02, irregular: 0.02 }), { fill: skin, shade: o.faceShade == null ? 0.1 : o.faceShade }); // light: a heavy half-face shadow reads as a mask
      // hair cap
      const hairS = geo.spline([[-12, -76, 'c'], [-11.5, -86], [-4, -91], [6, -90], [11.5, -85], [12.2, -76, 'c'], [8, -81], [0, -82.5], [-6, -80]], true);
      // short: side-swept cap. bangs / bob / buns: straight fringe across the forehead (齐刘海)
      const bangs = geo.spline([[-12.4, -74, 'c'], [-12, -86], [-4, -91.2], [5, -90.6], [12, -86], [12.4, -74, 'c'], [10.6, -80.6, 'c'], [-10.6, -80.6, 'c']], true);
      draw(style === 'short' || style === 'bun' ? hairS : bangs, { fill: hair, weight: 'detail' });
      if (style === 'bun') k.circle(0, -92, 4.5, { fill: hair, weight: 'detail' });
      if (o.eyes === 'closed') { k.arc(-4, -77, 2, 1.1, 15, 165, { weight: 'detail' }); k.arc(4, -77, 2, 1.1, 15, 165, { weight: 'detail' }); }
      else { k.dot(-4, -76.5, 1.05); k.dot(4, -76.5, 1.05); }
      k.arc(0, -72.5, 3, 1.6, 20, 160, { weight: 'fine' });
      k.ellipse(-7, -73, 2, 1.1, { fill: 'blush', ink: false });
      k.ellipse(7, -73, 2, 1.1, { fill: 'blush', ink: false });
      return { head: k.toSheet(0, -78), top: k.toSheet(0, -91), hand: rh ? k.toSheet(...rh) : null, feet: k.toSheet(0, 0),
               shoulder: k.toSheet(11, -61), mouth: k.toSheet(0, -72.5), unit: h / 100 };
    }));
  };

  /**
   * Hand with five fingers, palm towards the viewer. (x, y) = wrist; angle in degrees (0 = fingers up, + = clockwise);
   * size = palm width. side: 'right' (thumb on the viewer's left, a right hand facing you) or 'left'.
   * spread: 0 (fingers together) … 1 (wide open, default 0.7). curl: 0 (straight) … 1 (fist-ish).
   */
  k.hand = (x, y, o = {}) => {
    const w = o.size || 40, ph = w * 1.0, fill = o.fill || 'skin';
    const m = o.side === 'left' ? -1 : 1, spread = o.spread == null ? 0.7 : o.spread, curl = o.curl || 0;
    return group({ x, y, rotate: o.angle || 0, sx: m, sy: 1, scale: 1 }, () => scoped('hand', () => {
      const fw = w * 0.24;
      // fingers (behind the palm): index → pinky, fanned out from the top of the palm
      const fingers = [[-0.34, 0.74, -1], [-0.115, 0.84, -0.35], [0.115, 0.78, 0.35], [0.33, 0.6, 1]];
      for (const [fx, len, dir] of fingers) {
        const a = (dir * 11 * spread * Math.PI) / 180, L = len * ph * (1 - curl * 0.55);
        const b = [fx * w, -ph * 0.78];
        const tip = [b[0] + Math.sin(a) * L, b[1] - Math.cos(a) * L];
        const mid = [(b[0] + tip[0]) / 2 + curl * fw * 0.6, (b[1] + tip[1]) / 2];
        k.tube([b, mid, tip], [fw, fw * 0.88], { fill, weight: o.weight || 'fine' });
      }
      // thumb, out to the side and up
      const ta = ((-30 - 22 * spread) * Math.PI) / 180;
      const tb = [-w * 0.32, -ph * 0.22], tl = ph * 0.62;
      k.tube([tb, [tb[0] + Math.sin(ta) * tl * 0.55, tb[1] - Math.cos(ta) * tl * 0.5], [tb[0] + Math.sin(ta) * tl, tb[1] - Math.cos(ta) * tl * 0.95]], [fw * 1.1, fw * 0.95], { fill, weight: o.weight || 'fine' });
      // palm
      draw(geo.spline([[-w * 0.27, 0, 'c'], [-w * 0.47, -ph * 0.36], [-w * 0.5, -ph * 0.8], [0, -ph * 0.93], [w * 0.5, -ph * 0.8], [w * 0.45, -ph * 0.36], [w * 0.27, 0, 'c']], true), { fill, weight: 'fine', shade: 0.12 });
      // palm crease
      k.arc(w * 0.04, -ph * 0.4, w * 0.22, ph * 0.16, 205, 315, { weight: 'fine' });
      return { wrist: k.toSheet(0, 0), center: k.toSheet(0, -ph * 0.5), tip: k.toSheet(-0.11 * w, -ph * 1.5) };
    }));
  };

  /**
   * A hand holding something upright (a glass, a cup, a phone, a handle), seen from the front: the back of the hand on
   * one side of the object, four fingers wrapped across its front, thumb hidden behind (`thumb: true` shows its tip).
   * (x, y) = where the hand meets the object's edge, at mid-grip. size = grip height (4 fingers). across = how far the
   * fingers reach over the front (≈ the object's width). side: 'right' = the hand comes from the right (a person's
   * right hand in a front view), 'left' mirrors it. angle = the object's tilt in degrees (the grip turns with it).
   * Draw it AFTER the object. Returns { wrist } (where the forearm joins).
   */
  k.grip = (x, y, o = {}) => {
    const s = o.size || 60, across = o.across == null ? s * 1.1 : o.across, fill = o.fill || 'skin';
    const m = o.side === 'left' ? -1 : 1;
    return group({ x, y, rotate: o.angle || 0 }, () => group({ sx: m, sy: 1 }, () => scoped('grip', () => {
      const fw = s * 0.27;
      // back of the hand, just outside the object's edge
      draw(geo.spline([[s * 0.05, -s * 0.5], [s * 0.42, -s * 0.46], [s * 0.62, -s * 0.1], [s * 0.6, s * 0.3], [s * 0.36, s * 0.52], [s * 0.04, s * 0.48]], true), { fill, weight: o.weight || 'fine', shade: 0.18 });
      if (o.thumb) k.tube([[s * 0.2, -s * 0.42], [-s * 0.05, -s * 0.6], [-s * 0.28, -s * 0.66]], [fw * 1.05, fw * 0.9], { fill, weight: o.weight || 'fine' });
      // fingers across the front, index on top; each a little shorter going down
      [[-0.36, 1], [-0.12, 0.97], [0.12, 0.9], [0.35, 0.74]].forEach(([fy, len]) => {
        const y0 = fy * s, x1 = s * 0.18 - (across * 0.78 + s * 0.15) * len;
        k.tube([[s * 0.22, y0], [(s * 0.22 + x1) / 2, y0 + s * 0.02], [x1, y0 - s * 0.01]], [fw, fw * 0.92], { fill, weight: o.weight || 'fine' });
      });
      return { wrist: k.toSheet(s * 0.55, s * 0.1) };
    })));
  };

  /**
   * Liquid in a container that tips: the surface stays level in the world and the amount stays the same.
   * poly = the container's inside in its own coordinates (y down, opening at the top); tilt = the container's rotation
   * in degrees (the same angle you draw it with); fill = 0…1 of the container's area. Returns the liquid polygon (same
   * local coordinates, draw it inside the container's group) and its surface line, or null if empty.
   */
  k.liquid = (poly, o = {}) => {
    const tr = ((o.tilt || 0) * Math.PI) / 180, fillF = clamp(o.fill == null ? 0.6 : o.fill, 0, 1);
    const n = [Math.sin(tr), Math.cos(tr)];                          // world "down", in local coordinates
    const area = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
    const cut = (d) => {                                              // keep the part below the level p·n = d
      const out = [];
      poly.forEach((p, i) => {
        const q = poly[(i + 1) % poly.length], a = p[0] * n[0] + p[1] * n[1] - d, b = q[0] * n[0] + q[1] * n[1] - d;
        if (a >= 0) out.push(p);
        if ((a >= 0) !== (b >= 0)) { const f = a / (a - b); out.push([p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]); }
      });
      return out;
    };
    const target = area(poly) * fillF;
    const ds = poly.map((p) => p[0] * n[0] + p[1] * n[1]);
    let lo = Math.min(...ds), hi = Math.max(...ds);
    for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; if (area(cut(mid)) > target) lo = mid; else hi = mid; }
    const P = cut((lo + hi) / 2);
    if (P.length < 3) return null;
    // the surface: the two cut points (on the level line)
    const d = (lo + hi) / 2, onLine = P.filter((p) => Math.abs(p[0] * n[0] + p[1] * n[1] - d) < 1e-6);
    return { poly: P, surface: onLine.length >= 2 ? [onLine[0], onLine[onLine.length - 1]] : null };
  };

  /* ---- chibi person ----
   * Big head, bean body, short tapered limbs: reads at flashcard size and suits 简笔画. Local units: 100 = height.
   *   head: head height as a share of the whole (0.33 … 0.5, default 0.4)
   *   expression: 'neutral' | 'happy' | 'closed' | 'tired' | 'surprised' | 'sad' | 'angry' | 'scared'
   *   hairStyle: 'short' (side fringe + tuft) | 'bangs' | 'bob' | 'buns';  hair, skin, shirt, pants, shoes colours
   *   wave: degrees → right arm raised, forearm swinging by that angle, open five-finger hand
   *   reach: { right: [x, y], left: [x, y] } (sheet coords) → that arm bends to put its wrist there (draw the held
   *          thing and k.grip on top). Without wave/reach an arm hangs with a round mitten hand.
   * k.chibiLayout(x, groundY, o) gives the same anchors without drawing (to place things before drawing).
   */
  const chibiGeom = (o) => {
    const head = clamp(o.head || 0.45, 0.28, 0.55), headH = head * 100, rH = headH / 2;   // 0.4–0.5 = 二头半身 … 二头身
    const hy = -(100 - rH), body = 100 - headH, legH = body * 0.4, tB = -legH, tT = -(100 - headH) - 4;
    const sw = rH * 0.5, hw = rH * 0.66, armW = rH * 0.34, armL = (tB - tT) * 0.9;
    // turn: 0 front, -1 / 1 three-quarter view facing the viewer's left / right. The face features slide toward the
    // facing side, the far eye narrows, the far shoulder tucks in behind the body.
    const f = Math.sign(o.turn || 0), dx = f * rH * 0.34;
    const shoulder = (side) => (f && side === f ? [f * hw * 0.55, tT + (tB - tT) * 0.22] : [side * hw * (f ? 0.92 : 0.86), tT + (tB - tT) * 0.2]);   // at the edge of the body
    const eyes = f ? [[dx - f * rH * 0.34, hy + rH * 0.2], [dx + f * rH * 0.28, hy + rH * 0.2]] : [[-rH * 0.4, hy + rH * 0.2], [rH * 0.4, hy + rH * 0.2]];
    const mouth = [dx + f * rH * 0.06, hy + rH * 0.56];                               // Q版: features sit in the lower half of the face
    // headTilt (degrees, + = clockwise on screen) turns the head about the neck: tip it back to drink, down to read
    const neck = [0, tT + 1], ta = ((o.headTilt || 0) * Math.PI) / 180;
    const tilt = (p) => [neck[0] + (p[0] - neck[0]) * Math.cos(ta) - (p[1] - neck[1]) * Math.sin(ta), neck[1] + (p[0] - neck[0]) * Math.sin(ta) + (p[1] - neck[1]) * Math.cos(ta)];
    return { head, rH, hy, legH, tB, tT, sw, hw, armW, armL, shoulder, f, dx, neck, ta, tilt,
      mouth, mouthT: tilt(mouth), headT: tilt([0, hy]), eyes };
  };
  k.chibiLayout = (x, groundY, o = {}) => {
    const G = chibiGeom(o), s = (o.h || 400) / 100, S = (p) => [x + p[0] * s, groundY + p[1] * s];
    return { unit: s, head: S(G.headT), top: S(G.tilt([0, G.hy - G.rH])), mouth: S(G.mouthT), shoulderR: S(G.shoulder(1)),
      shoulderL: S(G.shoulder(-1)), armLength: G.armL * s, armWidth: G.armW * s, feet: [x, groundY] };
  };
  k.chibi = (x, groundY, o = {}) => {
    const G = chibiGeom(o), h = o.h || 400, s = h / 100;
    const skin = o.skin || 'skin', shirt = o.shirt || 'sky', pants = o.pants || 'navy', hair = o.hair || 'hair', shoes = o.shoes || 'charcoal';
    const style = o.hairStyle || 'short', expr = o.expression || 'neutral';
    const rich = o.detail === 'rich';   // restrained Q版 with more detail: brows, eye shine, nose, ears, collar points, cuffs, thumbs, hair strands
    const { rH, hy, tB, tT, hw, armW, armL } = G;
    const toLocal = (p) => [(p[0] - x) / s, (p[1] - groundY) / s];
    const out = {};
    const OW = o.weight || 'bold';                  // Q版: a thick, even outline (inner marks stay 'detail')
    const prevStroke = STROKE; STROKE = 'marker';   // people always get the even line, even when objects use the brush
    try { return chibiDraw(); } finally { STROKE = prevStroke; }
    function chibiDraw() { return group({ x, y: groundY, scale: s }, () => scoped('chibi', () => {
      if (o.shadow !== false) k.shadow(0, 0, hw * 1.3, 3.2, { lines: 2 });
      // legs + shoes
      const F = G.f;
      for (const sd of F ? [F, -F] : [-1, 1]) {   // far leg first
        const lx = sd * hw * (F && sd === F ? 0.3 : 0.42);
        k.tube([[lx, tB - 3], [lx + F * hw * 0.04, -4]], [hw * 0.56, hw * 0.5], { fill: pants, weight: OW, cap: 'flat' });
        const fx = lx + F * hw * 0.16 + (F ? 0 : sd * hw * 0.08);   // feet point toward the facing side
        k.ellipse(fx, -2.8, hw * 0.42, 3.3, { fill: shoes, weight: OW });
        if (rich) k.line(fx - hw * 0.36, -1.4, fx + hw * 0.36, -1.4, { weight: 'fine' });   // sole
      }
      // arms: hanging ones go behind the body, raised / reaching ones in front
      const mitten = (p, sd) => {
        if (rich) k.ellipse(p[0] - sd * armW * 0.5, p[1] - armW * 0.2, armW * 0.28, armW * 0.36, { fill: skin, weight: OW });   // thumb, toward the body
        k.circle(p[0], p[1], armW * 0.62, { fill: skin, weight: OW });
      };
      const hang = (sd) => {
        const S = G.shoulder(sd), E = [S[0] + sd * armW * 0.55, S[1] + armL * 0.5], W = [S[0] + sd * armW * 0.75, S[1] + armL * 0.92];
        k.tube([S, E, W], [armW, armW * 0.86], { fill: shirt, weight: OW });
        if (rich) k.line(W[0] - armW * 0.46, W[1] - armW * 0.25, W[0] + armW * 0.46, W[1] - armW * 0.2, { weight: 'detail' });   // cuff
        mitten([W[0], W[1] + armW * 0.35], sd);
        out[sd > 0 ? 'handR' : 'handL'] = k.toSheet(W[0], W[1] + armW * 0.35);
      };
      // two-bone arm, solved in 3D and projected (how rigs do it: Juckett's analytic two-bone IK + a pole vector).
      // Bones keep their 3D length: when the hand comes close to the shoulder on screen, it is in front of the body,
      // toward the viewer, so the arm reads foreshortened instead of folding shut or flipping. The elbow sits on the
      // side of a fixed pole (default: out to the side and a little down), so it never jumps between the two
      // mirror-image solutions mid-move. `rightPole` / `leftPole`: [x, y] or [x, y, z] direction (z = toward the
      // viewer), in the person's frame: +x = the arm's own side.
      const ik = (sd, Tsheet, poleIn) => {
        const S = G.shoulder(sd), T = toLocal(Tsheet), a = armL * 0.52, b = armL * 0.5;
        const dx = T[0] - S[0], dy = T[1] - S[1], d2 = Math.hypot(dx, dy);
        const R = Math.max(d2, (a + b) * 0.86);                          // comfortable 3D reach: the rest goes into depth
        const dz = Math.sqrt(Math.max(0, R * R - d2 * d2));              // + = toward the viewer
        const dist = Math.min(Math.hypot(dx, dy, dz), a + b - 0.3), n = [dx, dy, dz].map((v) => v / (Math.hypot(dx, dy, dz) || 1));
        const pl = poleIn || [1, 0.45, -0.15], pv = [sd * pl[0], pl[1], pl[2] || 0];
        const pn = pv[0] * n[0] + pv[1] * n[1] + pv[2] * n[2];
        let q = [pv[0] - pn * n[0], pv[1] - pn * n[1], pv[2] - pn * n[2]];   // the pole, square to shoulder→hand
        const ql = Math.hypot(...q) || 1; q = q.map((v) => v / ql);
        const ca = clamp((a * a + dist * dist - b * b) / (2 * a * dist), -1, 1), sa = Math.sqrt(1 - ca * ca);
        const E3 = [0, 1, 2].map((i) => a * (ca * n[i] + sa * q[i]));      // elbow, relative to the shoulder
        const E = [S[0] + E3[0], S[1] + E3[1]];
        const Wr = [S[0] + n[0] * dist, S[1] + n[1] * dist];              // = T unless out of reach
        k.tube([S, E, Wr], [armW, armW * 0.84], { fill: shirt, weight: OW });
        if (Math.hypot(E3[0], E3[1]) > a * 0.6) k.arc(E[0], E[1], armW * 0.32, armW * 0.18, 200, 340, { weight: 'fine' });   // a fold at the elbow (not when it points at the viewer)
        out[sd > 0 ? 'wristR' : 'wristL'] = k.toSheet(...Wr);
        out[sd > 0 ? 'elbowR' : 'elbowL'] = k.toSheet(...E);
      };
      const front = [];
      for (const sd of [1, -1]) {
        const key = sd > 0 ? 'right' : 'left';
        if (sd > 0 && o.wave != null) front.push(() => {
          const S = G.shoulder(1), E = [S[0] + rH * 0.95, S[1] - armL * 0.05], sw = (o.wave * Math.PI) / 180;  // elbow out past the hair
          const W = [E[0] + Math.sin(sw) * armL * 0.55, E[1] - Math.cos(sw) * armL * 0.55];
          k.tube([S, E, W], [armW, armW * 0.86], { fill: shirt, weight: OW });
          k.hand(W[0], W[1], { size: armW * 1.25, angle: o.wave, fill: skin, weight: 'outline' });
          out.handR = k.toSheet(...W);
        });
        else if (o.reach && o.reach[key]) front.push(() => ik(sd, o.reach[key], o[key + 'Pole'] || o.reach[key + 'Pole']));
        else hang(sd);
      }
      // body: a bean, wider at the hips; a round collar under the chin
      draw(geo.spline([[-G.sw, tT + 2], [-hw * 1.04, tT + (tB - tT) * 0.6], [-hw * 0.9, tB + 0.5], [0, tB + 1.5], [hw * 0.9, tB + 0.5], [hw * 1.04, tT + (tB - tT) * 0.6], [G.sw, tT + 2], [0, tT - 1.5]], true), { fill: shirt, shade: 0.25, weight: OW });
      if (rich) for (const sd of [-1, 1]) k.poly([[G.f * rH * 0.18 + sd * rH * 0.04, tT + 0.5], [G.f * rH * 0.18 + sd * rH * 0.36 * (G.f && sd === G.f ? 0.7 : 1), tT + 0.2], [G.f * rH * 0.18 + sd * rH * 0.24 * (G.f && sd === G.f ? 0.7 : 1), tT + rH * 0.3]], { fill: o.collar || (PALETTE.paperwhite ? 'paperwhite' : 'white'), weight: 'detail' });   // shirt collar points
      else k.arc(0, tT + 1.5, rH * 0.26, rH * 0.1, 15, 165, { weight: 'detail' });                    // collar (under the chin)
      // the head (hair, ears, face) is drawn about the neck so headTilt can turn it
      const hc = Math.cos(G.ta), hsn = Math.sin(G.ta), N = G.neck;
      group({ x: N[0] - (N[0] * hc - N[1] * hsn), y: N[1] - (N[0] * hsn + N[1] * hc), rotate: o.headTilt || 0 }, () => {
      // Q版 hair: a big rounded mass that's wider and taller than the head, so it owns the silhouette
      // (turned: the hair mass shifts toward the back of the head, the fringe follows the face)
      const Pm = (xo) => (pts) => pts.map(([a, b, c]) => [a * rH + xo, hy + b * rH, c]);
      const P = Pm(-F * rH * 0.1), PF = Pm(-F * rH * 0.03);   // hair sits back on the head; the fringe stays with it (no notch)
      const backLen = style === 'bob' ? 0.78 : style === 'short' ? 0.05 : 0.3;
      draw(geo.spline(P([[-1.16, backLen, 'c'], [-1.24, -0.35], [-0.86, -1.08], [0, -1.26], [0.86, -1.08], [1.24, -0.35], [1.16, backLen, 'c']]), true), { fill: hair, weight: OW });
      if (style === 'buns') for (const sd of [-1, 1]) k.circle(sd * rH * 0.74, hy - rH * 1.02, rH * 0.34, { fill: hair, weight: OW });
      if (style !== 'bob') for (const sd of F ? [-F] : [-1, 1]) { const ex0 = F ? -F * rH * 0.82 : sd * rH * 1.04; k.ellipse(ex0, hy + rH * 0.2, rH * 0.15, rH * 0.2, { fill: skin, weight: OW }); if (rich) k.arc(ex0, hy + rH * 0.2, rH * 0.07, rH * 0.1, sd > 0 ? 100 : -80, sd > 0 ? 260 : 80, { weight: 'fine' }); }
      k.ellipse(F * rH * 0.05, hy + rH * 0.04, rH * 1.04, rH * 0.98, { fill: skin, shade: 0.08, weight: OW });   // turned: the face bulges toward where it looks
      // fringe: chunky rounded clumps over the forehead (side-swept for 'short', straight for the others)
      const fringe = style === 'short'
        ? PF([[-1.17, 0.0, 'c'], [-1.2, -0.5], [-0.8, -1.06], [0, -1.24], [0.8, -1.06], [1.2, -0.5], [1.17, 0.0, 'c'], [0.98, -0.3], [0.7, -0.36, 'c'], [0.5, -0.12], [0.22, -0.36, 'c'], [-0.1, -0.2], [-0.42, -0.4, 'c'], [-0.74, -0.24], [-1.0, -0.36]])
        : PF([[-1.17, 0.05, 'c'], [-1.2, -0.5], [-0.8, -1.06], [0, -1.24], [0.8, -1.06], [1.2, -0.5], [1.17, 0.05, 'c'], [0.96, -0.2], [0.66, -0.3, 'c'], [0.33, -0.2], [0, -0.3, 'c'], [-0.33, -0.2], [-0.66, -0.3, 'c'], [-0.96, -0.2]]);
      draw(geo.spline(fringe, true), { fill: hair, weight: OW });
      if (style === 'short') draw(geo.spline(P([[-0.14, -1.18], [-0.04, -1.42], [0.26, -1.36], [0.1, -1.16]]), true), { fill: hair, weight: OW });  // tuft
      if (rich) for (const [a0, b0, a1, b1] of [[-0.55, -0.98, -0.32, -0.62], [0.05, -1.12, 0.12, -0.7], [0.55, -0.95, 0.42, -0.6]])
        k.spline(P([[a0, b0], [(a0 + a1) / 2 + 0.06, (b0 + b1) / 2], [a1, b1]]), { weight: 'fine' });   // a few hair strands
      // one flat highlight on the hair (top-left)
      draw(geo.spline(P([[-0.78, -0.72], [-0.5, -0.98], [-0.18, -1.08], [-0.26, -0.98], [-0.56, -0.86], [-0.72, -0.66]]), true), { fill: o.hairShine || 'grey', ink: false });
      // face
      const [eL, eR] = G.eyes, er = rH * 0.11;
      const brow = (dy, tilt) => { for (const [ex, ey] of [eL, eR]) { const sd = Math.sign(ex); k.line(ex - er * 1.1, ey - er * 2.3 + dy - sd * tilt, ex + er * 1.1, ey - er * 2.3 + dy + sd * tilt, { weight: 'fine' }); } };
      if (expr === 'closed' || expr === 'happy') for (const [ex, ey] of [eL, eR]) k.arc(ex, ey + (expr === 'happy' ? er * 0.4 : 0), er * 1.1, er * 0.75, expr === 'happy' ? 200 : 20, expr === 'happy' ? 340 : 160, { weight: 'detail' });
      else if (expr === 'tired') for (const [ex, ey] of [eL, eR]) { k.ellipse(ex, ey + er * 0.35, er * 0.9, er * 0.6, { fill: 'ink', ink: false }); k.line(ex - er * 1.2, ey - er * 0.1, ex + er * 1.2, ey - er * 0.1, { weight: 'detail' }); }
      else for (const [ex, ey] of [eL, eR]) {
        const big = expr === 'surprised' || expr === 'scared' ? 1.15 : 1;
        const narrow = G.f && Math.sign(ex - G.dx) === G.f ? 0.78 : 1;                       // the far eye, foreshortened
        k.ellipse(ex, ey, er * 0.8 * big * narrow, er * 1.0 * big, { fill: 'ink', ink: false });       // Q版: solid dot eyes
        if (o.eyeShine ?? rich) k.circle(ex - er * 0.28, ey - er * 0.36, er * 0.28, { fill: 'white', ink: false });
      }
      if (expr === 'sad' || expr === 'scared') brow(-er * (expr === 'scared' ? 0.5 : 0), er * 0.5); else if (expr === 'surprised') brow(-er * 0.6, 0); else if (expr === 'tired') brow(er * 0.3, -er * 0.2); else if (expr === 'angry') brow(er * 0.35, -er * 0.75);
      else if (rich) for (const [ex, ey] of [eL, eR]) k.arc(ex, ey - er * 1.9, er * 1.15, er * 0.5, 200, 340, { weight: 'detail' });   // soft brows
      if (rich || G.f) k.arc(G.dx + G.f * rH * 0.16, hy + rH * 0.38, rH * 0.05, rH * 0.04, G.f > 0 ? -60 : G.f < 0 ? 60 : 0, G.f > 0 ? 120 : G.f < 0 ? 240 : 160, { weight: 'fine' });   // a hint of a nose (in a turn it shows the direction)
      const [mx, my] = G.mouth;
      if (expr === 'happy') draw(geo.spline([[mx - rH * 0.16, my - rH * 0.04, 'c'], [mx + rH * 0.16, my - rH * 0.04, 'c'], [mx + rH * 0.12, my + rH * 0.08], [mx, my + rH * 0.14], [mx - rH * 0.12, my + rH * 0.08]], true), { fill: 'blush', weight: 'detail' });  // D-shaped open smile
      else if (expr === 'surprised') k.ellipse(mx, my + rH * 0.03, rH * 0.07, rH * 0.09, { fill: 'blush', weight: 'detail' });
      else if (expr === 'angry') k.arc(mx, my + rH * 0.1, rH * 0.13, rH * 0.07, 200, 340, { weight: 'detail' });
      else if (expr === 'scared') k.line([[mx - rH * 0.15, my + rH * 0.04], [mx - rH * 0.075, my - rH * 0.01], [mx, my + rH * 0.04], [mx + rH * 0.075, my - rH * 0.01], [mx + rH * 0.15, my + rH * 0.04]], { weight: 'detail' });
      else if (expr === 'sad') k.arc(mx, my + rH * 0.08, rH * 0.12, rH * 0.07, 200, 340, { weight: 'detail' });
      else if (expr === 'tired') k.line(mx - rH * 0.1, my + rH * 0.02, mx + rH * 0.1, my + rH * 0.02, { weight: 'detail' });
      else if (o.mouth !== false) k.arc(mx, my - rH * 0.02, rH * 0.12, rH * 0.08, 20, 160, { weight: 'detail' });
      for (const sd of [-1, 1]) { const far = G.f && sd === G.f; k.ellipse(G.f ? G.dx + sd * rH * (far ? 0.46 : 0.56) : sd * rH * 0.62, hy + rH * 0.46, rH * 0.17 * (far ? 0.7 : 1), rH * 0.11, { fill: 'blush', ink: false }); }   // round pink blush
      if (o.glasses) for (const [ex, ey] of [eL, eR]) k.circle(ex, ey, er * 2.1, { weight: 'detail' });
      if (o.glasses) k.arc((eL[0] + eR[0]) / 2, eL[1] - er * 0.3, Math.abs(eR[0] - eL[0]) * 0.12, rH * 0.06, 200, 340, { weight: 'detail' });
      });   // end of the head group
      // arms in front of the body
      for (const f of front) f();
      Object.assign(out, { head: k.toSheet(...G.headT), top: k.toSheet(...G.tilt([0, hy - rH])), mouth: k.toSheet(...G.mouthT), unit: s,
        shoulderR: k.toSheet(...G.shoulder(1)), shoulderL: k.toSheet(...G.shoulder(-1)), feet: k.toSheet(0, 0) });
      return out;
    })); }
  };

  /* ---- paper stop-motion physics. Parts are RIGID flat cut-outs: they slide, fall, tilt and rock, never stretch. ---- */
  const WEIGHT = { heavy: { bounce: 0.05, e: 0.12, rock: 0.5 }, normal: { bounce: 0.3, e: 0.3, rock: 1 }, light: { bounce: 0.5, e: 0.5, rock: 1.4 } };
  const weightOf = (o) => WEIGHT[o.weight] || WEIGHT.normal;
  // group options that rotate by deg about (cx, cy), then move by (dx, dy)
  const about = (cx, cy, deg, dx = 0, dy = 0) => {
    const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    return { x: cx - (ca * cx - sa * cy) + dx, y: cy - (sa * cx + ca * cy) + dy, rotate: deg };
  };

  /**
   * Paper stop-motion reveal (the 'assemble' animation): the part drawn by fn is absent before `at`, then comes in as
   * a rigid paper cut-out and holds. t, at, dur are shares of the loop (0…1). Leave the end of the loop as a hold.
   *   k.pop(t, 0.30, () => k.ricebowl(…), { from: 'right', tilt: 8 })   // slides in, lands tilted, settles flat
   *   k.pop(t, 0.16, () => k.line(…tick…), { pivot: [cx, cy] })          // a mark stamped on: grows from the pivot
   * opts: from 'left'|'right'|'top'|'bottom' (the default), distance, tilt (degrees it arrives turned, settles to 0,
   * about `pivot` or the sheet centre), weight 'heavy'|'normal'|'light' (how much it overshoots), ease (overrides
   * weight), dur 0.12. `pivot` WITHOUT `from` scales the part up from that point: only for ink marks (ticks, stamps,
   * sparkles), never for objects, since paper can't grow.
   */
  k.pop = (t, at, fn, o = {}) => {
    const dur = o.dur || 0.12, p = (t - at) / dur;
    if (p <= 0) return null;
    if (p >= 1) return fn();
    const W8 = weightOf(o), e = (EASE[o.ease] || springCurve(W8.bounce))(p);
    if (o.pivot && !o.from) {
      const [px, py] = o.pivot, sc = Math.max(0.001, e);
      return group({ x: px * (1 - sc), y: py * (1 - sc), scale: sc }, fn);
    }
    const from = o.from || 'bottom', d = (1 - e) * (o.distance || k.W * 0.6);
    const dir = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] }[from] || [0, 1];
    const [px, py] = o.pivot || [k.W / 2, k.H / 2];
    return group(about(px, py, (o.tilt || 0) * (1 - e), dir[0] * d, dir[1] * d), fn);
  };

  /**
   * Drop a rigid part onto the ground under gravity: it falls (speeding up), hits groundY, bounces a few times (each
   * lower: restitution by weight) and, if it came in tilted, rocks on its contact point until it lies flat.
   * Its shadow stays on the ground and darkens and grows as it comes down: give `shadow: [rx, ry]` and draw the
   * part itself with its own shadow off (shadow: false).
   *   k.drop(t, 0.2, () => k.chibi(500, 985, { …, shadow: false }), { x: 500, groundY: 985, shadow: [90, 10] })
   * opts: x, groundY (the contact point, default sheet centre / bottom), height (fall, default 0.45·H), weight
   * 'heavy'|'normal'|'light', tilt (degrees while falling), dur 0.16.
   */
  k.drop = (t, at, fn, o = {}) => {
    const dur = o.dur || 0.16, p = (t - at) / dur;
    const x = o.x == null ? k.W / 2 : o.x, gy = o.groundY == null ? k.H * 0.9 : o.groundY;
    const W8 = weightOf(o), h = o.height || k.H * 0.45;
    const sh = (s) => { if (o.shadow) k.shadow(x, gy, o.shadow[0] * (0.35 + 0.65 * s), o.shadow[1] * (0.35 + 0.65 * s), { opacity: 0.9 * (0.25 + 0.75 * s), lines: s > 0.98 ? 2 : false }); };
    if (p <= 0) return null;
    if (p >= 1) { sh(1); return fn(); }
    // normalised ballistics: h = 1, g = 2, so the fall takes 1 and a bounce launched at speed v lasts v and rises v²/4
    const vs = []; for (let v = 2 * W8.e; v * v / 4 > 0.003; v *= W8.e) vs.push(v);
    const T = 1 + vs.reduce((a, v) => a + v, 0) + 0.25;           // + a short rest at the end
    let tau = p * T, y;
    if (tau < 1) y = 1 - tau * tau;
    else {
      let r = tau - 1; y = 0;
      for (const v of vs) { if (r < v) { y = (v * r - r * r) / 1; break; } r -= v; }
    }
    // rocking: hold the tilt while falling, then a damped rock about the contact point that ends flat
    let ang = o.tilt || 0;
    if (tau >= 1) { const s = (tau - 1) / (T - 1); ang = (o.tilt || 0) * W8.rock * Math.exp(-3 * s) * Math.cos(Math.PI * 3 * s) * (1 - s); }
    sh(1 - y);
    return group(about(x, gy, ang, 0, -y * h), fn);
  };

  /**
   * A part hit by something (the contact beat): it is drawn as usual, and from `at` it jolts (pushed by `push`
   * [dx, dy]) and rocks about `pivot` (where it stands), damped back to rest over `dur`.
   *   k.react(t, 0.62, () => k.meter(…), { pivot: [700, 900], amount: 6, push: [12, 0] })
   * opts: pivot (default sheet centre), amount (degrees, 6), push [dx, dy], dur 0.12, weight (heavy jolts less).
   */
  k.react = (t, at, fn, o = {}) => {
    const dur = o.dur || 0.12, s = (t - at) / dur;
    if (s <= 0 || s >= 1) return fn();
    const W8 = weightOf(o), amp = Math.exp(-3.5 * s) * (1 - s) * W8.rock;
    const [px, py] = o.pivot || [k.W / 2, k.H / 2], push = o.push || [0, 0];
    const kick = Math.sin(Math.PI * Math.min(1, s * 3)) * amp;   // pushed out fast, then back
    return group(about(px, py, (o.amount == null ? 6 : o.amount) * amp * Math.sin(2 * Math.PI * 2 * s), push[0] * kick, push[1] * kick), fn);
  };

  /** One small flat highlight (light, no outline): the lit spot on a round or glossy thing. Light comes from the top-left. */
  k.highlight = (x, y, rx, ry = rx * 0.55, o = {}) => k.group({ x, y, rotate: o.angle == null ? -35 : o.angle }, () =>
    k.ellipse(0, 0, rx, ry, { fill: o.fill || (PALETTE.paperwhite ? 'paperwhite' : 'white'), ink: false, shade: false, opacity: o.opacity }));

  /* ---- everyday things, as they look in China. All stand on groundY at x; h = height. ---- */

  /** Glass tea tumbler (玻璃杯): straight glass, tea leaves standing in pale tea, optional screw lid. */
  k.teaglass = (x, groundY, o = {}) => scoped('teaglass', () => {
    const h = o.h || 300, w = h * 0.42, top = groundY - h;
    k.shadow(x, groundY, w * 0.75, h * 0.05, { lines: 2 });
    const glass = [[x - w / 2, top + h * 0.12], [x + w / 2, top + h * 0.12], [x + w * 0.45, groundY], [x - w * 0.45, groundY]];
    k.poly(glass, { fill: 'moonwhite', shade: 0.08 });
    const lvl = top + h * 0.3;
    k.poly([[x - w * 0.485, lvl], [x + w * 0.485, lvl], [x + w * 0.44, groundY - 3], [x - w * 0.44, groundY - 3]], { fill: o.tea || 'tea', ink: false });
    k.line(x - w * 0.485, lvl, x + w * 0.485, lvl, { weight: 'fine' });
    for (const [dx, dy, a] of [[-0.2, 0.55, -70], [0.12, 0.7, -110], [-0.05, 0.85, -95], [0.22, 0.45, -60]])
      k.leaf(x + dx * w, top + dy * h, { len: h * 0.1, angle: a, width: 0.4, fill: 'olive', vein: false, weight: 'fine' });
    k.line(x - w * 0.33, top + h * 0.2, x - w * 0.3, groundY - h * 0.12, { weight: 'fine', ink: 'white' });
    if (o.lid !== false) k.rect(x - w * 0.53, top, w * 1.06, h * 0.13, { fill: o.lidFill || 'dai', shade: 0.2, radius: h * 0.02 });
    return { top, rim: [x, top + h * 0.12] };
  });

  /** Vacuum flask (暖水瓶): tall body with a printed band, shoulder, cork, side handle. */
  k.thermos = (x, groundY, o = {}) => scoped('thermos', () => {
    const h = o.h || 460, r = h * 0.17, top = groundY - h, fill = o.fill || 'jade';
    k.shadow(x, groundY, r * 1.4, h * 0.035, { lines: 2 });
    k.tube([[x + r * 0.9, top + h * 0.32], [x + r * 1.55, top + h * 0.36], [x + r * 1.5, top + h * 0.62], [x + r * 0.95, top + h * 0.66]], h * 0.035, { fill: o.handle || 'dai' });
    k.turned([[r * 0.55, 0], [r * 0.6, h * 0.035], [r * 0.93, h * 0.085], [r, h * 0.13], [r, h]], { cx: x, y: top, fill, shade: 0.3 });   // wide cylinder, short shoulder
    k.rect(x - r * 0.5, top - h * 0.04, r * 1.0, h * 0.055, { fill: 'wood', radius: h * 0.01 });                         // cork
    k.rect(x - r, groundY - h * 0.08, r * 2, h * 0.08, { fill: 'dai', weight: 'detail' });                               // base band
    // printed flowers on the body: a few simple 5-petal blossoms (as on real flasks)
    for (const [dx, dy, s] of [[-0.4, 0.35, 1], [0.3, 0.5, 0.85], [-0.15, 0.68, 0.95]]) {
      const cx = x + dx * r, cy = top + dy * h, pr = r * 0.11 * s;
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; k.circle(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr, pr * 0.75, { fill: o.flowers || 'pink', weight: 'fine' }); }
      k.dot(cx, cy, pr * 0.35, { fill: 'gamboge' });
    }
    return { top: [x, top - h * 0.04] };
  });

  /** Enamel mug (搪瓷杯): white enamel, dark rim and base band, loop handle. */
  k.enamelmug = (x, groundY, o = {}) => scoped('enamelmug', () => {
    const h = o.h || 260, r = h * 0.5, top = groundY - h, band = o.band || 'indigo';
    k.shadow(x, groundY, r * 1.25, h * 0.06, { lines: 2 });
    k.tube([[x + r * 0.92, top + h * 0.22], [x + r * 1.5, top + h * 0.25], [x + r * 1.48, top + h * 0.7], [x + r * 0.93, top + h * 0.72]], h * 0.07, { fill: 'white', shade: 0.25 });
    const m = k.turned([[r, 0], [r * 0.99, h * 0.5], [r * 0.95, h]], { cx: x, y: top, fill: o.fill || 'white', rim: true, inside: o.inside || 'tea', shade: 0.18, rimRatio: 0.2 });
    k.rect(x - r * 0.96, groundY - h * 0.07, r * 1.92, h * 0.07, { fill: band, ink: false });
    k.ellipse(x, m.rim.y, r, r * 0.2, { weight: 'detail' });
    k.arc(x, m.rim.y, r, r * 0.2, 0, 180, { weight: 'bold', ink: band });
    return { rim: m.rim };
  });

  /** Rice bowl with a dome of rice and chopsticks resting across the rim (never stuck upright in the rice). */
  k.ricebowl = (x, groundY, o = {}) => scoped('ricebowl', () => {
    const w = o.w || 360, h = w * 0.42, top = groundY - h, fill = o.fill || 'moonwhite';
    k.shadow(x, groundY, w * 0.55, w * 0.05, { lines: 2 });
    // rice dome behind the rim
    k.blob(x, top + h * 0.02, w * 0.4, { squash: 0.42, irregular: 0.05, bumps: 9, bump: 0.05, fill: 'rice', shade: 0.15 });
    for (let i = 0; i < 9; i++) k.ellipse(x + (i - 4) * w * 0.07 + k.rand(-6, 6), top - h * 0.18 + k.rand(-8, 10), w * 0.012, w * 0.006, { weight: 'fine' });
    k.turned([[w / 2, 0], [w * 0.44, h * 0.45], [w * 0.28, h * 0.84], [w * 0.17, h * 0.86], [w * 0.18, h]], { cx: x, y: top, fill, shade: 0.22 });
    k.spline([[x - w * 0.42, top + h * 0.3], [x, top + h * 0.38], [x + w * 0.42, top + h * 0.3]], { weight: 'fine', ink: o.line || 'indigo' }); // blue line, like the classic bowl
    if (o.chopsticks !== false) {
      const y0 = top + h * 0.02, dy = h * 0.05;   // resting on the rim, in front of the rice
      k.tube([[x - w * 0.62, y0 + dy], [x + w * 0.62, y0 - dy * 0.4]], [w * 0.022, w * 0.014], { fill: o.chopsticksFill || 'wood', weight: 'fine' });
      k.tube([[x - w * 0.6, y0 + dy * 1.7], [x + w * 0.64, y0 + dy * 0.5]], [w * 0.022, w * 0.014], { fill: o.chopsticksFill || 'wood', weight: 'fine' });
    }
    return { rim: [x, top] };
  });

  /** Window: (x, y) top-left, w × h. Frame, glass, glazing bars, sill. */
  k.window = (x, y, w, h, o = {}) => scoped('window', () => {
    const fr = Math.max(6, w * 0.08);
    const frameC = o.frame || 'white';
    if (o.arch) {
      const pts = [[x, y + h, 'c'], [x, y + w / 2], [x + w * 0.15, y + w * 0.15], [x + w / 2, y], [x + w * 0.85, y + w * 0.15], [x + w, y + w / 2], [x + w, y + h, 'c']];
      k.spline(pts, { closed: true, fill: frameC });
      const gi = pts.map((p) => [p[0] + (p[0] < x + w / 2 ? fr : p[0] > x + w / 2 ? -fr : 0), p[1] + (p[1] < y + h ? fr * (p[1] === y ? 1 : 0.6) : -fr), p[2]]);
      k.spline(gi, { closed: true, fill: o.glass || 'sky', shade: 0.4, weight: 'detail' });
    } else {
      k.rect(x, y, w, h, { fill: frameC });
      k.rect(x + fr, y + fr, w - 2 * fr, h - 2 * fr, { fill: o.glass || 'sky', shade: 0.45, weight: 'detail' });
    }
    const [cols, rows] = o.panes || [2, 2];
    for (let i = 1; i < cols; i++) { const xx = x + (w * i) / cols; k.line(xx, y + fr * (o.arch ? 2 : 1), xx, y + h - fr, { weight: 'detail' }); }
    for (let j = 1; j < rows; j++) { const yy = y + (h * j) / rows; k.line(x + fr, yy, x + w - fr, yy, { weight: 'detail' }); }
    // glint
    k.line(x + fr + w * 0.12, y + fr + h * 0.3, x + fr + w * 0.26, y + fr + h * 0.12, { weight: 'fine' });
    k.line(x + fr + w * 0.12, y + fr + h * 0.42, x + fr + w * 0.2, y + fr + h * 0.31, { weight: 'fine' });
    if (o.curtains) {
      k.spline([[x + fr, y + fr, 'c'], [x + fr + w * 0.22, y + fr, 'c'], [x + fr + w * 0.1, y + h * 0.45], [x + fr + w * 0.04, y + h - fr, 'c'], [x + fr, y + h - fr, 'c']], { closed: true, fill: o.curtains, weight: 'detail' });
      k.spline([[x + w - fr, y + fr, 'c'], [x + w - fr - w * 0.22, y + fr, 'c'], [x + w - fr - w * 0.1, y + h * 0.45], [x + w - fr - w * 0.04, y + h - fr, 'c'], [x + w - fr, y + h - fr, 'c']], { closed: true, fill: o.curtains, weight: 'detail' });
    }
    if (o.sill !== false) k.rect(x - w * 0.07, y + h, w * 1.14, Math.max(8, h * 0.07), { fill: frameC, shade: 0.5 });
    if (o.flowers) {
      const by = y + h + Math.max(8, h * 0.07);
      k.rect(x - w * 0.02, by, w * 1.04, h * 0.16, { fill: o.boxFill || 'wood', shade: 0.5 });
      for (let i = 0; i < 5; i++) {
        const fx = x + w * (0.1 + i * 0.2);
        k.blob(fx, by - 2, w * 0.07, { fill: 'green', bumps: 5, weight: 'detail' });
        k.circle(fx + w * 0.02, by - w * 0.06, w * 0.03, { fill: o.flowers, weight: 'fine' });
      }
    }
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, sill: y + h };
  });

  /** Door: (x, y) top-left, w × h. */
  k.door = (x, y, w, h, o = {}) => scoped('door', () => {
    const c = o.fill || 'red';
    if (o.arch) k.spline([[x, y + h, 'c'], [x, y + w / 2], [x + w / 2, y], [x + w, y + w / 2], [x + w, y + h, 'c']], { closed: true, fill: c, shade: 0.25 });
    else k.rect(x, y, w, h, { fill: c, shade: 0.25 });
    if (o.panels !== false) {
      const px = x + w * 0.18, pw = w * 0.64;
      const top = o.arch ? y + w * 0.55 : y + h * 0.1;
      if (o.glass) k.roundRect(px, top, pw, h * 0.24, 4, { fill: 'sky', weight: 'detail' });
      else k.rect(px, top, pw, h * 0.3, { weight: 'detail', ink: true });
      k.rect(px, y + h * 0.52, pw, h * 0.36, { weight: 'detail' });
    }
    if (o.knob !== false) k.circle(x + w * 0.82, y + h * 0.5, Math.max(3.5, w * 0.045), { fill: 'ochre', weight: 'detail' });
    if (o.step !== false) k.rect(x - w * 0.1, y + h, w * 1.2, Math.max(8, h * 0.05), { fill: 'stone', shade: 0.5 });
    return { x, y, w, h, cx: x + w / 2 };
  });

  /** House front. x = centre, groundY = ground line. */
  k.house = (x, groundY, o = {}) => scoped('house', () => {
    const w = o.w || 460, h = o.h || 300, roofH = o.roofH || h * 0.62, ov = o.overhang == null ? w * 0.07 : o.overhang;
    const x0 = x - w / 2, top = groundY - h;
    k.shadow(x, groundY + 4, w * 0.62, 12, { lines: 3 });
    if (o.chimney !== false) {
      const cx = x + w * 0.24;
      k.rect(cx - w * 0.05, top - roofH * 0.82, w * 0.1, roofH * 0.6, { fill: o.chimneyFill || 'brick', shade: 0.4 });
      k.rect(cx - w * 0.065, top - roofH * 0.86, w * 0.13, roofH * 0.08, { fill: o.chimneyFill || 'brick' });
    }
    const wall = geo.rect(x0, top, w, h);
    draw(wall, { fill: o.wall || 'cream', shade: false });
    hatchSafe(wall, { region: 'shade', amount: 0.12, spacing: 8 });
    // simple brick hints
    if (o.bricks !== false) {
      const marks = [[0.08, 0.2], [0.86, 0.32], [0.12, 0.72], [0.9, 0.8], [0.5, 0.06]];
      for (const [mx, my] of marks) {
        const bx = x0 + w * mx, by = top + h * my;
        k.rect(bx, by, w * 0.06, h * 0.035, { weight: 'fine' });
        k.rect(bx + w * 0.035, by + h * 0.035, w * 0.06, h * 0.035, { weight: 'fine' });
      }
    }
    const roof = geo.poly([[x0 - ov, top + 4], [x, top - roofH], [x0 + w + ov, top + 4]]);
    draw(roof, { fill: o.roof || 'red', shade: 0.18 });
    I.hatch(roof, { region: 'all', angle: 0, spacing: Math.max(12, roofH / 7), weight: 'fine', inset: 5 });
    k.line([[x0 - ov - 4, top + 6], [x0 + w + ov + 4, top + 6]], { weight: 'outline' });
    const dw = o.doorW || w * 0.2, dh = o.doorH || h * 0.56;
    const door = k.door(x - dw / 2, groundY - dh - Math.max(8, dh * 0.05), dw, dh, { fill: o.door || 'teal', arch: o.archDoor });
    const ww = o.windowW || w * 0.2, wh = o.windowH || h * 0.28;
    const wy = top + h * 0.2;
    const left = k.window(x0 + w * 0.1, wy, ww, wh, { frame: 'white', curtains: o.curtains, flowers: o.flowers });
    const right = k.window(x0 + w * 0.9 - ww, wy, ww, wh, { frame: 'white', curtains: o.curtains, flowers: o.flowers });
    if (o.atticWindow !== false) k.circle(x, top - roofH * 0.38, roofH * 0.13, { fill: 'sky', shade: 0.4 });
    return { roofTop: [x, top - roofH], door, windows: [left, right], chimney: [x + w * 0.24, top - roofH * 0.86], left: x0, right: x0 + w, top };
    function hatchSafe(s, ho) { I.hatch(s, ho); }
  });

  /** Steam / smoke wisps rising from (x, y). Loops with t when animated. */
  k.steam = (x, y, o = {}) => scoped('steam', () => {
    const n = o.n || 3, hgt = o.h || 120, sp = o.spread || 26;
    const t = o.t == null ? k.t : o.t;
    for (let i = 0; i < n; i++) {
      const ph = TAU * (t + i / n);
      const xx = x + (i - (n - 1) / 2) * sp;
      const pts = [];
      for (let j = 0; j <= 6; j++) {
        const f = j / 6;
        pts.push([xx + Math.sin(f * 5 + ph) * (6 + f * 8), y - f * hgt * (0.8 + 0.2 * Math.sin(ph + i))]);
      }
      k.spline(pts, { weight: 'detail', ink: o.ink || 'charcoal' });
    }
  });

  /** Little grass tufts along a ground line. */
  k.grass = (x0, x1, y, o = {}) => scoped('grass', () => {
    const n = o.n || Math.max(2, Math.round((x1 - x0) / 60));
    for (let i = 0; i < n; i++) {
      const gx = x0 + ((x1 - x0) * (i + 0.5)) / n + k.rand(-10, 10);
      const s = (o.size || 14) * k.rand(0.8, 1.2);
      k.line([[gx - s * 0.5, y - s * 0.9], [gx - s * 0.1, y]], { weight: 'fine' });
      k.line([[gx, y - s * 1.2], [gx + s * 0.05, y]], { weight: 'fine' });
      k.line([[gx + s * 0.55, y - s * 0.8], [gx + s * 0.15, y]], { weight: 'fine' });
    }
  });
}

export { soften, darker, lighter, PALETTE, mulberry32 };
