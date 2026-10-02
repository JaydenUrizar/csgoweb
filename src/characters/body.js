// Skeleton definition + procedural low-poly athlete geometry (see geo.js). 1.8 m standing, faces -Z.
import * as THREE from 'three';
import { boxP, frustumP, sphereP, slabP, place, part, merge, V } from './geo.js';

export const B = {
  pelvis: 0, spine: 1, chest: 2, neck: 3, head: 4,
  uArmL: 5, fArmL: 6, handL: 7, uArmR: 8, fArmR: 9, handR: 10,
  uLegL: 11, lLegL: 12, footL: 13, uLegR: 14, lLegR: 15, footR: 16,
};
// [name, parentIndex(-1 = root), world rest position]
export const BONES = [
  ['pelvis', -1, [0, 0.93, 0]], ['spine', 0, [0, 1.03, 0]], ['chest', 1, [0, 1.23, 0]], ['neck', 2, [0, 1.53, 0]], ['head', 3, [0, 1.62, 0]],
  ['uArmL', 2, [-0.27, 1.45, 0]], ['fArmL', 5, [-0.27, 1.11, 0]], ['handL', 6, [-0.27, 0.77, 0]],
  ['uArmR', 2, [0.27, 1.45, 0]], ['fArmR', 8, [0.27, 1.11, 0]], ['handR', 9, [0.27, 0.77, 0]],
  ['uLegL', 0, [-0.115, 0.91, 0]], ['lLegL', 11, [-0.115, 0.47, 0]], ['footL', 12, [-0.115, 0.07, 0]],
  ['uLegR', 0, [0.115, 0.91, 0]], ['lLegR', 14, [0.115, 0.47, 0]], ['footR', 15, [0.115, 0.07, 0]],
];
export const SEG = { arm1: 0.34, arm2: 0.34, thigh: 0.44, shin: 0.40, hipY: 0.91, ankleY: 0.07, shoulderX: 0.27, shoulderY: 1.45, hipX: 0.115 };

const DARK = 0x262932, DARK2 = 0x1a1c21, VEST = 0x2c303a, PLATE = 0x3b404d, SOLE = 0x101216, BOOT = 0x1f2228;

