// SMGs, rifles, sniper, shotgun, heavy. cm, grip at origin, barrel toward -Z.
import { pgrip, tguard, teeth, vents, strips, emitter, curvedCell, straightCell, panels } from './kit.js';

const RH = (x = 3.4, y = -1, z = 2.4, rake = 14) => ({ p: [x, y, z], r: [-rake * 0.6, 0, -90], curl: [0.66, 0.7, 0.72, 0.74, 0.45], pose: 'grip' });
const LH_UNDER = (z, y = 1, x = -0.6, curl = [0.6, 0.62, 0.64, 0.66, 0.4]) => ({ p: [x, y, z], r: [0, 0, 180], curl, pose: 'under' });

export function zip(b) {
  const m = b.main, cell = b.part('cell', [0, 4.5, -8]), hnd = b.part('handle', [0, 12, 5]);
  m.box('body', [0, 8.6, -3], [4.6, 8.4, 26], { bevel: 0.7 });
  m.box('dark', [0, 13.3, -3], [3.4, 1.2, 22], { bevel: 0.3 });
  teeth(m, 'dark', 0, 14.2, -12, 6, 2.2, 1.4);
  m.box('dark', [0, 9.2, -20.5], [5.0, 6.6, 15], { bevel: 0.6 });
  m.box('body', [0, 9.2, -20.5], [4.6, 7.0, 13], { bevel: 0.5, shade: 1.05 });
  vents(m, -15.5, -26, 9.4, 2.5, 5, 3.6);
  strips(m, -12, 4, 10.4, 2.32, 0.5);
  m.cyl('dark', [0, 9.2, -30], 1.2, 1.2, 4, 8);
  m.cyl('trim', [0, 9.2, -33.2], 1.7, 1.5, 3.2, 8);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; m.box('dark', [Math.cos(a) * 1.7, 9.2 + Math.sin(a) * 1.7, -34.2], [0.5, 0.5, 2.4]); }
  m.cyl('glow', [0, 9.2, -35], 0.8, 0.8, 0.3, 8);
  m.box('trim', [0, 14.6, -27], [0.6, 2.4, 0.8], { bevel: 0.15 });
  m.box('trim', [0, 14.9, 8], [2.4, 1.6, 1.0], { bevel: 0.2 });
  pgrip(b, { zf: -2.2, zr: 3.4, rake: 14 }); tguard(b, -7, -1.4, 3);
  m.box('body', [0, 5.4, -8], [4.4, 3.2, 6.4], { bevel: 0.4 });                         // mag well
  m.box('grip', [0, 1.6, -19.5], [3.0, 8, 3.4], { bevel: 0.6 });                        // vertical foregrip
  m.box('trim', [0, -2.6, -19.5], [3.4, 0.8, 3.8], { bevel: 0.3 });
  // folded wire stock
  for (const y of [11.2, 5]) m.box('dark', [0, y, 17], [0.9, 0.9, 20], { bevel: 0.2 });
  m.box('dark', [0, 8.1, 27.2], [1.0, 7.2, 1.6], { bevel: 0.25 }); m.box('rubber', [0, 8.1, 28.4], [3, 8.4, 1.4], { bevel: 0.5 });
  m.box('dark', [0, 8.1, 8.8], [3.6, 7.6, 1.4], { bevel: 0.3 });
  straightCell(b, 'cell', [0, 4.5, -8], { h: 14, w: 3.7, d: 4.6, tilt: 5, gauge: 8 });
  hnd.box('trim', [3.1, 11.4, 4.4], [1.4, 1.5, 3.6], { bevel: 0.3 }); hnd.box('dark', [3.9, 11.4, 6], [1.0, 2.0, 1.6], { bevel: 0.25 });
  panels(m, { xh: 2.3, z0: -16, z1: 10, y0: 4.4, y1: 12.8 });
  return {
    name: 'Zip', cls: 'smg', skin: { pattern: 'solid', primary: 0x2f3744, accent: 0x7d8aa0, glow: 0x7dff4a, wear: 0.1 },
    muzzle: [0, 9.2, -36.5], eject: { p: [2.6, 12, 0], v: [1.8, 1.7, 0.2] }, len: 56, cellSize: [0.04, 0.14, 0.05], ejectSize: 0.9,
    fire: { handle: { kick: [0, 0, 2.2, 0, 0, 0], k: 900, c: 36 } },
    hands: { r: RH(3.5, -1, 2.0, 14), l: LH_UNDER(-19.5, 1.4, -0.3) },
  };
}

