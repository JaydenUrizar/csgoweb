// Area segmentation: map every node to a named area. Seeds are the map's callouts (weighted multi-source Dijkstra along
// walkable edges); any leftover nodes far from all callouts are flooded into auto "zones" so areaAt() never returns nothing.
import { LINK_WALK } from './config.js';

/** Small binary min-heap (keys + values), reusable. */
export class MinHeap {
  constructor(cap = 1024) { this.k = new Float64Array(cap); this.v = new Int32Array(cap); this.n = 0; }
  clear() { this.n = 0; }
  push(key, val) {
    if (this.n >= this.k.length) { const k = new Float64Array(this.k.length * 2), v = new Int32Array(this.v.length * 2); k.set(this.k); v.set(this.v); this.k = k; this.v = v; }
    let i = this.n++; const K = this.k, V = this.v;
    while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= key) break; K[i] = K[p]; V[i] = V[p]; i = p; }
    K[i] = key; V[i] = val;
  }
  pop() { // returns value; key in .popKey
    const K = this.k, V = this.v; const top = V[0]; this.popKey = K[0]; const n = --this.n;
    if (n > 0) { const key = K[n], val = V[n]; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && K[c + 1] < K[c]) c++; if (K[c] >= key) break; K[i] = K[c]; V[i] = V[c]; i = c; } K[i] = key; V[i] = val; }
    return top;
  }
}

/** Normalise the various callout shapes a map might provide into [{name, x,y,z, r}] */
export function normaliseCallouts(list) {
  const out = [];
  for (const c of (list || [])) {
    if (!c) continue;
    const name = c.name || c.id || c.label; if (!name) continue;
    let p = c.pos || c.position || c.center || c.p || c.point;
    if (!p && c.box && c.box.min && c.box.max) p = { x: (c.box.min.x + c.box.max.x) / 2, y: c.box.min.y, z: (c.box.min.z + c.box.max.z) / 2 };
    if (!p && c.min && c.max) p = { x: (c.min.x + c.max.x) / 2, y: c.min.y, z: (c.min.z + c.max.z) / 2 };
    if (!p && c.x !== undefined) p = c;
    if (!p) continue;
    let x, y, z; if (Array.isArray(p)) { [x, y, z] = p; } else { x = p.x; y = p.y; z = p.z; }
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    let r = c.radius ?? c.r ?? c.size;
    if (Array.isArray(r)) r = Math.max(r[0], r[r.length - 1]) / 2;
    if (c.box && c.box.min && c.box.max && r === undefined) r = Math.max(c.box.max.x - c.box.min.x, c.box.max.z - c.box.min.z) / 2;
    if (c.min && c.max && r === undefined) r = Math.max(c.max.x - c.min.x, c.max.z - c.min.z) / 2;
    out.push({ name: String(name), x, y: Number.isFinite(y) ? y : undefined, z, r: Number.isFinite(r) && r > 0 ? r : 8 });
  }
  return out;
}

