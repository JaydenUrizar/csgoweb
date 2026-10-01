// Structures & props. Everything is added to the shared VisBuilder (merged, per material/chunk) and, where solid, ColBuilder.
// Pure (no DOM). `Dress` collects registries consumed by index.js: thinWalls, cover objects, lamps, decal requests.
import * as THREE from 'three';
import { rgb, mulc, mixc } from './builder.js';
import { heightAt } from './grid.js';

const TAU = Math.PI * 2;

export class Dress {
  constructor(VB, VBroof, CB, grid) {
    this.VB = VB; this.VBroof = VBroof; this.CB = CB; this.g = grid;
    this.thinWalls = []; this.objects = []; this.lamps = []; this.decals = []; this.contacts = []; this.waters = []; this.roofBoxes = [];
  }
  ground(x, z) { return heightAt(this.g, x, z); }
  /** min ground over footprint */
  groundMin(x0, z0, x1, z1) { let m = 1e9; for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [(x0 + x1) / 2, (z0 + z1) / 2]]) m = Math.min(m, this.ground(x, z)); return m; }

  owner(o) { return this.CB.addOwner(o); }

  /** Generic solid box (visual + collision). */
  solid({ x0, z0, x1, z1, y0, y1, mat = 'crate', color = 0xc8965c, surf = 'wood', thin = null, name = '', visual = true, collide = true, ao = 0.74, cover = false, site = null, top = true, builder = null, kind = 'box', bottom = false }) {
    const VB = builder || this.VB;
    if (visual) VB.box(mat, x0, y0, z0, x1, y1, z1, rgb(color), { ao, top, bottom });
    if (collide) {
      const own = this.owner({ kind: 'prop', surface: surf, thin: thin ? { ...thin, name, box: new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)) } : null, name });
      this.CB.box(x0, y0, z0, x1, y1, z1, own);
      if (thin) this.thinWalls.push(this.CB.owners[own].thin);
    }
    if (cover) this.objects.push({ name, kind, min: [x0, y0, z0], max: [x1, y1, z1], center: [(x0 + x1) / 2, y1, (z0 + z1) / 2], height: y1 - y0 });
    if (y0 - this.ground((x0 + x1) / 2, (z0 + z1) / 2) < 0.2 && visual && y1 - y0 > 0.3) this.contacts.push([x0, z0, x1, z1, y0]);
  }

  crate(x, z, s = 1.4, o = {}) {
    const h = o.h ?? s, d = o.d ?? s; const y0 = o.y0 ?? this.groundMin(x - s / 2, z - d / 2, x + s / 2, z + d / 2);
    const cols = { wood: 0xd09a60, ember: 0xe8883e, tide: 0x45b8c8, olive: 0xa6a468, dark: 0x8a6440 };
    this.solid({ x0: x - s / 2, x1: x + s / 2, z0: z - d / 2, z1: z + d / 2, y0, y1: y0 + h, mat: 'crate', color: cols[o.variant || 'wood'], surf: 'wood', thin: { surface: 'wood', mul: 0.55, name: 'crate' }, name: o.name || 'crate', cover: o.cover !== false, site: o.site, kind: 'crate' });
    return y0 + h;
  }
  /** rectangular crate by extents */
  crateBox(x0, z0, x1, z1, h, o = {}) { const y0 = o.y0 ?? this.groundMin(x0, z0, x1, z1); const cols = { wood: 0xd09a60, ember: 0xe8883e, tide: 0x45b8c8, olive: 0xa6a468, dark: 0x8a6440 };
    this.solid({ x0, x1, z0, z1, y0, y1: y0 + h, mat: 'crate', color: cols[o.variant || 'wood'], surf: 'wood', thin: o.thin === false ? null : { surface: 'wood', mul: 0.55, name: 'crate' }, name: o.name || 'crate', cover: true, kind: 'crate' }); return y0 + h; }
  container(x0, z0, x1, z1, h, color = 0x2a9d9f, o = {}) {
    const y0 = o.y0 ?? this.groundMin(x0, z0, x1, z1);
    this.solid({ x0, x1, z0, z1, y0, y1: y0 + h, mat: 'ribbed', color, surf: 'metal', name: o.name || 'container', cover: true, kind: 'container', ao: 0.8 });
    // corner posts & roof trim
    const t = 0.1, tc = mulc(rgb(color), 0.55);
    for (const [px, pz] of [[x0, z0], [x1 - t, z0], [x0, z1 - t], [x1 - t, z1 - t]]) this.VB.box('plain', px - 0.02, y0, pz - 0.02, px + t + 0.02, y0 + h + 0.02, pz + t + 0.02, tc, { ao: 1, top: false });
    this.VB.box('plain', x0 - 0.03, y0 + h - 0.02, z0 - 0.03, x1 + 0.03, y0 + h + 0.05, z1 + 0.03, tc, { ao: 1 });
    return y0 + h;
  }
  barrel(x, z, o = {}) {
    const h = o.h ?? 1.0, r = o.r ?? 0.42, y0 = o.y0 ?? this.ground(x, z);
    const col = o.color ?? [0xb87a46, 0xa86c3c, 0x7d5a3a][Math.abs((Math.floor(x * 7 + z * 13))) % 3];
    const n = 8, VB = this.VB, c = rgb(col), dark = mulc(c, 0.55);
    const ring = (rr, ya, yb, cc) => {
      for (let i = 0; i < n; i++) {
        const a0 = i / n * TAU, a1 = (i + 1) / n * TAU; const x0 = x + Math.cos(a0) * rr, z0 = z + Math.sin(a0) * rr, x1 = x + Math.cos(a1) * rr, z1 = z + Math.sin(a1) * rr;
        VB.quad('wood', [x1, ya, z1], [x0, ya, z0], [x0, yb, z0], [x1, yb, z1], [mulc(cc, 0.72), mulc(cc, 0.72), cc, cc]);
      }
    };
    const rb = r * 1.08;
    // bulged barrel: two stacked bands
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU, a1 = (i + 1) / n * TAU;
      const pt = (a, rr, y) => [x + Math.cos(a) * rr, y, z + Math.sin(a) * rr];
      VB.quad('wood', pt(a1, r * 0.93, y0), pt(a0, r * 0.93, y0), pt(a0, rb, y0 + h * 0.5), pt(a1, rb, y0 + h * 0.5), [mulc(c, 0.7), mulc(c, 0.7), c, c]);
      VB.quad('wood', pt(a1, rb, y0 + h * 0.5), pt(a0, rb, y0 + h * 0.5), pt(a0, r * 0.93, y0 + h), pt(a1, r * 0.93, y0 + h), [c, c, mulc(c, 1.05), mulc(c, 1.05)]);
      VB.tri('wood', [x, y0 + h, z], pt(a1, r * 0.93, y0 + h), pt(a0, r * 0.93, y0 + h), mulc(c, 1.1));
    }
    ring(rb + 0.012, y0 + h * 0.18, y0 + h * 0.24, dark); ring(rb + 0.012, y0 + h * 0.76, y0 + h * 0.82, dark);
    const rr = r * 0.82; const poly = []; for (let i = 0; i < n; i++) poly.push([x + Math.cos(i / n * TAU) * rr, z + Math.sin(i / n * TAU) * rr]);
    // collision prism (CCW from above): our poly goes +angle = from +x towards +z i.e. clockwise seen from above -> reverse
    const own = this.owner({ kind: 'prop', surface: 'wood', thin: null, name: 'barrel' });
    this.CB.prism(poly.slice().reverse(), y0, y0 + h, own);
    this.objects.push({ name: 'barrel', kind: 'barrel', min: [x - r, y0, z - r], max: [x + r, y0 + h, z + r], center: [x, y0 + h, z], height: h });
    this.contacts.push([x - r, z - r, x + r, z + r, y0]);
  }
  barrels(list, o) { for (const [x, z] of list) this.barrel(x, z, o); }

  pillar(x, z, w = 1.0, h = 4.5, o = {}) {
    const y0 = o.y0 ?? this.groundMin(x - w / 2, z - w / 2, x + w / 2, z + w / 2), col = o.color ?? 0xe8d3a6;
    const mat = o.mat || 'wall';
    this.solid({ x0: x - w / 2, x1: x + w / 2, z0: z - w / 2, z1: z + w / 2, y0, y1: y0 + h, mat, color: col, surf: 'stone', name: 'pillar', cover: true, kind: 'pillar', ao: 0.85 });
    const bw = w + 0.3, cw = w + 0.4;
    this.VB.box('wall', x - bw / 2, y0, z - bw / 2, x + bw / 2, y0 + 0.45, z + bw / 2, rgb(col), { ao: 0.8 });
    this.VB.box('wall', x - cw / 2, y0 + h - 0.4, z - cw / 2, x + cw / 2, y0 + h, z + cw / 2, mulc(rgb(col), 1.05), { ao: 0.9 });
    const own = this.owner({ kind: 'prop', surface: 'stone', name: 'pillar-base' });
    this.CB.box(x - bw / 2, y0, z - bw / 2, x + bw / 2, y0 + 0.45, z + bw / 2, own);
    if (o.trim) this.VB.box('emissive', x - w / 2 - 0.02, y0 + h * 0.62, z - w / 2 - 0.02, x + w / 2 + 0.02, y0 + h * 0.62 + 0.12, z + w / 2 + 0.02, mulc(rgb(o.trim), 2.2), { ao: 1, top: false });
  }
  lowWall(x0, z0, x1, z1, h, o = {}) {
    const y0 = o.y0 ?? this.groundMin(x0, z0, x1, z1);
    this.solid({ x0, x1, z0, z1, y0, y1: y0 + h, mat: o.mat || 'wall', color: o.color ?? 0xe6cf9f, surf: 'stone', name: o.name || 'low-wall', cover: true, kind: 'wall', ao: 0.8 });
    this.VB.box('wall', x0 - 0.06, y0 + h - 0.12, z0 - 0.06, x1 + 0.06, y0 + h + 0.05, z1 + 0.06, mulc(rgb(o.color ?? 0xe6cf9f), 1.08), { ao: 0.95 });
  }
  /** thin railing (visual posts + rail, collision thin box) */
  railing(x0, z0, x1, z1, y0, h = 1.05, o = {}) {
    const c = rgb(o.color ?? 0x4a5560), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const lx = Math.min(x0, x1), lz = Math.min(z0, z1), t = 0.07;
    const n = Math.max(1, Math.round(len / 1.5));
    for (let i = 0; i <= n; i++) { const p = i / n * len; const px = alongX ? lx + p : x0, pz = alongX ? z0 : lz + p; this.VB.box('plain', px - t, y0, pz - t, px + t, y0 + h, pz + t, c, { ao: 0.8 }); }
    const rail = (yy, tt) => alongX ? this.VB.box('plain', lx, yy, z0 - tt, lx + len, yy + tt * 1.6, z0 + tt, c, { ao: 1 }) : this.VB.box('plain', x0 - tt, yy, lz, x0 + tt, yy + tt * 1.6, lz + len, c, { ao: 1 });
    rail(y0 + h - 0.08, 0.05); rail(y0 + h * 0.5, 0.03);
    const hw = 0.08;
    const bx0 = alongX ? lx : x0 - hw, bx1 = alongX ? lx + len : x0 + hw, bz0 = alongX ? z0 - hw : lz, bz1 = alongX ? z0 + hw : lz + len;
    const own = this.owner({ kind: 'prop', surface: 'metal', thin: { surface: 'metal', mul: 0.9, name: 'railing', box: new THREE.Box3(new THREE.Vector3(bx0, y0, bz0), new THREE.Vector3(bx1, y0 + h, bz1)) }, name: 'railing' });
    this.CB.box(bx0, y0, bz0, bx1, y0 + h, bz1, own); this.thinWalls.push(this.CB.owners[own].thin);
  }
  planter(x, z, w = 1.6, d = 1.0, h = 0.75, o = {}) {
    const y0 = this.groundMin(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
    this.solid({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0, y1: y0 + h, mat: o.mat || 'wall', color: o.color ?? 0xc8693f, surf: 'stone', name: 'planter', cover: true, kind: 'planter', ao: 0.8 });
    this.VB.box('plain', x - w / 2 + 0.08, y0 + h - 0.03, z - d / 2 + 0.08, x + w / 2 - 0.08, y0 + h + 0.04, z + d / 2 - 0.08, rgb(0x4a3322), { ao: 1 });
    const g1 = rgb(0x5fa04a), g2 = rgb(0x86bb5c);
    const cnt = Math.max(2, Math.round(w * d * 1.8));
    for (let i = 0; i < cnt; i++) {
      const px = x + (this.rnd(i * 3 + x) - 0.5) * (w - 0.5), pz = z + (this.rnd(i * 5 + z) - 0.5) * (d - 0.4), r = 0.32 + this.rnd(i + 9) * 0.22;
      this.bush(px, y0 + h + 0.02, pz, r, i % 2 ? g1 : g2);
    }
    if (o.flowers) for (let i = 0; i < 6; i++) { const px = x + (this.rnd(i * 11 + x) - 0.5) * (w - 0.3), pz = z + (this.rnd(i * 7 + z) - 0.5) * (d - 0.3); this.VB.box('plain', px - 0.05, y0 + h + 0.45, pz - 0.05, px + 0.05, y0 + h + 0.55, pz + 0.05, rgb(i % 2 ? 0xe84d3d : 0xf2c14e), { ao: 1 }); }
  }
  rnd(s) { const v = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); }
  /** low-poly bush: lumpy octahedron */
  bush(x, y, z, r, col) {
    const VB = this.VB, top = [x, y + r * 1.15, z], bot = [x, y, z]; const n = 5;
    for (let i = 0; i < n; i++) {
      const a0 = i / n * TAU + 0.3, a1 = (i + 1) / n * TAU + 0.3, k = 0.85 + this.rnd(x * 3 + i + z) * 0.35;
      const p0 = [x + Math.cos(a0) * r * k, y + r * 0.55, z + Math.sin(a0) * r * k], p1 = [x + Math.cos(a1) * r * k, y + r * 0.55, z + Math.sin(a1) * r * k];
      VB.tri('foliage', top, p1, p0, mulc(col, 1.1)); VB.tri('foliage', bot, p0, p1, mulc(col, 0.55));
    }
  }
  palm(x, z, h = 4.2, o = {}) {
    const y0 = this.ground(x, z), VB = this.VB, trunk = rgb(0x8a6a48), n = 6, r0 = 0.2, r1 = 0.12;
    const seg = 3;
    for (let s = 0; s < seg; s++) {
      const ya = y0 + h * s / seg, yb = y0 + h * (s + 1) / seg, ra = r0 + (r1 - r0) * s / seg, rb = r0 + (r1 - r0) * (s + 1) / seg;
      const lean = 0.22; const xa = x + lean * (s / seg) ** 2 * h * 0.3, xb = x + lean * ((s + 1) / seg) ** 2 * h * 0.3;
      for (let i = 0; i < n; i++) { const a0 = i / n * TAU, a1 = (i + 1) / n * TAU;
        VB.quad('plain', [xa + Math.cos(a1) * ra, ya, z + Math.sin(a1) * ra], [xa + Math.cos(a0) * ra, ya, z + Math.sin(a0) * ra], [xb + Math.cos(a0) * rb, yb, z + Math.sin(a0) * rb], [xb + Math.cos(a1) * rb, yb, z + Math.sin(a1) * rb], [mulc(trunk, s % 2 ? 0.8 : 1), mulc(trunk, s % 2 ? 0.8 : 1), mulc(trunk, s % 2 ? 1 : 0.8), mulc(trunk, s % 2 ? 1 : 0.8)]); }
    }
    const tx = x + 0.22 * h * 0.3, ty = y0 + h;
    const leaf = [rgb(0x4f9a46), rgb(0x6db356), rgb(0x3f8a3f)];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + this.rnd(x + i) * 0.4, len = 1.7 + this.rnd(z + i * 3) * 0.6, droop = 0.9 + this.rnd(i + x * z) * 0.5;
      const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx; const wd = 0.38;
      const tip = [tx + dx * len, ty - droop * 0.5, z + dz * len], mid = [tx + dx * len * 0.5, ty + 0.35, z + dz * len * 0.5];
      const c = leaf[i % 3];
      VB.tri('foliage', [tx, ty + 0.05, z], [mid[0] + px * wd, mid[1], mid[2] + pz * wd], [mid[0] - px * wd, mid[1], mid[2] - pz * wd], mulc(c, 1.0));
      VB.tri('foliage', [mid[0] + px * wd, mid[1], mid[2] + pz * wd], tip, [mid[0] - px * wd, mid[1], mid[2] - pz * wd], mulc(c, 1.15));
    }
    const own = this.owner({ kind: 'prop', surface: 'wood', name: 'palm' }); this.CB.box(x - 0.22, y0, z - 0.22, x + 0.22, y0 + 2.2, z + 0.22, own);
    this.contacts.push([x - 0.4, z - 0.4, x + 0.4, z + 0.4, y0]);
  }
  /** octagonal fountain basin with water and a central column */
  fountain(cx, cz, r = 2.6, h = 0.9, o = {}) {
    const y0 = this.ground(cx, cz), n = 8, VB = this.VB, c = rgb(o.color ?? 0xe8d6ac), wt = rgb(0x2aa6a6);
    const pt = (rr, a, y) => [cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr];
    const ro = r, ri = r - 0.45;
    for (let i = 0; i < n; i++) {
      const a0 = (i + 0.5) / n * TAU, a1 = (i + 1.5) / n * TAU;
      VB.quad('wall', pt(ro, a1, y0), pt(ro, a0, y0), pt(ro, a0, y0 + h), pt(ro, a1, y0 + h), [mulc(c, 0.75), mulc(c, 0.75), c, c]);       // outer
      VB.quad('wall', pt(ri, a0, y0 + h * 0.55), pt(ri, a1, y0 + h * 0.55), pt(ri, a1, y0 + h), pt(ri, a0, y0 + h), [mulc(c, 0.6), mulc(c, 0.6), mulc(c, 0.9), mulc(c, 0.9)]);   // inner
      VB.quad('wall', pt(ri, a0, y0 + h), pt(ri, a1, y0 + h), pt(ro, a1, y0 + h), pt(ro, a0, y0 + h), mulc(c, 1.08)); // rim top (faces up: inner->outer)
      VB.tri('water', [cx, y0 + h * 0.72, cz], pt(ri, a1, y0 + h * 0.72), pt(ri, a0, y0 + h * 0.72), wt);
      this.waters.push(0);
    }
    const poly = []; for (let i = 0; i < n; i++) poly.push([cx + Math.cos((i + 0.5) / n * TAU) * (ro - 0.05), cz + Math.sin((i + 0.5) / n * TAU) * (ro - 0.05)]);
    const own = this.owner({ kind: 'prop', surface: 'stone', name: 'fountain' }); this.CB.prism(poly.slice().reverse(), y0, y0 + h, own);
    this.objects.push({ name: 'fountain', kind: 'fountain', min: [cx - r, y0, cz - r], max: [cx + r, y0 + h, cz + r], center: [cx, y0 + h, cz], height: h });
    // central column + bowl + orb
    this.VB.box('wall', cx - 0.45, y0 + h * 0.7, cz - 0.45, cx + 0.45, y0 + h * 0.7 + 0.5, cz + 0.45, c, { ao: 0.85 });
    this.VB.box('wall', cx - 0.28, y0 + h * 0.7 + 0.5, cz - 0.28, cx + 0.28, y0 + h + 1.6, cz + 0.28, mulc(c, 1.04), { ao: 0.95 });
    this.VB.box('wall', cx - 0.7, y0 + h + 1.6, cz - 0.7, cx + 0.7, y0 + h + 1.85, cz + 0.7, mulc(c, 1.05), { ao: 0.9 });
    this.VB.box('emissive', cx - 0.3, y0 + h + 1.85, cz - 0.3, cx + 0.3, y0 + h + 2.35, cz + 0.3, rgb(o.glow ?? 0x62e6d8).map((v) => v * 2.4), { ao: 1 });
    const own2 = this.owner({ kind: 'prop', surface: 'stone', name: 'fountain-column' }); this.CB.box(cx - 0.3, y0, cz - 0.3, cx + 0.3, y0 + h + 1.8, cz + 0.3, own2);
    this.lamps.push({ pos: [cx, y0 + h + 2.4, cz], color: o.glow ?? 0x62e6d8, intensity: 1.2 });
  }
  /** sloped cloth awning (visual only) */
  awning(x0, z0, x1, z1, y, drop = 0.5, o = {}) {
    const alongX = o.axis !== 'z'; const c = o.color ? rgb(o.color) : [1, 1, 1];
    // slopes down towards +z (axis x) or +x
    if (alongX) { this.VB.quad('cloth', [x0, y - drop, z1], [x1, y - drop, z1], [x1, y, z0], [x0, y, z0], c, { uv: [[0, 0], [x1 - x0, 0], [x1 - x0, 1], [0, 1]].map(([a, b]) => [a / 2, b]) }); this.VB.quad('cloth', [x0, y, z0], [x1, y, z0], [x1, y - drop, z1], [x0, y - drop, z1], mulc(c, 0.8), { uv: [[0, 0], [1, 0], [1, 1], [0, 1]] }); }
    else { this.VB.quad('cloth', [x1, y - drop, z0], [x1, y - drop, z1], [x0, y, z1], [x0, y, z0], c, { uv: [[0, 0], [1, 0], [1, 1], [0, 1]] }); this.VB.quad('cloth', [x0, y, z0], [x0, y, z1], [x1, y - drop, z1], [x1, y - drop, z0], mulc(c, 0.8), { uv: [[0, 0], [1, 0], [1, 1], [0, 1]] }); }
  }
  /** wooden pergola with string lights; posts collide */
  pergola(x0, z0, x1, z1, h = 3.2, o = {}) {
    const y0 = this.groundMin(x0, z0, x1, z1), wood = rgb(0x7a4f30), VB = this.VB;
    const posts = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]];
    for (const [px, pz] of posts) { this.solid({ x0: px - 0.15, x1: px + 0.15, z0: pz - 0.15, z1: pz + 0.15, y0, y1: y0 + h, mat: 'wood', color: 0x8a5a36, surf: 'wood', name: 'post', ao: 0.8 }); }
    VB.box('wood', x0 - 0.3, y0 + h, z0 - 0.15, x1 + 0.3, y0 + h + 0.22, z0 + 0.15, wood, { ao: 0.9 }); VB.box('wood', x0 - 0.3, y0 + h, z1 - 0.15, x1 + 0.3, y0 + h + 0.22, z1 + 0.15, wood, { ao: 0.9 });
    const n = Math.round((x1 - x0) / 0.9);
    for (let i = 0; i <= n; i++) { const px = x0 + (x1 - x0) * i / n; VB.box('wood', px - 0.07, y0 + h + 0.2, z0 - 0.3, px + 0.07, y0 + h + 0.34, z1 + 0.3, wood, { ao: 1 }); }
    // cloth strip across the middle third
    this.awning(x0 + 0.2, z0 + 0.2, x1 - 0.2, z1 - 0.2, y0 + h + 0.18, 0.0001, { axis: 'x' });
    for (let i = 0; i < 9; i++) { const px = x0 + (x1 - x0) * (i + 0.5) / 9; VB.box('emissive', px - 0.06, y0 + h - 0.22 - Math.sin(i * 1.3) * 0.05, z0 + (z1 - z0) / 2 - 0.06, px + 0.06, y0 + h - 0.1, z0 + (z1 - z0) / 2 + 0.06, mulc(rgb(0xffd9a0), 3.0), { ao: 1 }); }
    this.lamps.push({ pos: [(x0 + x1) / 2, y0 + h - 0.3, (z0 + z1) / 2], color: 0xffd9a0, intensity: 1 });
  }
  /** market stall table w/ produce */
  stall(x0, z0, x1, z1, o = {}) {
    const y0 = this.groundMin(x0, z0, x1, z1);
    this.solid({ x0, x1, z0, z1, y0, y1: y0 + 0.95, mat: 'wood', color: 0x9a6a40, surf: 'wood', name: 'stall', cover: true, kind: 'stall', thin: { surface: 'wood', mul: 0.6, name: 'stall' } });
    const cols = [0xe86a2a, 0xe8c12a, 0x7bbf4a, 0xd9433a];
    let k = 0; for (let x = x0 + 0.25; x < x1 - 0.2; x += 0.42) for (let z = z0 + 0.25; z < z1 - 0.2; z += 0.42) { this.VB.box('plain', x - 0.14, y0 + 0.95, z - 0.14, x + 0.14, y0 + 1.25, z + 0.14, rgb(cols[(k++ + (o.seed || 0)) % 4]), { ao: 0.9 }); }
  }
  bench(x, z, w, d, o = {}) { const y0 = this.groundMin(x - w / 2, z - d / 2, x + w / 2, z + d / 2); this.solid({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0, y1: y0 + (o.h ?? 0.55), mat: 'wood', color: 0x9a6a40, surf: 'wood', name: 'bench', ao: 0.8 }); }
  lampPost(x, z, h = 4.0, color = 0xffd9a0) {
    const y0 = this.ground(x, z), c = rgb(0x3b3f46);
    this.solid({ x0: x - 0.07, x1: x + 0.07, z0: z - 0.07, z1: z + 0.07, y0, y1: y0 + h, mat: 'plain', color: 0x3b3f46, surf: 'metal', name: 'lamp-post', ao: 0.9 });
    this.VB.box('plain', x - 0.2, y0, z - 0.2, x + 0.2, y0 + 0.3, z + 0.2, c, { ao: 0.9 });
    this.VB.box('plain', x - 0.2, y0 + h, z - 0.2, x + 0.2, y0 + h + 0.08, z + 0.2, c, { ao: 1 });
    this.VB.box('emissive', x - 0.16, y0 + h - 0.32, z - 0.16, x + 0.16, y0 + h, z + 0.16, mulc(rgb(color), 2.6), { ao: 1 });
    this.lamps.push({ pos: [x, y0 + h - 0.15, z], color, intensity: 1 });
  }
  /** wall lantern on a wall face: n = outward normal [nx,nz] */
  wallLamp(x, y, z, nx, nz, color = 0xffc880) {
    const t = 0.16, VB = this.VB, c = rgb(0x30343a);
    const x0 = x + (nx > 0 ? 0 : nx < 0 ? -t : -0.1), x1 = x + (nx > 0 ? t : nx < 0 ? 0 : 0.1), z0 = z + (nz > 0 ? 0 : nz < 0 ? -t : -0.1), z1 = z + (nz > 0 ? t : nz < 0 ? 0 : 0.1);
    VB.box('plain', x0, y - 0.22, z0, x1, y + 0.22, z1, c, { ao: 1 });
    const e = 0.025; VB.box('emissive', x0 + (nx ? (nx > 0 ? 0.04 : e) : e), y - 0.17, z0 + (nz ? (nz > 0 ? 0.04 : e) : e), x1 - (nx ? (nx > 0 ? e : 0.04) : e), y + 0.17, z1 - (nz ? (nz > 0 ? e : 0.04) : e), mulc(rgb(color), 2.8), { ao: 1, top: false });
    this.lamps.push({ pos: [x + nx * 0.3, y, z + nz * 0.3], color, intensity: 1 });
  }
  /** hanging banner. facing normal axis: 'x'|'z' with sign */
  banner(x, y, z, nx, nz, w, h, color, o = {}) {
    const c = rgb(color), ox = nx * 0.05, oz = nz * 0.05;
    const rx = nz, rz = -nx; // right vector
    const p = (u, v) => [x + rx * u * w / 2 + ox, y + v * h, z + rz * u * w / 2 + oz];
    this.VB.quad('plain', p(-1, 0), p(1, 0), p(1, 1), p(-1, 1), [mulc(c, 0.9), mulc(c, 0.9), c, c]);
    // stripes + pennant tip
    this.VB.tri('plain', p(-1, 0), p(0, -0.18), p(1, 0), mulc(c, 0.85));
    const s = rgb(o.stripe ?? 0xf6e6c0); const q = (u, v) => [x + rx * u * w / 2 + ox * 1.6, y + v * h, z + rz * u * w / 2 + oz * 1.6];
    this.VB.quad('plain', q(-0.62, 0.52), q(0.62, 0.52), q(0.62, 0.62), q(-0.62, 0.62), s);
    this.VB.quad('plain', q(-0.62, 0.7), q(0.62, 0.7), q(0.62, 0.74), q(-0.62, 0.74), mulc(s, 0.95));
    // back face so it reads from behind
    this.VB.quad('plain', [x + rx * w / 2 + ox * 0.5, y + h, z + rz * w / 2 + oz * 0.5], [x - rx * w / 2 + ox * 0.5, y + h, z - rz * w / 2 + oz * 0.5], [x - rx * w / 2 + ox * 0.5, y, z - rz * w / 2 + oz * 0.5], [x + rx * w / 2 + ox * 0.5, y, z + rz * w / 2 + oz * 0.5], mulc(c, 0.7));
    this.VB.box('plain', x - Math.abs(rx) * (w / 2 + 0.08) + ox * 0.2 - 0.0, y + h, z - Math.abs(rz) * (w / 2 + 0.08), x + Math.abs(rx) * (w / 2 + 0.08) + ox * 0.2 + 0.0, y + h + 0.1, z + Math.abs(rz) * (w / 2 + 0.08), rgb(0x4a3322), { ao: 1 });
  }

  /** Barrel-vaulted/arched gateway block. axis 'z': passage runs along z (opening width along x). */
  arch({ axis, cx, cz, w, depth, floorY = 0, spring = 2.6, rise = 1.2, topY = 8, margin = 0.7, color = 0xe6cfa0, protrude = 0.04, roof = false }) {
    const hw = w / 2 - 0.04, W = w / 2 + margin, N = 10;
    const sh = new THREE.Shape();
    sh.moveTo(-W, floorY); sh.lineTo(-hw, floorY); sh.lineTo(-hw, spring);
    for (let i = 1; i < N; i++) { const a = Math.PI - Math.PI * i / N; sh.lineTo(Math.cos(a) * hw, spring + Math.sin(a) * rise); }
    sh.lineTo(hw, spring); sh.lineTo(hw, floorY); sh.lineTo(W, floorY); sh.lineTo(W, topY); sh.lineTo(-W, topY); sh.closePath();
    const d = depth + protrude * 2;
    let geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -protrude);
    if (axis === 'z') geo.translate(cx, 0, cz - depth / 2); else { geo.rotateY(Math.PI / 2); geo.translate(cx - depth / 2, 0, cz); }
    geo.computeVertexNormals();
    const base = rgb(color);
    const VB = roof ? this.VBroof : this.VB;
    VB.geometry('wall', geo, (x, y, z, nx, ny, nz) => { const k = 0.72 + 0.28 * Math.min(1, Math.max(0, (y - floorY) / 2.6)); const up = ny < -0.5 ? 0.82 : 1; return mulc(base, k * up); });
    this.CB.geometry(geo, 0);
    geo.dispose();
  }
  /** flat slab (roof/deck underside visible). roof:true puts it in the toggleable roof builder. */
  slab({ x0, z0, x1, z1, y0, y1, color = 0xcfb184, mat = 'wall', roof = false, surf = 'stone', name = 'slab' }) {
    this.solid({ x0, x1, z0, z1, y0, y1, mat, color, surf, name, ao: 0.8, bottom: true, builder: roof ? this.VBroof : null });
  }
  decal(d) { this.decals.push(d); }
}
