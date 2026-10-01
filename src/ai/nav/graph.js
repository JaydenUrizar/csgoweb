// Automatic multi-level navgrid built purely from a BVH collider. Pure module (three + three-mesh-bvh only), runs in Node.
//
// Layout: the world is cut into columns of `cell` metres. Each column holds 0..n walkable "nodes" (one per standable
// surface, ordered bottom-up). Nodes are validated with a downward ray (surface + slope), an upward ray (headroom) and a
// capsule-stack test lifted by stepUp (radius + margin, so a legal node is >= 0.40 m from any wall). Because
// cell (0.5) < 2*radius(0.72), two clear nodes can never straddle a thin wall, so 8-neighbour walk edges need no sweep.
// Extra directed links: jump-up (crates <= jumpMax), drop-down (<= maxDrop). The graph is pruned to its largest strongly
// connected component containing the spawns, so every remaining node can reach every other one.
import * as THREE from 'three';
import { NOT_INTERSECTED, INTERSECTED, MeshBVH } from 'three-mesh-bvh';
import { NAV_DEFAULTS, DIR, LINK_JUMP, LINK_DROP } from './config.js';

const FRONT = THREE.FrontSide, DOUBLE = THREE.DoubleSide;
const DE = 0, DS = 2;

export class NavGraph {
  constructor(cfg) { this.cfg = cfg; this.N = 0; this.stats = {}; }

  // ------------------------------------------------------------------ lookups
  colOf(x, z) { const i = Math.floor((x - this.ox) / this.cell), j = Math.floor((z - this.oz) / this.cell); return (i < 0 || j < 0 || i >= this.W || j >= this.H) ? -1 : j * this.W + i; }

  /** Node in column (i,j) whose y is closest to `y` within tol, else -1. */
  findInCol(i, j, y, tol) {
    if (i < 0 || j < 0 || i >= this.W || j >= this.H) return -1;
    const c = j * this.W + i, s = this.colStart[c], e = this.colStart[c + 1];
    let best = -1, bd = tol;
    for (let n = s; n < e; n++) { const d = Math.abs(this.py[n] - y); if (d <= bd) { bd = d; best = n; } }
    return best;
  }

  /** Nearest node to a world point (feet position). Prefers nodes at/below the point's height. -1 if none within maxR. */
  nearest(x, y, z, maxR = 4) {
    const cell = this.cell, ci = Math.floor((x - this.ox) / cell), cj = Math.floor((z - this.oz) / cell);
    const rmax = Math.ceil(maxR / cell);
    let best = -1, bd = Infinity;
    for (let r = 0; r <= rmax; r++) {
      if (best >= 0 && (r - 1) * cell > Math.sqrt(bd)) break;
      for (let dj = -r; dj <= r; dj++) {
        const j = cj + dj; if (j < 0 || j >= this.H) continue;
        const edge = (dj === -r || dj === r), step = edge ? 1 : Math.max(1, 2 * r);
        for (let di = -r; di <= r; di += step) {
          const i = ci + di; if (i < 0 || i >= this.W) continue;
          const c = j * this.W + i;
          for (let n = this.colStart[c], e = this.colStart[c + 1]; n < e; n++) {
            const dx = this.px[n] - x, dz = this.pz[n] - z, dy = this.py[n] - y;
            const dyw = dy > 0.55 ? dy * 2.6 : dy < 0 ? dy * 0.8 : dy * 1.2;
            const d = dx * dx + dz * dz + dyw * dyw;
            if (d < bd) { bd = d; best = n; }
          }
        }
      }
    }
    if (best >= 0) { const dx = this.px[best] - x, dz = this.pz[best] - z; if (dx * dx + dz * dz > maxR * maxR) return -1; }
    return best;
  }

