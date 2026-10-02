// Sidearms: pip (default pistol), twin (burst pistol), judge (heavy revolver). Coordinates in cm, grip at origin, barrel -Z.

const RAKE = 10;                       // grip rake, degrees (bottom leans back)
const gz = (y, z0 = 0.55) => z0 + ((4 - y) / 14.5) * 2.6;   // centre-line z of a raked grip at height y

function rakedGrip(b, w = 3.4, mat = 'grip') {
  const m = b.main;
  m.side(mat, 0, w, [[-2.7, 4], [3.8, 4], [6.4, -10.5], [0.1, -10.5]], { bevel: 0.7 });
  // rib grooves on both cheeks
  for (let i = 0; i < 6; i++) { const y = -8.2 + i * 1.75; for (const sx of [-1, 1]) m.box('dark', [sx * (w / 2 + 0.02), y, gz(y)], [0.22, 0.4, 5.2], { rot: [-RAKE, 0, 0] }); }
}
function guard(b, zFront = -6.6) {
  const m = b.main;
  m.box('body', [0, 2.5, zFront], [2.7, 2.4, 0.9], { bevel: 0.3 });
  m.box('body', [0, 1.5, (zFront - 2.6) / 2 + 0.2], [2.7, 0.9, -zFront - 2.4 + 0.2], { bevel: 0.3 });
}


/** shared pistol slide/frame detail: ejection port, front serrations, slide-stop, rail slots, bevelled top rib */
function pistolDetail(m, sl, { z0 = -11.6, z1 = 6.5, y0 = 6.4, y1 = 10.7, hw = 1.65 } = {}) {
  for (const sx of [-1, 1]) {
    sl.box('dark', [sx * (hw + 0.03), (y0 + y1) / 2 + 0.6, z0 + (z1 - z0) * 0.5], [0.2, 1.9, 4.4]);
    sl.box('trim', [sx * (hw + 0.06), (y0 + y1) / 2 + 0.6, z0 + (z1 - z0) * 0.5 + 1.8], [0.2, 1.3, 0.5]);
    for (let i = 0; i < 4; i++) sl.box('dark', [sx * (hw + 0.02), (y0 + y1) / 2 - 0.3, z0 + 1.6 + i * 0.62], [0.2, 2.8, 0.3]);
    m.box('trim', [sx * 1.85, y0 - 0.4, z0 + 9.5], [0.4, 0.7, 2.8], { bevel: 0.12 });
  }
  sl.box('dark', [0, y1 + 0.02, (z0 + z1) / 2], [0.7, 0.14, (z1 - z0) * 0.9]);
  m.box('dark', [0, y0 - 2.4, z0 + 4.2], [2.9, 0.7, 5.2], { bevel: 0.15 });
  for (let i = 0; i < 3; i++) m.box('trim', [0, y0 - 2.75, z0 + 2.4 + i * 1.6], [3.0, 0.12, 0.35]);
}

export function pip(b) {
  const m = b.main, sl = b.part('slide', [0, 7, 0]), cell = b.part('cell', [0, -3, 2]), trig = b.part('trigger', [0, 3.4, -2.6]);
  // frame + rail
  m.box('body', [0, 4.9, -2.4], [3.0, 2.6, 16.4], { bevel: 0.45 });
  m.box('dark', [0, 4.1, -9.0], [2.5, 1.5, 4.0], { bevel: 0.3 });
  guard(b);
  rakedGrip(b);
  m.box('trim', [0, -10.9, 3.6], [3.8, 0.9, 4.9], { bevel: 0.35, rot: [-RAKE, 0, 0] });   // base plate
  m.box('dark', [0, 3.5, 3.9], [2.2, 1.2, 3.6], { bevel: 0.3 });   // beavertail
  // slide
  sl.side('body', 0, 3.3, [[-11.6, 6.4], [-11.6, 9.3], [-10.2, 10.7], [6.5, 10.7], [6.5, 6.4]], { bevel: 0.55 });
  sl.box('trim', [0, 11.3, -10.3], [0.55, 1.3, 1.0], { bevel: 0.15 });
  for (const sx of [-1, 1]) sl.box('trim', [sx * 1.0, 11.25, 5.6], [0.8, 1.3, 1.0], { bevel: 0.15 });
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) sl.box('dark', [sx * 1.67, 8.6, 2.6 + i * 0.7], [0.22, 2.6, 0.32]);
  for (const sx of [-1, 1]) sl.box('glow', [sx * 1.68, 9.6, -3.4], [0.16, 0.55, 11.4]);
  sl.box('glow', [0, 10.76, -3.4], [0.5, 0.06, 11]);
  sl.cyl('trim', [0, 8.0, -12.0], 1.5, 1.7, 1.0, 8);
  sl.cyl('glow', [0, 8.0, -12.55], 0.95, 0.95, 0.3, 8);
  // cell (glass window in the grip cheeks)
  cell.box('glass', [0, -4.0, gz(-4)], [3.95, 9.2, 3.1], { rot: [-RAKE, 0, 0], bevel: 0.25 });
  const segs = [];
  for (let i = 0; i < 5; i++) { const y = -7.6 + i * 1.75; segs.push({ p: [0, y, gz(y)], s: [4.02, 1.3, 2.3], r: [-RAKE, 0, 0] }); }
  b.gauge('cell', segs);
  trig.box('trim', [0, 2.6, -3.0], [0.9, 2.4, 0.8], { bevel: 0.2, rot: [-12, 0, 0] });
  pistolDetail(m, sl);
  return {
    name: 'Pip', cls: 'pistol', skin: { pattern: 'solid', primary: 0x4d5a70, accent: 0x9aa9c2, glow: 0x39f0ff, wear: 0 },
    muzzle: [0, 8.0, -13.6], eject: { p: [1.8, 10, 3], v: [1.6, 1.9, 0.4] }, len: 20,
    hands: { r: { p: [3.5, -2, 1.6], r: [-8, 0, -90], curl: [0.66, 0.7, 0.72, 0.74, 0.45], pose: 'grip' }, l: { p: [-3.5, -3.8, 0.6], r: [-8, 0, 90], curl: [0.62, 0.66, 0.68, 0.7, 0.4], pose: 'support' } },
  };
}

