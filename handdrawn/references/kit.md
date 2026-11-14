# kit reference

A scene is an ES module:

```js
export const sheet = { width: 1000, height: 1000, seed: 3 }; // all optional
export function draw(k, t = 0) { /* t ∈ [0,1) only matters when animating */ }
```

Units are sheet units (default 1000 × 1000), x right, y down. Calls draw back to front.
Every drawing call returns its **shape** (`{ pts, closed, bbox }`), so you can reuse it (e.g. `k.hatch(shape)`).

## Common options (`o`) for drawing calls

| option | meaning |
|---|---|
| `fill` | wash colour: a palette name (`'red'`, `'sky'`…) or any hex (softened automatically). Omit for outline only |
| `shade` | `true` or a number 0.1–0.4: a darker wash on the side away from the light (bottom-right). Bigger = wider |
| `hatch` | `true` or `{ spacing: 7, angle: -45, region: 'shade' \| 'all', amount }`: ink hatching on the shaded side |
| `ink` | `false` = no outline; or an ink colour name (`'charcoal'`, `'white'`, `'navy'`) |
| `weight` | `'bold'` 3.2 · `'outline'` 2.3 (default) · `'detail'` 1.6 · `'fine'` 1.1 · `'hatch'` 0.9 · or px |
| `closed` | (spline only) close the curve into a fillable shape |

## Primitives

| call | what it does |
|---|---|
| `k.line(x1, y1, x2, y2, o)` / `k.line([[x,y],…], o)` | hand-drawn ink line or polyline (corners round off a little) |
| `k.spline([[x,y],…], o)` | smooth curve through the points; `{ closed: true }` to fill. A point `[x, y, 'c']` is a sharp corner |
| `k.poly([[x,y],…], o)` | closed polygon with straight sides |
| `k.rect(x, y, w, h, o)` | rectangle, top-left corner + size |
| `k.roundRect(x, y, w, h, r, o)` | rectangle with rounded corners |
| `k.ellipse(cx, cy, rx, ry, o)` / `k.circle(cx, cy, r, o)` | ellipse / circle |
| `k.blob(cx, cy, r, o)` | soft round shape; `{ squash: 0.8, bumps: 8, bump: 0.12, irregular: 0.05, rx, ry }` (bumps = cloud/foliage edge) |
| `k.arc(cx, cy, rx, ry, a0, a1, o)` | open arc, degrees, 0 = right, 90 = down. Eyes, smiles, rims, scallops |
| `k.tube([[x,y],…], width \| [w0, w1], o)` | a band along a smooth centreline: handles, stems, tails, arms, branches, straws. `{ cap: 'flat' }` |
| `k.dot(x, y, r, o)` | small solid ink dot (eyes, seeds); `{ fill }` for a coloured dot |
| `k.turned(profile, o)` | symmetric silhouette from a half-profile `[[halfWidth, y], …]` top→bottom. `{ cx, y, fill, shade, hatch, rim: true, inside, rimRatio }`. Returns `{ shape, rim:{cx,y,rx,ry}, base, widest, top, bottom, halfWidthAt(y) }` |
| `k.shadow(cx, cy, rx, ry, o)` | soft flat ground shadow + a few ground flicks; `{ lines: 0–4, opacity }` |
| `k.fill(shape, color, o)` | wash only (no ink) |
| `k.ink(shape, o)` | ink outline only |
| `k.shade(shape, color, o)` | darker wash on the shaded side only |
| `k.hatch(shape, o)` | hatching only |
| `k.draw(shape, o)` | wash + shade + hatch + ink for a shape from `k.geo` |
| `k.geo.*` | the same shapes **without drawing**: `poly, path, spline(pts, closed), ellipse, circle, rect, roundRect, blob, arc, tube` |

## Text (hand-drawn stroke font: Latin + full Vietnamese)