export function hum(b) {
  const m = b.main, hnd = b.part('handle', [0, 12, 4]), coil = b.part('coil', [0, 9, -22]);
  m.box('body', [0, 8.8, -1], [4.6, 8.6, 30], { bevel: 0.8 });
  m.box('dark', [0, 13.6, -1], [3.2, 1.0, 24], { bevel: 0.3 }); teeth(m, 'dark', 0, 14.3, -12, 10, 2.2, 1.4);
  strips(m, -10, 8, 10.6, 2.32, 0.5);
  m.cyl('dark', [0, 9.2, -20], 2.6, 2.6, 17, 8);                                  // resonator core
  m.cyl('dark', [0, 9.2, -33], 1.0, 1.0, 12, 8);
  for (let i = 0; i < 3; i++) { const z = -14 - i * 5.2; coil.cyl('trim', [0, 9.2, z], 3.6, 3.6, 1.6, 8); coil.cyl('glow', [0, 9.2, z], 3.75, 3.75, 0.6, 8); }
  m.cyl('trim', [0, 9.2, -39.5], 1.9, 1.7, 3.4, 8); m.cyl('glow', [0, 9.2, -41.4], 0.9, 0.9, 0.3, 8);
  m.box('trim', [0, 14.7, -33], [0.6, 2.2, 0.8], { bevel: 0.15 }); m.box('trim', [0, 15.1, 8], [2.6, 1.8, 1.0], { bevel: 0.2 });
  pgrip(b, { zf: -2.4, zr: 3.4, rake: 16 }); tguard(b, -8, -1.4, 3);
  m.box('body', [0, 5.4, -9], [4.4, 3.4, 7.4], { bevel: 0.4 });
  // short stock
  m.side('body', 0, 4.4, [[14, 12.5], [27, 11], [28, 2], [26, -1.5], [14, 4]], { bevel: 0.8 });
  m.box('rubber', [0, 6, 28], [4.6, 13.5, 1.6], { bevel: 0.5 });
  curvedCell(b, 'cell', [0, 4.5, -9], { n: 3, len: 5.4, w: 3.8, d: 4.6, phi0: 6, dphi: 12, gauge: 8 });
  hnd.box('trim', [3.1, 11.4, 2], [1.4, 1.5, 3.6], { bevel: 0.3 });
  panels(m, { xh: 2.3, z0: -16, z1: 14, y0: 4.5, y1: 13.1 });
  return {
    name: 'Hum', cls: 'smg', skin: { pattern: 'hex', primary: 0x3d4f6e, accent: 0x7a94c0, glow: 0x4a9bff, wear: 0.05 },
    muzzle: [0, 9.2, -42.4], eject: { p: [2.6, 12, 0], v: [1.7, 1.7, 0.2] }, len: 62, cellSize: [0.04, 0.15, 0.05],
    fire: { handle: { kick: [0, 0, 2, 0, 0, 0], k: 900, c: 36 } }, spinCoil: true,
    hands: { r: RH(3.5, -1, 2.2, 16), l: LH_UNDER(-17, 0.8, -0.3) },
  };
}

