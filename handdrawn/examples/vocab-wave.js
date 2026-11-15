// Action word: 挥手 huīshǒu (Hán Việt: HUY THỦ), vẫy tay. A Q版 person waves: the open hand (five fingers, palm
// out) swings twice, eases back upright and rests, then the loop repeats. Each swing uses the 'smooth' spring.
// Just the person: no background, no props.
export const sheet = { seed: 3, duration: 2.6 };
export const vocab = { hanzi: '挥手', pinyin: 'huīshǒu', hanviet: 'huy thủ', meaning: 'vẫy tay', kind: 'action' };

export function draw(k, t = 0) {
  const a = k.motion(t, [[26, 1, 'smooth'], [-20, 1.1, 'smooth'], [26, 1.1, 'smooth'], [-20, 1.1, 'smooth'], [0, 1, 'smooth'], [0, 1.6]]);
  k.chibi(480, 930, { h: 820, hairStyle: 'bob', shirt: 'gamboge', pants: 'azurite', wave: a, expression: 'happy' });
}
