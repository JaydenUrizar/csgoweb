// NavSystem: everything except the game glue. Pure (three + three-mesh-bvh), so tools/nav_validate.mjs can run it in Node.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { NAV_DEFAULTS, LINK_JUMP } from './config.js';
import { buildGraphGen } from './graph.js';
import { computeALT } from './alt.js';
import { Searcher, loadChain, chainCopy, chainRestore, extractPath, scratch } from './search.js';
import { buildRegionsGen } from './regions.js';
import { Tactics } from './tactics.js';
import { mulberry32 } from '../../core/rng.js';

const _v = new THREE.Vector3();

export class NavSystem {
  /** map: {collider, bounds, spawns, sites, callouts}. hooks: {blocksLine(a,b)} (getter-style, may change at runtime). */
  constructor(map, { options = {}, hooks = {}, seed = 1 } = {}) {
    this.map = map; this.options = options; this.hooks = hooks; this.seed = seed;
    this.rng = mulberry32(seed * 7919 + 17); this.g = null; this.ready = false; this.bvh = null;
    this.cfg = { ...NAV_DEFAULTS, ...options };
    this.tactics = new Tactics(this);
    this.jobs = []; this.cache = new Map(); this.dangers = new Map(); this.dangerActive = new Map(); this.dangerClock = 0;
    this.buildCount = 0; this.pathStats = { queries: 0, us: 0, fails: 0, cacheHits: 0, expanded: 0 };
    this.routeTimes = null; this.version = 0; this._mapSig = ''; this.building = null; this.bg = null; this.progress = 0; this._buildSig = '';
  }

  // ---------------------------------------------------------------------------------------------------- build
  static signature(map) {
    const c = map?.collider, g = c?.geometry; if (!g) return '';
    const p = g.attributes?.position; const b = map.bounds;
    return `${g.uuid}:${p?.count}:${p?.version}:${b ? [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map((v) => v.toFixed(2)).join(',') : ''}`;
  }
  /** Generator that builds a complete nav dataset for the current map and commits it at the end (old data stays live until then). */
  *_buildGen(budgetMs) {
    const map = this.map; const t0 = performance.now();
    const pts = [];
    for (const t of ['ember', 'tide']) for (const s of (map.spawns?.[t] || [])) { const p = s.pos || s; if (p) pts.push(p); }
    for (const k of Object.keys(map.sites || {})) { const c = map.sites[k]?.center; if (c) pts.push(c); }
    const sig = NavSystem.signature(map);
    const gg = buildGraphGen(map.collider, map.bounds, this.options, { points: pts }, budgetMs); let r;
    while (!(r = gg.next()).done) { this.progress = 0.7 * r.value; yield this.progress; }
    const g = r.value; let t = performance.now();
    const rg = buildRegionsGen(g, map.callouts, g.cfg, budgetMs); while (!(r = rg.next()).done) { this.progress = 0.72; yield this.progress; } g.stats.regionMs = performance.now() - t; g.stats.areas = g.areas.length; this.progress = 0.75; yield 0.75;
    t = performance.now(); const sg = Tactics.buildSpotsGen(g, 1.6, () => performance.now() - t >= budgetMs); while (!(r = sg.next()).done) { yield 0.76; t = performance.now(); } g.spots = r.value; g.stats.spots = g.spots.n; g.stats.spotMs = performance.now() - t; yield 0.78;
    t = performance.now(); const ag = computeALT(g);
    while (!(r = ag.next()).done) { this.progress = 0.78 + 0.2 * r.value; yield this.progress; }
    g.stats.altMs = performance.now() - t; g.stats.buildMs += g.stats.regionMs + g.stats.spotMs + g.stats.altMs; g.stats.buildWallMs = performance.now() - t0;
    // commit
    this.g = g; this.cfg = g.cfg; this.bvh = g.bvh; this.sync = new Searcher(g); this.async = new Searcher(g);
    for (const j of this.jobs) j.state = 0;
    this.cache.clear(); this.dangers.clear(); this.dangerActive.clear(); this.tactics.holdCache.clear(); this.routeTimes = null;
    this.ready = g.N > 0; this.buildCount++; this.version++; this._mapSig = sig; this.progress = 1; this.building = null;
    this.bg = this.ready ? this.tactics.precomputeProfiles(160) : null;
    return g.stats;
  }
  /** Synchronous (re)generation of the navgrid from map.collider + map.bounds. Returns stats. */
  build(options) {
    const map = this.map; if (!map?.collider?.geometry || !map.bounds) { this.ready = false; return null; }
    if (options) this.options = { ...this.options, ...options };
    this.cfg = { ...NAV_DEFAULTS, ...this.options }; this.building = null;
    const it = this._buildGen(Infinity); let r; while (!(r = it.next()).done);
    this.bg = null; return r.value;
  }
  /** Start a time-sliced rebuild (old data stays usable). Drive it with step(ms) or pump via nav.update. */
  startBuild(options, budgetMs = 3) {
    const map = this.map; if (!map?.collider?.geometry || !map.bounds) return false;
    if (options) this.options = { ...this.options, ...options };
    this.progress = 0; this.building = this._buildGen(budgetMs); this._buildSig = NavSystem.signature(map); return true;
  }
  /** Advance background work by one slice (a build slice, else profile precompute). Returns true while work remains. */
  step() {
    if (this.building) { const r = this.building.next(); if (r.done) this.building = null; return true; }
    if (this.bg) { const r = this.bg.next(); if (r.done) this.bg = null; return !!this.bg; }
    return false;
  }
  mapChanged() { return NavSystem.signature(this.map) !== this._mapSig; }

