// Abstract word for Vietnamese learners: 希望 xīwàng (Hán Việt: HY VỌNG). A picture alone can't carry an
// abstract word, so the card sits beside it. The card is steady (no boil, no stroke animation) so it stays easy
// to read; only the picture moves (sun rays turn, the sprout sways).
export const sheet = { width: 1200, height: 760, seed: 3 };

export function draw(k, t = 0) {
  const cx = 330, ground = 560;
  // rising sun behind the hill
  const sway = Math.sin(t * Math.PI * 2);
  for (let i = 0; i < 9; i++) {
    const a = (-180 + 11 + i * 20 + sway * 3) * Math.PI / 180;
    k.line(cx + Math.cos(a) * 170, ground - 40 + Math.sin(a) * 170, cx + Math.cos(a) * 225, ground - 40 + Math.sin(a) * 225, { weight: 'detail' });
  }
  k.circle(cx, ground - 40, 140, { fill: 'yellow', shade: 0.2 });
  // the hill / ground in front of the sun
  k.spline([[-30, ground + 5], [330, ground - 35], [800, ground + 20], [1230, ground + 5], [1230, 800, 'c'], [-30, 800, 'c']], { closed: true, fill: 'sand', shade: 0.25 });
  k.grass(60, 1150, ground + 40, { n: 12, size: 18 });
  // a small sprout pushing up
  k.scope('sprout', () => {
    const top = [cx + sway * 8, ground - 140];
    k.tube([[cx, ground - 30], [cx + sway * 3, ground - 85], top], [9, 6], { fill: 'green', weight: 'detail' });
    k.leaf(top[0], top[1], { len: 80, angle: -150 + sway * 6, width: 0.55, fill: 'leaf' });
    k.leaf(top[0], top[1], { len: 90, angle: -30 + sway * 6, width: 0.55, fill: 'green' });
  });

  k.word({ hanzi: '希望', pinyin: 'xīwàng', hanviet: 'hy vọng', meaning: 'hy vọng, mong muốn', x: 880, y: 210, size: 150, align: 'center' });
}
