// Visibility, cover, angle-holding and sampling helpers that sit on top of the navgrid. Pure (no DOM).
import * as THREE from 'three';

const PR = 16;   // rays per spot sight profile
export class Tactics {
  constructor(sys) {
    this.sys = sys;
    this.ray = new THREE.Ray(); this.d = new THREE.Vector3(); this.A = new THREE.Vector3(); this.B = new THREE.Vector3();
    this.holdCache = new Map();
    this.rays = 0;
  }
  get bvh() { return this.sys.bvh; }
  /** true if the straight segment is blocked by static geometry. */
  blocked(ax, ay, az, bx, by, bz) {
    const d = this.d; d.set(bx - ax, by - ay, bz - az); const len = d.length(); if (len < 1e-4) return false;
    d.multiplyScalar(1 / len); this.ray.origin.set(ax, ay, az); this.ray.direction.copy(d); this.rays++;
    return this.bvh.raycastFirst(this.ray, THREE.DoubleSide, 0, len - 0.03) !== null;
  }
  /** distance to first wall along a direction (max if free). */
  castDist(ox, oy, oz, dx, dy, dz, max = 80) {
    this.ray.origin.set(ox, oy, oz); this.ray.direction.set(dx, dy, dz); this.rays++;
    const h = this.bvh.raycastFirst(this.ray, THREE.DoubleSide, 0, max); return h ? h.distance : max;
  }
  /**
   * Eye-to-eye line of sight. Points are FEET positions unless opts.eye = true. opts: eyeA, eyeB (heights), ignoreSmoke.
   * Honors the smoke hook ctx.combat.utility.blocksLine(a, b).
   */
  visible(a, b, o) {
    const eyeA = o?.eye ? 0 : (o?.eyeA ?? this.sys.cfg.eye), eyeB = o?.eye ? 0 : (o?.eyeB ?? this.sys.cfg.eye);
    const A = this.A.set(a.x, a.y + eyeA, a.z), B = this.B.set(b.x, b.y + eyeB, b.z);
    if (this.blocked(A.x, A.y, A.z, B.x, B.y, B.z)) return false;
    if (!o?.ignoreSmoke) { const f = this.sys.hooks.blocksLine?.(A, B); if (f) return false; }
    return true;
  }
  /** Fraction (0..1) of a target's body (head, chest, knees) visible from an eye. */
  exposure(a, b, o) {
    const eyeA = o?.eye ? 0 : (o?.eyeA ?? this.sys.cfg.eye); const ax = a.x, ay = a.y + eyeA, az = a.z; let seen = 0;
    const H = o?.crouchB ? [1.05, 0.7, 0.3] : [1.68, 1.15, 0.35];
    for (let i = 0; i < 3; i++) { const by = b.y + H[i]; if (this.blocked(ax, ay, az, b.x, by, b.z)) continue; if (!o?.ignoreSmoke && this.sys.hooks.blocksLine?.(this.A.set(ax, ay, az), this.B.set(b.x, by, b.z))) continue; seen++; }
    return seen / 3;
  }
  sightDistance(pos, yaw, pitch = 0, max = 80) {
    const cp = Math.cos(pitch); return this.castDist(pos.x, pos.y + this.sys.cfg.eye, pos.z, -Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp, max);
  }

  // ------------------------------------------------------------------------------------------------- nodes around a point
  /** Iterate nodes within radius (XZ) & |dy| <= dyMax of a point, calling fn(node, dist). */
  eachNear(x, y, z, radius, dyMax, fn, stride = 1) {
    const g = this.sys.g, cell = g.cell, r = Math.ceil(radius / cell);
    const ci = Math.floor((x - g.ox) / cell), cj = Math.floor((z - g.oz) / cell), r2 = radius * radius;
    for (let j = Math.max(0, cj - r); j <= Math.min(g.H - 1, cj + r); j += stride) for (let i = Math.max(0, ci - r); i <= Math.min(g.W - 1, ci + r); i += stride) {
      const c = j * g.W + i;
      for (let n = g.colStart[c], e = g.colStart[c + 1]; n < e; n++) {
        if (Math.abs(g.py[n] - y) > dyMax) continue; const dx = g.px[n] - x, dz = g.pz[n] - z, d2 = dx * dx + dz * dz; if (d2 <= r2) fn(n, Math.sqrt(d2));
      }
    }
  }