  /** Interpolated ground height at (x,z) following the floor near y; NaN if off-grid. */
  groundAt(x, z, y) {
    const u = (x - this.ox) / this.cell - 0.5, v = (z - this.oz) / this.cell - 0.5;
    const i0 = Math.floor(u), j0 = Math.floor(v), fx = u - i0, fz = v - j0;
    const tol = this.cfg.stepUp + 0.4;
    let n = this.findInCol(i0, j0, y, tol);
    if (n < 0) { n = this.findInCol(i0 + (fx > 0.5 ? 1 : 0), j0 + (fz > 0.5 ? 1 : 0), y, tol); return n < 0 ? NaN : this.py[n]; }
    const nb = this.nb, py = this.py;
    const n10 = nb[n * 8 + DE], n01 = nb[n * 8 + DS];
    const n11 = n10 >= 0 ? nb[n10 * 8 + DS] : (n01 >= 0 ? nb[n01 * 8 + DE] : -1);
    const y00 = py[n], y10 = n10 >= 0 ? py[n10] : y00, y01 = n01 >= 0 ? py[n01] : y00, y11 = n11 >= 0 ? py[n11] : (y10 + y01) * 0.5;
    return (y00 * (1 - fx) + y10 * fx) * (1 - fz) + (y01 * (1 - fx) + y11 * fx) * fz;
  }

  /**
   * Capsule-safe straight walk test on the grid: every 0.25 m the four surrounding nodes (a cell quad of clear nodes,
   * mutually walk-connected) must exist and the floor must stay continuous. Returns end ground height or NaN if blocked.
   */
  walkLine(ax, ay, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, len = Math.sqrt(dx * dx + dz * dz);
    const n = Math.max(1, Math.ceil(len / 0.25));
    const cell = this.cell, ox = this.ox, oz = this.oz, nb = this.nb, py = this.py;
    const tol = this.cfg.stepUp + 0.25;
    let cy = ay;
    for (let s = 0; s <= n; s++) {
      const t = s / n, x = ax + dx * t, z = az + dz * t;
      const u = (x - ox) / cell - 0.5, v = (z - oz) / cell - 0.5;
      let i0 = Math.floor(u), j0 = Math.floor(v), fx = u - i0, fz = v - j0;
      if (fx > 0.985) { i0++; fx = 0; }
      if (fz > 0.985) { j0++; fz = 0; }
      const n00 = this.findInCol(i0, j0, cy, tol);
      if (n00 < 0) return NaN;
      const needX = fx > 0.015, needZ = fz > 0.015;
      let n10 = -1, n01 = -1, n11 = -1;
      if (needX) { n10 = nb[n00 * 8 + DE]; if (n10 < 0) return NaN; }
      if (needZ) { n01 = nb[n00 * 8 + DS]; if (n01 < 0) return NaN; }
      if (needX && needZ) { n11 = nb[n10 * 8 + DS]; if (n11 < 0) { n11 = nb[n01 * 8 + DE]; if (n11 < 0) return NaN; } }
      const y00 = py[n00], y10 = n10 >= 0 ? py[n10] : y00, y01 = n01 >= 0 ? py[n01] : y00, y11 = n11 >= 0 ? py[n11] : (needX ? y10 : y01);
      cy = (y00 * (1 - fx) + y10 * fx) * (1 - fz) + (y01 * (1 - fx) + y11 * fx) * fz;
    }
    return cy;
  }

  nodePos(n, out) { return out.set(this.px[n], this.py[n], this.pz[n]); }
}

/**
 * Character-controller style clearance test. A stack of spheres (radius `radius`, 0.2 m apart) spans the capsule; a
 * triangle blocks only if its closest point to a sphere lies more than `stepUp` above the feet (lower geometry is stepped
 * over). One shapecast per query. Returns hits(x, feetY, z) -> boolean (true = blocked).
 */
export function makeCapsule(bvh, { radius, stepUp, height }) {
  const cy0 = radius, cy1 = height - radius, n = Math.max(2, Math.ceil((cy1 - cy0) / 0.2) + 1);
  const centres = []; for (let i = 0; i < n; i++) centres.push(new THREE.Vector3());
  const capBox = new THREE.Box3(), tmp = new THREE.Vector3(), r2 = radius * radius; let feet = 0;
  const cb = {
    intersectsBounds: (box) => (box.intersectsBox(capBox) ? INTERSECTED : NOT_INTERSECTED),
    intersectsTriangle: (tri) => {
      const lim = feet + stepUp; if (tri.a.y <= lim && tri.b.y <= lim && tri.c.y <= lim) return false;
      for (let k = 0; k < n; k++) { const c = centres[k]; tri.closestPointToPoint(c, tmp); if (tmp.y > lim && tmp.distanceToSquared(c) < r2) return true; }
      return false;
    },
  };
  return (x, y, z) => {
    feet = y;
    for (let k = 0; k < n; k++) centres[k].set(x, y + cy0 + k * (cy1 - cy0) / (n - 1), z);
    capBox.min.set(x - radius, y + stepUp, z - radius); capBox.max.set(x + radius, y + height, z + radius);
    return bvh.shapecast(cb);
  };
}

