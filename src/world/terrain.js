// Turns the heightfield grid into render geometry (AO-baked vertex colours, wall bands, stairs) and collision geometry.
import { NX, NZ, X0, Z0, idx } from './grid.js';
import { ZONES } from './layout.js';
import { rgb, mulc, mixc } from './builder.js';

const hash2 = (i, j) => { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, z) => {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi; const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
};
export { hash2, vnoise };

const palCache = {};
const pal = (name) => {
  if (palCache[name]) return palCache[name];
  const z = ZONES[name] || ZONES.mass;
  return (palCache[name] = { ...z, cC: rgb(z.c), pC: rgb(z.p), capC: rgb(z.cap), fC: rgb(z.f), trimC: z.trim ? rgb(z.trim) : null });
};

// DIRS: 0 +x, 1 -x, 2 +z, 3 -z. corner index: 0=x0z0 1=x1z0 2=x0z1 3=x1z1
const DIRS = [
  { di: 1, dj: 0, A: [1, 3], B: [0, 2], coord: 'x' },   // +x: P(z0),Q(z1)
  { di: -1, dj: 0, A: [0, 2], B: [1, 3], coord: 'x' },  // -x
  { di: 0, dj: 1, A: [2, 3], B: [0, 1], coord: 'z' },   // +z: P(x0),Q(x1)
  { di: 0, dj: -1, A: [0, 1], B: [2, 3], coord: 'z' },  // -z
];

/**
 * Builds terrain. Returns { walls: [...merged wall segments], floorCells } for decor placement.
 * VB: VisBuilder, CB: ColBuilder.
 */
