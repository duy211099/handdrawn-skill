// Demo: the 3D skill's cup example in the default look, no title or labels (so 2D and 3D pairs match).
import * as m from '../../../handdrawn-3d/examples/cup.js';
export const sheet = { ...m.sheet, theme: 'jianbihua' };
export function draw(k, t) { k.title = () => {}; k.label = () => {}; return m.draw(k, t); }