export function arc(b) {
  const m = b.main, hnd = b.part('handle', [0, 11, 3]);
  // receiver + dust cover
  m.box('body', [0, 9.4, 1.5], [4.6, 5.2, 27], { bevel: 0.7 });
  m.box('dark', [0, 5.9, 1.5], [4.8, 3.6, 27], { bevel: 0.7 });                       // lower receiver (gunmetal)
  m.side('body', 0, 4.3, [[-12, 11.8], [-9, 14.2], [11, 14.4], [16, 12.2], [16, 11.6], [-12, 11.6]], { bevel: 0.5 });
  for (let i = 0; i < 4; i++) m.box('dark', [0, 14.5, -2 + i * 4], [4.4, 0.3, 0.5]);
  m.box('dark', [0, 15, -3], [2.8, 1.2, 4.8], { bevel: 0.3 });               // rear sight
  m.box('dark', [0, 15.7, -3], [0.5, 1.2, 0.6]);
  strips(m, -10, 12, 7.6, 2.32, 0.45);
  // handguards (copper furniture)
  m.box('trim', [0, 6.9, -21], [5.0, 5.4, 17], { bevel: 0.9 });
  m.box('trim', [0, 11.4, -21], [4.4, 2.6, 15], { bevel: 0.6, shade: 1.1 });
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) m.box('dark', [sx * 2.55, 6.9, -14.5 - i * 2.6], [0.22, 3.8, 0.4]);
  // arc lightning on the handguard
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) m.box('glow', [sx * 2.6, 8 + (i % 2 ? 1.6 : -0.2) , -28.6 + i * 2.55 ], [0.16, 0.5, 3.6], { rot: [i % 2 ? 40 : -40, 0, 0] });
  m.cyl('dark', [0, 13.4, -28], 1.1, 1.1, 22, 8);                                   // gas tube
  m.cyl('dark', [0, 9.2, -41], 1.0, 1.0, 14, 8);                                    // barrel
  m.box('dark', [0, 12, -37.4], [2.2, 4.2, 2.2], { bevel: 0.35 }); m.box('trim', [0, 15, -37.4], [0.5, 3, 0.6], { bevel: 0.1 });
  m.cyl('trim', [0, 9.2, -47.5], 1.6, 1.8, 5.2, 8);
  m.cyl('glow', [0, 9.2, -50.3], 0.9, 0.9, 0.3, 8);
  for (const sx of [-1, 1]) m.box('glow', [sx * 1.75, 9.2, -47], [0.14, 0.5, 2.6]);
  // grip + guard
  pgrip(b, { zf: -2.4, zr: 3.0, rake: 20, top: 4.2, bot: -10.5, mat: 'trim' }); tguard(b, -7.6, -1.2, 3);
  m.box('body', [0, 4.2, -8.3], [4.4, 3.8, 8], { bevel: 0.5 });
  // stock
  m.side('trim', 0, 4.4, [[16, 11.4], [32, 9.4], [34, -3.8], [31, -6.4], [16, 3.6]], { bevel: 0.9 });
  m.box('dark', [0, 3, 34.4], [4.6, 11.4, 1.6], { bevel: 0.5, rot: [-6, 0, 0] });
  curvedCell(b, 'cell', [0, 3.6, -8.4], { n: 4, len: 5.0, w: 3.8, d: 4.8, phi0: 6, dphi: 12, gauge: 8 });
  hnd.box('trim', [3.1, 11.2, 4], [1.4, 1.6, 3.2], { bevel: 0.3 }); hnd.box('dark', [4.0, 11.2, 5.4], [1.0, 2.2, 1.6], { bevel: 0.25 });
  panels(m, { xh: 2.3, z0: -12, z1: 16, y0: 4.1, y1: 11.9 });
  return {
    name: 'Arc', cls: 'rifle', skin: { pattern: 'solid', primary: 0x3a4354, accent: 0xc9772a, glow: 0xff7a2f, wear: 0.12 },
    muzzle: [0, 9.2, -51.2], eject: { p: [2.6, 11, 4], v: [1.9, 1.8, 0.3] }, len: 84, cellSize: [0.042, 0.19, 0.05],
    fire: { handle: { kick: [0, 0, 3.2, 0, 0, 0], k: 800, c: 32 } },
    hands: { r: RH(3.5, -1.2, 2.0, 20), l: LH_UNDER(-19.5, 1.2, -0.4) },
  };
}

