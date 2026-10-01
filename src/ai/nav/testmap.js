// Procedural stress-test level for the navigation system (used by tools/nav_validate.mjs and ?scene=nav-debug&map=test).
// Multi-level, ramps, stairs, doors, crates 0.4..2 m, tunnels, sunken plaza, a catwalk, an unreachable island.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshBVH } from 'three-mesh-bvh';
import { mulberry32 } from '../../core/rng.js';

export function buildTestMap({ size = 100, seed = 7, crates = 110 } = {}) {
  const rnd = mulberry32(seed), geos = [], S = size / 2;
  const add = (g) => { const c = g.toNonIndexed(); for (const k of Object.keys(c.attributes)) if (k !== 'position') c.deleteAttribute(k); geos.push(c); };
  const box = (cx, y0, cz, w, h, d, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); if (ry) g.rotateY(ry); g.translate(cx, y0, cz); add(g); };
  // ramp: low end at (x,y0,z) rising along yaw direction `dir` (0 = +Z) over run L to height rise
  const ramp = (x, y0, z, dir, width, L, rise, thick = 0.5) => {
    const th = Math.atan2(rise, L), len = Math.hypot(L, rise);
    const g = new THREE.BoxGeometry(width, thick, len); g.translate(0, -thick / 2, len / 2);
    g.rotateX(-th); g.rotateY(dir); g.translate(x, y0, z); add(g);
  };
  const stairs = (x, y0, z, dir, width, steps, rise = 0.18, run = 0.3) => {
    for (let i = 0; i < steps; i++) { const h = rise * (i + 1); const g = new THREE.BoxGeometry(width, h, run); g.translate(0, h / 2, run * (i + 0.5)); g.rotateY(dir); g.translate(x, y0, z); add(g); }
  };
  const floor = (x0, z0, x1, z1, y = 0) => box((x0 + x1) / 2, y - 1, (z0 + z1) / 2, x1 - x0, 1, z1 - z0);
  floor(-S, -S, S, 10); floor(-S, 30, S, S); floor(-S, 10, 10, 30); floor(30, 10, S, 30);   // main floor with a sunken plaza hole
  floor(10, 10, 30, 30, -2.5);
  // perimeter
  box(0, -1, -S - 0.5, size + 2, 8, 1); box(0, -1, S + 0.5, size + 2, 8, 1); box(-S - 0.5, -1, 0, 1, 8, size); box(S + 0.5, -1, 0, 1, 8, size);
  // plaza lips with a stair gap (west, z 22.5..25.5) and a ramp gap (north, x 24..28)
  box(20, -2.5, 30.25, 20, 2.5, 0.5); box(30.25, -2.5, 20, 0.5, 2.5, 20);
  box(9.75, -2.5, 16.25, 0.5, 2.5, 12.5); box(9.75, -2.5, 27.75, 0.5, 2.5, 4.5);
  box(17, -2.5, 9.75, 14, 2.5, 0.5); box(29, -2.5, 9.75, 2, 2.5, 0.5);
  stairs(14.2, -2.5, 24, -Math.PI / 2, 3, 14, 0.1785, 0.3);
  ramp(26, -2.5, 14.5, Math.PI, 4, 4.5, 2.5);
  // long wall with doors (z = -15) and a cross wall (x = -20)
  const wallZ = (z, x0, x1, gaps, h = 5) => { let cur = x0; for (const [g0, g1] of gaps.concat([[x1, x1]])) { if (g0 > cur) box((cur + g0) / 2, 0, z, g0 - cur, h, 0.6); cur = g1; } };
  wallZ(-15, -S, S, [[-32, -29], [7.4, 8.6], [34, 39]]);
  const wallX = (x, z0, z1, gaps, h = 5) => { let cur = z0; for (const [g0, g1] of gaps.concat([[z1, z1]])) { if (g0 > cur) box(x, 0, (cur + g0) / 2, 0.6, h, g0 - cur); cur = g1; } };
  wallX(-20, -15, 30, [[4, 6.2]]);
  // catwalk y=4 (x -15..25, z -3..3), pillars, rails, stairs up from the north (x=-8), ramp down to the east
  box(5, 3.6, 0, 40, 0.4, 6);
  for (let x = -12; x <= 24; x += 9) for (const z of [-2.4, 2.4]) box(x, 0, z, 0.6, 3.6, 0.6);
  box(5, 4, 3.15, 40, 1.0, 0.3); box(-12.25, 4, -3.15, 5.5, 1.0, 0.3); box(11.5, 4, -3.15, 27, 1.0, 0.3);
  stairs(-8, 0, -10.2, 0, 3, 24, 0.1667, 0.3);
  ramp(35, 0, 0, -Math.PI / 2, 4, 10, 4);
  // tunnel with roof (2.6 clear)
  box(-40, 0, 20, 0.6, 2.6, 24); box(-34, 0, 20, 0.6, 2.6, 24); box(-37, 2.6, 20, 7, 0.5, 24);
  // low-headroom overpass (space below must be rejected)
  box(38, 1.3, -30, 8, 0.4, 8);
  // low walls: step-able 0.35, jump-able 0.8, max jump 1.1, too high 1.3
  box(-10, 0, -25, 8, 0.35, 0.4); box(-2, 0, -25, 6, 0.8, 0.5); box(6, 0, -25, 5, 1.1, 0.5); box(15, 0, -25, 4, 1.3, 0.5);
  // unreachable island
  box(-45, 8, 40, 6, 0.5, 6);
  // pillars
  for (let i = 0; i < 12; i++) box(-40 + i * 7, 0, -40 + ((i * 5) % 3) * 4, 1.2, 4, 1.2);
  // random crates (some stacked)
  for (let i = 0; i < crates; i++) {
    const x = (rnd() * 2 - 1) * (S - 4), z = (rnd() * 2 - 1) * (S - 4); if (x > 8 && x < 32 && z > 8 && z < 32) continue;
    if (Math.abs(x) < 3 && z > -15 && z < -14) continue;
    const w = 0.8 + rnd() * 1.6, d = 0.8 + rnd() * 1.6, h = [0.4, 0.9, 1.0, 1.1, 1.5, 2.0][Math.floor(rnd() * 6)], ry = rnd() < 0.3 ? rnd() * 1.5 : 0;
    box(x, 0, z, w, h, d, ry); if (rnd() < 0.2) box(x, h, z, w * 0.7, 1.0, d * 0.7, ry);
  }
  const geo = mergeGeometries(geos); geo.boundsTree = new MeshBVH(geo);
  const collider = new THREE.Mesh(geo);
  const bounds = new THREE.Box3(new THREE.Vector3(-S, -3, -S), new THREE.Vector3(S, 12, S));
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  return {
    name: 'nav-testmap', collider, bounds, group: new THREE.Group(),
    spawns: { ember: [{ pos: V(-44, 0, 44), yaw: 0 }, { pos: V(-42, 0, 44), yaw: 0 }, { pos: V(-40, 0, 44), yaw: 0 }], tide: [{ pos: V(44, 0, -44), yaw: 0 }, { pos: V(42, 0, -44), yaw: 0 }, { pos: V(40, 0, -44), yaw: 0 }] },
    sites: { A: { center: V(20, -2.5, 20), radius: 6 }, B: { center: V(-37, 0, 20), radius: 3 } },
    callouts: [
      { name: 'Plaza', pos: V(20, -2.5, 20), radius: 9 }, { name: 'Tunnel', pos: V(-37, 0, 20), radius: 5 }, { name: 'Catwalk', pos: V(5, 4, 0), radius: 12 },
      { name: 'Mid', pos: V(0, 0, -8), radius: 10 }, { name: 'Ember Spawn', pos: V(-42, 0, 44), radius: 8 }, { name: 'Tide Spawn', pos: V(42, 0, -44), radius: 8 },
    ],
    raycast(origin, dir, far = 500) { const r = new THREE.Ray(origin.clone(), dir.clone()); const h = geo.boundsTree.raycastFirst(r, THREE.DoubleSide, 0, far); return h ? { point: h.point, normal: h.face.normal.clone(), distance: h.distance } : null; },
  };
}