export function buildRegions(g, calloutsIn, cfg) {
  const N = g.N, callouts = normaliseCallouts(calloutsIn);
  const region = new Int16Array(N).fill(-1), dist = new Float64Array(N).fill(Infinity), eff = new Float64Array(N).fill(Infinity);
  const areas = []; const heap = new MinHeap(4096);
  const nb = g.nb, lstart = g.lstart, lto = g.lto, lcost = g.lcost;
  const edgeLen = (u, v) => Math.hypot(g.px[u] - g.px[v], g.py[u] - g.py[v], g.pz[u] - g.pz[v]);
  // 1) callout seeds
  const seedR = [];
  for (const c of callouts) {
    const node = g.nearest(c.x, c.y ?? 0.5, c.z, Math.max(3, c.r * 0.6));
    if (node < 0) continue;
    const id = areas.length; areas.push({ id, name: c.name, x: c.x, z: c.z, y: g.py[node], seed: node, callout: true, r: c.r, count: 0 });
    seedR[id] = c.r; if (eff[node] > 0) { eff[node] = 0; dist[node] = 0; region[node] = id; heap.push(0, node); }
  }
  // weighted Dijkstra: effective cost scaled by 8/radius so big callouts claim more
  while (heap.n) {
    const u = heap.pop(), key = heap.popKey; if (key > eff[u] + 1e-6) continue;
    const id = region[u], sc = 8 / seedR[id];
    const relax = (v, len) => { const d = dist[u] + len, e = eff[u] + len * sc; if (e < eff[v]) { eff[v] = e; dist[v] = d; region[v] = id; heap.push(e, v); } };
    for (let k = 0; k < 8; k++) { const v = nb[u * 8 + k]; if (v >= 0) relax(v, edgeLen(u, v)); }
    for (let p = lstart[u]; p < lstart[u + 1]; p++) relax(lto[p], lcost[p]);
  }
  // unclaim nodes too far from their callout
  for (let i = 0; i < N; i++) if (region[i] >= 0 && dist[i] > seedR[region[i]] * 2.4) region[i] = -1;
  // 2) auto zones: farthest-first seeds over unclaimed nodes, flooded to areaRadius, then tiny crumbs merged into neighbours
  const R = cfg.areaRadius, D = new Float64Array(N).fill(Infinity);
  const relaxD = () => {
    while (heap.n) {
      const u = heap.pop(), key = heap.popKey; if (key > D[u]) continue;
      for (let k = 0; k < 8; k++) { const v = nb[u * 8 + k]; if (v < 0) continue; const d = key + edgeLen(u, v); if (d < D[v]) { D[v] = d; heap.push(d, v); } }
      for (let p = lstart[u]; p < lstart[u + 1]; p++) { const v = lto[p], d = key + lcost[p]; if (d < D[v]) { D[v] = d; heap.push(d, v); } }
    }
  };
  heap.clear(); let anyClaimed = false;
  for (let i = 0; i < N; i++) if (region[i] >= 0) { D[i] = 0; heap.push(0, i); anyClaimed = true; }
  relaxD();
  let zone = 0, unclaimed = 0; for (let i = 0; i < N; i++) if (region[i] < 0) unclaimed++;
  while (unclaimed > 0) {
    let s = -1, bd = -1; for (let i = 0; i < N; i++) if (region[i] < 0) { const d = D[i] === Infinity ? 1e9 : D[i]; if (d > bd) { bd = d; s = i; } }
    const id = areas.length; areas.push({ id, name: 'Zone ' + (++zone), x: g.px[s], z: g.pz[s], y: g.py[s], seed: s, callout: false, r: R, count: 0 });
    const d2 = new Map(), claimed = [s]; heap.clear(); heap.push(0, s); d2.set(s, 0); region[s] = id; unclaimed--;
    while (heap.n) {
      const u = heap.pop(), key = heap.popKey; if (key > d2.get(u) + 1e-9) continue;
      const tryv = (v, len) => { if (region[v] >= 0 && region[v] !== id) return; const d = key + len; if (d > R) return; const o = d2.get(v); if (o === undefined || d < o) { if (o === undefined) { region[v] = id; unclaimed--; claimed.push(v); } d2.set(v, d); heap.push(d, v); } };
      for (let k = 0; k < 8; k++) { const v = nb[u * 8 + k]; if (v >= 0) tryv(v, edgeLen(u, v)); }
      for (let p = lstart[u]; p < lstart[u + 1]; p++) tryv(lto[p], lcost[p]);
    }
    heap.clear(); for (const v of claimed) { D[v] = 0; heap.push(0, v); } relaxD();
  }
  // merge crumbs (< minNodes) into the neighbour they share the longest border with
  const minNodes = Math.round(cfg.minAreaNodes ?? 90);
  for (let pass = 0; pass < 6; pass++) {
    const cnt = new Int32Array(areas.length); for (let i = 0; i < N; i++) cnt[region[i]]++;
    let merged = false;
    for (const a of areas) {
      if (a.callout || cnt[a.id] === 0 || cnt[a.id] >= minNodes) continue;
      const border = new Map();
      for (let i = 0; i < N; i++) if (region[i] === a.id) for (let k = 0; k < 8; k += 2) { const v = nb[i * 8 + k]; if (v >= 0 && region[v] !== a.id) border.set(region[v], (border.get(region[v]) || 0) + 1); }
      let best = -1, bc = 0; for (const [r, c] of border) if (c > bc) { bc = c; best = r; }
      if (best < 0) continue;
      for (let i = 0; i < N; i++) if (region[i] === a.id) region[i] = best;
      cnt[best] += cnt[a.id]; cnt[a.id] = 0; merged = true;
    }
    if (!merged) break;
  }
  { // compact ids
    const used = new Int32Array(areas.length).fill(-1); const keep = []; for (let i = 0; i < N; i++) if (used[region[i]] < 0) { used[region[i]] = keep.length; keep.push(areas[region[i]]); }
    // keep callout areas even if they lost every node? (they can't: they own their seed)
    for (let i = 0; i < N; i++) region[i] = used[region[i]];
    areas.length = 0; keep.forEach((a, i) => { a.id = i; areas.push(a); });
  }
  // 3) statistics: centroid, count, adjacency; name auto zones after the nearest callout + compass
  const sx = new Float64Array(areas.length), sy = new Float64Array(areas.length), sz = new Float64Array(areas.length);
  for (let i = 0; i < N; i++) { const a = region[i]; areas[a].count++; sx[a] += g.px[i]; sy[a] += g.py[i]; sz[a] += g.pz[i]; }
  const adj = areas.map(() => new Set());
  for (let i = 0; i < N; i++) { const a = region[i]; for (let k = 0; k < 8; k += 2) { const v = nb[i * 8 + k]; if (v >= 0 && region[v] !== a) adj[a].add(region[v]); } for (let p = lstart[i]; p < lstart[i + 1]; p++) { const v = lto[p]; if (region[v] !== a) adj[a].add(region[v]); } }
  const named = areas.filter((a) => a.callout);
  for (const a of areas) {
    if (a.count) { a.cx = sx[a.id] / a.count; a.cy = sy[a.id] / a.count; a.cz = sz[a.id] / a.count; } else { a.cx = a.x; a.cy = a.y; a.cz = a.z; }
    a.neighbors = [...adj[a.id]];
    if (!a.callout && named.length) {
      let best = null, bd = Infinity; for (const c of named) { const d = Math.hypot(c.x - a.cx, c.z - a.cz); if (d < bd) { bd = d; best = c; } }
      const ang = Math.atan2(a.cx - best.x, -(a.cz - best.z)); const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      a.name = `${best.name} ${dirs[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8]}`;
      a.near = best.name;
    }
  }
  // de-duplicate identical names
  const seen = new Map(); for (const a of areas) { const c = (seen.get(a.name) || 0) + 1; seen.set(a.name, c); if (c > 1) a.name += ' ' + c; }
  g.region = region; g.areas = areas;
  return areas;
}
