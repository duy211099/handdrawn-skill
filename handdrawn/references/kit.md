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

Chinese characters (9,574, simplified + traditional) work inside any text call too (`'我喝茶。'`), and pinyin tone
marks (ā á ǎ à, ü ǖ ǘ ǚ ǜ) are composed like Vietnamese ones.

## Chinese (vocab cards for Vietnamese learners)

For a vocab drawing don't call `k.word` in the scene: export `vocab` and let the renderer add the card (SKILL.md, *Vocab mode*). `k.word` is for other sheets that show words.

| call | what it does |
|---|---|
| `k.word({ hanzi, pinyin, hanviet, meaning, note, x, y, size: 150, align, grid: false, boil: false })` | vocab card: **tone-coloured** characters, drawn steady (identical in every frame, no line boil) so they stay easy to read; under each character its pinyin (same tone colour) and Hán-Việt reading (caps); then the Vietnamese meaning and an optional red note. Returns `{ x, y, w, h, boxes, bottom }` |
| `k.hanzi(str, { x, y, size: 160, align, grid: true\|'mi'\|false, ink, inks, order: false, ghost: true, hold: 0.3 })` | just the big characters. `order: true` writes them in stroke order as the animation plays (needs `frames: 48` in `sheet`). x,y = top-left of the first box (`align: 'center'` → x is the centre). `grid: 'mi'` = 米字格 |
| `k.tianzige(x, y, size, { diagonals })` | an empty practice box |
| `k.steady(() => { … })` | draw anything inside identically in every frame (no boil) |

- `pinyin`: marked (`'diàn huà'`, `'diànhuà'`) or numbered (`'dian4 hua4'`, `'lv4'` → lǜ). One syllable per character
  gets per-character colours: tone 1 red, 2 orange, 3 green, 4 blue, neutral grey.
- `hanviet`: one reading per character, space-separated (`'điện thoại'`), so each sits under its character.
- `note`: use it for false friends, where the Hán-Việt meaning differs from Mandarin
  (走 zǒu: hán việt *tẩu* = chạy, but 走 = đi).
- `grid: true` puts each character in a 田字格 box (`'mi'` = 米字格).

## Look (set per render: CLI flag or `sheet` key)

