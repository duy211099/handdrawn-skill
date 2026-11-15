// A small house with a tree. Smoke curls from the chimney; the tree's crown sways after the breeze on a spring.
// part      call                      where (z up)                                   colour
// ground    box                       300 × 220, 8 thick                              green
// walls     box                       140 × 110 × 90, centre of the plot             white
// roof      extrude (axis y)          gable over the walls, a little overhang        red
// chimney   box                       on the right roof slope                         brick
// door      panel (on: walls)         front face, centre                              celadon
// windows   panel (on: walls)         front face either side; one on the side        blue
// path      panel (on: ground)        from the door to the front edge                 yellow
// tree      cylinder + sphere         left of the house; the crown sways              brown, green
export const sheet = { seed: 3, frames: 24, fps: 12 };

export function draw(k, t = 0) {
  const ground = k.box([0, 0, 0], [320, 240, 8], { fill: 'green', round: 20 });
  const G = 8, W = 140, D = 110, Hh = 90;
  const walls = k.box([10, 10, G], [W, D, Hh], { fill: 'white' });
  // roof: a gable profile extruded front to back (outline = [x, −z] for axis 'y'), slightly wider and deeper than the walls
  const ov = 10, ridge = 62;
  k.extrude([10, 10 - D / 2 - ov, 0], [[-W / 2 - ov, -(G + Hh - 4)], [W / 2 + ov, -(G + Hh - 4)], [0, -(G + Hh + ridge)]], D + ov * 2, { axis: 'y', fill: 'red' });
  k.box([46, 30, G + Hh + 12], [20, 20, 52], { fill: 'brick' });
  k.steam([46, 30, G + Hh + 70], { n: 2, h: 80, spread: 16 });
  // front face (y = 10 − D/2): door and windows as decals
  const fy = 10 - D / 2 - 0.3;
  k.panel([[0, fy, G], [24, fy, G], [24, fy, G + 50], [0, fy, G + 50]], { on: walls, fill: 'celadon' });
  for (const x of [-46, 48]) k.panel([[x - 14, fy, G + 40], [x + 14, fy, G + 40], [x + 14, fy, G + 68], [x - 14, fy, G + 68]], { on: walls, fill: 'blue' });
  const sx = 10 + W / 2 + 0.3;                                                     // a window on the right side
  k.panel([[sx, 10 - 14, G + 40], [sx, 10 + 14, G + 40], [sx, 10 + 14, G + 68], [sx, 10 - 14, G + 68]], { on: walls, fill: 'blue' });
  k.panel([[2, fy - 1, G + 0.4], [22, fy - 1, G + 0.4], [30, -120, G + 0.4], [-6, -120, G + 0.4]], { on: ground, fill: 'yellow' });
  // tree: the crown follows the breeze on a spring, pivoting at the trunk's base
  const sway = k.follow(t, (u) => 6 * Math.max(0, Math.sin(2 * Math.PI * u)), { key: 'house-tree', f: 1.2, z: 0.3 });
  k.group({ about: [-112, -40, G], rotate: { y: -sway } }, () => {
    k.cylinder([-112, -40, G], 10, 96, { fill: 'brown', r2: 7 });
    k.sphere([-112, -40, G + 132], 42, { fill: 'green' });
  });
}
