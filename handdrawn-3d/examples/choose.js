// 选择 lựa chọn (choice), in 3D: a fork in the road with a signpost, and a Q版 kid at the fork, hand on chin,
// looking down one road, then the other. The look is keyframed; the body turn follows it on a spring
// (k.follow), so the turn starts soft and settles, as a real turn does.
// part       call                        where (z up)                                       colour
// ground     box                         a soft rounded board                                green
// roads      panel (on: ground)          one road from the back splitting into two toward us  yellow
// signpost   cylinder + 2 boards (box)   at the fork; one board points left, one right       wood, blue
// kid        k.chibi, right hand to chin  at the fork, facing the viewer                      orange / blue
export const sheet = { seed: 6, frames: 24, fps: 8, camera: { yaw: 15, pitch: 22 } };

const spring = (p) => { const w = 2 * Math.PI * 1.25, f = (x) => 1 - (1 + w * x) * Math.exp(-w * x); return p <= 0 ? 0 : p >= 1 ? 1 : f(p) / f(1); };
function beats(t, B) {
  const total = B.reduce((a, b) => a + b[1], 0);
  let x = (((t % 1) + 1) % 1) * total, from = B[B.length - 1][0];
  for (const [to, l, e] of B) { if (x <= l) return from + (to - from) * (e ? spring(x / l) : 1); x -= l; from = to; }
  return B[B.length - 1][0];
}

export function draw(k, t = 0) {
  const ground = k.box([0, 0, 0], [320, 280, 8], { fill: 'green' });
  const G = 8.4;
  // the road: one lane from the back, splitting at the fork (y = −20) into two that run toward the viewer
  k.panel([[-30, 140, G], [30, 140, G], [30, -20, G], [-30, -20, G]], { on: ground, fill: 'yellow' });
  k.panel([[-30, -20, G], [0, -20, G], [-110, -140, G], [-160, -140, G]], { on: ground, fill: 'yellow' });
  k.panel([[0, -20, G], [30, -20, G], [160, -140, G], [110, -140, G]], { on: ground, fill: 'yellow' });
  // signpost at the fork, behind the kid: one board points down each road
  k.cylinder([0, 10, G], 6, 190, { fill: 'wood' });
  k.box([-46, 10, G + 160], [84, 8, 26], { fill: 'blue', rotate: { z: -28 } });
  k.box([46, 10, G + 126], [84, 8, 26], { fill: 'blue', rotate: { z: 28 } });
  // the kid at the fork, facing us: looks down the left road, then the right; the body follows the look on a spring
  const look = beats(t, [[0, 0.4], [-25, 0.8, 1], [-25, 0.6], [25, 1.1, 1], [25, 0.6], [0, 0.8, 1]]);
  const turn = k.follow(t, (u) => 0.6 * beats(u, [[0, 0.4], [-25, 0.8, 1], [-25, 0.6], [25, 1.1, 1], [25, 0.6], [0, 0.8, 1]]), { key: 'choose-body', f: 1.3, z: 0.7 });
  const at = [0, -50, G], o = { turn: turn + 0.4 * look, shirt: 'orange', pants: 'blue', expression: 'neutral', headTilt: 4 };
  const L = k.chibiLayout(at, o);
  const chin = [L.mouth[0], L.mouth[1] - 4, L.mouth[2] - 18];
  k.chibi(at, { ...o, reach: { right: chin }, rightPole: [0.6, -0.4, -0.7] });
}
