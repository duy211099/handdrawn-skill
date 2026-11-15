# kit reference

A scene is an ES module:

```js
export const sheet = { seed: 3, camera: { yaw: 45, pitch: 35.26 } }; // all optional
export function draw(k, t = 0) { /* t ∈ [0, 1): one loop of the animation */ }
```

`draw` runs once per frame (16 frames by default). Build the whole scene every time; move things with `t`.

## World, camera, framing

- **World axes:** `x` right, `y` back (away from the viewer at yaw 0), `z` up. The ground is `z = 0`.
  Units are free. Model at roughly 1 unit = 1 mm (a mug is ~80 × 100). The picture is **framed automatically**:
  `render.mjs` measures every frame first, so a part that moves doesn't make the framing jump.
- **Camera:** orthographic. `sheet.camera = { yaw, pitch }` in degrees. The default is classic isometric
  (yaw 45, pitch 35.26): you see the front (−y), the right side (+x) and the top. `yaw: 0` = straight from the
  front, `yaw: 90` = from the right. `pitch: 0` = eye level, `90` = from straight above. Lower pitch (20–25)
  feels more like a product shot. `k.camera({...})` inside `draw` does the same.
- **Light:** fixed relative to the viewer, from the upper left. At the default view the **top is light, the
  front is mid and the right side is dark**. Shadows fall to the right.
- `sheet.zoom` (default 1) scales the framed drawing. `sheet.margin = { left, right, top, bottom }` (fractions of the
  sheet) overrides the margins. Room is made automatically for a title and margin labels.

## Solids

Every solid is a closed mesh of flat faces. Each face gets one of three flat tones from its fill colour (light,
mid, dark). Neighbouring faces with the same tone merge into one marker wash. The silhouette is inked heavy and
sharp creases lighter. Every call returns a **handle** `{ box: {min, max}, top, bottom, center }` to use with
`on:` / `in:`.

| call | what it makes |
|---|---|
| `k.box(at, [w, d, h], o)` | box; `at` = centre of the **bottom** face. `{ round: r }` rounds the vertical edges (appliances, phones, bread) |
| `k.cylinder(at, r, h, o)` | cylinder from its base centre. `{ r2 }` = top radius (cone, frustum, tapered tower), `{ axis: 'x'\|'y'\|'-x'\|'-y'\|'z' }` lays it down (wheels, knobs, hubs, logs) |
| `k.lathe(at, profile, o)` | surface of revolution: `profile = [[radius, height], …]` **from the bottom up** (vases, pots, bottles, bowls, domes, lamp shades, mounds). `{ smooth: true }` rounds the profile; `{ wall: 5 }` makes a **container** with walls of that thickness and an inside (cups, bowls, buckets, pots); `{ floor }` its floor thickness; `{ top: false }` leaves the top open as a thin shell; `{ axis }` like cylinder |
| `k.sphere(at, r, o)` | sphere at its centre. `{ scale: [sx, sy, sz] }` for an ellipsoid (heads, eggs, fruit, buns) |
| `k.extrude(at, outline, h, o)` | prism from any 2D outline `[[u, v], …]` (even concave), `h` along `axis` (default `'z'`: the outline lies on the ground plane). Use `axis: 'y'` to extrude a side profile front-to-back (a car body, a toaster, a house with its gable) |
| `k.tube(points, r, o)` | round tube along a smooth 3D path: handles, spouts, pipes, cables, stems, legs, arms, straws. `r` or `[r0, r1]` to taper. **Where the path runs inside a solid drawn earlier it is cut at the surface**, so start a handle or spout inside the body and the joint comes out clean (`cut: false` turns this off). `{ straight: true }` keeps corners |
| `k.panel(points, o)` | flat polygon through 3D points: a sign, a sail, a page, a blade. `{ thick: 3 }` gives it thickness. `{ on: handle }` makes it a **decal** on that solid's face (a door, a slot, a label, a window): drawn with the solid, hidden when that face turns away |
| `k.line(points, o)` | an ink line through 3D points: seams, grooves, a lid gap, a crack, planks. `{ on: handle, normal: [x, y, z] }` draws it with that solid and hides it when the normal faces away. `{ smooth: true }`, `{ closed: true }`, `{ weight }` |
| `k.chibi(at, { turn, h: 210, headTilt, expression, shirt, pants, shoes, hair, skin, reach, rightPole, leftPole })` | the **Q版 person** (same character as the 2D `k.chibi`): big head, bean body, stubby limbs, eyes and blush painted on the face. Faces −y before `turn` (degrees about z). `headTilt` + = looks up (about the neck). `expression: 'neutral'\|'closed'\|'happy'`. `reach: { right: [x, y, z], left }` puts that hand there by a two-bone IK in 3D with a pole (`rightPole` default out and down: never flips); otherwise the arm hangs. Returns `{ mouth, head, headR, neck, shoulderR, shoulderL, handR, handL, elbowR, elbowL, unit }` |
| `k.chibiLayout(at, o)` | the same anchors **without drawing** (to place a glass at the mouth before drawing the person who holds it) |
| `k.mesh(V, F, o)` | any closed mesh: `V` = `[[x, y, z], …]`, `F` = faces as index lists sharing vertices. For shapes the primitives can't make, e.g. water in a tipped glass cut by its level surface (`in: glass`; see `examples/drink.js`) |
| `k.shapes.*` | 2D outlines for `extrude`: `rect(w, h)`, `roundRect(w, h, r)`, `circle(r, n)`, `ellipse(rx, ry, n)`, `spline([[u, v], …])` (closed, smooth) |