/** Geometry shared by every actor (bind pose). */
function baseParts() {
  const P = [];
  const add = (pts, bone, role, color, ao) => P.push(part(pts, bone, role, color, ao));
  // ---- pelvis / hips
  add(place(boxP(0.36, 0.17, 0.25, 0.035, 0.38, 0.26), { y: 0.945 }), B.pelvis, 'suit');
  add(place(boxP(0.41, 0.07, 0.28, 0.02), { y: 1.03 }), B.pelvis, 'dark', DARK2);
  add(place(boxP(0.09, 0.05, 0.03, 0.01), { y: 1.03, z: -0.148 }), B.pelvis, 'accent');
  for (const s of [-1, 1]) add(place(boxP(0.07, 0.11, 0.13, 0.02), { x: s * 0.225, y: 0.94, z: 0.02 }), B.pelvis, 'dark', DARK);
  // ---- waist
  add(place(boxP(0.33, 0.2, 0.23, 0.04, 0.38, 0.25), { y: 1.13 }), B.spine, 'suit');
  // ---- chest: tag-vest, plate, emblem, yoke, pack, back band
  add(place(boxP(0.42, 0.30, 0.29, 0.05, 0.52, 0.31), { y: 1.375 }), B.chest, 'dark', VEST);
  add(place(boxP(0.30, 0.20, 0.05, 0.02, 0.34, 0.05), { y: 1.395, z: -0.165 }), B.chest, 'dark', PLATE);
  for (const s of [-1, 1]) add(place(boxP(0.075, 0.03, 0.014, 0.004), { x: s * 0.038, y: 1.42, z: -0.196, rz: -s * 0.55, s: 1 }), B.chest, 'team');
  add(place(boxP(0.03, 0.05, 0.014, 0.004), { y: 1.365, z: -0.196 }), B.chest, 'team');
  add(place(boxP(0.56, 0.07, 0.28, 0.03, 0.5, 0.26), { y: 1.5 }), B.chest, 'suit');
  add(place(boxP(0.30, 0.32, 0.13, 0.03), { y: 1.36, z: 0.21 }), B.chest, 'dark', DARK);
  add(place(boxP(0.33, 0.045, 0.02, 0.005), { y: 1.445, z: 0.281 }), B.chest, 'team');
  add(place(boxP(0.035, 0.22, 0.02, 0.005), { y: 1.335, z: 0.281 }), B.chest, 'team');
  for (const s of [-1, 1]) {
    add(place(sphereP(0.125, 0.085, 0.135, 0), { x: s * 0.315, y: 1.475 }), B.chest, 'suit');
    add(place(boxP(0.014, 0.05, 0.10, 0.004), { x: s * 0.437, y: 1.465 }), B.chest, 'team');
  }
  // ---- team identity bands (always on, readable from every angle)
  add(place(boxP(0.405, 0.045, 0.285, 0.008), { y: 1.085 }), B.spine, 'team');
  add(place(boxP(0.54, 0.035, 0.30, 0.008, 0.52, 0.30), { y: 1.5 }), B.chest, 'team');
  add(place(frustumP(0.092, 0.092, 0.028, 8), { y: 1.515 }), B.neck, 'team');
  add(place(boxP(0.06, 0.12, 0.02, 0.006), { y: 1.69, z: 0.168 }), B.head, 'team');
  // ---- neck + head base
  add(place(frustumP(0.06, 0.055, 0.09, 6), { y: 1.545 }), B.neck, 'dark', DARK2);
  add(place(boxP(0.20, 0.06, 0.10, 0.02), { y: 1.575, z: 0.075 }), B.head, 'dark', DARK);
  add(place(boxP(0.12, 0.06, 0.07, 0.02), { y: 1.55, z: -0.105 }), B.head, 'dark', DARK2);
  for (const s of [-1, 1]) {
    add(place(frustumP(0.052, 0.052, 0.04, 8), { x: s * 0.158, y: 1.645, rz: Math.PI / 2 }), B.head, 'dark', DARK);
    add(place(frustumP(0.03, 0.03, 0.05, 8), { x: s * 0.166, y: 1.645, rz: Math.PI / 2 }), B.head, 'team');
  }
  // ---- arms
  for (const s of [-1, 1]) {
    const uA = s < 0 ? B.uArmL : B.uArmR, fA = s < 0 ? B.fArmL : B.fArmR, hA = s < 0 ? B.handL : B.handR, x = s * 0.27;
    add(place(frustumP(0.082, 0.068, 0.34, 6), { x, y: 1.28 }), uA, 'suit');
    add(place(sphereP(0.068, 0.062, 0.068, 0), { x, y: 1.11 }), fA, 'dark', DARK);
    add(place(frustumP(0.068, 0.06, 0.2, 6), { x, y: 1.0 }), fA, 'suit');
    add(place(frustumP(0.07, 0.066, 0.12, 6), { x, y: 0.835 }), fA, 'dark', DARK);
    add(place(frustumP(0.076, 0.076, 0.03, 6), { x, y: 0.915 }), fA, 'team');
    add(place(boxP(0.092, 0.09, 0.115, 0.022, 0.10, 0.115), { x, y: 0.725 }), hA, 'dark', DARK2);
    add(place(boxP(0.03, 0.06, 0.05, 0.01), { x: x + s * 0.052, y: 0.755, z: -0.02 }), hA, 'dark', DARK2);
  }
  // ---- legs
  for (const s of [-1, 1]) {
    const uL = s < 0 ? B.uLegL : B.uLegR, lL = s < 0 ? B.lLegL : B.lLegR, fT = s < 0 ? B.footL : B.footR, x = s * 0.115;
    add(place(frustumP(0.108, 0.09, 0.44, 7), { x, y: 0.69 }), uL, 'suit');
    add(place(boxP(0.02, 0.3, 0.07, 0.005), { x: x + s * 0.104, y: 0.70 }), uL, 'team');
    add(place(frustumP(0.093, 0.093, 0.035, 7), { x, y: 0.33 }), lL, 'team');
    add(place(sphereP(0.08, 0.07, 0.07, 0), { x, y: 0.47, z: -0.05 }), lL, 'dark', DARK);
    add(place(frustumP(0.088, 0.066, 0.36, 7), { x, y: 0.29 }), lL, 'suit');
    add(place(boxP(0.09, 0.22, 0.04, 0.012, 0.08, 0.04), { x, y: 0.31, z: -0.066 }), lL, 'dark', PLATE);
    add(place(frustumP(0.07, 0.077, 0.11, 7), { x, y: 0.125 }), fT, 'dark', BOOT);
    add(place(boxP(0.13, 0.09, 0.26, 0.03, 0.115, 0.21), { x, y: 0.04, z: -0.06 }), fT, 'dark', BOOT);
    add(place(boxP(0.135, 0.032, 0.285, 0.01), { x, y: 0.016, z: -0.065 }), fT, 'dark', SOLE);
    add(place(boxP(0.105, 0.055, 0.065, 0.02), { x, y: 0.05, z: -0.185 }), fT, 'accent');
  }
  return P;
}

