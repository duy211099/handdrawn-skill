// Demo: the 2D skill's vocab-discipline example in the default look, no title or labels (so 2D and 3D pairs match).
import * as m from '../../../handdrawn/examples/vocab-discipline.js';
export const sheet = { ...m.sheet, theme: 'jianbihua' };
export const vocab = m.vocab;
export function draw(k, t) { k.title = () => {}; k.label = () => {}; return m.draw(k, t); }
