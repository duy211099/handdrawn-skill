// Chinese check sheet: tone colours (1–4 + neutral), numbered pinyin, ü, multi-char words, false-friend note,
// 米字格 grid, Chinese inside an ordinary label.
export const sheet = { width: 1400, height: 900, seed: 2 };

export function draw(k, t = 0) {
  k.title('chinese check', { sub: 'tones · pinyin · hán việt' });
  k.word({ hanzi: '你好', pinyin: 'ni3 hao3', hanviet: 'nễ hảo', meaning: 'xin chào', x: 250, y: 190, size: 130, align: 'center', t });
  k.word({ hanzi: '妈妈', pinyin: 'mā ma', hanviet: 'ma ma', meaning: 'mẹ', x: 700, y: 190, size: 130, align: 'center', t });
  k.word({ hanzi: '走', pinyin: 'zǒu', hanviet: 'tẩu', meaning: 'đi', note: '! tẩu (hán việt) = chạy, nhưng 走 = đi', x: 1130, y: 190, size: 130, align: 'center', grid: 'mi', t });
  k.word({ hanzi: '绿色', pinyin: 'lv4 se4', hanviet: 'lục sắc', meaning: 'màu xanh lá', x: 250, y: 560, size: 110, align: 'center', t });
  k.word({ hanzi: '电话', pinyin: 'diànhuà', hanviet: 'điện thoại', meaning: 'điện thoại', x: 700, y: 560, size: 110, align: 'center', t });
  k.text('label: 我喝茶。wǒ hē chá', 980, 640, { size: 26 });
  k.text('ǖ ǘ ǚ ǜ · ā á ǎ à · ī í ǐ ì', 980, 700, { size: 26 });
}
