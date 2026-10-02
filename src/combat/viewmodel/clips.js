// Keyframed animation clips per tagger (values: cm / degrees; tracks: w = whole rig offset, rh/lh = hand offsets from the
// hand's rest pose, rc/lc = curl deltas, any other name = a movable model part offset from its pivot). Times are 0..1 of the clip.
// Marks fire gameplay/fx hooks: hide:<part> show:<part> cellOut cellIn shellIn eject release swingStart swingEnd hit seat + free names
// that are re-emitted on the bus as 'viewmodel:mark' (magrelease, magin, boltback, boltfwd, pumpback, pumpfwd, pinpull, ...).
import { clip } from './anim.js';

const Z6 = [0, 0, 0, 0, 0, 0];
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub6 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2], (a[3] || 0) - (b[3] || 0), (a[4] || 0) - (b[4] || 0), (a[5] || 0) - (b[5] || 0)];

/** Common clips shared by every tagger (draw / holster / empty / inspect). */
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

// ------------------------------------------------------------------------------------------------ hand path helper
/**
 * Build hand + attached-cell tracks from ABSOLUTE rig-space keys.
 * keys: [{u, p:[x,y,z] cm, r:[rx,ry,rz] deg, e, c:curlDelta, a:bool}] (a = the cell part travels with the hand at this key).
 */
function handPath(spec, keys, cell) {
  const lh = [], lc = [], cp = [];
  for (const k of keys) {
    const p = k.p || spec.p, r = k.r || spec.r;
    lh.push([k.u, sub6([...p, ...r], [...spec.p, ...spec.r]), k.e]);
    lc.push([k.u, k.c ?? 0, k.e]);
    if (cell) cp.push([k.u, k.a ? [p[0] + cell.hold[0] - cell.cp[0], p[1] + cell.hold[1] - cell.cp[1], p[2] + cell.hold[2] - cell.cp[2], 0, 0, 0] : Z6, k.e]);
  }
  return { lh, lc, cell: cp };
}
const track = (arr) => arr.map((a) => [a[0], a[1], a[2]]);

// Per-weapon data needed to author the reloads (model-space cm).
const MAG = {
  //        cell pivot         hand->cell pivot   extraction dir (unit-ish)   hip pouch (hand pos)     tilt (w) at the bench      slack
  zip:  { cp: [0, 4.5, -8],   hold: [0, 4.6, 4.2],  out: [0, -1, -0.12], dist: 15, hip: [-9, -23, 4] },
  hum:  { cp: [0, 4.5, -9],   hold: [0, 4.6, 4.2],  out: [0, -1, -0.12], dist: 16, hip: [-9, -23, 4] },
  arc:  { cp: [0, 3.6, -8.4], hold: [0, 5.0, 4.2],  out: [0, -1, -0.34], dist: 22, hip: [-9, -26, 2] },
  rail: { cp: [0, 3.4, -6],   hold: [0, 5.0, 4.2],  out: [0, -1, -0.12], dist: 17, hip: [-9, -24, 4] },
  halo: { cp: [0, 4.2, -8.5], hold: [0, 5.0, 4.2],  out: [0, -1, -0.12], dist: 17, hip: [-9, -24, 4] },
  lance: { cp: [0, 4.6, -8.4], hold: [0, 4.5, 4.2], out: [0, -1, -0.1], dist: 14, hip: [-9, -23, 4] },
};

