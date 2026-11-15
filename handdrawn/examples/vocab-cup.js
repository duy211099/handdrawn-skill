// Concrete word: 杯子 bēizi (Hán Việt: BÔI TỬ), cái cốc / cái ly. A plain cup with a handle, side view, clearly
// TALLER than wide so it can't be read as a bowl (碗). Nothing in it: a drink inside would cue 茶 or 咖啡 instead.
export const sheet = { seed: 6 };
export const vocab = { hanzi: '杯子', pinyin: 'bēizi', hanviet: 'bôi tử', meaning: 'cái cốc, cái ly', kind: 'concrete' };

export function draw(k) {
  k.shadow(480, 830, 230, 30);
  k.tube([[600, 400], [700, 395], [725, 520], [690, 640], [600, 660]], 40, { fill: 'celadon' });   // handle, behind
  const c = k.turned([[170, 0], [168, 200], [150, 380], [140, 400]], { cx: 470, y: 430, fill: 'celadon', rim: true, inside: 'celadon', rimRatio: 0.16 });
  k.highlight(370, 560, 26, 70, { angle: 8 });
  return c;
}
