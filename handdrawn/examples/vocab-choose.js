// Abstract word: 选择 xuǎnzé (Hán Việt: TUYỂN TRẠCH), lựa chọn. Metaphor: a fork in the road (see the metaphor table
// in SKILL.md). A Q版 person stands where one path becomes two, hand on chin, a signpost points both ways (no text).
// Animation: paper stop-motion with rigid cut-outs. The paths slide up, the signpost drops in (heavy: barely bounces),
// each arrow slides in from its side tilted and settles flat (overlapping the one before), then the person drops in
// light and tilted, rocks flat, and the landing jolts the signpost (the contact beat). The finished picture holds.
export const sheet = { seed: 4, duration: 4, fps: 12, poster: 0.99 };
export const vocab = { hanzi: '选择', pinyin: 'xuǎnzé', hanviet: 'tuyển trạch', meaning: 'lựa chọn', kind: 'abstract' };

export function draw(k, t = 0) {
  // two paths: one band from the bottom that splits into a left and a right branch
  k.pop(t, 0.02, () => {
    k.spline([[380, 1000, 'c'], [430, 720], [300, 520], [150, 420, 'c'], [250, 400, 'c'], [420, 500], [500, 600], [580, 500], [750, 400, 'c'], [850, 420, 'c'], [700, 520], [570, 720], [620, 1000, 'c']], { closed: true, fill: 'gamboge' });
  }, { from: 'bottom', dur: 0.14, weight: 'heavy' });
  // signpost at the fork, arrows pointing to each branch. The person's landing (0.42 + a third of its drop) jolts it.
  k.react(t, 0.485, () => {
    k.drop(t, 0.14, () => k.tube([[500, 600], [500, 330]], 22, { fill: 'ochre', cap: 'flat' }),
      { x: 500, groundY: 600, height: 380, weight: 'heavy', dur: 0.12 });
    k.pop(t, 0.24, () => k.poly([[500, 345], [360, 345], [320, 380], [360, 415], [500, 415]], { fill: 'azurite' }),
      { from: 'left', tilt: -14, pivot: [500, 380], distance: 520 });
    k.pop(t, 0.31, () => k.poly([[500, 425], [640, 425], [680, 460], [640, 495], [500, 495]], { fill: 'azurite' }),
      { from: 'right', tilt: 14, pivot: [500, 460], distance: 520 });
  }, { pivot: [500, 600], amount: 3, dur: 0.1 });
  // the person, thinking: left hand to the chin. Falls in light and tilted, shadow stays on the ground.
  k.drop(t, 0.42, () => {
    const o = { h: 360, hairStyle: 'bob', shirt: 'celadon', pants: 'azurite', expression: 'neutral', shadow: false };
    const L = k.chibiLayout(500, 985, o);
    k.chibi(500, 985, { ...o, reach: { left: [L.mouth[0] - 18, L.mouth[1] + 40] } });
  }, { x: 500, groundY: 985, weight: 'light', tilt: 8, shadow: [110, 12], dur: 0.2 });
}