  randomPointNear(pos, radius = 6, o, out = new THREE.Vector3()) {
    const sys = this.sys, g = sys.g, rng = sys.rng, minR = o?.minRadius ?? 0, dyMax = o?.dy ?? 2.6;
    for (let t = 0; t < 40; t++) {
      const a = rng() * Math.PI * 2, r = minR + Math.sqrt(rng()) * (radius - minR);
      const x = pos.x + Math.cos(a) * r, z = pos.z + Math.sin(a) * r;
      const ci = Math.floor((x - g.ox) / g.cell), cj = Math.floor((z - g.oz) / g.cell);
      const n = g.findInCol(ci, cj, pos.y, dyMax); if (n < 0) continue;
      if (o?.minWall && g.wall[n] < o.minWall) continue;
      if (o?.visibleFrom && this.visible(o.visibleFrom, { x: g.px[n], y: g.py[n], z: g.pz[n] })) continue;
      return out.set(g.px[n], g.py[n], g.pz[n]);
    }
    const n = g.nearest(pos.x, pos.y, pos.z, 6); if (n < 0) return null;
    return out.set(g.px[n], g.py[n], g.pz[n]);
  }
  randomPoint(out = new THREE.Vector3()) { const g = this.sys.g; if (!g.N) return null; const n = Math.floor(this.sys.rng() * g.N); return out.set(g.px[n], g.py[n], g.pz[n]); }

