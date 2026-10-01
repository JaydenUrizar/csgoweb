// Geometry accumulators: VisBuilder (chunked, per-material, vertex-coloured render geometry) and ColBuilder (positions only).
import * as THREE from 'three';

/** metres per texture repeat; local:true => UVs start at the box origin instead of world zero */
export const MAT = {
  wall: { tile: 4 }, plaster: { tile: 4 }, floor: { tile: 4 }, brick: { tile: 2 }, sand: { tile: 8 }, tile: { tile: 2 },
  roof: { tile: 4 }, wood: { tile: 2 }, crate: { tile: 1.4, local: true }, metal: { tile: 2 }, ribbed: { tile: 2 }, deck: { tile: 2 },
  cloth: { tile: 2 }, plain: { tile: 1 }, emissive: { tile: 1 }, glass: { tile: 1 }, water: { tile: 4 }, foliage: { tile: 1 }, signs: { tile: 1, rgba: true }, contact: { tile: 1, rgba: true },
};

const _c = new THREE.Color();
/** sRGB hex -> linear [r,g,b] */
export const rgb = (hex) => { _c.setHex(hex); return [_c.r, _c.g, _c.b]; };
export const mulc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export class VisBuilder {
  constructor(chunk = 34) { this.chunk = chunk; this.b = new Map(); this.tris = 0; }
  bucket(mat, x, z) {
    const cx = Math.floor((x + 50) / this.chunk), cz = Math.floor((z + 52) / this.chunk);
    const key = mat + '|' + cx + '|' + cz;
    let b = this.b.get(key);
    if (!b) { b = { mat, cx, cz, pos: [], nor: [], uv: [], col: [], idx: [], rgba: !!MAT[mat]?.rgba }; this.b.set(key, b); }
    return b;
  }
  /** a,b,c,d: [x,y,z] CCW seen from outside. cols: [r,g,b] or array of 4. o.uv explicit [[u,v]x4]; o.uvo origin for local mats; o.chunkAt [x,z] */
  quad(mat, a, b, c, d, cols, o = {}) {
    const cx = (a[0] + b[0] + c[0] + d[0]) / 4, cz = (a[2] + b[2] + c[2] + d[2]) / 4;
    const bk = this.bucket(mat, o.chunkAt ? o.chunkAt[0] : cx, o.chunkAt ? o.chunkAt[1] : cz);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const P = [a, b, c, d];
    const base = bk.pos.length / 3;
    const info = MAT[mat] || MAT.plain; const inv = 1 / info.tile;
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    const ox = o.uvo ? o.uvo[0] : 0, oy = o.uvo ? o.uvo[1] : 0, oz = o.uvo ? o.uvo[2] : 0;
    for (let k = 0; k < 4; k++) {
      const p = P[k];
      bk.pos.push(p[0], p[1], p[2]); bk.nor.push(nx, ny, nz);
      if (o.uv) bk.uv.push(o.uv[k][0], o.uv[k][1]);
      else if (ay >= ax && ay >= az) bk.uv.push((p[0] - ox) * inv, (p[2] - oz) * inv);
      else if (ax >= az) bk.uv.push((p[2] - oz) * inv * (nx > 0 ? -1 : 1), (p[1] - oy) * inv);
      else bk.uv.push((p[0] - ox) * inv * (nz > 0 ? 1 : -1), (p[1] - oy) * inv);
      const cc = Array.isArray(cols[0]) ? cols[k] : cols;
      bk.col.push(cc[0], cc[1], cc[2]); if (bk.rgba) bk.col.push(cc[3] === undefined ? 1 : cc[3]);
    }
    bk.idx.push(base, base + 1, base + 2, base, base + 2, base + 3); this.tris += 2;
  }
  tri(mat, a, b, c, cols, o = {}) {
    const bk = this.bucket(mat, (a[0] + b[0] + c[0]) / 3, (a[2] + b[2] + c[2]) / 3);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const info = MAT[mat] || MAT.plain; const inv = 1 / info.tile; const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    const base = bk.pos.length / 3;
    for (let k = 0; k < 3; k++) {
      const p = [a, b, c][k]; bk.pos.push(p[0], p[1], p[2]); bk.nor.push(nx, ny, nz);
      if (ay >= ax && ay >= az) bk.uv.push(p[0] * inv, p[2] * inv); else if (ax >= az) bk.uv.push(p[2] * inv, p[1] * inv); else bk.uv.push(p[0] * inv, p[1] * inv);
      const cc = Array.isArray(cols[0]) ? cols[k] : cols; bk.col.push(cc[0], cc[1], cc[2]); if (bk.rgba) bk.col.push(cc[3] === undefined ? 1 : cc[3]);
    }
    bk.idx.push(base, base + 1, base + 2); this.tris += 1;
  }
  /** Axis-aligned box. o: {bottom:false, top:true, ao:0.72 (bottom vertex darkening), colTop, uvLocal, skip:{px,nx,pz,nz}} */
  box(mat, x0, y0, z0, x1, y1, z1, color, o = {}) {
    const ao = o.ao ?? 0.74, c = color, cb = mulc(c, ao), ct = o.colTop ? o.colTop : mulc(c, 1.04);
    const uvo = MAT[mat]?.local || o.uvLocal ? [x0, y0, z0] : undefined; const oo = { uvo, chunkAt: o.chunkAt };
    const sk = o.skip || {};
    if (!sk.px) this.quad(mat, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [cb, cb, c, c], oo);
    if (!sk.nx) this.quad(mat, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [cb, cb, c, c], oo);
    if (!sk.pz) this.quad(mat, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [cb, cb, c, c], oo);
    if (!sk.nz) this.quad(mat, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [cb, cb, c, c], oo);
    if (o.top !== false) this.quad(mat, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], ct, oo);
    if (o.bottom) this.quad(mat, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], cb, oo);
  }
  /** Add an arbitrary non-indexed THREE.BufferGeometry already in world space. colorFn(x,y,z,nx,ny,nz)->[r,g,b] */
  geometry(mat, geo, colorFn, o = {}) {
    const pos = geo.attributes.position, nor = geo.attributes.normal, n = pos.count;
    const info = MAT[mat] || MAT.plain; const inv = 1 / info.tile;
    const idxA = geo.index;
    const triCount = idxA ? idxA.count / 3 : n / 3;
    for (let t = 0; t < triCount; t++) {
      const ia = idxA ? idxA.getX(t * 3) : t * 3, ib = idxA ? idxA.getX(t * 3 + 1) : t * 3 + 1, ic = idxA ? idxA.getX(t * 3 + 2) : t * 3 + 2;
      const ids = [ia, ib, ic];
      const cx = (pos.getX(ia) + pos.getX(ib) + pos.getX(ic)) / 3, cz = (pos.getZ(ia) + pos.getZ(ib) + pos.getZ(ic)) / 3;
      const bk = this.bucket(mat, cx, cz);
      const base = bk.pos.length / 3;
      for (const i of ids) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
        bk.pos.push(x, y, z); bk.nor.push(nx, ny, nz);
        const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
        if (ay >= ax && ay >= az) bk.uv.push(x * inv, z * inv); else if (ax >= az) bk.uv.push(z * inv, y * inv); else bk.uv.push(x * inv, y * inv);
        const cc = colorFn(x, y, z, nx, ny, nz); bk.col.push(cc[0], cc[1], cc[2]); if (bk.rgba) bk.col.push(cc[3] === undefined ? 1 : cc[3]);
      }
      bk.idx.push(base, base + 1, base + 2); this.tris++;
    }
  }
  /** -> [{mat, cx, cz, geometry}] */
  finish() {
    const out = [];
    for (const b of this.b.values()) {
      if (!b.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, b.rgba ? 4 : 3));
      g.setIndex(b.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
      g.computeBoundingSphere(); g.computeBoundingBox();
      out.push({ mat: b.mat, cx: b.cx, cz: b.cz, geometry: g });
    }
    return out;
  }
}

