// Rooftop detail for building masses & skyline: hip roofs with eaves, flat roofs with parapets + rooftop clutter, towers.
import { rgb, mulc, mixc } from './builder.js';

const hs = (a, b) => { let h = (Math.floor(a * 7) * 374761393 + Math.floor(b * 7) * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const TILE = [0xc4673d, 0xb85a3a, 0xd0794a, 0xc9714a, 0xa94e35], TEAL = 0x2a9d9f;

/** hip/gable roof over a rectangle. h = wall-top height. */
export function hipRoof(VB, x0, z0, x1, z1, h, col, o = {}) {
  const e = o.eave ?? 0.4, xa = x0 - e, xb = x1 + e, za = z0 - e, zb = z1 + e;
  const w = xb - xa, d = zb - za; const alongX = w >= d; const short = Math.min(w, d);
  const rh = o.rise ?? Math.max(0.5, Math.min(2.4, short * 0.24));
  const y = h + 0.02, c = col, cl = mulc(c, 0.82), ch = mulc(c, 1.08), gable = o.gable;
  const q = (a, b, cc, dd, k) => VB.quad('roof', a, b, cc, dd, k);
  if (alongX) {
    const zc = (za + zb) / 2, r = gable ? 0 : d / 2 * 0.98; const R0 = [xa + r, y + rh, zc], R1 = [xb - r, y + rh, zc];
    q([xb, y, za], [xa, y, za], R0, R1, [cl, cl, ch, ch]); q([xa, y, zb], [xb, y, zb], R1, R0, [cl, cl, ch, ch]);
    if (!gable) { VB.tri('roof', [xa, y, za], [xa, y, zb], R0, cl); VB.tri('roof', [xb, y, zb], [xb, y, za], R1, cl); }
    else { VB.tri('wall', [xa, y, zb], [xa, y, za], [xa, y + rh, zc], rgb(0xe8d8b0)); VB.tri('wall', [xb, y, za], [xb, y, zb], [xb, y + rh, zc], rgb(0xe8d8b0)); }
    VB.box('wall', xa - 0.02, h - 0.2, za - 0.02, xb + 0.02, h + 0.04, za + 0.12, rgb(0xefe0b8), { ao: 0.9, top: false }); VB.box('wall', xa - 0.02, h - 0.2, zb - 0.12, xb + 0.02, h + 0.04, zb + 0.02, rgb(0xefe0b8), { ao: 0.9, top: false });
  } else {
    const xc = (xa + xb) / 2, r = gable ? 0 : w / 2 * 0.98; const R0 = [xc, y + rh, za + r], R1 = [xc, y + rh, zb - r];
    q([xa, y, zb], [xa, y, za], R0, R1, [cl, cl, ch, ch]); q([xb, y, za], [xb, y, zb], R1, R0, [cl, cl, ch, ch]);
    if (!gable) { VB.tri('roof', [xb, y, za], [xa, y, za], R0, cl); VB.tri('roof', [xa, y, zb], [xb, y, zb], R1, cl); }
    else { VB.tri('wall', [xa, y, za], [xb, y, za], [xc, y + rh, za], rgb(0xe8d8b0)); VB.tri('wall', [xb, y, zb], [xa, y, zb], [xc, y + rh, zb], rgb(0xe8d8b0)); }
    VB.box('wall', xa - 0.02, h - 0.2, za - 0.02, xa + 0.12, h + 0.04, zb + 0.02, rgb(0xefe0b8), { ao: 0.9, top: false }); VB.box('wall', xb - 0.12, h - 0.2, za - 0.02, xb + 0.02, h + 0.04, zb + 0.02, rgb(0xefe0b8), { ao: 0.9, top: false });
  }
  return rh;
}

/** flat roof with parapet and clutter */
export function flatRoof(VB, x0, z0, x1, z1, h, k, o = {}) {
  const cap = rgb(0xead8ae), p = 0.55;
  VB.box('wall', x0, h, z0, x1, h + p, z0 + 0.25, cap, { ao: 0.9 }); VB.box('wall', x0, h, z1 - 0.25, x1, h + p, z1, cap, { ao: 0.9 });
  VB.box('wall', x0, h, z0 + 0.25, x0 + 0.25, h + p, z1 - 0.25, cap, { ao: 0.9 }); VB.box('wall', x1 - 0.25, h, z0 + 0.25, x1, h + p, z1 - 0.25, cap, { ao: 0.9 });
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
  if (w < 3 || d < 3) return;
  const r = hs(cx, cz);
  if (r < 0.34) { // water tank on legs
    const rr = Math.min(0.9, Math.min(w, d) * 0.22), n = 8;
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) VB.box('plain', cx + lx * rr * 0.6 - 0.07, h, cz + lz * rr * 0.6 - 0.07, cx + lx * rr * 0.6 + 0.07, h + 1.1, cz + lz * rr * 0.6 + 0.07, rgb(0x59616b), { ao: 0.9, top: false });
    for (let i = 0; i < n; i++) { const a0 = i / n * 6.283, a1 = (i + 1) / n * 6.283; const p0 = (a, y) => [cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr]; VB.quad('wood', p0(a1, h + 1.1), p0(a0, h + 1.1), p0(a0, h + 2.2), p0(a1, h + 2.2), [mulc(rgb(0x9a6a40), 0.7), mulc(rgb(0x9a6a40), 0.7), rgb(0x9a6a40), rgb(0x9a6a40)]); VB.tri('plain', [cx, h + 2.6, cz], p0(a1, h + 2.2), p0(a0, h + 2.2), rgb(0x6f737a)); }
  } else if (r < 0.62) { // stair hut + chimney
    VB.box('plaster', cx - 1.1, h, cz - 0.9, cx + 1.1, h + 1.9, cz + 0.9, mixc(rgb(0xe8d3a6), rgb(0xd9a98a), hs(cx, 3)), { ao: 0.85 });
    VB.box('roof', cx - 1.3, h + 1.9, cz - 1.1, cx + 1.3, h + 2.1, cz + 1.1, rgb(0xc4673d), { ao: 1 });
    VB.box('wall', cx + w * 0.25 - 0.25, h, cz - d * 0.25 - 0.25, cx + w * 0.25 + 0.25, h + 2.4, cz - d * 0.25 + 0.25, rgb(0xb98c6a), { ao: 0.8 });
  } else if (r < 0.8) { // AC units + antenna
    for (let i = 0; i < 3; i++) VB.box('metal', cx - 1.4 + i * 1.0, h, cz - 0.3, cx - 0.7 + i * 1.0, h + 0.7, cz + 0.3, rgb(0xcfd4d6), { ao: 0.8 });
    VB.box('plain', cx + 1.6, h, cz + 0.8, cx + 1.7, h + 3.4, cz + 0.9, rgb(0x3b3f46), { ao: 1 }); VB.box('plain', cx + 1.2, h + 2.6, cz + 0.84, cx + 2.1, h + 2.66, cz + 0.86, rgb(0x3b3f46), { ao: 1 });
  } else { // awning terrace with laundry
    VB.box('wood', x0 + 0.5, h, z0 + 0.5, x0 + 0.62, h + 2.0, z0 + 0.62, rgb(0x7a4f30), { ao: 1 }); VB.box('wood', x1 - 0.62, h, z0 + 0.5, x1 - 0.5, h + 2.0, z0 + 0.62, rgb(0x7a4f30), { ao: 1 });
    VB.quad('cloth', [x0 + 0.3, h + 1.7, z0 + 1.6], [x1 - 0.3, h + 1.7, z0 + 1.6], [x1 - 0.3, h + 2.1, z0 + 0.3], [x0 + 0.3, h + 2.1, z0 + 0.3], [1, 1, 1]);
  }
}

export function roofForRect(VB, x0, z0, x1, z1, h) {
  const w = x1 - x0, d = z1 - z0, k = hs(x0, z0);
  if (Math.min(w, d) < 1.6) { // thin wall strip: low gabled cap
    hipRoof(VB, x0, z0, x1, z1, h, mixc(rgb(TILE[Math.floor(k * 5) % 5]), rgb(0xd9a070), 0.3), { eave: 0.15, rise: 0.35, gable: true }); return;
  }
  if (k < 0.62) { const teal = k < 0.07; hipRoof(VB, x0, z0, x1, z1, h, rgb(teal ? TEAL : TILE[Math.floor(k * 100) % 5])); }
  else flatRoof(VB, x0, z0, x1, z1, h, k);
}

/** tall landmark tower. style: 'bell' | 'dome' | 'minaret' */
export function tower(VB, D, cx, cz, y0, hgt, style = 'bell', col = 0xe9d6a8, accent = TEAL) {
  const c = rgb(col), W = 3.2;
  const shaftH = hgt * 0.74;
  VB.box('wall', cx - W / 2 - 0.4, y0, cz - W / 2 - 0.4, cx + W / 2 + 0.4, y0 + 1.6, cz + W / 2 + 0.4, mulc(c, 0.92), { ao: 0.8 });
  VB.box('wall', cx - W / 2, y0 + 1.6, cz - W / 2, cx + W / 2, y0 + shaftH, cz + W / 2, c, { ao: 0.8 });
  for (const yy of [0.35, 0.65]) VB.box('wall', cx - W / 2 - 0.15, y0 + shaftH * yy, cz - W / 2 - 0.15, cx + W / 2 + 0.15, y0 + shaftH * yy + 0.28, cz + W / 2 + 0.15, mulc(c, 1.06), { ao: 0.9 });
  VB.box('emissive', cx - W / 2 - 0.16, y0 + shaftH * 0.5, cz - W / 2 - 0.16, cx + W / 2 + 0.16, y0 + shaftH * 0.5 + 0.1, cz + W / 2 + 0.16, mulc(rgb(accent), 2.0), { ao: 1, top: false });
  // belfry
  const by = y0 + shaftH, bw = W + 0.6;
  VB.box('wall', cx - bw / 2, by, cz - bw / 2, cx + bw / 2, by + 0.35, cz + bw / 2, mulc(c, 1.05), { ao: 0.9 });
  for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) VB.box('wall', cx + px * (W / 2 - 0.1) - 0.25, by + 0.35, cz + pz * (W / 2 - 0.1) - 0.25, cx + px * (W / 2 - 0.1) + 0.25, by + 2.6, cz + pz * (W / 2 - 0.1) + 0.25, c, { ao: 0.85 });
  VB.box('plain', cx - 0.5, by + 0.5, cz - 0.5, cx + 0.5, by + 1.4, cz + 0.5, rgb(0xb98c3a), { ao: 0.9 });
  VB.box('wall', cx - bw / 2, by + 2.6, cz - bw / 2, cx + bw / 2, by + 2.9, cz + bw / 2, mulc(c, 1.05), { ao: 1 });
  // roof
  const ry = by + 2.9, rr = bw / 2 + 0.3;
  if (style === 'dome') {
    const n = 10; for (let k = 0; k < 4; k++) { const a = Math.PI / 2 * k / 4, b = Math.PI / 2 * (k + 1) / 4; const r0 = rr * Math.cos(a), r1 = rr * Math.cos(b), y_0 = ry + rr * 0.9 * Math.sin(a), y_1 = ry + rr * 0.9 * Math.sin(b);
      for (let i = 0; i < n; i++) { const t0 = i / n * 6.283, t1 = (i + 1) / n * 6.283; const P = (r, y, t) => [cx + Math.cos(t) * r, y, cz + Math.sin(t) * r]; const col2 = mulc(rgb(accent), 0.8 + 0.25 * Math.sin(a) + (i % 2 ? 0.05 : 0));
        if (k === 3) VB.tri('roof', P(r0, y_0, t1), P(r0, y_0, t0), [cx, y_1, cz], col2); else VB.quad('roof', P(r0, y_0, t1), P(r0, y_0, t0), P(r1, y_1, t0), P(r1, y_1, t1), col2); } }
    VB.box('plain', cx - 0.06, ry + rr * 0.9, cz - 0.06, cx + 0.06, ry + rr * 0.9 + 1.4, cz + 0.06, rgb(0xb98c3a), { ao: 1 });
  } else {
    const rh = style === 'minaret' ? rr * 3.2 : rr * 1.5;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(a + Math.PI / 2), sb = Math.sin(a + Math.PI / 2);
      VB.tri('roof', [cx + ca * rr * 1.2 + cb * 0, ry, cz + sa * rr * 1.2], [cx + cb * rr * 1.2, ry, cz + sb * rr * 1.2], [cx, ry + rh, cz], mulc(rgb(i % 2 ? 0xb85a3a : 0xc4673d), 1.0 + 0.1 * (i % 2))); }
    VB.box('plain', cx - 0.06, ry + rh, cz - 0.06, cx + 0.06, ry + rh + 1.4, cz + 0.06, rgb(0xb98c3a), { ao: 1 });
  }
  // flag
  const fy = ry + (style === 'dome' ? rr * 0.9 : style === 'minaret' ? rr * 3.2 : rr * 1.5) + 0.9;
  VB.quad('plain', [cx, fy, cz], [cx + 1.0, fy - 0.1, cz], [cx + 1.0, fy + 0.5, cz], [cx, fy + 0.6, cz], rgb(accent));
  // decals: arched windows + clock on 4 faces
  if (D) for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const c3 = [cx + nx * W / 2, 0, cz + nz * W / 2];
    D.decal({ type: 'wall', kind: 'clock', c: [c3[0], y0 + shaftH * 0.8, c3[2]], n: [nx, nz], w: 2.0, h: 2.0, seed: 1 });
    D.decal({ type: 'wall', kind: 'window', c: [c3[0], y0 + shaftH * 0.36, c3[2]], n: [nx, nz], w: 1.4, h: 2.3, seed: 2 });
    D.decal({ type: 'wall', kind: 'window', c: [c3[0], y0 + shaftH * 0.62, c3[2]], n: [nx, nz], w: 1.4, h: 2.3, seed: 4 });
  }
}
