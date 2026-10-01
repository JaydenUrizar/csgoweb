// Path validation: sample random point pairs, walk every returned path with capsule sweeps against the BVH and prove no clipping.
import * as THREE from 'three';
import { makeCapsule } from './graph.js';
import { mulberry32 } from '../../core/rng.js';

/**
 * opts: {pairs=2000, seed=1, step=0.1, jitter=0.2, radius=0.36 (exact player radius, no margin)}
 * Returns a report object. A walk segment is "clean" if for every 0.1 m sample: floor found within 0.55 m of the interpolated
 * height, the (step-lifted) capsule at the floor doesn't intersect geometry and there's 1.8 m of headroom. Jump/drop hops are
 * checked at their endpoints plus a flat-arc ray test.
 */
export function validatePaths(sys, opts = {}) {
  const { pairs = 2000, seed = 1, step = 0.1, jitter = 0.2, radius = 0.36 } = opts;
  const g = sys.g, cfg = sys.cfg, bvh = sys.bvh, rnd = mulberry32(seed * 31 + 5);
  const hits = makeCapsule(bvh, { radius, stepUp: cfg.stepUp, height: cfg.height });
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0)), dir = new THREE.Vector3();
  const floorAt = (x, y, z) => { ray.origin.set(x, y + 0.6, z); ray.direction.set(0, -1, 0); const h = bvh.raycastFirst(ray, THREE.FrontSide, 0, 2.5); return h ? y + 0.6 - h.distance : NaN; };
  const headroom = (x, y, z) => { ray.origin.set(x, y + 0.05, z); ray.direction.set(0, 1, 0); const h = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 1.75); return !h; };
  const blockedRay = (a, b) => { dir.subVectors(b, a); const len = dir.length(); if (len < 1e-4) return false; dir.multiplyScalar(1 / len); ray.origin.copy(a); ray.direction.copy(dir); return !!bvh.raycastFirst(ray, THREE.DoubleSide, 0, len - 0.01); };
  const A = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3();

  const rep = { pairs, ok: 0, fail: 0, clipped: 0, floating: 0, wallRay: 0, hopBad: 0, samples: 0, points: 0, hops: 0, jumps: 0, drops: 0, dist: 0, straight: 0, worst: [], nullPaths: [], startInWall: 0, ratioMax: 0 };
  const note = (kind, i, p, extra) => { if (rep.worst.length < 12) rep.worst.push({ kind, pair: i, at: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], ...extra }); };
  const t0 = performance.now(); let hash = 0;
  for (let i = 0; i < pairs; i++) {
    const n1 = Math.floor(rnd() * g.N), n2 = Math.floor(rnd() * g.N);
    const j = rnd() < 0.5 ? jitter : 0;
    const from = new THREE.Vector3(g.px[n1] + (rnd() - 0.5) * 2 * j, g.py[n1], g.pz[n1] + (rnd() - 0.5) * 2 * j);
    const to = new THREE.Vector3(g.px[n2] + (rnd() - 0.5) * 2 * j, g.py[n2], g.pz[n2] + (rnd() - 0.5) * 2 * j);
    const p = sys.path(from, to, { noCache: true });
    if (!p) { rep.fail++; if (rep.nullPaths.length < 5) rep.nullPaths.push([from.toArray().map((v) => +v.toFixed(1)), to.toArray().map((v) => +v.toFixed(1))]); continue; }
    rep.ok++; rep.points += p.length; rep.dist += p.dist; rep.straight += Math.hypot(to.x - from.x, to.z - from.z);
    for (const q of p) hash = (Math.imul(hash, 31) + Math.round(q.x * 100) * 7 + Math.round(q.y * 100) * 13 + Math.round(q.z * 100)) | 0;
    let prev = from, bad = false; const startClip = hits(from.x, from.y, from.z);
    for (let k = 0; k < p.length; k++) {
      const cur = p[k], fl = p.flags[k];
      if (fl !== 0) {   // hop
        rep.hops++; if (fl === 1) rep.jumps++; else rep.drops++;
        if (hits(prev.x, prev.y, prev.z) && !(k === 0 && startClip)) { rep.hopBad++; note('hop-start-clip', i, prev); bad = true; }
        if (hits(cur.x, cur.y, cur.z)) { rep.hopBad++; note('hop-end-clip', i, cur); bad = true; }
        const hi = Math.max(prev.y, cur.y) + 1.3; A.set(prev.x, hi, prev.z); B.set(cur.x, hi, cur.z);
        if (blockedRay(A, B)) { rep.hopBad++; note('hop-arc-blocked', i, prev); bad = true; }
        prev = cur; continue;
      }
      const dx = cur.x - prev.x, dz = cur.z - prev.z, dy = cur.y - prev.y, len = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(len / step));
      let py = prev.y, lastX = prev.x, lastZ = prev.z;
      for (let s = (k === 0 && startClip) ? 2 : 0; s <= n; s++) {
        const t = s / n, x = prev.x + dx * t, z = prev.z + dz * t; rep.samples++;
        let fy = floorAt(x, py, z);
        if (!(fy === fy) || Math.abs(fy - py) > 0.55) { rep.floating++; note('floating', i, P.set(x, py, z), { floor: fy }); bad = true; break; }
        if (hits(x, fy, z)) { rep.clipped++; note('clip', i, P.set(x, fy, z)); bad = true; break; }
        if (!headroom(x, fy, z)) { rep.clipped++; note('headroom', i, P.set(x, fy, z)); bad = true; break; }
        if (s > 0) {   // centre-line rays between samples at chest / head height
          for (const h of [0.9, 1.5]) { A.set(lastX, py + h, lastZ); B.set(x, fy + h, z); if (blockedRay(A, B)) { rep.wallRay++; note('wall-ray', i, A); bad = true; break; } }
          if (bad) break;
        }
        lastX = x; lastZ = z; py = fy;
      }
      if (bad) break; prev = cur;
    }
    if (startClip) rep.startInWall++;
    const ratio = p.dist / Math.max(1e-3, Math.hypot(to.x - from.x, to.z - from.z)); if (ratio > rep.ratioMax && p.dist > 8) rep.ratioMax = ratio;
    if (bad) rep.badPaths = (rep.badPaths || 0) + 1;
  }
  rep.ms = performance.now() - t0; rep.hash = hash >>> 0;
  rep.clean = rep.fail === 0 && !rep.badPaths;
  rep.avgPts = rep.points / Math.max(1, rep.ok); rep.avgLen = rep.dist / Math.max(1, rep.ok); rep.detour = rep.dist / Math.max(1, rep.straight);
  rep.badPaths = rep.badPaths || 0;
  return rep;
}