### Options for solids

| option | meaning |
|---|---|
| `fill` | colour: a palette name (below) or any hex (softened automatically). The three tones come from it |
| `inside` | colour of a container's inside (default: the fill, darker) |
| `hatch` | `true` or `{ spacing: 8, angle: -45 }`: ink hatching on the dark side. One or two big solids at most |
| `flat: true` | one tone only (no light/dark sides): stickers, signs, things that should read as flat colour |
| `light`, `dark` | how much lighter / darker the light and dark tones are (default 0.05 / 0.1) |
| `ink` | `false` = no outline. `inkColor: 'white'` etc. for a different ink |
| `weight` | silhouette weight (`'bold'` 3.2 · `'outline'` 2.3 · `'detail'` 1.6 · `'fine'` 1.1 · or px). By default it follows the size on screen: big bodies `outline`, small parts `detail` or `fine` |
| `creases: false` | no ink on sharp inner edges (only the silhouette) |
| `crease` | angle in degrees above which an edge counts as sharp (default 32; curved solids use 40–60) |
| `segments` | facets around round solids (default 36–40). Raise for very large round things |
| `shadow` | `false` = casts no shadow. `{ length: 0.4 }` shadow length; `{ z: 120 }` casts onto a plane at that height |
| `on: handle` | stick this to another solid (decals, buttons flush on a face): drawn right after it |
| `in: handle` | **contents** of a container (coffee in a mug, soil in a pot, water in a glass, bread in a slot): drawn after the container's inside and before its outside, so the front wall covers it |
| `layer` | number (default 0): higher layers always draw later. Last resort for a sorting mistake |
| `rotate`, `scale`, `pivot` | rotate/scale this one solid about `pivot` (default its `at`), same forms as `k.group` |
| `name` | a name, for your own reading |

### How solids are ordered (read this)

There is no depth buffer. Solids are sorted against each other by their bounding boxes. When two boxes are
apart along an axis, the one nearer the viewer is drawn later. When they overlap, the one whose centre is
nearer wins. Within a solid, faces are sorted and hidden faces are skipped. So:

- **Keep separate parts as separate solids** (a lid, a knob, each leg). Two solids that **interpenetrate**
  deeply are sorted as wholes, and one of them wins everywhere. Only tubes are cut where they enter a body.
- **Something inside a container goes in with `in:`.** Without it the container's walls hide it, or it hides them.
- **Something coming out of an opening (bread from a toaster, a card from a slot, a plant from soil): model
  only the part above the opening**, a solid whose bottom sits on the opening. Animate its height.
- **Flat things on a face are decals (`panel` / `line` with `on:`)**, not thin boxes floating 0.1 above it.
- A solid **standing on** another (top meets bottom, overlapping footprints) casts its shadow onto it,
  clipped to that solid's top. Everything else casts onto the ground. Give a floating part `shadow: false`
  when its ground shadow would look lost.

## Grouping and motion