// ---------------------------------------------------------------------------------------------------------------------
export function buildGraph(collider, bounds, options = {}, hints = {}) {
  const t0 = performance.now();
  const cfg = { ...NAV_DEFAULTS, ...options };
  const g = new NavGraph(cfg);

  // --- BVH (world space). Bake transform if the collider mesh isn't identity.
  let geo = collider.geometry;
  collider.updateMatrixWorld?.(true);
  const m = collider.matrixWorld;
  if (m && !m.equals(new THREE.Matrix4())) { geo = geo.clone().applyMatrix4(m); geo.boundsTree = new MeshBVH(geo); }
  if (!geo.boundsTree) geo.boundsTree = new MeshBVH(geo);
  const bvh = geo.boundsTree;

  // --- grid extents
  let cell = cfg.cell;
  const min = bounds.min, max = bounds.max;
  while (((max.x - min.x) / cell) * ((max.z - min.z) / cell) > cfg.maxCells) cell *= 1.25;
  cfg.cell = cell;
  const ox = Math.floor(min.x / cell) * cell, oz = Math.floor(min.z / cell) * cell;
  const W = Math.max(1, Math.ceil((max.x - ox) / cell)), H = Math.max(1, Math.ceil((max.z - oz) / cell));
  g.cell = cell; g.ox = ox; g.oz = oz; g.W = W; g.H = H; g.bounds = bounds.clone ? bounds.clone() : bounds;

  const cosSlope = Math.cos(cfg.slopeDeg * Math.PI / 180) - 1e-4;
  const tanSlope = Math.tan(cfg.slopeDeg * Math.PI / 180);
  const top = max.y + 0.5, bottom = min.y - 0.5;
  const rClear = cfg.radius + cfg.margin;

  // --- primitives
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
  const DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0), HDIR = new THREE.Vector3();
  const downHit = (x, y, z, far) => { ray.origin.set(x, y, z); ray.direction.copy(DOWN); return bvh.raycastFirst(ray, FRONT, 0, far); };
  const upDist = (x, y, z, far) => { ray.origin.set(x, y, z); ray.direction.copy(UP); const h = bvh.raycastFirst(ray, DOUBLE, 0, far); return h ? h.distance : Infinity; };
  const hFree = (x0, y, z0, x1, z1) => {
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz); if (len < 1e-4) return true;
    ray.origin.set(x0, y, z0); HDIR.set(dx / len, 0, dz / len); ray.direction.copy(HDIR);
    return !bvh.raycastFirst(ray, DOUBLE, 0, len);
  };
  const capsuleHits = makeCapsule(bvh, { radius: rClear, stepUp: cfg.stepUp, height: cfg.height });
  g.capsuleHits = capsuleHits; g.bvh = bvh;

  // --- pass 1: column scan
  const px = [], py = [], pz = [], ceilA = [], counts = new Int32Array(W * H);
  let rays = 0;
  const colTmp = [];
  for (let cz = 0; cz < H; cz++) {
    const z = oz + (cz + 0.5) * cell;
    for (let cx = 0; cx < W; cx++) {
      const x = ox + (cx + 0.5) * cell;
      colTmp.length = 0;
      let y0 = top, lastY = Infinity;
      for (let guard = 0; guard < 24; guard++) {
        const hit = downHit(x, y0, z, y0 - bottom); rays++;
        if (!hit) break;
        const hy = y0 - hit.distance; y0 = hy - 0.02;
        if (lastY - hy < 0.12) continue;          // near-coplanar duplicate surface
        lastY = hy;
        if (hit.face.normal.y < cosSlope) continue;
        const up = upDist(x, hy + 0.05, z, 6); const head = up + 0.05;
        if (head < cfg.headroom) continue;
        if (capsuleHits(x, hy, z)) continue;
        colTmp.push(hy, Math.min(head, 6));
      }
      const c = cz * W + cx; counts[c] = colTmp.length >> 1;
      for (let k = colTmp.length - 2; k >= 0; k -= 2) { px.push(x); py.push(colTmp[k]); pz.push(z); ceilA.push(colTmp[k + 1]); }
    }
  }
  let N = px.length;
  g.N = N; g.px = Float32Array.from(px); g.py = Float32Array.from(py); g.pz = Float32Array.from(pz); g.ceil = Float32Array.from(ceilA);
  const colStart = new Int32Array(W * H + 1); for (let c = 0; c < W * H; c++) colStart[c + 1] = colStart[c] + counts[c];
  g.colStart = colStart;
  const rawNodes = N;

  // --- pass 2: walk edges (8 slots per node)
  const nb = new Int32Array(N * 8).fill(-1);
  g.nb = nb;
  const midRay = (a, b) => {
    const mx = (g.px[a] + g.px[b]) / 2, mz = (g.pz[a] + g.pz[b]) / 2, hi = Math.max(g.py[a], g.py[b]), lo = Math.min(g.py[a], g.py[b]);
    const h = downHit(mx, hi + 0.7, mz, 1.4 + (hi - lo)); if (!h) return false;
    const hy = hi + 0.7 - h.distance; return hy >= lo - 0.12 && hy <= hi + 0.12 && h.face.normal.y >= cosSlope * 0.98;
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
      const c = cz * W + cx;
      for (let a = colStart[c]; a < colStart[c + 1]; a++) {
        for (let k = 0; k < 8; k++) {
          const diag = (k & 1) === 1; if (diag !== (pass === 1)) continue;
          const i = cx + DIR[k][0], j = cz + DIR[k][1]; if (i < 0 || j < 0 || i >= W || j >= H) continue;
          const c2 = j * W + i, hd = diag ? cell * Math.SQRT2 : cell;
          let best = -1, bd = Infinity;
          for (let b = colStart[c2]; b < colStart[c2 + 1]; b++) {
            const dy = Math.abs(g.py[b] - g.py[a]);
            if (dy > cfg.stepUp + 1e-3 && (dy > tanSlope * hd + 0.05 || dy > cfg.stepUp + cell * 1.05 || !midRay(a, b))) continue;
            if (dy < bd) { bd = dy; best = b; }
          }
          if (best < 0) continue;
          if (diag) {   // no corner cutting: both orthogonal neighbours must exist and lead to the diagonal
            const o1 = nb[a * 8 + ((k + 7) & 7)], o2 = nb[a * 8 + ((k + 1) & 7)];
            if (o1 < 0 || o2 < 0) continue;
            const k1 = (k + 1) & 7, k2 = (k + 7) & 7;      // from o1 step in dir k1 ; from o2 in dir k2
            if (nb[o1 * 8 + k1] !== best && nb[o2 * 8 + k2] !== best) continue;
          }
          nb[a * 8 + k] = best;
        }
      }
    }
  }

  // --- pass 3: jump-up / drop-down links
  const linkA = [], linkB = [], linkT = [], linkC = [];
  const R = Math.ceil(Math.max(cfg.jumpReach, cfg.dropReach) / cell);
  const isWalkNb = (a, b) => { for (let k = 0; k < 8; k++) if (nb[a * 8 + k] === b) return true; return false; };
  const candJ = [], candD = [];
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const c = cz * W + cx;
    for (let a = colStart[c]; a < colStart[c + 1]; a++) {
      candJ.length = 0; candD.length = 0;
      const ax = g.px[a], ay = g.py[a], az = g.pz[a];
      for (let dj = -R; dj <= R; dj++) {
        const j = cz + dj; if (j < 0 || j >= H) continue;
        for (let di = -R; di <= R; di++) {
          if (!di && !dj) continue;
          const i = cx + di; if (i < 0 || i >= W) continue;
          const c2 = j * W + i;
          for (let b = colStart[c2]; b < colStart[c2 + 1]; b++) {
            const dy = g.py[b] - ay; if (Math.abs(dy) <= cfg.stepUp + 0.02) continue;
            const hd = Math.hypot(g.px[b] - ax, g.pz[b] - az);
            if (dy > 0) { if (dy <= cfg.jumpMax && hd <= cfg.jumpReach - 0.5 * (dy / cfg.jumpMax) && g.ceil[a] >= dy + cfg.headroom) candJ.push(hd, b); }
            else if (dy >= -cfg.maxDrop && hd <= cfg.dropReach) candD.push(hd, b);
          }
        }
      }
      // jumps: closest first; keep up to 2 validated (skip pairs already walk-connected on a ramp)
      if (candJ.length) {
        const order = []; for (let q = 0; q < candJ.length; q += 2) order.push([candJ[q], candJ[q + 1]]); order.sort((p, q) => p[0] - q[0]);
        let made = 0;
        for (const [hd, b] of order) {
          if (made >= 2) break; if (isWalkNb(a, b)) continue;
          const by = g.py[b];
          if (!hFree(ax, by + 0.3, az, g.px[b], g.pz[b]) || !hFree(ax, by + 1.2, az, g.px[b], g.pz[b])) continue;
          if (!hFree(ax, ay + 0.9, az, ax + (g.px[b] - ax) * 0.25, az + (g.pz[b] - az) * 0.25)) continue;
          linkA.push(a); linkB.push(b); linkT.push(LINK_JUMP); linkC.push(hd + 0.9 + (by - ay) * 1.6); made++;
        }
      }
      if (candD.length) {
        const order = []; for (let q = 0; q < candD.length; q += 2) order.push([candD[q], candD[q + 1]]); order.sort((p, q) => p[0] - q[0]);
        let made = 0;
        for (const [hd, b] of order) {
          if (made >= 2) break; if (isWalkNb(a, b)) continue;
          const by = g.py[b], bx = g.px[b], bz = g.pz[b], drop = ay - by;
          if (!hFree(ax, ay + 0.35, az, bx, bz) || !hFree(ax, ay + 1.3, az, bx, bz)) continue;
          const h = downHit(bx, ay + 0.3, bz, drop + 0.6); if (!h || Math.abs(ay + 0.3 - h.distance - by) > 0.2) continue;
          linkA.push(a); linkB.push(b); linkT.push(LINK_DROP); linkC.push(hd + 0.6 + drop * 0.9 + (drop > 3 ? 4 : 0)); made++;
        }
      }
    }
  }

  // --- pass 4: prune to the main strongly connected component (containing spawns)
  const build = { N, linkA, linkB, linkT, linkC };
  csrLinks(g, build);
  g.stats.rawNodes = rawNodes;
  pruneToMainSCC(g, build, hints);
  finalize(g, cfg);
  g.stats.buildMs = performance.now() - t0; g.stats.rays = rays;
  return g;
}

