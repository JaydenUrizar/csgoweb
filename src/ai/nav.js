// ctx.nav — automatic navigation for bots. Everything is generated from ctx.map.collider + ctx.map.bounds (map-agnostic) and
// regenerated when the map changes. See docs/pieces/nav.md. Core logic lives in ./nav/*.js (pure, runs in Node too).
import * as THREE from 'three';
import { NavSystem } from './nav/system.js';
import { createDebug } from './nav/debug.js';

const MAP_EVENTS = ['map:ready', 'map:built', 'map:change', 'map:changed', 'map:rebuilt', 'map:loaded'];

export function create(ctx) {
  const sys = new NavSystem(ctx.map || {}, {
    seed: +(ctx.params?.get('seed') || 1),
    hooks: { get blocksLine() { const u = ctx.combat?.utility; return u?.blocksLine ? (a, b) => u.blocksLine(a, b) : null; } },
  });
  let override = null, dirty = true, tick = 0, failedSig = '';
  const P = (p) => (p && p.pos && p.x === undefined ? p.pos : p);          // accept actors or vectors
  const T = sys.tactics;

  function ensure(force) {
    sys.map = override || ctx.map;
    if (!sys.map?.collider?.geometry || !sys.map.bounds) return false;
    const sig = NavSystem.signature(sys.map);
    if (!force && sys.ready && !dirty && sig === sys._mapSig) return true;
    if (!force && sig === failedSig) return false;
    try { sys.build(); dirty = false; failedSig = ''; dbg.on && dbg.refresh(); ctx.events?.emit('nav:ready', { nodes: sys.g.N }); }
    catch (e) { failedSig = sig; console.error('[nav] build failed', e); ctx.errors?.push('nav build: ' + (e?.stack || e)); sys.ready = false; return false; }
    return sys.ready;
  }
  for (const ev of MAP_EVENTS) ctx.events?.on?.(ev, () => { dirty = true; });
  ctx.events?.on?.('boot:done', () => { ensure(); });

  const danger = {
    /** add heat around pos (radius m); team keys the map ('ember'|'tide'|'any'). o.los limits to nodes visible from pos. */
    add: (pos, amount = 1, radius = 6, team = 'any', o) => sys.addDanger(P(pos), amount, radius, team, o),
    at: (pos, team = 'any') => sys.dangerAt(P(pos), team),
    decay: (dt, halfLife) => sys.decayDanger(dt, halfLife),
    clear: (team) => sys.clearDanger(team),
    leastDangerous: (list, team) => sys.leastDangerous(list.map(P), team),
  };

  const api = {
    get ready() { return sys.ready; },
    get system() { return sys; },
    get config() { return sys.cfg; },
    get graph() { return sys.g; },
    /** Regenerate the navgrid now (optionally with new options, e.g. {cell:0.6}). */
    rebuild(options) { if (options) sys.options = { ...sys.options, ...options }; return ensure(true) ? sys.g.stats : null; },
    /** Use a custom map-like object {collider,bounds,spawns,sites,callouts} instead of ctx.map (debug/tests); null restores. */
    useMap(m) { override = m || null; return ensure(true); },
    // ---- paths
    /** Smoothed capsule-safe path. Vector3[] (start excluded, last = goal) with .flags[] (0 walk,1 jump,2 drop arriving at point), .dist, .jumps; null if unreachable. opts {danger:w, team, weight, smooth, maxSnap, noCache}. */
    path: (from, to, o) => (sys.ready || ensure() ? sys.path(P(from), P(to), o) : null),
    /** Time-sliced path; cb(path|null) is invoked from a later fixed update. Returns {cancel()}. */
    requestPath: (from, to, cb, o) => sys.requestPath(P(from), P(to), cb, o),
    pathLength: (a, b, o) => sys.pathLength(P(a), P(b), o),
    eta: (a, b, speed, o) => sys.eta(P(a), P(b), speed, o),
    sitesToSpawnRouteTimes: (speed) => sys.sitesToSpawnRouteTimes(speed),
    // ---- lookups
    nearestNode: (p, maxR) => sys.nearestNode(P(p), maxR),
    nodePos: (n, out) => sys.nodePos(n, out),
    snap: (p, out, maxR) => sys.snap(P(p), out, maxR),
    isWalkable: (p) => sys.isWalkable(P(p)),
    groundY: (p) => sys.groundY(P(p)),
    /** Callout/area name for a position (map callouts, auto "<Callout> NE" zones elsewhere). */
    areaAt: (p) => (sys.ready ? sys.areaAt(P(p)) : null),
    areaIndexAt: (p) => (sys.ready ? sys.areaIndexAt(P(p)) : -1),
    areas: () => (sys.ready ? sys.g.areas : []),
    // ---- tactics
    /** Eye-to-eye LOS (points are feet; o.eye=true if already eye level). Honors ctx.combat.utility.blocksLine smoke hook. */
    visible: (a, b, o) => (sys.ready || ensure() ? T.visible(P(a), P(b), o) : true),
    /** Fraction 0..1 of target's head/chest/knee visible from a's eye. */
    exposure: (a, b, o) => T.exposure(P(a), P(b), o),
    sightDistance: (p, yaw, pitch, max) => T.sightDistance(P(p), yaw, pitch, max),
    /** Wall-hugging positions near `near` hidden from `from`: [{pos,node,dist,score,peek,hard,yaw}] */
    coverPoints: (near, from, radius, o) => (sys.ready ? T.coverPoints(P(near), P(from), radius, o) : []),
    /** Openings worth holding from pos: [{yaw,range,width,kind:'long'|'mid'|'short',dir,point}] */
    holdAngles: (p, o) => (sys.ready ? T.holdAngles(P(p), o) : []),
    /** Spots near `near` that hold an angle on `toward`: [{pos,node,range,exposure,score,yaw}] */
    holdSpots: (near, toward, radius, o) => (sys.ready ? T.holdSpots(P(near), P(toward), radius, o) : []),
    randomPointNear: (p, radius, o, out) => (sys.ready ? T.randomPointNear(P(p), radius, o, out) : null),
    randomPoint: (out) => (sys.ready ? T.randomPoint(out) : null),
    danger,
    // ---- loop
    fixedUpdate(dt) {
      if ((tick++ & 31) === 0) { dirty = dirty || (sys.ready && sys.mapChanged()); if (!sys.ready || dirty) ensure(); }
      if (sys.ready) { sys.pump(sys.cfg.sliceExpansions >> 2); sys.decayDanger(dt); }
    },
    update() {},
  };
  const dbg = createDebug(ctx, api, sys);
  api.debug = dbg;
  // overlay camera/panel update runs after every other module (so scene cameras win over the player's)
  ctx.engine?.add?.({ update: () => dbg.update() }, 1000);

  ctx.debugScenes = ctx.debugScenes || {};
  ctx.debugScenes['nav-debug'] = async () => {
    ensure(); if (ctx.params.get('map') === 'test') dbg.useTestMap();
    dbg.draw(true); dbg.camera(ctx.params.get('view') || 'iso'); if (ctx.params.get('edges')) dbg.edges(true);
  };
  ensure();
  return api;
}
