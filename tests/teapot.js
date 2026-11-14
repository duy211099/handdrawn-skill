// teapot, side view. parts: body (turned), lid, knob, spout (tube), handle (tube), shadow
export const sheet = { seed: 1 };
export function draw(k, t = 0) {
  k.shadow(500, 820, 300, 34);
  k.tube([[700, 470], [800, 500], [790, 640], [700, 690]], 34, { fill: 'teal' });           // handle (behind)
  k.tube([[330, 640], [250, 560], [200, 470]], [60, 26], { fill: 'teal', shade: 0.3 });    // spout
  const pot = k.turned([[150, 0], [230, 70], [250, 180], [210, 300], [170, 330]],
                       { cx: 500, y: 480, fill: 'teal', hatch: true });                    // body
  k.ellipse(500, 480, 150, 22, { fill: 'teal', weight: 'detail' });                        // lid
  k.blob(500, 445, 30, { squash: 0.8, fill: 'ochre' });                                   // knob
  k.label('the good teapot', { x: 640, y: 300, to: [560, 440] });
}