  // ------------------------------------------------------------------------------------------------- precomputed spots
  /** Choose well-spread wall-hugging "spots" (cover / angle candidates) once per build: deterministic Poisson-disc over wall-adjacent nodes. */
  static *buildSpotsGen(g, spacing = 1.6, due = () => false) {
    const bucket = 4, W = Math.ceil((g.W * g.cell) / bucket) + 1, H = Math.ceil((g.H * g.cell) / bucket) + 1;
    const sel = [], hash = new Map(), key = (x, z) => Math.floor((z - g.oz) / bucket) * W + Math.floor((x - g.ox) / bucket);
    const sp2 = spacing * spacing;
    for (let n = 0; n < g.N; n++) {
      if ((n & 2047) === 0 && due()) yield n / g.N;
      if (g.wall[n] > 1) continue; const x = g.px[n], y = g.py[n], z = g.pz[n]; let ok = true;
      const bx = Math.floor((x - g.ox) / bucket), bz = Math.floor((z - g.oz) / bucket);
      for (let dz = -1; dz <= 1 && ok; dz++) for (let dx = -1; dx <= 1 && ok; dx++) { const l = hash.get((bz + dz) * W + bx + dx); if (!l) continue; for (const m of l) { if (Math.abs(g.py[m] - y) < 1.5 && (g.px[m] - x) ** 2 + (g.pz[m] - z) ** 2 < sp2) { ok = false; break; } } }
      if (!ok) continue; sel.push(n); const k = key(x, z); let l = hash.get(k); if (!l) hash.set(k, l = []); l.push(n);
    }
    const S = sel.length, node = Int32Array.from(sel), prof = new Float32Array(S * PR), have = new Uint8Array(S), expo = new Float32Array(S);
    const bstart = new Int32Array(W * H + 1), order = new Int32Array(S);
    for (let i = 0; i < S; i++) bstart[key(g.px[node[i]], g.pz[node[i]]) + 1]++;
    for (let i = 0; i < W * H; i++) bstart[i + 1] += bstart[i];
    const f = bstart.slice(0, W * H); for (let i = 0; i < S; i++) order[f[key(g.px[node[i]], g.pz[node[i]])]++] = i;
    return { n: S, node, prof, have, expo, bstart, order, W, H, bucket, spacing };
  }
  static buildSpots(g, spacing) { const it = Tactics.buildSpotsGen(g, spacing); let r; while (!(r = it.next()).done); return r.value; }
  eachSpotNear(x, y, z, radius, dyMax, fn) {
    const g = this.sys.g, sp = g.spots; if (!sp) return false;
    const b = sp.bucket, r = Math.ceil(radius / b), bx = Math.floor((x - g.ox) / b), bz = Math.floor((z - g.oz) / b), r2 = radius * radius;
    for (let j = Math.max(0, bz - r); j <= Math.min(sp.H - 1, bz + r); j++) for (let i = Math.max(0, bx - r); i <= Math.min(sp.W - 1, bx + r); i++) {
      const c = j * sp.W + i;
      for (let q = sp.bstart[c]; q < sp.bstart[c + 1]; q++) { const si = sp.order[q], n = sp.node[si]; if (Math.abs(g.py[n] - y) > dyMax) continue; const dx = g.px[n] - x, dz = g.pz[n] - z, d2 = dx * dx + dz * dz; if (d2 <= r2) fn(si, n, Math.sqrt(d2)); }
    }
    return true;
  }
  /**
   * Openness of spot si: fraction of 16 eye-height rays that see farther than 12 m. A pure function of the graph (cached), so
   * results never depend on query history; the background pump just fills the cache ahead of time.
   */
  spotExposure(si) {
    const g = this.sys.g, sp = g.spots; if (sp.have[si]) return sp.expo[si];
    const n = sp.node[si], x = g.px[n], y = g.py[n] + this.sys.cfg.eye, z = g.pz[n]; let open = 0;
    for (let i = 0; i < PR; i++) { const yaw = i * Math.PI * 2 / PR; const d = this.castDist(x, y, z, -Math.sin(yaw), 0, -Math.cos(yaw), 14); sp.prof[si * PR + i] = d; if (d > 12) open++; }
    sp.expo[si] = open / PR; sp.have[si] = 1; return sp.expo[si];
  }
  /** Generator: fill all spot exposures in the background (called from the build pump, ~160 rays per slice). */
  *precomputeProfiles(budgetRays = 160) {
    const sp = this.sys.g.spots; let used = 0;
    for (let si = 0; si < sp.n; si++) { if (!sp.have[si]) { this.spotExposure(si); used += PR; } if (used >= budgetRays) { used = 0; yield si / sp.n; } }
  }
  /** Line is clear of static geometry AND live smoke. */
  lineClear(ax, ay, az, bx, by, bz) {
    if (this.blocked(ax, ay, az, bx, by, bz)) return false;
    const f = this.sys.hooks.blocksLine; if (f && f(this.A.set(ax, ay, az), this.B.set(bx, by, bz))) return false;
    return true;
  }

