// Abstract word: 选择 xuǎnzé (Hán Việt: TUYỂN TRẠCH), lựa chọn. Metaphor: a fork in the road (see the metaphor table
// in SKILL.md). A Q版 person stands where one path becomes two, hand on chin, a signpost points both ways (no text).
// Animation: paper stop-motion reveal (k.pop). The paths slide up, the signpost and its two arrows pop in, the
// person pops in last, then the finished picture holds. 12 fps for a tactile, hand-made feel.
export const sheet = { seed: 4, duration: 4, fps: 12, poster: 0.99 };
export const vocab = { hanzi: '选择', pinyin: 'xuǎnzé', hanviet: 'tuyển trạch', meaning: 'lựa chọn', kind: 'abstract' };

export function draw(k, t = 0) {
  // two paths: one band from the bottom that splits into a left and a right branch
  k.pop(t, 0.02, () => {
    k.spline([[380, 1000, 'c'], [430, 720], [300, 520], [150, 420, 'c'], [250, 400, 'c'], [420, 500], [500, 600], [580, 500], [750, 400, 'c'], [850, 420, 'c'], [700, 520], [570, 720], [620, 1000, 'c']], { closed: true, fill: 'gamboge' });
  }, { from: 'bottom', dur: 0.14, ease: 'smooth' });
  // signpost at the fork, arrows pointing to each branch
  k.pop(t, 0.18, () => k.tube([[500, 600], [500, 330]], 22, { fill: 'ochre', cap: 'flat' }), { pivot: [500, 600] });
  k.pop(t, 0.28, () => k.poly([[500, 345], [360, 345], [320, 380], [360, 415], [500, 415]], { fill: 'azurite' }), { pivot: [500, 380] });
  k.pop(t, 0.34, () => k.poly([[500, 425], [640, 425], [680, 460], [640, 495], [500, 495]], { fill: 'azurite' }), { pivot: [500, 460] });
  // the person, thinking: left hand to the chin
  k.pop(t, 0.44, () => {
    const o = { h: 360, hairStyle: 'bob', shirt: 'celadon', pants: 'azurite', expression: 'neutral' };
    const L = k.chibiLayout(500, 985, o);
    k.chibi(500, 985, { ...o, reach: { left: [L.mouth[0] - 18, L.mouth[1] + 40] } });
  }, { pivot: [500, 985] });
}