export function meshTerrain(g, VB, CB) {
  const avgH = new Float32Array(NX * NZ);
  for (let k = 0; k < NX * NZ; k++) avgH[k] = (g.h[k * 4] + g.h[k * 4 + 1] + g.h[k * 4 + 2] + g.h[k * 4 + 3]) / 4;
  const cellH = (i, j) => (i < 0 || j < 0 || i >= NX || j >= NZ) ? 30 : avgH[idx(i, j)];

  // ------------------------------------------------------------------ AO at grid vertices (soft, radius ~2 m)
  const aoAt = (vi, vj, hv) => {
    let sw = 0, so = 0;
    for (let j = vj - 3; j <= vj + 2; j++) for (let i = vi - 3; i <= vi + 2; i++) {
      const dx = i + 0.5 - vi, dz = j + 0.5 - vj, w = Math.exp(-(dx * dx + dz * dz) / 1.6);
      const hc = cellH(i, j); const o = Math.max(0, Math.min(1, (hc - hv - 0.3) / 1.1));
      sw += w; so += w * o;
    }
    return 1 - 0.78 * (so / sw);
  };

  // ------------------------------------------------------------------ top faces
  const solidTopCells = [];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = idx(i, j), x0 = X0 + i, z0 = Z0 + j, x1 = x0 + 1, z1 = z0 + 1;
    const h00 = g.h[k * 4], h10 = g.h[k * 4 + 1], h01 = g.h[k * 4 + 2], h11 = g.h[k * 4 + 3];
    const flat = h00 === h10 && h00 === h01 && h00 === h11;
    if (g.open[k]) {
      const zn = g.zoneNames[g.zone[k]], P = pal(zn);
      const surf = g.surf[k];
      let mat = P.floor, base = P.fC;
      if (g.tint[k]) base = rgb(g.tint[k] & 0xffffff);
      if (surf === 1) mat = 'sand'; else if (surf === 2) mat = 'tile'; else if (surf === 3) mat = 'brick'; else if (surf === 4) { mat = 'floor'; base = mulc(rgb(0x6e8f86), 1); } else if (surf === 5) mat = 'deck';
      if (surf === 2 && !g.tint[k]) base = rgb(0xa9d3cd);
      const n = 1 + (hash2(i, j) - 0.5) * 0.07 + (vnoise(x0 * 0.17, z0 * 0.17) - 0.5) * 0.14;
      const cen = mulc(base, n);
      // stair cells are meshed separately as steps
      const hs = [h00, h10, h01, h11];
      const vc = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b], q) => mulc(cen, aoAt(i + a, j + b, hs[q])));
      if (g.stairs[k]) { meshStairs(g, VB, i, j, k, cen, P); }
      else VB.quad(mat, [x0, h01, z1], [x1, h11, z1], [x1, h10, z0], [x0, h00, z0], [vc[2], vc[3], vc[1], vc[0]]);
    } else { solidTopCells.push([i, j, k]); }
  }
  // solid tops: greedy merged, roof material (only visible from above / elevated positions)
  greedy(g, (i, j, k) => (!g.open[k] && g.h[k * 4] === g.h[k * 4 + 1] && g.h[k * 4] === g.h[k * 4 + 2] && g.h[k * 4] === g.h[k * 4 + 3]) ? `${g.h[k * 4]}|${(i >> 3)}|${(j >> 3)}` : null,
    (i0, j0, i1, j1, key) => {
      const h = parseFloat(key), hh = hash2(i0 >> 3, j0 >> 3);
      const col = mulc(mixc(rgb(0xc9835a), rgb(0xd9b48a), hh), 0.95 + 0.1 * hash2(j0 >> 3, i0 >> 3));
      const x0 = X0 + i0, x1 = X0 + i1, z0 = Z0 + j0, z1 = Z0 + j1;
      VB.quad('roof', [x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], col);
    });

  // ------------------------------------------------------------------ collision tops (greedy on flat cells; slopes per cell)
  greedy(g, (i, j, k) => (g.h[k * 4] === g.h[k * 4 + 1] && g.h[k * 4] === g.h[k * 4 + 2] && g.h[k * 4] === g.h[k * 4 + 3]) ? `${g.h[k * 4]}` : null,
    (i0, j0, i1, j1, key) => {
      const h = parseFloat(key), x0 = X0 + i0, x1 = X0 + i1, z0 = Z0 + j0, z1 = Z0 + j1;
      CB.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], 0);
    });
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = idx(i, j); const h00 = g.h[k * 4], h10 = g.h[k * 4 + 1], h01 = g.h[k * 4 + 2], h11 = g.h[k * 4 + 3];
    if (h00 === h10 && h00 === h01 && h00 === h11) continue;
    const x0 = X0 + i, z0 = Z0 + j, x1 = x0 + 1, z1 = z0 + 1;
    CB.quad([x0, h01, z1], [x1, h11, z1], [x1, h10, z0], [x0, h00, z0], 0);
  }

  // ------------------------------------------------------------------ side walls
  const segs = [];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = idx(i, j);
    for (let d = 0; d < 4; d++) {
      const D = DIRS[d]; const ni = i + D.di, nj = j + D.dj; const inb = ni >= 0 && nj >= 0 && ni < NX && nj < NZ;
      const kb = inb ? idx(ni, nj) : -1;
      const hA0 = g.h[k * 4 + D.A[0]], hA1 = g.h[k * 4 + D.A[1]];
      const hB0 = inb ? g.h[kb * 4 + D.B[0]] : -3, hB1 = inb ? g.h[kb * 4 + D.B[1]] : -3;
      const d0 = hA0 - hB0, d1 = hA1 - hB1;
      if (!((d0 > 0.02 && d1 > -0.02) || (d1 > 0.02 && d0 > -0.02))) continue;
      // wall owner style: the open cell nearest (lower one) or mass
      let zone = 'mass', openB = false;
      if (inb && g.open[kb]) { zone = g.zoneNames[g.zone[kb]]; openB = true; }
      else if (g.open[k]) zone = g.zoneNames[g.zone[k]];
      const along = D.coord === 'x' ? Z0 + j : X0 + i;             // P coordinate
      const line = D.coord === 'x' ? X0 + i + (d === 0 ? 1 : 0) : Z0 + j + (d === 2 ? 1 : 0);
      segs.push({ d, line, s0: along, s1: along + 1, hA0, hA1, hB0, hB1, zone, openB, stairA: g.stairs[k], stairB: inb ? g.stairs[kb] : 0, ci: i, cj: j });
    }
  }
  // merge runs (constant heights only)
  segs.sort((a, b) => a.d - b.d || a.line - b.line || a.s0 - b.s0);
  const merged = [];
  for (const s of segs) {
    const p = merged[merged.length - 1];
    if (p && p.d === s.d && p.line === s.line && p.s1 === s.s0 && p.hA0 === p.hA1 && s.hA0 === s.hA1 && p.hA0 === s.hA0 && p.hB0 === p.hB1 && s.hB0 === s.hB1 && p.hB0 === s.hB0 && p.zone === s.zone && p.openB === s.openB && p.stairA === s.stairA && p.stairB === s.stairB) p.s1 = s.s1;
    else merged.push({ ...s });
  }
  for (const s of merged) { emitWall(VB, CB, s); }
  return { walls: merged };
}

