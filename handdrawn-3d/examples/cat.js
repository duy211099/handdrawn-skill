// A Q版 cat sitting on a cushion. The cat gives a little hop of breath twice a loop; its tail swings after it on a
// spring (k.follow), and blinks once.
// part      call             where (z up)                              colour
// cushion   lathe { smooth } r 0→95, a soft puffy disc, h 0..22         celadon
// cat       k.cat            sitting on the cushion, turned a little    orange
export const sheet = { seed: 5, frames: 24, fps: 12, camera: { yaw: 30, pitch: 20 } };

export function draw(k, t = 0) {
  k.lathe([0, 0, 0], [[0, 0], [80, 1], [95, 10], [88, 20], [0, 22]], { fill: 'celadon', smooth: true });
  const tail = k.follow(t, (u) => 22 * Math.sin(2 * Math.PI * u), { key: 'cat3d-tail', f: 1.6, z: 0.35 });
  const blink = t > 0.86 && t < 0.92;
  k.cat([0, 0, 20], { turn: 20, h: 190, fill: 'orange', tail, eyes: blink ? 'closed' : 'open' });
}
