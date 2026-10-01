// Node verification: node src/world/verify.mjs  -> traversal, leaks, rotation timing, node validity.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { makeCollider } from './collision.js';
import { SPAWNS, SITES, NODES } from './data.js';
const t0 = Date.now();
const W = buildWorld();
const col = makeCollider(W.CB, () => 'stone');
console.log('build ms', Date.now() - t0, 'vis tris', W.VB.tris + W.VBroof.tris, 'col tris', col.geometry.index.count / 3);
const R = 0.36, HGT = 1.8, STEP = 0.75, CELL = 0.5, SPEED = 6.5;
const ray = new THREE.Ray(), o = new THREE.Vector3(), d = new THREE.Vector3();
const hit = (ox, oy, oz, dx, dy, dz, far) => { o.set(ox, oy, oz); d.set(dx, dy, dz); ray.origin.copy(o); ray.direction.copy(d); const h = col.bvh.raycastFirst(ray, THREE.DoubleSide, 0, far); return h ? h.distance : -1; };
// floors at (x,z): successive downward rays from top
function floorsAt(x, z) {
  const out = []; let y = 14;
  for (let i = 0; i < 6; i++) { const dist = hit(x, y, z, 0, -1, 0, 30); if (dist < 0) break; const fy = y - dist; if (fy < 4.0) out.push(fy); y = fy - 0.02; }
  return out;
}
function clear(x, y, z) {
  // headroom
  const up = hit(x, y + 0.05, z, 0, 1, 0, HGT); if (up >= 0 && up < HGT - 0.06) return false;
  for (const hh of [0.55, 1.0, 1.7]) for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const dd = hit(x, y + hh, z, Math.cos(a), 0, Math.sin(a), R); if (dd >= 0 && dd < R - 0.01) return false; }
  return true;
}
const key = (i, j, l) => i + ',' + j + ',' + l;
const nodes = new Map();
const gx0 = -50, gz0 = -52;
for (let j = 0; j < 104 / CELL; j++) for (let i = 0; i < 100 / CELL; i++) {
  const x = gx0 + (i + 0.5) * CELL, z = gz0 + (j + 0.5) * CELL;
  const fl = floorsAt(x, z);
  fl.forEach((fy, l) => { if (clear(x, fy, z)) nodes.set(key(i, j, l), { i, j, x, z, y: fy, l }); });
}
console.log('walkable samples', nodes.size);
// adjacency via nearest floor in neighbour column
const byCol = new Map(); for (const n of nodes.values()) { const k = n.i + ',' + n.j; if (!byCol.has(k)) byCol.set(k, []); byCol.get(k).push(n); }
const nbrs = (n) => { const out = []; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { if (!di && !dj) continue; if ((Math.abs(di) > 1 || Math.abs(dj) > 1) && (Math.abs(di) + Math.abs(dj) > 2)) continue; const c = byCol.get((n.i + di) + ',' + (n.j + dj)); if (!c) continue; for (const m of c) { const dy = m.y - n.y; if (Math.abs(dy) > (dy > 0 ? STEP : 3.0)) continue;
  // walk segment clear at knee height
  const dist = Math.hypot(di, dj) * CELL; const h = hit(n.x, Math.max(n.y, m.y) + 0.6, n.z, (m.x - n.x) / dist, 0, (m.z - n.z) / dist, dist); if (h >= 0) continue;
  out.push([m, dist * (dy < -1 ? 1.5 : 1)]); } } return out; };