export function rail(b) {
  const m = b.main, hnd = b.part('handle', [0, 13, 7]);
  m.box('body', [0, 10.8, -1], [4.4, 5.4, 17], { bevel: 0.6 });                      // upper
  m.box('body', [0, 5.8, 0.5], [4.4, 6.4, 13.5], { bevel: 0.6 });                    // lower / magwell
  m.side('body', 0, 3.2, [[-6, 13.4], [-4, 15.6], [9, 15.6], [11, 13.4]], { bevel: 0.5 });   // carry handle
  m.box('dark', [0, 14.4, 3], [1.8, 2.6, 3], { bevel: 0.3 }); m.box('dark', [0, 17, 6.5], [2.8, 1.1, 1.2], { bevel: 0.2 });
  teeth(m, 'dark', 0, 16.2, -5, 9, 2.0, 1.4, 0.4);
  strips(m, -8, 7, 10.8, 2.22, 0.5);
  m.cyl('dark', [0, 9.8, -18.5], 3.2, 3.2, 25, 8);                                   // handguard
  m.cyl('body', [0, 9.8, -16.5], 3.5, 3.5, 5, 8); m.cyl('trim', [0, 9.8, -29.5], 3.4, 3.4, 1.4, 8);
  for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) m.box('vent', [sx * 3.3, 9.8, -9.5 - i * 4.4], [0.2, 1.6, 2.2]);
  strips(m, -13, -29, 11.8, 2.2, 0.5);
  teeth(m, 'trim', 0, 13.2, -9, -29, 2.2, 1.5, 0.5);
  m.cyl('dark', [0, 9.8, -37], 1.1, 1.1, 10, 8);
  m.box('dark', [0, 13, -34.6], [1.8, 4.6, 1.8], { bevel: 0.3, tz: [0.6, 1, 1, 1] });
  m.cyl('trim', [0, 9.8, -43], 1.7, 1.8, 5, 8); m.cyl('glow', [0, 9.8, -45.7], 0.95, 0.95, 0.3, 8);
  pgrip(b, { zf: -2.4, zr: 3.0, rake: 12, top: 4.0, bot: -10, mat: 'grip' }); tguard(b, -7.2, -1.2, 3);
  m.box('dark', [0, 9, 14], [2.4, 3.2, 8], { bevel: 0.4 });                          // buffer tube
  m.side('body', 0, 4.4, [[14, 11], [29, 9.6], [30, -3], [27, -5], [14, 3]], { bevel: 0.9 });
  m.box('rubber', [0, 3, 30.5], [4.6, 11.2, 1.6], { bevel: 0.5 });
  m.box('trim', [0, 10, 21.5], [4.6, 0.5, 14], { bevel: 0.2 });
  straightCell(b, 'cell', [0, 3.4, -6], { h: 12, w: 3.7, d: 4.4, tilt: 8, gauge: 8 });
  hnd.box('dark', [0, 13, 7], [2.4, 1.6, 4], { bevel: 0.3 }); hnd.box('trim', [0, 12.2, 9.2], [3.2, 0.9, 1.0], { bevel: 0.2 });
  panels(m, { xh: 2.2, z0: -7.5, z1: 9.5, y0: 8.1, y1: 13.5, seams: 2, hseam: 0.3 });
  return {
    name: 'Rail', cls: 'rifle', skin: { pattern: 'solid', primary: 0x39475a, accent: 0x8da3bf, glow: 0x2fd0ff, wear: 0.06 },
    muzzle: [0, 9.8, -46.6], eject: { p: [2.4, 11, 2], v: [1.9, 1.8, 0.3] }, len: 80, cellSize: [0.04, 0.16, 0.05],
    fire: { handle: { kick: [0, 0, 1.4, 0, 0, 0], k: 900, c: 36 } },
    hands: { r: RH(3.4, -1, 2.0, 12), l: LH_UNDER(-20.5, 1.4, -0.4) },
  };
}

