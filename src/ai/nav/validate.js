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
    // jittered endpoints (off-node queries) are only used where the capsule itself fits there
    const pick = (n) => { const q = new THREE.Vector3(g.px[n] + (rnd() - 0.5) * 2 * j, g.py[n], g.pz[n] + (rnd() - 0.5) * 2 * j); const fl = floorAt(q.x, q.y, q.z); return j && !hits(q.x, q.y, q.z) && fl === fl && Math.abs(fl - q.y) < 0.1 ? q : new THREE.Vector3(g.px[n], g.py[n], g.pz[n]); };
    const from = pick(n1), to = pick(n2);
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
    for (let k = 0; k + 2 < p.length; k++) if (p.flags[k] === 1) { let d = 0, hit = false; for (let q = k + 1; q < Math.min(p.length, k + 4); q++) { d += Math.hypot(p[q].x - p[q - 1].x, p[q].z - p[q - 1].z); if (p.flags[q] === 2 && d < 6 && Math.abs(p[q].y - p[k - (k > 0 ? 1 : 0)].y) < 0.4) { hit = true; break; } } if (hit) { rep.hopOvers = (rep.hopOvers || 0) + 1; break; } }
    const ratio = p.dist / Math.max(1e-3, Math.hypot(to.x - from.x, to.z - from.z)); if (ratio > rep.ratioMax && p.dist > 8) rep.ratioMax = ratio;
    if (bad) { rep.badPaths = (rep.badPaths || 0) + 1; (rep.badSamples = rep.badSamples || []).length < 3 && rep.badSamples.push({ from: from.toArray().map((v) => +v.toFixed(2)), to: to.toArray().map((v) => +v.toFixed(2)), path: p.map((q, k) => [+q.x.toFixed(2), +q.y.toFixed(2), +q.z.toFixed(2), p.flags[k]]) }); }
  }
  rep.ms = performance.now() - t0; rep.hash = hash >>> 0;
  rep.clean = rep.fail === 0 && !rep.badPaths;
  rep.avgPts = rep.points / Math.max(1, rep.ok); rep.avgLen = rep.dist / Math.max(1, rep.ok); rep.detour = rep.dist / Math.max(1, rep.straight);
  rep.badPaths = rep.badPaths || 0; rep.hopOvers = rep.hopOvers || 0;
  return rep;
}

/** Fraction of standable spots (capsule fits, floor ok) within 3 m of the navgrid that have no node within 1 m. */
export function coverageReport(sys, samples = 4000, seed = 3) {
  const g = sys.g, cfg = sys.cfg, bvh = sys.bvh, rnd = mulberry32(seed * 977 + 1), b = g.bounds;
  const hits = makeCapsule(bvh, { radius: 0.36, stepUp: cfg.stepUp, height: cfg.height });
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0)); let tested = 0, miss = 0; const missAt = [];
  for (let i = 0; i < samples * 6 && tested < samples; i++) {
    const x = b.min.x + rnd() * (b.max.x - b.min.x), z = b.min.z + rnd() * (b.max.z - b.min.z);
    const nn = g.nearest(x, 1, z, 3); if (nn < 0) continue;
    let y = b.max.y + 0.5, found = null;
    for (let k = 0; k < 8; k++) { ray.origin.set(x, y, z); const h = bvh.raycastFirst(ray, THREE.FrontSide, 0, y - b.min.y + 1); if (!h) break; const hy = y - h.distance; if (h.face.normal.y > 0.72 && Math.abs(hy - g.py[nn]) < 1.2 || (h.face.normal.y > 0.72 && g.nearest(x, hy, z, 3) >= 0 && Math.abs(g.py[g.nearest(x, hy, z, 3)] - hy) < 1.2)) { found = hy; break; } y = hy - 0.02; }
    if (found === null || hits(x, found, z)) continue;
    ray.origin.set(x, found + 0.05, z); ray.direction.set(0, 1, 0); const up = bvh.raycastFirst(ray, THREE.DoubleSide, 0, 1.8); ray.direction.set(0, -1, 0); if (up) continue;
    tested++; const n = g.nearest(x, found, z, 1.0); if (n < 0 || Math.abs(g.py[n] - found) > 1.0) { miss++; if (missAt.length < 8) missAt.push([+x.toFixed(1), +found.toFixed(1), +z.toFixed(1)]); }
  }
  return { tested, miss, missRate: miss / Math.max(1, tested), missAt };
}

/** Timing of the tactical queries (wall clock, µs): coverPoints / holdSpots / holdAngles / visible. */
export function tacticsBench(sys, calls = 150, seed = 11) {
  const g = sys.g, T = sys.tactics, rnd = mulberry32(seed * 131 + 7), a = new THREE.Vector3(), b = new THREE.Vector3();
  const stat = (arr) => { arr.sort((x, y) => x - y); return { avg: +(arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(1), p95: +arr[Math.floor(arr.length * 0.95)].toFixed(1), max: +arr[arr.length - 1].toFixed(1) }; };
  const out = {}; const t = { cover: [], hold: [], angles: [], vis: [], rand: [] };
  for (let i = 0; i < calls; i++) {
    g.nodePos(Math.floor(rnd() * g.N), a); let n2 = Math.floor(rnd() * g.N); g.nodePos(n2, b);
    let t0 = performance.now(); T.coverPoints(a, b, 12, { max: 3 }); t.cover.push((performance.now() - t0) * 1000);
    t0 = performance.now(); T.holdSpots(a, b, 14); t.hold.push((performance.now() - t0) * 1000);
    t0 = performance.now(); T.holdAngles(a); t.angles.push((performance.now() - t0) * 1000);
    t0 = performance.now(); T.visible(a, b); t.vis.push((performance.now() - t0) * 1000);
    t0 = performance.now(); T.randomPointNear(a, 6); t.rand.push((performance.now() - t0) * 1000);
  }
  for (const k of Object.keys(t)) out[k] = stat(t[k]);
  return out;
}
