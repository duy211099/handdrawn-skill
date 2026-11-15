// A leafy plant in a terracotta pot, front view.
export const sheet = { theme: 'classic', seed: 7 };

export function draw(k) {
  const cx = 500;
  k.shadow(cx, 880, 230, 26, { lines: 3 });

  // stems and leaves first (the pot covers their bottoms)
  // each stem: where its tip goes (relative to the soil centre) and leaves at fractions along it.
  // side −1/+1 = a side leaf angled off the stem; side 0 = the leaf at the tip, along the stem.
  const stems = [
    { to: [-200, -250], leaves: [[0.55, 1], [1, 0]] },
    { to: [-115, -360], leaves: [[0.5, -1], [1, 0]] },
    { to: [-15, -400], leaves: [[0.6, 1], [1, 0]] },
    { to: [85, -370], leaves: [[0.45, -1], [1, 0]] },
    { to: [190, -270], leaves: [[0.55, -1], [1, 0]] },
    { to: [240, -140], leaves: [[1, 0]] },
    { to: [-240, -130], leaves: [[1, 0]] },
  ];
  const soil = [cx, 570];
  stems.forEach((s, i) => k.scope('stem' + i, () => {
    const end = [cx + s.to[0], soil[1] + s.to[1]];
    const mid = [cx + s.to[0] * 0.3, soil[1] + s.to[1] * 0.7];
    k.tube([soil, mid, end], [10, 6], { fill: 'green', weight: 'detail' });
    const stemAngle = Math.atan2(end[1] - mid[1], end[0] - mid[0]) * 180 / Math.PI;
    for (const [f, side] of s.leaves) {
      const p = [soil[0] + (end[0] - soil[0]) * f, soil[1] + (end[1] - soil[1]) * f];
      k.leaf(p[0], p[1], { len: side ? 95 : 120, angle: stemAngle + side * 55, width: 0.5, fill: i % 2 ? 'leaf' : 'green' });
    }
  }));

  // pot: rim lip on top of a tapered body
  k.turned([[175, 0], [168, 230], [125, 300]], { cx, y: 580, fill: 'orange', hatch: { spacing: 8 } });
  k.roundRect(cx - 200, 545, 400, 70, 10, { fill: 'orange', shade: 0.4 });
  k.ellipse(cx, 548, 182, 18, { fill: 'chocolate', weight: 'detail' });
  // a little drip tray
  k.roundRect(cx - 150, 870, 300, 22, 8, { fill: 'stone', shade: 0.5 });
}
