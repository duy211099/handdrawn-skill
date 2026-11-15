// Action word: 喝 hē (Hán Việt: HÁT), uống. A Q版 person drinks from a glass of water.
// The loop has beats, like a real action: rest at the chest, lift, sip (hold, tipping a little more), lower.
// Every move uses the 'smooth' spring (no overshoot): quick start, gentle settle.
//
// Skeleton-correct drinking, seen from the front: a real person tips the glass TOWARD the face (in depth), not
// sideways across it. So the glass stays upright on screen, gets shorter as it tips toward the viewer, and its
// base comes into view as an ellipse; the rim stays on the lips. The hand grips the glass's side the whole time,
// the forearm comes in from the side with the elbow out, and the wrist stays straight (rightElbowDir).
// The water stays level and collects at the rim end, which is the lowest end once the glass is tipped.
export const sheet = { seed: 3, duration: 3.3 };
export const vocab = { hanzi: '喝', pinyin: 'hē', hanviet: 'hát', meaning: 'uống',
  note: '! hát ở đây không phải ca hát', kind: 'action' };

// makeDrink(person options) → a draw function, so the same action can be compared across Q版 settings
export const draw = makeDrink({ h: 820, hairStyle: 'short', shirt: 'persimmon', pants: 'azurite' });

// a glass seen from the front, its axis tipped by phi toward the viewer (0 = upright, 90 = pointing at you).
// R = rim centre on screen. Returns the outline, the ellipse of the visible end and where the side is at mid height.
function glassView(R, gw, gh, phi) {
  const rad = (phi * Math.PI) / 180, axis = gh * Math.cos(rad), squash = Math.max(Math.abs(Math.sin(rad)), 0.2);
  const B = [R[0], R[1] + axis], rr = gw / 2, rb = gw * 0.41;
  const ell = (c, rx, a0, a1, n = 18) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * rx * squash]; });
  const baseBelow = axis >= 0;
  // outline: the half of each end ellipse that faces away from the other end
  const outline = baseBelow ? [...ell(R, rr, Math.PI, 2 * Math.PI), ...ell(B, rb, 0, Math.PI)] : [...ell(R, rr, 0, Math.PI), ...ell(B, rb, Math.PI, 2 * Math.PI)];
  return { outline, R, B, rr, rb, squash, baseFacing: phi > 90, mid: [R[0] + (rr + rb) / 2, (R[1] + B[1]) / 2] };
}

export function makeDrink(who) { return function draw(k, t = 0) {
  const L = k.chibiLayout(500, 930, who), rH = (who.head || 0.45) * 50 * L.unit;   // rH: head radius in sheet px
  // s: 0 = glass at the chest, 1 = at the lips.  sip: a little more tip while drinking
  const s = k.motion(t, [[0, 0.8], [1, 0.8, 'smooth'], [1, 0.9], [0, 0.8, 'smooth']]);
  const sip = k.motion(t, [[0, 0.8], [0, 0.8], [1, 0.9, 'smooth'], [0, 0.8, 'smooth']]);
  const lerp = (a, b) => a + (b - a) * s;

  const gw = rH * 0.72, gh = rH * 1.0, FILL = 0.6;
  const phi = lerp(0, 100) + 12 * sip;                                       // tip toward the viewer
  const R = [lerp(L.shoulderR[0] - rH * 0.05, L.mouth[0]), lerp(L.shoulderR[1] + L.armLength * 0.15, L.mouth[1] + rH * 0.04)];
  const G = glassView(R, gw, gh, phi);
  // hand on the glass's right side; forearm comes from the right (elbow out), wrist straight
  const gs = Math.min(gh * 0.48, Math.abs(G.B[1] - G.R[1]) + gw * 0.5);
  const grip = [G.mid[0] - gw * 0.02, G.mid[1]];
  const wrist = [grip[0] + gs * 0.55, grip[1] + gs * 0.1];

  // elbow: down by the side while holding the glass at the chest, out to the side (shoulder height) while drinking
  const up = Math.min(1, Math.max(0, (s - 0.65) / 0.35)), ue = up * up * (3 - 2 * up);   // elbow lifts only near the mouth
  const elbowDir = [0.35 + 0.65 * ue, 1 - 0.75 * ue];
  k.chibi(500, 930, { ...who, reach: { right: wrist, rightElbowDir: elbowDir }, expression: s > 0.9 ? 'closed' : 'neutral' });  // eyes close while sipping
  k.scope('glass', () => {
    k.poly(G.outline, { fill: 'paperwhite', weight: 'outline' });
    const w = k.liquid(G.outline, { tilt: 0, fill: FILL });                  // level water, lowest end of the glass
    if (w) {
      k.poly(w.poly, { fill: 'celadon', ink: false });
      if (w.surface) k.line(w.surface[0][0], w.surface[0][1], w.surface[1][0], w.surface[1][1], { weight: 'detail' });
    }
    // the end you can see: the open rim while upright-ish, the base once it faces you
    if (G.baseFacing) k.ellipse(G.B[0], G.B[1], G.rb, G.rb * G.squash, { weight: 'detail' });
    else k.ellipse(G.R[0], G.R[1], G.rr, G.rr * G.squash, { weight: 'detail' });
  });
  k.grip(grip[0], grip[1], { size: gs, across: gw * 0.95, angle: 0, side: 'right', weight: 'outline' });
}; }
