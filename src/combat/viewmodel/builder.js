// Model builder: turns tagger definitions (see m_*.js) into THREE groups with movable parts, gauge segments and anchors.
import * as THREE from 'three';
import { Part, toGeometries, S } from './geo.js';
import { MatSet } from './mats.js';

const gaugeGeo = new THREE.BoxGeometry(1, 1, 1);
const DEG = Math.PI / 180;

export class Builder {
  constructor(id, world) {
    this.id = id; this.world = world; this.parts = new Map(); this.gaugeSpecs = []; this.meta = {};
    this.main = new Part('main', [0, 0, 0]); this.parts.set('main', this.main);
  }
  /** Named movable part; geometry is authored in model-space cm, pivot (cm) is the group origin. In world builds everything merges into main. */
  part(name, pivot = [0, 0, 0]) {
    if (this.world) return this.main;
    let p = this.parts.get(name); if (!p) { p = new Part(name, pivot); this.parts.set(name, p); } return p;
  }
  /** Ammo gauge: list of segments [{p:[x,y,z] cm (model space), s:[w,h,d] cm, r?:[deg]}] belonging to `partName`. Rendered with core/coreOff materials. */
  gauge(partName, segs) { this.gaugeSpecs.push({ partName: this.world ? 'main' : partName, segs }); }
  /** Straight gauge helper: n segments stacked from `from` towards `to` (model cm), each `size`. */
  gaugeLine(partName, from, to, size, n, gap = 0.25) {
    const segs = [];
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      segs.push({ p: [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u], s: size.slice() });
    }
    this.gauge(partName, segs); return segs;
  }
}

/** Build the runtime model. Returns { root, parts:{name:Group}, pivots, gauge:{segs:[Mesh]}, mats, meta, anchors }. */
export function makeModel(id, defFn, { world = false, geomCache = null } = {}) {
  const b = new Builder(id, world);
  const meta = defFn(b) || {};
  if (world) for (const gs of b.gaugeSpecs) gs.segs.forEach((sg) => b.main.box('core', sg.p, sg.s, { rot: sg.r }));
  const root = new THREE.Group(); root.name = 'tagger-' + id;
  const mats = new MatSet(meta.skin);
  const parts = {}, pivots = {};
  for (const [name, part] of b.parts) {
    const g = new THREE.Group(); g.name = name; g.position.set(part.pivot[0] * S, part.pivot[1] * S, part.pivot[2] * S);
    root.add(g); parts[name] = g; pivots[name] = part.pivot;
    for (const [key, geo] of toGeometries(part)) {
      const mesh = new THREE.Mesh(geo, mats[key] || mats.body);
      mesh.name = name + ':' + key; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      if (key === 'glass') mesh.renderOrder = 2; else if (key === 'glow') mesh.renderOrder = 1;
      g.add(mesh);
    }
  }
  const gauge = { segs: [], n: 0 };
  for (const gs of world ? [] : b.gaugeSpecs) {
    const holder = parts[gs.partName] || parts.main, pv = pivots[gs.partName] || [0, 0, 0];
    for (const sg of gs.segs) {
      const m = new THREE.Mesh(gaugeGeo, mats.core);
      m.scale.set(sg.s[0] * S, sg.s[1] * S, sg.s[2] * S);
      m.position.set((sg.p[0] - pv[0]) * S, (sg.p[1] - pv[1]) * S, (sg.p[2] - pv[2]) * S);
      if (sg.r) m.rotation.set(sg.r[0] * DEG, sg.r[1] * DEG, sg.r[2] * DEG, 'YXZ');
      m.name = 'gauge'; holder.add(m); gauge.segs.push(m);
    }
  }
  gauge.n = gauge.segs.length;
  const anchors = {};
  const mkAnchor = (name, p) => { const o = new THREE.Object3D(); o.name = name; o.position.set(p[0] * S, p[1] * S, p[2] * S); root.add(o); anchors[name] = o; return o; };
  mkAnchor('muzzle', meta.muzzle || [0, 5, -20]);
  if (meta.eject) mkAnchor('eject', meta.eject.p);
  return { id, root, parts, pivots, gauge, mats, meta, anchors, b };
}

/** Apply ammo readout to gauge segments: lit count follows frac (bottom-up), colour handled by mats. */
export function setGauge(model, frac) {
  const n = model.gauge.n; if (!n) return;
  const lit = Math.ceil(frac * n - 1e-4);
  for (let i = 0; i < n; i++) model.gauge.segs[i].material = i < lit ? model.mats.core : model.mats.coreOff;
}