| call | what it does |
|---|---|
| `k.text(str, x, y, o)` | text, baseline at y. `{ size: 22, align: 'left'\|'center'\|'right', tracking: 0.7, ink, weight }`; `\n` for lines. Returns its box |
| `k.textWidth(str, size)` | width in sheet units |
| `k.title(str, { sub, x: 60, y: 96, size: 50 })` | title top-left with an optional subtitle |
| `k.label(str, { x, y, to: [x, y], align, size: 21, bend: 0.1 })` | margin note with a curved leader line ending in a dot at `to` |

Vietnamese works as typed (`'phở bò'`, `'Đà Lạt'`, `'ở ấ ự'`): tone marks and â ă ê ô ơ ư đ are composed.

## Structure

| call | what it does |
|---|---|
| `k.group({ x, y, scale, sx, sy, rotate, flipX }, () => …)` | draw in local coordinates. Line weights do **not** scale (ink stays consistent) |
| `k.scope('name', () => …)` | give a part its own random stream so edits elsewhere don't re-roll its wobble |
| `k.toSheet(x, y)` | local → sheet coordinates (for label targets inside groups) |
| `k.rand(a, b)`, `k.pick(arr)` | seeded randomness that stays the same when only `--seed` changes |
| `k.W`, `k.H`, `k.cx`, `k.cy`, `k.t` | sheet size, centre, animation time |
| `k.soften(c)`, `k.darker(c, 0.075)`, `k.lighter(c, 0.06)`, `k.palette` | colour helpers |

## Pieces (placed by ground line or top-left; all return anchor points)

| call | what it does |
|---|---|
| `k.leaf(x, y, { len: 60, angle: -45, width: 0.42, fill, vein })` | one leaf from its stem point; angle 0 = pointing right, −90 = up |
| `k.shrub(x, groundY, { r: 90, fill, bumps, flowers, flowerFill })` | round bush sitting on the ground |
| `k.tree(x, groundY, { h: 400, fill, trunk, fruit, fruitFill })` | cloud-crown tree. Returns `{ top, crown }` |
| `k.cat(x, groundY, { size: 300, pose: 'sit'\|'sleep', fill, eyes: 'open'\|'closed', facing: 'left', bib, stripes, shadow, animate, t })` | cute round cat. sit = front view (size = height), sleep = curled side view (size = length). Returns `{ head, top, tail }` |
| `k.person(x, groundY, { h: 400, skin, shirt, pants, hair, shoes, bun, wave, shadow })` | front-view person, big head. `wave: true` raises the right arm; with `t` the forearm swings side to side from the elbow. `shadow: false` drops the ground shadow. Returns `{ head, top, hand, feet }` |
| `k.window(x, y, w, h, { panes: [2,2], frame, glass, arch, curtains, sill, flowers })` | window with frame, glazing bars, glint, sill |
| `k.door(x, y, w, h, { fill, arch, glass, panels, knob, step })` | front door |
| `k.house(x, groundY, { w: 460, h: 300, roof, wall, door, chimney, curtains, flowers, atticWindow })` | house front with roof tiles, door, two windows, chimney. Returns anchors |
| `k.steam(x, y, { n: 3, h: 120, spread: 26, t })` | rising wisps (animate with `t`) |
| `k.grass(x0, x1, y, { n, size })` | grass tufts along a ground line |

## Palette names

`ink paper red brick coral orange ochre yellow cream sage green leaf olive teal mint sky blue navy lilac plum pink blush sand wood brown chocolate grey stone charcoal white shadow skin tan`

## Renderer

```
node assets/render.mjs scene.js -o out.svg --png out.png --thumb      # animated SVG + PNG still (frame 0) + 128px thumbnail
  --seed N          different wobble, same composition
  --size 1600       output pixel width (drawing stays in sheet units)
  --transparent     no paper background
  --grid            coordinate grid overlay for checking positions (never deliver with it)
  --gif out.gif     animated GIF: --frames 8 --fps 10 --boil 2 --gif-size 560
  --still           out.svg is a single frame (by default it is a looping animated SVG: CSS, no script)
```