export class ColBuilder {
  constructor() { this.pos = []; this.idx = []; this.owner = []; this.owners = [{ kind: 'terrain' }]; }
  addOwner(o) { this.owners.push(o); return this.owners.length - 1; }
  quad(a, b, c, d, owner = 0) {
    const base = this.pos.length / 3;
    for (const p of [a, b, c, d]) { this.pos.push(p[0], p[1], p[2]); this.owner.push(owner); }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  tri(a, b, c, owner = 0) {
    const base = this.pos.length / 3;
    for (const p of [a, b, c]) { this.pos.push(p[0], p[1], p[2]); this.owner.push(owner); }
    this.idx.push(base, base + 1, base + 2);
  }
  box(x0, y0, z0, x1, y1, z1, owner = 0) {
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], owner);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], owner);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], owner);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], owner);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], owner);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], owner);
  }
  /** Convex prism/extrusion helper: polygon (array of [x,z], CCW seen from above) between y0,y1 */
  prism(poly, y0, y1, owner = 0) {
    const n = poly.length;
    for (let i = 0; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; this.quad([q[0], y0, q[1]], [p[0], y0, p[1]], [p[0], y1, p[1]], [q[0], y1, q[1]], owner); }
    for (let i = 1; i < n - 1; i++) { this.tri([poly[0][0], y1, poly[0][1]], [poly[i + 1][0], y1, poly[i + 1][1]], [poly[i][0], y1, poly[i][1]], owner); this.tri([poly[0][0], y0, poly[0][1]], [poly[i][0], y0, poly[i][1]], [poly[i + 1][0], y0, poly[i + 1][1]], owner); }
  }
  geometry(geo, owner = 0) {
    const pos = geo.attributes.position, idxA = geo.index; const n = idxA ? idxA.count : pos.count;
    for (let t = 0; t < n; t += 3) {
      const ids = [0, 1, 2].map((k) => idxA ? idxA.getX(t + k) : t + k);
      this.tri(ids.map((i) => [pos.getX(i), pos.getY(i), pos.getZ(i)])[0], [pos.getX(ids[1]), pos.getY(ids[1]), pos.getZ(ids[1])], [pos.getX(ids[2]), pos.getY(ids[2]), pos.getZ(ids[2])], owner);
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('owner', new THREE.Uint16BufferAttribute(this.owner, 1));
    g.setIndex(new THREE.Uint32BufferAttribute(this.idx, 1));
    return g;
  }
}