  // ---------------------------------------------------------------------------------------------------- lookups
  nearestNode(pos, maxR = 4) { return this.ready ? this.g.nearest(pos.x, pos.y, pos.z, maxR) : -1; }
  nodePos(n, out = new THREE.Vector3()) { return this.g.nodePos(n, out); }
  /** Snap a world point onto the navgrid (feet position). null if off-mesh. */
  snap(pos, out = new THREE.Vector3(), maxR = 4) { const n = this.nearestNode(pos, maxR); return n < 0 ? null : this.g.nodePos(n, out); }
  isWalkable(pos) { const n = this.nearestNode(pos, 0.45); return n >= 0 && Math.abs(this.g.py[n] - pos.y) < 0.8; }
  groundY(pos) { const y = this.g.groundAt(pos.x, pos.z, pos.y); return y === y ? y : null; }
  areaIndexAt(pos) { const n = this.nearestNode(pos, 6); return n < 0 ? -1 : this.g.region[n]; }
  areaAt(pos) { const i = this.areaIndexAt(pos); return i < 0 ? null : this.g.areas[i].name; }
  areaInfo(i) { return this.g.areas[i] || null; }

  // ---------------------------------------------------------------------------------------------------- paths
  _prep(from, to, o) {
    const g = this.g, maxSnap = o?.maxSnap ?? 4;
    const s = g.nearest(from.x, from.y, from.z, maxSnap), e = g.nearest(to.x, to.y, to.z, maxSnap);
    return s < 0 || e < 0 ? null : [s, e];
  }
  _dangerArr(o) { return o?.danger > 0 ? this.dangerFor(o.team || 'any') : null; }
  /** Core: run/finish search (sync). Returns chain length or 0. */
  _searchSync(s, e, o) {
    const dangerArr = this._dangerArr(o), useCache = !dangerArr && !o?.noCache;
    const key = s * 1048576 + e;
    if (useCache) { const c = this.cache.get(key); if (c) { this.cache.delete(key); this.cache.set(key, c); this.pathStats.cacheHits++; return chainRestore(c); } }
    const S = this.sync; S.begin(s, e, o?.weight ?? this.cfg.weight, dangerArr, o?.danger || 0); S.step(1e9);
    this.pathStats.expanded += S.expanded;
    if (!S.found) return 0;
    const n = loadChain(S);
    if (useCache) { this.cache.set(key, chainCopy(n)); if (this.cache.size > this.cfg.cacheSize) this.cache.delete(this.cache.keys().next().value); }
    return n;
  }
  _emit(n, from, to, o, out) {
    const cnt = extractPath(this.g, n, from.x, from.y, from.z, to.x, to.y, to.z, o?.smooth ?? this.cfg.smoothing);
    const X = scratch.x, Y = scratch.y, Z = scratch.z, F = scratch.f;
    const arr = out || []; const old = out ? out.slice() : null; arr.length = 0; const flags = arr.flags = [];
    let dist = 0, jumps = 0, px = from.x, py = from.y, pz = from.z;
    for (let i = 0; i < cnt; i++) {
      arr.push(old && old[i] ? old[i].set(X[i], Y[i], Z[i]) : new THREE.Vector3(X[i], Y[i], Z[i])); flags.push(F[i]); if (F[i] === LINK_JUMP) jumps++;
      dist += Math.hypot(X[i] - px, Y[i] - py, Z[i] - pz); px = X[i]; py = Y[i]; pz = Z[i];
    }
    arr.dist = dist; arr.jumps = jumps; arr.cost = 0;
    return arr;
  }
  /** Synchronous path. Returns Vector3[] (start excluded, last = goal) with .flags[] (0 walk, 1 jump, 2 drop arriving at that point), .dist, .jumps; null if unreachable. */
  path(from, to, o) {
    if (!this.ready) return null;
    const t0 = performance.now(); this.pathStats.queries++;
    const sn = this._prep(from, to, o);
    let res = null;
    if (sn) { const n = this._searchSync(sn[0], sn[1], o); if (n) res = this._emit(n, from, to, o, o?.out); }
    this.pathStats.us += (performance.now() - t0) * 1000; if (!res) this.pathStats.fails++;
    return res;
  }
  /** Time-sliced path. cb(pathOrNull) fires from update() when done (FIFO, deterministic expansion budget). Returns {cancel()}. */
  requestPath(from, to, cb, o) {
    const job = { from: from.clone ? from.clone() : { ...from }, to: to.clone ? to.clone() : { ...to }, cb, o, state: 0, s: -1, e: -1, cancelled: false, cancel() { this.cancelled = true; } };
    this.jobs.push(job); return job;
  }
  /** Run queued jobs for up to `budget` node expansions total. */
  pump(budget = this.cfg.sliceExpansions) {
    while (budget > 0 && this.jobs.length) {
      const job = this.jobs[0];
      if (job.cancelled) { this.jobs.shift(); continue; }
      if (!this.ready) { this.jobs.shift(); job.cb?.(null); continue; }
      if (job.state === 0) {
        const sn = this._prep(job.from, job.to, job.o);
        if (!sn) { this.jobs.shift(); this.pathStats.fails++; job.cb?.(null); continue; }
        job.s = sn[0]; job.e = sn[1];
        const dangerArr = this._dangerArr(job.o), key = job.s * 1048576 + job.e;
        if (!dangerArr && this.cache.has(key)) { const n = chainRestore(this.cache.get(key)); this.jobs.shift(); this.pathStats.cacheHits++; job.cb?.(this._emit(n, job.from, job.to, job.o, null)); budget -= 50; continue; }
        this.async.begin(job.s, job.e, job.o?.weight ?? this.cfg.weight, dangerArr, job.o?.danger || 0); job.state = 1;
      }
      const A = this.async, before = A.expanded;
      const fin = A.step(Math.min(budget, 1e9)); budget -= Math.max(1, A.expanded - before);
      if (fin) {
        this.jobs.shift(); this.pathStats.expanded += A.expanded; this.pathStats.queries++;
        if (!A.found) { this.pathStats.fails++; job.cb?.(null); continue; }
        const n = loadChain(A); if (!this._dangerArr(job.o)) { this.cache.set(job.s * 1048576 + job.e, chainCopy(n)); if (this.cache.size > this.cfg.cacheSize) this.cache.delete(this.cache.keys().next().value); }
        job.cb?.(this._emit(n, job.from, job.to, job.o, null));
      }
    }
  }
  /** Walking distance/time helpers. */
  pathLength(from, to, o) { const p = this.path(from, to, o); return p ? p.dist : Infinity; }
  eta(from, to, speed = this.cfg.runSpeed, o) { const p = this.path(from, to, o); return p ? p.dist / speed + p.jumps * this.cfg.jumpPenalty : Infinity; }

