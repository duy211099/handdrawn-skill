#!/usr/bin/env bash
# Render every example (SVG + PNG + 128px thumb), check determinism and self-containment, build the GIFs.
set -euo pipefail
cd "$(dirname "$0")/.."
R=handdrawn/assets/render.mjs; O=out
mkdir -p $O
for f in handdrawn/examples/*.js; do
  n=$(basename "$f" .js)
  node $R "$f" -o $O/$n.svg --png $O/$n.png --thumb $O/$n-128.png >/dev/null
  node $R "$f" -o $O/$n.again.svg >/dev/null
  cmp -s $O/$n.svg $O/$n.again.svg || { echo "FAIL $n: same seed, different SVG"; exit 1; }
  node $R "$f" -o $O/$n.seed99.svg --seed 99 >/dev/null
  cmp -s $O/$n.svg $O/$n.seed99.svg && { echo "FAIL $n: --seed had no effect"; exit 1; }
  if grep -qE '(href|src)="(http|file|/)' $O/$n.svg; then echo "FAIL $n: external reference"; exit 1; fi
  rm $O/$n.again.svg $O/$n.seed99.svg
  echo "ok  $n"
done
node $R handdrawn/examples/cup.js -o $O/cup-anim.svg --animate --gif $O/cup.gif >/dev/null && echo "ok  cup.gif + animated svg"
node $R handdrawn/examples/cat.js -o $O/cat-anim.svg --animate --gif $O/cat.gif --frames 12 --fps 8 >/dev/null && echo "ok  cat.gif + animated svg"
echo "all good — now LOOK at $O/*.png"
