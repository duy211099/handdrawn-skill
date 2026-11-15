// Concrete word: 猫 māo (Hán Việt: MIÊU), con mèo. One cat sitting, front view: the clearest cat silhouette.
export const sheet = { seed: 3 };
export const vocab = { hanzi: '猫', pinyin: 'māo', hanviet: 'miêu', meaning: 'con mèo', kind: 'concrete' };

export function draw(k) {
  k.shadow(500, 830, 230, 28);
  k.cat(500, 830, { size: 600, pose: 'sit', fill: 'ochre', stripes: true });
}
