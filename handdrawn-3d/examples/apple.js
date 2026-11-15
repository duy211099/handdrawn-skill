// An apple with a leaf. The leaf flutters on its stalk in a little breeze: the breeze is the cause (a slow
// wave), the leaf follows it on a spring (k.follow), so it lags, overshoots and settles instead of ticking.
// part     call                 where (z up)                          colour
// apple    lathe { smooth }     r 0→50→0, h 0..72, dip at the top     red
// stalk    tube [3, 2]          from inside the top, curving up       brown
// leaf     panel { thick }      on the stalk, tips with the breeze    green
export const sheet = { seed: 2, frames: 24, fps: 12, camera: { yaw: 35, pitch: 22 } };

export function draw(k, t = 0) {
  k.lathe([0, 0, 0], [[0, 2], [22, 3], [42, 14], [50, 36], [46, 58], [34, 70], [18, 72], [6, 66], [0, 63]], { fill: 'red', smooth: true });
  const top = [0, 0, 64];
  k.tube([top, [1, 0, 78], [5, 0, 92]], [3, 2], { fill: 'brown' });
  // breeze: a slow push twice a loop; the leaf swings after it
  const sway = k.follow(t, (u) => 18 * Math.max(0, Math.sin(2 * Math.PI * 2 * u)), { key: 'apple-leaf', f: 2.2, z: 0.3 });
  k.group({ about: [3, 0, 86], rotate: { x: 30, y: -14 + sway, z: 60 } }, () => {
    const leaf = [];
    for (let i = 0; i <= 12; i++) {                                                // a leaf outline, base at the stalk
      const a = (i / 12) * Math.PI, w = Math.sin(a) * 15;
      leaf.push([3 + (1 - Math.cos(a)) * 22, -w, 86 + (1 - Math.cos(a)) * 7]);
    }
    for (let i = 11; i > 0; i--) { const p = leaf[i]; leaf.push([p[0], -p[1], p[2]]); }
    k.panel(leaf, { fill: 'green', thick: 1.2 });
    k.line([[4, 0, 86.6], [24, 0, 93.6], [46, 0, 100.6]], { weight: 'fine', smooth: true });   // the midrib
  });
}
