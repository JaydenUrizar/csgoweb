// Model registry: viewmodel instances (one per id, cached) and world models (shared geometry per id, per-skin materials).
import * as THREE from 'three';
import { makeModel } from './builder.js';
import { MatSet } from './mats.js';
import * as P from './m_pistols.js';
import * as L from './m_longarms.js';
import * as M from './m_misc.js';

export const DEFS = {
  tap: M.tap, pip: P.pip, twin: P.twin, judge: P.judge, zip: L.zip, hum: L.hum, arc: L.arc, rail: L.rail, halo: L.halo, lance: L.lance, scatter: L.scatter, storm: L.storm,
  haze: M.haze, strobe: M.strobe, pulse: M.pulse, beacon: M.beacon, kit: M.kit, vest: M.vest,
};
export const IDS = Object.keys(DEFS);

const vmCache = new Map();
/** Viewmodel-grade model (movable parts, gauge meshes). Cached per id. */
export function getViewModel(id) {
  let m = vmCache.get(id);
  if (!m) { const f = DEFS[id] || DEFS.pip; m = makeModel(id, f, { world: false }); vmCache.set(id, m); }
  return m;
}

const worldGeo = new Map(), worldMats = new Map();
/** Third-person / pickup model: merged geometry (few draw calls), origin at grip, barrel toward -Z. userData carries anchors. */
export function getWorldModel(id, skin) {
  const f = DEFS[id] || DEFS.pip;
  let rec = worldGeo.get(id);
  if (!rec) { const m = makeModel(id, f, { world: true }); rec = { meta: m.meta, geos: [], anchors: {} }; m.parts.main.traverse((o) => { if (o.isMesh) rec.geos.push({ key: o.name.split(':')[1], geo: o.geometry }); }); for (const k in m.anchors) rec.anchors[k] = m.anchors[k].position.clone(); worldGeo.set(id, rec); m.mats.dispose(); }
  const skey = id + '|' + JSON.stringify(skin || null);
  let ms = worldMats.get(skey); if (!ms) { ms = new MatSet(rec.meta.skin).apply(skin); worldMats.set(skey, ms); }
  const g = new THREE.Group(); g.name = 'world-' + id;
  for (const { key, geo } of rec.geos) { const mesh = new THREE.Mesh(geo, key === 'g' ? ms.glass : ms.opaque); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); if (key === 'g') mesh.renderOrder = 2; g.add(mesh); }
  const h = rec.meta.hands || {};
  g.userData = { id, cls: rec.meta.cls, length: (rec.meta.len || 60) * 0.01, muzzle: rec.anchors.muzzle.clone(), gripR: h.r ? new THREE.Vector3(...h.r.p).multiplyScalar(0.01) : new THREE.Vector3(), gripL: h.l ? new THREE.Vector3(...h.l.p).multiplyScalar(0.01) : null, matSet: ms, hold: rec.meta.hold || rec.meta.cls };
  return g;
}
export function disposeAll() { for (const m of vmCache.values()) m.mats.dispose(); vmCache.clear(); }
