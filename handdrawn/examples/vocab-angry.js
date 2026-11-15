// Feeling word: 生气 shēngqì (Hán Việt: SINH KHÍ), tức giận. A Q版 face is mostly an emotion display, so feeling
// adjectives (开心 happy, 生气 angry, 累 tired, 害怕 scared, 难过 sad, 吃惊 surprised) are a person with that
// expression and nothing else. Concrete: a still, the face carries it.
export const sheet = { seed: 3 };
export const vocab = { hanzi: '生气', pinyin: 'shēngqì', hanviet: 'sinh khí', meaning: 'tức giận',
  note: '! sinh khí ở đây không phải sức sống', kind: 'concrete' };

export function draw(k) {
  k.chibi(500, 930, { h: 820, hairStyle: 'buns', shirt: 'celadon', pants: 'azurite', expression: 'angry' });
}
