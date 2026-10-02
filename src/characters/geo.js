// Low-poly modelling helpers for the avatar rig. Every solid is the convex hull of a point cloud, which gives
// crisp flat facets (per-face normals) with very few triangles. Geometry is authored in ROOT space at the bind
// pose (character standing, arms hanging, facing -Z, +X = character's right) and bound rigidly to a bone.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _c = new THREE.Color();

/** Chamfered, optionally tapered box centred on the origin: bottom w x d, top w1 x d1. */
export function boxP(w, h, d, b = 0.02, w1 = w, d1 = d) {
  const pts = [];
  if (b < 0.011) { for (const sy of [-1, 1]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const W = sy < 0 ? w : w1, D = sy < 0 ? d : d1; pts.push(V(sx * W / 2, sy * h / 2, sz * D / 2)); } return pts; }
  for (const sy of [-1, 1]) {
    const W = sy < 0 ? w : w1, D = sy < 0 ? d : d1, y = sy * h / 2;
    const bb = Math.min(b, W / 2 - 0.001, D / 2 - 0.001, h / 2 - 0.001);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      pts.push(V(sx * W / 2, y - sy * bb, sz * (D / 2 - bb)), V(sx * (W / 2 - bb), y, sz * (D / 2 - bb)), V(sx * (W / 2 - bb), y - sy * bb, sz * D / 2));
    }
  }
  return pts;
}
/** Frustum / prism with n sides, bottom radius r0, top radius r1, height h (centred), optional x/z squash, rot offset. */
export function frustumP(r0, r1, h, n = 6, sx = 1, sz = 1, rot = Math.PI / n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pts.push(V(c * r0 * sx, -h / 2, s * r0 * sz), V(c * r1 * sx, h / 2, s * r1 * sz));
  }
  return pts;
}
const _ico = [];
function icoPts(detail) {
  if (_ico[detail]) return _ico[detail];
  const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position, seen = new Map(), out = [];
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    if (!seen.has(k)) { seen.set(k, 1); out.push(V(p.getX(i), p.getY(i), p.getZ(i))); }
  }
  g.dispose(); return (_ico[detail] = out);
}
export function sphereP(rx, ry = rx, rz = rx, detail = 0) { return icoPts(detail).map((p) => V(p.x * rx, p.y * ry, p.z * rz)); }
/** Flat n-gon slab (star / petal shapes) extruded to thickness t. pts2 = [[x,y]...] */
export function slabP(pts2, t = 0.02) {
  const out = []; for (const [x, y] of pts2) { out.push(V(x, y, -t / 2), V(x, y, t / 2)); } return out;
}
/** Translate/rotate/scale a point cloud. */
export function place(pts, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sx = s, sy = s, sz = s } = {}) {
  _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _s.set(sx, sy, sz); _m.compose(V(x, y, z), _q, _s);
  return pts.map((p) => p.clone().applyMatrix4(_m));
}
export function hull(points) {
  const g = new ConvexGeometry(points);
  g.deleteAttribute('uv'); return g;
}

// Roles: masks used by the actor shader to pick a colour per vertex.
//  suit, accent, team(emissive), visor(emissive)  -> aRole ;  helmet, hAccent, back -> aRole2 ; 'dark' = fixed colour.
const ROLE_A = { suit: [1, 0, 0, 0], accent: [0, 1, 0, 0], team: [0, 0, 1, 0], visor: [0, 0, 0, 1] };
const ROLE_B = { helmet: [1, 0, 0, 0], hAccent: [0, 1, 0, 0], back: [0, 0, 1, 0] };

/**
 * Bake a hull into a fully attributed geometry.
 * bone = index into the skeleton, role = key above or 'dark', color = hex for dark parts, ao = brightness bias.
 */
export function part(points, bone, role = 'dark', color = 0x2a2d35, ao = 1) {
  const g = hull(points); const n = g.attributes.position.count;
  const col = new Float32Array(n * 3), ra = new Float32Array(n * 4), rb = new Float32Array(n * 4);
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  _c.set(color); const A = ROLE_A[role] || [0, 0, 0, 0], B = ROLE_B[role] || [0, 0, 0, 0];
  const pos = g.attributes.position;
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i);
    // cheap baked occlusion: darker toward the ground and toward the underside of parts
    const shade = (0.78 + 0.22 * THREE.MathUtils.smoothstep(y, 0.05, 1.6)) * ao;
    if (role === 'dark') { col[i * 3] = _c.r * shade; col[i * 3 + 1] = _c.g * shade; col[i * 3 + 2] = _c.b * shade; }
    else { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = shade; }
    ra.set(A, i * 4); rb.set(B, i * 4); si[i * 4] = bone; sw[i * 4] = 1;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aRole', new THREE.BufferAttribute(ra, 4));
  g.setAttribute('aRole2', new THREE.BufferAttribute(rb, 4));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  return g;
}
export function merge(list) {
  const g = mergeGeometries(list, false);
  for (const l of list) l.dispose();
  return g;
}
export { V };
