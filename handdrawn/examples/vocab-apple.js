// Concrete word: 苹果 píngguǒ (Hán Việt: BÌNH QUẢ), quả táo. The picture is an ordinary scene with no text:
// the renderer adds the word card for the learn face and leaves it off for the recall face. Concrete words
// render as stills: the apple doesn't need to move to be an apple.
export { draw } from './apple.js';
export const sheet = { seed: 2 };   // the default look (apple.js itself is a classic-look example)

export const vocab = { hanzi: '苹果', pinyin: 'píngguǒ', hanviet: 'bình quả', meaning: 'quả táo', kind: 'concrete' };
