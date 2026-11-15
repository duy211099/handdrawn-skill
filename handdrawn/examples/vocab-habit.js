// Abstract word: 习惯 xíguàn (Hán Việt: TẬP QUÁN), thói quen. Metaphor: the same thing every day, a calendar
// filling with ticks. Animation: paper stop-motion, the page pops in, then one tick per day pops in (a steady
// rhythm is the meaning), then the full page holds.
export const sheet = { seed: 5, duration: 4.5, fps: 12, poster: 0.99 };
export const vocab = { hanzi: '习惯', pinyin: 'xíguàn', hanviet: 'tập quán', meaning: 'thói quen', kind: 'abstract' };

export function draw(k, t = 0) {
  const x0 = 210, y0 = 300, cw = 82, ch = 78, cols = 7, rows = 4;
  k.pop(t, 0.02, () => {
    k.shadow(500, y0 + rows * ch + 120, 330, 26);
    k.rect(x0 - 30, y0 - 120, cols * cw + 60, rows * ch + 170, { fill: 'paperwhite', radius: 16 });   // the page
    k.rect(x0 - 30, y0 - 120, cols * cw + 60, 80, { fill: 'persimmon', radius: 16 });                  // header band
    for (const rx of [x0 + 90, x0 + cols * cw - 90]) k.tube([[rx, y0 - 150], [rx, y0 - 95]], 14, { fill: 'grey' }); // rings
    for (let r = 0; r <= rows; r++) k.line(x0, y0 + r * ch, x0 + cols * cw, y0 + r * ch, { weight: 'fine' });
    for (let c = 0; c <= cols; c++) k.line(x0 + c * cw, y0, x0 + c * cw, y0 + rows * ch, { weight: 'fine' });
  }, { pivot: [500, 500], dur: 0.12 });
  // one tick per day, at a steady beat
  for (let i = 0; i < 24; i++) {
    const cx = x0 + (i % cols) * cw + cw / 2, cy = y0 + Math.floor(i / cols) * ch + ch / 2;
    k.pop(t, 0.16 + i * 0.026, () => k.line([[cx - 22, cy + 2], [cx - 6, cy + 18], [cx + 24, cy - 20]], { weight: 'bold', ink: 'malachite' }), { pivot: [cx, cy], dur: 0.06 });
  }
}
