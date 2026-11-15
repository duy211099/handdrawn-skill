#!/usr/bin/env node
// Render a 3D scene file to an animated SVG (and optionally PNG / thumbnail / GIF). MIT licence.
//
//   node render.mjs scene.js -o out.svg [--png out.png] [--thumb out-128.png] [--gif out.gif]
//                   [--frames 16] [--fps 12] [--boil 2] [--still] [--seed N] [--size 1000]
//                   [--transparent] [--grid] [--gif-size 560] [--at 0.25] [--strip [out-frames.png]]
//
// A scene file:  export function draw(k, t) { ... }      t in [0, 1): one loop of the animation
//                export const sheet = { width, height, seed, camera: { yaw, pitch }, frames, fps, boil, margin }
// out.svg is a looping animated SVG (frames switched by CSS, no script) unless --still.
// The drawing is framed automatically: every frame is measured first, so moving parts never make the framing jump.
// PNG/GIF rasterising uses @resvg/resvg-js (optional dependency). PNG = the frame at --at (default 0).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, basename, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createKit, svgDocument } from './kit.js';

const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s === '-o' || s === '--out') a.out = argv[++i];
    else if (s.startsWith('--')) {
      const key = s.slice(2);
      const nxt = argv[i + 1];
      if (nxt !== undefined && !nxt.startsWith('-')) { a[key] = nxt; i++; } else a[key] = true;
    } else a._.push(s);
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
if (!args._[0] || args.help) {
  console.log(`usage: node render.mjs scene.js -o out.svg [--png out.png] [--thumb [out-128.png]] [--gif out.gif]
                 [--frames 16] [--fps 12] [--boil 2] [--still] [--at 0] [--seed N] [--size 1000]
                 [--transparent] [--grid] [--gif-size 560] [--strip [out-frames.png]]`);
  process.exit(args.help ? 0 : 1);
}

const scenePath = resolve(args._[0]);
const scene = await import(pathToFileURL(scenePath).href);
if (typeof scene.draw !== 'function') { console.error(`${scenePath}: must export function draw(k, t)`); process.exit(1); }
const sheet = scene.sheet || {};
const W = +(sheet.width || 1000), H = +(sheet.height || 1000);
const seed = args.seed != null && args.seed !== true ? +args.seed : sheet.seed != null ? sheet.seed : 1;
const transparent = !!(args.transparent || sheet.transparent);
const size = args.size && args.size !== true ? +args.size : W;
const out = args.out || join(dirname(scenePath), basename(scenePath, extname(scenePath)) + '.svg');
const camera = sheet.camera || {};

const nFrames = Math.max(1, +(args.frames || sheet.frames || 16));
const fps = +(args.fps || sheet.fps || 12);
const boil = Math.max(1, +(args.boil || sheet.boil || 2)); // new wobble every `boil` frames ("on twos")
const still = !!args.still;
const atT = args.at != null && args.at !== true ? +args.at : 0;
const times = still ? [atT] : Array.from({ length: nFrames }, (_, i) => i / nFrames);

// --- pass 1: measure every frame at scale 1, then frame the union
function measureAt(t) {
  const k = createKit({ width: W, height: H, seed, transparent, t, camera, duration: nFrames / fps });
  scene.draw(k, t);
  return k.measure();
}
let box = null, labels = { left: 0, right: 0, any: 0 }, hasTitle = false;
for (const t of still ? [atT] : times) {
  const m = measureAt(t);
  if (m.box) {
    const b = m.box;
    if (!box) box = { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h };
    else { box.x0 = Math.min(box.x0, b.x); box.y0 = Math.min(box.y0, b.y); box.x1 = Math.max(box.x1, b.x + b.w); box.y1 = Math.max(box.y1, b.y + b.h); }
  }
  labels = { left: Math.max(labels.left, m.labels.left), right: Math.max(labels.right, m.labels.right), any: Math.max(labels.any, m.labels.any) };
  hasTitle = hasTitle || m.title;
}
const mg = { left: 0.12, right: 0.12, top: 0.1, bottom: 0.12, ...(sheet.margin || {}) };
if (hasTitle) mg.top = Math.max(mg.top, 0.17);
if (labels.any) { // room for margin notes: both sides unless every label says which side
  const both = labels.left + labels.right < labels.any;
  if (both || labels.left) mg.left = Math.max(mg.left, 0.21);
  if (both || labels.right) mg.right = Math.max(mg.right, 0.21);
}
let view = { scale: 1, ox: W / 2, oy: H / 2 };
if (box) {
  const aw = W * (1 - mg.left - mg.right), ah = H * (1 - mg.top - mg.bottom);
  const bw = Math.max(1, box.x1 - box.x0), bh = Math.max(1, box.y1 - box.y0);
  const scale = Math.min(aw / bw, ah / bh) * (sheet.zoom || 1);
  const cx = W * mg.left + aw / 2, cy = H * mg.top + ah / 2;
  view = { scale, ox: cx - scale * (box.x0 + box.x1) / 2, oy: cy - scale * (box.y0 + box.y1) / 2 };
}

