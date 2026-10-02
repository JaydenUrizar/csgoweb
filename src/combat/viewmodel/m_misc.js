// Melee (tap), utility canisters (haze/strobe/pulse) and gear (beacon, kit, vest). cm, grip at origin.
import { pgrip, tguard, emitter } from './kit.js';

export function tap(b) {
  const m = b.main;
  m.cyl('grip', [0, 0, 0], 2.0, 2.0, 17, 8);
  for (const z of [-6, -2.5, 1, 4.5]) m.cyl('trim', [0, 0, z], 2.18, 2.18, 0.55, 8);
  m.cyl('trim', [0, 0, 9.8], 2.6, 2.2, 3.4, 8); m.cyl('glow', [0, 0, 11.6], 1.4, 1.4, 0.3, 8);
  m.ring('dark', [0, 0, 11.5], 3.2, 0.55, 10, 4, { rot: [90, 0, 0] });                  // wrist-strap loop
  m.cyl('trim', [0, 0, -9.2], 3.7, 3.7, 1.3, 8);                                        // guard
  m.cyl('body', [0, 0, -35], 4.7, 2.4, 51, 8);                                          // bat head (wider at the tip)
  m.cyl('dark', [0, 0, -35], 4.78, 2.48, 40, 8, { phase: 0.0, open: true, shade: 0.8 });
  for (let i = 0; i < 4; i++) { const z = -18 - i * 10.5, r = 2.5 + ((-z - 9.5) / 51) * 2.3 + 0.12; m.cyl('glow', [0, 0, z], r, r, 0.9, 8); }
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; m.box('glow', [Math.cos(a) * 3.8, Math.sin(a) * 3.8, -44], [0.35, 0.35, 12], { rot: [0, 0, a * 180 / Math.PI] }); }
  m.cyl('trim', [0, 0, -61], 4.9, 4.9, 2.6, 8); m.cyl('glow', [0, 0, -62.5], 3.5, 3.5, 0.3, 8);
  return {
    name: 'Tap', cls: 'melee', skin: { pattern: 'solid', primary: 0x30353f, accent: 0x9aa3b4, glow: 0xffc24a, wear: 0.1 },
    muzzle: [0, 0, -63], anchors: { tip: [0, 0, -61], tipBase: [0, 0, -38] }, len: 74, trail: true, hold: 'melee',
    hands: { r: { p: [2.4, 3.4, 0], r: [0, 90, 0], curl: [0.78, 0.8, 0.82, 0.84, 0.55], pose: 'fist' }, l: null },
  };
}

function canisterHands(rY = 0) {
  return { r: { p: [5.0, rY, 0], r: [0, 0, -90], curl: [0.62, 0.66, 0.68, 0.7, 0.4], pose: 'grip' }, l: { p: [-10, -7, 7], r: [-25, 20, 30], curl: [0.3, 0.3, 0.32, 0.34, 0.2], pose: 'idle' } };
}

export function haze(b) {
  const m = b.main, pin = b.part('pin', [2.8, 8.4, 0]);
  m.cylY('body', [0, 0, 0], 3.5, 3.5, 13, 10);
  m.cylY('dark', [0, -6.9, 0], 3.2, 3.0, 1.2, 10); m.cylY('dark', [0, 6.8, 0], 3.2, 3.5, 1.2, 10);
  m.cylY('trim', [0, 8.4, 0], 2.5, 1.5, 2.4, 10); m.cylY('dark', [0, 10.1, 0], 1.1, 1.1, 1.2, 8);
  m.cylY('glow', [0, -1.4, 0], 3.62, 3.62, 2.0, 10);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; m.cylY('vent', [Math.cos(a) * 1.55, 9.2, Math.sin(a) * 1.55], 0.35, 0.35, 0.5, 6); }
  m.box('trim', [3.5, 2.5, 0], [0.7, 12, 2.4], { bevel: 0.25 });                           // spoon lever
  m.box('trim', [3.0, 8.6, 0], [1.5, 0.7, 2.4], { bevel: 0.2 });
  for (let i = 0; i < 3; i++) m.box('glow', [0, 3.6 + i * 1.1, 3.62], [4.2 - i * 1.0, 0.35, 0.12]);   // cloud icon bars
  pin.ring('trim', [4.2, 8.6, 0], 1.7, 0.3, 10, 4, { rot: [0, 90, 0] });
  pin.cylX('trim', [1.6, 8.6, 0], 0.28, 0.28, 3.6, 6);
  return { name: 'Haze', cls: 'grenade', skin: { pattern: 'solid', primary: 0x48606c, accent: 0xa8c2cc, glow: 0x9fe8ff, wear: 0 }, muzzle: [0, 10, 0], len: 24, hands: canisterHands(0), hold: 'throw', pinAt: [4.2, 8.6, 0] };
}