export function halo(b) {
  const m = b.main, ring = b.part('ring', [0, 9.5, -41]), hnd = b.part('handle', [0, 12, 6]);
  m.box('body', [0, 9, -2], [4.8, 8.6, 30], { bevel: 0.9 });
  m.side('body', 0, 4.4, [[-15, 12.5], [-10, 14], [14, 14], [19, 11]], { bevel: 0.6 });
  strips(m, -14, 14, 8.6, 2.42, 0.5);
  m.box('dark', [0, 9.4, -22], [3.8, 6.4, 14], { bevel: 0.7 });
  m.cyl('dark', [0, 9.5, -33], 1.4, 1.4, 14, 8);
  vents(m, -17, -26, 9.5, 1.95, 4, 3.2);
  // emitter hoop (animated ring)
  ring.ring('trim', [0, 9.5, -41], 5.4, 0.75, 14, 4);
  ring.ring('glow', [0, 9.5, -41], 5.4, 0.55, 14, 4, { depth: 0.9 });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ring.box('trim', [Math.cos(a) * 3.0, 9.5 + Math.sin(a) * 3.0, -41], [0.6, 0.6, 1.4], { rot: [0, 0, a * 180 / Math.PI] }); }
  m.cyl('trim', [0, 9.5, -38.8], 1.9, 1.9, 2, 8); m.cyl('glow', [0, 9.5, -40], 1.1, 1.1, 0.3, 8);
  // scope
  m.cyl('dark', [0, 17.2, -2], 2.4, 2.4, 22, 10); m.cyl('trim', [0, 17.2, -13.8], 3.1, 3.1, 3.2, 10); m.cyl('trim', [0, 17.2, 9.8], 3.0, 2.4, 4, 10);
  m.cyl('lens', [0, 17.2, -15.6], 2.6, 2.6, 0.4, 10);
  m.cyl('lens', [0, 17.2, 11.8], 2.0, 2.0, 0.4, 10); m.ring('glow', [0, 17.2, 12.1], 2.05, 0.14, 10, 3); m.box('glow', [0, 17.2, 12.05], [3.4, 0.09, 0.1]); m.box('glow', [0, 17.2, 12.05], [0.09, 3.4, 0.1]);
  m.box('dark', [0, 14.4, -8], [1.8, 1.8, 2.2], { bevel: 0.3 }); m.box('dark', [0, 14.4, 4], [1.8, 1.8, 2.2], { bevel: 0.3 });
  for (let i = 0; i < 3; i++) m.box('glow', [0, 15.0, 15.5 + i * 1.7], [0.7, 0.2, 0.9]);   // burst pips
  pgrip(b, { zf: -2.4, zr: 3.2, rake: 14, top: 4.2, bot: -10, mat: 'grip' }); tguard(b, -7, -1.2, 3);
  m.side('body', 0, 4.8, [[16, 12], [31, 9], [32, -2], [29, -5.5], [16, 3.4]], { bevel: 0.9 });
  m.box('trim', [0, 3, 32.6], [5, 10.4, 1.4], { bevel: 0.5 });
  m.box('body', [0, 4.6, -9], [4.6, 3.8, 8], { bevel: 0.5 });
  straightCell(b, 'cell', [0, 4.2, -8.5], { h: 11, w: 3.9, d: 4.8, tilt: 6, gauge: 8 });
  hnd.box('trim', [3.2, 11.8, 4], [1.4, 1.5, 3.4], { bevel: 0.3 });
  panels(m, { xh: 2.4, z0: -15, z1: 14, y0: 4.7, y1: 13.3 });
  return {
    name: 'Halo', cls: 'rifle', skin: { pattern: 'gradient', primary: 0xe9e5f2, accent: 0x8f86b8, glow: 0xa07bff, wear: 0 },
    muzzle: [0, 9.5, -44.5], eject: { p: [2.7, 11, 3], v: [1.9, 1.8, 0.3] }, len: 76, cellSize: [0.04, 0.15, 0.05], ejectSize: 0.9,
    fire: { handle: { kick: [0, 0, 1.4, 0, 0, 0], k: 900, c: 36 }, ring: { step: [0, 0, 0, 0, 0, 30], k: 120, c: 12 } },
    scope: { center: [0, 17.2, 12], zoom: [0.5, 0.3] },
    hands: { r: RH(3.5, -1, 2.0, 14), l: LH_UNDER(-21, 1.2, -0.4) },
  };
}

