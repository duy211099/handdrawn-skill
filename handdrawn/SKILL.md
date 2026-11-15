---
name: handdrawn
description: Draw a picture of an object, animal, plant, person, food or small scene as one self-contained looping animated SVG (plus a PNG still, or a GIF) in a flat 简笔画 (Chinese simple-stroke) look with Q版 (chibi) people by default, flat 2D front or side view; a classic ink-and-marker look and the Shēng design-system look are available too. Use when the user asks to draw, sketch or illustrate a thing ("draw a teapot", "a cat asleep on a windowsill", "a bowl of noodles", "vẽ một ly cà phê"). Not for diagrams, charts, flowcharts, UI or interactive pages.
---

# handdrawn

Draws one picture as a self-contained **animated SVG**, flat 2D, front or side view. Three looks:
- **`jianbihua` (the default)**: 简笔画 objects (flat fills, soft brush outline in warm ink, traditional colours) and
  **Q版 people** (`k.chibi`: big head, thick even outline, dot eyes, blush). Transparent background, auto-framed.
  See *Jianbihua look* below.
- **`classic`** (`--theme classic`): wobbly ink lines of varying width and marker washes slightly off the lines on
  cream paper, with "boiling" lines (the wobble is redrawn every 2 frames).
- **`sheng`** (`--theme sheng`): the Shēng design system.

The scene can add a small motion with `t`. For a 3D, isometric version use
the **handdrawn-3d** skill instead. Labels and titles use a built-in hand-drawn
stroke font that covers Latin, **Vietnamese** and **Chinese** (with pinyin, Hán-Việt and stroke-order vocab cards).

Kit: `assets/kit.js` · renderer: `assets/render.mjs` · every function: `references/kit.md` (read it before
writing a scene) · worked examples: `examples/` (cup, apple, cat, plant, house, meal).

## Setup (once)

PNG/GIF export needs `@resvg/resvg-js`. If `render.mjs` says it is missing, run `npm install` in this skill's folder.
SVG output needs nothing.

## Before drawing

- **Is it drawable?** If the subject is abstract ("hope", "productivity", "the economy"), don't draw something vague.
  Say so and suggest one or two concrete scenes that show it ("a seedling pushing through a crack in a pavement"),
  then draw the one the user picks.
- **Diagrams, charts, UI, buttons, interactive things:** not this skill.
- **Animation:** the SVG always loops (line boil), except in vocab mode (see below). Add one small motion that belongs to the subject (steam, a tail
  swish, a blink, leaves swaying) when it fits or when the user asks; otherwise the boil alone is enough.
  A single-frame SVG only when the user asks for a still (`--still`).

## Workflow

1. **Parts and view.** List the subject's real parts and pick the view: front or side.
   A teapot: body, lid, knob, spout, handle, foot; side view. Draw from the real parts (rims, handles, lids, stems,
   boards, tiles), not a generic blob with a name on it.
2. **Block it out.** Write a small table in a comment at the top of the scene: part, shape call, box (x, y, w, h),
   colour. The subject fills ~65–80% of the sheet, centred, with breathing room. The ground/table line sits about
   80–88% down.
3. **Draw back to front** in `scene.js` with the kit: shadow → things behind → main body → details on top → labels.
   Prefer the ready-made pieces (`k.cat`, `k.chibi` for people (`k.person` in the classic look), `k.tree`, `k.house`, `k.window`, `k.leaf`…) and change their
   options rather than redrawing them. Use `k.turned` for anything round you could turn on a wheel (cups, pots,
   vases, bottles, bowls, lamps). Use `k.tube` for handles, stems, tails, arms and branches.
4. **Render and look:**
   ```
   node <skill>/assets/render.mjs scene.js -o out/scene.svg --png out/scene.png --thumb --grid
   ```
   Open `out/scene.png` with the Read tool and **look at it**. The `--grid` overlay prints coordinates so you can
   read off where things actually are. Also look at `out/scene-128.png`: it must still read as the subject at 128 px.
