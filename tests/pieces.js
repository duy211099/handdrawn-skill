export const sheet = { width: 1200, height: 700 };
export function draw(k) {
  k.person(150, 600, { h: 420 });
  k.person(380, 600, { h: 380, shirt: 'yellow', pants: 'sage', hair: 'charcoal', bun: true, wave: true });
  k.cat(680, 600, { size: 300, pose: 'sleep', fill: 'grey' });
  k.cat(680, 330, { size: 200, fill: 'charcoal', eyes: 'closed', facing: 'left' });
  k.window(880, 120, 140, 200, { arch: true, panes: [2, 3], curtains: 'lilac' });
  k.door(900, 400, 110, 200, { arch: true, fill: 'navy', glass: true });
  k.shrub(1110, 600, { r: 60 });
}
