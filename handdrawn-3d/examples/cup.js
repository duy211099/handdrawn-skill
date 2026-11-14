// A mug of coffee on a saucer; steam rises. The smallest example.
// parts         call          where (world units, z up)        colour
// saucer        cylinder      r 120, 8 high                     sky
// mug           lathe + wall  r 62→74, 0..110 above the saucer  red
// coffee        cylinder      inside the mug, top at z 100      chocolate
// handle        tube          on the mug's right (+x after the turn), cut at the mug
// steam         steam         above the coffee
export const sheet = { seed: 4 };

export function draw(k, t = 0) {
  k.title('a morning cup', { sub: 'cà phê sữa, still too hot' });
  k.cylinder([0, 0, 0], 120, 8, { fill: 'sky' });
  k.group({ rotate: { z: 45 } }, () => {                    // turn so the handle points to screen-right
    const mug = k.lathe([0, 0, 8], [[60, 0], [64, 6], [70, 60], [74, 110]], { fill: 'red', wall: 5 });
    k.cylinder([0, 0, 18], 69, 82, { fill: 'chocolate', in: mug, shadow: false });   // coffee, drawn inside the mug
    k.tube([[60, 0, 98], [104, 0, 96], [112, 0, 58], [66, 0, 38]], 9, { fill: 'red' });
  });
  k.steam([0, 0, 130], { n: 3, h: 110, spread: 26 });
}
