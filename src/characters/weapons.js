// Tagger hold poses per class, reload waypoints and fallback world models (used until ctx.combat.viewmodel.worldModel exists).
// Aim frame: origin = mid-shoulder, +X right, +Y up, -Z forward (rotates with the aim yaw/pitch).
import * as THREE from 'three';
import { boxP, frustumP, sphereP, place, part, merge } from './geo.js';

const ID_CLASS = {
  pip: 'pistol', twin: 'pistol', judge: 'pistol', zip: 'smg', hum: 'smg', arc: 'rifle', rail: 'rifle', halo: 'rifle', lance: 'sniper',
  scatter: 'shotgun', storm: 'lmg', tap: 'melee', haze: 'grenade', strobe: 'grenade', pulse: 'grenade', beacon: 'carry', kit: 'carry',
};
export function classOf(id, def) {
  if (id && ID_CLASS[id]) return ID_CLASS[id];
  const w = String(def?.class || def?.cls || def?.type || def?.category || '').toLowerCase();
  if (/pistol|side|revolver/.test(w)) return 'pistol'; if (/smg/.test(w)) return 'smg'; if (/snip/.test(w)) return 'sniper';
  if (/shot/.test(w)) return 'shotgun'; if (/lmg|heavy|machine/.test(w)) return 'lmg'; if (/rifle/.test(w)) return 'rifle';
  if (/melee|grip|stick/.test(w)) return 'melee'; if (/util|grenade|throw/.test(w)) return 'grenade';
  return id ? 'rifle' : 'none';
}

// pos/rot: pivot (weapon grip) in aim frame, L: left-hand target in pivot space, lroll/rroll: hand roll about the forearm,
// len: fallback model length, kick: [z back (m), pitch up (rad)], reach: preferred foregrip slide toward grip when too far.
export const HOLD = {
  rifle:   { pos: [0.15, -0.12, -0.2], rot: [0, 0, 0], L: [0.0, -0.05, -0.36], lroll: 1.25, rroll: 0.15, kick: [0.045, 0.05], len: 0.98 },
  smg:     { pos: [0.14, -0.14, -0.2], rot: [0, 0, 0], L: [0.0, -0.05, -0.28], lroll: 1.25, rroll: 0.15, kick: [0.03, 0.035], len: 0.68 },
  shotgun: { pos: [0.15, -0.13, -0.2], rot: [0, 0, 0], L: [0.0, -0.055, -0.4], lroll: 1.25, rroll: 0.15, kick: [0.07, 0.09], len: 0.95 },
  sniper:  { pos: [0.15, -0.11, -0.2], rot: [0, 0, 0], L: [0.0, -0.05, -0.42], lroll: 1.25, rroll: 0.15, kick: [0.09, 0.13], len: 1.2 },
  lmg:     { pos: [0.13, -0.16, -0.22], rot: [0, 0, 0], L: [0.0, -0.065, -0.4], lroll: 1.25, rroll: 0.15, kick: [0.035, 0.04], len: 1.05 },
  pistol:  { pos: [0.05, -0.09, -0.5], rot: [0, 0, 0], L: [-0.058, -0.052, -0.004], lroll: -0.15, rroll: 0.0, kick: [0.05, 0.11], len: 0.32 },
  melee:   { pos: [0.27, -0.44, -0.18], rot: [-0.85, 0.0, 0.12], L: null, lroll: 0, rroll: 0.0, kick: [0.0, 0.0], len: 0.8 },
  grenade: { pos: [0.24, -0.26, -0.24], rot: [0, 0, 0], L: null, lroll: 0, rroll: 0, kick: [0.0, 0.0], len: 0.11 },
  carry:   { pos: [0.0, -0.3, -0.27], rot: [0.0, 0, 0], L: [-0.12, -0.02, 0.0], lroll: 1.4, rroll: -1.4, kick: [0, 0], len: 0.26, bothSides: true },
  none:    { pos: [0.2, -0.5, -0.05], rot: [0, 0, 0], L: null, lroll: 0, rroll: 0, kick: [0, 0], len: 0 },
};

// Left-hand reload waypoints in pivot space: [t, x, y, z]
export const RELOAD = {
  rifle: [[0, 0, -0.055, -0.31], [0.16, 0, -0.13, -0.06], [0.32, -0.05, -0.36, 0.02], [0.5, -0.1, -0.38, 0.1], [0.66, 0, -0.14, -0.06], [0.76, 0, -0.14, -0.05], [0.92, 0, -0.06, -0.22], [1, 0, -0.055, -0.31]],
  pistol: [[0, -0.058, -0.052, -0.004], [0.16, -0.03, -0.11, 0.0], [0.34, -0.16, -0.36, 0.14], [0.52, -0.2, -0.38, 0.2], [0.68, -0.03, -0.12, 0.0], [0.78, -0.03, -0.11, 0.0], [1, -0.058, -0.052, -0.004]],
  shotgun: [[0, 0, -0.06, -0.33], [0.15, -0.1, -0.3, 0.05], [0.3, 0, -0.1, -0.1], [0.45, -0.1, -0.3, 0.05], [0.6, 0, -0.1, -0.1], [0.75, -0.1, -0.3, 0.05], [0.88, 0, -0.1, -0.1], [1, 0, -0.06, -0.33]],
};
RELOAD.smg = RELOAD.rifle; RELOAD.sniper = RELOAD.rifle; RELOAD.lmg = RELOAD.rifle;

