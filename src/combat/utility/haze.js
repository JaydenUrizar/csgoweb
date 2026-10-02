import * as THREE from 'three';
import { HAZE as H, GRENADE } from './config.js';
import { cloudTexture } from './noise.js';
import { HAZE_VERT, HAZE_FRAG, OVERLAY_VERT, OVERLAY_FRAG } from './hazeShader.js';

// ---------------------------------------------------------------------------------------------------------------------
// Haze = smoke. Simulation: incremental voxel flood-fill (Dijkstra order by distance from a seed above the grenade) through
// open space only (each cell->cell step is a BVH ray test, so walls/floors/ceilings/props stop it and corridors fill further).
// Cells carry a birth time and a dissolve time; that density field is what `blocksLine` integrates, so gameplay visibility and
// the picture agree. Rendering: ~150-300 instanced sphere-impostor puffs per cloud (see hazeShader.js), sorted back-to-front.
// ---------------------------------------------------------------------------------------------------------------------
const VS = H.voxel, N = 2 * Math.ceil(H.maxRadius / VS) + 2, NN = N * N, N3 = N * N * N, NB = N >> 1;
const K_BELOW = 8;                      // cells kept below the floor (stairs down, pits)
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3();
const _hit = { dist: 0, normal: new THREE.Vector3(), point: null };
const CAP = H.maxPuffs;

function pooledArrays() {
  return { state: new Uint8Array(N3), birth: new Float32Array(N3), die: new Float32Array(N3),
    heapK: new Float32Array(32768), heapV: new Int32Array(32768), heapP: new Int32Array(32768),
    filled: new Int32Array(H.budget + H.bonus + 16), blockPuff: new Int16Array(NB * NB * NB) };
}

