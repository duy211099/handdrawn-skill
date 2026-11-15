// A ginger cat sitting on a cushion, front view. Animated: tail sways, eyes blink.
export const sheet = { theme: 'classic', seed: 5 };

export function draw(k, t = 0) {
  // cushion
  k.shadow(500, 870, 330, 30, { lines: 3 });
  k.blob(500, 820, 300, { squash: 0.17, fill: 'teal', shade: 0.35 });
  k.line([[260, 812], [500, 826], [740, 812]], { weight: 'fine' });

  const cat = k.cat(490, 840, { size: 640, pose: 'sit', fill: 'orange', animate: true, t, shadow: false });
  k.label('mochi, 4 years old', { x: 640, y: 210, to: [cat.top[0] + 115, cat.top[1] + 20] });
}