// ------------------------------------------------------------------ fallback world models
const cache = new Map();
/** Simple procedural tagger silhouette per class. Origin at grip, barrel toward -Z, `muzzle` child at the tip. */
export function fallbackGun(cls, glow = 0x66ccff) {
  const key = cls + glow; if (cache.has(key)) return cache.get(key).clone(true);
  const g = new THREE.Group(); g.name = 'fallbackGun:' + cls;
  const L = HOLD[cls]?.len || 0.6; const P = [], E = [];
  const add = (pts, color) => P.push(part(pts, 0, 'dark', color)), glowP = (pts) => E.push(part(pts, 0, 'dark', 0xffffff));
  const D = 0x2d3038, D2 = 0x40444f;
  if (cls === 'melee') {
    add(place(frustumP(0.022, 0.022, 0.2, 6), { z: 0.02, rx: Math.PI / 2 }), D2);
    add(place(frustumP(0.03, 0.02, 0.5, 6), { z: -0.35, rx: Math.PI / 2 }), D);
    glowP(place(frustumP(0.034, 0.034, 0.04, 6), { z: -0.62, rx: Math.PI / 2 }));
  } else if (cls === 'grenade') { add(place(sphereP(0.048, 0.048, 0.048, 1), { y: 0.01 }), 0x9aa3b2); glowP(place(frustumP(0.05, 0.05, 0.012, 8), { y: 0.01, rx: 0 })); }
  else if (cls === 'carry') { add(place(boxP(0.16, 0.13, 0.2, 0.02), { z: -0.02 }), D); glowP(place(boxP(0.11, 0.03, 0.02, 0.005), { y: 0.03, z: -0.125 })); }
  else {
    const bodyL = cls === 'pistol' ? 0.16 : L * 0.42, gz = cls === 'pistol' ? 0 : 0.07;
    add(place(boxP(0.055, 0.09, bodyL, 0.014), { y: 0.02, z: -bodyL / 2 + 0.06 }), D);                                // receiver
    add(place(boxP(0.045, 0.12, 0.05, 0.012, 0.05, 0.045), { y: -0.07, z: 0.04, rx: -0.2 }), D2);                      // grip
    if (cls !== 'pistol') add(place(boxP(0.05, 0.1, 0.24, 0.012, 0.05, 0.16), { y: 0.0, z: 0.22 + gz * 0.3 }), D2);   // stock
    const barrel = cls === 'pistol' ? 0.1 : L * 0.5;
    add(place(frustumP(0.018, 0.016, barrel, 6), { y: 0.03, z: -bodyL - barrel / 2 + 0.06, rx: Math.PI / 2 }), 0x4a4f5c);
    if (cls !== 'pistol' && cls !== 'sniper') add(place(boxP(0.045, 0.16, 0.06, 0.012), { y: -0.11, z: -0.09, rx: 0.15 }), D2); // mag
    if (cls === 'lmg') add(place(boxP(0.1, 0.13, 0.13, 0.02), { y: -0.11, z: -0.06 }), D2);
    if (cls === 'sniper') add(place(frustumP(0.03, 0.03, 0.26, 8), { y: 0.095, z: -0.13, rx: Math.PI / 2 }), 0x3a3e49);
    if (cls === 'shotgun') add(place(frustumP(0.026, 0.026, 0.34, 6), { y: -0.01, z: -0.32, rx: Math.PI / 2 }), 0x4a4f5c);
    glowP(place(boxP(0.058, 0.012, 0.12, 0.003), { y: 0.066, z: -0.08 }));
  }
  const body = new THREE.Mesh(merge(P), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 }));
  const glowM = new THREE.Mesh(merge(E), new THREE.MeshBasicMaterial({ color: new THREE.Color(glow).multiplyScalar(2.2), toneMapped: true }));
  glowM.geometry.deleteAttribute('color');
  body.castShadow = true; g.add(body, glowM);
  const mz = new THREE.Object3D(); mz.name = 'muzzle'; mz.position.set(0, 0.03, -(cls === 'pistol' ? 0.28 : cls === 'melee' ? 0.65 : L * 0.95)); g.add(mz);
  cache.set(key, g); return g.clone(true);
}
