// Per-region facade kits: stucco/brick panels with pilasters, awnings, shopfronts, balconies, windows, eaves, pipes, bunting.
import { rgb, mulc, mixc } from './builder.js';
import { hash2, } from './terrain.js';
import { ZONES } from './layout.js';

const H0 = (a, b, c = 0) => hash2(Math.floor(a * 13.7) + c * 977, Math.floor(b * 11.3) - c * 131);
const AWN = [0xc4573a, 0x2a9d9f, 0xd9a441, 0x6b8e4e, 0xe8dcc0, 0xb04a6a];
const SHOPS = ['CRUX CAFE', 'FLUX MARKET', 'ORANGE & CO', 'SALT BATH', 'HOTEL AZUR', 'SOLE MIO', 'BARBER', 'PASTA FRESCA', 'TIDE TEA', 'EMBER GRILL', 'LAMPS', 'BAKERY', 'GELATO', 'TILE WORKS', 'FRUIT', 'PHARMACY'];
const KIT = {
  es:       { pan: [0xe0a06a, 0xd98552, 0xf0cfa4, 0xc97a52], brick: 0.18, awn: [0xd98552, 0xe8dcc0], shop: 0.1, balc: 0.0, win: 0.5, mural: 0.1, bays: 4.4 },
  ts:       { pan: [0xece6d4, 0xf3eedd, 0xd3dfdc, 0xe0e6e4], band: 0x2a9d9f, brick: 0.0, awn: [0x2a9d9f, 0xe8dcc0], shop: 0.1, balc: 0.15, win: 0.55, mural: 0.1, bays: 4.4 },
  tidemid:  { pan: [0xece6d4, 0xd3dfdc, 0xe9dcc0], brick: 0.05, awn: [0x2a9d9f, 0xe8dcc0, 0xd9a441], shop: 0.3, balc: 0.25, win: 0.4, mural: 0.05, bays: 3.6 },
  winroom:  { pan: [0xece6d4, 0xd3dfdc, 0xe9dcc0], brick: 0.05, awn: [0x2a9d9f, 0xe8dcc0], shop: 0.0, balc: 0.25, win: 0.4, mural: 0.1, bays: 3.6 },
  eastroom: { pan: [0xece6d4, 0xd3dfdc, 0xe9dcc0], brick: 0.05, awn: [0x2a9d9f, 0xd9a441], shop: 0.0, balc: 0.25, win: 0.4, mural: 0.1, bays: 3.6 },
  outerlong:{ pan: [0xe9c98e, 0xf3dfae, 0xd6a46a, 0xe8d7b0], brick: 0.15, awn: AWN, shop: 0.5, balc: 0.15, win: 0.3, mural: 0.12, bays: 3.4 },
  long:     { pan: [0xe9c98e, 0xf3dfae, 0xd6a46a, 0xefe0b8, 0xc98a5a], band: 0xc4673d, brick: 0.2, awn: AWN, shop: 0.35, balc: 0.3, win: 0.3, mural: 0.14, bays: 3.8 },
  pit:      { pan: [0xe0bf86, 0xd6a46a], brick: 0.1, awn: AWN, shop: 0.0, balc: 0.0, win: 0.2, mural: 0.2, bays: 4 },
  longramp: { pan: [0xe9c98e, 0xf3dfae, 0xefe0b8], brick: 0.05, awn: AWN, shop: 0.1, balc: 0.25, win: 0.4, mural: 0.1, bays: 4 },
  a:        { pan: [0xf1dba6, 0xe6c58a, 0xf8ecc8, 0xe9d3a0, 0xd9a07a], arc: 0.45, band: 0x2a9d9f, brick: 0.12, awn: [0x2a9d9f, 0xe8dcc0, 0xd9a441], shop: 0.15, balc: 0.35, win: 0.4, mural: 0.12, bays: 4.2 },
  aplat:    { pan: [0xf4dfac, 0xf8ecc8], arc: 0.3, band: 0x2a9d9f, brick: 0, awn: [0x2a9d9f, 0xe8dcc0], shop: 0, balc: 0.2, win: 0.4, mural: 0.2, bays: 4 },
  aconn:    { pan: [0xe6c793, 0xf1dcae], brick: 0.1, awn: AWN, shop: 0, balc: 0.1, win: 0.5, mural: 0.2, bays: 3.4 },
  adoor:    { pan: [0xe6c793, 0xf1dcae], brick: 0.1, awn: AWN, shop: 0.1, balc: 0.1, win: 0.5, mural: 0.1, bays: 3.4 },
  midapp:   { pan: [0xdfba8a, 0xcf8a5a, 0xe8d0a0, 0xb9654a], brick: 0.3, awn: AWN, shop: 0.45, balc: 0.2, win: 0.3, mural: 0.1, bays: 3.4 },
  doors:    { pan: [0xd9b283, 0xc99a68], brick: 0.2, awn: AWN, shop: 0.0, balc: 0.0, win: 0.2, mural: 0.0, bays: 3 },
  hub:      { pan: [0xe2bc8c, 0xcf8a5a, 0xe8d0a0, 0xb9654a, 0xd9a56e], band: 0xc4673d, brick: 0.3, awn: AWN, shop: 0.35, balc: 0.4, win: 0.3, mural: 0.1, bays: 3.8 },
  short:    { pan: [0xd8b686, 0xcf8a5a, 0xe8d0a0], brick: 0.3, awn: AWN, shop: 0.25, balc: 0.2, win: 0.4, mural: 0.1, bays: 3.4 },
  palace:   { pan: [0xe4b98a, 0xefd6a8, 0xd49578, 0xe8d0a0], band: 0x2a9d9f, brick: 0.1, awn: [0x2a9d9f, 0xc4573a, 0xe8dcc0], shop: 0.3, balc: 0.5, win: 0.3, mural: 0.1, bays: 3.8 },
  bplaza:   { pan: [0xd49578, 0xc87a5a, 0xe0b090, 0xe6c2a0], arc: 0.2, band: 0x1f8a8f, brick: 0.25, awn: [0x1f8a8f, 0xe8dcc0, 0xd9a441], shop: 0.2, balc: 0.35, win: 0.3, mural: 0.2, bays: 4 },
  bbalc:    { pan: [0xd49578, 0xe0b090], brick: 0.2, awn: [0x1f8a8f, 0xe8dcc0], shop: 0.0, balc: 0.1, win: 0.4, mural: 0.2, bays: 4 },
  bconn:    { pan: [0xd6a184, 0xc87a5a], brick: 0.2, awn: [0x1f8a8f, 0xe8dcc0], shop: 0.0, balc: 0.1, win: 0.4, mural: 0.1, bays: 3.4 },
  bdoor:    { pan: [0xd6a184, 0xe0b090], brick: 0.2, awn: [0x1f8a8f], shop: 0.0, balc: 0.1, win: 0.4, mural: 0.1, bays: 3.4 },
  btunmouth:{ pan: [0xd6a184, 0xc87a5a, 0xe0b090], brick: 0.3, awn: [0x1f8a8f, 0xe8dcc0], shop: 0.1, balc: 0.15, win: 0.4, mural: 0.2, bays: 3.6 },
};
const TUN = new Set(['btun1', 'btun2', 'btun3', 'tunapp']);
const TK = {
  tunapp: { pm: 'plaster', pc: [0xe3b27a, 0xf0cfa4, 0xd9996a], wm: 'brick', wc: 0xc4673d, wh: 1.15, post: 0x7a4f30, lamp: 0xffb070, mur: [0xc4673d, 0xd9a441], name: 'TUNNEL APPROACH', ncol: 0xc4673d },
  btun1:  { pm: 'plaster', pc: [0xcfd8d0, 0xdde2d6, 0xc4d0cc], wm: 'tile', wc: 0x2a9d9f, wh: 1.7, post: 0x5b6d70, lamp: 0x9ae8ff, mur: [0x2a9d9f, 0x7fd6cf], name: 'LOWER TUNNEL', ncol: 0x2a9d9f },
  btun2:  { pm: 'brick', pc: [0xc9694a, 0xb85a3a, 0xd0794a], wm: 'wall', wc: 0x8f6a52, wh: 1.0, post: 0x3b3f46, lamp: 0xffa040, mur: [0xd9a441, 0xe8dcc0], name: 'THE BEND', ncol: 0xd9a441 },
  btun3:  { pm: 'plaster', pc: [0xf3ecd6, 0xe8e2cc, 0xefe6cc], wm: 'tile', wc: 0x3b6f8f, wh: 1.4, post: 0x7a4f30, lamp: 0xbfe0ff, mur: [0x3b6f8f, 0x7fa3b0], name: 'UPPER TUNNEL', ncol: 0x3b6f8f },
};
const CEIL = 4.35;
function tunnelWall(D, VB, s, h) {
  const k = TK[s.zone]; const { low, pos, box, panelQuad, nrm } = h; const len = s.s1 - s.s0;
  let t = s.s0 + 0.1, bi = 0;
  while (t < s.s1 - 1.4) {
    let bw = 4.2 * (0.8 + 0.4 * H0(t, s.line, 41 + bi)); if (t + bw > s.s1 - 0.1 || s.s1 - (t + bw) < 1.5) bw = s.s1 - 0.1 - t; if (bw < 1.6) break;
    const t0 = t, t1 = t + bw, tc = (t0 + t1) / 2, r = H0(tc, s.line, 43), r2 = H0(tc, s.line, 44); t = t1; bi++;
    const pc = mulc(rgb(k.pc[Math.floor(r2 * 97) % k.pc.length]), 0.74);
    panelQuad(t0 + 0.1, t1 - 0.1, low + k.wh, low + CEIL, k.pm, k.pm === 'brick' ? mulc(pc, 0.95 + 0.1 * r) : pc);
    panelQuad(t0 + 0.1, t1 - 0.1, low, low + k.wh, k.wm, mulc(rgb(k.wc), 0.74 * (0.92 + 0.12 * r2)), 0.03);
    box(t0 + 0.1, t1 - 0.1, low + k.wh, low + k.wh + 0.1, 0, 0.1, 'wall', rgb(0xe8d6ac), { ao: 1 });   // rail cap
    // posts
    box(t0 - 0.05, t0 + 0.3, low, low + CEIL, 0, 0.2, 'wood', rgb(k.post), { ao: 0.85, top: false });
    box(t1 - 0.3, t1 + 0.05, low, low + CEIL, 0, 0.2, 'wood', rgb(k.post), { ao: 0.85, top: false });
    if (bw >= 3) {
      if (r < 0.5) { D.decal({ type: 'wall', kind: 'niche', c: pos(tc, low + 1.9, 0), n: nrm, w: 1.0, h: 2.2, seed: 1 }); const lp = pos(tc, low + 2.55, 0); D.wallLamp(lp[0], lp[1], lp[2], s.d < 2 ? nrm[0] : 0, s.d < 2 ? 0 : nrm[1], k.lamp); }
      else if (r < 0.8) D.decal({ type: 'wall', kind: ['chevrons', 'triangles', 'stripes', 'sun'][Math.floor(r2 * 4)], c: pos(tc, low + 2.9, 0), n: nrm, w: Math.min(3.2, bw - 0.9), h: 1.9, color: k.mur[Math.floor(r2 * 9) % 2], seed: Math.floor(r2 * 977) });
      else { box(tc - 0.08, tc + 0.08, low, low + CEIL - 0.1, 0.0, 0.18, 'plain', rgb(0x5b5f66), { ao: 0.9, top: false }); box(tc - 0.14, tc + 0.14, low + 2.4, low + 2.5, 0, 0.26, 'plain', rgb(0x3b3f46), { ao: 1 }); const lp = pos(tc + 0.9, low + 2.4, 0); D.wallLamp(lp[0], lp[1], lp[2], s.d < 2 ? nrm[0] : 0, s.d < 2 ? 0 : nrm[1], k.lamp); }
    }
  }
  if (len >= 8) D.decal({ type: 'wall', kind: 'shopsign', c: pos(s.s0 + len * 0.5, low + 3.55, 0), n: nrm, w: 2.6, h: 0.56, text: k.name, color: k.ncol, seed: 0 });
}