export function strobe(b) {
  const m = b.main, pin = b.part('pin', [2.8, 7.6, 0]);
  m.cylY('body', [0, -1, 0], 3.3, 3.3, 11, 6);
  m.cylY('dark', [0, -6.9, 0], 3.2, 3.0, 1.2, 6);
  m.cylY('trim', [0, 5.2, 0], 3.7, 3.7, 2, 6); m.cylY('dark', [0, 4.2, 0], 3.4, 3.4, 0.5, 6);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; m.box('glow', [Math.cos(a) * 3.0, 7.9, Math.sin(a) * 3.0], [1.9, 3.0, 0.5], { rot: [0, -a * 180 / Math.PI + 90, 0], bevel: 0.1 }); }
  m.cylY('glow', [0, 7.4, 0], 2.0, 2.0, 2.6, 6); m.ball('glow', [0, 9, 0], 1.7);
  m.cylY('glow', [0, -2.6, 0], 3.45, 3.45, 1.4, 6);
  for (let i = 0; i < 3; i++) m.box('glow', [0, 1.2 + i * 1.2, 3.25], [0.5, 0.5, 0.15], { rot: [0, 0, 45] });
  m.box('trim', [3.3, 1.4, 0], [0.7, 10, 2.2], { bevel: 0.25 });
  pin.ring('trim', [4.2, 7.8, 0], 1.7, 0.3, 10, 4, { rot: [0, 90, 0] }); pin.cylX('trim', [1.6, 7.8, 0], 0.28, 0.28, 3.6, 6);
  return { name: 'Strobe', cls: 'grenade', skin: { pattern: 'solid', primary: 0xe6e2d6, accent: 0x8e8a7e, glow: 0xfff2a0, wear: 0 }, muzzle: [0, 10, 0], len: 22, hands: canisterHands(-0.6), hold: 'throw', pinAt: [4.2, 7.8, 0] };
}

export function pulse(b) {
  const m = b.main, pin = b.part('pin', [2.8, 6.6, 0]);
  m.ball('body', [0, 0, 0], 5.2, { detail: 1 });
  m.ball('dark', [0, 0, 0], 5.35, { detail: 0, rot: [10, 20, 30] });
  for (let i = 0; i < 3; i++) m.ring('glow', [0, 0, 0], 5.45, 0.28, 14, 4, { rot: [i * 60, i * 30 + 20, 0] });
  m.ball('glow', [0, 0, 0], 3.2, { detail: 0 });
  for (const [x, y, z] of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) m.box('trim', [x * 5.4, y * 5.4, z * 5.4], [1.8 + Math.abs(y) * 0, 1.8, 1.8], { bevel: 0.3 });
  m.cylY('trim', [0, 6.0, 0], 1.6, 1.2, 2.2, 8);
  pin.ring('trim', [3.0, 6.6, 0], 1.6, 0.3, 10, 4, { rot: [0, 90, 0] }); pin.cylX('trim', [1.4, 6.6, 0], 0.28, 0.28, 3.2, 6);
  return { name: 'Pulse', cls: 'grenade', skin: { pattern: 'solid', primary: 0x3a3f5a, accent: 0x8a90b8, glow: 0xff5ac8, wear: 0 }, muzzle: [0, 6, 0], len: 14, hands: canisterHands(0), hold: 'throw', pinAt: [3.0, 6.6, 0] };
}

