---
name: handdrawn
description: Draw a picture of an object, animal, plant, person, food or small scene as one self-contained SVG (plus PNG, or a small looping GIF) in a hand-drawn ink-and-marker look, flat 2D front or side view, like a children's-book or field-notebook sketch. Use when the user asks to draw, sketch or illustrate a thing ("draw a teapot", "a cat asleep on a windowsill", "a bowl of noodles", "vẽ một ly cà phê"). Not for diagrams, charts, flowcharts, UI or interactive pages.
---

# handdrawn

Draws one picture as a self-contained SVG: wobbly ink lines of varying width, marker washes slightly off the
lines, on cream paper. Flat 2D, front or side view. Labels and titles use a built-in hand-drawn
stroke font that covers Latin and **Vietnamese**.

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
- **Animation:** only when the user asks for it ("animated", "gif", "moving"). Otherwise always a still.

## Workflow

1. **Parts and view.** List the subject's real parts and pick the view: front or side.
   A teapot: body, lid, knob, spout, handle, foot; side view. Draw from the real parts (rims, handles, lids, stems,
   boards, tiles), not a generic blob with a name on it.
2. **Block it out.** Write a small table in a comment at the top of the scene: part, shape call, box (x, y, w, h),
   colour. The subject fills ~65–80% of the sheet, centred, with breathing room. The ground/table line sits about
   80–88% down.
3. **Draw back to front** in `scene.js` with the kit: shadow → things behind → main body → details on top → labels.
   Prefer the ready-made pieces (`k.cat`, `k.person`, `k.tree`, `k.house`, `k.window`, `k.leaf`…) and change their
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

**Never deliver without having looked at the PNG.** Deliver the SVG (and the PNG) paths, and show the PNG.

## Style rules

- **One look:** ink + flat marker wash. No texture or grain. No gradients, glows, drop shadows, blur, opacity tricks or SVG `<text>`
  (use `k.text` / `k.label` / `k.title`). Don't add raw SVG.
- **Colour:** palette names (`red, coral, orange, ochre, yellow, sage, green, leaf, teal, sky, blue, navy, lilac,
  plum, pink, wood, brown, chocolate, grey, stone, charcoal, white, cream, sand, skin, tan`). 3–5 colours per
  picture plus ink. Any hex is softened automatically, but palette names look best.
- **Shading:** `shade: true` (or 0.15–0.35) on main volumes; `hatch: true` on one or two big objects at most.
  The light always comes from the top-left.
- **Line weights:** outlines `'outline'` (default), inner details `'detail'`, small marks and leader lines `'fine'`.
- **Cute and round:** animals and plants are soft and round, with big heads, dot eyes and small blush ovals.
  No sharp, realistic anatomy.
- **Composition:** one clear subject, centred, filling most of the sheet. A ground shadow (`k.shadow`) under
  anything that stands on something.
- **Text:** optional `k.title(...)` top-left, plus short lowercase margin labels (`k.label`) with leader lines,
  placed in empty margin space. Never boxes or speech bubbles floating over the drawing. Write labels in the
  user's language. Vietnamese is fully supported.
- **Sheet:** 1000×1000 by default. For wide scenes use `export const sheet = { width: 1200, height: 900 }`.
  `--transparent` drops the paper.

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

## Animation (only when asked)

Scenes get `t` ∈ [0, 1), one loop. Keep it simple: one or two moving things (steam, a tail swish, a blink, leaves
swaying, smoke) plus the automatic **line boil**: the wobble is re-drawn every 2 frames, so even a still subject
looks alive. Make motion loop seamlessly with `Math.sin(2 * Math.PI * t)`. The ready-made pieces take `t`:
`k.steam(x, y, { t })`, `k.cat(..., { animate: true, t })`, `k.person(..., { wave: true, t })`.

```
node <skill>/assets/render.mjs scene.js -o out/scene.svg --gif out/scene.gif            # GIF, plays everywhere
node <skill>/assets/render.mjs scene.js -o out/scene.svg --animate                     # animated SVG (browsers only)
     --frames 8 --fps 10 --boil 2 --gif-size 560
```

Check a GIF by looking at a few frames: `ffmpeg -i out/scene.gif -vf "select='not(mod(n\,3))',scale=300:-1,tile=4x1" -frames:v 1 out/frames.png`
(or check the PNG still, which is frame 0). GIFs are 256-colour: keep them ≤ 600 px wide.
