export const sheet = { width: 600, height: 300 };
export function draw(k) {
  k.circle(150, 150, 100, { fill: 'red', shade: true });
  k.circle(420, 150, 100, { fill: 'red', ink: false });
  k.shade(k.geo.circle(420, 150, 100), 'navy', { raw: true });
}
