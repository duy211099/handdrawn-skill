// Demo: the 2D skill's plant example in the default look, no title or labels (so 2D and 3D pairs match).
import * as m from '../../../handdrawn/examples/plant.js';
export const sheet = { ...m.sheet, theme: 'jianbihua' };
export function draw(k, t) { k.title = () => {}; k.label = () => {}; return m.draw(k, t); }