export function lance(b) {
  const m = b.main, bolt = b.part('bolt', [0, 11, 4]);
  m.box('body', [0, 9, 0], [4.6, 8.4, 24], { bevel: 0.8 });
  m.box('dark', [0, 13.6, 0], [3.4, 1.2, 20], { bevel: 0.3 });
  strips(m, -9, 10, 8.6, 2.32, 0.45);
  m.box('dark', [0, 9.2, -24], [3.8, 5.2, 24], { bevel: 0.6 });                        // forend
  m.cyl('dark', [0, 9.2, -50], 1.15, 1.0, 28, 8);                                       // long barrel
  for (let i = 0; i < 6; i++) m.box('trim', [0, 9.2, -40 - i * 3.4], [3.3, 3.3, 0.6], { bevel: 0.15, rot: [0, 0, 45] });  // cooling fins
  for (let i = 0; i < 3; i++) m.cyl('glow', [0, 9.2, -41.5 - i * 6.8], 1.38, 1.38, 0.3, 8);
  m.cyl('trim', [0, 9.2, -65.5], 1.8, 1.8, 5, 8); m.cyl('glow', [0, 9.2, -68.2], 1.0, 1.0, 0.3, 8);
  // big scope
  m.cyl('dark', [0, 16.6, -4], 3.0, 3.0, 26, 10); m.cyl('trim', [0, 16.6, -17.8], 4.1, 3.5, 4.4, 10); m.cyl('trim', [0, 16.6, 10.6], 3.3, 3.6, 3.4, 10);
  m.cyl('lens', [0, 16.6, -20.2], 3.6, 3.6, 0.4, 10);
  m.cyl('lens', [0, 16.6, 12.4], 2.7, 2.7, 0.5, 10); m.ring('glow', [0, 16.6, 12.8], 2.75, 0.16, 10, 3);      // dark eyepiece glass with a thin glowing rim
  m.box('glow', [0, 16.6, 12.75], [4.6, 0.1, 0.1]); m.box('glow', [0, 16.6, 12.75], [0.1, 4.6, 0.1]);        // reticle
  m.cyl('trim', [0, 16.6, 4], 3.5, 3.5, 1.2, 10); m.cylY('trim', [0, 19.9, -2], 1.0, 1.0, 1.6, 8); m.cylX('trim', [3.4, 16.6, -2], 1.0, 1.0, 1.6, 8);   // mid ring + elevation / windage turrets
  m.box('dark', [0, 12.9, -10], [2.2, 3.2, 3.2], { bevel: 0.4 }); m.box('dark', [0, 12.9, 4], [2.2, 3.2, 3.2], { bevel: 0.4 });
  m.cyl('trim', [0, 16.6, -4.5], 3.4, 3.4, 2.4, 10);
  // bipod folded
  for (const sx of [-1, 1]) m.box('dark', [sx * 2.5, 5.6, -30], [0.8, 1.0, 14], { bevel: 0.2, rot: [0, 0, 0] });
  pgrip(b, { zf: -2.4, zr: 3.0, rake: 12, top: 4.4, bot: -10, mat: 'grip' }); tguard(b, -7.6, -1.2, 3);
  // thumbhole stock
  m.side('body', 0, 4.6, [[12, 12], [26, 10.4], [33, 9], [34, -5], [30, -7.4], [22, -5.4], [14, -2.4], [14, 1.8], [22, 2.4], [24, 8], [14, 8.6]], { bevel: 0.9 });
  m.box('rubber', [0, 2, 34.6], [4.8, 13.6, 1.6], { bevel: 0.5 });
  m.box('body', [0, 4.8, -8.5], [4.4, 3.6, 7], { bevel: 0.5 });
  straightCell(b, 'cell', [0, 4.6, -8.4], { h: 6, w: 3.6, d: 4.4, tilt: 4, gauge: 5 });
  // charge gauge on the side (full length bar)
  for (const sx of [1]) { const segs = []; for (let i = 0; i < 10; i++) segs.push({ p: [sx * 2.42, 10.2, 7 - i * 1.9 + 0], s: [0.25, 1.4, 1.2] }); b.gauge('main', segs); }
  bolt.box('trim', [4.3, 11.6, 4], [3.0, 0.9, 0.9], { bevel: 0.2 }); bolt.ball('trim', [6.2, 11.6, 4], 1.3);
  bolt.box('dark', [2.5, 11.4, 4], [1.4, 1.1, 3.6], { bevel: 0.2 });
  panels(m, { xh: 2.3, z0: -12, z1: 12, y0: 4.8, y1: 13.2 });
  return {
    name: 'Lance', cls: 'sniper', skin: { pattern: 'solid', primary: 0x2e3744, accent: 0x6a7686, glow: 0xff3355, wear: 0.05 },
    muzzle: [0, 9.2, -69.5], eject: { p: [2.6, 11, 4], v: [1.9, 1.8, 0.3] }, len: 108, cellSize: [0.04, 0.1, 0.05], ejectSize: 1.3,
    fire: {}, scope: { center: [0, 16.6, 12.5], zoom: [0.42, 0.16] }, afterFire: { clip: 'bolt', delay: 0.28, dur: 0.85 }, gaugeOnMain: true,
    hands: { r: RH(3.5, -1, 2.0, 12), l: LH_UNDER(-22, 1.4, -0.4) },
  };
}