function rifleReload(id, meta, prof) {
  const m = MAG[id], hl = meta.hands.l, G = [m.cp[0] - m.hold[0], m.cp[1] - m.hold[1], m.cp[2] - m.hold[2]];
  const out = (f) => add3(G, m.out, m.dist * f), GR = [-92, 0, 0], REST_R = hl.r;
  const heavyAdj = id === 'lance' ? 1.0 : 1;
  const keys = [
    { u: 0, p: hl.p, r: REST_R },
    { u: 0.10, p: add3(G, [0, 1.5, -6]), r: [-60, 0, 90], e: 'io', c: -0.45 },
    { u: 0.20, p: G, r: GR, e: 'out', c: 0.25 },
    { u: 0.22, p: G, r: GR, c: 0.25, a: true },
    { u: 0.31, p: out(0.9), r: [-92, 0, 12], e: 'io3', c: 0.25, a: true },
    { u: 0.37, p: add3(out(1.15), [-3, -2, 2]), r: [-80, 0, 30], e: 'out', c: 0.1, a: true },
    { u: 0.43, p: add3(m.hip, [0, 0, -2]), r: [-50, 0, 60], e: 'io', c: -0.4 },
    { u: 0.47, p: m.hip, r: [-60, 0, 40], e: 'io', c: 0.35, a: true },
    { u: 0.52, p: out(0.55), r: [-80, 0, 20], e: 'io', c: 0.3, a: true },
    { u: 0.555, p: G, r: GR, e: 'out', c: 0.25, a: true },
    { u: 0.60, p: add3(G, [0, 1.0, 0.4]), r: GR, e: 'out', c: 0.1 },
    { u: 0.66, p: G, r: GR, e: 'io', c: 0.0 },
    { u: 0.84, p: hl.p, r: REST_R, e: 'io3', c: 0 },
  ];
  const H = handPath(hl, keys, m);
  const T = heavyAdj;
  return clip(prof.reload, {
    w: [[0, Z6], [0.10, [-2.2, 2.2, 0.6, 14, 9, -13], 'out'], [0.30, [-3, 2.8, 1, 17, 12, -19], 'io'], [0.47, [-2.7, 2.6, 1, 16, 10, -16], 'io'], [0.54, [-2.4, 2.4, 0.8, 15, 9.5, -15], 'io'],
        [0.57, [-2.3, 2.0, 1.4, 12.5, 9.5, -15], 'out'], [0.65, [-2.4, 2.4, 0.8, 14, 9, -14], 'io'], [0.86, [-0.6, 0.6, 0.3, 3, 2, -3], 'io3'], [0.93, [0, 0.3, -0.5, -0.8, 0, 0.6], 'out'], [1, Z6, 'io'], ].map((k) => [k[0], k[1].map((v) => v * T), k[2]]),
    lh: track(H.lh), lc: track(H.lc), cell: track(H.cell),
    handle: id === 'arc' || id === 'rail' || id === 'halo' || id === 'hum' || id === 'zip' || id === 'lance' ? [[0, Z6], [0.82, Z6], [0.87, [0, 0, 3.6, 0, 0, 0], 'out'], [0.93, Z6, 'in'], [1, Z6]] : undefined,
    bolt: id === 'lance' ? [[0, Z6], [0.82, Z6], [0.88, [0, 0.8, 5.5, 0, 0, 0], 'out'], [0.95, Z6, 'in'], [1, Z6]] : undefined,
  }, [[0.21, 'magrelease'], [0.37, 'cellOut'], [0.375, 'hide:cell'], [0.47, 'show:cell'], [0.47, 'cellIn'], [0.555, 'magin'], [0.57, 'seat'], [0.88, 'boltrelease']].filter(Boolean));
}