function corner(dir, line, s, y) { // world position along a wall
  return DIRS[dir].coord === 'x' ? [line, y, s] : [s, y, line];
}
function emitWall(VB, CB, s) {
  const { d, line, s0, s1 } = s;
  const lowP = Math.min(s.hA0, s.hB0), lowQ = Math.min(s.hA1, s.hB1), hiP = Math.max(s.hA0, s.hB0), hiQ = Math.max(s.hA1, s.hB1);
  const S0 = s0, S1 = s1;
  // point builders in the winding order required for outward normals (see DIRS notes)
  const order = (yP, yQ) => { const P = corner(d, line, S0, yP), Q = corner(d, line, S1, yQ); return [P, Q]; };
  const quadBetween = (mat, yPa, yQa, yPb, yQb, cA, cB) => { // a = lower edge, b = upper edge
    const [Pa, Qa] = order(yPa, yQa), [Pb, Qb] = order(yPb, yQb);
    let v;
    if (d === 0 || d === 3) v = [Qa, Pa, Pb, Qb]; else v = [Pa, Qa, Qb, Pb];
    // cols: [Qa,Pa,Pb,Qb] or [Pa,Qa,Qb,Pb]
    const cols = (d === 0 || d === 3) ? [cA, cA, cB, cB] : [cA, cA, cB, cB];
    VB.quad(mat, v[0], v[1], v[2], v[3], cols, { uvo: [0, 0, 0] });
  };
  // collision: one quad
  { const [Pa, Qa] = order(lowP, lowQ), [Pb, Qb] = order(hiP, hiQ); if (d === 0 || d === 3) CB.quad(Qa, Pa, Pb, Qb, 0); else CB.quad(Pa, Qa, Qb, Pb, 0); }
  // stairs meshed as steps hide this wall on the stair side
  if (s.stairA && !s.stairB) return;
  const P = pal(s.zone); const mass = pal('mass');
  const Hh = ((hiP - lowP) + (hiQ - lowQ)) / 2;
  const wallC = s.openB ? P.cC : mass.cC, plinC = s.openB ? P.pC : mass.pC, capC = s.openB ? P.capC : mass.capC;
  const bodyMat = s.openB ? P.wall : 'wall', plinMat = s.openB ? P.plinth : 'wall';
  // subtle per-run tint so long facades are not uniform
  const tint = 0.94 + 0.12 * hash2(Math.floor(s0 * 3 + line), Math.floor(line * 7 + s0));
  const off = (o) => [o, o];
  const pH = Math.min(1.25, Hh * 0.42), cH = Math.min(0.6, Hh * 0.18);
  const y = (base, o, hi) => Math.min(base + o, hi);
  // plinth (bottom): ao gradient
  const ao0 = 0.6, ao1 = 0.84;
  const p1 = Math.min(0.4, pH * 0.4);
  const plC = mulc(plinC, tint);
  quadBetween(plinMat, lowP, lowQ, lowP + p1, lowQ + p1, mulc(plC, ao0), mulc(plC, ao1));
  quadBetween(plinMat, lowP + p1, lowQ + p1, lowP + pH, lowQ + pH, mulc(plC, ao1), mulc(plC, 0.92));
  // body
  const b0 = pH, b1 = Hh - cH;
  const bC = mulc(wallC, tint);
  if (b1 > b0) {
    const gEnd = Math.min(b1, b0 + 2.6);
    quadBetween(bodyMat, lowP + b0, lowQ + b0, lowP + gEnd, lowQ + gEnd, mulc(bC, 0.88), mulc(bC, 1.0));
    if (b1 > gEnd) quadBetween(bodyMat, lowP + gEnd, lowQ + gEnd, lowP + b1, lowQ + b1, mulc(bC, 1.0), mulc(bC, 1.03));
  }
  // cap band
  quadBetween('wall', lowP + Hh - cH, lowQ + Hh - cH, hiP, hiQ, mulc(capC, 0.98), mulc(capC, 1.04));
  // painted accent stripe on tall walls of themed zones
  if (s.openB && Hh > 5 && P.trimC && s.hA0 === s.hA1 && s.hB0 === s.hB1) {
    const sy = 3.9; if (lowP + sy + 0.3 < hiP - 1) quadBetween('plain', lowP + sy, lowQ + sy, lowP + sy + 0.3, lowQ + sy + 0.3, mulc(P.trimC, 0.85), mulc(P.trimC, 0.9), { });
  }
}

