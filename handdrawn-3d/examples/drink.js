// A Q版 person drinks a glass of water, in 3D. The same action as the 2D vocab card 喝 (vocab-drink.js), but
// everything lives in one 3D space, so the arm, the glass and the head line up by construction.
// Primary motion (keyframed beats): the glass goes chest → lips → sip → back.
// Everything else is solved or simulated from it:
//   arm    two-bone IK in 3D with a fixed pole (elbow out to the side): never flips, foreshortens on its own
//   head   tips back a beat after the glass (k.follow)
//   water  the inside of the glass clipped by a level plane, volume kept by bisection; "up" for the water is
//          gravity minus the glass's acceleration, swung by a spring (k.follow), so it sloshes and rings out
// part        call                       where (person frame: x = their left→right, -y = the way they face, z up)
// person     k.chibi                    the kit's Q版 person, right hand reaching       orange / blue
// glass       lathe { wall }             r 17→21, h 52, held in the right hand        white
// water       mesh (in: glass)           level surface, fill 0.6                       sky
export const sheet = { seed: 3, frames: 24, fps: 8, camera: { yaw: 30, pitch: 18 } };

const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => mul(a, 1 / (len(a) || 1));
const lerp3 = (a, b, s) => add(a, mul(sub(b, a), s));
const rotX = (p, deg) => { const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a); return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]]; };

// Apple 'smooth' spring (bounce 0) and loop beats, as in the 2D kit
const spring = (p) => { const w = TAU * 1.25, f = (x) => 1 - (1 + w * x) * Math.exp(-w * x); return p <= 0 ? 0 : p >= 1 ? 1 : f(p) / f(1); };
function beats(t, B) {
  const total = B.reduce((a, b) => a + b[1], 0);
  let x = (((t % 1) + 1) % 1) * total, from = B[B.length - 1][0];
  for (const [to, l, e] of B) { if (x <= l) return from + (to - from) * (e ? spring(x / l) : 1); x -= l; from = to; }
  return B[B.length - 1][0];
}
const S = (u) => beats(u, [[0, 0.8], [1, 0.8, 1], [1, 0.9], [0, 0.8, 1]]);       // 0 chest … 1 lips
const SIP = (u) => beats(u, [[0, 0.8], [0, 0.8], [1, 0.9, 1], [0, 0.8, 1]]);     // a little more tip while drinking

// ---- glass and water
const GR0 = 17, GR1 = 21, GH = 52, WALL = 2.5, FLOOR = 3, FILL = 0.6, SEG = 28;
const innerAt = (z) => GR0 - WALL + ((GR1 - GR0) * z) / GH;                        // inner radius at height z
// the inside of the glass as a closed convex mesh in glass coordinates (base centre at 0, axis z)
function innerHull() {
  const V = [], F = [];
  for (let i = 0; i < SEG; i++) { const a = (i / SEG) * TAU; V.push([innerAt(FLOOR) * Math.cos(a), innerAt(FLOOR) * Math.sin(a), FLOOR]); }
  for (let i = 0; i < SEG; i++) { const a = (i / SEG) * TAU; V.push([innerAt(GH) * Math.cos(a), innerAt(GH) * Math.sin(a), GH]); }
  for (let i = 0; i < SEG; i++) { const j = (i + 1) % SEG; F.push([i, j, SEG + j, SEG + i]); }
  F.push(Array.from({ length: SEG }, (_, i) => SEG - 1 - i));                         // floor (faces down)
  F.push(Array.from({ length: SEG }, (_, i) => SEG + i));                             // top (faces up)
  return { V, F };
}
const HULL = innerHull();
const volume = (polys) => polys.reduce((v, P) => { for (let i = 1; i + 1 < P.length; i++) v += dot(P[0], cross(P[i], P[i + 1])); return v; }, 0) / 6;
// clip a convex mesh (as polygons) to the half-space dot(p, up) <= L, closing it with a cap
function clipBelow(polys, up, L) {
  const out = [], capPts = [];
  for (const P of polys) {
    const Q = [];
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length], a = dot(p, up) - L, b = dot(q, up) - L;
      if (a <= 0) Q.push(p);
      if ((a <= 0) !== (b <= 0)) { const x = lerp3(p, q, a / (a - b)); Q.push(x); capPts.push(x); }
    }
    if (Q.length >= 3) out.push(Q);
  }
  if (capPts.length >= 3) {                                                          // the surface: order around its centre
    const c = mul(capPts.reduce(add, [0, 0, 0]), 1 / capPts.length);
    const e1 = unit(Math.abs(up[0]) < 0.9 ? cross(up, [1, 0, 0]) : cross(up, [0, 1, 0])), e2 = cross(up, e1);
    const cap = capPts.map((p) => [p, Math.atan2(dot(sub(p, c), e2), dot(sub(p, c), e1))]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
    const dd = cap.filter((p, i) => len(sub(p, cap[(i + 1) % cap.length])) > 1e-6);
    if (dd.length >= 3) out.push(dd);
  }
  return out;
}
// water in a glass placed by (pos, tilt about x): polygons in person coordinates, surface square to `up`
function water(pos, tilt, up) {
  const polys = HULL.F.map((f) => f.map((i) => add(pos, rotX(HULL.V[i], tilt))));
  const target = volume(polys) * FILL;
  const ds = polys.flat().map((p) => dot(p, up));
  let lo = Math.min(...ds), hi = Math.max(...ds);
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (volume(clipBelow(polys, up, m)) < target) lo = m; else hi = m; }
  return { polys: clipBelow(polys, up, hi), level: hi };
}
// polygons → indexed mesh (shared vertices, so the kit sees one closed solid)
function toMesh(polys) {
  const V = [], key = new Map(), F = [];
  for (const P of polys) F.push(P.map((p) => { const k = p.map((v) => v.toFixed(3)).join(','); if (!key.has(k)) { key.set(k, V.length); V.push(p); } return key.get(k); }));
  return { V, F };
}