  /** Route times spawn -> each site for both teams: {A:{ember:{time,dist,jumps},tide:{…}},B:{…}}. Cached until rebuild. */
  sitesToSpawnRouteTimes(speed = this.cfg.runSpeed) {
    if (this.routeTimes && this.routeTimes.speed === speed) return this.routeTimes;
    const res = { speed }, map = this.map;
    for (const site of Object.keys(map.sites || {})) {
      const c = map.sites[site]?.center; if (!c) continue; res[site] = {};
      for (const team of ['ember', 'tide']) {
        const spawns = (map.spawns?.[team] || []).map((s) => s.pos || s); let tsum = 0, dsum = 0, cnt = 0, min = Infinity, jumps = 0;
        for (const sp of spawns) { const p = this.path(sp, c, { noCache: false }); if (!p) continue; const t = p.dist / speed + p.jumps * this.cfg.jumpPenalty; tsum += t; dsum += p.dist; cnt++; jumps += p.jumps; if (t < min) min = t; }
        res[site][team] = cnt ? { time: tsum / cnt, min, dist: dsum / cnt, jumps: jumps / cnt, spawns: cnt } : null;
      }
      const e = res[site].ember, t = res[site].tide; res[site].delta = e && t ? e.time - t.time : null;   // >0: tide arrives first
    }
    this.routeTimes = res; return res;
  }

