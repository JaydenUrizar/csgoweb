// Keyframed animation clips per tagger (values: cm / degrees; tracks: w = whole rig offset, rh/lh = hand offsets,
// rc/lc = curl deltas, any other name = a movable model part). Times are 0..1 of the clip duration.
import { clip } from './anim.js';

const Z6 = [0, 0, 0, 0, 0, 0];
export function baseClips(id, meta, prof) {
  const C = {};
  C.draw = clip(prof.draw, {
    w: [[0, [5, -27, 8, -62, 14, 26]], [0.55, [-0.5, 1.2, -0.6, 5, -2, -3], 'out3'], [0.8, [0.2, -0.3, 0.2, -1.5, 0.6, 0.8], 'io'], [1, Z6, 'io']],
    lh: [[0, [-2, -8, 6, 0, 0, 0]], [0.6, Z6, 'out3']],
    rc: [[0, 0.25], [0.5, 0, 'out']], lc: [[0, 0.3], [0.6, 0, 'out']],
  }, [[0.05, 'draw']]);
  C.holster = clip(0.16, { w: [[0, Z6], [1, [4, -25, 7, -55, 12, 22], 'in']], lh: [[0, Z6], [1, [-2, -8, 6, 0, 0, 0], 'in']] }, [[0.1, 'holster']]);
  C.empty = clip(0.16, { w: [[0, Z6], [0.3, [0, -0.4, 0.9, 1.6, 0.3, 0.4], 'out'], [1, Z6, 'io']] }, [[0.05, 'empty']]);
  C.inspect = clip(prof.inspect, {
    w: [[0, Z6], [0.15, [-5, 3, 6, 6, 42, -18], 'io'], [0.42, [-6, 4, 7, -6, 66, -28], 'io'], [0.7, [-3, 2, 4, 4, 30, -10], 'io'], [1, Z6, 'io']],
    lh: [[0, Z6], [0.2, [-3, -3, 5, 0, 0, 0], 'io'], [0.9, [-3, -3, 5, 0, 0, 0], 'io'], [1, Z6, 'io']],
  }, [[0.12, 'inspect1'], [0.5, 'inspect2']]);
  return C;
}
export function clipsFor(id, meta, prof) { return baseClips(id, meta, prof); }
