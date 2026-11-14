// A teapot on a trivet, the lid rattles as it boils.
// parts     call                 notes
// trivet    cylinder             the teapot stands on it, so its shadow falls on the trivet
// body      lathe { smooth }     profile [radius, height] from the bottom up
// spout     tube [r0, r1]        starts inside the body: it is cut at the surface automatically
// handle    tube                 both ends inside the body
// lid+knob  group { about, rotate, at }   hinged at its back edge, hops twice per loop
export const sheet = { seed: 3 };
export function draw(k, t = 0) {
  k.title('the kettle is singing', { sub: 'ấm trà đang sôi' });
  k.cylinder([0, 0, 0], 120, 10, { fill: 'wood' });                                   // trivet
  k.group({ rotate: { z: 45 } }, () => {                                               // spout to the left, handle to the right
  const body = k.lathe([0, 0, 10], [[55, 0], [78, 10], [94, 45], [90, 85], [68, 112], [50, 118]], { fill: 'teal', smooth: true });
  k.tube([[-78, 0, 50], [-112, 0, 66], [-128, 0, 100], [-146, 0, 118]], [14, 7], { fill: 'teal' });   // spout
  k.tube([[70, 0, 112], [112, 0, 108], [122, 0, 72], [84, 0, 40]], 8, { fill: 'teal' });            // handle
  // the lid hops and tips about its back edge, twice per loop
  const hop = Math.max(0, k.wave(0, 2 * t));                                        // 0..1, two hops per loop
  k.group({ about: [44, 0, 128], rotate: { y: -18 * hop }, at: [0, 0, 16 * hop] }, () => {
    k.lathe([0, 0, 127], [[52, 0], [50, 5], [30, 13], [8, 18], [0, 19]], { fill: 'teal', smooth: true });
    k.sphere([0, 0, 152], 10, { fill: 'ochre' });
  });
  k.steam([-150, 0, 125], { h: 90, n: 2, spread: 18 });
  });
  k.label('rattling lid', { to: [-20, 0, 140], side: 'right', dy: -60 });
}