function buildRuns(walls) {
  const out = []; const sl = walls.filter((w) => w.openB && !w.stairA && w.hA0 === w.hA1 && w.hB0 !== w.hB1).sort((a, b) => a.d - b.d || a.line - b.line || a.s0 - b.s0);
  for (const w of sl) {
    const p = out[out.length - 1];
    const slope = (w.hB1 - w.hB0) / (w.s1 - w.s0);
    if (p && p.sloped && p.d === w.d && p.line === w.line && p.s1 === w.s0 && p.zone === w.zone && p.hA0 === w.hA0 && Math.abs(p.slope - slope) < 1e-6 && Math.abs(p.hB1 - w.hB0) < 1e-6) { p.s1 = w.s1; p.hB1 = w.hB1; }
    else out.push({ ...w, sloped: true, slope });
  }
  return out;
}

export function dressFacades(D, walls) {
  const VB = D.VB; let nBal = 0, nAwn = 0, nShop = 0;
  const pilC = (c) => mulc(c, 1.07);
  const all = walls.filter((w) => w.openB && !w.stairA && w.hA0 === w.hA1 && w.hB0 === w.hB1).concat(buildRuns(walls));
  for (const s of all) {
    const lowS = s.hB0, lowE = s.hB1, high = s.hA0, lowMin = Math.min(lowS, lowE), Hh = high - lowMin, len = s.s1 - s.s0; if (Hh < 4.2 || len < 2.2) continue;
    const lowAt = (t) => lowS + (lowE - lowS) * (t - s.s0) / (s.s1 - s.s0); const steep = Math.abs((lowE - lowS) / (s.s1 - s.s0)) > 0.1; let low = lowMin;
    const zone = s.zone; const nrm = [[1, 0], [-1, 0], [0, 1], [0, -1]][s.d]; const nx = nrm[0], nz = nrm[1];
    const pos = (t, y, off) => (s.d < 2 ? [s.line + nx * off, y, t] : [t, y, s.line + nz * off]);
    const box = (t0, t1, y0, y1, off0, off1, mat, col, o = {}) => { // box along the wall between offsets (outward)
      const a = s.d < 2 ? [Math.min(s.line + nx * off0, s.line + nx * off1), t0, Math.max(s.line + nx * off0, s.line + nx * off1), t1] : [t0, Math.min(s.line + nz * off0, s.line + nz * off1), t1, Math.max(s.line + nz * off0, s.line + nz * off1)];
      if (s.d < 2) VB.box(mat, a[0], y0, a[1], a[2], y1, a[3], col, o); else VB.box(mat, a[0], y0, a[1], a[2], y1, a[3], col, o);
    };
    const panelQuad = (t0, t1, y0, y1, mat, col, off = 0.03) => {
      const A = pos(t0, lowAt(t0) + (y0 - low), off), B = pos(t1, lowAt(t1) + (y0 - low), off), C = pos(t1, y1, off), Dd = pos(t0, y1, off);
      const lo = mulc(col, 0.86), hi = mulc(col, 1.02);
      if (s.d === 0 || s.d === 3) VB.quad(mat, B, A, Dd, C, [lo, lo, hi, hi], { uvo: [0, 0, 0] }); else VB.quad(mat, A, B, C, Dd, [lo, lo, hi, hi], { uvo: [0, 0, 0] });
    };
    const tun = TUN.has(zone);
    if (tun) { tunnelWall(D, VB, s, { low, pos, box, panelQuad, nrm }); continue; }
    const kit = KIT[zone]; if (!kit) continue;
    const high2 = high - 0.7, pH = Math.min(1.25, Hh * 0.42);
    if (s.sloped) { /* tilt-aware kit below */ }
    let t = s.s0 + 0.15, bi = 0;
    while (t < s.s1 - 1.8) {
      let bw = kit.bays * (0.75 + 0.5 * H0(t, s.line, 7 + bi)); if (t + bw > s.s1 - 0.15 || s.s1 - (t + bw) < 1.6) bw = s.s1 - 0.15 - t; if (bw < 1.8) break;
      const t0 = t, t1 = t + bw, tc = (t0 + t1) / 2; const r = H0(tc, s.line, 11), r2 = H0(tc, s.line, 12), r3 = H0(tc, s.line, 13);
      t = t1; bi++;
      low = lowAt(tc); const Hb = high - low;
      const cnt = H0(tc + 3, s.line, 17);
      // panel (material swap)
      if (r < 0.78) {
        const useBrick = r2 < kit.brick; const col = rgb(kit.pan[Math.floor(r3 * 997) % kit.pan.length]);
        panelQuad(t0 + 0.12, t1 - 0.12, low + pH, high2, useBrick ? 'brick' : 'plaster', useBrick ? mulc(rgb(0xc4704d), 0.95 + 0.1 * r3) : col);
        box(t0 - 0.0, t0 + 0.32, low + pH, high - 0.62, 0.0, 0.14, 'wall', pilC(rgb(kit.pan[0])), { ao: 0.85, top: false });
        box(t1 - 0.32, t1, low + pH, high - 0.62, 0.0, 0.14, 'wall', pilC(rgb(kit.pan[0])), { ao: 0.85, top: false });
        // string course
        box(t0, t1, low + pH, low + pH + 0.12, 0, 0.1, 'wall', rgb(0xe8d6ac), { ao: 1 });
      }
      const W = bw;
      const up = Hb >= 7.2;
      const wy = low + (Hb >= 8 ? 5.1 : 3.4);
      const feat = r3;
      if (kit.band && Hb >= 6) box(t0, t1, high - 2.5, high - 2.1, 0, 0.1, 'plain', rgb(kit.band), { ao: 1 });
      if (kit.arc && r2 < kit.arc && bw >= 3.4 && !steep) { // arcade of arches with engaged columns at the base
        D.decal({ type: 'wall', kind: 'arcade', c: pos(tc, low + 1.95, 0), n: nrm, w: bw - 0.7, h: 3.7, seed: Math.floor(r * 5) });
        for (let q = 0; q <= 2; q++) { const tt = t0 + 0.35 + (bw - 0.7) * q / 2; box(tt - 0.17, tt + 0.17, low, low + 3.1, 0, 0.24, 'wall', rgb(0xf0e2bc), { ao: 0.85, top: false }); box(tt - 0.24, tt + 0.24, low, low + 0.3, 0, 0.3, 'wall', rgb(0xe3cf9f), { ao: 0.9 }); box(tt - 0.24, tt + 0.24, low + 3.0, low + 3.2, 0, 0.3, 'wall', rgb(0xf6ecc8), { ao: 1 }); }
        if (up) D.decal({ type: 'wall', kind: 'window', c: pos(tc, wy + 2.4, 0), n: nrm, w: 1.2, h: 1.9, seed: Math.floor(r2 * 997) });
      } else if (feat < kit.shop && bw >= 2.6 && !steep) { // shopfront: door + awning + sign
        nShop++; const aw = kit.awn[Math.floor(r * 331) % kit.awn.length];
        D.decal({ type: 'wall', kind: 'door', c: pos(tc - (bw > 3.4 ? 0.8 : 0), low + 1.3, 0), n: nrm, w: 1.5, h: 2.6, seed: Math.floor(r2 * 6) });
        if (bw > 3.4) D.decal({ type: 'wall', kind: 'shopwin', c: pos(tc + 1.0, low + 1.5, 0), n: nrm, w: 1.3, h: 1.7, seed: Math.floor(r * 5) });
        awning(D, VB, s, t0 + 0.35, t1 - 0.35, low + 2.75, 1.15, aw, pos, nrm); nAwn++;
        D.decal({ type: 'wall', kind: 'shopsign', c: pos(tc, low + 3.45, 0), n: nrm, w: Math.min(3.0, bw - 0.6), h: 0.62, text: SHOPS[Math.floor(r2 * 997) % SHOPS.length], color: aw === 0xe8dcc0 ? 0x3a5560 : aw, seed: 0 });
        if (up) D.decal({ type: 'wall', kind: r < 0.5 ? 'window' : 'shutter', c: pos(tc, wy + 1.9, 0), n: nrm, w: 1.2, h: 1.9, seed: Math.floor(r * 1000) });
      } else if (feat < kit.shop + kit.balc && up && bw >= 3.0 && !steep) { // balcony + door
        nBal++; const by = low + 3.7, bwid = Math.min(2.4, bw - 1.0);
        box(tc - bwid / 2, tc + bwid / 2, by - 0.2, by, 0, 1.0, 'wall', rgb(0xe3cf9f), { ao: 0.8 });
        for (const dd of [-1, 1]) box(tc + dd * (bwid / 2 - 0.2) - 0.1, tc + dd * (bwid / 2 - 0.2) + 0.1, by - 0.62, by - 0.2, 0, 0.5, 'wall', rgb(0xd8c18e), { ao: 0.8, top: false });
        // railing
        box(tc - bwid / 2, tc + bwid / 2, by + 0.88, by + 0.94, 0.9, 0.96, 'plain', rgb(0x55606a), { ao: 1 });
        for (let k = 0; k <= 6; k++) { const tt = tc - bwid / 2 + 0.04 + k * (bwid - 0.08) / 6; box(tt - 0.02, tt + 0.02, by, by + 0.9, 0.92, 0.96, 'plain', rgb(0x55606a), { ao: 1, top: false }); }
        for (const sd of [0, 1]) { const ta = sd ? tc + bwid / 2 - 0.05 : tc - bwid / 2, tb = ta + 0.05; box(ta, tb, by + 0.86, by + 0.92, 0.0, 0.96, 'plain', rgb(0x55606a), { ao: 1 }); box(ta, tb, by + 0.42, by + 0.46, 0.0, 0.96, 'plain', rgb(0x55606a), { ao: 1 }); box(ta, tb, by, by + 0.92, 0.9, 0.96, 'plain', rgb(0x55606a), { ao: 1, top: false }); }
        box(tc - bwid / 2, tc + bwid / 2, by + 0.42, by + 0.46, 0.92, 0.96, 'plain', rgb(0x55606a), { ao: 1 });
        D.decal({ type: 'wall', kind: 'bdoor', c: pos(tc, by + 1.2, 0), n: nrm, w: 1.3, h: 2.3, seed: Math.floor(r2 * 6) });
        if (r2 > 0.4) { const bx0 = tc - bwid / 2 + 0.2; for (let k = 0; k < 2; k++) D.bush(...(s.d < 2 ? [s.line + nx * 0.75, by + 0.95, bx0 + k * (bwid - 0.5) + 0.0] : [bx0 + k * (bwid - 0.5), by + 0.95, s.line + nz * 0.75]), 0.3, rgb(k ? 0x5fa04a : 0x86bb5c)); }
        D.decal({ type: 'wall', kind: 'window', c: pos(tc - bw / 2 + 0.9, low + 1.9, 0), n: nrm, w: 1.1, h: 1.7, seed: Math.floor(r * 1000) + 1 });
      } else if (feat < kit.shop + kit.balc + kit.win) { // windows
        const n2 = bw > 4.2 ? 2 : 1; for (let k = 0; k < n2; k++) { const tt = n2 === 1 ? tc : t0 + bw * (0.3 + 0.4 * k); D.decal({ type: 'wall', kind: (r2 + k * 0.37) % 1 < 0.45 ? 'window' : (r2 + k * 0.37) % 1 < 0.8 ? 'shutter' : 'grille', c: pos(tt, wy + 0.4 + (k ? 0.0 : 0), 0), n: nrm, w: 1.2, h: 1.9, seed: Math.floor((r + k * 0.3) * 997) });
          if (up) D.decal({ type: 'wall', kind: 'window', c: pos(tt, wy + 3.3, 0), n: nrm, w: 1.2, h: 1.9, seed: Math.floor((r2 + k * 0.2) * 997) });
          if (r3 > 0.1 && H0(tt, s.line, 21) < 0.45) { const sy = wy - 0.6, sx = pos(tt, 0, 0.18); box(tt - 0.7, tt + 0.7, sy, sy + 0.45, 0.0, 0.34, 'wood', rgb(0x7a4f30), { ao: 0.85 }); D.bush(sx[0], sy + 0.45, sx[2], 0.28, rgb(0x6db356)); } }
        if (r2 > 0.5) awning(D, VB, s, t0 + 0.6, t1 - 0.6, wy - 0.15, 0.9, kit.awn[Math.floor(r * 77) % kit.awn.length], pos, nrm);
      } else if (feat < kit.shop + kit.balc + kit.win + kit.mural) { // mural
        D.decal({ type: 'wall', kind: ['chevrons', 'triangles', 'stripes', 'sun'][Math.floor(r2 * 4)], c: pos(tc, low + 3.4, 0), n: nrm, w: Math.min(4.8, bw - 0.6), h: 2.6, color: [0xc4673d, 0x2a9d9f, 0xd9a441][Math.floor(r * 3) % 3], seed: Math.floor(r2 * 997) });
      } else { // plain bay: vent + pipe
        D.decal({ type: 'wall', kind: 'vent', c: pos(tc, low + 2.2, 0), n: nrm, w: 0.8, h: 0.6, seed: 1 });
        if (r2 < 0.5) box(t1 - 0.5, t1 - 0.34, low, high - 0.6, 0, 0.16, 'plain', rgb(0x5b5f66), { ao: 0.9, top: false });
      }
    }
    // roof edge: terracotta tile eave on tall runs
    if (Hh >= 5.2) {
      const eaveTile = H0(s.s0, s.line, 31) < 0.6;
      if (eaveTile) {
        const A = pos(s.s0, high - 0.3, 0.0), B = pos(s.s1, high - 0.3, 0.0), C = pos(s.s1, high + 0.0, 1.3), Dd = pos(s.s0, high + 0.0, 1.3);
        const col = rgb([0xc4673d, 0xb85a3a, 0xd0794a][Math.floor(H0(s.s0, s.line, 32) * 3)]);
        // underside + top slope strip; drop towards outside
        const A2 = pos(s.s0, high - 0.1, 1.3), B2 = pos(s.s1, high - 0.1, 1.3);
        if (s.d === 0 || s.d === 3) VB.quad('roof', B, A, A2, B2, [mulc(col, 0.85), mulc(col, 0.85), col, col]); else VB.quad('roof', A, B, B2, A2, [mulc(col, 0.85), mulc(col, 0.85), col, col]);
        const U0 = pos(s.s0, high - 0.1, 1.3), U1 = pos(s.s1, high - 0.1, 1.3), U2 = pos(s.s1, high - 0.3, 0.0), U3 = pos(s.s0, high - 0.3, 0.0);
        if (s.d === 0 || s.d === 3) VB.quad('wall', U1, U0, U3, U2, mulc(rgb(0xb59470), 0.7)); else VB.quad('wall', U0, U1, U2, U3, mulc(rgb(0xb59470), 0.7));
        box(s.s0, s.s1, high - 0.3, high - 0.1, 1.26, 1.34, 'wall', rgb(0xefe0b8), { ao: 1 });
      }
    }
  }
  return { nBal, nAwn, nShop };
}

