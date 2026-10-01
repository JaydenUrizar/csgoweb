// Capsule-vs-triangle-soup collision toolkit for the movement piece (owner: move).
// Pure math + three-mesh-bvh gather; no DOM, runs in node for tools/move_test.mjs.
//
// Model: a vertical capsule. `p` = feet position, radius r, hull height H.
//   bottom sphere centre = (x, y + r, z), top sphere centre = (x, y + H - r, z).
// Workflow per fixed step:  gather(bvh, box)  → caches every triangle near the player once,
// then any number of resolve()/probeSupport()/fits() calls run on that cache with no BVH traffic.

export const MAXTRI = 640;
const STR = 24;                       // floats per cached triangle
const tri = new Float64Array(MAXTRI * STR);
let nTri = 0;
export let gatherOverflow = false;
export const triCount = () => nTri;

// ---- tunables shared with simulate.js -------------------------------------------------------
export const SKIN = 0.003;            // resolved capsules rest this far off the surface
export const WALK_Y = 0.7;            // min face-normal y that counts as walkable ground (≈45.6°)
export const EDGE_Y = 0.35;            // min contact-direction y for an EDGE/vertex contact to count as support (foot reaches ≈ 0.34 m past a ledge, like CS hulls)

// ---- contact report (reused, reset by resetContacts) ---------------------------------------
export const C = {
  ground: false, gnx: 0, gny: 1, gnz: 0, gscore: -1,     // best ground face normal (y > 0)
  nWall: 0, wx: new Float64Array(8), wy: new Float64Array(8), wz: new Float64Array(8),   // unique non-ground contact normals
  hitCeil: false, hitWall: false, wnx: 0, wny: 0, wnz: 0, wdepth: 0,                      // strongest near-vertical wall contact
  maxPush: 0,
};
export function resetContacts() {
  C.ground = false; C.gnx = 0; C.gny = 1; C.gnz = 0; C.gscore = -1; C.nWall = 0; C.hitCeil = false; C.hitWall = false; C.wdepth = 0; C.maxPush = 0;
}

// ---- BVH gather ----------------------------------------------------------------------------
let gMinX = 0, gMinY = 0, gMinZ = 0, gMaxX = 0, gMaxY = 0, gMaxZ = 0;
const gCallbacks = {
  intersectsBounds(box) {
    const a = box.min, b = box.max;
    return !(b.x < gMinX || a.x > gMaxX || b.y < gMinY || a.y > gMaxY || b.z < gMinZ || a.z > gMaxZ);
  },
  intersectsTriangle(t) {
    const a = t.a, b = t.b, c = t.c;
    const mnx = Math.min(a.x, b.x, c.x), mxx = Math.max(a.x, b.x, c.x);
    if (mxx < gMinX || mnx > gMaxX) return false;
    const mny = Math.min(a.y, b.y, c.y), mxy = Math.max(a.y, b.y, c.y);
    if (mxy < gMinY || mny > gMaxY) return false;
    const mnz = Math.min(a.z, b.z, c.z), mxz = Math.max(a.z, b.z, c.z);
    if (mxz < gMinZ || mnz > gMaxZ) return false;
    // face normal
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, acx = c.x - a.x, acy = c.y - a.y, acz = c.z - a.z;
    let nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-10) return false;                       // degenerate sliver
    if (nTri >= MAXTRI) { gatherOverflow = true; return false; }
    nx /= l; ny /= l; nz /= l;
    const o = nTri++ * STR;
    tri[o] = a.x; tri[o + 1] = a.y; tri[o + 2] = a.z; tri[o + 3] = b.x; tri[o + 4] = b.y; tri[o + 5] = b.z; tri[o + 6] = c.x; tri[o + 7] = c.y; tri[o + 8] = c.z;
    tri[o + 9] = nx; tri[o + 10] = ny; tri[o + 11] = nz;
    tri[o + 12] = mnx; tri[o + 13] = mny; tri[o + 14] = mnz; tri[o + 15] = mxx; tri[o + 16] = mxy; tri[o + 17] = mxz;
    return false;
  },
};
export function gather(bvh, minX, minY, minZ, maxX, maxY, maxZ) {
  nTri = 0; gatherOverflow = false;
  gMinX = minX; gMinY = minY; gMinZ = minZ; gMaxX = maxX; gMaxY = maxY; gMaxZ = maxZ;
  bvh.shapecast(gCallbacks);
}

