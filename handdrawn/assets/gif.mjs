// Minimal animated-GIF encoder. No dependencies. MIT licence.
// One global palette (median cut over all frames), light ordered (Bayer) dithering so
// soft colour steps stay smooth without frame-to-frame flicker, LZW compression, infinite loop.
//
//   encodeGIF(frames /* [Uint8Array RGBA] */, width, height, { fps: 10 }) -> Uint8Array

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

function buildPalette(frames, maxColors, hasAlpha) {
  // 5-bit-per-channel histogram, sampled
  const hist = new Map();
  for (const px of frames) {
    const step = Math.max(1, Math.floor(px.length / 4 / 60000)) * 4;
    for (let i = 0; i < px.length; i += step) {
      if (px[i + 3] < 128) continue;
      const key = ((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3);
      hist.set(key, (hist.get(key) || 0) + 1);
    }
  }
  let boxes = [[...hist.entries()].map(([k, n]) => [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4, n])];
  const target = maxColors - (hasAlpha ? 1 : 0);
  while (boxes.length < target) {
    // split the box with the largest (range × population)
    let bi = -1, best = -1, bch = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      let pop = 0; const lo = [255, 255, 255], hi = [0, 0, 0];
      for (const c of b) { pop += c[3]; for (let j = 0; j < 3; j++) { if (c[j] < lo[j]) lo[j] = c[j]; if (c[j] > hi[j]) hi[j] = c[j]; } }
      const ranges = [hi[0] - lo[0], (hi[1] - lo[1]) * 1.2, hi[2] - lo[2]];
      const ch = ranges.indexOf(Math.max(...ranges));
      const score = ranges[ch] * Math.sqrt(pop);
      if (score > best) { best = score; bi = i; bch = ch; }
    });
    if (bi < 0 || best <= 0) break;
    const b = boxes[bi].sort((p, q) => p[bch] - q[bch]);
    let total = 0; for (const c of b) total += c[3];
    let acc = 0, cut = 1;
    for (let i = 0; i < b.length - 1; i++) { acc += b[i][3]; if (acc >= total / 2) { cut = i + 1; break; } }
    boxes.splice(bi, 1, b.slice(0, cut), b.slice(cut));
  }
  const pal = boxes.filter((b) => b.length).map((b) => {
    let r = 0, g = 0, bl = 0, n = 0;
    for (const c of b) { r += c[0] * c[3]; g += c[1] * c[3]; bl += c[2] * c[3]; n += c[3]; }
    return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)];
  });
  if (hasAlpha) pal.unshift([0, 0, 0]);
  return pal;
}

function lzw(indices, minCode) {
  const out = [];
  let cur = 0, bits = 0;
  const clear = 1 << minCode, eoi = clear + 1;
  let size = minCode + 1;
  const emit = (code) => {
    cur |= code << bits; bits += size;
    while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; }
  };
  let dict = new Map(), next = eoi + 1;
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i];
    const key = prefix * 4096 + c;
    const hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << size && size < 12) size++;
    } else { emit(clear); dict = new Map(); next = eoi + 1; size = minCode + 1; }
    prefix = c;
  }
  emit(prefix); emit(eoi);
  if (bits > 0) out.push(cur & 255);
  return out;
}

export function encodeGIF(frames, width, height, opts = {}) {
  const fps = opts.fps || 10;
  const delay = Math.max(2, Math.round(100 / fps));
  const hasAlpha = frames.some((px) => { for (let i = 3; i < px.length; i += 4 * 97) if (px[i] < 128) return true; return false; });
  const pal = buildPalette(frames, 256, hasAlpha);
  const bitsPer = Math.max(1, Math.ceil(Math.log2(pal.length)));
  const tableSize = 1 << bitsPer;
  const cache = new Map();
  const nearest = (r, g, b) => {
    const key = (r << 16) | (g << 8) | b;
    let v = cache.get(key);
    if (v !== undefined) return v;
    let bd = Infinity;
    for (let i = hasAlpha ? 1 : 0; i < pal.length; i++) {
      const p = pal[i];
      const d = (p[0] - r) ** 2 * 0.3 + (p[1] - g) ** 2 * 0.59 + (p[2] - b) ** 2 * 0.11;
      if (d < bd) { bd = d; v = i; }
    }
    cache.set(key, v);
    return v;
  };
  const bytes = [];
  const push = (...a) => { for (const x of a) bytes.push(x); };
  const u16 = (v) => push(v & 255, (v >> 8) & 255);
  push(...[...'GIF89a'].map((c) => c.charCodeAt(0)));
  u16(width); u16(height);
  push(0x80 | ((bitsPer - 1) << 4) | (bitsPer - 1), 0, 0);
  for (let i = 0; i < tableSize; i++) { const p = pal[i] || [0, 0, 0]; push(p[0], p[1], p[2]); }
  // loop forever
  push(0x21, 0xff, 0x0b, ...[...'NETSCAPE2.0'].map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0);
  const amp = opts.dither == null ? 4 : opts.dither;
  for (const px of frames) {
    const idx = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (hasAlpha && px[i + 3] < 128) { idx[y * width + x] = 0; continue; }
      const d = BAYER4[(y & 3) * 4 + (x & 3)] * amp;
      const q = (v) => Math.max(0, Math.min(255, Math.round(v + d))) & 0xfc; // coarsen for cache hits
      idx[y * width + x] = nearest(q(px[i]), q(px[i + 1]), q(px[i + 2]));
    }
    push(0x21, 0xf9, 4, hasAlpha ? 0x09 : 0x04); u16(delay); push(0, 0);
    push(0x2c); u16(0); u16(0); u16(width); u16(height); push(0);
    const minCode = Math.max(2, bitsPer);
    push(minCode);
    const data = lzw(idx, minCode);
    for (let i = 0; i < data.length; i += 255) { const chunk = data.slice(i, i + 255); push(chunk.length, ...chunk); }
    push(0);
  }
  push(0x3b);
  return Uint8Array.from(bytes);
}
