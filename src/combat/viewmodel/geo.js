// Faceted low-poly geometry kit for the viewmodel piece. All authoring coordinates are CENTIMETRES
// (model space: origin at the grip, barrel toward -Z, +Y up, +X right). Everything is emitted as flat-shaded,
// non-indexed triangles with a baked top-light gradient in the vertex colours and box-projected UVs.
import * as THREE from 'three';

export const S = 0.01;                 // cm -> m
const DEG = Math.PI / 180;
const _m = new THREE.Matrix4(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3(), _w = new THREE.Vector3();

/** Accumulates triangles for one (part, material). */
export class Tris {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.uv = []; }
  get count() { return this.pos.length / 9; }
}

function pushTri(t, a, b, c, want, shade, uvTile) {
  _n.subVectors(b, a).cross(_u.subVectors(c, a));
  if (_n.lengthSq() < 1e-16) return;
  _n.normalize();
  const flip = _n.dot(want) < 0;
  if (flip) _n.multiplyScalar(-1);
  const s = shade * (0.64 + 0.36 * (_n.y * 0.5 + 0.5)) * (0.9 + 0.1 * (_n.x * 0.5 + 0.5));
  const ax = Math.abs(_n.x), ay = Math.abs(_n.y), az = Math.abs(_n.z);
  const P = flip ? [a, c, b] : [a, b, c];
  for (let i = 0; i < 3; i++) {
    const p = P[i];
    t.pos.push(p.x, p.y, p.z); t.nor.push(_n.x, _n.y, _n.z); t.col.push(s, s, s);
    if (ay >= ax && ay >= az) t.uv.push(p.x / S / uvTile, p.z / S / uvTile);
    else if (ax >= az) t.uv.push(p.z / S / uvTile, p.y / S / uvTile);
    else t.uv.push(p.x / S / uvTile, p.y / S / uvTile);
  }
}

/** A drawing surface. Coordinates are model-space cm; `pivot` (cm) is the part group's origin so it can rotate about it. */
export class Part {
  constructor(name, pivot, tint = 1) { this.name = name; this.pivot = pivot; this.tint = tint; this.mats = new Map(); this.uvTile = 12; }
  tris(mat) { let t = this.mats.get(mat); if (!t) { t = new Tris(); this.mats.set(mat, t); } return t; }

  // faces: array of index polys, or {f:[...], w:[x,y,z]} with an explicit outward direction (in un-rotated local space)
  _build(mat, verts, faces, c, o = {}) {
    const t = this.tris(mat), sh = (o.shade ?? 1) * this.tint;
    const rot = o.rot; const hasRot = rot && (rot[0] || rot[1] || rot[2]);
    if (hasRot) { _e.set(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG, 'YXZ'); _m.makeRotationFromEuler(_e); }
    const pv = this.pivot, out = new Array(verts.length);
    for (let i = 0; i < verts.length; i++) {
      _v.set(verts[i][0], verts[i][1], verts[i][2]); if (hasRot) _v.applyMatrix4(_m);
      out[i] = new THREE.Vector3((_v.x + c[0] - pv[0]) * S, (_v.y + c[1] - pv[1]) * S, (_v.z + c[2] - pv[2]) * S);
    }
    const centre = new THREE.Vector3((c[0] - pv[0]) * S, (c[1] - pv[1]) * S, (c[2] - pv[2]) * S);
    const ctr = new THREE.Vector3();
    for (const F of faces) {
      const f = F.f || F;
      if (F.w) { _w.set(F.w[0], F.w[1], F.w[2]); if (hasRot) _w.applyMatrix4(_m); }
      for (let k = 1; k < f.length - 1; k++) {
        const a = out[f[0]], b = out[f[k]], d = out[f[k + 1]];
        if (!F.w) { ctr.copy(a).add(b).add(d).multiplyScalar(1 / 3).sub(centre); _w.copy(ctr); }
        pushTri(t, a, b, d, _w, sh, this.uvTile);
      }
    }
  }