5. **Fix and re-render.** Check:
   - Does it read as the subject at a glance, and at 128 px? Silhouette first: if the outline doesn't say "teapot",
     no detail will save it.
   - Proportions and overlaps: handles attach to bodies, things rest on the ground, nothing floats or clips.
   - Light is from the top-left everywhere (shade/hatching on the bottom-right).
   - Labels don't sit on top of the drawing or cross other lines.
   Repeat 4–5 until it's right (usually 2–4 rounds). Then render the final **without** `--grid`.

**Never deliver without having looked at the PNG.** Deliver the SVG (the animated picture) and the PNG paths, and
show the PNG. If the scene moves, also check a few frames (see *Animation*).

## Style rules

- **One look per picture** (and per set): one theme throughout. In `classic`: ink + flat marker wash. No texture or grain. No gradients, glows, drop shadows, blur, opacity tricks or SVG `<text>`
  (use `k.text` / `k.label` / `k.title`). Don't add raw SVG.
- **Colour:** palette names (`red, coral, orange, ochre, yellow, sage, green, leaf, teal, sky, blue, navy, lilac,
  plum, pink, wood, brown, chocolate, grey, stone, charcoal, white, cream, sand, skin, tan`). 3–5 colours per
  picture plus ink. Any hex is softened automatically, but palette names look best.
- **Shading:** `shade: true` (or 0.15–0.35) on main volumes; `hatch: true` on one or two big objects at most.
  The light always comes from the top-left.
- **Line weights:** outlines `'outline'` (default), inner details `'detail'`, small marks and leader lines `'fine'`.
- **Cute and round:** people are Q版 (`k.chibi`); animals and plants are soft and round, with big heads, dot eyes and small blush ovals.
  No sharp, realistic anatomy.
- **Composition:** one clear subject, centred, filling most of the sheet. A ground shadow (`k.shadow`) under
  anything that stands on something.
- **Text:** optional `k.title(...)` top-left, plus short lowercase margin labels (`k.label`) with leader lines,
  placed in empty margin space. Never boxes or speech bubbles floating over the drawing. Write labels in the
  user's language. Vietnamese is fully supported.
- **Chinese vocabulary** (the drawing is for learning a Chinese word, e.g. "vẽ 茶", "picture for 电话"): use
  **vocab mode**, see the section below.
- **Sheet:** 1000×1000 by default. For wide scenes use `export const sheet = { width: 1200, height: 900 }`.
  `--transparent` drops the paper.

## Vocab mode (Chinese words for Vietnamese learners)

**The scene** draws the picture only (no text, no `k.word`, no labels) on the normal 1000×1000 sheet and exports
the word:

```js
export const vocab = { hanzi: '苹果', pinyin: 'píngguǒ', hanviet: 'bình quả', meaning: 'quả táo',
                       note: '',            // optional: false-friend warning
                       kind: 'concrete' };  // 'concrete' | 'action' | 'abstract'
```

**Output: by default just the picture, no words.** `x.svg` is the picture (plus PNG, thumb and GIF as usual).
Words are added only when they're needed:
- **`abstract`** words always get the word card under the picture in `x.svg` (a picture alone can't carry
  希望), plus `x-hanzi.svg` (characters and pinyin only).
- **Flashcards**, when the user asks for the word, a card or a deck: add `--card` (or `card: true` in `vocab`).
  You then also get `x-card.svg` (picture with the card under it) and `x-hanzi.svg`. In a deck, picture or hanzi
  goes on the front and the card goes on the back.

**Look: the Shēng theme** (`--theme sheng` or `sheet.theme`; the default look is `jianbihua`, below) follows the
Shēng design system:
- Flat paper `surface` #f7f6f2 with no texture, and ink #191d24.
- Tone colours are the Pleco set (1 red, 2 green, 3 blue, 4 purple, neutral gray) and colour the **pinyin only**.
  Hanzi stay ink.
