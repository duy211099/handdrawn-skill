// Abstract word: 希望 xīwàng (Hán Việt: HY VỌNG). A picture alone can't carry an abstract word, so there is no
// picture-only recall face; the picture is a situation that shows the word, and the card (added by the
// renderer under it) carries the meaning. Only the picture moves: sun rays turn, the sprout sways.
export const sheet = { seed: 3 };

export const vocab = { hanzi: '希望', pinyin: 'xīwàng', hanviet: 'hy vọng', meaning: 'hy vọng, mong muốn', kind: 'abstract' };

export function draw(k, t = 0) {
  const cx = 500, ground = 760;
  const sway = Math.sin(t * Math.PI * 2);
  // rising sun behind the hill
  for (let i = 0; i < 9; i++) {
    const a = (-180 + 11 + i * 20 + sway * 3) * Math.PI / 180;
    k.line(cx + Math.cos(a) * 290, ground - 50 + Math.sin(a) * 290, cx + Math.cos(a) * 370, ground - 50 + Math.sin(a) * 370, { weight: 'detail' });
  }
  k.circle(cx, ground - 50, 250, { fill: 'yellow', shade: 0.2 });
  // the hill in front of the sun
  k.spline([[-30, ground + 5], [500, ground - 40], [1030, ground + 5], [1030, 1000, 'c'], [-30, 1000, 'c']], { closed: true, fill: 'sand', shade: 0.25 });
  k.grass(60, 940, ground + 60, { n: 10, size: 20 });
  // a small sprout pushing up
  k.scope('sprout', () => {
    const top = [cx + sway * 10, ground - 230];
    k.tube([[cx, ground - 40], [cx + sway * 4, ground - 135], top], [12, 8], { fill: 'green', weight: 'detail' });
    k.leaf(top[0], top[1], { len: 130, angle: -150 + sway * 6, width: 0.55, fill: 'leaf' });
    k.leaf(top[0], top[1], { len: 140, angle: -30 + sway * 6, width: 0.55, fill: 'green' });
  });
}
