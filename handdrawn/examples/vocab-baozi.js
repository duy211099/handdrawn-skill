// Concrete word: 包子 bāozi (Hán Việt: BAO TỬ), bánh bao. Three steamed buns in an open bamboo steamer, front view,
// slightly from above. A thing as it looks in China; the steamer is part of how you recognise 包子, not decoration.
// parts: steamer back rim + inside, 3 buns (pleated tops), steamer front wall with bamboo bands, ground shadow
export const sheet = { seed: 5 };
export const vocab = { hanzi: '包子', pinyin: 'bāozi', hanviet: 'bao tử', meaning: 'bánh bao',
  note: '! bao tử ở đây không phải dạ dày', kind: 'concrete' };

export function draw(k) {
  const cx = 500, top = 590, bot = 780, rx = 300, ry = 70;
  const arc = (cy, a0, a1, rrx = rx, rry = ry, n = 24) =>
    Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * rrx, cy + Math.sin(a) * rry]; });
  k.shadow(cx, bot + 10, 340, 34, { lines: 3 });
  // inside of the steamer (back rim and the slatted floor)
  k.ellipse(cx, top, rx, ry, { fill: 'wood', shade: 0.15 });
  k.ellipse(cx, top + 8, rx - 22, ry - 16, { fill: 'tan', weight: 'detail' });
  // buns, back to front
  const bun = (x, y, r) => k.scope('bun' + x, () => {
    k.blob(x, y, r, { squash: 0.72, irregular: 0.03, fill: 'white', shade: 0.22 });
    const tx = x + r * 0.03, ty = y - r * 0.42;                // the twist, on the top surface (seen from a bit above)
    // pleats spiral out from the twist like a star, foreshortened: long ones run down the front of the dome
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      const ex = tx + Math.cos(a) * r * 0.55, ey = ty + Math.sin(a) * r * 0.26 + (Math.sin(a) > 0 ? r * 0.06 : 0);
      const mx = tx + Math.cos(a + 0.45) * r * 0.3, my = ty + Math.sin(a + 0.45) * r * 0.14;
      k.spline([[tx, ty], [mx, my], [ex, ey]], { weight: 'detail' });
    }
    k.blob(tx, ty - 2, r * 0.09, { squash: 0.8, fill: 'white', weight: 'fine' });
  });
  bun(500, 470, 150);
  bun(345, 545, 145);
  bun(660, 545, 145);
  // front wall of the steamer, covering the bottoms of the buns
  const wall = [...arc(top, Math.PI, 0), [cx + rx, bot, 'c'], ...arc(bot, 0, Math.PI).slice(1, -1), [cx - rx, bot, 'c']];
  k.spline([[cx - rx, top, 'c'], ...wall.slice(1)], { closed: true, fill: 'wood', shade: 0.3 });
  for (const dy of [36, 120]) k.line(arc(top + dy, Math.PI * 0.98, Math.PI * 0.02), { weight: 'detail' });
  for (let i = 1; i < 12; i++) {
    const a = Math.PI - (i / 12) * Math.PI, x = cx + Math.cos(a) * rx;
    k.line(x, top + Math.sin(a) * ry + 40, x, top + Math.sin(a) * ry + 112, { weight: 'fine' });
  }
}