export function twin(b) {
  const m = b.main, sl = b.part('slide', [0, 7, 0]), cell = b.part('cell', [0, -3, 2]), trig = b.part('trigger', [0, 3.4, -2.6]);
  m.box('body', [0, 4.9, -2.6], [4.0, 2.7, 17.4], { bevel: 0.5 });
  m.box('dark', [0, 4.1, -10.0], [3.6, 1.6, 4.6], { bevel: 0.35 });
  guard(b, -7.4);
  rakedGrip(b, 3.9);
  m.box('trim', [0, -10.9, 3.6], [4.3, 0.9, 5.1], { bevel: 0.35, rot: [-RAKE, 0, 0] });
  // slide: wide, flat-topped, two emitter slots
  sl.side('body', 0, 4.6, [[-12.4, 6.4], [-12.4, 9.0], [-10.6, 10.5], [6.6, 10.5], [6.6, 6.4]], { bevel: 0.6 });
  sl.box('trim', [0, 10.55, 1.6], [4.7, 0.5, 11.5], { bevel: 0.2, shade: 1.15 });
  for (const sx of [-1, 1]) {
    sl.cyl('trim', [sx * 1.15, 8.3, -12.6], 1.25, 1.4, 1.2, 8);
    sl.cyl('glow', [sx * 1.15, 8.3, -13.25], 0.8, 0.8, 0.3, 8);
    sl.box('trim', [sx * 1.15, 11.0, -11.2], [0.5, 1.0, 0.8], { bevel: 0.12 });
    sl.box('glow', [sx * 2.32, 9.0, -3.2], [0.16, 0.5, 12]);
    sl.box('glow', [sx * 1.15, 10.82, -1.5], [0.5, 0.06, 13]);
  }
  sl.box('trim', [0, 11.0, 6.0], [2.6, 0.7, 0.9], { bevel: 0.12 });
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) sl.box('dark', [sx * 2.33, 8.4, 2.4 + i * 0.7], [0.22, 2.8, 0.32]);
  cell.box('glass', [0, -4.0, gz(-4)], [4.4, 9.2, 3.4], { rot: [-RAKE, 0, 0], bevel: 0.25 });
  const segs = [];
  for (let i = 0; i < 6; i++) { const y = -8.2 + i * 1.6; for (const sx of [-1, 1]) segs.push({ p: [sx * 0.95, y, gz(y)], s: [1.5, 1.2, 2.6], r: [-RAKE, 0, 0] }); }
  // interleave so lit-count fills both columns evenly
  const inter = []; for (let i = 0; i < 6; i++) { inter.push(segs[i * 2], segs[i * 2 + 1]); }
  b.gauge('cell', inter);
  trig.box('trim', [0, 2.6, -3.4], [0.9, 2.4, 0.8], { bevel: 0.2, rot: [-12, 0, 0] });
  pistolDetail(m, sl);
  return {
    name: 'Twin', cls: 'pistol', skin: { pattern: 'stripes', primary: 0xdfe3ec, accent: 0x8892a8, glow: 0xff4fd8, wear: 0 },
    muzzle: [0, 8.3, -14.2], eject: { p: [2.4, 10, 3], v: [1.6, 1.8, 0.4] }, len: 21, gaugePairs: true,
    hands: { r: { p: [3.8, -2, 1.6], r: [-8, 0, -90], curl: [0.66, 0.7, 0.72, 0.74, 0.45], pose: 'grip' }, l: { p: [-3.8, -3.8, 0.6], r: [-8, 0, 90], curl: [0.62, 0.66, 0.68, 0.7, 0.4], pose: 'support' } },
  };
}