class Cloud {
  constructor(sys, arrays, gfx) { this.sys = sys; this.A = arrays; this.gfx = gfx; this.wakes = []; this.active = false; }
  init(pos, thrower, id) {
    const sys = this.sys, W = sys.W, A = this.A;
    this.id = id; this.tests = 0; this.blocked = 0; this.target = H.budget; this.pos = pos.clone(); this.thrower = thrower; this.age = 0; this.active = true; this.finalized = false; this.count = 0; this.hn = 0;
    this.life = H.life; this.wakes.length = 0; this.puffN = 0; this.radius = 0.3; this.extent = 0.6; this.gone = false;
    A.state.fill(0); A.birth.fill(1e9); A.die.fill(1e9); A.blockPuff.fill(-1);
    // ground under the grenade
    let floorY = pos.y - GRENADE.radius; _o.copy(pos); _d.set(0, -1, 0);
    if (W.raycast(_o, _d, 4, _hit)) floorY = pos.y - _hit.dist;
    // seed above the floor, lowered under low ceilings
    let sh = H.seedHeight; _o.set(pos.x, floorY + 0.12, pos.z); _d.set(0, 1, 0);
    if (W.raycast(_o, _d, sh + 0.6, _hit)) sh = Math.max(0.22, _hit.dist - 0.35);
    this.floorY = floorY;
    this.seed = new THREE.Vector3(pos.x, floorY + 0.12 + sh, pos.z);
    this.ox = this.seed.x - N * 0.5 * VS; this.oz = this.seed.z - N * 0.5 * VS; this.oy = floorY - K_BELOW * VS;
    const si = Math.floor((this.seed.x - this.ox) / VS), sj = Math.floor((this.seed.y - this.oy) / VS), sk = Math.floor((this.seed.z - this.oz) / VS);
    const sidx = si + N * (sj + N * sk); this.seedIdx = sidx;
    // make sure the seed cell centre is reachable from the grenade; otherwise fall back to the grenade's own cell
    this.cellPos(sidx, _v); if (W.segmentBlocked(pos, _v)) { const gj = Math.floor((pos.y + 0.1 - this.oy) / VS); this.seedIdx = si + N * (gj + N * sk); }
    this.hn = 0; this.push(this.seedIdx, 0, -1);
    this.centre = this.seed.clone(); this.centre.y = Math.min(this.seed.y + 0.6, floorY + 2.0);
    this.gfx.reset(this);
  }
  cellPos(idx, out) { const i = idx % N, j = ((idx / N) | 0) % N, k = (idx / NN) | 0; return out.set(this.ox + (i + 0.5) * VS, this.oy + (j + 0.5) * VS, this.oz + (k + 0.5) * VS); }
  // --- min-heap ---
  push(idx, key, parent) {
    const A = this.A; if (this.hn >= 32767) return; A.state[idx] = 1;
    let i = this.hn++; const K = A.heapK, V = A.heapV, P = A.heapP;
    while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= key) break; K[i] = K[p]; V[i] = V[p]; P[i] = P[p]; i = p; }
    K[i] = key; V[i] = idx; P[i] = parent;
  }
  pop() { // returns key; sets this.pv/this.pp
    const A = this.A, K = A.heapK, V = A.heapV, P = A.heapP; const key = K[0]; this.pv = V[0]; this.pp = P[0];
    const n = --this.hn; if (n > 0) {
      const lk = K[n], lv = V[n], lp = P[n]; let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && K[c + 1] < K[c]) c++; if (K[c] >= lk) break; K[i] = K[c]; V[i] = V[c]; P[i] = P[c]; i = c; }
      K[i] = lk; V[i] = lv; P[i] = lp;
    }
    return key;
  }
  fillBudget(age) {
    // volume-gated growth: fast burst then billowing settle
    const u = Math.min(1, age / H.expandTime), e = 1 - Math.pow(1 - u, 2.4);
    return Math.floor(this.target * e) + 1;
  }
  // --- simulation ---
  step(dt) {
    if (!this.active) return;
    this.age += dt;
    const A = this.A, W = this.sys.W;
    if (this.count < this.target && this.hn > 0) {
      const allow = this.fillBudget(this.age); let guard = 0;
      while (this.count < allow && this.hn > 0 && guard++ < 60) {
        const key = this.pop(); const idx = this.pv;
        if (key > H.maxRadius) { this.hn = 0; break; }
        A.state[idx] = 2; A.birth[idx] = this.age; A.filled[this.count++] = idx;
        this.cellPos(idx, _v); this.onFill(idx, _v, this.pp);
        const i = idx % N, j = ((idx / N) | 0) % N, k = (idx / NN) | 0;
        for (let d = 0; d < 6; d++) {
          const ni = i + DIRS[d][0], nj = j + DIRS[d][1], nk = k + DIRS[d][2];
          if (ni < 1 || nj < 1 || nk < 1 || ni >= N - 1 || nj >= N - 1 || nk >= N - 1) continue;
          const nidx = ni + N * (nj + N * nk); if (A.state[nidx] !== 0) continue;
          this.cellPos(nidx, _v2);
          const dx = _v2.x - this.seed.x, dy = (_v2.y - this.seed.y) * H.squash, dz = _v2.z - this.seed.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz); if (dist > H.maxRadius) continue;
          _o.copy(_v); _d.set(DIRS[d][0], DIRS[d][1], DIRS[d][2]);
          this.tests++;
          if (W.raycast(_o, _d, VS, null)) { this.blocked++; continue; }      // wall/floor/ceiling/prop in the way
          this.push(nidx, dist, idx);
        }
      }
      // confinement: the larger the share of blocked neighbour tests, the more volume the cloud gets (corridors fill ~8+ m each way)
      if (this.tests > 60) { const f = this.blocked / this.tests; this.target = Math.round(H.budget + H.bonus * Math.min(1, Math.max(0, (f - 0.1) / 0.2))); }
      if (this.hn === 0 || this.count >= this.target) this.exhausted = true;
    }
    if (!this.finalized && this.age > H.expandTime + 0.25) this.finalize();
    if (this.age >= this.life) { this.active = false; this.gone = true; }
    // wakes age out
    for (let i = this.wakes.length - 1; i >= 0; i--) if (this.age - this.wakes[i].t0 > this.wakes[i].life) this.wakes.splice(i, 1);
  }
  onFill(idx, p, parentIdx) {
    const i = idx % N, j = ((idx / N) | 0) % N, k = (idx / NN) | 0;
    const dx = p.x - this.seed.x, dy = p.y - this.seed.y, dz = p.z - this.seed.z; const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d + 0.7 > this.extent) this.extent = d + 0.7;
    this.radius = Math.max(this.radius, d);
    this.gfx.onCell(this, i, j, k, p, parentIdx);
  }
  finalize() {
    this.finalized = true;
    const A = this.A;
    // per-cell dissolve schedule: shell cells thin out first, deep cells last; all gone by `life`.
    for (let n = 0; n < this.count; n++) {
      const idx = A.filled[n], i = idx % N, j = ((idx / N) | 0) % N, k = (idx / NN) | 0; let c = 0;
      for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (A.state[(i + di) + N * ((j + dj) + N * (k + dk))] === 2) c++;
      const core = sstep(9, 26, c);
      A.die[idx] = H.fadeStart - 0.6 + core * 2.6 + hash1(idx) * 1.0;
    }
    this.gfx.finalize(this); this.gfx.skirtPass?.(this);
  }
  fadeAt(die, t) { return 1 - sstep(die, die + 2.4, t); }
  /** Raw cell density 0..1 (birth ramp x dissolve). */
  cellDensity(i, j, k) {
    if (i < 0 || j < 0 || k < 0 || i >= N || j >= N || k >= N) return 0;
    const idx = i + N * (j + N * k), A = this.A; if (A.state[idx] !== 2) return 0;
    const b = sstep(0, 0.4, this.age - A.birth[idx]);
    return b * (this.finalized ? this.fadeAt(A.die[idx], this.age) : 1);
  }
  /** Trilinear smoke density at a world point (0..1), including wake tunnels. */
  density(x, y, z) {
    const gx = (x - this.ox) / VS - 0.5, gy = (y - this.oy) / VS - 0.5, gz = (z - this.oz) / VS - 0.5;
    const i = Math.floor(gx), j = Math.floor(gy), k = Math.floor(gz), fx = gx - i, fy = gy - j, fz = gz - k;
    let d = 0;
    for (let c = 0; c < 8; c++) {
      const di = c & 1, dj = (c >> 1) & 1, dk = c >> 2;
      const w = (di ? fx : 1 - fx) * (dj ? fy : 1 - fy) * (dk ? fz : 1 - fz); if (w < 1e-4) continue;
      d += w * this.cellDensity(i + di, j + dj, k + dk);
    }
    if (d > 0 && this.wakes.length) d *= this.wakeFactor(x, y, z, false);
    return d;
  }
  wakeFactor(x, y, z, includeVisual) {
    let f = 1;
    for (let n = 0; n < this.wakes.length; n++) {
      const w = this.wakes[n]; if (w.visualOnly && !includeVisual) continue;
      const s = w.strength * w.amt(this.age); if (s <= 0.001) continue;
      const px = x - w.ox, py = y - w.oy, pz = z - w.oz; let t = px * w.dx + py * w.dy + pz * w.dz; t = t < 0 ? 0 : t > w.len ? w.len : t;
      const ex = px - w.dx * t, ey = py - w.dy * t, ez = pz - w.dz * t; const d = Math.sqrt(ex * ex + ey * ey + ez * ez); const r = w.radius(this.age) * (1 + 0.32 * Math.sin(t * 4.7 + w.ph) + 0.18 * Math.sin(t * 11.3 + w.ph * 2.1));
      if (d < r) f *= 1 - s * (1 - sstep(r * 0.45, r, d));
    }
    return f;
  }
  addWake(o, d, len, radius, strength, life, visualOnly = false) {
    // a spray widens the channel it already opened instead of stacking thin holes
    if (!visualOnly && len > 0.5) for (const k of this.wakes) {
      if (k.visualOnly || k.len < 0.5 || this.age - k.t0 > 0.9) continue;
      if (Math.abs(k.ox - o.x) + Math.abs(k.oy - o.y) + Math.abs(k.oz - o.z) < 1.6 && k.dx * d.x + k.dy * d.y + k.dz * d.z > 0.985) { k.r0 = Math.min(1.5, k.r0 + 0.2); k.t0 = this.age; k.len = Math.max(k.len, len); k.strength = Math.max(k.strength, strength); return k; }
    }
    this.wakeSerial = (this.wakeSerial || 0) + 1;
    const w = { ph: this.wakeSerial * 2.399 + this.id, ox: o.x, oy: o.y, oz: o.z, dx: d.x, dy: d.y, dz: d.z, len, r0: radius, strength, life, t0: this.age, visualOnly,
      amt: null, radius: null };
    w.amt = (age) => { const a = age - w.t0; return a < 0.25 ? 1 : Math.max(0, 1 - (a - 0.25) / (w.life - 0.25)); };
    w.radius = (age) => w.r0 * (1 + 0.7 * Math.min(1, (age - w.t0) / 1.2));
    if (this.wakes.length >= H.wakeMax) this.wakes.shift();
    this.wakes.push(w); return w;
  }
  /** Bounding sphere test for a segment (fast reject). */
  touchesSegment(a, b) {
    const r = this.extent + 0.5, cx = this.seed.x, cy = this.seed.y, cz = this.seed.z;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l2 = dx * dx + dy * dy + dz * dz; let t = l2 > 0 ? ((cx - a.x) * dx + (cy - a.y) * dy + (cz - a.z) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a.x + dx * t - cx, py = a.y + dy * t - cy, pz = a.z + dz * t - cz; return px * px + py * py + pz * pz <= r * r;
  }
  contains(p) { return this.density(p.x, p.y, p.z) > 0.5; }
}

