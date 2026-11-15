// Action word: 喝 hē (Hán Việt: HÁT), uống. A Q版 person drinks from a glass of water.
// The loop has beats, like a real action: rest at the chest, lift, sip (hold, tipping a little more), lower.
// The glass is keyframed with the 'smooth' spring (no overshoot); what it drags along is simulated with k.follow:
// the head tips back a beat late and settles, the water sloshes from the glass's acceleration and rings out.
//
// Whole-body, skeleton-correct drinking in a three-quarter view (turn: -1, looking to the viewer's left): the
// mouth is at the side of the face, so the glass can tip across the picture toward it, as in a profile.
// - the head tips back as the glass rises (headTilt), the eyes close for the sip
// - the glass tips just far enough for the water to reach the lips (solved from how full it is), water stays level
// - the hand keeps its grip; the arm is solved in 3D with a fixed pole (reach), so the elbow rises out to the side
//   while drinking and never flips, and the arm comes toward the viewer as the glass passes the shoulder
export const sheet = { seed: 3, duration: 3.3 };
export const vocab = { hanzi: '喝', pinyin: 'hē', hanviet: 'hát', meaning: 'uống',
  note: '! hát ở đây không phải ca hát', kind: 'action' };

const glassShape = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w * 0.41, h / 2], [-w * 0.41, h / 2]];

// makeDrink(person options) → a draw function, so the same action can be compared across Q版 settings
export const draw = makeDrink({ h: 820, hairStyle: 'short', shirt: 'persimmon', pants: 'azurite' });

export function makeDrink(who) { return function draw(k, t = 0) {
  // PRIMARY motion (keyframed): s: 0 = glass at the chest, 1 = at the lips.  sip: a little more tip while drinking
  const S = (u) => k.motion(u, [[0, 0.8], [1, 0.8, 'smooth'], [1, 0.9], [0, 0.8, 'smooth']]);
  const SIP = (u) => k.motion(u, [[0, 0.8], [0, 0.8], [1, 0.9, 'smooth'], [0, 0.8, 'smooth']]);
  // SECONDARY motion (simulated): the head follows the glass a beat late and settles with a little give
  const headOf = (u) => k.follow(u, (v) => 13 * S(v) + 4 * SIP(v), { key: 'drink-head', f: 1.4, z: 0.6 });
  const person = { ...who, turn: -1 };
  const rHof = (L) => (who.head || 0.45) * 50 * L.unit;

  // the whole pose at loop time u (the glass goes to wherever the lips are now)
  const pose = (u) => {
    const s = S(u), sip = SIP(u), lerp = (a, b) => a + (b - a) * s;
    const p = { ...person, headTilt: headOf(u) };
    const L = k.chibiLayout(500, 930, p), rH = rHof(L);
    const gw = rH * 0.72, gh = rH * 1.0, G = glassShape(gw, gh);
    // drinking starts when the water reaches the rim at the lips; find that tilt, then tip a bit past it
    const wet = (tl) => { const w = k.liquid(G, { tilt: tl, fill: FILL }); return !!w && w.poly.some((q) => Math.hypot(q[0] - G[0][0], q[1] - G[0][1]) < 1e-6); };
    let lo = 0, hi = -120;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (wet(mid)) hi = mid; else lo = mid; }
    const tilt = lerp(0, hi - 4) - 6 * sip, tr = tilt * Math.PI / 180;
    const rot = ([x, y], a = tr) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    // the near rim corner (on the face side) goes to the lips; at rest the glass is held in front of the chest
    const lip = [L.mouth[0] - rH * 0.02, L.mouth[1] + rH * 0.02];
    const rest = [L.shoulderR[0] - rH * 0.55, L.shoulderR[1] + L.armLength * 0.3];
    const corner = [lerp(rest[0], lip[0]), lerp(rest[1], lip[1])];
    const c = rot(G[0]), g = [corner[0] - c[0], corner[1] - c[1]];
    const mid = rot([0, gh * 0.15]), centre = [g[0] + mid[0], g[1] + mid[1]];   // roughly where the water's mass is
    return { s, p, rH, gw, gh, G, tilt, rot, g, centre };
  };
  const FILL = 0.6;

  // the water is a pendulum: the glass's acceleration tilts "down" for the water (a = gravity − acceleration of
  // the glass), and the surface swings after it and rings out. Scale: the glass is ~10 cm tall; the
  // swing is doubled, Q版-style, so it reads at card size.
  const slosh = k.follow(t, (u) => {
    const P = pose(u), grav = 9.8 * P.gh / 0.1, a = k.accel((v) => pose(v).centre, u);
    const deg = (2 * Math.atan2(a[0], grav - a[1]) * 180) / Math.PI;
    return Math.max(-14, Math.min(14, deg));
  }, { key: 'drink-slosh', f: 1.8, z: 0.22 });

  const P = pose(t), { rH, gw, gh, G, tilt, rot, g } = P;
  // grip on the outer side, lower half; the wrist joins on the back of the hand
  const e = rot([gw * 0.44, gh * 0.18]), grip = [g[0] + e[0], g[1] + e[1]];
  const gs = gh * 0.5, wl = rot([gw * 0.44 + gs * 0.55, gh * 0.18 + gs * 0.1]), wrist = [g[0] + wl[0], g[1] + wl[1]];

  k.chibi(500, 930, { ...P.p, reach: { right: wrist }, expression: P.s > 0.9 ? 'closed' : 'neutral' });
  k.group({ x: g[0], y: g[1], rotate: tilt }, () => k.scope('glass', () => {
    k.poly(G, { fill: 'paperwhite', weight: 'outline' });
    const w = k.liquid(G, { tilt: tilt - slosh, fill: FILL });   // the surface stays flat (no wobbling liquid), it only tips
    if (w) {
      k.poly(w.poly, { fill: 'celadon', ink: false });
      if (w.surface) k.line(w.surface[0][0], w.surface[0][1], w.surface[1][0], w.surface[1][1], { weight: 'detail' });
    }
  }));
  k.grip(grip[0], grip[1], { size: gs, across: gw * 0.95, angle: tilt, side: 'right', weight: 'outline' });
}; }
