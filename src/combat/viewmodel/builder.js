// Model builder: turns tagger definitions (see m_*.js) into THREE groups with movable parts, gauge segments and anchors.
import * as THREE from 'three';
import { Part, S } from './geo.js';
import { MatSet, MAT_ID } from './mats.js';

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

const GAUGE_KEY = /^g\d+$/;
/** Merge all of a part's per-material triangles into ONE opaque geometry (per-vertex sub-material id `aMat`) + one glass geometry. */
export function mergePart(part) {
  const op = { pos: [], nor: [], col: [], uv: [], id: [] }, gl = { pos: [], nor: [], col: [], uv: [] }, gauge = {};
  let vtx = 0;
  for (const [key, t] of part.mats) {
    if (!t.count) continue;
    if (key === 'glass') { gl.pos.push(...t.pos); gl.nor.push(...t.nor); gl.col.push(...t.col); gl.uv.push(...t.uv); continue; }
    const id = GAUGE_KEY.test(key) ? MAT_ID.core : (MAT_ID[key] ?? MAT_ID.body), n = t.count * 3;
    for (let i = 0; i < t.pos.length; i++) op.pos.push(t.pos[i]);
    for (let i = 0; i < t.nor.length; i++) op.nor.push(t.nor[i]);
    for (let i = 0; i < t.col.length; i++) op.col.push(t.col[i]);
    for (let i = 0; i < t.uv.length; i++) op.uv.push(t.uv[i]);
    for (let i = 0; i < n; i++) op.id.push(id);
    if (GAUGE_KEY.test(key)) gauge[+key.slice(1)] = { start: vtx, count: n };
    vtx += n;
  }
  const mk = (o, withId) => {
    if (!o.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(o.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
    if (withId) g.setAttribute('aMat', new THREE.Float32BufferAttribute(o.id, 1));
    g.computeBoundingSphere(); return g;
  };
  return { opaque: mk(op, true), glass: mk(gl, false), gauge };
}

/** Build the runtime model. Returns { root, parts:{name:Group}, pivots, gauge:{segs,n}, mats, meta, anchors }. */
export function makeModel(id, defFn, { world = false } = {}) {
  const b = new Builder(id, world);
  const meta = defFn(b) || {};
  // gauge segments become boxes inside their part's merged geometry (key g<index>; static 'core' in world builds)
  let gi = 0; const gaugeOrder = [];
  for (const gs of b.gaugeSpecs) {
    const part = b.parts.get(gs.partName) || b.main;
    for (const sg of gs.segs) { part.box(world ? 'core' : 'g' + gi, sg.p, sg.s, { rot: sg.r }); gaugeOrder.push({ part: gs.partName, i: gi }); gi++; }
  }
  const root = new THREE.Group(); root.name = 'tagger-' + id;
  const mats = new MatSet(meta.skin);
  const parts = {}, pivots = {}, gauge = { segs: [], n: 0 };
  const ranges = {};
  for (const [name, part] of b.parts) {
    const g = new THREE.Group(); g.name = name; g.position.set(part.pivot[0] * S, part.pivot[1] * S, part.pivot[2] * S);
    root.add(g); parts[name] = g; pivots[name] = part.pivot;
    const m = mergePart(part);
    if (m.opaque) { const mesh = new THREE.Mesh(m.opaque, mats.opaque); mesh.name = name + ':o'; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); g.add(mesh); }
    if (m.glass) { const mesh = new THREE.Mesh(m.glass, mats.glass); mesh.name = name + ':g'; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.renderOrder = 2; g.add(mesh); }
    for (const k in m.gauge) ranges[name + '#' + k] = { geo: m.opaque, ...m.gauge[k] };
  }
  if (!world) for (const o of gaugeOrder) { const r = ranges[(b.parts.has(o.part) ? o.part : 'main') + '#' + o.i]; if (r) gauge.segs.push(r); }
  gauge.n = gauge.segs.length;
  const anchors = {};
  const mkAnchor = (name, p) => { const o = new THREE.Object3D(); o.name = name; o.position.set(p[0] * S, p[1] * S, p[2] * S); root.add(o); anchors[name] = o; return o; };
  mkAnchor('muzzle', meta.muzzle || [0, 5, -20]);
  if (meta.eject) mkAnchor('eject', meta.eject.p);
  if (meta.anchors) for (const k in meta.anchors) mkAnchor(k, meta.anchors[k]);
  return { id, root, parts, pivots, gauge, mats, meta, anchors, b };
}

/** Apply ammo readout to gauge segments: lit count follows frac (bottom-up). Rewrites the per-vertex sub-material id. */
export function setGauge(model, frac) {
  const n = model.gauge.n; if (!n) return;
  const lit = Math.ceil(frac * n - 1e-4), touched = new Set();
  for (let i = 0; i < n; i++) {
    const r = model.gauge.segs[i], a = r.geo.attributes.aMat, v = i < lit ? MAT_ID.core : MAT_ID.coreOff;
    if (a.array[r.start] === v) continue;
    for (let k = 0; k < r.count; k++) a.array[r.start + k] = v;
    touched.add(a);
  }
  for (const a of touched) a.needsUpdate = true;
}