export function judge(b) {
  const m = b.main, cyl = b.part('cyl', [0, 8, -1]), ham = b.part('hammer', [0, 10.5, 5.2]), trig = b.part('trigger', [0, 3.0, -1.6]);
  // frame
  m.side('body', 0, 3.4, [[-3.6, 12], [-3.6, 4.2], [-2, 3.0], [-0.4, 3.6], [1.4, 4.0], [7.6, 3.4], [8.2, 7.6], [6.2, 11.6], [1.6, 12.4]], { bevel: 0.6 });
  // top strap + barrel
  m.box('body', [0, 11.4, -9.0], [2.6, 1.6, 17], { bevel: 0.35 });
  m.cyl('body', [0, 8.0, -15.8], 2.3, 2.15, 21, 8);
  m.box('trim', [0, 10.6, -14.8], [1.2, 0.9, 19], { bevel: 0.2 });                        // rib
  m.box('dark', [0, 5.6, -13.4], [2.2, 3.4, 12.6], { bevel: 0.4 });                        // under-lug
  m.cyl('trim', [0, 8.0, -26.4], 2.65, 2.65, 1.6, 8);
  m.cyl('glow', [0, 8.0, -27.3], 1.35, 1.35, 0.4, 8);
  m.box('trim', [0, 11.5, -25.6], [0.7, 1.4, 1.1], { bevel: 0.15 });
  guard(b, -7.0); m.box('body', [0, 1.5, -2.6], [2.8, 0.9, 6.6], { bevel: 0.3 });
  // grip (chunky, warm)
  m.side('grip', 0, 3.6, [[-2.2, 4.4], [3.6, 4.4], [8.6, -9.5], [3.0, -10.5], [-0.4, -6]], { bevel: 0.7 });
  m.box('trim', [0, -10.3, 6.0], [3.8, 0.9, 4.9], { bevel: 0.3, rot: [-16, 0, 0] });
  // cylinder: 6 chambers, glowing
  cyl.cyl('body', [0, 8.0, -1.0], 3.7, 3.7, 7.6, 12, { shade: 1.05 });
  cyl.cyl('trim', [0, 8.0, -4.9], 3.9, 3.9, 0.5, 12);
  cyl.cyl('trim', [0, 8.0, 2.9], 3.9, 3.9, 0.5, 12);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; cyl.cyl('glow', [Math.cos(a) * 2.35, 8 + Math.sin(a) * 2.35, -5.3], 0.85, 0.85, 0.3, 6); }
  const segs = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; segs.push({ p: [Math.cos(a) * 3.45, 8 + Math.sin(a) * 3.45, -1.0], s: [1.1, 1.1, 5.2], r: [0, 0, (a * 180) / Math.PI] }); }
  b.gauge('cyl', segs);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; cyl.box('dark', [Math.cos(a) * 3.65, 8 + Math.sin(a) * 3.65, -1.0], [0.5, 0.5, 6.2], { rot: [0, 0, (a * 180) / Math.PI] }); }
  // hammer
  ham.box('trim', [0, 12.4, 6.4], [1.1, 2.4, 1.6], { bevel: 0.25, rot: [24, 0, 0] });
  ham.box('dark', [0, 13.6, 7.3], [1.5, 0.7, 2.4], { bevel: 0.2, rot: [24, 0, 0] });
  trig.box('trim', [0, 2.3, -1.9], [0.9, 2.8, 0.8], { bevel: 0.2, rot: [-12, 0, 0] });
  m.box('dark', [0, 12.4, 1.6], [2.0, 0.6, 3.4]);  // rear sight
  return {
    name: 'Judge', cls: 'pistol', skin: { pattern: 'solid', primary: 0x8c5a2e, accent: 0xd9a25c, glow: 0xffa62b, wear: 0.15 },
    muzzle: [0, 8.0, -28.4], eject: null, len: 36, heavy: true,
    hands: { r: { p: [3.7, -2, 3.2], r: [-12, 0, -90], curl: [0.66, 0.7, 0.72, 0.74, 0.45], pose: 'grip' }, l: { p: [-3.7, -3.8, 2.2], r: [-12, 0, 90], curl: [0.62, 0.66, 0.68, 0.7, 0.4], pose: 'support' } },
  };
}
