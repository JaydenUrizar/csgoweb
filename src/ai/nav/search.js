// Pooled A* (indexed binary heap, generation stamps => zero per-query allocation) + capsule-safe string pulling.
import { LINK_WALK } from './config.js';

export class Searcher {
  constructor(g) {
    this.g = g; const N = g.N;
    this.gs = new Float32Array(N); this.fs = new Float32Array(N); this.par = new Int32Array(N);
    this.plink = new Uint8Array(N); this.ru = new Float32Array(N); this.ll = new Uint8Array(N); this.stamp = new Uint32Array(N); this.closed = new Uint8Array(N);
    this.hpos = new Int32Array(N); this.heap = new Int32Array(N + 1); this.hn = 0; this.gen = 0;
    this.start = -1; this.goal = -1; this.weight = 1.1; this.danger = null; this.dangerW = 0;
    this.gx = 0; this.gy = 0; this.gz = 0; this.expanded = 0; this.done = true; this.found = false;
  }
  _push(n) { const heap = this.heap, fs = this.fs, hpos = this.hpos; let i = this.hn++; const f = fs[n]; while (i > 0) { const p = (i - 1) >> 1, pn = heap[p]; if (fs[pn] <= f) break; heap[i] = pn; hpos[pn] = i; i = p; } heap[i] = n; hpos[n] = i; }
  _up(n) { const heap = this.heap, fs = this.fs, hpos = this.hpos; let i = hpos[n]; const f = fs[n]; while (i > 0) { const p = (i - 1) >> 1, pn = heap[p]; if (fs[pn] <= f) break; heap[i] = pn; hpos[pn] = i; i = p; } heap[i] = n; hpos[n] = i; }
  _pop() {
    const heap = this.heap, fs = this.fs, hpos = this.hpos; const top = heap[0]; const last = heap[--this.hn];
    if (this.hn > 0) { let i = 0; const f = fs[last], n = this.hn; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && fs[heap[c + 1]] < fs[heap[c]]) c++; if (fs[heap[c]] >= f) break; heap[i] = heap[c]; hpos[heap[i]] = i; i = c; } heap[i] = last; hpos[last] = i; }
    return top;
  }
  begin(start, goal, weight = 1.1, danger = null, dangerW = 0) {
    const g = this.g; this.gen++; if (this.gen > 4e9) { this.stamp.fill(0); this.gen = 1; }
    this.start = start; this.goal = goal; this.weight = weight; this.danger = danger; this.dangerW = dangerW;
    this.gx = g.px[goal]; this.gy = g.py[goal]; this.gz = g.pz[goal]; this.hn = 0;
    this.alt = g.alt || null; if (this.alt) { const K = this.alt.k; if (!this.gF) { this.gF = new Float32Array(K); this.gB = new Float32Array(K); } for (let l = 0; l < K; l++) { this.gF[l] = this.alt.F[goal * K + l]; this.gB[l] = this.alt.B[goal * K + l]; } } this.expanded = 0; this.done = false; this.found = false;
    this.stamp[start] = this.gen; this.gs[start] = 0; this.par[start] = -1; this.plink[start] = 0; this.ru[start] = 99; this.ll[start] = 0; this.closed[start] = 0;
    this.fs[start] = weight * this._h(start); this._push(start);
    if (start === goal) { this.done = true; this.found = true; }
  }
  _h(n) {
    const g = this.g; const dx = g.px[n] - this.gx, dy = g.py[n] - this.gy, dz = g.pz[n] - this.gz; let h = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const alt = this.alt; if (alt) { const K = alt.k, F = alt.F, B = alt.B, gF = this.gF, gB = this.gB, o = n * K; for (let l = 0; l < K; l++) { const a = gF[l] - F[o + l], b = B[o + l] - gB[l]; if (a > h) h = a; if (b > h) h = b; } }
    return h;
  }
  /** Run up to maxExp expansions. Returns true when finished (check .found). */
  step(maxExp) {
    if (this.done) return true;
    const g = this.g, nb = g.nb, nbc = g.nbc, lstart = g.lstart, lto = g.lto, lcost = g.lcost, ltype = g.ltype;
    const gs = this.gs, fs = this.fs, par = this.par, plink = this.plink, stamp = this.stamp, closed = this.closed, hpos = this.hpos, gen = this.gen, w = this.weight;
    const danger = this.danger, dW = this.dangerW, goal = this.goal;
    let exp = 0;
    while (this.hn > 0 && exp < maxExp) {
      const u = this._pop(); closed[u] = 1; hpos[u] = -1; exp++;
      if (u === goal) { this.done = true; this.found = true; this.expanded += exp; return true; }
      const gu = gs[u], base = u * 8, ru = this.ru, ruu = ru[u], pl = this.ll[u];
      for (let k = 0; k < 8; k++) {
        const v = nb[base + k]; if (v < 0) continue;
        let c = nbc[base + k]; if (danger !== null) c += c * dW * danger[v];
        this._relax(u, v, gu + c, 0, ruu + c, w, stamp, closed, gs, fs, par, plink, hpos, gen);
      }
      for (let p = lstart[u], e = lstart[u + 1]; p < e; p++) {
        const v = lto[p], lt = ltype[p]; let c = lcost[p];
        // movement rules: a jump/mantle needs stacked mantle (< 2 m run-up after a link) costs +30; a drop right after a
        // jump (hop over a low obstacle) is heavily discouraged so bots walk around planters/walls when they can
        if (lt === 1 && pl !== 0 && ruu < 2) c += 30;
        if (lt === 2 && pl === 1 && ruu < 9) c += 16;
        if (danger !== null) c += c * dW * danger[v];
        this._relax(u, v, gu + c, lt, 0, w, stamp, closed, gs, fs, par, plink, hpos, gen);
      }
    }
    this.expanded += exp;
    if (this.hn === 0) { this.done = true; this.found = false; return true; }
    return false;
  }
  _relax(u, v, ng, lt, rv, w, stamp, closed, gs, fs, par, plink, hpos, gen) {
    if (stamp[v] !== gen) { stamp[v] = gen; closed[v] = 0; gs[v] = ng; par[v] = u; plink[v] = lt; this.ru[v] = rv; this.ll[v] = lt === 0 ? this.ll[u] : lt; fs[v] = ng + w * this._h(v); this._push(v); }
    else if (closed[v] === 0 && ng < gs[v] - 1e-6) { gs[v] = ng; par[v] = u; plink[v] = lt; this.ru[v] = rv; this.ll[v] = lt === 0 ? this.ll[u] : lt; fs[v] = ng + w * this._h(v); this._up(v); }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Chain buffers + smoothing scratch (module-level, grown on demand, never shrunk => no per-query GC after warm-up)
let CN = new Int32Array(2048), CL = new Uint8Array(2048);
let RX = new Float32Array(2048), RY = new Float32Array(2048), RZ = new Float32Array(2048), RF = new Uint8Array(2048);
let SX = new Float32Array(2048), SY = new Float32Array(2048), SZ = new Float32Array(2048), SF = new Uint8Array(2048);
function grow(n) {
  if (n <= CN.length) return; const m = n * 2;
  CN = new Int32Array(m); CL = new Uint8Array(m); RX = new Float32Array(m); RY = new Float32Array(m); RZ = new Float32Array(m); RF = new Uint8Array(m);
  SX = new Float32Array(m); SY = new Float32Array(m); SZ = new Float32Array(m); SF = new Uint8Array(m);
}
/** Copy the node chain (start..goal) of a finished search into the shared chain buffer; returns its length. */
export function loadChain(s) {
  let n = 0; for (let v = s.goal; v >= 0; v = s.par[v]) n++;
  grow(n + 8); let i = n - 1; for (let v = s.goal; v >= 0; v = s.par[v]) { CN[i] = v; CL[i] = s.plink[v]; i--; }
  return n;
}
export function chainCopy(n) { return { nodes: CN.slice(0, n), links: CL.slice(0, n) }; }
export function chainRestore(c) { grow(c.nodes.length + 8); CN.set(c.nodes); CL.set(c.links); return c.nodes.length; }

/**
 * Smooth the chain in CN/CL (n nodes) into SX/SY/SZ/SF. The start position is excluded; the last point is the goal.
 * SF[i] = link type used to ARRIVE at point i (0 walk, 1 jump, 2 drop). Returns the point count.
 */
export function extractPath(g, n, sx, sy, sz, gx, gy, gz, smoothing = true) {
  // raw: [0] = start pos, [1..n] = chain nodes, [n+1] = goal pos
  for (let i = 0; i < n; i++) { const v = CN[i]; RX[i + 1] = g.px[v]; RY[i + 1] = g.py[v]; RZ[i + 1] = g.pz[v]; RF[i + 1] = CL[i]; }
  RF[1] = 0; RX[0] = sx; RY[0] = sy; RZ[0] = sz; RF[0] = 0;
  RX[n + 1] = gx; RY[n + 1] = gy; RZ[n + 1] = gz; RF[n + 1] = 0;
  const last = n + 1;
  // Virtual endpoints only when reachable from the adjacent node over walkable cells, else fall back to the node itself
  let y = g.walkLine(RX[1], RY[1], RZ[1], sx, sz);
  if (!(y === y && Math.abs(y - sy) < 0.7 && Math.hypot(sx - RX[1], sz - RZ[1]) < 1.3)) { RX[0] = RX[1]; RY[0] = RY[1]; RZ[0] = RZ[1]; }
  y = g.walkLine(RX[n], RY[n], RZ[n], gx, gz);
  if (y === y && Math.hypot(gx - RX[n], gz - RZ[n]) < 1.3 && Math.abs(y - gy) < 0.7) { const gg = g.groundAt(gx, gz, RY[n]); if (gg === gg) RY[n + 1] = gg; else RY[n + 1] = y; }
  else { RX[n + 1] = RX[n]; RY[n + 1] = RY[n]; RZ[n + 1] = RZ[n]; }
  let out = 0;
  if (!smoothing) { for (let k = 1; k <= last; k++) { SX[out] = RX[k]; SY[out] = RY[k]; SZ[out] = RZ[k]; SF[out] = RF[k]; out++; } return out; }
  let anchor = 0;
  while (anchor < last) {
    let e = anchor + 1; while (e <= last && RF[e] === LINK_WALK) e++;              // e = first link arrival (or last+1)
    let best = anchor + 1, fails = 0;
    for (let k = anchor + 2; k <= e - 1; k++) {
      const yy = g.walkLine(RX[anchor], RY[anchor], RZ[anchor], RX[k], RZ[k]);
      if (yy === yy && Math.abs(yy - RY[k]) < 0.25) { best = k; fails = 0; } else if (++fails >= 4) break;
    }
    SX[out] = RX[best]; SY[out] = RY[best]; SZ[out] = RZ[best]; SF[out] = RF[best]; out++;
    anchor = best;
  }
  return out;
}
export const scratch = { get x() { return SX; }, get y() { return SY; }, get z() { return SZ; }, get f() { return SF; } };