// --- pass 2: draw
function frameParts(t, frameSeed, idPrefix) {
  const k = createKit({ width: W, height: H, seed: frameSeed, transparent, t, idPrefix, camera, view, duration: nFrames / fps });
  scene.draw(k, t);
  return k.parts();
}
const docOpts = (o = {}) => ({ W, H, seed, transparent, paper: sheet.paper, ...o });
const frames = times.map((t, i) => frameParts(t, seed + Math.floor(i / boil) * 101, `f${i}_`));

let resvg = null;
async function rasterize(svg, width) {
  if (!resvg) {
    try { resvg = await import('@resvg/resvg-js'); }
    catch {
      console.error('PNG/GIF export needs @resvg/resvg-js. Install it once:\n  cd ' + resolve(here, '..') + ' && npm install');
      process.exit(2);
    }
  }
  const r = new resvg.Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true, defaultFontFamily: 'sans-serif' } });
  return r.render();
}
const ensureDir = (p) => mkdirSync(dirname(resolve(p)), { recursive: true });

// --- SVG
const svg = svgDocument(frames, docOpts({ size, fps, grid: !!args.grid }));
ensureDir(out);
writeFileSync(out, svg);
console.log(`svg   ${out}  (${(svg.length / 1024).toFixed(0)} KB${frames.length > 1 ? `, ${frames.length} frames @ ${fps} fps, ${(frames.length / fps).toFixed(2)} s loop` : ', still'})`);
console.log(`view  scale ${view.scale.toFixed(3)}  camera yaw ${camera.yaw ?? 45} pitch ${camera.pitch ?? 35.26}`);

// stills for PNG/thumbnail: the frame nearest --at
const pick = still ? 0 : Math.round(atT * nFrames) % nFrames;
const stillSvg = (grid) => svgDocument([frames[pick]], docOpts({ grid }));
if (args.png) {
  const p = args.png === true ? out.replace(/\.svg$/, '') + '.png' : args.png;
  ensureDir(p);
  writeFileSync(p, (await rasterize(stillSvg(!!args.grid), size)).asPng());
  console.log(`png   ${p}`);
}
if (args.thumb) {
  const p = args.thumb === true ? out.replace(/\.svg$/, '') + '-128.png' : args.thumb;
  ensureDir(p);
  writeFileSync(p, (await rasterize(stillSvg(false), 128)).asPng());
  console.log(`thumb ${p}`);
}
if (args.strip) { // contact sheet: 6 frames across the loop, side by side, to check the motion
  const p = args.strip === true ? out.replace(/\.svg$/, '') + '-frames.png' : args.strip;
  const picks = still ? [0] : [...new Set([0, 1, 2, 3, 4, 5].map((j) => Math.round((j / 6) * nFrames) % nFrames))];
  const cell = 300, ch = Math.round((cell * H) / W);
  const inner = picks.map((fi, j) => svgDocument([frames[fi]], docOpts({ size: cell }))
    .replace(/^<svg [^>]*>/, `<svg x="${j * cell}" y="0" width="${cell}" height="${ch}" viewBox="0 0 ${W} ${H}">`)
    .replace(/id="mottle"/g, `id="mottle${j}"`).replace(/url\(#mottle\)/g, `url(#mottle${j})`));
  const sheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cell * picks.length}" height="${ch}">${inner.join('')}</svg>`;
  ensureDir(p);
  writeFileSync(p, (await rasterize(sheetSvg, cell * picks.length)).asPng());
  console.log(`strip ${p}  (t = ${picks.map((fi) => (fi / nFrames).toFixed(2)).join(', ')})`);
}
if (args.gif) {
  const { encodeGIF } = await import('./gif.mjs');
  const p = args.gif === true ? out.replace(/\.svg$/, '') + '.gif' : args.gif;
  const gw = +(args['gif-size'] || sheet.gifSize || 560);
  const rgba = [];
  let gh = 0;
  for (const f of frames) {
    const img = await rasterize(svgDocument([f], docOpts()), gw);
    gh = img.height;
    rgba.push(img.pixels);
  }
  ensureDir(p);
  const gif = encodeGIF(rgba, gw, gh, { fps });
  writeFileSync(p, gif);
  console.log(`gif   ${p}  (${gw}×${gh}, ${frames.length} frames @ ${fps} fps, ${(gif.length / 1024).toFixed(0)} KB)`);
}