- Pinyin sits above the hanzi. Hán-Việt and the meaning go under them in `ink-muted`.
- `celadon` / `jade` are in the palette for the brand accent.
- **`rough`** (0 = clean vector … 1 = classic) sets how hand-made the marks look: line wobble, pressure
  variation, overshoot and loops that don't quite close, the colour wash sitting off the line with an uneven
  edge, and ground-shadow flicks. `sheng` uses 0.4 and `classic` uses 1. Override it with `--rough 0.2` or
  `sheet.rough`.

**Jianbihua look (简笔画, `--theme jianbihua`).** A colour simple-stroke flashcard style:
- Flat fills only: no shading or hatching, plus at most one `k.highlight(x, y, rx, ry)`.
- A soft brush outline in warm ink #2B2B2B, at `rough` 0.1.
- Traditional colours: cinnabar, persimmon, gamboge, malachite, celadon, azurite, ochre, paper white, plus the
  neutrals skin, grey, hair and blush. Old palette names map onto these automatically (red → cinnabar,
  sky → azurite…).
- **Transparent background** for the app. `--opaque` gives the #F6EFE2 paper for standalone cards.
- **Auto-framing**: the renderer centres the drawing so its larger side fills 65% of the sheet (`--fit`),
  keeping line weights unchanged. A drawing that runs off the sheet edge (a waist-up person) keeps its framing.
- The renderer **warns** about colours outside the palette and about more than 4 colours per object (a
  person's skin, hair and blush don't count). Fix the warning unless the object really needs that colour.
- Cinnabar, malachite and azurite are close to tone 1, 2 and 3: use them only when the thing really is that
  colour.
- Example set: `vocab-tea`, `vocab-baozi`, `vocab-apple`, `vocab-cup`, `vocab-cat`, `vocab-drink`.
- **People are Q版 (Q-version, chibi): use `k.chibi`, not `k.person`.**
  - Proportions: 2–2.5 heads tall (`head` 0.4–0.5, default 0.45).
  - Face: solid dot eyes, a small curved smile, round pink blush, no nose.
  - Hair: big, chunky, rounded hair that owns the silhouette, with one flat highlight.
  - Line: a thick, even outline. People always get the even line, even when objects use the brush.
  - Hands: round mittens, except a hand that's doing the word gets fingers (`wave`, or `reach` + `k.grip`).
  - Props are drawn big next to a Q版 person: a glass is about as tall as the face is wide.
  - Use expressions for feeling words (开心 `happy`, 生气 `angry`, 累 `tired`, 害怕 `scared`, 难过 `sad`,
    吃惊 `surprised`): the person with that face and nothing else (`examples/vocab-angry.js`). Keep the default
    `neutral` otherwise.
  - Use Q版 people for verbs, feelings and roles, and 简笔画 objects for nouns.
  - `detail: 'rich'` with `head: 0.36` gives a restrained Q版 with more detail (soft brows, eye shine, a hint of
    a nose, ear lines, collar points, cuffs, thumbs, hair strands); `glasses: true` adds glasses. Use one
    setting across a whole set.
  - Q版 is a general style. Never copy a specific artist's character, and never caricature real people.

**Chinese styling** comes from the subject and the line, never from motifs:
- **Draw everyday China as it is.** People have black hair (the default in `sheng`; `hairStyle: 'short' | 'bangs'
  | 'bob' | 'buns' | 'bun'`) and ordinary modern clothes. Use the ready-made everyday things: `k.teaglass`
  (glass tea tumbler), `k.thermos` (暖水瓶), `k.enamelmug` (搪瓷杯), `k.ricebowl` (chopsticks across the rim, never
  stuck upright in the rice). **Never caricature** faces, eyes or skin to say "Chinese".
