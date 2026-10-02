// Bakes lamp light into vertex colours: tessellates triangles near lamps (<=1.1 m edges) and modulates albedo by
// visibility-tested, distance- and normal-weighted lamp contributions (warm pools on floors/walls/ceilings/arch undersides).
// Render must NOT re-light these surfaces with the same lamps at full strength (see docs/requests/render-from-map-1.md).
import * as THREE from 'three';

const SKIP = new Set(['emissive', 'signs', 'contact', 'water', 'glass', 'foliage']);
const KIND_K = { lantern: 1.0, wall: 0.85, post: 0.5, plinth: 0.4, fountain: 0.4, lamp: 0.6 };
let MAXE = 1.9;

export function bakeLamps(builders, lamps, visible, opts = {}) {
  const _c = new THREE.Color();
  const L = lamps.map((l) => { _c.setHex(l.color); const m = Math.max(_c.r, _c.g, _c.b) || 1; return { x: l.pos[0] ?? l.pos.x, y: l.pos[1] ?? l.pos.y, z: l.pos[2] ?? l.pos.z, R: (l.radius ?? 5) * 0.85, k: (l.intensity ?? 1) * (KIND_K[l.kind] ?? 0.8) * (opts.gain ?? 1.9), c: [_c.r / m, _c.g / m, _c.b / m] }; });
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  let nTri = 0, nVis = 0;
  for (const VB of builders) for (const bk of VB.b.values()) {
    if (SKIP.has(bk.mat) || !bk.idx.length) continue;
    const rgba = bk.rgba, cs = rgba ? 4 : 3;
    // quick reject: bucket extents vs lamps handled per triangle
    const P = bk.pos, N = bk.nor, U = bk.uv, C = bk.col, I = bk.idx;
    const outP = [], outN = [], outU = [], outC = [], outI = [];
    const vert = (src, i) => ({ p: [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], n: [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]], u: [U[i * 2], U[i * 2 + 1]], c: C.slice(i * cs, i * cs + cs) });
    const mid = (v0, v1) => ({ p: v0.p.map((x, k) => (x + v1.p[k]) / 2), n: v0.n.slice(), u: v0.u.map((x, k) => (x + v1.u[k]) / 2), c: v0.c.map((x, k) => (x + v1.c[k]) / 2) });
    const d3 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    const emit = (v0, v1, v2) => {
      for (const v of [v0, v1, v2]) {
        // light
        let mr = 1, mg = 1, mb = 1, add = 0, ar = 0, ag = 0, ab = 0;
        for (const l of L) {
          const dx = l.x - v.p[0], dy = l.y - v.p[1], dz = l.z - v.p[2], d = Math.hypot(dx, dy, dz); if (d > l.R || d < 0.01) continue;
          const ndl = (v.n[0] * dx + v.n[1] * dy + v.n[2] * dz) / d; const w = 0.2 + 0.8 * Math.max(0, ndl); if (ndl < -0.15) continue;
          a.set(v.p[0] + v.n[0] * 0.08, v.p[1] + v.n[1] * 0.08, v.p[2] + v.n[2] * 0.08); b.set(l.x, l.y, l.z); nVis++;
          if (!visible(a, b)) continue;
          const t = 1 - d / l.R, at = t * t * (0.5 + 0.5 * t) * w * l.k;
          mr += at * (0.25 + 0.75 * l.c[0]); mg += at * (0.25 + 0.75 * l.c[1]); mb += at * (0.25 + 0.75 * l.c[2]);
          ar += at * l.c[0]; ag += at * l.c[1]; ab += at * l.c[2];
        }
        outP.push(v.p[0], v.p[1], v.p[2]); outN.push(v.n[0], v.n[1], v.n[2]); outU.push(v.u[0], v.u[1]);
        outC.push(v.c[0] * mr + ar * 0.045, v.c[1] * mg + ag * 0.04, v.c[2] * mb + ab * 0.03); if (rgba) outC.push(v.c[3]);
      }
      const base = outP.length / 3 - 3; outI.push(base, base + 1, base + 2); nTri++;
    };
    const rec = (v0, v1, v2, depth) => {
      const e = [d3(v0.p, v1.p), d3(v1.p, v2.p), d3(v2.p, v0.p)]; const mx = Math.max(e[0], e[1], e[2]);
      if (mx <= MAXE || depth > 5) return emit(v0, v1, v2);
      if (e[0] === mx) { const m = mid(v0, v1); rec(v0, m, v2, depth + 1); rec(m, v1, v2, depth + 1); } else if (e[1] === mx) { const m = mid(v1, v2); rec(v0, v1, m, depth + 1); rec(v0, m, v2, depth + 1); } else { const m = mid(v2, v0); rec(v0, v1, m, depth + 1); rec(m, v1, v2, depth + 1); }
    };
    let any = false;
    for (let t = 0; t < I.length; t += 3) {
      const i0 = I[t], i1 = I[t + 1], i2 = I[t + 2];
      const cx = (P[i0 * 3] + P[i1 * 3] + P[i2 * 3]) / 3, cy = (P[i0 * 3 + 1] + P[i1 * 3 + 1] + P[i2 * 3 + 1]) / 3, cz = (P[i0 * 3 + 2] + P[i1 * 3 + 2] + P[i2 * 3 + 2]) / 3;
      let near = false; for (const l of L) { const rr = l.R + 1.0; if (Math.abs(l.x - cx) < rr && Math.abs(l.z - cz) < rr && Math.abs(l.y - cy) < rr && Math.hypot(l.x - cx, l.y - cy, l.z - cz) < rr) { near = true; break; } }
      const v0 = vert(0, i0), v1 = vert(0, i1), v2 = vert(0, i2);
      MAXE = Math.abs(v0.n[1]) > 0.7 ? 1.5 : 2.1;
      if (!near) { outP.push(...v0.p, ...v1.p, ...v2.p); outN.push(...v0.n, ...v1.n, ...v2.n); outU.push(...v0.u, ...v1.u, ...v2.u); outC.push(...v0.c, ...v1.c, ...v2.c); const base = outP.length / 3 - 3; outI.push(base, base + 1, base + 2); }
      else { any = true; rec(v0, v1, v2, 0); }
    }
    if (any) { bk.pos = outP; bk.nor = outN; bk.uv = outU; bk.col = outC; bk.idx = outI; }
  }
  return { tris: nTri, rays: nVis };
}