export function beacon(b) {
  const m = b.main, ant = b.part('antenna', [0, 12, 0]);
  m.cylY('dark', [0, -5, 0], 8.4, 7.4, 3, 6);
  m.cylY('body', [0, 1, 0], 6.8, 6.0, 9, 6);
  m.cylY('trim', [0, 5.8, 0], 6.4, 5.4, 1.6, 6);
  m.ring('glow', [0, 5.0, 0], 6.4, 0.45, 12, 4, { rot: [90, 0, 0] });
  m.ring('glow', [0, -2.4, 0], 7.1, 0.35, 12, 4, { rot: [90, 0, 0] });
  m.box('dark', [0, 1.6, 6.3], [6.4, 4.2, 0.8], { bevel: 0.25, rot: [-8, 0, 0] });
  m.box('glow', [0, 1.6, 6.8], [5.2, 3.0, 0.15], { rot: [-8, 0, 0] });
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; m.box('trim', [Math.cos(a) * 6.9, -1.4, Math.sin(a) * 6.9], [1.2, 5, 1.2], { bevel: 0.25, rot: [0, -a * 180 / Math.PI, 0] }); }
  m.box('dark', [0, 8.2, 0], [1.2, 3.2, 1.2]);
  ant.cylY('dark', [0, 12.5, 0], 0.5, 0.5, 8, 6); ant.ball('glow', [0, 17, 0], 1.3);
  m.box('trim', [0, 8.4, 0], [9, 0.9, 1.6], { bevel: 0.3 });                              // carry bar
  return { name: 'Beacon', cls: 'gear', skin: { pattern: 'solid', primary: 0x3a4250, accent: 0xb0b8c8, glow: 0xff9a2f, wear: 0.05 }, muzzle: [0, 17, 0], len: 22, hold: 'carry',
    hands: { r: { p: [9.4, 1, 0], r: [0, 0, -90], curl: [0.55, 0.6, 0.62, 0.64, 0.35], pose: 'grip' }, l: { p: [-9.4, 1, 0], r: [0, 0, 90], curl: [0.55, 0.6, 0.62, 0.64, 0.35], pose: 'grip' } } };
}

export function kit(b) {
  const m = b.main, probe = b.part('probe', [0, 7, -9]);
  pgrip(b, { zf: -2.2, zr: 3.2, rake: 10, top: 3, bot: -9, mat: 'grip' });
  m.box('body', [0, 6.2, -4], [5.2, 6.4, 18], { bevel: 0.9 });
  m.box('dark', [0, 9.6, -4], [4.0, 1.0, 14], { bevel: 0.3 });
  m.box('dark', [0, 7.6, -14], [4.4, 3.4, 5], { bevel: 0.5 });
  m.box('glow', [0, 6.8, 5.2], [3.6, 2.4, 0.12]); m.box('dark', [0, 6.8, 5.0], [4.2, 3.0, 0.5], { bevel: 0.2 });
  m.box('glow', [0, 9.0, -9], [3.4, 0.15, 6]);
  for (const sx of [-1, 1]) { m.box('trim', [sx * 1.7, 7, -22], [0.9, 0.9, 16], { bevel: 0.2 }); probe.box('trim', [sx * 1.7, 7, -22], [0.9, 0.9, 16], { bevel: 0.2 }); probe.box('glow', [sx * 1.7, 7, -30.4], [1.2, 1.2, 1.2], { bevel: 0.2 }); }
  tguard(b, -6, -1.2, 2);
  for (let i = 0; i < 4; i++) m.box('vent', [3.4, 6.2, -9 - i * 2.2], [0.15, 3, 0.8]);
  return { name: 'Kit', cls: 'gear', skin: { pattern: 'stripes', primary: 0xe8ecf2, accent: 0xff5a4a, glow: 0x39f0a0, wear: 0 }, muzzle: [0, 7, -31], len: 36, hold: 'carry',
    hands: { r: { p: [3.4, -1, 2.2], r: [-8, 0, -90], curl: [0.66, 0.7, 0.72, 0.74, 0.45], pose: 'grip' }, l: { p: [-9, -8, 2], r: [0, 0, 20], curl: [0.2, 0.2, 0.25, 0.3, 0.15], pose: 'idle' } } };
}

export function vest(b) {
  const m = b.main;
  m.box('body', [0, 0, 0], [26, 28, 6], { bevel: 1.4, tz: [0.9, 1, 1, 1] });
  m.box('dark', [0, 0, -3.1], [18, 18, 0.5], { bevel: 0.6 });
  m.box('glow', [0, 3, -3.5], [10, 0.6, 0.12]); m.box('glow', [0, -3, -3.5], [10, 0.6, 0.12]);
  return { name: 'Vest', cls: 'gear', skin: { pattern: 'hex', primary: 0x3c4658, accent: 0x7d8ba8, glow: 0x2fd0ff, wear: 0 }, muzzle: [0, 0, -4], len: 28, hold: 'carry', hands: { r: null, l: null } };
}
