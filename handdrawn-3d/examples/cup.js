// A mug of coffee on a saucer; steam rises. The smallest example.
// parts         call          where (world units, z up)        colour
// saucer        cylinder      r 120, 8 high                     sky
// mug           lathe + wall  r 62→74, 0..110 above the saucer  red
// coffee        frustum       follows the INSIDE of the mug (outer − wall), floor to z 100   chocolate
// handle        tube          on the mug's right (+x after the turn); both ends start INSIDE THE WALL
//                             (between inner and outer radius), so they're cut at the outer surface and never
//                             poke into the hollow
// steam         steam         above the coffee
export const sheet = { seed: 4 };

export function draw(k, t = 0) {
  k.title('a morning cup', { sub: 'cà phê sữa, still too hot' });
  k.cylinder([0, 0, 0], 120, 8, { fill: 'sky' });
  k.group({ rotate: { z: 45 } }, () => {                    // turn so the handle points to screen-right
    const mug = k.lathe([0, 0, 8], [[60, 0], [64, 6], [70, 60], [74, 110]], { fill: 'red', wall: 5 });
    // coffee: from the floor (z 8 + 5) up to z 100, radius = the mug's inner radius there (58 at the bottom → 67 at the top)
    k.cylinder([0, 0, 13], 57.5, 87, { r2: 67, fill: 'chocolate', in: mug, shadow: false });
    k.tube([[70, 0, 98], [104, 0, 96], [112, 0, 58], [66, 0, 38]], 9, { fill: 'red' });   // ends inside the wall
  });
  k.steam([0, 0, 130], { n: 3, h: 110, spread: 26 });
}