- **Traditional colours** are in the palette under English or Chinese names: `gamboge` 藤黄, `ochre` 赭石,
  `indigo` 花青, `dai` 黛, `moonwhite` 月白, `ivory` 牙色, `celadon` 青瓷, ink steps `ink1`–`ink3`. In vocab
  pictures, don't use strong red, green, blue or purple (朱砂, 石绿, 石青) unless the thing really is that colour:
  those are the tone colours.
- **Brush line (gongbi 工笔)**: `--stroke brush` (or `sheet.stroke`) draws each line like a brush: pressed start,
  thick and thin as the line turns, a long pointed tail. Pair it with `--rough 0.2`. It's optional: the default
  is the marker line until the Shēng design owner picks one.

In the pictures, follow Shēng's cultural rule: grounded in real objects, never lanterns, dragons, clouds,
red-and-gold, seal stamps, maps or national symbols.

**Pick the kind. It decides the motion** (line boil is always off in vocab mode):
- **`concrete`**: things, food, animals, places, visible qualities (苹果, 杯子, 猫, 红). Renders as a **still**.
  Don't animate an object for the sake of it.
- **`action`**: verbs you can see (挥手 wave, 喝 drink, 跑 run, 打开 open). The motion **is** the meaning:
  animate the action with `t` so it loops, with lines steady so the action is the only thing that moves. The
  renderer warns if nothing moves.
- **`abstract`**: 希望 hope, 习惯 habit, 因为 because. Draw one clear situation that shows the word (a sprout
  under a rising sun for 希望). It may move a little with `t`.

**Abstract words: use a standard metaphor.** One clear situation that shows the word. Reuse these so a set feels
consistent (the person is always `k.chibi`, objects are plain 简笔画):

| word (kind of meaning) | metaphor |
|---|---|
| 选择 choose, 决定 decide | a fork in the road with a signpost, a person thinking (`examples/vocab-choose.js`) |
| 习惯 habit, 每天 every day, 坚持 keep at it | a calendar filling with ticks, one per day (`examples/vocab-habit.js`) |
| 希望 hope | a sprout under a rising sun (`examples/vocab-hope.js`) |
| 因为…所以 because…so | two dominoes: the first tips the second (cause → effect) |
| 但是 but, 可是 however | a path that turns sharply / a person stopping at a wall |
| 比较 compare, 更 more | a balance scale, one side lower |
| 变化 change | the same thing in two states side by side (a bud → a flower) |
| 努力 work hard | a person pushing a big ball uphill |
| 机会 chance | an open door with light coming through |
| 问题 problem | a big knot in a rope / a person facing a wall |
| 帮助 help | one person pulling another up a step |
| 重要 important | one object much bigger than a row of small ones |
| 安全 safe | a person under an umbrella in the rain |
| 记得 remember, 忘 forget | a thought bubble with the thing / with an empty dashed outline |

Pick the metaphor that has **one** reading; when two could fit, use the one that matches the card's meaning.

**Paper stop-motion reveal** (optional, good for abstract words and lesson intros): build the picture part by part,
then the finished picture holds for the rest of the loop. Use 3–6 parts. Set `sheet.poster: 0.99` so the still and
the first frame show the finished picture, and `fps: 12` for a tactile, hand-made feel. Nouns stay plain stills.
Every part is a **rigid paper cut-out**, so the motion has to obey physics:
- **Paper never grows or stretches.** Objects come in with `k.pop(…, { from })` (slide in from a side) or
  `k.drop` (fall onto the ground). `k.pop` with only a `pivot` scales up: keep that for ink marks (ticks, stamps).
- **Things fall under gravity.** `k.drop` speeds up as it falls, hits `groundY`, bounces lower each time. Its
  shadow stays on the ground and darkens as it comes down (pass `shadow: [rx, ry]`, draw the part with
  `shadow: false`).
