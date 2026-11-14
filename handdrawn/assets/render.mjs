#!/usr/bin/env node
// Render a scene file to SVG (and optionally PNG / thumbnail / GIF). MIT licence.
//
//   node render.mjs scene.js -o out.svg [--png out.png] [--thumb out-128.png] [--seed N] [--size 1000]
//                   [--transparent] [--grid] [--gif out.gif --frames 8 --fps 10 --boil 2 --gif-size 560]
//                   [--animate]   (out.svg becomes a looping animated SVG)
//
// A scene file:  export function draw(k, t) { ... }      (t in [0,1) for animation; ignore it for stills)
//                export const sheet = { width: 1000, height: 1000, seed: 3, transparent: false }  (all optional)
// The SVG is built as a string (no DOM). PNG/GIF rasterising uses @resvg/resvg-js (optional dependency).
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
  console.log(`usage: node render.mjs scene.js -o out.svg [--png out.png] [--thumb [out-128.png]] [--seed N] [--size 1000]
                 [--transparent] [--grid] [--gif out.gif] [--frames 8] [--fps 10] [--boil 2] [--gif-size 560] [--animate]`);
  process.exit(args.help ? 0 : 1);
}

const scenePath = resolve(args._[0]);
const scene = await import(pathToFileURL(scenePath).href);
if (typeof scene.draw !== 'function') { console.error(`${scenePath}: must export function draw(k)`); process.exit(1); }
const sheet = scene.sheet || {};
const W = +(sheet.width || 1000), H = +(sheet.height || 1000);
const seed = args.seed != null && args.seed !== true ? +args.seed : sheet.seed != null ? sheet.seed : 1;
const transparent = !!(args.transparent || sheet.transparent);
const size = args.size && args.size !== true ? +args.size : W;
const out = args.out || join(dirname(scenePath), basename(scenePath, extname(scenePath)) + '.svg');

function frameParts(t, frameSeed, idPrefix) {
  const k = createKit({ width: W, height: H, seed: frameSeed, transparent, t, idPrefix });
  scene.draw(k, t);
  return k.parts();
}
const docOpts = (o = {}) => ({ W, H, seed, transparent, paper: sheet.paper, ...o });

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

// --- frames for animation (shared by --animate and --gif)
const nFrames = +(args.frames || sheet.frames || 8);
const fps = +(args.fps || sheet.fps || 10);
const boil = +(args.boil || sheet.boil || 2); // new wobble every `boil` frames ("on twos")
const animFrames = () => Array.from({ length: nFrames }, (_, i) =>
  frameParts(i / nFrames, seed + Math.floor(i / boil) * 101, `f${i}_`));

// --- SVG
let svg;
if (args.animate) svg = svgDocument(animFrames(), docOpts({ size, fps, grid: !!args.grid }));
else svg = svgDocument([frameParts(0, seed, '')], docOpts({ size, grid: !!args.grid }));
ensureDir(out);
writeFileSync(out, svg);
console.log(`svg   ${out}  (${(svg.length / 1024).toFixed(0)} KB${args.animate ? `, ${nFrames} frames @ ${fps} fps` : ''})`);

// stills for PNG/thumbnail always use frame 0 (no CSS animation in rasterisers)
const still = args.animate ? svgDocument([frameParts(0, seed, '')], docOpts({ grid: !!args.grid })) : svg;
if (args.png) {
  const p = args.png === true ? out.replace(/\.svg$/, '') + '.png' : args.png;
  ensureDir(p);
  writeFileSync(p, (await rasterize(still, size)).asPng());
  console.log(`png   ${p}`);
}
if (args.thumb) {
  const p = args.thumb === true ? out.replace(/\.svg$/, '') + '-128.png' : args.thumb;
  const noGrid = args.animate || args.grid ? svgDocument([frameParts(0, seed, '')], docOpts()) : svg;
  ensureDir(p);
  writeFileSync(p, (await rasterize(noGrid, 128)).asPng());
  console.log(`thumb ${p}`);
}
if (args.gif) {
  const { encodeGIF } = await import('./gif.mjs');
  const p = args.gif === true ? out.replace(/\.svg$/, '') + '.gif' : args.gif;
  const gw = +(args['gif-size'] || sheet.gifSize || 560);
  const frames = animFrames();
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
  console.log(`gif   ${p}  (${gw}×${gh}, ${nFrames} frames @ ${fps} fps, ${(gif.length / 1024).toFixed(0)} KB)`);
}