// ---- the person: the kit's Q版 person, k.chibi (facing -y). k.chibiLayout gives the mouth before drawing.
const WHO = { shirt: 'orange', pants: 'blue', expression: 'neutral' };
// drinking starts when the water reaches the near rim: find that tilt once (level surface), then tip a little past it
const WET_TILT = (() => {
  const wet = (tl) => water([0, 0, 0], -tl, [0, 0, 1]).level >= rotX([0, GR1, GH], -tl)[2] - 0.5;
  let lo = 0, hi = 110;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (wet(m)) hi = m; else lo = m; }
  return hi;
})();
// the glass's pose at loop time u. Near rim point (the side toward the face, +y in glass coordinates) → the lips.
const REST_RIM = [14, -46, 110];
function glassPose(u, lips) {
  const s = S(u), sip = SIP(u);
  const tilt = -(s * (WET_TILT + 4) + 8 * sip);                                     // − tips the top toward the face
  const rim = lerp3(REST_RIM, lips, s);
  const pos = sub(rim, rotX([0, GR1, GH], tilt));                                   // glass base centre
  return { s, tilt, pos, centre: add(pos, rotX([0, 0, GH * 0.35], tilt)) };
}

export function draw(k, t = 0) {
  // the head tips back (looks up) a beat after the glass
  const look = (u) => k.follow(u, (v) => 14 * S(v) + 5 * SIP(v), { key: 'head3d', f: 1.4, z: 0.6 });
  const pose = (u) => glassPose(u, add(k.chibiLayout([0, 0, 0], { ...WHO, headTilt: look(u) }).mouth, [0, 0, -1]));
  const G = pose(t);
  // the water's "up": gravity minus the glass's acceleration (units ≈ 2 mm, so g ≈ 4900/s²), doubled Q版-style,
  // then a spring so it lags, overshoots and rings out
  const upXY = k.follow(t, (u) => {
    const a = k.accel((v) => pose(v).centre, u), g = 4900;
    const up = unit([a[0], a[1], g + a[2]]);
    const c = (v) => Math.max(-0.3, Math.min(0.3, 2 * v));
    return [c(up[0]), c(up[1])];
  }, { key: 'slosh3d', f: 1.8, z: 0.22 });
  const up = [upXY[0], upXY[1], Math.sqrt(1 - upXY[0] ** 2 - upXY[1] ** 2)];

  k.group({ rotate: { z: -15 } }, () => {                                           // ¾ view, facing screen-left
    // the glass and its water first, then the person reaching for it (the arm is cut where it meets the hand)
    let glass;
    k.group({ about: [0, 0, 0], rotate: [[1, 0, 0], G.tilt], at: G.pos }, () => {
      glass = k.lathe([0, 0, 0], [[GR0, 0], [GR1, GH]], { fill: 'white', wall: WALL, floor: FLOOR });
    });
    const m = toMesh(water(G.pos, G.tilt, up).polys);                                // already in person space
    k.mesh(m.V, m.F, { fill: 'sky', in: glass, shadow: false, creases: false });
    const hand = add(G.pos, rotX([GR1 + 7, 0, GH * 0.45], G.tilt));                  // on the glass's outer side
    k.chibi([0, 0, 0], { ...WHO, headTilt: look(t), expression: G.s > 0.9 ? 'closed' : 'neutral', reach: { right: hand } });
  });
}