- **Weight decides the bounce.** `weight: 'heavy'` (a post, a table, a weight) barely bounces; `'light'` (a person
  hopping in, paper, a leaf, a coin) bounces and rocks more.
- **Cut-outs land a little crooked.** `tilt: 6…15` makes a part arrive turned and settle flat (rocking on its
  contact point for `k.drop`).
- **Order: ground and base objects → people → the contact last.** The contact (a hand presses the switch, the
  magnifier reaches the meter, someone lands) is the beat that carries the meaning, and the thing that is hit
  reacts: wrap it in `k.react(t, at, …, { pivot, push })` with `at` = the moment of contact.
- **Overlap the parts.** Start the next part while the last one is still settling (about 2/3 into its `dur`).
- **Lock the camera.** The sheet never zooms, pans or shakes; only the parts move. Keep the hanzi still.

**Make the action detailed.** The parts doing the action must be drawn properly, big enough to read:
- **Hands that act get five fingers** (`k.hand`: wave, point, hold, grab, count). `k.chibi({ wave })`
  already waves an open five-finger hand. Never use a round blob for a hand that is doing the word.
- **Holding something** (喝 drink, 拿 hold, 打电话 phone): place the object first (`k.chibiLayout` gives the mouth
  and shoulders without drawing), draw `k.chibi({ reach: { right: wrist, rightElbowDir } })` so the arm bends to
  it, then the object, then `k.grip` on top: back of the hand on the outside, four fingers across the front,
  thumb hidden. A person's right hand (viewer's right) is `side: 'right'`.
- **Skeleton rules for arms.** Bones keep their length, the elbow never folds shut, and the **wrist stays nearly
  straight**: the forearm continues the back of the hand. Pass `rightElbowDir` (the direction from the wrist
  toward the elbow, the way the back of the hand faces) so the arm picks the right elbow. Relaxed holding: elbow
  down by the side (`[0.35, 1]`). Lifting to the face: elbow out to the side at shoulder height (`[1, 0.25]`).
  Blend between them as the action moves. Never let a hand's angle come from the object while the arm does its
  own thing: that's a broken wrist.
  - Shoulders sit at the edge of the body, and **an elbow never sinks inside the torso**.
  - Holding something close in front of the chest: the upper arm hangs by the side and the forearm points at the
    viewer, so it looks shorter (`k.chibi` does this for relaxed holds). Don't swing the elbow out to make room.
  - Lift the elbow out only when the hand reaches the face, not partway up (see the elbow blend in
    `examples/vocab-drink.js`).
- **Drinking and pouring, front view: tip toward the viewer, not sideways.** People tip a glass toward their face.
  In a front view the glass stays upright on screen, gets shorter, and its base comes into view as an ellipse,
  with the rim on the lips. Tipping it sideways across the face forces either a broken wrist or an elbow over the
  head. Liquids use `k.liquid`: a level surface with the same amount. In a tipped glass the water sits at the
  rim end, which is the lowest end (`examples/vocab-drink.js`).
- **Frame it close enough.** If the action is in the hands or face, crop to waist-up or closer (put the
  ground line below the sheet; see `examples/vocab-wave.js`). The moving part should fill a good share of the
  picture, not be a few pixels at the end of a full-body figure.
- **Time it like a real action, Apple-style.** Build the loop from beats with `k.motion(t, [[value, beats,
  ease], …])`: rest → move → hold → move back. Use the `'smooth'` spring (SwiftUI's default: no overshoot, quick
  start, gentle settle) for moves; `'snappy'` / `'bouncy'` only for playful things. Avoid a bare
  `Math.sin(2πt)`: it never rests and feels restless. Vocab motion plays at 24 fps; set the loop length with
  `sheet.duration` (seconds, default 2.4; ~2.5–3.5 s for an action with holds).
- **Show the whole movement.** Use a clear swing that loops (±25–30°), not a twitch. Move the object the
  action acts on too (the cup tips to the mouth, the door swings open).