// ---- closest-point primitives ---------------------------------------------------------------
const T = { x: 0, y: 0, z: 0 };       // closestPtTri output
function closestPtTri(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) { T.x = ax; T.y = ay; T.z = az; return; }
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) { T.x = bx; T.y = by; T.z = bz; return; }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); T.x = ax + abx * v; T.y = ay + aby * v; T.z = az + abz * v; return; }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) { T.x = cx; T.y = cy; T.z = cz; return; }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); T.x = ax + acx * w; T.y = ay + acy * w; T.z = az + acz * w; return; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    T.x = bx + (cx - bx) * w; T.y = by + (cy - by) * w; T.z = bz + (cz - bz) * w; return;
  }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  T.x = ax + abx * v + acx * w; T.y = ay + aby * v + acy * w; T.z = az + abz * v + acz * w;
}

const SA = { x: 0, y: 0, z: 0 }, SB = { x: 0, y: 0, z: 0 };   // closestSegSeg outputs (point on seg1, point on seg2)
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
function closestSegSeg(p1x, p1y, p1z, q1x, q1y, q1z, p2x, p2y, p2z, q2x, q2y, q2z) {
  const d1x = q1x - p1x, d1y = q1y - p1y, d1z = q1z - p1z, d2x = q2x - p2x, d2y = q2y - p2y, d2z = q2z - p2z;
  const rx = p1x - p2x, ry = p1y - p2y, rz = p1z - p2z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z, e = d2x * d2x + d2y * d2y + d2z * d2z, f = d2x * rx + d2y * ry + d2z * rz;
  let s, t;
  if (a <= 1e-12 && e <= 1e-12) { s = 0; t = 0; }
  else if (a <= 1e-12) { s = 0; t = clamp01(f / e); }
  else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= 1e-12) { t = 0; s = clamp01(-c / a); }
    else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z, den = a * e - b * b;
      s = den > 1e-12 ? clamp01((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = clamp01(-c / a); } else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
    }
  }
  SA.x = p1x + d1x * s; SA.y = p1y + d1y * s; SA.z = p1z + d1z * s;
  SB.x = p2x + d2x * t; SB.y = p2y + d2y * t; SB.z = p2z + d2z * t;
  const dx = SA.x - SB.x, dy = SA.y - SB.y, dz = SA.z - SB.z;
  return dx * dx + dy * dy + dz * dz;
}

// capsule-segment vs cached triangle i. Output points: S (on segment) / Qp (on triangle). Returns squared distance.
export const S = { x: 0, y: 0, z: 0, bottom: false, pierce: false, dP: 0, dQ: 0 };
export const Qp = { x: 0, y: 0, z: 0 };
function segTri(o, px, pyB, pz, pyT) {
  const ax = tri[o], ay = tri[o + 1], az = tri[o + 2], bx = tri[o + 3], by = tri[o + 4], bz = tri[o + 5], cx = tri[o + 6], cy = tri[o + 7], cz = tri[o + 8];
  const nx = tri[o + 9], ny = tri[o + 10], nz = tri[o + 11];
  S.pierce = false;
  // 1. does the vertical segment pierce the triangle interior?
  const dP = nx * (px - ax) + ny * (pyB - ay) + nz * (pz - az);
  const dQ = dP + ny * (pyT - pyB);
  if ((dP < 0 && dQ > 0) || (dP > 0 && dQ < 0)) {
    const t = dP / (dP - dQ);
    const xx = px, xy = pyB + (pyT - pyB) * t, xz = pz;
    // inside test
    const e0x = bx - ax, e0y = by - ay, e0z = bz - az, w0x = xx - ax, w0y = xy - ay, w0z = xz - az;
    const c0 = (e0y * w0z - e0z * w0y) * nx + (e0z * w0x - e0x * w0z) * ny + (e0x * w0y - e0y * w0x) * nz;
    if (c0 >= 0) {
      const e1x = cx - bx, e1y = cy - by, e1z = cz - bz, w1x = xx - bx, w1y = xy - by, w1z = xz - bz;
      const c1 = (e1y * w1z - e1z * w1y) * nx + (e1z * w1x - e1x * w1z) * ny + (e1x * w1y - e1y * w1x) * nz;
      if (c1 >= 0) {
        const e2x = ax - cx, e2y = ay - cy, e2z = az - cz, w2x = xx - cx, w2y = xy - cy, w2z = xz - cz;
        const c2 = (e2y * w2z - e2z * w2y) * nx + (e2z * w2x - e2x * w2z) * ny + (e2x * w2y - e2y * w2x) * nz;
        if (c2 >= 0) {
          S.x = xx; S.y = xy; S.z = xz; S.bottom = false; S.pierce = true; S.dP = dP; S.dQ = dQ;
          Qp.x = xx; Qp.y = xy; Qp.z = xz; return 0;
        }
      }
    }
  }
  let best = Infinity, bsx = 0, bsy = 0, bsz = 0, bqx = 0, bqy = 0, bqz = 0, bBottom = false;
  // 2. bottom endpoint vs triangle
  closestPtTri(px, pyB, pz, ax, ay, az, bx, by, bz, cx, cy, cz);
  let dx = px - T.x, dy = pyB - T.y, dz = pz - T.z, d = dx * dx + dy * dy + dz * dz;
  best = d; bsx = px; bsy = pyB; bsz = pz; bqx = T.x; bqy = T.y; bqz = T.z; bBottom = true;
  // 3. top endpoint
  if (pyT > pyB) {
    closestPtTri(px, pyT, pz, ax, ay, az, bx, by, bz, cx, cy, cz);
    dx = px - T.x; dy = pyT - T.y; dz = pz - T.z; d = dx * dx + dy * dy + dz * dz;
    if (d < best) { best = d; bsx = px; bsy = pyT; bsz = pz; bqx = T.x; bqy = T.y; bqz = T.z; bBottom = false; }
    // 4. segment interior vs the three edges
    d = closestSegSeg(px, pyB, pz, px, pyT, pz, ax, ay, az, bx, by, bz);
    if (d < best) { best = d; bsx = SA.x; bsy = SA.y; bsz = SA.z; bqx = SB.x; bqy = SB.y; bqz = SB.z; bBottom = SA.y <= pyB + 1e-9; }
    d = closestSegSeg(px, pyB, pz, px, pyT, pz, bx, by, bz, cx, cy, cz);
    if (d < best) { best = d; bsx = SA.x; bsy = SA.y; bsz = SA.z; bqx = SB.x; bqy = SB.y; bqz = SB.z; bBottom = SA.y <= pyB + 1e-9; }
    d = closestSegSeg(px, pyB, pz, px, pyT, pz, cx, cy, cz, ax, ay, az);
    if (d < best) { best = d; bsx = SA.x; bsy = SA.y; bsz = SA.z; bqx = SB.x; bqy = SB.y; bqz = SB.z; bBottom = SA.y <= pyB + 1e-9; }
  }
  S.x = bsx; S.y = bsy; S.z = bsz; S.bottom = bBottom; Qp.x = bqx; Qp.y = bqy; Qp.z = bqz;
  return best;
}