function pistolReload(id, meta, prof) {
  const hl = meta.hands.l, cp = [0, -3, 2], hold = [0, 9.6, -0.2], G = [cp[0] - hold[0], cp[1] - hold[1], cp[2] - hold[2]];
  const REST_R = hl.r, CR = [-4, 0, 180], hip = [-8, -24, 6], down = (f) => add3(G, [0, -1, -0.1], 12 * f);
  const keys = [
    { u: 0, p: hl.p, r: REST_R },
    { u: 0.12, p: add3(G, [-1.5, -5, 2]), r: [-20, 0, 150], e: 'io', c: -0.4 },
    { u: 0.22, p: G, r: CR, e: 'out', c: -0.2 },
    { u: 0.24, p: G, r: CR, c: 0.0, a: true },
    { u: 0.34, p: down(1.0), r: CR, e: 'io3', c: 0.1, a: true },
    { u: 0.40, p: add3(down(1.1), [-2, -3, 2]), r: [-40, 0, 140], e: 'out', c: 0.1, a: true },
    { u: 0.46, p: add3(hip, [0, 0, -2]), r: [-50, 0, 120], e: 'io', c: -0.4 },
    { u: 0.50, p: hip, r: [-30, 0, 160], e: 'io', c: 0.3, a: true },
    { u: 0.55, p: down(0.5), r: CR, e: 'io', c: 0.2, a: true },
    { u: 0.60, p: G, r: CR, e: 'out', c: 0.1, a: true },
    { u: 0.66, p: add3(G, [0, 0.6, 0]), r: CR, e: 'out', c: 0.0 },
    { u: 0.84, p: hl.p, r: REST_R, e: 'io3', c: 0 },
  ];
  const H = handPath(hl, keys, { cp, hold });
  return clip(prof.reload, {
    w: [[0, Z6], [0.12, [-1.5, 0.5, 2.5, 14, 4, -16], 'out'], [0.34, [-1.8, 0.8, 3, 17, 6, -22], 'io'], [0.52, [-1.6, 0.6, 3, 15, 5, -18], 'io'], [0.60, [-1.4, 0.4, 2.6, 13, 4, -15], 'io'],
        [0.63, [-1.3, -0.4, 3.3, 10.5, 4, -15], 'out'], [0.72, [-1.2, 0.2, 2.4, 11, 3, -13], 'io'], [0.88, [-0.3, 0, 0.6, 2.5, 0.8, -3], 'io3'], [0.94, [0, 0.2, -0.4, -0.8, 0, 0.5], 'out'], [1, Z6, 'io']],
    lh: track(H.lh), lc: track(H.lc), cell: track(H.cell),
    slide: [[0, Z6], [0.74, Z6], [0.78, [0, 0, 3.4, 0, 0, 0], 'out'], [0.84, Z6, 'in'], [1, Z6]],
    trigger: [[0, Z6]],
  }, [[0.23, 'magrelease'], [0.41, 'cellOut'], [0.415, 'hide:cell'], [0.50, 'show:cell'], [0.50, 'cellIn'], [0.60, 'magin'], [0.62, 'seat'], [0.76, 'boltback'], [0.83, 'boltfwd']]);
}

function revolverReload(id, meta, prof) {
  const hl = meta.hands.l, REST_R = hl.r, cylP = [-9, 3.5, 0], hip = [-8, -22, 6];
  const keys = [
    { u: 0, p: hl.p, r: REST_R },
    { u: 0.10, p: add3(cylP, [-2, -4, 2]), r: [-20, 0, 120], e: 'io', c: -0.35 },
    { u: 0.18, p: cylP, r: [-10, 0, 100], e: 'out', c: 0.05 },
    { u: 0.34, p: add3(cylP, [-1.5, 0.5, 0]), r: [-30, 0, 95], e: 'io', c: 0.1 },
    { u: 0.40, p: add3(cylP, [-2.2, 1.2, 0]), r: [-45, 0, 95], e: 'io', c: -0.3 },
    { u: 0.48, p: hip, r: [-30, 0, 120], e: 'io', c: -0.3 },
    { u: 0.54, p: add3(hip, [0, 1, 0]), r: [-30, 0, 120], e: 'out', c: 0.35 },
    { u: 0.66, p: add3(cylP, [-1.5, -3.5, 2]), r: [-30, 0, 115], e: 'io', c: 0.3 },
    { u: 0.72, p: add3(cylP, [-0.5, -1.5, 0.5]), r: [-15, 0, 105], e: 'out', c: 0.2 },
    { u: 0.80, p: add3(cylP, [-2, -2, 1]), r: [-10, 0, 100], e: 'io', c: -0.1 },
    { u: 0.92, p: hl.p, r: REST_R, e: 'io3', c: 0 },
  ];
  const H = handPath(hl, keys, null);
  return clip(prof.reload, {
    w: [[0, Z6], [0.12, [-1.2, 0.5, 1, 8, 3, -12], 'out'], [0.40, [-1.6, 1.0, 1.5, 12, 4, -17], 'io'], [0.54, [-1.6, 1.0, 1.5, 12, 5, -17], 'io'], [0.72, [-1.4, 0.4, 1.3, 9, 4, -14], 'io'],
        [0.78, [-1.2, -0.3, 1.8, 7, 4, -13], 'out'], [0.90, [-0.3, 0, 0.6, 2.5, 0.8, -3], 'io3'], [0.96, [0, 0.2, -0.3, -0.6, 0, 0.4], 'out'], [1, Z6, 'io']],
    lh: track(H.lh), lc: track(H.lc),
    cyl: [[0, Z6], [0.14, Z6], [0.22, [-6.0, -1.5, 1.5, 0, 22, -4], 'out3'], [0.70, [-6.0, -1.5, 1.5, 0, 22, -4], 'io'], [0.77, [-6.0, -1.5, 1.5, 0, 22, 100], 'io'], [0.84, [-1.0, -0.2, 0.2, 0, 4, 360], 'io3'], [0.88, [0, 0, 0, 0, 0, 360], 'out'], [1, [0, 0, 0, 0, 0, 360]]],
    hammer: [[0, Z6], [0.82, Z6], [0.86, [0, 0, 0, -18, 0, 0], 'out'], [0.90, Z6, 'in'], [1, Z6]],
  }, [[0.20, 'cylopen'], [0.40, 'cellOut'], [0.425, 'cellOut'], [0.45, 'cellOut'], [0.54, 'cellIn'], [0.64, 'magin'], [0.70, 'shellsIn'], [0.86, 'cylclose'], [0.87, 'seat']]);
}