// ---------------------------------------------------------------- cosmetic variants
function shellParts(shape) {
  const P = [], add = (pts, role, color, ao) => P.push(part(pts, B.head, role, color, ao));
  switch (shape) {
    case 'none':
      add(place(sphereP(0.135, 0.13, 0.15, 1), { y: 1.655 }), 'dark', 0x2d3039); break;
    case 'visorcap':
      add(place(sphereP(0.14, 0.125, 0.155, 1), { y: 1.635 }), 'dark', 0x2d3039);
      add(place(sphereP(0.16, 0.085, 0.175, 1), { y: 1.7, z: 0.005 }), 'helmet');
      add(place(boxP(0.24, 0.022, 0.13, 0.008, 0.26, 0.11), { y: 1.685, z: -0.19 }), 'helmet');
      add(place(boxP(0.028, 0.024, 0.22, 0.008), { y: 1.79, z: 0.0 }), 'hAccent'); break;
    case 'hex':
      add(place(frustumP(0.155, 0.145, 0.29, 6, 1, 1.1, 0), { y: 1.655 }), 'helmet');
      add(place(frustumP(0.1, 0.07, 0.03, 6, 1, 1.1, 0), { y: 1.815 }), 'hAccent'); break;
    default:  // round, crest, antenna, horns, halo share the rounded shell
      add(place(sphereP(0.16, 0.145, 0.175, 1), { y: 1.65, z: 0.005 }), 'helmet');
      add(place(boxP(0.03, 0.03, 0.24, 0.008), { y: 1.792 }), 'hAccent');
  }
  if (shape === 'crest') add(place(boxP(0.03, 0.08, 0.26, 0.01, 0.02, 0.16), { y: 1.83, z: 0.02 }), 'hAccent');
  if (shape === 'antenna') {
    add(place(frustumP(0.01, 0.01, 0.14, 4), { x: 0.11, y: 1.84, z: 0.04, rz: -0.25 }), 'hAccent');
    add(place(sphereP(0.026), { x: 0.125, y: 1.92, z: 0.04 }), 'visor');
  }
  if (shape === 'horns') for (const s of [-1, 1]) add(place(frustumP(0.03, 0.006, 0.11, 5), { x: s * 0.12, y: 1.82, z: -0.01, rz: -s * 0.5 }), 'hAccent');
  if (shape === 'halo') {
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; add(place(boxP(0.1, 0.02, 0.02, 0.005), { x: Math.cos(a) * 0.17, y: 1.88, z: Math.sin(a) * 0.17, ry: -a }), 'visor'); }
  }
  return P;
}
function visorParts(shape) {
  const P = [], add = (pts, role, color) => P.push(part(pts, B.head, role, color));
  const y = 1.63, z = -0.158;
  switch (shape) {
    case 'slit':
      add(place(boxP(0.26, 0.032, 0.04, 0.01), { y, z }), 'visor'); add(place(boxP(0.285, 0.055, 0.03, 0.01), { y, z: z + 0.012 }), 'team'); break;
    case 'round':
      for (const s of [-1, 1]) { add(place(frustumP(0.042, 0.042, 0.035, 10), { x: s * 0.062, y, z, rx: Math.PI / 2 }), 'visor'); add(place(frustumP(0.056, 0.056, 0.03, 10), { x: s * 0.062, y, z: z + 0.012, rx: Math.PI / 2 }), 'team'); } break;
    case 'shades':
      for (const s of [-1, 1]) { add(place(boxP(0.115, 0.06, 0.04, 0.012, 0.105, 0.04), { x: s * 0.068, y, z, rz: -s * 0.14 }), 'visor'); add(place(boxP(0.13, 0.075, 0.03, 0.01), { x: s * 0.068, y, z: z + 0.012, rz: -s * 0.14 }), 'team'); } break;
    case 'cyclops':
      add(place(frustumP(0.06, 0.06, 0.035, 10), { y, z, rx: Math.PI / 2 }), 'visor'); add(place(frustumP(0.078, 0.078, 0.03, 10), { y, z: z + 0.012, rx: Math.PI / 2 }), 'team'); break;
    case 'x':
      for (const s of [-1, 1]) add(place(boxP(0.2, 0.03, 0.04, 0.008), { y, z, rz: s * 0.6 }), 'visor');
      add(place(boxP(0.26, 0.10, 0.025, 0.008), { y, z: z + 0.014 }), 'team'); break;
    default: // wide
      add(place(boxP(0.25, 0.07, 0.05, 0.015, 0.27, 0.05), { y, z }), 'visor');
      add(place(boxP(0.285, 0.098, 0.03, 0.01), { y, z: z + 0.014 }), 'team');
  }
  return P;
}
function backParts(model) {
  const P = [], add = (pts, bone, role, color) => P.push(part(pts, bone, role, color));
  switch (model) {
    case 'pack':
      add(place(boxP(0.36, 0.42, 0.2, 0.04), { y: 1.32, z: 0.3 }), B.chest, 'back');
      add(place(boxP(0.3, 0.05, 0.16, 0.015), { y: 1.55, z: 0.3 }), B.chest, 'accent'); break;
    case 'wings':
      for (const s of [-1, 1]) {
        add(place(slabP([[0, 0], [0.16, 0.16], [0.3, 0.34], [0.26, 0.04], [0.2, -0.24], [0.06, -0.18]], 0.025), { x: s * 0.07, y: 1.4, z: 0.25, ry: s * 1.05, rz: s * -0.1, sx: s }), B.chest, 'back');
        add(place(slabP([[0.14, 0.14], [0.3, 0.34], [0.33, 0.28], [0.19, 0.1]], 0.03), { x: s * 0.07, y: 1.4, z: 0.25, ry: s * 1.05, rz: s * -0.1, sx: s }), B.chest, 'team');
      } break;
    case 'tail':
      for (let i = 0; i < 5; i++) { const t = i / 4; add(place(boxP(0.075 - t * 0.04, 0.07, 0.14, 0.02), { y: 0.9 + t * t * 0.3, z: 0.2 + t * 0.26, rx: 0.35 + t * 0.5 }), B.pelvis, i === 4 ? 'team' : 'back'); } break;
    case 'jet':
      for (const s of [-1, 1]) {
        add(place(frustumP(0.058, 0.05, 0.34, 8), { x: s * 0.115, y: 1.33, z: 0.3 }), B.chest, 'back');
        add(place(frustumP(0.048, 0.062, 0.05, 8), { x: s * 0.115, y: 1.135, z: 0.3 }), B.chest, 'visor');
      } break;
    case 'banner':
      add(place(frustumP(0.011, 0.011, 0.6, 5), { x: 0.1, y: 1.65, z: 0.28 }), B.chest, 'dark', 0x33363f);
      add(place(boxP(0.2, 0.22, 0.012, 0.004), { x: 0.2, y: 1.84, z: 0.28 }), B.chest, 'back');
      add(place(boxP(0.2, 0.04, 0.016, 0.004), { x: 0.2, y: 1.76, z: 0.28 }), B.chest, 'team'); break;
  }
  return P;
}

