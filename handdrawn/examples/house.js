// A small house with a tree and shrubs, front view.
export const sheet = { seed: 3 };

export function draw(k) {
  k.title('number twelve', { sub: 'a small house, front view' });
  const ground = 800;
  k.tree(170, ground + 4, { h: 420, fruit: 4 });
  const h = k.house(560, ground, { w: 480, h: 300, roof: 'red', wall: 'cream', door: 'teal', curtains: 'pink', flowers: 'yellow' });
  k.shrub(870, ground + 6, { r: 70, flowers: 4 });
  k.shrub(320, ground + 8, { r: 52, fill: 'sage' });
  // path to the door + ground line
  k.poly([[522, ground + 6], [598, ground + 6], [650, 965], [470, 965]], { fill: 'sand', weight: 'detail' });
  k.line([[40, ground + 18], [500, ground + 16]], { weight: 'detail' });
  k.line([[620, ground + 16], [960, ground + 19]], { weight: 'detail' });
  k.grass(60, 480, ground + 18, { n: 6 });
  k.grass(660, 950, ground + 18, { n: 4 });
}