function shellReload(meta, prof) {
  const hl = meta.hands.l, REST_R = hl.r, port = [-0.4, 0.6, -5], hip = [-9, -17, 6], cp = [0, 5, -18], hold = [0, 2.2, -0.2];
  return function shellClip(n) {
    const start = 0.45, each = 0.5, end = 0.4, D = start + each * n + end, U = (t) => t / D;
    const keys = [{ u: 0, p: hl.p, r: REST_R }, { u: U(start * 0.55), p: add3(port, [-2.5, -3, 0]), r: [-40, 0, 110], e: 'io', c: -0.2 }];
    const wk = [[0, Z6], [U(start * 0.6), [-1.2, -0.6, 2, 8, 6, -18], 'out']];
    const marks = [];
    for (let i = 0; i < n; i++) {
      const t0 = start + i * each;
      keys.push({ u: U(t0 + 0.10), p: add3(port, [-2, -4, 2]), r: [-40, 0, 110], e: 'io', c: 0.25 });
      keys.push({ u: U(t0 + 0.20), p: hip, r: [-30, 0, 120], e: 'io', c: -0.3 });
      keys.push({ u: U(t0 + 0.24), p: hip, r: [-30, 0, 120], e: 'in', c: 0.35, a: true });
      keys.push({ u: U(t0 + 0.42), p: port, r: [-50, 0, 105], e: 'out', c: 0.3, a: true });
      keys.push({ u: U(t0 + 0.47), p: add3(port, [0.5, 0.4, 0.5]), r: [-50, 0, 105], e: 'out', c: 0.15 });
      marks.push([U(t0 + 0.24), 'show:cell'], [U(t0 + 0.45), 'shellIn'], [U(t0 + 0.455), 'hide:cell']);
      wk.push([U(t0 + 0.44), [-1.2, -0.8, 2, 8, 6, -18], 'io'], [U(t0 + 0.47), [-1.1, -1.2, 2.6, 6.5, 6, -18], 'out'], [U(t0 + 0.5), [-1.2, -0.6, 2, 8, 6, -18], 'io']);
    }
    const te = start + each * n;
    keys.push({ u: U(te + 0.12), p: add3(hl.p, [0, 0.5, 2]), r: REST_R, e: 'io', c: 0 }, { u: 1, p: hl.p, r: REST_R, e: 'out', c: 0 });
    wk.push([U(te + 0.14), [-0.8, -0.3, 1.2, 3, 2, -6], 'io'], [U(te + end - 0.05), [0, 0.2, -0.4, -0.5, 0, 0.5], 'out'], [1, Z6, 'io']);
    const H = handPath(hl, keys, { cp, hold });
    const pumpU = [[0, Z6], [U(te + 0.1), Z6], [U(te + 0.2), [0, 0, 9, 0, 0, 0], 'out'], [U(te + 0.3), Z6, 'in'], [1, Z6]];
    // keys must be time-ordered
    const sorted = (a) => a.slice().sort((x, y) => x[0] - y[0]);
    marks.push([U(te + 0.2), 'pumpback'], [U(te + 0.3), 'pumpfwd']);
    return clip(D, { w: sorted(wk), lh: sorted(track(H.lh)), lc: sorted(track(H.lc)), cell: sorted(track(H.cell)), pump: pumpU }, marks, {});
  };
}

