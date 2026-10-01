// Visibility, cover, angle-holding and sampling helpers that sit on top of the navgrid. Pure (no DOM).
import * as THREE from 'three';

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

  // ------------------------------------------------------------------------------------------------- cover
  /**
   * Positions near `near` that are hidden from a threat at `from` and hug a wall.
   * Returns up to o.max {pos, node, dist, score, peek (Vector3|null: a spot 1 m sideways that sees the threat), yaw (facing the threat), hard}.
   */
  coverPoints(near, from, radius = 12, o) {
    const sys = this.sys, g = sys.g, cfg = sys.cfg, max = o?.max ?? 6, dyMax = o?.dy ?? 2.4;
    const stride = o?.stride ?? (radius > 10 ? 2 : 1);
    const ex = from.x, ey = from.y + (o?.threatEye ?? cfg.eye), ez = from.z;
    const cand = [];
    const wallMax = o?.wall ?? 1;
    this.eachNear(near.x, near.y, near.z, radius, dyMax, (n, d) => {
      if (g.wall[n] > wallMax) return;
      const x = g.px[n], y = g.py[n], z = g.pz[n];
      const td = Math.hypot(x - ex, z - ez); if (td < (o?.minThreatDist ?? 3)) return;
      if (!this.blocked(ex, ey, ez, x, y + cfg.eye, z)) return;            // head visible -> no cover
      if (!this.blocked(ex, ey, ez, x, y + 1.0, z)) return;                // chest visible
      const hard = this.blocked(ex, ey, ez, x, y + 0.35, z);
      // peek: sidestep 1 m left/right (perpendicular to threat) regains sight -> a real angle
      const px = -(z - ez) / td, pz = (x - ex) / td; let peek = null;
      for (const s of [1, -1]) {
        const qx = x + px * s * 1.0, qz = z + pz * s * 1.0, qn = g.findInCol(Math.floor((qx - g.ox) / g.cell), Math.floor((qz - g.oz) / g.cell), y, 0.5);
        if (qn < 0) continue;
        if (!this.blocked(ex, ey, ez, g.px[qn], g.py[qn] + cfg.eye, g.pz[qn])) { peek = new THREE.Vector3(g.px[qn], g.py[qn], g.pz[qn]); break; }
      }
      let score = 10 - d * 0.55 + (peek ? 3.5 : 0) + (hard ? 1.5 : 0) + (g.wall[n] === 0 ? 0.8 : 0) + Math.min(td, 25) * 0.05;
      if (o?.prefer) score -= Math.hypot(x - o.prefer.x, z - o.prefer.z) * 0.15;
      cand.push({ pos: new THREE.Vector3(x, y, z), node: n, dist: d, score, peek, hard, yaw: Math.atan2(-(ex - x), -(ez - z)) });
    }, stride);
    cand.sort((a, b) => b.score - a.score || a.node - b.node);
    // keep candidates spatially distinct (>= 1.5 m apart)
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
   * Good places to hold an angle on `toward` from around `near`: wall-hugging spots that see `toward` with little other exposure.
   * Returns [{pos, node, range, exposure, score, yaw}] best first.
   */
  holdSpots(near, toward, radius = 14, o) {
    const sys = this.sys, g = sys.g, cfg = sys.cfg, max = o?.max ?? 5, cand = [];
    const minRange = o?.minRange ?? 8;
    this.eachNear(near.x, near.y, near.z, radius, o?.dy ?? 2.4, (n, d) => {
      if (g.wall[n] > 1) return;
      const x = g.px[n], y = g.py[n], z = g.pz[n], range = Math.hypot(toward.x - x, toward.z - z);
      if (range < minRange) return;
      if (this.blocked(x, y + cfg.eye, z, toward.x, toward.y + cfg.eye, toward.z)) return;
      const ang = this.holdAngles({ x, y, z }, { max: 60 }); let open = 0; for (const a of ang) open += a.width * (a.range > 12 ? 1 : 0.3);
      const score = Math.min(range, 40) * 0.25 - open * 1.2 - d * 0.35 + (g.wall[n] === 0 ? 1 : 0);
      cand.push({ pos: new THREE.Vector3(x, y, z), node: n, range, exposure: open, score, yaw: Math.atan2(-(toward.x - x), -(toward.z - z)) });
    }, o?.stride ?? 2);
    cand.sort((a, b) => b.score - a.score || a.node - b.node);
    const out = []; for (const c of cand) { let ok = true; for (const k of out) if (k.pos.distanceToSquared(c.pos) < 6) { ok = false; break; } if (ok) { out.push(c); if (out.length >= max) break; } }
    return out;
  }
}
