---
name: handdrawn-3d
description: 3D version of handdrawn. Draw an object, animal, plant, food or small scene as a 3D model rendered in a hand-drawn ink-and-marker look (isometric by default, flat light/mid/dark marker tones, wobbly ink outlines, cream paper) and deliver it as one self-contained looping animated SVG where something in the object moves (a lid rattles, bread pops, sails turn, steam rises), plus a PNG still or GIF. Use only when the user asks for 3D, isometric or a 3D-modelled drawing ("draw a teapot in 3D", "an isometric toaster popping", "/handdrawn-3d windmill"); for ordinary drawings use the 2D handdrawn skill. Not for diagrams, charts, flowcharts, UI or interactive pages.
---

# handdrawn-3d

You model the subject in 3D with a few simple solids, and the kit draws it by hand. Faces get three flat marker
tones from a light at the upper left. Neighbouring faces of the same tone merge into one wash. The silhouette is
inked heavy and the creases lighter, with wobbly, tapering lines, on cream paper. The scene is drawn once per frame
with `t` going round one loop. The output is a **looping animated SVG**: the frames are switched by CSS, with no
script, so it plays in browsers and `<img>` tags. Text uses a built-in hand-drawn font with full **Vietnamese** support.

Kit: `assets/kit.js` · renderer: `assets/render.mjs` · every function and option: `references/kit.md` (**read it
before writing a scene**) · worked examples: `examples/` (cup, teapot, toaster, windmill, drink: read the closest one; drink = a person,
3D arm IK with a pole, sloshing water).

## Setup (once)

PNG/GIF export needs `@resvg/resvg-js`. If `render.mjs` says it is missing, run `npm install` in this skill's folder.
The SVG itself needs nothing.

## Before drawing

- **Is it drawable?** If the subject is abstract ("hope", "productivity"), don't draw something vague. Suggest one
  or two concrete scenes that show it, then draw the one the user picks.
- **Diagrams, charts, UI, buttons, interactive things:** not this skill.
- **What moves?** Every picture animates *the object itself*: the camera never moves. Pick one or two motions
  that belong to the subject. A kettle lid rattles and steams. Toast pops. A windmill's sails turn. A fan spins.
  A cat's tail swishes. A lamp nods. A plant sways. If the user names a motion, use that one. If nothing can
  plausibly move, use steam, a gentle bob or a sway, and the lines' own boil.

## Workflow

1. **Parts.** List the subject's real parts and how each is built from solids. Write it as a table in a comment at
   the top of the scene: part · call · size/position · colour. Model from the real parts (rims, lids, knobs,
   handles, feet, slots, hinges), not one blob with a name on it. Look up proportions you're unsure of.
