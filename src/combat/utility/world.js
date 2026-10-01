import * as THREE from 'three';
// Thin wrapper over the map collision BVH (three-mesh-bvh). Defensive: works with no map (flat floor fallback).
const _ray = new THREE.Ray(), _tgt = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 }, _n = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
export function createWorld(ctx) {
  let override = null;
  const W = {
    /** Override the collision mesh (used by the utility lab). null => ctx.map.collider */
    set(mesh) { override = mesh; },
    get mesh() { return override || ctx.map?.collider || null; },
    get bvh() { return W.mesh?.geometry?.boundsTree || null; },
    get ready() { return !!W.bvh; },
    /** First hit along a ray (both faces). out = {dist, normal, point?}. Returns false on miss. */
    raycast(o, d, far, out) {
      const bvh = W.bvh;
      if (!bvh) { // floor plane fallback at y=0
        if (d.y >= -1e-6) return false; const t = -o.y / d.y; if (t < 0 || t > far) return false;
        if (out) { out.dist = t; out.normal.set(0, 1, 0); } return true;
      }
      _ray.origin.copy(o); _ray.direction.copy(d);
      const h = bvh.raycastFirst(_ray, THREE.DoubleSide, 0, far);
      if (!h) return false;
      if (out) {
        out.dist = h.distance;
        const f = h.face; if (f?.normal) out.normal.copy(f.normal); else out.normal.set(0, 1, 0);
        if (out.normal.dot(d) > 0) out.normal.negate();
        if (out.point) out.point.copy(h.point);
      }
      return true;
    },
    /** true if the straight segment a->b touches world geometry */
    segmentBlocked(a, b) {
      _b.subVectors(b, a); const len = _b.length(); if (len < 1e-5) return false; _b.multiplyScalar(1 / len);
      return W.raycast(a, _b, len, null);
    },
    /** Closest world-surface point within maxD. Returns target ({point,distance,faceIndex}) or null. */
    closest(p, maxD = 1) {
      const bvh = W.bvh;
      if (!bvh) { const y = 0; const dist = Math.abs(p.y - y); if (dist > maxD) return null; _tgt.point.set(p.x, y, p.z); _tgt.distance = dist; _tgt.faceIndex = -1; return _tgt; }
      const r = bvh.closestPointToPoint(p, _tgt, 0, maxD);
      return r && r.distance <= maxD ? r : null;
    },
    /** Push a sphere out of geometry. Returns penetration normal in `nrm` and true if touched. */
    pushOut(p, radius, nrm) {
      const r = W.closest(p, radius); if (!r) return false;
      const d = r.distance;
      if (d >= radius) return false;
      if (d > 1e-5) nrm.subVectors(p, r.point).multiplyScalar(1 / d);
      else { // centre exactly on the surface: use face normal
        nrm.set(0, 1, 0);
        const bvh = W.bvh; if (bvh && r.faceIndex >= 0) { const idx = bvh.geometry.index, pos = bvh.geometry.attributes.position; const i3 = r.faceIndex * 3; const ia = idx ? idx.getX(i3) : i3, ib = idx ? idx.getX(i3 + 1) : i3 + 1, ic = idx ? idx.getX(i3 + 2) : i3 + 2; _a.fromBufferAttribute(pos, ia); _b.fromBufferAttribute(pos, ib); _c.fromBufferAttribute(pos, ic); _b.sub(_a); _c.sub(_a); nrm.crossVectors(_b, _c).normalize(); }
      }
      p.addScaledVector(nrm, radius - d + 1e-4);
      return true;
    },
    /** Surface material name under a point (optional map hook). */
    surface(p) { try { return ctx.map?.surfaceAt?.(p) || 'stone'; } catch { return 'stone'; } },
  };
  return W;
}