| call | what it does |
|---|---|
| `k.group({ at, about, rotate, scale }, () => { … })` | everything made inside is moved: turned by `rotate` around the point `about`, scaled about `about`, then shifted by `at`. Groups nest |
| `rotate` forms | a number = degrees about z (a turn on the table); `{ x, y, z }` degrees about each axis (applied x, then y, then z); `[[ax, ay, az], deg]` about any axis |
| `k.wave(phase = 0, tt = t)` | `sin(2π(t + phase))`: −1..1, loops seamlessly |
| `k.pulse(phase = 0, tt = t)` | `0..1..0` once per loop, smooth |
| `k.smooth(x)` | smoothstep 0..1, for easing; `k.lerp(a, b, u)`, `k.clamp(v, a, b)` |
| `k.t` | this frame's `t` |
| `k.follow(t, u => driver(u), { key, f: 2, z: 0.5, r: 0 })` | secondary motion: the value (number or array) chases the driver like a mass on a spring (`f` Hz, `z` damping: 0.2 rings, 0.5–0.7 alive, 1 none; `r` 0 eases in, <0 anticipates). Simulated over a few loops and cached, so it loops seamlessly. Keyframe the cause, `follow` the effect (a head after a hand, a lid after a jolt, water after its glass) |
| `k.accel(p, u)` | acceleration of a looping path `p(u) → [x, y, z]` in units/s² (drives slosh and swing: "up" for a liquid is gravity minus its container's acceleration) |

Motion patterns:
- **Hinge** (a lid, a door, a laptop screen, a jaw): `k.group({ about: hingePoint, rotate: { y: angle } }, …)`.
- **Spin** (wheels, fans, sails, a record): `rotate` by `360 * t` around the axle, or `90 * t` when there are 4
  identical blades (a quarter turn loops seamlessly and reads the same).
- **Bob / hop / breathe**: `at: [0, 0, 10 * k.pulse()]`, or `scale` around the base.
- **Twice per loop**: `k.wave(0, 2 * t)`. Stay seamless: every motion must end where it started at `t = 1`.
- Keep it to one or two moving things plus steam. The ink "boils" on its own (a new wobble every 2 frames).

## Overlays

| call | what it does |
|---|---|
| `k.steam([x, y, z], { n: 3, h: 120, spread: 26, ink })` | wisps of steam or smoke rising from a 3D point, looping with `t` (h, spread in world units) |
| `k.label(str, { to: [x, y, z], side: 'left'\|'right', dy, size: 21, gap: 70 })` | margin note with a curved leader line ending in a dot on that 3D point. Placed in the side margin automatically and stacked so notes don't collide. Give `{ x, y }` (sheet units) to place it by hand |
| `k.title(str, { sub, x: 60, y: 96, size: 50 })` | title top-left with an optional subtitle |
| `k.text(str, x, y, o)` | text in sheet units, baseline at y. `{ size: 22, align, tracking, ink, weight }`; `\n` for lines |
| `k.at([x, y, z])` | where a 3D point lands on the sheet (useful with `--grid`) |

Text uses a built-in hand-drawn stroke font: Latin and **full Vietnamese** (`'phở bò'`, `'Đà Lạt'`, `'ở ấ ự'`).

## Colour

Themes: `jianbihua` (default, matches the 2D skill: traditional palette, clean ink, transparent) and `classic`
(marker on cream paper). `--theme`, `sheet.theme`, `--rough 0..1`, `--opaque`. In `jianbihua` the names below map
to the traditional colours (`red` → cinnabar, `orange` → persimmon, `green` → malachite, `blue` → azurite …), and
`cinnabar, persimmon, gamboge, malachite, celadon, azurite, ochre, paperwhite, hair` also work.

Palette names: `red, brick, coral, orange, ochre, yellow, cream, sage, green, leaf, olive, teal, mint, sky, blue,
navy, lilac, plum, pink, blush, sand, wood, brown, chocolate, grey, stone, charcoal, white, skin, tan`. Any hex is
pulled toward the marker look. `k.lighter(c, amt)`, `k.darker(c, amt)` for related shades.

## render.mjs

```
node render.mjs scene.js -o out.svg [--png [out.png]] [--thumb [out-128.png]] [--gif out.gif]
                [--frames 16] [--fps 12] [--boil 2] [--at 0] [--still] [--seed N] [--size 1000]
                [--transparent] [--grid] [--gif-size 560] [--theme jianbihua|classic] [--rough 0..1] [--opaque]
```

- `out.svg` is a **looping animated SVG**: frames are switched by CSS, there is no script. It plays in browsers and
  in `<img>` tags. Renderers without CSS animation show frame 0.
- `--png` / `--thumb`: one still, the frame at `--at` (0..1). `--grid` overlays sheet coordinates on the PNG.
- `--gif`: the same animation as a GIF (256 colours, keep it ≤ 600 px wide).
- `--still`: a single-frame SVG (only when the user asks for a still picture).
- `--frames`, `--fps`, `--boil` can also be set in `sheet` (`frames`, `fps`, `boil`).