function drumReload(id, meta, prof) {
  const hl = meta.hands.l, REST_R = hl.r, cp = [0, -3, -8], hold = [0, 4, 3.5], G = [cp[0] - hold[0], cp[1] - hold[1], cp[2] - hold[2]], hip = [-9, -26, 4], lidTop = [0, 17, 0];
  const keys = [
    { u: 0, p: hl.p, r: REST_R },
    { u: 0.10, p: add3(lidTop, [0, 2, -10]), r: [0, 0, 0], e: 'io', c: -0.3 },
    { u: 0.16, p: add3(lidTop, [0, 1, 0]), r: [0, 0, 0], e: 'out', c: 0.2 },
    { u: 0.26, p: add3(lidTop, [0, 8, 10]), r: [-30, 0, 0], e: 'io', c: 0.2 },
    { u: 0.32, p: add3(G, [0, 2, 0]), r: [-92, 0, 0], e: 'io', c: -0.3 },
    { u: 0.36, p: G, r: [-92, 0, 0], e: 'out', c: 0.25 },
    { u: 0.38, p: G, r: [-92, 0, 0], c: 0.25, a: true },
    { u: 0.44, p: add3(G, [-2, -14, 2]), r: [-80, 0, 20], e: 'io3', c: 0.25, a: true },
    { u: 0.48, p: add3(hip, [0, 0, -2]), r: [-50, 0, 60], e: 'io', c: -0.4, a: true },
    { u: 0.50, p: hip, r: [-60, 0, 40], e: 'io', c: 0.35, a: true },
    { u: 0.55, p: G, r: [-92, 0, 0], e: 'io', c: 0.25, a: true },
    { u: 0.62, p: add3(G, [0, 4, 0]), r: [-92, 0, 0], e: 'io', c: 0.1 },
    { u: 0.72, p: add3(lidTop, [0, 3, 6]), r: [-30, 0, 0], e: 'io', c: 0.2 },
    { u: 0.80, p: add3(lidTop, [0, 1, -4]), r: [0, 0, 0], e: 'io', c: 0.25 },
    { u: 0.90, p: hl.p, r: REST_R, e: 'io3', c: 0 },
  ];
  const H = handPath(hl, keys, { cp, hold });
  return clip(prof.reload, {
    w: [[0, Z6], [0.12, [-1.5, -1, 2.5, 8, 8, -12], 'out'], [0.45, [-2, -1.5, 3.5, 10, 12, -18], 'io'], [0.56, [-1.8, -1.2, 3, 8.5, 10, -15], 'io'], [0.59, [-1.6, -2, 3.6, 6, 10, -15], 'out'], [0.76, [-1.5, -1, 2.5, 8, 8, -12], 'io'], [0.84, [-1.2, -1.8, 3.2, 3, 4, -5], 'in'], [0.88, [-0.6, -0.3, 0.8, 1.2, 1.5, -2], 'out'], [1, Z6, 'io']],
    lh: track(H.lh), lc: track(H.lc), drum: track(H.cell),
    lid: [[0, Z6], [0.12, Z6], [0.26, [0, 0, 0, -78, 0, 0], 'out'], [0.72, [0, 0, 0, -78, 0, 0], 'io'], [0.82, [0, 0, 0, 2, 0, 0], 'in3'], [0.86, [0, 0, 0, -2, 0, 0], 'out'], [0.9, Z6, 'io'], [1, Z6]],
  }, [[0.14, 'lidopen'], [0.38, 'magrelease'], [0.45, 'cellOut'], [0.455, 'hide:drum'], [0.50, 'show:drum'], [0.50, 'cellIn'], [0.55, 'magin'], [0.82, 'lidclose'], [0.83, 'seat']]);
}