| setting | values | what it does |
|---|---|---|
| `theme` | `classic` (cream paper, mottle) · `jianbihua` (see below) · `sheng` (Shēng design system: flat #f7f6f2, ink #191d24, Pleco tones on pinyin, black hair) | vocab scenes default to `sheng` |
| `theme: 'jianbihua'` | 简笔画: flat fills, brush outline #2B2B2B, 8 traditional colours + skin/grey/hair/blush, rough 0.1, transparent, auto-fit 65% | `--opaque` for the #F6EFE2 paper; `--fit 0.65` |
| `rough` | 0 … 1 (`classic` 1, `sheng` 0.4) | how hand-made the marks look: wobble, pressure, overshoot, open loops, off-register wash, shadow flicks |
| `stroke` | `marker` (default) · `brush` | `brush` = gongbi line: pressed start, thick/thin with direction, long pointed tail. Pair with `rough` ≈ 0.2 |

## Timing

| call | what it does |
|---|---|
| `k.pop(t, at, fn, { from: 'left'\|'right'\|'top'\|'bottom', distance, tilt, pivot, weight, ease, dur: 0.12 })` | paper stop-motion reveal of a rigid cut-out: absent before `at` (share of the loop), then slides in `from` a side (default bottom), arriving turned by `tilt`° about `pivot` and settling flat, then holds. `weight: 'heavy'\|'normal'\|'light'` sets the overshoot. `pivot` without `from` scales up from that point: ink marks only. Set `sheet.poster: 0.99` so stills show the finished picture |
| `k.drop(t, at, fn, { x, groundY, height, weight, tilt, shadow: [rx, ry], dur: 0.16 })` | falls under gravity onto `groundY`, bounces lower each time (heavy barely, light more), rocks on its contact point until flat if `tilt`. The shadow stays on the ground and darkens as it lands; draw the part with `shadow: false`. It touches down after about ⅓ of `dur` (light), ½ (normal), ⅔ (heavy): use that time for `k.react` |
| `k.react(t, at, fn, { pivot, amount: 6, push: [dx, dy], weight, dur: 0.12 })` | the part that gets hit: drawn as usual, and at `at` it jolts by `push` and rocks `amount`° about `pivot`, damped back to rest |
| `k.motion(t, [[value, beats, ease], …])` | one loop as beats. Starts at the last value (so it loops) and moves to each value over its share of the loop; a repeated value is a hold. `k.motion(t, [[0, 1], [1, 2, 'smooth'], [1, 1.5], [0, 2, 'smooth']])` = rest, lift, hold, lower |
| `k.ease.smooth / snappy / bouncy` | Apple springs (SwiftUI): bounce 0 / 0.15 / 0.3. `smooth` is the default for everything |
| `k.ease.easeInOut / easeIn / easeOut / default` | Core Animation cubic-béziers (0.42,0,0.58,1 · 0.42,0,1,1 · 0,0,0.58,1 · 0.25,0.1,0.25,1) |
| `k.spring(bounce)` | a spring curve p → value for any bounce |

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
| `k.person(x, groundY, { h: 400, skin, shirt, pants, hair, shoes, bun, wave, shadow })` | front-view person, big head. `wave: true` raises the right arm with an open five-finger hand; with `t` the forearm swings ±28° from the elbow, or set the angle yourself with `waveAngle` (degrees, e.g. from `k.motion`). `shadow: false` drops the ground shadow. `eyes: 'open'|'closed'`, `faceShade` (default 0.1), `hairStyle: 'short'|'bangs'|'bob'|'buns'|'bun'` (hair colour defaults to the theme's `hair`: black in `sheng`). `rightArm: false` leaves the right arm out so the scene can draw its own (holding, drinking, pointing) from the returned `shoulder`. Returns `{ head, top, hand, feet, shoulder, mouth, unit }` (unit = h/100, the person's scale) |
| `k.hand(x, y, { size: 40, angle: 0, side: 'right'\|'left', spread: 0.7, curl: 0, fill, weight })` | open hand with five fingers, palm to the viewer. (x, y) = wrist, angle 0 = fingers up (+ = clockwise), size = palm width. `curl` bends the fingers in. Returns `{ wrist, center, tip }` |
| `k.grip(x, y, { size: 60, across, side: 'right'\|'left', angle: 0, thumb: false, fill })` | a hand holding an upright object, front view: back of the hand outside the object's edge, four fingers across its front, thumb hidden. (x, y) = where the hand meets the edge; `angle` = the object's tilt. Draw after the object. Returns `{ wrist }` |
| `k.liquid(poly, { tilt, fill: 0.6 })` | liquid in a tipping container: level surface, constant amount. `poly` = the inside in the container's own coordinates, `tilt` = the angle you rotate it by. Returns `{ poly, surface }` to draw inside the container's group |
| `k.highlight(x, y, rx, ry, { angle: -35, fill })` | one small flat highlight, no outline (the lit spot, top-left) |
| `k.teaglass(x, groundY, { h: 300, tea, lid: true, lidFill })` | glass tea tumbler (玻璃杯): pale tea, standing leaves, screw lid. Returns `{ top, rim }` |
| `k.thermos(x, groundY, { h: 460, fill: 'jade', handle, flowers })` | vacuum flask (暖水瓶): wide cylinder, short shoulder, cork, side handle, printed blossoms. Returns `{ top }` |
| `k.enamelmug(x, groundY, { h: 260, fill: 'white', band: 'indigo', inside: 'tea' })` | enamel mug (搪瓷杯): white enamel, dark rim and base band, loop handle. Returns `{ rim }` |
| `k.ricebowl(x, groundY, { w: 360, fill: 'moonwhite', line: 'indigo', chopsticks: true })` | rice bowl with a dome of rice, a blue line, chopsticks resting across the rim. Returns `{ rim }` |
| `k.chibi(x, groundY, { h: 400, head: 0.45, hairStyle: 'short'\|'bangs'\|'bob'\|'buns', expression: 'neutral'\|'happy'\|'closed'\|'tired'\|'surprised'\|'sad', shirt, pants, shoes, hair, skin, wave, reach: { right: [x,y], left: [x,y] }, detail: 'simple'\|'rich', glasses, collar, weight: 'bold', eyeShine, hairShine, shadow })` | Q版 person: big head (`head` = share of height), bean body, stubby limbs, thick even outline, dot eyes, blush, chunky hair with a highlight. `wave: degrees` raises the right arm with an open hand; `reach` bends an arm to put its wrist on a sheet point, for holding things with `k.grip`; add `rightElbowDir` / `leftElbowDir` (wrist → elbow direction, the way the back of the hand faces) so the forearm continues the hand and the wrist stays straight (elbow never folds shut; without a direction it hangs down and a little out). Returns `{ head, top, mouth, shoulderR, shoulderL, wristR, wristL, handR, handL, feet, unit }` |
| `k.chibiLayout(x, groundY, o)` | the same anchors (`mouth`, `shoulderR`, `armLength`, `unit`…) without drawing: place a held thing first, then draw the person reaching for it |
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
