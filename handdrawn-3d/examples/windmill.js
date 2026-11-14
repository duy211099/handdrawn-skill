// A windmill on a grassy mound; the sails turn (a quarter turn per loop, so it loops seamlessly).
// parts        call                   notes
// mound        lathe                  wide low dome
// tower        cylinder { r2 }        tapered, white
// cap          lathe                  dome on top
// sails        panel { thick } x4     in a group rotated about the hub's axis (y)
// door         panel { on: tower }    on the front (-y)
export const sheet = { seed: 5, camera: { yaw: 30, pitch: 22 } };

export function draw(k, t = 0) {
  k.lathe([0, 0, 0], [[260, 0], [230, 18], [150, 34], [0, 40]], { fill: 'leaf', smooth: true, shadow: false });
  const tower = k.cylinder([0, 0, 38], 70, 220, { r2: 46, fill: 'white' });
  k.lathe([0, 0, 258], [[54, 0], [50, 22], [32, 44], [0, 56]], { fill: 'brick', smooth: true });
  k.panel([[-18, -66, 40], [18, -66, 40], [18, -61, 95], [0, -60, 108], [-18, -61, 95]], { on: tower, fill: 'brown' });
  const hub = [0, -62, 270];
  k.cylinder(hub, 13, 22, { axis: '-y', fill: 'charcoal' });
  k.group({ about: hub, rotate: { y: 90 * t } }, () => {          // quarter turn per loop: 4 identical sails
    for (let i = 0; i < 4; i++) k.group({ about: hub, rotate: { y: 90 * i + 20 } }, () => {
      k.panel([[0, -70, 285], [26, -70, 290], [30, -70, 440], [8, -70, 440]], { thick: 3, fill: 'cream' });
      k.line([[4, -73.5, 300], [10, -73.5, 438]], { weight: 'fine' });
    });
  });
}
