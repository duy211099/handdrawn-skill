// An apple with a leaf, side view.
export const sheet = { theme: 'classic', seed: 2 };

export function draw(k) {
  k.shadow(510, 835, 300, 34, { lines: 3 });

  // body: a round heart, dipped at the top and slightly at the base
  const body = k.geo.spline([
    [500, 300], [580, 255], [700, 270], [790, 380], [800, 530], [740, 700],
    [640, 810], [560, 800], [500, 815], [440, 800], [360, 810], [260, 700], [200, 530], [210, 380], [300, 270], [420, 255],
  ], true);
  k.draw(body, { fill: 'red', shade: 0.24, hatch: { spacing: 8, amount: 0.1 } });

  // a few speckles and the stalk well
  for (const [x, y] of [[640, 470], [680, 560], [600, 620], [360, 560], [420, 650], [700, 400], [330, 420]]) k.dot(x, y, 4, { fill: 'cream' });
  k.arc(500, 300, 46, 16, 200, 340, { weight: 'detail' });

  // highlight on the lit (top-left) side
  k.arc(330, 450, 80, 120, 200, 245, { weight: 'detail', ink: 'white' });

  // stalk + leaf
  k.tube([[500, 300], [495, 240], [520, 180]], [16, 11], { fill: 'brown' });
  k.leaf(512, 215, { len: 190, angle: -18, width: 0.44, fill: 'leaf' });
}