  // ------------------------------------------------------------------------------------------------- cover
  /**
   * Wall-hugging positions near `near` that are hidden from a threat at `from`. Uses the precomputed spot set: only the nearest
   * ~26 spots get a ray test, so a call costs well under 1 ms. Returns up to o.max
   * {pos, node, dist, score, peek (Vector3|null: a spot ~1 m sideways that sees the threat), yaw (facing the threat), hard}.
   */
  coverPoints(near, from, radius = 12, o) {
    const sys = this.sys, g = sys.g, cfg = sys.cfg, max = o?.max ?? 6, dyMax = o?.dy ?? 2.4, maxCand = o?.candidates ?? 26;
    const ex = from.x, ey = from.y + (o?.threatEye ?? cfg.eye), ez = from.z, minTd = o?.minThreatDist ?? 3;
    const list = [];   // [dist, node]
    if (g.spots) this.eachSpotNear(near.x, near.y, near.z, radius, dyMax, (si, n, d) => { list.push(d, n); });
    else this.eachNear(near.x, near.y, near.z, radius, dyMax, (n, d) => { if (g.wall[n] <= 1 && ((n * 2654435761) >>> 0) % 5 === 0) list.push(d, n); });
    const idx = []; for (let i = 0; i < list.length; i += 2) idx.push(i);
    idx.sort((a, b) => list[a] - list[b] || list[a + 1] - list[b + 1]);
    const hidden = [];
    for (let q = 0; q < idx.length && q < maxCand * 2 && hidden.length < max * 3; q++) {
      const d = list[idx[q]], n = list[idx[q] + 1], x = g.px[n], y = g.py[n], z = g.pz[n];
      const td = Math.hypot(x - ex, z - ez); if (td < minTd) continue;
      if (!this.blocked(ex, ey, ez, x, y + cfg.eye, z)) continue;
      if (!this.blocked(ex, ey, ez, x, y + 1.0, z)) continue;
      hidden.push({ d, n, td });
    }
    const cand = [];
    for (const h of hidden) {
      const n = h.n, x = g.px[n], y = g.py[n], z = g.pz[n], td = h.td;
      const hard = this.blocked(ex, ey, ez, x, y + 0.35, z);
      const px = -(z - ez) / td, pz = (x - ex) / td; let peek = null;
      for (const s of [1, -1]) {
        const qx = x + px * s, qz = z + pz * s, qn = g.findInCol(Math.floor((qx - g.ox) / g.cell), Math.floor((qz - g.oz) / g.cell), y, 0.5);
        if (qn < 0) continue;
        if (!this.blocked(ex, ey, ez, g.px[qn], g.py[qn] + cfg.eye, g.pz[qn])) { peek = new THREE.Vector3(g.px[qn], g.py[qn], g.pz[qn]); break; }
      }
      let score = 10 - h.d * 0.55 + (peek ? 3.5 : 0) + (hard ? 1.5 : 0) + (g.wall[n] === 0 ? 0.8 : 0) + Math.min(td, 25) * 0.05;
      if (o?.prefer) score -= Math.hypot(x - o.prefer.x, z - o.prefer.z) * 0.15;
      cand.push({ pos: new THREE.Vector3(x, y, z), node: n, dist: h.d, score, peek, hard, yaw: Math.atan2(-(ex - x), -(ez - z)) });
    }
    cand.sort((a, b) => b.score - a.score || a.node - b.node);
    const out = [];
    for (const c of cand) { let ok = true; for (const k of out) if (k.pos.distanceToSquared(c.pos) < 2.25) { ok = false; break; } if (ok) { out.push(c); if (out.length >= max) break; } }
    return out;
  }