// ------------------------------------------------------------------------------------------------ cycling actions
function boltClip() {  // lance: raise handle, pull back, eject, push, lower
  return clip(0.85, {
    bolt: [[0, Z6], [0.12, [0.4, 1.0, 0, 0, 0, -38], 'io'], [0.34, [0.4, 1.0, 7.5, 0, 0, -38], 'io3'], [0.40, [0.4, 1.0, 7.5, 0, 0, -38], 'io'], [0.62, [0.4, 1.0, 0, 0, 0, -38], 'io3'], [0.78, Z6, 'out'], [1, Z6]],
    w: [[0, Z6], [0.12, [0.4, 0.2, 0.8, 1.5, -2, -9], 'io'], [0.34, [0.5, 0.2, 1.4, 2.5, -3, -12], 'io'], [0.62, [0.3, 0.1, 0.6, 1.2, -2, -8], 'io'], [0.8, [0, -0.2, 0.4, -0.6, 0.4, 0.4], 'out'], [1, Z6, 'io']],
    rh: [[0, Z6], [0.12, [0.4, 1.0, 0.4, 0, 0, -10], 'io'], [0.34, [0.5, 1.2, 6.8, 0, 0, -10], 'io3'], [0.62, [0.4, 1.0, 0.4, 0, 0, -10], 'io3'], [0.78, Z6, 'out']],
    rc: [[0, 0], [0.12, 0.3], [0.8, 0.3], [1, 0]],
  }, [[0.12, 'boltup'], [0.34, 'boltback'], [0.36, 'eject'], [0.62, 'boltfwd'], [0.8, 'boltdown']]);
}
function pumpClip(hl) {
  return clip(0.46, {
    pump: [[0, Z6], [0.34, [0, 0, 9.5, 0, 0, 0], 'out'], [0.42, [0, 0, 9.5, 0, 0, 0], 'io'], [0.82, Z6, 'io3'], [1, Z6]],
    lh: [[0, Z6], [0.34, [0, 0, 9.5, 0, 0, 0], 'out'], [0.42, [0, 0, 9.5, 0, 0, 0], 'io'], [0.82, Z6, 'io3'], [1, Z6]],
    w: [[0, Z6], [0.3, [0, 0.2, 1.2, 1.6, 0, 0], 'out'], [0.82, [0, -0.2, -0.4, -0.5, 0, 0], 'io'], [1, Z6, 'io']],
    lc: [[0, 0], [0.34, 0.1], [1, 0]],
  }, [[0.3, 'pumpback'], [0.34, 'eject'], [0.82, 'pumpfwd']]);
}

// ------------------------------------------------------------------------------------------------ melee (tap)
function meleeClips(prof) {
  const C = {};
  C.melee1 = clip(0.42, {
    w: [[0, Z6], [0.15, [6, 3, 4, 14, -22, 22], 'out'], [0.40, [-20, -9, -8, -26, 44, -40], 'in'], [0.52, [-21, -9.5, -9, -28, 48, -43], 'out'], [0.80, [-7, -3, -3, -10, 18, -16], 'io'], [1, Z6, 'io']],
    rc: [[0, 0], [0.4, 0.12], [1, 0]],
  }, [[0.12, 'swingStart'], [0.40, 'hit'], [0.62, 'swingEnd']]);
  C.melee2 = clip(0.42, {
    w: [[0, Z6], [0.15, [-12, -1, 2, 8, 40, -26], 'out'], [0.40, [18, -8, -8, -26, -40, 46], 'in'], [0.52, [19, -8.5, -9, -28, -44, 50], 'out'], [0.80, [6, -3, -3, -10, -16, 18], 'io'], [1, Z6, 'io']],
    rc: [[0, 0], [0.4, 0.12], [1, 0]],
  }, [[0.12, 'swingStart'], [0.40, 'hit'], [0.62, 'swingEnd']]);
  C.stab = clip(0.9, {
    w: [[0, Z6], [0.28, [4, -1.5, 10, 20, -6, 12], 'out'], [0.36, [4, -1.5, 10, 20, -6, 12], 'io'], [0.46, [-2, 2, -18, -10, 0, -3], 'in3'], [0.56, [-2.5, 2.2, -20, -11, 0, -3], 'out'], [0.84, [-1, 0.5, -5, -2, 0, -1], 'io'], [1, Z6, 'io']],
    rc: [[0, 0], [0.45, 0.1], [1, 0]],
  }, [[0.30, 'swingStart'], [0.46, 'hit'], [0.7, 'swingEnd']]);
  C.bash = C.melee1;
  return C;
}

