// 纪律 kỷ luật (discipline), in 3D: the alarm clock rings at 6:00 and the Q版 kid is already up, doing morning
// stretches: arms out and up in a wide V, then down, twice a loop. The clock rattles on its feet while it rings.
// part     call                         where (z up)                                 colour
// mat      box                          under both, a soft rounded board              celadon
// kid      k.chibi, both arms reach     left of centre, turned a little to the right  orange / blue
// clock    cylinder (axis -y) + decals  right, face toward the viewer, on two feet   red, white
// bells    sphere ×2 + tube hammer      on top of the clock                           yellow
export const sheet = { seed: 4, frames: 24, fps: 8, camera: { yaw: 25, pitch: 20 } };

const spring = (p) => { const w = 2 * Math.PI * 1.25, f = (x) => 1 - (1 + w * x) * Math.exp(-w * x); return p <= 0 ? 0 : p >= 1 ? 1 : f(p) / f(1); };
function beats(t, B) {
  const total = B.reduce((a, b) => a + b[1], 0);
  let x = (((t % 1) + 1) % 1) * total, from = B[B.length - 1][0];
  for (const [to, l, e] of B) { if (x <= l) return from + (to - from) * (e ? spring(x / l) : 1); x -= l; from = to; }
  return B[B.length - 1][0];
}

export function draw(k, t = 0) {
  k.box([20, 0, 0], [420, 220, 8], { fill: 'celadon' });
  // the kid: arms up and down twice per loop
  const up = beats(t, [[0, 0.5], [1, 0.7, 1], [1, 0.35], [0, 0.7, 1], [1, 0.7, 1], [1, 0.35], [0, 0.7, 1]]);
  const at = [-70, 0, 8], o = { turn: 15, shirt: 'orange', pants: 'blue', expression: 'happy' };
  // targets in the caller's frame: from by the sides (down) to overhead (up)
  const a = (15 * Math.PI) / 180, toW = ([x, y, z]) => [at[0] + Math.cos(a) * x - Math.sin(a) * y, at[1] + Math.sin(a) * x + Math.cos(a) * y, at[2] + z];
  // Q版 arms are shorter than the head is tall, so the stretch is a wide V (out and up), not overhead
  const hand = (sd) => toW([sd * (40 + 75 * up), -6, 62 + 115 * up]);
  k.chibi(at, { ...o, reach: { right: hand(1), left: hand(-1) }, rightPole: [0.3, 0.2, -1], leftPole: [0.3, 0.2, -1] });

  // the alarm clock: rings in the first half of the loop
  const ring = Math.max(0, Math.sin(Math.PI * Math.min(1, t / 0.45)));
  const shake = 7 * ring * Math.sin(2 * Math.PI * 12 * t);
  const C = [120, -10, 8], R = 46;
  k.group({ about: C, rotate: { y: shake } }, () => {
    for (const sd of [-1, 1]) k.sphere([C[0] + sd * 26, C[1], C[2] + 4], 8, { fill: 'charcoal', scale: [1, 1, 0.7] });   // feet
    const body = k.cylinder([C[0], C[1] - 12, C[2] + 8 + R], R, 26, { axis: 'y', fill: 'red' });
    // the face, painted on the front: a white disc, hour marks, hands at 6:00
    const fy = C[1] - 12 - 0.4, cz = C[2] + 8 + R, ring12 = [];
    for (let i = 0; i < 20; i++) { const q = (i / 20) * 2 * Math.PI; ring12.push([C[0] + Math.cos(q) * R * 0.8, fy, cz + Math.sin(q) * R * 0.8]); }
    k.panel(ring12, { on: body, fill: 'white', flat: true });
    k.line([[C[0], fy - 0.2, cz], [C[0], fy - 0.2, cz + R * 0.58]], { on: body, normal: [0, -1, 0], weight: 'outline' });   // minute: 12
    k.line([[C[0], fy - 0.2, cz], [C[0], fy - 0.2, cz - R * 0.42]], { on: body, normal: [0, -1, 0], weight: 'outline' });   // hour: 6
    for (const sd of [-1, 1]) k.sphere([C[0] + sd * 26, C[1], cz + R + 8], 14, { fill: 'yellow' });                        // bells
    k.tube([[C[0], C[1], cz + R - 6], [C[0], C[1], cz + R + 18]], 3, { fill: 'charcoal' });                                 // hammer
  });
}