  // ------------------------------------------------------------------------------------------------- angles
  /**
   * Sight profile from a standing position: 32 eye-height rays. Returns openings worth holding:
   * [{yaw, range, width, kind:'long'|'mid'|'short', dir:Vector3, point:Vector3}] sorted by range (long first).
   */
  holdAngles(pos, o) {
    const sys = this.sys, g = sys.g, n = g.nearest(pos.x, pos.y, pos.z, 3), cfg = sys.cfg;
    const bx = n >= 0 ? g.px[n] : pos.x, by = n >= 0 ? g.py[n] : pos.y, bz = n >= 0 ? g.pz[n] : pos.z;
    const key = n >= 0 && !o?.nocache ? n : -1;
    let prof = key >= 0 ? this.holdCache.get(key) : null;
    const RAYS = 32, MAXR = o?.max ?? 90;
    if (!prof) {
      prof = new Float32Array(RAYS);
      for (let i = 0; i < RAYS; i++) { const yaw = (i / RAYS) * Math.PI * 2; prof[i] = this.castDist(bx, by + cfg.eye, bz, -Math.sin(yaw), 0, -Math.cos(yaw), MAXR); }
      if (key >= 0) { if (this.holdCache.size > 4000) this.holdCache.clear(); this.holdCache.set(key, prof); }
    }
    const res = []; const minRange = o?.minRange ?? 6;
    for (let i = 0; i < RAYS; i++) {
      const d = prof[i], pv = prof[(i + RAYS - 1) % RAYS], nx = prof[(i + 1) % RAYS];
      if (d < minRange || d < pv || d < nx) continue;                       // local maxima only
      if (d === pv && prof[(i + RAYS - 2) % RAYS] === d) continue;
      let w = 1; for (let k = 1; k < RAYS / 2; k++) { if (prof[(i + k) % RAYS] >= d * 0.7) w++; else break; }
      for (let k = 1; k < RAYS / 2; k++) { if (prof[(i - k + RAYS) % RAYS] >= d * 0.7) w++; else break; }
      const yaw = (i / RAYS) * Math.PI * 2, dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      res.push({ yaw, range: d, width: w * (Math.PI * 2 / RAYS), kind: d >= 28 ? 'long' : d >= 13 ? 'mid' : 'short', dir, point: new THREE.Vector3(bx + dir.x * d, by + cfg.eye, bz + dir.z * d) });
    }
    res.sort((a, b) => b.range - a.range || a.yaw - b.yaw);
    return res;
  }
  /**
   * Good places to hold an angle on a threat at `toward`, from the precomputed spot set (~3 rays per candidate).
   * Scores how much of the holder's BODY the threat could see (head / chest / legs from the threat's eye, smoke aware):
   * head-or-chest-only spots (box edges, door frames, low walls) win over fully exposed open floor, and ambient openness
   * (fraction of long sight lines) is penalised. Returns [{pos, node, range, bodyExposure (0..1, 1/3 = head only),
   * exposure (0..1 openness), visible, score, yaw}] best first. If the threat is not visible from anywhere nearby it falls back
   * to spots facing its bearing (visible=false, bodyExposure=0). Deterministic: depends only on the graph and the arguments.
   */
  holdSpots(near, toward, radius = 14, o) {
    const sys = this.sys, g = sys.g, cfg = sys.cfg, max = o?.max ?? 5, minRange = o?.minRange ?? 6, list = [];
    if (!g.spots) return [];
    const tx = toward.x, tz = toward.z, ty = toward.y + (o?.threatEye ?? cfg.eye);
    this.eachSpotNear(near.x, near.y, near.z, radius, o?.dy ?? 2.4, (si, n, d) => { list.push(d, si); });
    const idx = []; for (let i = 0; i < list.length; i += 2) idx.push(i); idx.sort((a, b) => list[a] - list[b] || list[a + 1] - list[b + 1]);
    const cand = [], fallback = [], H = [1.68, 1.15, 0.35];
    for (let q = 0; q < idx.length && q < (o?.candidates ?? 30); q++) {
      const d = list[idx[q]], si = list[idx[q] + 1], n = g.spots.node[si], x = g.px[n], y = g.py[n], z = g.pz[n];
      const range = Math.hypot(tx - x, tz - z); if (range < minRange) continue;
      let seen = 0; for (let i = 0; i < 3; i++) if (this.lineClear(tx, ty, tz, x, y + H[i], z)) seen++;
      const yaw = Math.atan2(-(tx - x), -(tz - z));
      if (seen === 0) {                                  // off-angle: remember how far this spot can see along the bearing
        if (!fallback.length || fallback.length < 12) { const sb = this.castDist(x, y + cfg.eye, z, -Math.sin(yaw), 0, -Math.cos(yaw), 60); fallback.push({ pos: new THREE.Vector3(x, y, z), node: n, range, bodyExposure: 0, exposure: this.spotExposure(si), visible: false, score: Math.min(sb, 40) * 0.1 - this.spotExposure(si) * 2 - d * 0.22, yaw }); }
        continue;
      }
      const e = seen / 3, open = this.spotExposure(si);
      const score = (e < 1 ? 5 - Math.abs(e - 1 / 3) * 2.5 : 0.8) + Math.min(range, 40) * 0.08 - open * 2.2 - d * 0.2 + (g.wall[n] === 0 ? 1 : 0.4);
      cand.push({ pos: new THREE.Vector3(x, y, z), node: n, range, bodyExposure: e, exposure: open, visible: true, score, yaw });
    }
    const pool = cand.length ? cand : fallback;
    pool.sort((a, b) => b.score - a.score || a.node - b.node);
    const out = []; for (const c of pool) { let ok = true; for (const k of out) if (k.pos.distanceToSquared(c.pos) < 4) { ok = false; break; } if (ok) { out.push(c); if (out.length >= max) break; } }
    return out;
  }
}