// ------------------------------------------------------------------------------------------------ grenades
function throwClips(meta) {
  const pinTrack = [[0, Z6], [0.2, Z6], [0.34, [3.2, 1.0, 0.6, 0, 0, -20], 'out'], [0.5, [7, -6, 1, 0, 0, -60], 'in'], [1, [7, -6, 1, 0, 0, -60]]];
  const C = {};
  // wind-up used by the staged API (hold until release)
  C.throwWind = clip(0.5, {
    w: [[0, Z6], [0.3, [2, 1, 4, 6, -4, -6], 'out'], [0.7, [-1, 2, 8, 8, 4, -8], 'io'], [1, [-0.5, 2, 8, 8, 4, -8], 'out']],
    lh: [[0, Z6], [0.20, [-1, 8, -1, -10, 18, 20], 'io'], [0.38, [10, 6, 0.5, 0, 0, 0], 'out'], [0.50, [10, 6, 0.5, 0, 0, 0], 'io'], [0.75, [4, -6, 4, 0, 0, 0], 'io'], [1, [0, -14, 8, 0, 0, 0]]],
    lc: [[0, 0], [0.3, -0.2], [0.4, 0.4], [1, 0.1]], rc: [[0, 0], [1, 0.05]],
    pin: pinTrack,
  }, [[0.4, 'pinpull'], [0.42, 'hide:pin']]);
  const swing = (lob) => clip(lob ? 0.62 : 0.5, lob ? {
    w: [[0, [-0.5, 2, 8, 8, 4, -8]], [0.2, [-1, -3, 6, 14, 3, -5], 'io'], [0.45, [-3, -5, -8, -12, 3, 5], 'in'], [0.7, [-3.5, -5, -10, -14, 4, 5], 'out'], [1, Z6, 'io']],
    rc: [[0, 0.05], [0.42, 0.05], [0.5, -0.7, 'out'], [1, 0, 'io']], lh: [[0, [0, -14, 8, 0, 0, 0]], [0.5, [-8, -22, 8, 0, 0, 0], 'io'], [1, Z6, 'io']], lc: [[0, 0.1], [1, 0]],
  } : {
    w: [[0, [-0.5, 2, 8, 8, 4, -8]], [0.18, [0, 3, 9, 12, 5, -10], 'io'], [0.40, [-5, -3, -12, -14, 0, 6], 'in3'], [0.62, [-5.5, -4, -14, -16, 0, 6], 'out'], [1, Z6, 'io']],
    rc: [[0, 0.05], [0.36, 0.05], [0.44, -0.7, 'out'], [1, 0, 'io']], lh: [[0, [0, -14, 8, 0, 0, 0]], [0.5, [-8, -22, 8, 0, 0, 0], 'io'], [1, Z6, 'io']], lc: [[0, 0.1], [1, 0]],
  }, [[lob ? 0.46 : 0.41, 'release']]);
  C.throwRel = swing(false); C.throwLob = swing(true);
  // single-shot full throw (event without stages): pin pull -> cock -> swing, release at u = 0.5
  const full = (lob) => clip(1.0, {
    w: [[0, Z6], [0.14, [2, 1, 4, 6, -4, -6], 'out'], [0.34, [-1, 2, 8, 8, 4, -8], 'io'], lob ? [0.62, [-3, -5, -8, -12, 3, 5], 'in'] : [0.6, [-5, -3, -12, -14, 0, 6], 'in3'], [0.82, lob ? [-3.5, -5, -10, -14, 4, 5] : [-5.5, -4, -14, -16, 0, 6], 'out'], [1, Z6, 'io']],
    lh: [[0, Z6], [0.10, [-1, 8, -1, -10, 18, 20], 'io'], [0.2, [10, 6, 0.5, 0, 0, 0], 'out'], [0.3, [10, 6, 0.5, 0, 0, 0], 'io'], [0.5, [4, -10, 4, 0, 0, 0], 'io'], [0.8, [-8, -22, 8, 0, 0, 0], 'io'], [1, Z6, 'io']],
    lc: [[0, 0], [0.14, -0.2], [0.22, 0.4], [1, 0]],
    rc: [[0, 0], [0.34, 0.05], [0.58, 0.05], [0.64, -0.7, 'out'], [1, 0, 'io']],
    pin: [[0, Z6], [0.16, Z6], [0.24, [3.2, 1.0, 0.6, 0, 0, -20], 'out'], [0.34, [7, -6, 1, 0, 0, -60], 'in'], [1, [7, -6, 1, 0, 0, -60]]],
  }, [[0.22, 'pinpull'], [0.24, 'hide:pin'], [lob ? 0.63 : 0.58, 'release']]);
  C.throwFull = full(false); C.throwFullLob = full(true);
  return C;
}

