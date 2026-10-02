// Oriented-capsule hitboxes that follow the animated bones (crouch/slide/lean change them automatically).
// Broad phase: one bounding sphere per actor. Narrow phase: ~17 ray/capsule tests. No allocation except the returned hit.
import * as THREE from 'three';
import { B } from './body.js';

// [group, boneA, ax, ay, az, boneB, bx, by, bz, radius]
const C = (g, b0, o0, b1, o1, r) => [g, b0, o0[0], o0[1], o0[2], b1, o1[0], o1[1], o1[2], r];
export const CAPS = [
  C('crown', B.head, [0, 0.02, 0.0], B.head, [0, 0.05, 0], 0.165),
  C('chest', B.chest, [0, 0.0, 0], B.chest, [0, 0.1, 0], 0.225),
  C('chest', B.neck, [0, -0.04, 0], B.neck, [0, 0.03, 0], 0.07),
  C('stomach', B.pelvis, [0, -0.01, 0], B.spine, [0, 0.16, 0], 0.205),
  C('stomach', B.uLegL, [0, 0.02, 0], B.uLegR, [0, 0.02, 0], 0.125),
  C('arm', B.uArmL, [0, 0, 0], B.fArmL, [0, 0, 0], 0.085), C('arm', B.fArmL, [0, 0, 0], B.handL, [0, 0, 0], 0.076), C('arm', B.handL, [0, -0.03, 0], B.handL, [0, -0.09, 0], 0.075),
  C('arm', B.uArmR, [0, 0, 0], B.fArmR, [0, 0, 0], 0.085), C('arm', B.fArmR, [0, 0, 0], B.handR, [0, 0, 0], 0.076), C('arm', B.handR, [0, -0.03, 0], B.handR, [0, -0.09, 0], 0.075),
  C('leg', B.uLegL, [0, 0, 0], B.lLegL, [0, 0, 0], 0.118), C('leg', B.lLegL, [0, 0, 0], B.footL, [0, 0, 0], 0.092), C('leg', B.footL, [0, -0.03, 0.03], B.footL, [0, -0.03, -0.2], 0.07),
  C('leg', B.uLegR, [0, 0, 0], B.lLegR, [0, 0, 0], 0.118), C('leg', B.lLegR, [0, 0, 0], B.footR, [0, 0, 0], 0.092), C('leg', B.footR, [0, -0.03, 0.03], B.footR, [0, -0.03, -0.2], 0.07),
];
export const NC = CAPS.length;
export const GROUP_COLORS = { crown: 0xff3060, chest: 0xffb000, stomach: 0xffe040, arm: 0x40d0ff, leg: 0x60ff90 };
const _pa = new THREE.Vector3(), _pb = new THREE.Vector3(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3(), _sh = new THREE.Vector3(), _c = new THREE.Vector3();

export function makeHb() { const a = [], b = []; for (let i = 0; i < NC; i++) { a.push(new THREE.Vector3()); b.push(new THREE.Vector3()); } return { a, b, tick: -1 }; }

/** Refresh capsule endpoints (world) from bone matrices; shifted so hits are lag-free vs the true actor.pos. */
export function refreshHb(m, tick, force = false) {
  const hb = m.hb || (m.hb = makeHb());
  if (!force && hb.tick === tick) return hb; hb.tick = tick;
  _sh.set(m.actor.pos.x - m.root.position.x, 0, m.actor.pos.z - m.root.position.z);
  if (m.actor.pos.y - m.gy > 0.01 || m.gy - m.actor.pos.y > 0.01) _sh.y = m.actor.pos.y - m.gy;
  for (let i = 0; i < NC; i++) {
    const c = CAPS[i];
    hb.a[i].set(c[2], c[3], c[4]).applyMatrix4(m.bones[c[1]].matrixWorld).add(_sh);
    hb.b[i].set(c[6], c[7], c[8]).applyMatrix4(m.bones[c[5]].matrixWorld).add(_sh);
  }
  return hb;
}

/** Ray vs capsule (pa,pb,r). Returns entry t (>=0) or -1. */
function capT(ro, rd, pa, pb, r) {
  const bax = pb.x - pa.x, bay = pb.y - pa.y, baz = pb.z - pa.z, oax = ro.x - pa.x, oay = ro.y - pa.y, oaz = ro.z - pa.z;
  const baba = bax * bax + bay * bay + baz * baz, bard = bax * rd.x + bay * rd.y + baz * rd.z, baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = rd.x * oax + rd.y * oay + rd.z * oaz, oaoa = oax * oax + oay * oay + oaz * oaz;
  if (baba < 1e-8) { const b = rdoa, c = oaoa - r * r, h = b * b - c; if (h < 0) return -1; const t = -b - Math.sqrt(h); return t >= 0 ? t : (c < 0 ? 0 : -1); }
  const a = baba - bard * bard, b = baba * rdoa - baoa * bard, c = baba * oaoa - baoa * baoa - r * r * baba;
  if (c < 0 && baoa > 0 && baoa < baba) return 0;      // origin inside the cylinder part
  let h = b * b - a * c;
  if (a > 1e-9 && h >= 0) {
    h = Math.sqrt(h); const t = (-b - h) / a, y = baoa + t * bard;
    if (t >= 0 && y > 0 && y < baba) return t;
  }
  // end caps
  let best = -1;
  for (let k = 0; k < 2; k++) {
    const cx = k ? ro.x - pb.x : oax, cy = k ? ro.y - pb.y : oay, cz = k ? ro.z - pb.z : oaz;
    const b2 = rd.x * cx + rd.y * cy + rd.z * cz, c2 = cx * cx + cy * cy + cz * cz - r * r, h2 = b2 * b2 - c2;
    if (h2 < 0) continue; const t = -b2 - Math.sqrt(h2);
    if (t >= 0) { const y = baoa + t * bard; if ((k === 0 && y <= 0) || (k === 1 && y >= baba)) { if (best < 0 || t < best) best = t; } }
    else if (c2 < 0) return 0;
  }
  return best;
}

const BROAD_R = 1.3;
/** Broad phase: does segment ro + t*rd (t in [0,far]) come within BROAD_R of the actor's centre? */
export function broad(m, ro, rd, far) {
  _c.set(m.actor.pos.x, m.actor.pos.y + 0.95, m.actor.pos.z).sub(ro);
  const t = clamp0(_c.dot(rd), far); const dx = _c.x - rd.x * t, dy = _c.y - rd.y * t, dz = _c.z - rd.z * t;
  return dx * dx + dy * dy + dz * dz <= BROAD_R * BROAD_R;
}
const clamp0 = (t, far) => (t < 0 ? 0 : t > far ? far : t);

/** Nearest capsule hit for model m: returns index (or -1) and sets m._t. */
export function narrow(m, ro, rd, far, tick) {
  const hb = refreshHb(m, tick); let best = -1, bt = far;
  for (let i = 0; i < NC; i++) { const t = capT(ro, rd, hb.a[i], hb.b[i], CAPS[i][9]); if (t >= 0 && (t < bt || (best >= 0 && i === 0 && t <= bt + 0.06))) { bt = Math.min(bt, t); best = i; } }
  m._t = bt; return best;
}
export function fillHit(m, i, ro, rd, t, out) {
  const hb = m.hb; out.actor = m.actor; out.hitgroup = CAPS[i][0]; out.distance = t;
  out.point = new THREE.Vector3().copy(rd).multiplyScalar(t).add(ro);
  // normal: from closest point on the capsule axis
  _pa.copy(hb.a[i]); _pb.copy(hb.b[i]); const ab = _pb.sub(_pa), l2 = ab.lengthSq();
  const k = l2 > 1e-9 ? clampU(_c.copy(out.point).sub(hb.a[i]).dot(ab) / l2) : 0;
  _pa.addScaledVector(ab, k); out.normal = new THREE.Vector3().copy(out.point).sub(_pa).normalize();
  out.capsule = i; return out;
}
const clampU = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Random point inside the body volume (used to seed tag-out shards). */
export function sampleBody(m, out, rnd) {
  const hb = m.hb || refreshHb(m, -1, true);
  // weight by capsule "volume"
  let tot = 0; for (let i = 0; i < NC; i++) tot += CAPS[i][9] * CAPS[i][9] * (hb.a[i].distanceTo(hb.b[i]) + CAPS[i][9] * 1.3);
  let x = rnd() * tot, k = 0; for (; k < NC - 1; k++) { x -= CAPS[k][9] * CAPS[k][9] * (hb.a[k].distanceTo(hb.b[k]) + CAPS[k][9] * 1.3); if (x <= 0) break; }
  const t = rnd(), r = CAPS[k][9] * 0.85;
  out.x = hb.a[k].x + (hb.b[k].x - hb.a[k].x) * t + (rnd() - 0.5) * 2 * r; out.y = hb.a[k].y + (hb.b[k].y - hb.a[k].y) * t + (rnd() - 0.5) * 2 * r; out.z = hb.a[k].z + (hb.b[k].z - hb.a[k].z) * t + (rnd() - 0.5) * 2 * r;
  return out;
}

/** Debug wireframe overlay: each capsule = wire cylinder + two wire spheres. */
export function createDebugMesh(m) {
  const g = new THREE.Group(); g.name = 'hitboxDebug'; const list = [];
  for (let i = 0; i < NC; i++) {
    const r = CAPS[i][9];
    const mat = new THREE.MeshBasicMaterial({ color: GROUP_COLORS[CAPS[i][0]], wireframe: true, transparent: true, opacity: 0.6, depthTest: false });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12, 1, true), mat), s0 = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6), mat), s1 = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6), mat);
    for (const o of [cyl, s0, s1]) { o.renderOrder = 999; o.frustumCulled = false; g.add(o); }
    list.push([cyl, s0, s1]);
  }
  g.userData.list = list; return g;
}
const _up = new THREE.Vector3(0, 1, 0);
export function updateDebugMesh(m, dbg, tick) {
  const hb = refreshHb(m, tick, true);
  for (let i = 0; i < NC; i++) {
    const [cyl, s0, s1] = dbg.userData.list[i], a = hb.a[i], b = hb.b[i], len = a.distanceTo(b);
    s0.position.copy(a); s1.position.copy(b); cyl.visible = len > 1e-3;
    if (cyl.visible) { cyl.position.copy(a).add(b).multiplyScalar(0.5); _pa.copy(b).sub(a).normalize(); cyl.quaternion.setFromUnitVectors(_up, _pa); cyl.scale.set(1, len, 1); }
  }
}