export function scatter(b) {
  const m = b.main, pump = b.part('pump', [0, 6, -20]), cell = b.part('cell', [0, 5, -18]);
  m.box('body', [0, 8.6, 0], [5.0, 8.6, 26], { bevel: 0.9 });
  m.box('dark', [0, 13.4, 0], [3.6, 1.0, 22], { bevel: 0.3 });
  strips(m, -10, 10, 9.4, 2.52, 0.5);
  // fat barrel: 4-lobe emitter cluster
  for (const [x, y] of [[-1.5, 7.6], [1.5, 7.6], [-1.5, 10.8], [1.5, 10.8]]) { m.cyl('dark', [x, y, -26], 1.5, 1.5, 28, 8); m.cyl('trim', [x, y, -40.4], 1.85, 1.85, 1.6, 8); m.cyl('glow', [x, y, -41.4], 1.1, 1.1, 0.3, 8); }
  m.box('dark', [0, 9.2, -26], [4.2, 4.8, 24], { bevel: 0.5 });
  m.box('trim', [0, 9.2, -36], [3.9, 5.2, 1.0], { bevel: 0.3 });
  m.box('dark', [0, 13.4, -36], [0.5, 1.8, 0.7]);
  // under-barrel tube cell (a long glass tube with glowing core)
  cell.cyl('glass', [0, 4.0, -20], 2.2, 2.2, 26, 8);
  cell.cyl('dark', [0, 4.0, -33.4], 2.5, 2.5, 1.2, 8); cell.cyl('dark', [0, 4.0, -6.8], 2.5, 2.5, 1.2, 8);
  { const segs = []; for (let i = 0; i < 7; i++) segs.push({ p: [0, 4, -8 - i * 3.5], s: [2.6, 2.6, 2.6] }); b.gauge('cell', segs); }
  pump.box('body', [0, 5.8, -22], [4.6, 3.8, 11], { bevel: 0.7 });
  for (let i = 0; i < 6; i++) pump.box('dark', [0, 3.7, -17.6 - i * 1.7], [4.7, 0.5, 0.6]);
  pump.box('trim', [0, 8.2, -22], [3.2, 0.6, 11], { bevel: 0.2 });
  pump.box('glow', [2.35, 6.2, -22], [0.14, 0.45, 9]); pump.box('glow', [-2.35, 6.2, -22], [0.14, 0.45, 9]);
  pgrip(b, { zf: -2.5, zr: 3.2, rake: 14, top: 4.2, bot: -10, mat: 'grip' }); tguard(b, -7.5, -1.2, 3);
  m.side('trim', 0, 4.6, [[14, 11.6], [32, 9], [34, -5], [31, -7.4], [16, 3.4]], { bevel: 0.9 });
  m.box('rubber', [0, 2, 34.6], [4.8, 14.2, 1.6], { bevel: 0.5 });
  vents(m, 1, 9, 11, 2.55, 3, 2.2);
  m.box('trim', [3.0, 11.2, -2], [0.6, 2.4, 5], { bevel: 0.15 }); // loading port
  panels(m, { xh: 2.5, z0: -12, z1: 12, y0: 4.6, y1: 12.6 });
  return {
    name: 'Scatter', cls: 'shotgun', skin: { pattern: 'solid', primary: 0x6a4234, accent: 0xb8815a, glow: 0xffd84a, wear: 0.2 },
    muzzle: [0, 9.2, -42.5], eject: { p: [2.8, 11, -1], v: [1.9, 1.6, 0.2] }, len: 84, cellSize: [0.03, 0.03, 0.03], ejectSize: 1.9,
    fire: {}, afterFire: { clip: 'pump', delay: 0.14, dur: 0.46 }, shell: true,
    hands: { r: RH(3.7, -1, 2.2, 14), l: { p: [-0.2, 2.6, -22], r: [0, 0, 180], curl: [0.6, 0.62, 0.64, 0.66, 0.4], pose: 'under' } },
  };
}