2. **Model it** in `scene.js` (world: x right, y back, z up, ground z = 0; mm-ish units; framing is automatic):
   - round things you could turn on a wheel → `k.lathe` (containers get `wall:`), `k.cylinder`, `k.sphere`
   - boxy things → `k.box` (`round:` for soft appliance corners), odd outlines → `k.extrude`
   - handles, spouts, pipes, legs, cables, stems → `k.tube`, **starting inside the body** (it is cut at the surface)
   - contents of a container → `{ in: container }`; flat marks on a face → `k.panel` / `k.line` with `{ on: solid }`
   - turn the whole subject with `k.group({ rotate: { z: 45 } }, …)` when its "side view" should face the viewer
     (a teapot's spout to the left and handle to the right)
3. **Animate** with `t` ∈ [0, 1): moving parts go in a `k.group({ about, rotate, at }, …)` driven by `k.wave()`,
   `k.pulse()` or `360 * t`. Every motion must come back to where it started at `t = 1`.
4. **Render and look:**
   ```
   node <skill>/assets/render.mjs scene.js -o out/scene.svg --png out/scene.png --strip --thumb
   ```
   Open `out/scene.png` (a still) **and** `out/scene-frames.png` (6 frames across the loop) with the Read tool and
   **look at them**. Add `--grid` to read off sheet coordinates. Check `out/scene-128.png`: it must still read
   as the subject at 128 px.
5. **Fix and re-render.** Check:
   - Does it read as the subject at a glance? Silhouette first.
   - **Nothing drawn in the wrong order:** a part showing through a body, a far part over a near one, contents
     hidden or poking through. Fix it with the rules under *How solids are ordered* in `references/kit.md`:
     separate solids, `in:`, `on:`, model only what sticks out of an opening, and `layer` as a last resort.
   - Parts touch what holds them. Nothing floats unless it should (a hopping lid).
   - **The motion reads** in the frame strip and loops without a jump.
   - Labels sit in the margins and don't cross the drawing more than they must.
   Repeat 4–5 until it's right (usually 2–4 rounds). Render the final **without** `--grid`.

**Never deliver without having looked at the still and the frame strip.** Deliver the SVG path (the animated
picture), plus the PNG, and show the PNG. Add `--gif out/scene.gif` when the user wants a GIF or the SVG has to
go somewhere that doesn't play SVG animation (chat apps, some email clients).

## Style rules

- **One look:** ink + flat marker tones on paper. No gradients, glows, blur, opacity tricks, SVG `<text>` or raw
  SVG. Use only the kit.
- **Colour:** palette names (see `references/kit.md`), 3–5 per picture plus ink. Palette names look best; any hex is
  softened. Light, mid and dark come from each fill automatically. Don't fake shading with extra solids.
- **Camera:** isometric by default. Change `sheet.camera` only for a reason. A lower pitch (20–25) and a yaw of
  25–35 make a friendlier "product shot" for tall things (towers, bottles, lamps, people).
- **Simple and chunky:** a few clean solids read better than many fiddly ones. Small parts (knobs, feet, buttons)
  are what make it look real: add them.
- **Ground it:** shadows are automatic. Something standing on a board, table or saucer casts its shadow onto it.
  A board, tray, mound or table under a small object helps it sit in space.
- **Text:** optional `k.title(...)` top-left, plus short lowercase margin notes (`k.label`) pointing at 3D points.
  Write them in the user's language. No boxes or speech bubbles over the drawing.
- **Sheet:** 1000×1000 by default. For wide scenes use `export const sheet = { width: 1200, height: 900 }`.
  `--transparent` drops the paper.
- **Animation size:** 16 frames at 12 fps (a 1.3 s loop) by default; a typical SVG is 0.5–1 MB. For a slow motion
  use `sheet.fps = 8`. Keep `frames` ≤ 24.

## Scene template

```js
// A teapot on a trivet; the lid rattles.
// part      call                  size / where                            colour
// trivet    cylinder              r 120, h 10                             wood
// body      lathe { smooth }      r 55→94→50, h 118, on the trivet       teal
// spout     tube [14, 7]          from inside the body, out to the left   teal
// handle    tube 8                both ends inside the body, right side  teal
// lid+knob  lathe + sphere        in a group hinged at its back edge      teal, ochre
export const sheet = { seed: 3 };
export function draw(k, t = 0) {
  k.cylinder([0, 0, 0], 120, 10, { fill: 'wood' });
  k.group({ rotate: { z: 45 } }, () => {                          // spout to screen-left, handle to screen-right
    k.lathe([0, 0, 10], [[55, 0], [78, 10], [94, 45], [90, 85], [68, 112], [50, 118]], { fill: 'teal', smooth: true });
    k.tube([[-78, 0, 50], [-112, 0, 66], [-128, 0, 100], [-146, 0, 118]], [14, 7], { fill: 'teal' });
    k.tube([[70, 0, 112], [112, 0, 108], [122, 0, 72], [84, 0, 40]], 8, { fill: 'teal' });
    const hop = Math.max(0, k.wave(0, 2 * t));                    // 0..1, two hops per loop
    k.group({ about: [44, 0, 128], rotate: { y: -18 * hop }, at: [0, 0, 16 * hop] }, () => {
      k.lathe([0, 0, 127], [[52, 0], [50, 5], [30, 13], [8, 18], [0, 19]], { fill: 'teal', smooth: true });
      k.sphere([0, 0, 152], 10, { fill: 'ochre' });
    });
    k.steam([-150, 0, 125], { h: 90, n: 2, spread: 18 });
  });
  k.label('rattling lid', { to: [0, 0, 140], side: 'right' });
}
```
