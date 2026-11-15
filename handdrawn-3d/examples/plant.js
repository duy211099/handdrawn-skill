// A leafy plant in a terracotta pot. The stems sway in a breeze: each stem follows the same breeze on its own
// spring (k.follow), the tall thin ones slower and floppier, so they move together but never in lockstep.
// part     call                 where (z up)                                   colour
// pot      lathe { wall }       r 46→58, h 0..70, rim band at the top          orange
// soil     cylinder (in: pot)   just under the rim                             brown
// stems    tube [3, 2]          from inside the soil, out and up               green
// leaves   panel { thick }      at each stem's tip, facing out                 green
export const sheet = { seed: 7, frames: 24, fps: 12, camera: { yaw: 40, pitch: 24 } };

const STEMS = [   // [direction about z (deg), lean (deg), length, f (Hz)]
  [0, 26, 110, 1.3], [60, 38, 90, 1.7], [130, 40, 84, 1.9], [200, 34, 98, 1.6], [270, 40, 88, 1.8], [320, 30, 104, 1.4],
  [95, 18, 116, 1.5], [240, 16, 120, 1.4],
];

export function draw(k, t = 0) {
  const pot = k.lathe([0, 0, 0], [[44, 0], [50, 50], [58, 54], [58, 70]], { fill: 'orange', wall: 4 });
  k.cylinder([0, 0, 52], 50, 10, { fill: 'brown', in: pot, shadow: false });
  const breeze = (u) => 10 * (0.6 + 0.4 * Math.sin(2 * Math.PI * u)) * Math.max(0, Math.sin(2 * Math.PI * 2 * u));
  STEMS.forEach(([dir, lean, L, f], i) => {
    const sway = k.follow(t, breeze, { key: 'plant-stem-' + i, f, z: 0.35 });      // degrees, toward +x
    k.group({ about: [0, 0, 60], rotate: { y: sway * (0.6 + L / 300) } }, () => {
      const a = (dir * Math.PI) / 180, l = (lean * Math.PI) / 180;
      const tip = [Math.cos(a) * Math.sin(l) * L, Math.sin(a) * Math.sin(l) * L, 60 + Math.cos(l) * L];
      const mid = [tip[0] * 0.35, tip[1] * 0.35, 60 + (tip[2] - 60) * 0.55];
      k.tube([[0, 0, 56], mid, tip], [3, 2], { fill: 'green' });
      // the leaf: a pointed oval in the plane of the stem, facing out
      const out = [Math.cos(a), Math.sin(a), 0], up = [0, 0, 1], side = [-Math.sin(a), Math.cos(a), 0];
      const along = [out[0] * 0.55, out[1] * 0.55, 0.83];
      const pts = [];
      for (let j = 0; j <= 16; j++) {
        const s = j / 16, w = Math.sin(s * Math.PI) * 17;
        const p = [tip[0] + along[0] * s * 52, tip[1] + along[1] * s * 52, tip[2] + along[2] * s * 52];
        pts.push([p[0] + side[0] * w, p[1] + side[1] * w, p[2] + up[2] * 0]);
      }
      for (let j = 15; j > 0; j--) {
        const s = j / 16, w = Math.sin(s * Math.PI) * 17;
        const p = [tip[0] + along[0] * s * 52, tip[1] + along[1] * s * 52, tip[2] + along[2] * s * 52];
        pts.push([p[0] - side[0] * w, p[1] - side[1] * w, p[2]]);
      }
      k.panel(pts, { fill: i % 2 ? 'green' : 'leaf', thick: 1.2 });
    });
  });
}