function csrLinks(g, b) {
  const N = b.N, L = b.linkA.length;
  const lstart = new Int32Array(N + 1); for (let i = 0; i < L; i++) lstart[b.linkA[i] + 1]++;
  for (let i = 0; i < N; i++) lstart[i + 1] += lstart[i];
  const fill = lstart.slice(0, N), lto = new Int32Array(L), ltype = new Uint8Array(L), lcost = new Float32Array(L);
  for (let i = 0; i < L; i++) { const p = fill[b.linkA[i]]++; lto[p] = b.linkB[i]; ltype[p] = b.linkT[i]; lcost[p] = b.linkC[i]; }
  g.lstart = lstart; g.lto = lto; g.ltype = ltype; g.lcost = lcost;
}

function pruneToMainSCC(g, b, hints) {
  const N = g.N, nb = g.nb, lstart = g.lstart, lto = g.lto;
  if (N === 0) return;
  const idx = new Int32Array(N).fill(-1), low = new Int32Array(N), comp = new Int32Array(N).fill(-1), onst = new Uint8Array(N);
  const stack = new Int32Array(N), call = new Int32Array(N), it = new Int32Array(N); const sizes = [];
  let sp = 0, counter = 0;
  for (let s = 0; s < N; s++) {
    if (idx[s] >= 0) continue;
    let csp = 0; call[csp++] = s; idx[s] = low[s] = counter++; stack[sp++] = s; onst[s] = 1; it[s] = 0;
    while (csp > 0) {
      const u = call[csp - 1]; let adv = false; const deg = 8 + lstart[u + 1] - lstart[u];
      while (it[u] < deg) {
        const k = it[u]++; const v = k < 8 ? nb[u * 8 + k] : lto[lstart[u] + k - 8];
        if (v < 0) continue;
        if (idx[v] < 0) { idx[v] = low[v] = counter++; stack[sp++] = v; onst[v] = 1; it[v] = 0; call[csp++] = v; adv = true; break; }
        else if (onst[v] && idx[v] < low[u]) low[u] = idx[v];
      }
      if (adv) continue;
      if (low[u] === idx[u]) { let size = 0, w; do { w = stack[--sp]; onst[w] = 0; comp[w] = sizes.length; size++; } while (w !== u); sizes.push(size); }
      csp--; if (csp > 0) { const p = call[csp - 1]; if (low[u] < low[p]) low[p] = low[u]; }
    }
  }
  // choose component: most hint (spawn/site) nodes, tie-break size
  const votes = new Int32Array(sizes.length); let hintCount = 0;
  for (const p of (hints.points || [])) { const n = g.nearest(p.x, p.y, p.z, 3); if (n >= 0) { votes[comp[n]]++; hintCount++; } }
  let main = 0, bs = -1;
  for (let c = 0; c < sizes.length; c++) { const sc = votes[c] * 1e7 + sizes[c]; if (sc > bs) { bs = sc; main = c; } }
  g.stats.components = sizes.length; g.stats.mainComponent = sizes[main];
  g.stats.hintPoints = hintCount; g.stats.hintsInMain = votes[main];
  // compact
  const remap = new Int32Array(N).fill(-1); let M = 0;
  for (let i = 0; i < N; i++) if (comp[i] === main) remap[i] = M++;
  const px = new Float32Array(M), py = new Float32Array(M), pz = new Float32Array(M), ce = new Float32Array(M);
  const nb2 = new Int32Array(M * 8).fill(-1);
  const counts = new Int32Array(g.W * g.H);
  for (let i = 0; i < N; i++) {
    const r = remap[i]; if (r < 0) continue;
    px[r] = g.px[i]; py[r] = g.py[i]; pz[r] = g.pz[i]; ce[r] = g.ceil[i];
    for (let k = 0; k < 8; k++) { const t = nb[i * 8 + k]; nb2[r * 8 + k] = t < 0 ? -1 : remap[t]; }
    counts[Math.floor((g.pz[i] - g.oz) / g.cell) * g.W + Math.floor((g.px[i] - g.ox) / g.cell)]++;
  }
  const colStart = new Int32Array(g.W * g.H + 1); for (let c = 0; c < g.W * g.H; c++) colStart[c + 1] = colStart[c] + counts[c];
  const la = [], lb = [], lt = [], lc = [];
  for (let i = 0; i < N; i++) { if (remap[i] < 0) continue; for (let p = lstart[i]; p < lstart[i + 1]; p++) { const t = remap[lto[p]]; if (t >= 0) { la.push(remap[i]); lb.push(t); lt.push(g.ltype[p]); lc.push(g.lcost[p]); } } }
  g.N = M; g.px = px; g.py = py; g.pz = pz; g.ceil = ce; g.nb = nb2; g.colStart = colStart;
  csrLinks(g, { N: M, linkA: la, linkB: lb, linkT: lt, linkC: lc });
}

