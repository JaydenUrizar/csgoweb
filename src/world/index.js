// Crux Station — map module (ctx.map). See docs/pieces/map.md and docs/ARCHITECTURE.md §map.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { makeCollider } from './collision.js';
import { makeTextures } from './textures.js';
import { makeMaterials } from './materials.js';
import { buildDecals } from './decals.js';
import { buildSkyline } from './skyline.js';
import { buildRadar } from './radar.js';
import { VisBuilder } from './builder.js';
import { heightAt, X0, Z0, NX, NZ, idx, SURF } from './grid.js';
import { H } from './layout.js';
import { CALLOUTS } from './dress.js';
import { SPAWNS, SITES, NODES, PATHS } from './data.js';
import { registerScenes } from './scenes.js';

const SURF_MAP = { stone: 'stone', sand: 'sand', tile: 'stone', brick: 'stone', water: 'water', metal: 'metal', wood: 'wood', grass: 'grass' };

export function create(ctx) {
  const W = buildWorld(+ctx.params.get('chunk') || undefined);
  const { layout, D } = W; const grid = layout.grid;
  const group = new THREE.Group(); group.name = 'crux-station';
  ctx.render.scene.add(group);

  // ---- contact AO (soft dark rings under props), signage atlas, skyline ----
  const dark = (a) => [0.04, 0.03, 0.02, a];
  for (const [x0, z0, x1, z1, y] of D.contacts) {
    const e = 0.5, yy = y + 0.02, a = 0.42, t = dark(0), s = dark(a);
    W.VB.quad('contact', [x0, yy, z1], [x1, yy, z1], [x1, yy, z1 + e], [x0, yy, z1 + e], [s, s, t, t]);
    W.VB.quad('contact', [x1, yy, z0], [x0, yy, z0], [x0, yy, z0 - e], [x1, yy, z0 - e], [s, s, t, t]);
    W.VB.quad('contact', [x1, yy, z1], [x1, yy, z0], [x1 + e, yy, z0], [x1 + e, yy, z1], [s, s, t, t]);
    W.VB.quad('contact', [x0, yy, z0], [x0, yy, z1], [x0 - e, yy, z1], [x0 - e, yy, z0], [s, s, t, t]);
    for (const [cx, cz, sx, sz] of [[x1, z1, 1, 1], [x0, z1, -1, 1], [x0, z0, -1, -1], [x1, z0, 1, -1]]) {
      const P = [[cx, yy, cz], [cx + sx * e, yy, cz], [cx + sx * e, yy, cz + sz * e], [cx, yy, cz + sz * e]];
      const flip = sx * sz < 0; const q = flip ? [P[0], P[3], P[2], P[1]] : P; const cs = flip ? [s, t, t, t] : [s, t, t, t];
      W.VB.quad('contact', q[0], q[1], q[2], q[3], cs);
    }
  }
  const spawnsData = { ember: SPAWNS.ember.map((s) => ({ pos: new THREE.Vector3(s.x, heightAt(grid, s.x, s.z), s.z), yaw: s.yaw })), tide: SPAWNS.tide.map((s) => ({ pos: new THREE.Vector3(s.x, heightAt(grid, s.x, s.z), s.z), yaw: s.yaw })) };
  const VBsky = new VisBuilder(); buildSkyline(VBsky, D);
  const atlas = buildDecals(D, W.VB, SPAWNS, SITES, VBsky);

  const aniso = Math.min(8, ctx.render.renderer?.capabilities?.getMaxAnisotropy?.() || 4);
  const T = makeTextures(aniso);
  const M = makeMaterials(ctx, T, atlas);

  const meshes = [], roofs = [];
  const addMeshes = (builder, into, cast = true) => {
    for (const p of builder.finish()) {
      const m = new THREE.Mesh(p.geometry, M[p.mat] || M.plain);
      m.castShadow = cast && !['signs', 'contact', 'water', 'emissive', 'glass'].includes(p.mat); m.receiveShadow = !['emissive'].includes(p.mat);
      m.matrixAutoUpdate = false; m.name = `${p.mat}@${p.cx},${p.cz}`;
      if (p.mat === 'signs') m.renderOrder = 2; if (p.mat === 'contact') m.renderOrder = 1; if (p.mat === 'water') m.renderOrder = 1;
      group.add(m); into.push(m);
    }
  };
  addMeshes(W.VB, meshes); addMeshes(W.VBroof, roofs); const sky = []; addMeshes(VBsky, sky, false);
  const roofGroup = roofs; // toggled in overview

  // ---- collision ----
  const surfaceFromGrid = (x, y, z) => {
    const i = Math.floor(x - X0), j = Math.floor(z - Z0); if (i < 0 || j < 0 || i >= NX || j >= NZ) return 'stone';
    const k = idx(i, j); const h = heightAt(grid, x, z);
    if (grid.open[k] && Math.abs(y - h) < 0.45) return SURF_MAP[SURF[grid.surf[k]]] || 'stone';
    return 'stone';
  };
  const col = makeCollider(W.CB, surfaceFromGrid);

  // ---- sites / callouts / radar ----
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const sites = {};
  const objectsAtSites = { A: [], B: [] };
  for (const id of ['A', 'B']) {
    const s = SITES[id];
    sites[id] = { id, center: v3(s.x, s.y, s.z), radius: s.radius, y: s.y, plant: { center: v3(s.plant.x, s.y, s.plant.z), radius: s.plant.radius }, objects: objectsAtSites[id] };
  }
  for (const o of D.objects) for (const id of ['A', 'B']) {
    const s = SITES[id]; if (Math.hypot(o.center[0] - s.x, o.center[2] - s.z) <= s.radius + 4 && Math.abs(o.center[1] - s.y) < 4.5) objectsAtSites[id].push({ name: o.name, kind: o.kind, center: v3(...o.center), min: v3(...o.min), max: v3(...o.max), height: o.height, cover: o.height >= 0.6 });
  }
  const callouts = CALLOUTS.map((c) => ({ name: c.name, pos: v3(c.x, heightAt(grid, c.x, c.z), c.z), radius: c.radius }));
  const radar = buildRadar(grid, [{ x0: 12, z0: -26, x1: 17, z1: -16 }, { x0: 12, z0: -32, x1: 22, z1: -26 }], sites, callouts);

  // ---- nodes (snap to ground) ----
  const nodeY = (n) => { const o = v3(n.x, (n.elevated ? 5 : n.site === 'A' && n.x > 20 && n.z < -12 ? 4 : 3.0), n.z); const lim = n.elevated ? 3.6 : 3.0; o.y = Math.min(o.y, heightAt(grid, n.x, n.z) + 1.5 + (n.elevated ? 0.4 : 0)); const h = col.raycast(o, v3(0, -1, 0), 8); return h ? h.point.y : heightAt(grid, n.x, n.z); };
  const nodes = NODES.map((n) => ({ ...n, pos: v3(n.x, nodeY(n), n.z) }));
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const paths = PATHS.map((p) => ({ ...p, pts: p.pts.map(([x, z]) => v3(x, heightAt(grid, x, z), z)) }));

  // ---- misc contract bits ----
  const thinWalls = D.thinWalls;
  const _p = new THREE.Vector3();
  const thinWallAt = (p, eps = 0.05) => { for (const t of thinWalls) { const b = t.box; if (p.x > b.min.x - eps && p.x < b.max.x + eps && p.y > b.min.y - eps && p.y < b.max.y + eps && p.z > b.min.z - eps && p.z < b.max.z + eps) return t; } return null; };
  const lightProbes = [
    ['ember-spawn', 0, 44, 0xffd9b0, 1.0], ['long', 38, 10, 0xfff0d0, 1.1], ['a-site', 34, -28, 0xfff4d8, 1.15], ['mid', 0, 20, 0xffe8c8, 1.0], ['hub', 0, 0, 0xffe8c8, 1.0], ['palace', 0, -20, 0xfff0d8, 1.0],
    ['tide-spawn', 0, -44, 0xe8f2ff, 1.0], ['b-site', -33, -31, 0xe6f0f0, 0.85], ['tunnel-a', -33, 36, 0xffc890, 0.45], ['tunnel-b', -39, 15, 0xffc890, 0.4], ['tunnel-c', -33, -2, 0xffc890, 0.45], ['catwalk-under', 14, -21, 0xe8d8c0, 0.6],
  ].map(([name, x, z, color, intensity]) => ({ name, pos: v3(x, heightAt(grid, x, z) + 1.4, z), color, intensity, radius: 12 }));
  const triggers = [
    { type: 'site', id: 'A', center: sites.A.center, radius: sites.A.radius }, { type: 'site', id: 'B', center: sites.B.center, radius: sites.B.radius },
    { type: 'buyzone', team: 'ember', box: new THREE.Box3(v3(-16, -1, 38), v3(16, 6, 50)) }, { type: 'buyzone', team: 'tide', box: new THREE.Box3(v3(-16, -1, -50), v3(16, 6, -38)) },
  ];
  const ZONE_CALLOUT = { es: 'Ember Spawn', tunapp: 'Tunnel Approach', outerlong: 'Outer Long', midapp: 'Mid Lane', doors: 'Mid Doors', hub: 'Hub', short: 'Short', terrace: 'Terrace', palace: 'Palace', long: 'Long', pit: 'Pit', longramp: 'Long Ramp', a: 'A Site', aplat: 'Ledge', adoor: 'A Door', ts: 'Tide Spawn', tidemid: 'Tide Mid', winroom: 'Window Room', eastroom: 'East Room', bconn: 'B Connector', bdoor: 'B Door', bplaza: 'B Site', bbalc: 'Balcony', btunmouth: 'Tunnel Mouth' };
  const zoneAt = (x, z) => { const i = Math.floor(x - X0), j = Math.floor(z - Z0); if (i < 0 || j < 0 || i >= NX || j >= NZ) return null; const k = idx(i, j); return grid.open[k] ? grid.zoneNames[grid.zone[k]] : null; };
  const tunnelCallouts = callouts.filter((c) => /Tunnel|Bend|Corner/.test(c.name));
  const calloutAt = (p) => {
    const z = zoneAt(p.x, p.z);
    let best = null, bd = 1e9; for (const c of callouts) { const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z) / c.radius; if (d < 1.0 && d < bd && Math.abs(p.y - c.pos.y) < 4.2) { bd = d; best = c; } }
    if (best) return best;
    if (z && z.startsWith('btun') && z !== 'btunmouth') { let b2 = null, d2 = 1e9; for (const c of tunnelCallouts) { const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z); if (d < d2) { d2 = d; b2 = c; } } return b2; }
    const nm = ZONE_CALLOUT[z]; return nm ? callouts.find((c) => c.name === nm) || null : null;
  };
  const calloutAtOld = (p) => { let best = null, bd = 1e9; for (const c of callouts) { const d = Math.hypot(p.x - c.pos.x, p.z - c.pos.z) / c.radius; if (d < 1.0 && d < bd && Math.abs(p.y - c.pos.y) < 4.2) { bd = d; best = c; } } return best; };

  const api = {
    name: 'crux-station', group, collider: col.collider, bvh: col.bvh,
    raycast: col.raycast, raycastThrough: col.raycastThrough, visible: col.visible,
    spawns: spawnsData, sites, callouts, calloutAt, zoneAt, triggers, thinWalls, thinWallAt, objectsAtSites, lightProbes, lamps: D.lamps.map((l) => ({ pos: v3(...l.pos), color: l.color, intensity: l.intensity })),
    nodes: { list: nodes, byId: nodeById, paths, ofType: (t) => nodes.filter((n) => n.type === t) },
    radar,
    bounds: new THREE.Box3(v3(-50, -6, -52), v3(50, 40, 52)),
    playBounds: new THREE.Box3(v3(-49.5, -6, -51.5), v3(49.5, 20, 51.5)),
    heightAt: (x, z) => heightAt(grid, x, z),
    surfaceAt(p) {
      const o = _p.set(p.x, p.y + 0.35, p.z); const h = col.raycast(o, v3(0, -1, 0), 1.2);
      if (h) return h.surface; return surfaceFromGrid(p.x, p.y, p.z);
    },
    stats: { visTris: W.VB.tris + W.VBroof.tris, colTris: col.geometry.index.count / 3, meshes: meshes.length + roofs.length, atlas: { requests: atlas.count, cells: atlas.cells, scale: atlas.scale } },
    materials: M, textures: T,
    setRoofsVisible(v) { for (const m of roofGroup) m.visible = v; },
    setSkylineVisible(v) { for (const m of sky) m.visible = v; },
    update(dt) { if (M.water?.map) { M.water.map.offset.x += dt * 0.02; M.water.map.offset.y += dt * 0.012; } },
    dispose() { ctx.render.scene.remove(group); for (const m of group.children) m.geometry.dispose(); },
  };
  api.debug = { layout, world: W, nodeY, surfaceFromGrid };
  registerScenes(ctx, api);
  return api;
}