function awning(D, VB, s, t0, t1, y, proj, color, pos, nrm) {
  const [nx, nz] = nrm; const c = rgb(color);
  const A = pos(t0, y + 0.45, 0.02), B = pos(t1, y + 0.45, 0.02), C = pos(t1, y, proj), Dd = pos(t0, y, proj);
  const tint = (k) => mulc(rgb(0xffffff), k);
  if (s.d === 0 || s.d === 3) { VB.quad('cloth', B, A, Dd, C, tint(1), { uv: [[(t1 - t0) / 2, 0], [0, 0], [0, 1], [(t1 - t0) / 2, 1]] }); } else { VB.quad('cloth', A, B, C, Dd, tint(1), { uv: [[0, 0], [(t1 - t0) / 2, 0], [(t1 - t0) / 2, 1], [0, 1]] }); }
  { const u = (P) => [P[0], P[1] - 0.025, P[2]]; const uc = mulc(mixc(c, rgb(0xe8dcc0), 0.5), 0.74);
    if (s.d === 0 || s.d === 3) VB.quad('emissive', u(A), u(B), u(C), u(Dd), uc); else VB.quad('emissive', u(B), u(A), u(Dd), u(C), uc); }
  // valance + side triangles + support posts
  const V0 = pos(t0, y, proj), V1 = pos(t1, y, proj), V2 = pos(t1, y - 0.22, proj), V3 = pos(t0, y - 0.22, proj);
  if (s.d === 0 || s.d === 3) VB.quad('plain', V1, V0, V3, V2, mulc(c, 0.9)); else VB.quad('plain', V0, V1, V2, V3, mulc(c, 0.9));
  const wallA = pos(t0, y + 0.45, 0.02), wallB = pos(t0, y, 0.02);
  for (const [tt, sg] of [[t0, 1], [t1, -1]]) { const p0 = pos(tt, y + 0.45, 0.02), p1 = pos(tt, y, proj), p2 = pos(tt, y, 0.02); if ((s.d === 0 || s.d === 3) === (sg > 0)) VB.tri('plain', p0, p2, p1, mulc(c, 0.7)); else VB.tri('plain', p0, p1, p2, mulc(c, 0.7)); }
  void wallA; void wallB;
}