function nearest(x, z, y, onlyReach) { let best = null, bd = 1e9; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const i = Math.floor((x - gx0) / CELL) + di, j = Math.floor((z - gz0) / CELL) + dj; const c = byCol.get(i + ',' + j); if (!c) continue; for (const m of c) { if (onlyReach && !D1.dist.has(m)) continue; const dd = Math.hypot(m.x - x, m.z - z) + (y === undefined ? 0 : Math.abs(m.y - y) * 2); if (dd < bd) { bd = dd; best = m; } } } return best; }
function dijkstra(src) { const dist = new Map([[src, 0]]); const prev = new Map(); const pq = [[0, src]]; while (pq.length) { pq.sort((a, b) => a[0] - b[0]); const [dd, n] = pq.shift(); if (dd > dist.get(n)) continue; for (const [m, w] of nbrs(n)) { const nd = dd + w; if (nd < (dist.get(m) ?? 1e9)) { dist.set(m, nd); prev.set(m, n); pq.push([nd, m]); } } } return { dist, prev }; }
const es = SPAWNS.ember[2], ts = SPAWNS.tide[2];
const sEs = nearest(es.x, es.z, 0), sTs = nearest(ts.x, ts.z, 0);
console.log('spawn nodes', !!sEs, !!sTs);
const D1 = dijkstra(sEs);
console.log('reachable from ember spawn:', D1.dist.size, 'of', nodes.size);
const reach = (x, z, y) => { const n = nearest(x, z, y); return n ? D1.dist.get(n) : undefined; };
const T = (x, z, y) => { const r = reach(x, z, y); return r === undefined ? 'UNREACHABLE' : (r / SPEED).toFixed(1) + 's'; };
console.log('ember -> A site', T(SITES.A.x, SITES.A.z, SITES.A.y), ' B site', T(SITES.B.x, SITES.B.z, SITES.B.y), ' tide spawn', T(ts.x, ts.z, 0));
console.log('ember -> A via catwalk top', T(14.5, -20, 3.0), ' A ledge', T(45, -40, 3.6), ' B balcony', T(-42, -41, 1.2), ' hub ledge', T(-8.5, -8, 1.2), ' window sill', T(-21, -34, 1.1));
const D2 = dijkstra(nearest(SITES.A.x, SITES.A.z, SITES.A.y)); const nb = nearest(SITES.B.x, SITES.B.z, SITES.B.y);
console.log('A site -> B site (shortest)', (D2.dist.get(nb) / SPEED).toFixed(1) + 's', 'dist', D2.dist.get(nb)?.toFixed(1));
const D3 = dijkstra(sTs); console.log('tide spawn -> A', (D3.dist.get(nearest(SITES.A.x, SITES.A.z, SITES.A.y)) / SPEED).toFixed(1), 's  -> B', (D3.dist.get(nb) / SPEED).toFixed(1), 's');
// unreachable walkable cells (excluding prop tops) report
const unreach0 = [...nodes.values()].filter((n) => !D1.dist.has(n));
const unreach = unreach0; const groups = new Map(); for (const n of unreach) { const k = Math.round(n.x / 4) + ',' + Math.round(n.z / 4) + ',' + n.y.toFixed(0); groups.set(k, (groups.get(k) || 0) + 1); }
console.log('unreachable clusters (x/4,z/4,y):', [...groups.entries()].filter(([, c]) => c > 6).slice(0, 40).map(([k, c]) => k + ':' + c).join('  ') || 'none');
// leaks: reachable cells beyond bounds
const leak = [...D1.dist.keys()].filter((n) => Math.abs(n.x) > 49.2 || n.z < -51.2 || n.z > 51.2); console.log('leaks (reachable beyond bounds):', leak.length);
// node validity
let bad = 0; for (const n of NODES) { const y = n.elevated ? 3.0 : undefined; const m = nearest(n.x, n.z, y, true); const dd = m ? Math.hypot(m.x - n.x, m.z - n.z) : 99; if (dd > 0.6) { bad++; console.log('  node off-mesh/unreachable:', n.id, n.x, n.z, 'dist', dd.toFixed(2)); } }
console.log('nodes', NODES.length, 'bad', bad);
// sky holes: random rays from inside play space upward then outward are blocked? (skip) ; check spawn clear
for (const [t, arr] of Object.entries(SPAWNS)) for (const s of arr) { const m = nearest(s.x, s.z, 0); if (!m || Math.hypot(m.x - s.x, m.z - s.z) > 0.4) console.log('  spawn blocked', t, s.x, s.z); }
console.log('done ms', Date.now() - t0);
if (process.argv[2] === 'dbg') { for (const x of [-22.75,-22.25,-21.75,-21.25,-20.75,-20.25,-19.75,-19.25,-18.75]) { const fl = floorsAt(x, -33.75); console.log(x, fl.map(f=>f.toFixed(2)).join(','), fl.map(f=>clear(x,f,-33.75)).join(',')); } }
if (process.argv[2] === 'dbg2') { const x=-20.25,z=-33.75,y=1.1; const up = hit(x,y+0.05,z,0,1,0,HGT); console.log('up',up); for (const hh of [0.55,1.0,1.7]) for (let k=0;k<8;k++){const a=k/8*Math.PI*2; const dd=hit(x,y+hh,z,Math.cos(a),0,Math.sin(a),R); if(dd>=0&&dd<R) console.log('hit',hh,k,dd.toFixed(2)); } }