// ---------------------------------------------------------------------------------------------------------------------
export function createHaze(ctx, W, shared) {
  const list = [];                 // active clouds (public: util.smokes)
  const freeArrays = [], freeGfx = [];
  let nextId = 1;
  const camPos = new THREE.Vector3(), camDir = new THREE.Vector3();
  const tex = cloudTexture(128); tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.needsUpdate = true;
  const overlay = makeOverlay();
  let overlayAdded = false;

  function makeOverlay() {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const m = new THREE.ShaderMaterial({ vertexShader: OVERLAY_VERT, fragmentShader: OVERLAY_FRAG, transparent: true, depthTest: false, depthWrite: false, uniforms: { uCol: { value: new THREE.Color(0.55, 0.57, 0.6) }, uAlpha: { value: 0 } } });
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 900; mesh.visible = false; mesh.name = 'haze-overlay'; return mesh;
  }

  // ---- render side -----------------------------------------------------------------------------------------------------
  function makeGfx() {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const iA = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4), iB = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4);
    iA.setUsage(THREE.DynamicDrawUsage); iB.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iA', iA); geo.setAttribute('iB', iB); geo.instanceCount = 0;
    const u = {
      uTex: { value: tex }, uTime: { value: 0 }, uOpacity: { value: 0.96 }, uFade: { value: 1 }, uPad: { value: 1.08 },
      uSunDir: shared.sunDir, uSunCol: shared.sunCol, uSkyCol: shared.skyCol, uGroundCol: shared.groundCol, uAlbedo: { value: new THREE.Color(0.80, 0.81, 0.84) },
      uCenter: { value: new THREE.Vector3() }, uCloudR: { value: 3 }, uCamPos: { value: new THREE.Vector3() }, uGlowPos: { value: new THREE.Vector3() }, uGlow: { value: new THREE.Vector4() },
      uWN: { value: 0 }, uWA: { value: [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector4()) }, uWB: { value: [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector4()) }, uWC: { value: [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector2()) },
      uFloorY: { value: 0 }, uExposure: shared.exposure, uFogCol: shared.fogCol,
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: HAZE_VERT, fragmentShader: HAZE_FRAG, uniforms: u, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 50; mesh.name = 'haze-cloud';
    // per-puff CPU state (struct of arrays)
    const P = { n: 0, px: new Float32Array(CAP), py: new Float32Array(CAP), pz: new Float32Array(CAP), tx: new Float32Array(CAP), ty: new Float32Array(CAP), tz: new Float32Array(CAP),
      ox: new Float32Array(CAP), oy: new Float32Array(CAP), oz: new Float32Array(CAP), tox: new Float32Array(CAP), toy: new Float32Array(CAP), toz: new Float32Array(CAP),
      cnt: new Float32Array(CAP), sx: new Float32Array(CAP), sy: new Float32Array(CAP), sz: new Float32Array(CAP), rad: new Float32Array(CAP), t0: new Float32Array(CAP),
      seed: new Float32Array(CAP), core: new Float32Array(CAP), die: new Float32Array(CAP), sat: new Uint8Array(CAP), key: new Float32Array(CAP), sv: new Float32Array(CAP).fill(0.7), svI: 0, vx: new Float32Array(CAP), vz: new Float32Array(CAP), am: new Float32Array(CAP).fill(1) };
    const order = new Uint16Array(CAP);
    const cmp = (a, b) => P.key[b] - P.key[a];
    return { mesh, geo, iA, iB, mat, u, P, order, cmp,
      reset(cl) { P.n = 0; P.svI = 0; P.sv.fill(0.7); P.vx.fill(0); P.vz.fill(0); P.am.fill(1); P.sat.fill(0); geo.instanceCount = 0; mesh.visible = true; u.uFade.value = 1; u.uGlow.value.w = 0; },
      onCell(cl, i, j, k, p, parentIdx) {
        const b = (i >> 1) + NB * ((j >> 1) + NB * (k >> 1)); let pi = cl.A.blockPuff[b];
        if (pi < 0) {
          if (P.n >= CAP - 64) return; pi = P.n++; cl.A.blockPuff[b] = pi;
          P.cnt[pi] = 0; P.sx[pi] = P.sy[pi] = P.sz[pi] = 0; P.t0[pi] = cl.age; P.seed[pi] = hash1(pi * 3.1 + cl.id * 17.7); P.core[pi] = 0.3; P.die[pi] = 1e9; P.sat[pi] = 0; P.vx[pi] = P.vz[pi] = 0; P.am[pi] = 1;
          if (parentIdx >= 0) cl.cellPos(parentIdx, _v2); else _v2.copy(p);
          P.px[pi] = _v2.x; P.py[pi] = _v2.y; P.pz[pi] = _v2.z; P.ox[pi] = P.oy[pi] = P.oz[pi] = P.tox[pi] = P.toy[pi] = P.toz[pi] = 0;
        }
        P.cnt[pi]++; P.sx[pi] += p.x; P.sy[pi] += p.y; P.sz[pi] += p.z;
        const c = P.cnt[pi]; P.tx[pi] = P.sx[pi] / c; P.ty[pi] = P.sy[pi] / c; P.tz[pi] = P.sz[pi] / c; P.rad[pi] = 0.62 + 0.6 * Math.sqrt(c / 8);
      },
      finalize(cl) {
        const A = cl.A; const base = P.n;
        // core estimate from neighbouring blocks, wall push, dissolve time, surface satellites
        for (let pi = 0; pi < base; pi++) {
          // find block coords from centroid
          const bi = Math.floor((P.tx[pi] - cl.ox) / VS / 2), bj = Math.floor((P.ty[pi] - cl.oy) / VS / 2), bk = Math.floor((P.tz[pi] - cl.oz) / VS / 2);
          let tot = 0, gx = 0, gy = 0, gz = 0;
          for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            if (!di && !dj && !dk) continue; const x = bi + di, y = bj + dj, z = bk + dk; if (x < 0 || y < 0 || z < 0 || x >= NB || y >= NB || z >= NB) continue;
            const q = A.blockPuff[x + NB * (y + NB * z)]; if (q < 0) continue; tot += P.cnt[q]; gx -= di * P.cnt[q]; gy -= dj * P.cnt[q]; gz -= dk * P.cnt[q];
          }
          const core = sstep(80, 190, tot + P.cnt[pi]); P.core[pi] = core;
          P.die[pi] = H.fadeStart - 0.6 + core * 2.6 + hash1(pi * 7.7 + cl.id) * 1.0;
          // wall avoidance
          _v.set(P.tx[pi], P.ty[pi], P.tz[pi]); const r = P.rad[pi]; const c = W.closest(_v, r * 0.62);
          if (c) { const d = c.distance; _v2.subVectors(_v, c.point); const l = _v2.length(); if (l > 1e-4) { _v2.multiplyScalar((r * 0.62 - d) / l); P.tox[pi] = _v2.x; P.toy[pi] = _v2.y; P.toz[pi] = _v2.z; } }
          // satellite billows on the shell (skip near walls)
          for (let sat = 0; sat < 3; sat++) if (core < 0.85 && P.n < CAP - 2 && !c) {
            const gl = Math.hypot(gx, gy, gz); if (gl < 1e-3) break;
            const s = P.n++; const jt = hash1(pi * 5.3 + 1.7 + sat * 9.1);
            P.cnt[s] = 0; P.rad[s] = 0.32 + 0.5 * jt; P.t0[s] = cl.age + jt * 0.25; P.seed[s] = hash1(s * 3.1 + cl.id * 17.7); P.core[s] = core * 0.5; P.sat[s] = 1; P.vx[s] = P.vz[s] = 0; P.am[s] = 1;
            const off = 0.25 + 0.3 * hash1(pi * 2.9 + sat);
            P.tx[s] = P.px[s] = P.tx[pi] + gx / gl * off + (hash1(pi + 11 + sat * 3) - 0.5) * 0.9; P.ty[s] = P.py[s] = P.ty[pi] + gy / gl * off + (hash1(pi + 23 + sat * 3) - 0.5) * 0.7; P.tz[s] = P.pz[s] = P.tz[pi] + gz / gl * off + (hash1(pi + 37 + sat * 3) - 0.5) * 0.9;
            P.ox[s] = P.oy[s] = P.oz[s] = P.tox[s] = P.toy[s] = P.toz[s] = 0; P.die[s] = P.die[pi] - 0.5 - jt * 0.4;
            _v.set(P.tx[s], P.ty[s], P.tz[s]); const c2 = W.closest(_v, P.rad[s] * 0.7); if (c2) P.rad[s] *= 0.6;
          }
        }
      },
      skirtPass(cl) {   // low ground-hugging wisps that creep outward along the floor
        const A = cl.A; let made = 0;
        for (let n = 0; n < cl.count && made < 110 && P.n < CAP - 1; n++) {
          const idx = A.filled[n], i = idx % N, j = ((idx / N) | 0) % N, k = (idx / NN) | 0; if (j !== K_BELOW) continue;
          if (hash1(idx * 1.37 + cl.id) > 0.75) continue;
          let ox = 0, oz = 0;
          for (let d = 0; d < 6; d++) { if (DIRS[d][1] !== 0) continue; if (A.state[(i + DIRS[d][0]) + N * (j + N * (k + DIRS[d][2]))] !== 2) { ox += DIRS[d][0]; oz += DIRS[d][2]; } }
          const l = Math.hypot(ox, oz); if (l < 0.5) continue; ox /= l; oz /= l;
          cl.cellPos(idx, _v); _v.x += ox * 0.45; _v.z += oz * 0.45; _v.y = cl.floorY + 0.28 + hash1(idx * 3.3) * 0.2;
          if (W.closest(_v, 0.45)) continue;
          const s = P.n++; const jt = hash1(idx * 7.1 + 3);
          P.cnt[s] = 0; P.rad[s] = 0.6 + 0.5 * jt; P.t0[s] = cl.age + jt * 0.3; P.seed[s] = hash1(s * 3.1 + cl.id * 17.7); P.core[s] = 0; P.sat[s] = 2; P.am[s] = 0.6;
          P.tx[s] = P.px[s] = _v.x; P.ty[s] = P.py[s] = _v.y; P.tz[s] = P.pz[s] = _v.z; P.ox[s] = P.oy[s] = P.oz[s] = P.tox[s] = P.toy[s] = P.toz[s] = 0;
          const sp = 0.1 + 0.22 * hash1(idx * 5.9); P.vx[s] = ox * sp; P.vz[s] = oz * sp; P.die[s] = H.fadeStart - 1.0 + hash1(idx) * 1.0; made++;
        }
      },
      update(cl, dt, time, cam) {
        const age = cl.age, n = P.n, k = 1 - Math.exp(-7 * dt), ko = 1 - Math.exp(-3 * dt);
        if (cl.finalized && P.svI < n) {            // sun visibility from map geometry (soft: 3 jittered rays), spread over frames
          const L = shared.sunDir.value; let q = 0;
          while (q++ < 70 && P.svI < n) {
            const i = P.svI++; let vis = 0;
            for (let r = 0; r < 3; r++) {
              const a = P.seed[i] * 40 + r * 2.1; _o.set(P.tx[i] + P.ox[i] + Math.cos(a) * 0.45 * (r > 0), P.ty[i] + P.oy[i] + 0.15 + (r > 0) * 0.3, P.tz[i] + P.oz[i] + Math.sin(a) * 0.45 * (r > 0));
              if (!W.raycast(_o, L, 60, null)) vis += 1 / 3;
            }
            P.sv[i] = vis;
          }
        }
        camDirSet(cam);
        let cnt = 0, gmax = 0;
        for (let i = 0; i < n; i++) {
          if (P.sat[i] === 2 && age < 6) { P.tx[i] += P.vx[i] * dt; P.tz[i] += P.vz[i] * dt; }
          P.px[i] += (P.tx[i] - P.px[i]) * k; P.py[i] += (P.ty[i] - P.py[i]) * k; P.pz[i] += (P.tz[i] - P.pz[i]) * k;
          P.ox[i] += (P.tox[i] - P.ox[i]) * ko; P.oy[i] += (P.toy[i] - P.oy[i]) * ko; P.oz[i] += (P.toz[i] - P.oz[i]) * ko;
          const ta = age - P.t0[i]; if (ta < 0) continue;
          const g = 1 - Math.pow(1 - Math.min(1, ta / 0.55), 3);
          const fade = 1 - sstep(P.die[i], P.die[i] + 2.4, age); if (fade <= 0.002 || g <= 0.01) continue;
          const sd = P.seed[i], wob = 1 + 0.045 * Math.sin(age * 0.8 + sd * 40) ;
          const rise = age > P.die[i] ? (age - P.die[i]) * 0.12 : 0;
          let bx = P.px[i] + P.ox[i], bz = P.pz[i] + P.oz[i];
          if (P.sat[i] !== 2) { const ang = Math.sin(age * 0.23 + sd * 11) * 0.14 * (1 - 0.5 * P.core[i]), ca = Math.cos(ang), sa = Math.sin(ang), rx = bx - cl.centre.x, rz = bz - cl.centre.z; bx = cl.centre.x + rx * ca - rz * sa; bz = cl.centre.z + rx * sa + rz * ca; }
          const x = bx + Math.sin(age * 0.45 + sd * 30) * 0.2, y = P.py[i] + P.oy[i] + rise + Math.sin(age * 0.37 + sd * 50) * 0.14, z = bz + Math.cos(age * 0.41 + sd * 20) * 0.2;
          const R = P.rad[i] * g * wob * (0.8 + 0.2 * fade);
          const j = cnt++; P.key[j] = (x - camPos.x) * camDir.x + (y - camPos.y) * camDir.y + (z - camPos.z) * camDir.z;
          // stash into scratch slots of the sorted buffers (unsorted first)
          scratch[j * 8] = x; scratch[j * 8 + 1] = y; scratch[j * 8 + 2] = z; scratch[j * 8 + 3] = R;
          scratch[j * 8 + 4] = sd; scratch[j * 8 + 5] = P.core[i]; scratch[j * 8 + 6] = Math.min(1, g * 2.5) * fade * P.am[i]; scratch[j * 8 + 7] = P.sv[i];
          if (R > gmax) gmax = R;
        }
        for (let j = 0; j < cnt; j++) order[j] = j;
        order.subarray(0, cnt).sort(cmp);
        const a = iA.array, b = iB.array;
        for (let q = 0; q < cnt; q++) { const s = order[q] * 8, o = q * 4; a[o] = scratch[s]; a[o + 1] = scratch[s + 1]; a[o + 2] = scratch[s + 2]; a[o + 3] = scratch[s + 3]; b[o] = scratch[s + 4]; b[o + 1] = scratch[s + 5]; b[o + 2] = scratch[s + 6]; b[o + 3] = scratch[s + 7]; }
        iA.needsUpdate = iB.needsUpdate = true; geo.instanceCount = cnt; mesh.visible = cnt > 0;
        // uniforms
        u.uTime.value = time + cl.id * 7.3; u.uFloorY.value = cl.floorY; u.uCenter.value.copy(cl.centre); u.uCloudR.value = Math.max(1.5, cl.radius);
        u.uCamPos.value.copy(camPos);
        const wa = u.uWA.value, wb = u.uWB.value, wc = u.uWC.value; let wi = 0;
        for (let q = 0; q < cl.wakes.length && wi < 8; q++) {
          const w = cl.wakes[q]; if (w.visualOnly && false) continue; const amt = w.strength * w.amt(cl.age); if (amt <= 0.001) continue;
          wa[wi].set(w.ox, w.oy, w.oz, w.len); wb[wi].set(w.dx, w.dy, w.dz, w.ph); wc[wi].set(w.radius(cl.age), amt); wi++;
        }
        u.uWN.value = wi;
        // glow (flash/pulse lighting the cloud)
        const gl = shared.glow; if (gl.w > 0.001) { u.uGlowPos.value.copy(gl.pos); u.uGlow.value.set(gl.r * gl.w, gl.g * gl.w, gl.b * gl.w, 7); } else u.uGlow.value.w = 0;
      },
    };
  }
  const scratch = new Float32Array(CAP * 8);
  function camDirSet(cam) { if (!cam) return; cam.getWorldPosition(camPos); cam.getWorldDirection(camDir); }

  function acquire() {
    const arrays = freeArrays.pop() || pooledArrays(); const gfx = freeGfx.pop() || makeGfx();
    const cl = new Cloud(sysRef, arrays, gfx); return cl;
  }
  const sysRef = { W };
  const sys = {
    list,
    spawn(pos, thrower) {
      if (list.length >= 8) { const old = list.shift(); release(old); }   // hard cap
      const cl = acquire(); cl.init(pos, thrower, nextId++); list.push(cl);
      const sc = ctx.render?.scene; if (sc) sc.add(cl.gfx.mesh);
      return cl;
    },
    fixedUpdate(dt) {
      for (let i = list.length - 1; i >= 0; i--) { const cl = list[i]; cl.step(dt); if (cl.gone) { list.splice(i, 1); release(cl); } }
    },
    update(dt, time, cam) {
      if (!list.length && !overlay.visible) return;
      camDirSet(cam);
      for (const cl of list) cl.gfx.update(cl, dt, time, cam);
      // camera inside smoke -> murk overlay (near-opaque grey), depth-independent
      let dens = 0;
      if (list.length) for (const cl of list) if (cl.touchesSegment(camPos, camPos)) { dens = Math.max(dens, cl.density(camPos.x, camPos.y, camPos.z), 0.6 * cl.density(camPos.x + camDir.x * 0.5, camPos.y + camDir.y * 0.5, camPos.z + camDir.z * 0.5)); }
      const amt = sstep(0.12, 0.85, dens) * 0.965;
      if (amt > 0.002) {
        if (!overlayAdded) { ctx.render?.scene?.add(overlay); overlayAdded = true; }
        overlay.visible = true; overlay.material.uniforms.uAlpha.value = amt;
        overlay.material.uniforms.uCol.value.setRGB(0.52, 0.54, 0.58).multiplyScalar(0.55 + 0.45 * Math.min(1, shared.sunCol.value.g));
      } else overlay.visible = false;
      shared.overlayAmount = amt;
    },
    /** optical depth (metres of full-density smoke) along a->b */
    opticalDepth(a, b) {
      if (!list.length) return 0;
      _v.subVectors(b, a); const len = _v.length(); if (len < 1e-4) return 0;
      let tot = 0; const step = 0.3;
      for (const cl of list) {
        if (!cl.touchesSegment(a, b)) continue;
        // clip to cloud bounding sphere
        _v2.subVectors(cl.seed, a); const inv = 1 / len; const ux = _v.x * inv, uy = _v.y * inv, uz = _v.z * inv;
        const tc = _v2.x * ux + _v2.y * uy + _v2.z * uz; const r = cl.extent + 0.5; const cx = _v2.x - ux * tc, cy = _v2.y - uy * tc, cz = _v2.z - uz * tc; const h2 = r * r - (cx * cx + cy * cy + cz * cz); if (h2 <= 0) continue;
        const hh = Math.sqrt(h2); const t0 = Math.max(0, tc - hh), t1 = Math.min(len, tc + hh); if (t1 <= t0) continue;
        const n = Math.max(1, Math.ceil((t1 - t0) / step)), ds = (t1 - t0) / n;
        for (let s = 0; s < n; s++) { const t = t0 + (s + 0.5) * ds; tot += cl.density(a.x + ux * t, a.y + uy * t, a.z + uz * t) * ds; }
      }
      return tot;
    },
    blocksLine(a, b) { return sys.opticalDepth(a, b) >= H.blockDepth; },
    /** carve wakes for a bullet ray through every cloud it crosses; returns number of clouds hit */
    punch(o, d, len, radius = 0.3, strength = 0.95, life = 1.9) {
      let n = 0; if (!list.length) return 0;
      _v.copy(o).addScaledVector(d, len);
      for (const cl of list) { if (!cl.touchesSegment(o, _v)) continue; cl.addWake(o, d, len, radius, strength, life); n++; }
      return n;
    },
    /** big dispersal (explosions): spherical hole that refills */
    disturb(pos, radius, strength = 1, life = 3.2) {
      let n = 0; for (const cl of list) { _v.subVectors(cl.seed, pos); if (_v.length() > cl.extent + radius) continue; _d.set(0, 1, 0); cl.addWake(pos, _d, 0.01, radius, strength, life); n++; } return n;
    },
    clear() { while (list.length) release(list.pop()); overlay.visible = false; shared.overlayAmount = 0; },
    dispose() { sys.clear(); overlay.parent?.remove(overlay); },
    overlay,
  };
  function release(cl) {
    cl.active = false; cl.gfx.mesh.parent?.remove(cl.gfx.mesh); cl.gfx.mesh.visible = false;
    freeArrays.push(cl.A); freeGfx.push(cl.gfx);
  }
  return sys;
}
export { Cloud, N as GRID_N, VS };