  /** Bevelled, optionally tapered box. size=[w,h,d]. o: {bevel, tz:[sx0,sy0,sx1,sy1] taper along Z (front/-z end first), ty:[sx0,sz0,sx1,sz1] along Y (bottom first), rot:[degX,degY,degZ], shade} */
  box(mat, c, size, o = {}) {
    const hx = size[0] / 2, hy = size[1] / 2, hz = size[2] / 2;
    const bv = Math.min(o.bevel ?? 0, hx * 0.95, hy * 0.95, hz * 0.95);
    const { tz, ty } = o;
    const tap = (x, y, z) => {
      let sx = 1, sy = 1, sz = 1;
      if (tz) { const u = (z + hz) / (2 * hz || 1); sx *= tz[0] + (tz[2] - tz[0]) * u; sy *= tz[1] + (tz[3] - tz[1]) * u; }
      if (ty) { const u = (y + hy) / (2 * hy || 1); sx *= ty[0] + (ty[2] - ty[0]) * u; sz *= ty[1] + (ty[3] - ty[1]) * u; }
      return [x * sx, y * sy, z * sz];
    };
    const verts = [], faces = [];
    if (bv <= 0) {
      const id = (sx, sy, sz) => ((sx > 0 ? 4 : 0) | (sy > 0 ? 2 : 0) | (sz > 0 ? 1 : 0));
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) verts.push(tap(sx * hx, sy * hy, sz * hz));
      for (const s of [-1, 1]) {
        faces.push([id(s, -1, -1), id(s, 1, -1), id(s, 1, 1), id(s, -1, 1)]);
        faces.push([id(-1, s, -1), id(1, s, -1), id(1, s, 1), id(-1, s, 1)]);
        faces.push([id(-1, -1, s), id(1, -1, s), id(1, 1, s), id(-1, 1, s)]);
      }
    } else {
      const idx = {};
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        idx[`${sx}${sy}${sz}`] = [verts.length, verts.length + 1, verts.length + 2];
        verts.push(tap(sx * hx, sy * (hy - bv), sz * (hz - bv)), tap(sx * (hx - bv), sy * hy, sz * (hz - bv)), tap(sx * (hx - bv), sy * (hy - bv), sz * hz));
      }
      const K = (sx, sy, sz) => idx[`${sx}${sy}${sz}`];
      for (const s of [-1, 1]) {
        faces.push([K(s, -1, -1)[0], K(s, 1, -1)[0], K(s, 1, 1)[0], K(s, -1, 1)[0]]);
        faces.push([K(-1, s, -1)[1], K(1, s, -1)[1], K(1, s, 1)[1], K(-1, s, 1)[1]]);
        faces.push([K(-1, -1, s)[2], K(1, -1, s)[2], K(1, 1, s)[2], K(-1, 1, s)[2]]);
      }
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) faces.push([K(sx, sy, -1)[0], K(sx, sy, 1)[0], K(sx, sy, 1)[1], K(sx, sy, -1)[1]]);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) faces.push([K(sx, -1, sz)[0], K(sx, 1, sz)[0], K(sx, 1, sz)[2], K(sx, -1, sz)[2]]);
      for (const sy of [-1, 1]) for (const sz of [-1, 1]) faces.push([K(-1, sy, sz)[1], K(1, sy, sz)[1], K(1, sy, sz)[2], K(-1, sy, sz)[2]]);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) faces.push(K(sx, sy, sz));
    }
    this._build(mat, verts, faces, c, o);
    return this;
  }

  /** Cylinder / frustum along Z (axis:'x'|'y' to re-orient). r0 at the -end, r1 at the +end. o.sx/sy = elliptical scale, o.open = no caps. */
  cyl(mat, c, r0, r1, len, sides = 8, o = {}) {
    const hz = len / 2, verts = [], faces = [];
    const ph = (o.phase ?? 0.5) * (Math.PI * 2 / sides), sx = o.sx ?? 1, sy = o.sy ?? 1;
    for (let i = 0; i < sides; i++) { const a = ph + (i / sides) * Math.PI * 2; verts.push([Math.cos(a) * r0 * sx, Math.sin(a) * r0 * sy, -hz]); }
    for (let i = 0; i < sides; i++) { const a = ph + (i / sides) * Math.PI * 2; verts.push([Math.cos(a) * r1 * sx, Math.sin(a) * r1 * sy, hz]); }
    for (let i = 0; i < sides; i++) { const j = (i + 1) % sides; faces.push([i, j, sides + j, sides + i]); }
    if (!o.open) { const f0 = [], f1 = []; for (let i = 0; i < sides; i++) { f0.push(i); f1.push(sides + i); } faces.push(f0, f1); }
    let oo = o;
    if (o.axis === 'x') oo = { ...o, rot: [0, 90, 0] }; else if (o.axis === 'y') oo = { ...o, rot: [-90, 0, 0] };
    this._build(mat, verts, faces, c, oo);
    return this;
  }
  cylX(mat, c, r0, r1, len, sides, o = {}) { return this.cyl(mat, c, r0, r1, len, sides, { ...o, axis: 'x' }); }
  cylY(mat, c, r0, r1, len, sides, o = {}) { return this.cyl(mat, c, r0, r1, len, sides, { ...o, axis: 'y' }); }

  /** Low-poly sphere / ellipsoid (icosahedron). */
  ball(mat, c, r, o = {}) {
    let g = new THREE.IcosahedronGeometry(1, o.detail ?? 0); if (g.index) g = g.toNonIndexed(); const p = g.attributes.position;
    const verts = [], faces = [];
    for (let i = 0; i < p.count; i++) verts.push([p.getX(i) * r * (o.sx ?? 1), p.getY(i) * r * (o.sy ?? 1), p.getZ(i) * r * (o.sz ?? 1)]);
    for (let i = 0; i < p.count; i += 3) faces.push([i, i + 1, i + 2]);
    g.dispose(); this._build(mat, verts, faces, c, o); return this;
  }

  /** Torus in the XY plane (axis Z): radius R, tube radius r. */
  ring(mat, c, R, r, segs = 12, tube = 4, o = {}) {
    const verts = [], faces = [], depth = o.depth ?? r;
    for (let i = 0; i < segs; i++) for (let j = 0; j < tube; j++) {
      const a = (i / segs) * Math.PI * 2, b = (j / tube) * Math.PI * 2 + Math.PI / tube; const rr = R + Math.cos(b) * r;
      verts.push([Math.cos(a) * rr, Math.sin(a) * rr, Math.sin(b) * depth]);
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < tube; j++) {
      const i1 = (i + 1) % segs, j1 = (j + 1) % tube, am = ((i + 0.5) / segs) * Math.PI * 2, bm = ((j + 0.5) / tube) * Math.PI * 2 + Math.PI / tube;
      faces.push({ f: [i * tube + j, i1 * tube + j, i1 * tube + j1, i * tube + j1], w: [Math.cos(bm) * Math.cos(am), Math.cos(bm) * Math.sin(am), Math.sin(bm)] });
    }
    this._build(mat, verts, faces, c, o); return this;
  }

  /** Extrude a side profile [[z,y],...] (cm, either winding) along X. Width w centred on x. o.bevel chamfers the side caps. */
  side(mat, x, w, pts, o = {}) {
    const n = pts.length, hw = w / 2, bv = Math.min(o.bevel ?? 0, hw * 0.9);
    let area = 0, cz = 0, cy = 0;
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; cz += p[0]; cy += p[1]; }
    cz /= n; cy /= n; const sgn = area >= 0 ? 1 : -1;    // CCW in (z,y) -> outward normal (dy,-dz)
    let rad = 0; for (const p of pts) rad += Math.hypot(p[0] - cz, p[1] - cy); rad /= n;
    const k = bv > 0 ? Math.min(0.5, bv / rad) : 0;
    const rings = bv > 0 ? [[-hw, true], [-hw + bv, false], [hw - bv, false], [hw, true]] : [[-hw, false], [hw, false]];
    const verts = [], faces = [];
    for (const [xx, ins] of rings) for (const p of pts) { const q = ins ? [cz + (p[0] - cz) * (1 - k), cy + (p[1] - cy) * (1 - k)] : p; verts.push([xx, q[1], q[0]]); }
    for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, dz = pts[j][0] - pts[i][0], dy = pts[j][1] - pts[i][1];
      // profile coords are (z,y). For CCW (z right, y up) outward normal = (dy, -dz) in (z,y).
      const oz = sgn * dy, oy = -sgn * dz;
      const xs = r === 0 && bv > 0 ? -0.8 : r === rings.length - 2 && bv > 0 ? 0.8 : 0;
      faces.push({ f: [r * n + i, r * n + j, (r + 1) * n + j, (r + 1) * n + i], w: [xs, oy, oz] });
    }
    const tri = THREE.ShapeUtils.triangulateShape(pts.map((p) => new THREE.Vector2(p[0], p[1])), []);
    const last = (rings.length - 1) * n;
    for (const [a, b, c2] of tri) { faces.push({ f: [a, b, c2], w: [-1, 0, 0] }); faces.push({ f: [last + a, last + b, last + c2], w: [1, 0, 0] }); }
    this._build(mat, verts, faces, [x, 0, 0], o); return this;
  }
}

/** Merge a Part's per-material triangles into BufferGeometries. Returns Map(matKey -> BufferGeometry). */
export function toGeometries(part) {
  const out = new Map();
  for (const [key, t] of part.mats) {
    if (!t.count) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(t.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(t.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(t.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(t.uv, 2));
    g.computeBoundingSphere();
    out.set(key, g);
  }
  return out;
}