// ------------------------------------------------------------------------------------------------ gear
function plantClips(meta, id) {
  const C = {};
  if (id === 'beacon') {
    C.plant = clip(1.5, {
      w: [[0, Z6], [0.18, [-1, -10, -5, 34, 0, 0], 'out3'], [0.34, [-1, -11, -7, 38, 0, 0], 'io'], [0.5, [-1, -10, -6, 34, 0, 0], 'io'], [0.67, [-1, -11, -7, 38, 0, 0], 'io'], [0.84, [-1, -10, -6, 34, 0, 0], 'io'], [1, [-1, -11, -7, 38, 0, 0], 'io']],
      antenna: [[0, Z6], [0.2, [0, 0, 0, 0, 0, 0]], [0.5, [0, 2.5, 0, 0, 0, 0], 'out'], [1, [0, 5, 0, 0, 0, 0], 'io']],
      rh: [[0, Z6], [0.2, Z6], [0.3, [0, -0.8, -0.5, 0, 0, 0], 'out'], [0.4, Z6, 'io'], [0.58, [0, -0.8, -0.5, 0, 0, 0], 'out'], [0.68, Z6, 'io'], [0.84, [0, -0.8, -0.5, 0, 0, 0], 'out'], [1, Z6, 'io']],
    }, [], { loopFrom: 0.2 });
    C.disarm = C.plant; C.plantEnd = clip(0.35, { w: [[0, [-1, -10, -6, 34, 0, 0]], [0.5, [0.4, 1.5, 1, -4, 0, 0], 'out'], [1, Z6, 'io']] }, [[0.1, 'plantEnd']]);
  } else if (id === 'kit') {
    C.plant = clip(1.2, {
      w: [[0, Z6], [0.2, [-2, -6, -8, 20, 8, 6], 'out3'], [0.34, [-2, -6, -7, 22, 8, 6], 'io'], [0.6, [-2, -6, -8, 20, 8, 6], 'io'], [1, [-2, -6, -7, 22, 8, 6], 'io']],
      probe: [[0, Z6], [0.2, Z6], [0.4, [0, 0, -6, 0, 0, 0], 'out'], [0.55, [0, 0, -4.5, 0, 0, 12], 'io'], [0.7, [0, 0, -6, 0, 0, -12], 'io'], [0.85, [0, 0, -4.5, 0, 0, 12], 'io'], [1, [0, 0, -6, 0, 0, 0], 'io']],
      lh: [[0, Z6], [0.2, [8, 9, -4, 0, 0, 0], 'io'], [0.34, [9, 8, -4, 0, 0, 0], 'out'], [0.5, [8, 9, -4.5, 0, 0, 0], 'io'], [0.7, [9, 8, -4, 0, 0, 0], 'io'], [1, [8, 9, -4.5, 0, 0, 0], 'io']],
      lc: [[0, 0], [0.2, 0.15], [1, 0.15]],
    }, [], { loopFrom: 0.2 });
    C.disarm = C.plant; C.plantEnd = clip(0.35, { w: [[0, [-2, -6, -7, 22, 8, 6]], [0.5, [0.4, 1.5, 1, -4, 0, 0], 'out'], [1, Z6, 'io']] }, [[0.1, 'plantEnd']]);
  }
  return C;
}

/** Build every clip for a tagger. `pivots` (model-space cm) optional. */
export function clipsFor(id, meta, prof) {
  const C = baseClips(id, meta, prof);
  try {
    if (MAG[id]) C.reload = rifleReload(id, meta, prof);
    else if (id === 'pip' || id === 'twin') C.reload = pistolReload(id, meta, prof);
    else if (id === 'judge') C.reload = revolverReload(id, meta, prof);
    else if (id === 'storm') C.reload = drumReload(id, meta, prof);
    else if (id === 'scatter') C.reloadShell = shellReload(meta, prof);
    if (id === 'lance') C.bolt = boltClip();
    if (id === 'scatter') C.pump = pumpClip(meta.hands.l);
    if (id === 'tap') Object.assign(C, meleeClips(prof));
    if (meta.cls === 'grenade') Object.assign(C, throwClips(meta));
    if (id === 'beacon' || id === 'kit') Object.assign(C, plantClips(meta, id));
  } catch (e) { console.error('[viewmodel] clips failed for', id, e); }
  return C;
}
