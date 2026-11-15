// Abstract word: 纪律 jìlǜ (Hán Việt: KỶ LUẬT), kỷ luật / nề nếp. Metaphor: on time, every time. The alarm clock
// rings at 6:00 and the Q版 kid is already up, doing morning stretches: arms out and up in a wide V, then down, twice. The clock
// shakes while it rings (the bells are the cause), the kid keeps the beat.
export const sheet = { seed: 4, duration: 3.2 };
export const vocab = { hanzi: '纪律', pinyin: 'jìlǜ', hanviet: 'kỷ luật', meaning: 'kỷ luật, nề nếp', kind: 'abstract' };

export function draw(k, t = 0) {
  // the kid: arms up and down twice per loop (beats, Apple-style spring)
  const up = k.motion(t, [[0, 0.5], [1, 0.7, 'smooth'], [1, 0.35], [0, 0.7, 'smooth'], [1, 0.7, 'smooth'], [1, 0.35], [0, 0.7, 'smooth']]);
  const who = { h: 560, hairStyle: 'short', shirt: 'persimmon', pants: 'azurite', expression: 'happy' };
  const L = k.chibiLayout(360, 900, who), a = L.armLength;
  // Q版 arms are shorter than the head is tall: the stretch is a wide V (out and up), not overhead
  const target = (sh, sd) => [sh[0] + sd * a * (0.25 + 0.75 * up), sh[1] + a * (0.85 - 1.55 * up)];
  const P = k.chibi(360, 900, { ...who, reach: { right: target(L.shoulderR, 1), left: target(L.shoulderL, -1) } });
  for (const w of [P.wristR, P.wristL]) k.circle(w[0], w[1], L.armWidth * 0.62, { fill: 'skin', weight: 'bold' });

  // the alarm clock at 6:00, ringing: it shakes on its feet while the bells ring, then rests
  const ring = Math.max(0, Math.sin(Math.PI * Math.min(1, t / 0.45)));
  const shake = 7 * ring * Math.sin(2 * Math.PI * 14 * t);
  const cx = 730, cy = 790, R = 82;
  k.shadow(cx, 900, 110, 12);
  k.group({ x: cx, y: 900, rotate: shake }, () => {
    for (const sd of [-1, 1]) k.line([[sd * R * 0.45, -R * 0.4], [sd * R * 0.7, 0]], { weight: 'bold' });   // feet
    for (const sd of [-1, 1]) k.circle(sd * R * 0.55, -110 - R * 0.95, R * 0.32, { fill: 'gamboge' });     // bells
    k.line([[0, -110 - R * 1.02], [0, -110 - R * 1.2]], { weight: 'bold' });                               // hammer
    k.circle(0, -110, R, { fill: 'cinnabar' });
    k.circle(0, -110, R * 0.78, { fill: 'paperwhite' });
    for (let i = 0; i < 12; i++) { const q = (i / 12) * 2 * Math.PI; k.dot(Math.sin(q) * R * 0.64, -110 - Math.cos(q) * R * 0.64, i % 3 ? 2.5 : 4.5); }
    k.line([[0, -110], [0, -110 - R * 0.6]], { weight: 'bold' });                                          // minute hand: 12
    k.line([[0, -110], [0, -110 + R * 0.42]], { weight: 'bold' });                                         // hour hand: 6
    k.dot(0, -110, 6);
  });
  // ring marks while it rings
  if (ring > 0.25) for (const sd of [-1, 1]) {
    k.arc(cx + sd * 125, cy - 120, 26, 26, sd > 0 ? -60 : 120, sd > 0 ? 20 : 200, { weight: 'detail' });
    k.arc(cx + sd * 150, cy - 130, 42, 42, sd > 0 ? -55 : 125, sd > 0 ? 15 : 195, { weight: 'detail' });
  }
}