function addWall(nx, ny, nz) {
  for (let i = 0; i < C.nWall; i++) if (C.wx[i] * nx + C.wy[i] * ny + C.wz[i] * nz > 0.985) return;
  if (C.nWall < 8) { C.wx[C.nWall] = nx; C.wy[C.nWall] = ny; C.wz[C.nWall] = nz; C.nWall++; }
}

// Is this contact "standing-on" material? faceContact → needs walkable face; edge contacts need EDGE_Y.
function groundLike(o, nx, ny, nz, bottom) {
  if (!bottom) return false;
  const dot = Math.abs(nx * tri[o + 9] + ny * tri[o + 10] + nz * tri[o + 11]);
  return dot > 0.9995 ? ny >= WALK_Y : ny >= EDGE_Y;
}

/**
 * Push capsule `p` out of every cached triangle it penetrates (by r+SKIN). Walkable contacts push
 * straight UP (so ramps/edges never shove you sideways); everything else pushes along the contact
 * normal. Fills the shared contact report `C` (call resetContacts first). ref = point we came from
 * (used only to orient zero-distance pierce cases). Returns true if anything moved.
 */
export function resolve(p, H, r, refx, refy, refz, passes = 4) {
  const rr = r + SKIN, rr2 = rr * rr;
  let moved = false;
  for (let pass = 0; pass < passes; pass++) {
    let worst = 0;
    for (let i = 0; i < nTri; i++) {
      const o = i * STR;
      if (tri[o + 15] < p.x - rr || tri[o + 12] > p.x + rr || tri[o + 17] < p.z - rr || tri[o + 14] > p.z + rr || tri[o + 16] < p.y || tri[o + 13] > p.y + H) continue;
      const pyB = p.y + r, pyT = p.y + H - r;
      const d2 = segTri(o, p.x, pyB, p.z, pyT);
      if (d2 >= rr2) continue;
      let nx, ny, nz, d = Math.sqrt(d2), pen;
      if (S.pierce) {
        // segment passes through the triangle: pick the side we came from
        let sg = (tri[o + 9] * (refx - tri[o]) + tri[o + 10] * (refy - tri[o + 1]) + tri[o + 11] * (refz - tri[o + 2])) >= 0 ? 1 : -1;
        nx = tri[o + 9] * sg; ny = tri[o + 10] * sg; nz = tri[o + 11] * sg;
        const a = sg * S.dP, b = sg * S.dQ;
        pen = rr - Math.min(a, b);
        d = 0;
      } else if (d > 1e-7) {
        nx = (S.x - Qp.x) / d; ny = (S.y - Qp.y) / d; nz = (S.z - Qp.z) / d; pen = rr - d;
      } else {
        nx = tri[o + 9]; ny = tri[o + 10]; nz = tri[o + 11]; pen = rr;
      }
      if (pen <= 1e-6) continue;
      const ground = !S.pierce && groundLike(o, nx, ny, nz, S.bottom);
      if (ground) {
        // vertical-only resolution
        const hx = S.x - Qp.x, hz = S.z - Qp.z, h2 = hx * hx + hz * hz, v = S.y - Qp.y;
        const need = Math.sqrt(Math.max(0, rr2 - h2)) - v;
        if (need > 1e-6) { p.y += need; moved = true; if (need > worst) worst = need; }
        // ground face normal (flip up); score by n.y
        let gx = tri[o + 9], gy = tri[o + 10], gz = tri[o + 11];
        if (gy < 0) { gx = -gx; gy = -gy; gz = -gz; }
        if (gy < WALK_Y) { gx = 0; gy = 1; gz = 0; }
        if (gy > C.gscore || !C.ground) { C.gnx = gx; C.gny = gy; C.gnz = gz; C.gscore = gy; }
        C.ground = true;
      } else {
        p.x += nx * pen; p.y += ny * pen; p.z += nz * pen; moved = true;
        if (pen > worst) worst = pen;
        if (ny < -0.5) C.hitCeil = true;
        addWall(nx, ny, nz);
        if (Math.abs(ny) < 0.5 && pen >= C.wdepth * 0.5) { C.hitWall = true; C.wnx = nx; C.wny = ny; C.wnz = nz; if (pen > C.wdepth) C.wdepth = pen; }
      }
    }
    if (worst > C.maxPush) C.maxPush = worst;
    if (worst < 1e-4) break;
  }
  return moved;
}

