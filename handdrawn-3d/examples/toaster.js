// A toaster; the bread pops up and drops back once per loop.
// parts        call                      notes
// body         box (round 34)            220 wide, 130 deep, 150 high
// slots        panel { on: body }        two dark slots on the top face
// bread        box (round 10)            only the part ABOVE the slot is modelled: its height animates
// lever        box                       on the right side, slides down when the bread drops
// feet         cylinder x4               small, under the corners
export const sheet = { seed: 8 };

export function draw(k, t = 0) {
  k.title('pop!', { sub: 'bánh mì nướng' });
  // bread height above the top: up fast at t = 0.5, then sinks back down
  const up = t < 0.5 ? k.smooth(t / 0.12) * (1 - k.smooth((t - 0.3) / 0.2)) : 0;
  const pop = 8 + 62 * Math.max(0, up);
  for (const [x, y] of [[-85, -45], [85, -45], [-85, 45], [85, 45]]) k.cylinder([x, y, 0], 9, 6, { fill: 'charcoal', shadow: false });
  const body = k.box([0, 0, 6], [220, 130, 150], { fill: 'mint', round: 34 });
  for (const y of [-22, 22]) {
    k.panel([[-70, y - 9, 156], [70, y - 9, 156], [70, y + 9, 156], [-70, y + 9, 156]], { on: body, fill: 'charcoal' });
    k.box([0, y, 156], [128, 14, pop], { fill: 'tan', round: 6 });                 // bread (visible part)
  }
  const lever = 110 - 70 * (pop - 8) / 62;                                        // the lever goes down as the bread goes down
  k.box([118, 0, lever], [16, 14, 10], { fill: 'charcoal' });
  k.line([[110.5, 0, 40], [110.5, 0, 120]], { on: body, normal: [1, 0, 0], weight: 'fine' }); // lever slot
  k.label('crumbs welcome', { to: [0, -65, 40], side: 'left' });
}
