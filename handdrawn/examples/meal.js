// Lunch on a wooden table: a bowl of phở, iced tea, a plate of herbs. Side view, Vietnamese labels.
export const sheet = { theme: 'classic', seed: 9, width: 1200, height: 900 };

export function draw(k) {
  k.title('bữa trưa', { sub: 'a bowl of phở at noon' });
  const top = 620; // table surface

  // table: top band + front edge + legs
  k.rect(80, top + 70, 34, 200, { fill: 'brown' });
  k.rect(1086, top + 70, 34, 200, { fill: 'brown' });
  k.rect(40, top, 1120, 74, { fill: 'wood', shade: 0.4 });
  k.line([[60, top + 26], [400, top + 30]], { weight: 'fine' });
  k.line([[700, top + 46], [1120, top + 42]], { weight: 'fine' });

  // herb plate (left)
  k.ellipse(250, top - 6, 150, 22, { fill: 'white', shade: 0.4 });
  for (const [x, y, a] of [[130, -22, -12], [175, -32, -4], [215, -20, 8], [250, -34, -20]]) k.leaf(x, top + y, { len: 80, angle: a, width: 0.5, fill: 'leaf' });
  k.arc(345, top - 14, 26, 22, 180, 360, { weight: 'detail' });  // lime half, cut side up
  k.ellipse(345, top - 14, 26, 7, { fill: 'leaf', weight: 'detail' });
  k.ellipse(345, top - 15, 20, 4.5, { fill: 'yellow', weight: 'fine' });
  k.tube([[150, top - 12], [175, top - 18], [205, top - 14]], [12, 4], { fill: 'red', weight: 'detail' }); // chilli

  // the bowl, with broth, noodles and chopsticks
  k.tube([[470, 330], [760, 470]], 9, { fill: 'wood', weight: 'detail' });
  k.tube([[500, 315], [770, 455]], 9, { fill: 'wood', weight: 'detail' });
  const bowl = k.turned([[230, 0], [222, 70], [180, 170], [90, 215], [80, 230, 'c'], [95, 240]],
    { cx: 600, y: top - 240, fill: 'white', shade: 0.25, hatch: { spacing: 8, amount: 0.14 }, rim: true, inside: 'ochre' });
  // a blue band and pattern
  const band = (y) => { const hw = bowl.halfWidthAt(y); return [[600 - hw + 4, y], [600, y + hw * 0.14], [600 + hw - 4, y]]; };
  k.spline(band(top - 200), { weight: 'detail', ink: 'navy' });
  k.spline(band(top - 186), { weight: 'detail', ink: 'navy' });
  // toppings on the broth
  const ry = bowl.rim.y;
  for (const [dx, dy] of [[-120, 4], [-60, -6], [40, 6], [110, -4]]) k.ellipse(600 + dx, ry + dy, 42, 9, { fill: 'tan', weight: 'fine' }); // beef
  for (const [dx, dy] of [[-150, -8], [-10, -10], [150, 4], [60, -14]]) k.leaf(600 + dx, ry + dy, { len: 34, angle: -160 + dx * 0.3, fill: 'green', vein: false });
  k.circle(600 + 10, ry + 12, 9, { fill: 'cream', weight: 'fine' });
  k.steam(600, ry - 30, { n: 3, h: 120, spread: 90 });

  // iced tea (right)
  k.turned([[62, 0], [58, 160], [50, 180]], { cx: 960, y: top - 180, fill: 'ochre', shade: 0.3, rim: true, inside: 'yellow' });
  for (const [dx, dy] of [[-22, 50], [14, 80], [-6, 120]]) k.roundRect(960 + dx - 14, top - 180 + dy, 28, 24, 6, { fill: 'white', weight: 'fine' });

  k.label('phở bò', { x: 860, y: 250, to: [790, ry + 10] });
  k.label('rau thơm, chanh', { x: 90, y: 440, to: [240, top - 40] });
  k.label('trà đá', { x: 1010, y: 360, to: [985, top - 170] });
}