let _base = null; const _cache = new Map();
/** Merged skinned-mesh geometry for a (helmet, visor, back) combo; shared by every actor using it. */
export function getBodyGeometry(helmet = 'round', visor = 'wide', back = 'none') {
  const key = `${helmet}|${visor}|${back}`;
  let g = _cache.get(key); if (g) return g;
  if (!_base) _base = baseParts();
  // base parts must be re-merged each time (merge disposes inputs) → keep clones
  const list = _base.map((b) => b.clone());
  for (const p of shellParts(helmet)) list.push(p);
  for (const p of visorParts(visor)) list.push(p);
  for (const p of backParts(back)) list.push(p);
  g = merge(list); g.userData.key = key;
  _cache.set(key, g); return g;
}

/** Build the bone hierarchy. Returns {root, bones[], byName}. Bones sit at bind-pose positions (local offsets). */
export function createBones() {
  const root = new THREE.Group(); root.name = 'actorRoot';
  const bones = [], w = BONES.map((b) => new THREE.Vector3(...b[2]));
  BONES.forEach(([name, parent], i) => {
    const b = new THREE.Bone(); b.name = name;
    if (parent < 0) { b.position.copy(w[i]); root.add(b); } else { b.position.copy(w[i]).sub(w[parent]); bones[parent].add(b); }
    bones.push(b);
  });
  return { root, bones };
}