/** Support probe: is there walkable ground within `tol` of the feet? Fills C.g* (does not touch other C fields). */
export const G = { found: false, nx: 0, ny: 1, nz: 0, y: 0, score: -1 };
export function probeSupport(p, H, r, tol) {
  const lim = r + SKIN + tol, lim2 = lim * lim;
  G.found = false; G.score = -1; G.nx = 0; G.ny = 1; G.nz = 0;
  const pyB = p.y + r, pyT = p.y + H - r;
  for (let i = 0; i < nTri; i++) {
    const o = i * STR;
    if (tri[o + 15] < p.x - lim || tri[o + 12] > p.x + lim || tri[o + 17] < p.z - lim || tri[o + 14] > p.z + lim || tri[o + 16] < p.y - tol || tri[o + 13] > p.y + H) continue;
    const d2 = segTri(o, p.x, pyB, p.z, pyT);
    if (d2 >= lim2 || S.pierce) continue;
    const d = Math.sqrt(d2); if (d < 1e-7) continue;
    const nx = (S.x - Qp.x) / d, ny = (S.y - Qp.y) / d, nz = (S.z - Qp.z) / d;
    if (!groundLike(o, nx, ny, nz, S.bottom)) continue;
    let gx = tri[o + 9], gy = tri[o + 10], gz = tri[o + 11];
    if (gy < 0) { gx = -gx; gy = -gy; gz = -gz; }
    if (gy < WALK_Y) { gx = 0; gy = 1; gz = 0; }
    if (gy > G.score) { G.found = true; G.score = gy; G.nx = gx; G.ny = gy; G.nz = gz; G.y = Qp.y; }
  }
  return G.found;
}

/** Does a capsule of hull H at feet (x,y,z) fit (no triangle closer than r − eps)? */
export function fits(x, y, z, H, r, eps = 0.002) {
  const lim = r - eps, lim2 = lim * lim;
  const pyB = y + r, pyT = y + H - r;
  for (let i = 0; i < nTri; i++) {
    const o = i * STR;
    if (tri[o + 15] < x - r || tri[o + 12] > x + r || tri[o + 17] < z - r || tri[o + 14] > z + r || tri[o + 16] < y || tri[o + 13] > y + H) continue;
    if (segTri(o, x, pyB, z, pyT) < lim2) return false;
  }
  return true;
}

/** Deepest penetration (m) of a capsule at p — for tests/debug. */
export function maxPenetration(p, H, r) {
  let worst = 0; const pyB = p.y + r, pyT = p.y + H - r;
  for (let i = 0; i < nTri; i++) {
    const o = i * STR;
    if (tri[o + 15] < p.x - r || tri[o + 12] > p.x + r || tri[o + 17] < p.z - r || tri[o + 14] > p.z + r || tri[o + 16] < p.y || tri[o + 13] > p.y + H) continue;
    const d2 = segTri(o, p.x, pyB, p.z, pyT);
    const pen = S.pierce ? r : r - Math.sqrt(d2);
    if (pen > worst) worst = pen;
  }
  return worst;
}