  // ---------------------------------------------------------------------------------------------------- danger heat
  dangerFor(team) { let a = this.dangers.get(team); if (!a) { a = new Float32Array(this.g.N); this.dangers.set(team, a); this.dangerActive.set(team, new Set()); } return a; }
  /**
   * Add danger heat around a point (radial falloff, same level band; los=true limits to nodes the point can see).
   * amount is in "path cost multiplier" units: 1 = doubles the cost of travelling there when path opts.danger = 1.
   */
  addDanger(pos, amount = 1, radius = 6, team = 'any', o) {
    if (!this.ready) return; const arr = this.dangerFor(team), act = this.dangerActive.get(team), g = this.g;
    this.tactics.eachNear(pos.x, pos.y, pos.z, radius, o?.dy ?? 2.6, (n, d) => {
      if (o?.los && this.tactics.blocked(pos.x, pos.y + this.cfg.eye, pos.z, g.px[n], g.py[n] + 1.2, g.pz[n])) return;
      const v = amount * (1 - d / radius); if (v <= 0) return; if (arr[n] < v) arr[n] = v; else arr[n] += v * 0.15; if (arr[n] > 8) arr[n] = 8; act.add(n);
    }, o?.los ? 2 : 1);
  }
  dangerAt(pos, team = 'any') { const a = this.dangers.get(team); if (!a) return 0; const n = this.nearestNode(pos, 2); return n < 0 ? 0 : a[n]; }
  /** Exponential decay; halfLife seconds (default 12). Cheap: only touched nodes. */
  decayDanger(dt, halfLife = 12) {
    if (!this.dangers.size) return; const k = Math.pow(0.5, dt / halfLife);
    for (const [team, arr] of this.dangers) { const act = this.dangerActive.get(team); for (const n of act) { arr[n] *= k; if (arr[n] < 0.02) { arr[n] = 0; act.delete(n); } } }
  }
  clearDanger(team) { if (team) { this.dangers.get(team)?.fill(0); this.dangerActive.get(team)?.clear(); } else { for (const a of this.dangers.values()) a.fill(0); for (const s of this.dangerActive.values()) s.clear(); } }
  /** Coolest of several candidate positions (bots choosing where to go). */
  leastDangerous(list, team = 'any') { let best = null, bd = Infinity; for (const p of list) { const d = this.dangerAt(p, team); if (d < bd) { bd = d; best = p; } } return best; }

  // ---------------------------------------------------------------------------------------------------- stats
  /** Headline numbers: {nodes, links, buildMs, avgPathUs, failRate, …}. Runs a seeded random-pair benchmark of n pairs. */
  statsReport(n = 200) {
    if (!this.ready) return { ready: false };
    const s = this.g.stats, b = this.benchmark(n);
    return { ready: true, nodes: s.nodes, walkEdges: s.walkEdges, jumpLinks: s.jumpLinks, dropLinks: s.dropLinks, areas: s.areas, components: s.components, prunedNodes: s.rawNodes - s.nodes, grid: s.grid, cell: s.cell,
      buildMs: +s.buildMs.toFixed(1), avgPathUs: +b.avgUs.toFixed(1), p95PathUs: +b.p95Us.toFixed(1), failRate: b.failRate, pairs: b.pairs, avgLen: +b.avgLen.toFixed(1), build: s };
  }
  /** Path benchmark over N seeded random pairs: {pairs, failRate, avgUs, p95Us, maxUs, avgLen, avgPts}. */
  benchmark(pairs = 200, seed = 99) {
    const r = mulberry32(seed), g = this.g, a = new THREE.Vector3(), b = new THREE.Vector3(), times = []; let fail = 0, len = 0, pts = 0, ok = 0, exp = 0;
    const saveCache = this.cache; this.cache = new Map();
    for (let i = 0; i < pairs; i++) {
      const n1 = Math.floor(r() * g.N), n2 = Math.floor(r() * g.N); g.nodePos(n1, a); g.nodePos(n2, b);
      const t0 = performance.now(); const p = this.path(a, b, { noCache: true }); times.push((performance.now() - t0) * 1000);
      if (!p) fail++; else { ok++; len += p.dist; pts += p.length; }
    }
    this.cache = saveCache; times.sort((x, y) => x - y);
    const avg = times.reduce((s, x) => s + x, 0) / Math.max(1, times.length);
    return { pairs, failRate: fail / pairs, avgUs: avg, p50Us: times[times.length >> 1] || 0, p95Us: times[Math.floor(times.length * 0.95)] || 0, maxUs: times[times.length - 1] || 0, avgLen: ok ? len / ok : 0, avgPts: ok ? pts / ok : 0 };
  }
}