function finalize(g, cfg) {
  const N = g.N, nb = g.nb;
  // wall distance (in cells) across walk edges: 0 = node touches an obstacle / drop-off
  const wall = new Uint8Array(N).fill(255); const q = new Int32Array(N); let qh = 0, qt = 0;
  for (let i = 0; i < N; i++) { let full = true; for (let k = 0; k < 8; k++) if (nb[i * 8 + k] < 0) { full = false; break; } if (!full) { wall[i] = 0; q[qt++] = i; } }
  while (qh < qt) { const u = q[qh++]; const d = wall[u] + 1; if (d > 12) continue; for (let k = 0; k < 8; k += 2) { const v = nb[u * 8 + k]; if (v >= 0 && wall[v] > d) { wall[v] = d; q[qt++] = v; } } }
  g.wall = wall;
  // edge costs (metres, inflated near walls so paths keep off geometry)
  const nbc = new Float32Array(N * 8);
  const mult = (w) => (w === 0 ? 1.35 : w === 1 ? 1.12 : w === 2 ? 1.04 : 1);
  let walkEdges = 0;
  for (let i = 0; i < N; i++) for (let k = 0; k < 8; k++) {
    const j = nb[i * 8 + k]; if (j < 0) continue; walkEdges++;
    const dx = g.px[j] - g.px[i], dy = g.py[j] - g.py[i], dz = g.pz[j] - g.pz[i];
    nbc[i * 8 + k] = Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.5 * (mult(wall[i]) + mult(wall[j]));
  }
  g.nbc = nbc;
  let jumps = 0, drops = 0; for (let i = 0; i < g.ltype.length; i++) { if (g.ltype[i] === LINK_JUMP) jumps++; else drops++; }
  Object.assign(g.stats, { nodes: N, walkEdges, jumpLinks: jumps, dropLinks: drops, grid: `${g.W}x${g.H}`, cell: g.cell });
}
