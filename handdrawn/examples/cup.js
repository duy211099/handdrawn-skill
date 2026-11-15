// A cup of coffee on a saucer, front view. Animated: steam rises (render with --gif or --animate).
export const sheet = { theme: 'classic', seed: 4 };

export function draw(k, t = 0) {
  k.title('a morning cup', { sub: 'cà phê sữa, still too hot' });

  // saucer (back to front: shadow, plate, inner well)
  k.shadow(500, 800, 330, 34, { lines: 3 });
  k.ellipse(500, 770, 305, 58, { fill: 'sky', shade: 0.35 });
  k.arc(500, 760, 190, 30, 10, 170, { weight: 'detail' });

  // handle first so the body overlaps its ends
  k.tube([[640, 470], [745, 455], [775, 545], [725, 640], [628, 650]], 36, { fill: 'red', shade: 0.3 });

  // body: a half-profile, mirrored
  const cup = k.turned(
    [[205, 0], [208, 40], [196, 180], [170, 280], [140, 330]],
    { cx: 470, y: 420, fill: 'red', rim: true, inside: 'chocolate', hatch: { spacing: 8 } }
  );
  // coffee surface + a cream band around the body
  k.ellipse(470, cup.rim.y + 6, 180, 24, { fill: 'tan', weight: 'fine' });
  const band = (y) => { const hw = cup.halfWidthAt(y); return [[470 - hw + 3, y], [470, y + hw * 0.16], [470 + hw - 3, y]]; };
  k.spline(band(520), { weight: 'detail' });
  k.spline(band(560), { weight: 'detail' });
  for (const [dx, dy] of [[-120, 540], [-40, 548], [40, 548], [120, 540]]) k.circle(470 + dx, dy, 7, { fill: 'cream', weight: 'fine' });

  k.steam(470, 380, { t, n: 3, h: 170, spread: 60 });
}
