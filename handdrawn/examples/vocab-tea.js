// Concrete word: 茶 chá (Hán Việt: TRÀ), trà. Tea as people in China actually drink it day to day: green tea
// leaves standing in a glass tumbler with a screw lid. One subject, no table, no teapot set (that would cue 茶具).
export const sheet = { seed: 2 };
export const vocab = { hanzi: '茶', pinyin: 'chá', hanviet: 'trà', meaning: 'trà, chè', kind: 'concrete' };

export function draw(k) {
  k.teaglass(500, 870, { h: 700 });
}