export function storm(b) {
  const m = b.main, drum = b.part('drum', [0, -3, -8]), lid = b.part('lid', [0, 14, -6]), hnd = b.part('handle', [0, 14, 4]);
  m.box('body', [0, 9, -1], [5.4, 9.6, 30], { bevel: 1.0 });
  m.box('dark', [0, 14.6, -1], [4.0, 1.4, 26], { bevel: 0.4 }); teeth(m, 'dark', 0, 15.5, -12, 10, 2.6, 1.5);
  strips(m, -13, 10, 8.8, 2.72, 0.5);
  // massive shroud
  m.box('dark', [0, 9.4, -26], [6.2, 8, 22], { bevel: 1.0 });
  m.box('body', [0, 9.4, -26], [5.7, 8.6, 20], { bevel: 0.9, shade: 1.05 });
  vents(m, -17, -34, 9.6, 3.0, 6, 5.0);
  m.box('trim', [0, 9.4, -37.6], [6.6, 8.6, 1.4], { bevel: 0.5 });
  m.cyl('dark', [0, 9.4, -43], 1.5, 1.5, 10, 8); m.cyl('trim', [0, 9.4, -49.6], 2.2, 2.0, 5, 8); m.cyl('glow', [0, 9.4, -52.3], 1.2, 1.2, 0.3, 8);
  m.box('trim', [0, 16.4, -26], [0.7, 3, 0.8], { bevel: 0.1 });
  // carry handle
  m.side('dark', 0, 2.6, [[-20, 14.4], [-18, 19], [-8, 19], [-6, 14.4]], { bevel: 0.4 });
  // bipod
  for (const sx of [-1, 1]) m.box('dark', [sx * 3.4, 4.2, -33], [0.9, 1.2, 12], { bevel: 0.2, rot: [-8, 0, 0] });
  pgrip(b, { zf: -2.6, zr: 3.4, rake: 12, top: 4.4, bot: -10.5, mat: 'grip' }); tguard(b, -8, -1.2, 3);
  m.side('body', 0, 5.0, [[14, 12.5], [30, 9.4], [32, -1], [28, -6], [14, 3.4]], { bevel: 1.0 });
  m.box('rubber', [0, 3, 32.4], [5.2, 14, 1.6], { bevel: 0.5 });
  // drum cell hanging under the receiver (axis X)
  m.box('dark', [0, 3.6, -8], [5.0, 3.6, 9], { bevel: 0.5 });
  drum.cylX('glass', [0, -3, -8], 8.4, 8.4, 8.2, 12);
  drum.cylX('dark', [4.4, -3, -8], 8.7, 8.7, 1.0, 12); drum.cylX('dark', [-4.4, -3, -8], 8.7, 8.7, 1.0, 12);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; drum.box('dark', [0, -3 + Math.sin(a) * 8.4, -8 + Math.cos(a) * 8.4], [8.4, 0.6, 0.6], { rot: [(a * 180) / Math.PI, 0, 0] }); }
  { const segs = []; for (let i = 0; i < 12; i++) { const a = Math.PI * 1.5 + (i / 12) * Math.PI * 2 * 0.92 + 0.0; segs.push({ p: [0, -3 + Math.sin(a) * 5.3, -8 + Math.cos(a) * 5.3], s: [8.6, 2.0, 2.0], r: [(-a * 180) / Math.PI + 90, 0, 0] }); } b.gauge('drum', segs); }
  drum.cylX('trim', [0, -3, -8], 3.6, 3.6, 8.8, 8); drum.cylX('glow', [5.0, -3, -8], 2.0, 2.0, 0.2, 8);
  lid.box('trim', [0, 14.9, -6], [4.2, 0.8, 9], { bevel: 0.3 }); lid.box('dark', [0, 15.5, -6], [3.0, 0.6, 6], { bevel: 0.2 });
  hnd.box('trim', [3.4, 12.6, 3.6], [1.4, 1.6, 3.6], { bevel: 0.3 });
  panels(m, { xh: 2.7, z0: -16, z1: 14, y0: 4.2, y1: 13.8 });
  return {
    name: 'Storm', cls: 'heavy', skin: { pattern: 'chevron', primary: 0x3f4a58, accent: 0xffb020, glow: 0xffb020, wear: 0.25 },
    muzzle: [0, 9.4, -53.5], eject: { p: [3.0, 11, 2], v: [2.0, 1.7, 0.3] }, len: 88, cellSize: [0.1, 0.17, 0.17], ejectSize: 1.0,
    fire: { drum: { step: [0, 0, 0, 20, 0, 0], k: 90, c: 11 } }, heavy: true,
    hands: { r: RH(3.9, -1, 2.2, 12), l: LH_UNDER(-26, 1.6, -0.4) },
  };
}