- **Look at several frames** (GIF frames tiled, see *Animation*), not only the PNG: at every frame the
  action must still read, and nothing may clip off the sheet.

**Draw for one meaning only:**
- **One subject, no setting.** Draw just the thing (or the person doing the action), with its ground shadow
  when its feet are in frame. No room, table, background or extra props: each one is another word the learner
  might name instead.
- **Keep the features that tell it apart** from its neighbours: a 碗 bowl vs a 杯子 cup vs a 盘子 plate
  differ in shape, so get the shape right. Drop surface detail that doesn't help.
- **The one-word test.** Look at the PNG (and the 128 px thumb) and ask what single word a learner would
  name. If two answers are plausible (cup / tea, girl / pretty, run / sport), change the drawing until one
  wins: crop to the object, exaggerate the defining feature, show the action mid-motion.
- **Draw things as they look in China** unless the user asks otherwise (a 杯子 is often a glass tea tumbler).
- **When there's a card, check the text.** Pinyin tones and Hán-Việt readings must be right. Add a `note`
  when the Hán-Việt meaning is a false friend (走 zǒu: hán việt *tẩu* = chạy, but 走 = đi). The stroke font has no
  `≠` or arrows: write the note in words ("! bao tử ở đây không phải dạ dày").
- Examples: `examples/vocab-apple.js` (concrete), `examples/vocab-wave.js` (action, waist-up, five-finger
  hand), `examples/vocab-hope.js` (abstract, with card).

## Scene template

```js
// teapot, side view. parts: body (turned), lid, knob, spout (tube), handle (tube), shadow
export const sheet = { seed: 1 };
export function draw(k, t = 0) {
  k.shadow(500, 820, 300, 34);
  k.tube([[690, 540], [810, 520], [810, 650], [700, 710]], 34, { fill: 'teal' });           // handle (ends hidden by the body)
  k.tube([[330, 640], [250, 560], [200, 470]], [60, 26], { fill: 'teal', shade: 0.3 });    // spout
  const pot = k.turned([[150, 0], [230, 70], [250, 180], [210, 300], [170, 330]],
                       { cx: 500, y: 480, fill: 'teal', hatch: true });                    // body
  k.ellipse(500, 480, 150, 22, { fill: 'teal', weight: 'detail' });                        // lid
  k.blob(500, 445, 30, { squash: 0.8, fill: 'ochre' });                                   // knob
  k.label('the good teapot', { x: 640, y: 300, to: [560, 440] });
}
```

## Animation (always on)

`out.svg` is a looping animated SVG by default: frames switched by CSS, no script, plays in browsers and `<img>`
tags (renderers without CSS animation show frame 0). Scenes get `t` ∈ [0, 1), one loop. Keep it simple: at most one
or two moving things (steam, a tail swish, a blink, leaves swaying, smoke) on top of the automatic **line boil**:
the wobble is re-drawn every 2 frames, so even a still subject looks alive. Make motion loop seamlessly with `Math.sin(2 * Math.PI * t)`. The ready-made pieces take `t`:
`k.steam(x, y, { t })`, `k.cat(..., { animate: true, t })`, `k.person(..., { wave: true, t })`.

```
node <skill>/assets/render.mjs scene.js -o out/scene.svg --png out/scene.png          # animated SVG + PNG still
node <skill>/assets/render.mjs scene.js -o out/scene.svg --gif out/scene.gif          # + GIF, plays everywhere
node <skill>/assets/render.mjs scene.js -o out/scene.svg --still                      # single-frame SVG
     --frames 8 --fps 10 --boil 2 --gif-size 560
```

Check a GIF by looking at a few frames: `ffmpeg -i out/scene.gif -vf "select='not(mod(n\,3))',scale=300:-1,tile=4x1" -frames:v 1 out/frames.png`
(or check the PNG still, which is frame 0). GIFs are 256-colour: keep them ≤ 600 px wide.