function meshStairs(g, VB, i, j, k, cen, P) {
  const h = [g.h[k * 4], g.h[k * 4 + 1], g.h[k * 4 + 2], g.h[k * 4 + 3]];
  const x0 = X0 + i, z0 = Z0 + j, x1 = x0 + 1, z1 = z0 + 1;
  const alongX = h[0] !== h[1] || h[2] !== h[3];
  const lo = Math.min(...h), hi = Math.max(...h), base = g.stairBase[k];
  const rise = hi - lo; const n = Math.max(1, Math.round(rise / 0.26));
  const dirPos = alongX ? (h[1] > h[0]) : (h[2] > h[0]);      // height increases with coordinate
  for (let s = 0; s < n; s++) {
    const t0 = s / n, t1 = (s + 1) / n;
    const top = lo + rise * (dirPos ? t1 : 1 - t0);
    const a0 = dirPos ? t0 : t0, a1 = t1;                    // coordinate fraction range of this step
    let bx0 = x0, bx1 = x1, bz0 = z0, bz1 = z1;
    if (alongX) { bx0 = x0 + a0; bx1 = x0 + a1; } else { bz0 = z0 + a0; bz1 = z0 + a1; }
    const c = mulc(cen, 1.0);
    // each step is a column from base to tread. Sides get darker AO towards the floor.
    VB.box('floor', bx0, base, bz0, bx1, top, bz1, c, { bottom: false, ao: 0.7 });
  }
}

// -------------------------------------------------------------------------------------------------------------------
/** generic rectangle greedy meshing. keyFn(i,j,k) -> string|null; emit(i0,j0,i1,j1,key) with exclusive end */
function greedy(g, keyFn, emit) {
  const done = new Uint8Array(NX * NZ);
  const keys = new Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) keys[idx(i, j)] = keyFn(i, j, idx(i, j));
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const k = idx(i, j); const key = keys[k]; if (key === null || done[k]) continue;
    let w = 1; while (i + w < NX && keys[idx(i + w, j)] === key && !done[idx(i + w, j)]) w++;
    let hgt = 1;
    outer: while (j + hgt < NZ) { for (let x = 0; x < w; x++) { const kk = idx(i + x, j + hgt); if (keys[kk] !== key || done[kk]) break outer; } hgt++; }
    for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) done[idx(i + x, j + y)] = 1;
    emit(i, j, i + w, j + hgt, key);
  }
}
