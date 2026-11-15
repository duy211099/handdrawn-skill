#!/usr/bin/env node
// Render a scene file to SVG (and optionally PNG / thumbnail / GIF). MIT licence.
//
//   node render.mjs scene.js -o out.svg [--png out.png] [--thumb out-128.png] [--seed N] [--size 1000]
//                   [--transparent] [--grid] [--gif out.gif --frames 8 --fps 10 --boil 2 --gif-size 560]
//                   [--still]     (out.svg is a looping animated SVG by default; --still makes it one frame)
//                   [--theme classic|sheng|jianbihua] [--rough 0..1] [--stroke marker|brush] [--opaque] [--fit F]  (default jianbihua; vocab: [--card])
//
// A scene file:  export function draw(k, t) { ... }      (t in [0,1) for animation; ignore it for stills)
//                export const sheet = { width: 1000, height: 1000, seed: 3, transparent: false }  (all optional)
// The SVG is built as a string (no DOM). PNG/GIF rasterising uses @resvg/resvg-js (optional dependency).
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, basename, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createKit, svgDocument, registerHanzi, setTheme, themeInfo } from './kit.js';

const here = dirname(fileURLToPath(import.meta.url));
// Chinese characters (stroke-order data, ~5 MB): loaded once if present
const hanziFile = join(here, 'hanzi', 'medians.json');
if (existsSync(hanziFile)) registerHanzi(JSON.parse(readFileSync(hanziFile, 'utf8')));

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
                 [--transparent] [--grid] [--gif out.gif] [--frames 8] [--fps 10] [--boil 2] [--gif-size 560] [--still]
                 [--theme classic|sheng|jianbihua] [--rough 0..1] [--stroke marker|brush] [--opaque] [--fit 0.65] [--card]`);
  process.exit(args.help ? 0 : 1);
}

const scenePath = resolve(args._[0]);
const scene = await import(pathToFileURL(scenePath).href);
if (typeof scene.draw !== 'function') { console.error(`${scenePath}: must export function draw(k)`); process.exit(1); }
const sheet = scene.sheet || {};
// theme: jianbihua (default: flat 简笔画 + Q版 people), sheng (Shēng design system) or classic (cream paper, marker).
const theme = args.theme && args.theme !== true ? args.theme : sheet.theme || 'jianbihua';   // default look: 简笔画 objects + Q版 people
setTheme(theme, { rough: args.rough != null && args.rough !== true ? +args.rough : sheet.rough, stroke: args.stroke || sheet.stroke });
const W = +(sheet.width || 1000), H = +(sheet.height || 1000);
const seed = args.seed != null && args.seed !== true ? +args.seed : sheet.seed != null ? sheet.seed : 1;
// background: --opaque forces the paper; otherwise --transparent / sheet.transparent / the theme's default
const transparent = args.opaque ? false : !!(args.transparent || sheet.transparent || themeInfo().transparent);
const size = args.size && args.size !== true ? +args.size : W;
// animated SVG by default (line boil + any motion from t); --still (or sheet.still) for a single frame
const animate = !(args.still || sheet.still) || !!args.animate;
const out = args.out || join(dirname(scenePath), basename(scenePath, extname(scenePath)) + '.svg');

function frameParts(t, frameSeed, idPrefix) {
  const k = createKit({ width: W, height: H, seed: frameSeed, transparent, t, duration: sheet.duration || nFrames / fps, idPrefix });
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

// --- vocab mode: a scene that exports `vocab` (Chinese word picture); see renderVocab below
if (scene.vocab) { await renderVocab(scene.vocab); process.exit(0); }

// --- SVG
let svg;
if (animate) svg = svgDocument(animFrames(), docOpts({ size, fps, grid: !!args.grid }));
else svg = svgDocument([frameParts(0, seed, '')], docOpts({ size, grid: !!args.grid }));
ensureDir(out);
writeFileSync(out, svg);
console.log(`svg   ${out}  (${(svg.length / 1024).toFixed(0)} KB${animate ? `, ${nFrames} frames @ ${fps} fps` : ''})`);

// stills for PNG/thumbnail always use frame 0 (no CSS animation in rasterisers)
const still = animate ? svgDocument([frameParts(0, seed, '')], docOpts({ grid: !!args.grid })) : svg;
if (args.png) {
  const p = args.png === true ? out.replace(/\.svg$/, '') + '.png' : args.png;
  ensureDir(p);
  writeFileSync(p, (await rasterize(still, size)).asPng());
  console.log(`png   ${p}`);
}
if (args.thumb) {
  const p = args.thumb === true ? out.replace(/\.svg$/, '') + '-128.png' : args.thumb;
  const noGrid = animate || args.grid ? svgDocument([frameParts(0, seed, '')], docOpts()) : svg;
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

// ------------------------------------------------------------------ vocab mode
// A Chinese vocab scene draws the picture only (no text) and exports
//   export const vocab = { hanzi, pinyin, hanviet, meaning, note, kind: 'concrete' | 'action' | 'abstract', card }
// Output (x.svg is always the main picture):
//   concrete / action : x.svg = the picture, no words.
//                       With --card (or vocab.card: true) also x-card.svg (picture + word card under it) and
//                       x-hanzi.svg (characters + pinyin only), for flashcards.
//   abstract          : x.svg = picture + word card (a picture alone can't carry an abstract word), x-hanzi.svg.
// Motion follows the kind, never line boil: concrete = still, action = the action loops with steady lines,
// abstract = steady lines, plus motion only if the scene uses t.
async function renderVocab(v) {
  const kind = v.kind || 'concrete';
  if (!['concrete', 'action', 'abstract'].includes(kind)) { console.error(`vocab.kind must be concrete, action or abstract (got ${kind})`); process.exit(1); }
  if (!v.hanzi) { console.error('vocab.hanzi is required'); process.exit(1); }
  const cards = kind === 'abstract' || !!args.card || !!v.card;
  const pad = Math.round(W * 0.06), gap = Math.round(pad * 0.5);
  const card = { hanzi: v.hanzi, pinyin: v.pinyin, hanviet: v.hanviet, meaning: v.meaning, note: v.note, grid: v.grid };
  const hanziCard = { hanzi: v.hanzi, pinyin: v.pinyin, grid: v.grid };
  // fit a card to the sheet width
  const fit = (o, size) => {
    const measure = (s) => createKit({ width: W, height: H, seed }).word({ ...o, x: W / 2, y: 0, size: s, align: 'center', meaningSize: s * 0.3 });
    let r = measure(size);
    for (let i = 0; i < 3 && r.w > W * 0.86; i++) { size *= (W * 0.86) / r.w; r = measure(size); }
    return { size, h: r.h };
  };
  const word = (k, o, f, y) => k.word({ ...o, x: W / 2, y, size: f.size, align: 'center', meaningSize: f.size * 0.3 });

  const faces = { picture: { H, picture: true } };
  if (cards) {
    const nch = [...String(v.hanzi)].filter((c) => !/\s/.test(c)).length;
    const lf = fit(card, W * (nch === 1 ? 0.21 : 0.15)), hf = fit(hanziCard, W * (nch === 1 ? 0.3 : 0.22));
    faces.card = { H: H + gap + lf.h + pad, picture: true, card: (k) => word(k, card, lf, H + gap) };
    faces.hanzi = { H: hf.h + pad * 2.4, picture: false, card: (k) => word(k, hanziCard, hf, pad * 1.2) };
    if (kind === 'abstract') delete faces.picture;
  }

  // smooth playback for vocab motion: 24 fps over `sheet.duration` seconds (default 2.4 s), unless set on the CLI
  const vfps = +(args.fps || sheet.fps || 24);
  const vframes = +(args.frames || sheet.frames || Math.round(vfps * (sheet.duration || 2.4)));
  // poster: the moment (0…1 of the loop) used for the PNG still and as the loop's first frame. A reveal animation
  // (k.pop) sets it near the end so the still shows the finished picture, not blank paper.
  const T0 = +(sheet.poster || 0);
  // auto-framing (jianbihua: 65%): measure the drawing over a few frames, then draw it scaled and centred so its
  // larger side fills `fit` of the sheet. Drawn inside a group, so line weights stay the same on every card.
  const fitTo = +(args.fit || sheet.fit || themeInfo().fit || 0);
  let place = null;
  if (fitTo > 0) {
    const px = 250, box = [Infinity, Infinity, -Infinity, -Infinity];
    const ts = kind === 'concrete' ? [T0] : [T0, 0.25, 0.5, 0.75, 0.99];
    for (const t of ts) {
      const k = createKit({ width: W, height: H, seed, transparent: true, t, duration: sheet.duration || 2.4 });
      scene.draw(k, t);
      const img = await rasterize(svgDocument([k.parts()], { W, H, seed, transparent: true }), px);
      const { pixels, width: iw, height: ih } = img;
      for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) if (pixels[(y * iw + x) * 4 + 3] > 10) {
        if (x < box[0]) box[0] = x; if (y < box[1]) box[1] = y; if (x > box[2]) box[2] = x; if (y > box[3]) box[3] = y;
      }
    }
    // a drawing that runs off the sheet is cropped on purpose (waist-up people): leave its framing alone
    const touches = box[0] <= 0 || box[1] <= 0 || box[2] >= px - 1 || box[3] >= Math.round((px * H) / W) - 1;
    if (touches) console.log('fit   skipped (the drawing runs off the sheet: framed on purpose)');
    if (box[2] > box[0] && !touches) {
      const u = W / px, bw = (box[2] - box[0] + 1) * u, bh = (box[3] - box[1] + 1) * u;
      const sc = Math.min(3, Math.max(0.3, (fitTo * Math.min(W, H)) / Math.max(bw, bh)));
      const cx = (box[0] + box[2] + 1) / 2 * u, cy = (box[1] + box[3] + 1) / 2 * u;
      place = { scale: sc, x: W / 2 - sc * cx, y: H / 2 - sc * cy };
    }
  }
  const drawPicture = (k, t) => (place ? k.view(place, () => scene.draw(k, t)) : scene.draw(k, t));

  // colour check: prefer the theme's palette, warn about others, and about more than 4 colours
  const allowed = themeInfo().allowed;
  if (allowed) {
    const k = createKit({ width: W, height: H, seed, transparent, t: 0, duration: sheet.duration || 2.4 });
    scene.draw(k, T0);
    const used = k.fillsUsed().map((c) => c.toUpperCase()).filter((c) => c !== '#E3D8C4'); // not the shadow
    const off = used.filter((c) => !allowed.includes(c));
    if (off.length) console.warn(`warning: colours outside the jianbihua palette: ${off.join(', ')}`);
    const n = new Set(used.filter((c) => !['#2B2B2B', '#FFFDF7', '#3B3634', '#F0CDB0', '#EBB4A3', '#B9B6AF'].includes(c))).size;   // highlights and a person's skin, blush, hair, hair shine don't count
    if (n > 4) console.warn(`warning: ${n} colours; the style asks for at most 3–4 per object`);
  }

  const frame = (f, t, idPrefix) => {
    const body = [], defs = [];
    if (f.picture) {
      const k = createKit({ width: W, height: H, seed, transparent, t, duration: sheet.duration || 2.4, idPrefix }); // no boil: same seed every frame
      drawPicture(k, t);
      const p = k.parts();
      defs.push(...p.defs);
      if (f.card) { // keep the picture inside its own sheet so nothing runs into the card
        defs.push(`<clipPath id="pic"><rect width="${W}" height="${H}"/></clipPath>`);
        body.push(`<g clip-path="url(#pic)">`, ...p.body, '</g>');
      } else body.push(...p.body);
    }
    if (f.card) {
      const k = createKit({ width: W, height: H, seed, transparent, t, duration: sheet.duration || 2.4, idPrefix: idPrefix + 'c' });
      f.card(k);
      const p = k.parts();
      defs.push(...p.defs); body.push(...p.body);
    }
    return { defs, body };
  };
  const same = (a, b) => a.body.join('') === b.body.join('');

  const base = out.replace(/\.svg$/, '');
  const main = faces.picture ? 'picture' : 'card';
  const sib = (p, name) => (name === main ? p : p.replace(/(\.\w+)$/, `-${name}$1`));
  for (const [name, f] of Object.entries(faces)) {
    const fH = Math.round(f.H);
    let frames = [frame(f, T0, '')];
    if (f.picture && kind !== 'concrete' && animate) {
      const fr = Array.from({ length: vframes }, (_, i) => frame(f, (T0 + i / vframes) % 1, '')); // ids are content-hashed: frames share static parts
      if (fr.some((x) => !same(x, fr[0]))) frames = fr;
      else if (kind === 'action' && name === main) console.warn('warning: action word but nothing moves; animate the action with t');
    }
    const doc = (fr, o = {}) => svgDocument(fr, { W, H: fH, seed, transparent, paper: sheet.paper, ...o });
    const p = sib(base + '.svg', name);
    ensureDir(p);
    const svgText = doc(frames, { size, fps: vfps, grid: !!args.grid });
    writeFileSync(p, svgText);
    console.log(`svg   ${p}  (${name}${frames.length > 1 ? `, ${frames.length} frames @ ${vfps} fps` : ', still'}, ${(svgText.length / 1024).toFixed(0)} KB)`);
    if (args.png) {
      const pp = sib(args.png === true ? base + '.png' : args.png, name);
      ensureDir(pp);
      writeFileSync(pp, (await rasterize(doc([frames[0]], { grid: !!args.grid }), size)).asPng());
      console.log(`png   ${pp}`);
    }
    if (name !== main) continue;
    if (args.thumb) {
      const pp = args.thumb === true ? base + '-128.png' : args.thumb;
      ensureDir(pp);
      writeFileSync(pp, (await rasterize(doc([frames[0]]), 128)).asPng());
      console.log(`thumb ${pp}`);
    }
    if (args.gif && frames.length > 1) {
      const { encodeGIF } = await import('./gif.mjs');
      const pp = args.gif === true ? base + '.gif' : args.gif;
      const gw = +(args['gif-size'] || sheet.gifSize || 560);
      const rgba = []; let gh = 0;
      for (const fr of frames) { const img = await rasterize(doc([fr]), gw); gh = img.height; rgba.push(img.pixels); }
      ensureDir(pp);
      writeFileSync(pp, encodeGIF(rgba, gw, gh, { fps: vfps }));
      console.log(`gif   ${pp}`);
    } else if (args.gif) console.log('gif   skipped (this picture is a still)');
  }
}