/** bunting strings across narrow lanes: from (x0,y,z0) to (x1,y,z1) */
export function bunting(D, a, b, y, sag = 0.7, seed = 0) {
  const VB = D.VB, n = Math.max(6, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.8)), cord = rgb(0x30343a);
  const P = (t) => [a[0] + (b[0] - a[0]) * t, y - Math.sin(t * Math.PI) * sag, a[1] + (b[1] - a[1]) * t];
  const cols = [0xc4573a, 0xf1e6c8, 0x2a9d9f, 0xd9a441, 0xe8883e];
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), px = -dz / L, pz = dx / L;
  for (let i = 0; i < n; i++) {
    const p0 = P(i / n), p1 = P((i + 1) / n);
    VB.box('plain', Math.min(p0[0], p1[0]) - 0.012, Math.min(p0[1], p1[1]) - 0.012, Math.min(p0[2], p1[2]) - 0.012, Math.max(p0[0], p1[0]) + 0.012, Math.max(p0[1], p1[1]) + 0.012, Math.max(p0[2], p1[2]) + 0.012, cord, { ao: 1 });
    const m = P((i + 0.5) / n), c = rgb(cols[(i + seed) % cols.length]);
    VB.tri('plain', [p0[0], p0[1], p0[2]], [p1[0], p1[1], p1[2]], [m[0], m[1] - 0.42, m[2]], c); VB.tri('plain', [p1[0], p1[1], p1[2]], [p0[0], p0[1], p0[2]], [m[0], m[1] - 0.42, m[2]], mulc(c, 0.75));
  }
}
