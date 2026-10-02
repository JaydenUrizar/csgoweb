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
if (process.argv[2] === 'los' || process.argv[2] === 'all') {
  const eye = 1.64;
  const vis = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); return hit(a[0], eye, a[1], dx / L, 0, dz / L, L - 0.05) < 0; };
  const run = (name, ax0, ax1, az0, az1, bx0, bx1, bz0, bz1, step) => { let n = 0, tot = 0, worst = 0, ex = null; for (let xa = ax0; xa <= ax1; xa += step) for (let za = az0; za <= az1; za += step) for (let xb = bx0; xb <= bx1; xb += step) for (let zb = bz0; zb <= bz1; zb += step) { tot++; if (vis([xa, za], [xb, zb])) { n++; const L = Math.hypot(xb - xa, zb - za); if (L > worst) { worst = L; ex = [xa, za, xb, zb]; } } } console.log(name, 'LOS pairs', n, '/', tot, (100 * n / tot).toFixed(1) + '%', 'longest', worst.toFixed(0), JSON.stringify(ex)); };
  run('spawn<->spawn', -15, 15, 39, 49, -15, 15, -49, -39, 2);
  run('ember mid exit<->tide mid', -4, 4, 30, 37, -4, 4, -37, -29, 1);
  run('ember spawn<->tide mid', -15, 15, 39, 49, -4, 4, -37, -29, 2);
}
if (process.argv[2] === 'paths' || process.argv[2] === 'all') {
  const { PATHS } = await import('./data.js');
  for (const p of PATHS) for (let i = 0; i + 1 < p.pts.length; i++) { const [a, b] = [p.pts[i], p.pts[i + 1]]; const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.1) continue; const ux = dx / L, uz = dz / L; const fa = floorsAt(a[0], a[1]).filter((f) => f < 4)[0] ?? 0; let bad = null;
    for (let t = 0; t <= L; t += 0.5) { const x = a[0] + ux * t, z = a[1] + uz * t; const fl = floorsAt(x, z).filter((f) => f < 4); if (!fl.length) { bad = [x, z, 'nofloor']; break; } // find floor near previous level
      const f = fl.reduce((best, c) => Math.abs(c - fa) < Math.abs(best - fa) ? c : best, fl[0]);
      if (!clear(x, f, z)) { bad = [x.toFixed(1), z.toFixed(1), f.toFixed(1)]; break; } }
    if (bad) console.log('  path blocked', p.id, 'seg', i, JSON.stringify(bad)); }
}
if (process.argv[2] === 'genpaths') {
  const { PATH_SEEDS: PATHS } = await import('./data.js');
  const RB = 0.62;
  const clearR = (x, y, z) => { const up = hit(x, y + 0.05, z, 0, 1, 0, HGT); if (up >= 0 && up < HGT - 0.06) return false; for (const hh of [0.55, 1.0, 1.7]) for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const dd = hit(x, y + hh, z, Math.cos(a), 0, Math.sin(a), RB); if (dd >= 0 && dd < RB - 0.01) return false; } return true; };
  const good = new Map(); for (const n of nodes.values()) if (clearR(n.x, n.y, n.z)) good.set(n, true);
  const gnbrs = (n) => nbrs(n).filter(([m]) => good.has(m) && m.y - n.y <= 0.5 && m.y - n.y >= -0.6);
  const yFor = (x, z) => (x >= 11.5 && x <= 17.5 && z <= -16 && z >= -26.5) || (x >= 11.5 && x < 22 && z <= -26 && z >= -32) ? 3.0 : (x >= 22 && x < 48 && z < -12) ? 1.5 : (x < -22 && x > -47 && z < -20 && z > -47) ? -1.4 : 0;
  const nearG = (x, z) => { const y = yFor(x, z); let best = null, bd = 1e9; for (const n of good.keys()) { const dd = Math.hypot(n.x - x, n.z - z) + Math.abs(n.y - y) * 3; if (dd < bd) { bd = dd; best = n; } } return best; };
  const out = [];
  for (const p of PATHS) {
    let chain = []; let prev = nearG(p.pts[0][0], p.pts[0][1]);
    for (let i = 1; i < p.pts.length; i++) {
      const tgt = nearG(p.pts[i][0], p.pts[i][1]);
      const dist = new Map([[prev, 0]]), pv = new Map(); const pq = [[0, prev]];
      while (pq.length) { pq.sort((a, b) => a[0] - b[0]); const [dd, n] = pq.shift(); if (n === tgt) break; if (dd > dist.get(n)) continue; for (const [m, w] of gnbrs(n)) { const nd = dd + w; if (nd < (dist.get(m) ?? 1e9)) { dist.set(m, nd); pv.set(m, n); pq.push([nd, m]); } } }
      const seg = []; let c = tgt; if (!dist.has(tgt)) { console.error('NO PATH', p.id, i); continue; } while (c !== prev) { seg.push(c); c = pv.get(c); } seg.reverse(); chain = chain.concat(seg); prev = tgt;
    }
    // simplify
    const walk = (a, b) => { const L = Math.hypot(b.x - a.x, b.z - a.z); const steps = Math.ceil(L / 0.25); let last = a; for (let k = 1; k <= steps; k++) { const x = a.x + (b.x - a.x) * k / steps, z = a.z + (b.z - a.z) * k / steps; const m = nearest(x, z, last.y + 0.0, true); if (!m || Math.hypot(m.x - x, m.z - z) > 0.4 || Math.abs(m.y - last.y) > 0.8 || !clearR(x, m.y, z)) return false; if (hit(x, m.y + 0.6, z, 0, 0, 1, 0.001) >= 0) return false; last = m; } return Math.abs(last.y - b.y) <= 0.8; };
    const pts = [chain[0]]; let i0 = 0;
    while (i0 < chain.length - 1) { let j = chain.length - 1; while (j > i0 + 1 && !walk(chain[i0], chain[j])) j--; pts.push(chain[j]); i0 = j; }
    out.push({ id: p.id, team: p.team, site: p.site, pts: pts.map((n) => [Math.round(n.x * 2) / 2, Math.round(n.z * 2) / 2, Math.round(n.y * 20) / 20]) });
  }
  console.log('PATHS_JSON' + JSON.stringify(out));
}
if (process.argv[2] === 'los2') {
  const eye = 1.64; const vis = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); return hit(a[0], eye, a[1], dx / L, 0, dz / L, L - 0.05) < 0; };
  let k = 0; for (let xa = -15; xa <= 15 && k < 12; xa += 2) for (let za = 39; za <= 49; za += 2) for (let xb = -15; xb <= 15; xb += 2) for (let zb = -49; zb <= -39; zb += 2) if (vis([xa, za], [xb, zb]) && k < 12) { k++; const xAt = (z) => (xa + (xb - xa) * (za - z) / (za - zb)).toFixed(1); console.log([xa, za, xb, zb].join(','), 'x@z12', xAt(12), 'x@-15', xAt(-15), 'x@-26', xAt(-26), 'x@-38', xAt(-38)); }
}
if (process.argv[2] === 'dbg3') { for (const [x,z,y] of [[16.9,-26.2,3.0],[15.4,-17,3.0],[1.5,10,0]]) { const up = hit(x,y+0.05,z,0,1,0,HGT); const hs=[]; for (const hh of [0.55,1.0,1.7]) for (let k=0;k<8;k++){const a=k/8*Math.PI*2; const dd=hit(x,y+hh,z,Math.cos(a),0,Math.sin(a),R); if(dd>=0&&dd<R) hs.push([hh,k,dd.toFixed(2)]);} console.log(x,z,y,'up',up.toFixed?.(2),JSON.stringify(hs), 'floors', floorsAt(x,z).map(f=>f.toFixed(2)).join(',')); } for (const n of NODES) { const m = nearest(n.x, n.z, n.elevated ? 3.0 : undefined, true); const dd = m ? Math.hypot(m.x - n.x, m.z - n.z) : 99; if (dd > 0.6) console.log('BADNODE', n.id, n.x, n.z); } }
if (process.argv[2] === 'spawnscan') {
  for (const [name, x0, x1, z0, z1] of [['ES', -16, 16, 38, 50], ['TS', -16, 16, -50, -38]]) { const cells = new Map(); for (let x = x0; x < x1; x += 0.5) for (let z = z0; z < z1; z += 0.5) { const fl = floorsAt(x, z).filter((f) => f < 4); for (const f of fl) if (f > 0.05) { const k = Math.round(x / 2) * 2 + ',' + Math.round(z / 2) * 2 + ',' + f.toFixed(1); cells.set(k, (cells.get(k) || 0) + 1); } } console.log(name, [...cells.keys()].join(' | ')); }
}
