#!/usr/bin/env bash
# Render the 2D-vs-3D demo: the same five prompts through each skill, default look, on paper.
#   bash docs/demo/build.sh      → docs/demo/{2d,3d}-<name>.svg (animated) + .png (still) + compare.png
set -euo pipefail
cd "$(dirname "$0")/../.."
D=docs/demo
for n in cup apple plant house drink; do
  node handdrawn/assets/render.mjs $D/scenes/2d-$n.js -o $D/2d-$n.svg --png $D/2d-$n.png --size 480 --opaque >/dev/null
  node handdrawn-3d/assets/render.mjs $D/scenes/3d-$n.js -o $D/3d-$n.svg --png $D/3d-$n.png --size 480 --opaque --at 0.5 >/dev/null
  echo "ok  $n"
done
# side-by-side sheet (needs ImageMagick; optional)
if command -v montage >/dev/null; then
  montage $(for n in cup apple plant house drink; do echo $D/2d-$n.png; done) $(for n in cup apple plant house drink; do echo $D/3d-$n.png; done) \
    -tile 5x2 -geometry 300x300+6+6 -background '#F6EFE2' $D/compare.png && echo "ok  compare.png"
fi
