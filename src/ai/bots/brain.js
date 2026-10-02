// Per-bot brain: aim model (flick + settle, tracking noise, recoil compensation), fire discipline, fight movement (strafe / counter-strafe /
// hold / rush / retreat), path following with stuck recovery, weapon management and order execution (goto / hold / plant / defuse).
// Every bot drives the *same* movement function the player uses (ctx.player.simulate).
import * as THREE from 'three';
import { K } from './config.js';
import { DEG, clamp, wrapPi, yawTo, pitchTo, randn, between, patternOff } from './util.js';

const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _eye = new THREE.Vector3();
const _pat = { yaw: 0, pitch: 0 };
const TAU = Math.PI * 2;

export function createBrain(B) {
  const { ctx } = B;
  const sim = (a, cmd, dt) => ctx.player.simulate(a, cmd, dt);

  // ------------------------------------------------------------------------------------------------------------------ weapon info
  function weaponInfo(ai) {
    const a = ai.actor, wi = ai.wi, w = ctx.combat?.equipped?.(a);
    if (!w || !w.def) { wi.def = null; wi.klass = 'none'; wi.mag = 0; wi.reloading = false; wi.ready = false; wi.scoped = false; wi.id = ''; return wi; }
    const def = w.def; wi.def = def; wi.id = w.id || def.id; wi.klass = def.utility ? 'util' : def.melee ? 'melee' : def.slot === 5 ? 'gear' : (def.klass || 'rifle');
    wi.mag = w.mag ?? 0; wi.reserve = w.reserve ?? 0; wi.max = def.mag || 1; wi.scoped = !!w.scoped; wi.scopeLevel = w.scopeLevel || 0;
    wi.reloading = w.state === 'reload'; wi.drawing = w.state === 'draw';
    wi.ready = !wi.reloading && !wi.drawing && wi.mag > 0 && (wi.klass !== 'util' && wi.klass !== 'melee' && wi.klass !== 'gear');
    return wi;
  }

  function manageWeapons(ai, now) {
    const a = ai.actor, inv = a.inventory; if (!inv) return;
    if (ai.util?.busy || ai.planting || now < ai.slotCool) return;
    const s1 = inv.slots?.[1], s2 = inv.slots?.[2];
    let want = s1 && (s1.mag > 0 || s1.reserve > 0) ? 1 : s2 ? 2 : 3;
    if (ai.pistolSwap > now && s2 && s2.mag > 0) want = 2;
    if (inv.current !== want && (inv.current === 1 || inv.current === 2 || inv.current === 3 || inv.current === 5 || inv.current === 4 || inv.current == null)) {
      const dueToUtil = inv.current === 4 && ai.util && (ai.util.state !== 'idle');
      if (!dueToUtil) { ctx.combat.switchTo(a, want); ai.slotCool = now + 0.6; }
    }
  }

  // ------------------------------------------------------------------------------------------------------------------ aim
  const aimHeight = (ai, e, m, d) => {
    // choose head / chest per bot: crown for good aimers up close, chest when far or only the body is exposed
    if (!(m.vis & 1)) return e.crouching ? 0.7 : K.stomachY + 0.1;
    if (ai.aimHead === undefined || now_() - ai.aimHeadT > 1.2) { ai.aimHeadT = now_(); const hp = ai.diff.headP * (d > 30 ? 0.5 : 1) * (ai.wi.klass === 'sniper' || ai.wi.klass === 'shotgun' ? 0 : 1); ai.aimHead = ai.rng() < hp; }
    return ai.aimHead ? (e.crouching ? K.headYCrouch : K.headY) : (e.crouching ? 0.8 : K.chestY);
  };
  let _now = 0; const now_ = () => _now;

  function stepAim(ai, dt) {
    const A = ai.aim, it = A.it, a = ai.actor, df = ai.diff;
    a.eyePos(_eye);
    let ty = A.yaw, tp = A.pitch, om = A.lookOmega, ze = 1, vmax = 330 * DEG, track = false;
    if (it.kind === 2) {
      const m = it.m, e = m.actor; track = true;
      const dx0 = e.pos.x - _eye.x, dz0 = e.pos.z - _eye.z, d = Math.hypot(dx0, dz0) + 1e-3;
      const hy = aimHeight(ai, e, m, d);
      // noise (OU) in metres on the plane perpendicular to the view
      const espd = Math.hypot(m.vel.x, m.vel.z), bspd = a.move?.speed || 0;
      const sig = df.errM * (1 + df.errMove * espd / 3) * (1 + bspd / 8) * (1 + d / 70) * (ai.blind > 0.2 ? 4 : 1);
      const th = 2.4, k = Math.sqrt(2 * th * dt) * sig;
      A.nx += -th * A.nx * dt + k * randn(ai.rng); A.ny += -th * A.ny * dt + k * 0.7 * randn(ai.rng);
      // slight lead: we chase a moving target with latency, so give back a part of it (better aimers lead more)
      const lead = 0.05 * df.rcs;
      const px = e.pos.x + m.vel.x * lead + (dz0 / d) * A.nx, pz = e.pos.z + m.vel.z * lead - (dx0 / d) * A.nx, py = e.pos.y + hy + A.ny;
      const dx = px - _eye.x, dz = pz - _eye.z, dy = py - _eye.y;
      ty = yawTo(dx, dz); tp = pitchTo(dy, Math.hypot(dx, dz));
      A.exactYaw = yawTo(e.pos.x - _eye.x, e.pos.z - _eye.z); A.exactPitch = pitchTo(e.pos.y + hy - _eye.y, d); A.dist = d; A.hy = hy;
      om = df.omega * (a.move?.sliding ? 0.6 : 1); ze = df.zeta; vmax = df.maxVel * DEG;
      // first flick of an acquisition lands with a bigger error that is then corrected
      if (now_() - A.acqT < 0.04 && !A.acqSet) { A.nx = randn(ai.rng) * df.errM * 1.8; A.ny = randn(ai.rng) * df.errM * 1.2; A.acqSet = true; }
    } else if (it.kind === 1) {
      const dx = it.x - _eye.x, dz = it.z - _eye.z, dy = it.y - _eye.y;
      ty = yawTo(dx, dz); tp = pitchTo(dy, Math.hypot(dx, dz)); om = it.fast ? df.omega * 0.55 : A.lookOmega; ze = it.fast ? 0.9 : 1; vmax = (it.fast ? df.maxVel * 0.6 : 360) * DEG;
    } else if (it.kind === 3) { ty = it.yaw; tp = it.pitch; om = A.lookOmega; ze = 1; vmax = 300 * DEG; }
    // recoil compensation: bullets leave at view + pattern, so pre-subtract (rcs scales how well)
    const cb = a.cb, def = ai.wi.def;
    if (cb && def?.pattern && (track || cb.recoilIdx > 0.05) && it.kind !== 3) {
      patternOff(def, cb.recoilIdx, _pat);
      const sc = ai.wi.scoped && def.scope ? def.scope.recoilMul : 1;
      ty += _pat.yaw * sc * DEG * df.rcs; tp -= _pat.pitch * sc * DEG * df.rcs;
    }
    const ey = wrapPi(ty - A.yaw), ep = tp - A.pitch;
    A.yv += (om * om * ey - 2 * ze * om * A.yv) * dt; A.pv += (om * om * ep - 2 * ze * om * A.pv) * dt;
    A.yv = clamp(A.yv, -vmax, vmax); A.pv = clamp(A.pv, -vmax, vmax);
    A.yaw = wrapPi(A.yaw + A.yv * dt); A.pitch = clamp(A.pitch + A.pv * dt, -1.45, 1.45);
    A.errYaw = ey; A.errPitch = ep;
  }

  // ------------------------------------------------------------------------------------------------------------------ fire control
  function planBurst(ai, d) {
    const wi = ai.wi, df = ai.diff, r = ai.rng, k = wi.klass, mul = df.burstMul;
    const R = (lo, hi) => Math.round((lo + r() * (hi - lo)) * mul);
    switch (k) {
      case 'rifle': case 'heavy': {
        if (wi.def?.burst) return 1;
        if (d < 8) return R(10, 26);
        if (d < df.sprayDist) return R(4, 9);
        if (d < 32) return R(2, 5);
        return R(1, 3);
      }
      case 'smg': return d < 12 ? R(8, 20) : d < 24 ? R(4, 8) : R(2, 5);
      case 'shotgun': return R(1, 3);
      case 'sniper': return 1;
      default: return d < 10 ? Math.max(1, R(1, 3)) : 1;     // pistols: taps
    }
  }
  const maxIdxFor = (ai, d) => { const k = ai.wi.klass; if (k === 'sniper') return 99; if (d > 30) return 1.2; if (d > ai.diff.sprayDist) return 3; return 99; };

  function fireControl(ai, now, dt) {
    const c = ai.cmd, a = ai.actor, fp = ai.fp, wi = ai.wi, it = ai.aim.it;
    c.fire = false; c.aim = false;
    const m = it.kind === 2 ? it.m : null;
    if (!m || !m.vis || ai.blind > 0.45 || wi.klass === 'util' || wi.klass === 'gear' || wi.klass === 'none') { fp.burstLeft = 0; return; }
    if (wi.klass === 'melee') return;
    const A = ai.aim, d = A.dist || 20;
    const cb = a.cb; if (!cb) return;
    // true bullet direction vs exact direction to the aim point
    const def = wi.def; patternOff(def, cb.recoilIdx, _pat);
    const sc = wi.scoped && def.scope ? def.scope.recoilMul : 1;
    const byaw = A.yaw - _pat.yaw * sc * DEG, bpit = A.pitch + _pat.pitch * sc * DEG;
    const dyaw = wrapPi(A.exactYaw - byaw) * Math.cos(A.pitch), dpit = A.exactPitch - bpit;
    const errM = Math.hypot(dyaw, dpit) * d;
    A.errM = errM;
    // scope handling (sniper): scope in at range, never fire unscoped unless point blank
    if (wi.klass === 'sniper') {
      if (wi.id === 'lance' && !wi.scoped && d > 9 && wi.ready && now > fp.scopeAt) { c.aim = true; fp.scopeAt = now + 0.35; return; }
      if (!wi.scoped && d > 9) return;
    }
    if (!wi.ready) { if (fp.burstLeft > 0) fp.burstLeft = 0; return; }
    const tol = ai.diff.tolM * (m.vis & 1 && A.hy > 1.4 ? 0.7 : 1) + (d < 6 ? 0.25 : 0);
    const inacc = ctx.combat?.inaccuracy?.(a) ?? 0;
    const spreadM = Math.tan(inacc * DEG) * d;
    if (fp.burstLeft <= 0) {
      if (now < fp.nextBurstAt) return;
      if (errM > tol) return;
      const accOK = spreadM < (d < 6 ? 1.1 : 0.2 + d * 0.012) * (ai.diff.cs > 0.5 ? 1 : 2.5);
      if (!accOK) { fp.wantStop = true; return; }
      if (cb.recoilIdx > maxIdxFor(ai, d)) return;
      fp.burstN = planBurst(ai, d); fp.burstLeft = fp.burstN; fp.shots0 = cb.shots; fp.burstStart = now;
      if (!ai.shotSeen) { ai.shotSeen = true; B.tel.onFirstShot(ai, now); }
      if (now - (m.shotT || -99) > 4 && B.tel.reactions.length < 600) B.tel.reactions.push([ai.diff.id, Math.round((now - m.visSince) * 1000)]);
      m.shotT = now;
    }
    const fired = cb.shots - fp.shots0;
    const lostFor = now - m.seenT;
    if (fired >= fp.burstN || wi.mag <= 0 || lostFor > 0.5 || now - fp.burstStart > 4) {
      fp.burstLeft = 0; fp.nextBurstAt = now + between(ai.rng, ai.diff.cs > 0.7 ? [0.08, 0.24] : [0.15, 0.5]) + (wi.klass === 'sniper' ? 0.15 : 0);
      fp.wantStop = false; return;
    }
    if (errM > tol * 3.5 + 0.3) return;     // hold fire while the crosshair is far off (re-acquiring), burst stays open
    c.fire = true;
  }

  // ------------------------------------------------------------------------------------------------------------------ movement helpers
  const S = (ai) => ai.steer;
  function setSteer(ai, wx, wz, mag = 1) { const s = ai.steer, l = Math.hypot(wx, wz); if (l < 1e-5) { s.x = s.z = 0; s.mag = 0; return; } s.x = wx / l; s.z = wz / l; s.mag = mag; }
  function brake(ai) {
    const a = ai.actor, vx = a.vel.x, vz = a.vel.z, sp = Math.hypot(vx, vz);
    if (sp > 1.0 && ai.rng() < 2) setSteer(ai, -vx, -vz, 1);   // oppose velocity (counter-strafe)
    else { ai.steer.mag = 0; }
  }
  function requestPath(ai, now) {
    const mv = ai.mv, a = ai.actor;
    if (now < mv.nextPathAt || B.pathBudget <= 0) return;
    B.pathBudget--; B.tel.paths++;
    const raw = mv.noSmooth > now; const p = ctx.nav.path(a.pos, mv.goal, raw ? { team: a.team, smooth: false, noCache: true } : { team: a.team, danger: 0.6 });
    mv.needPath = false;
    if (p && p.length) { mv.path = p; mv.pi = 0; mv.fails = 0; mv.pathT = now; } else { mv.path = null; mv.fails++; mv.nextPathAt = now + 0.4 + Math.min(2, mv.fails * 0.3); if (mv.fails > 4) mv.unreachable = true; }
  }
  /** Set a navigation goal. mode: 'run' | 'walk'. */
  function goTo(ai, pos, r = K.arrive, mode = 'run') {
    const mv = ai.mv;
    if (!mv.has || mv.goal.distanceToSquared(pos) > 1.2) { mv.goal.copy(pos); mv.needPath = true; mv.path = null; mv.pi = 0; mv.fails = 0; mv.acceptNear = false; mv.stage = 0; mv.unreachable = false; mv.nextPathAt = 0; mv.arrived = false; }
    mv.has = true; mv.r = r; mv.mode = mode;
  }
  const stopGoal = (ai) => { ai.mv.has = false; ai.mv.arrived = false; };

  function follow(ai, now, dt) {
    const mv = ai.mv, a = ai.actor, s = ai.steer;
    s.mag = 0; s.jump = false;
    if (!mv.has) return;
    const gd = Math.hypot(mv.goal.x - a.pos.x, mv.goal.z - a.pos.z), gy = Math.abs(mv.goal.y - a.pos.y);
    if ((gd <= mv.r && gy < 2.2) || (mv.acceptNear && gd < 3.2 && gy < 2.5)) { mv.arrived = true; if (mv.pi >= (mv.path ? mv.path.length - 1 : 0) || gd < mv.r * 0.8) return; }
    else mv.arrived = false;
    if (mv.needPath || !mv.path) { if (mv.needPath || now >= mv.nextPathAt) { mv.needPath = true; requestPath(ai, now); } if (!mv.path) { if (mv.unreachable && gd > mv.r) directWalk(ai, mv.goal); return; } }
    const path = mv.path, n = path.length;
    let wp = path[mv.pi];
    let dx = wp.x - a.pos.x, dz = wp.z - a.pos.z, d = Math.hypot(dx, dz);
    const last = mv.pi >= n - 1;
    if (Math.abs(wp.y - a.pos.y) > 1.8 && d < 3.2 && now - mv.pathT > 1.0 && path.flags?.[mv.pi] !== 2) { mv.needPath = true; mv.path = null; mv.nextPathAt = now; mv.pathT = now; return; }
    const reach = last ? Math.max(0.25, mv.r * 0.6) : 0.65;
    if (d < reach && Math.abs(wp.y - a.pos.y) < 1.4) {
      if (last) { mv.arrived = true; return; }
      mv.pi++; wp = path[mv.pi]; dx = wp.x - a.pos.x; dz = wp.z - a.pos.z; d = Math.hypot(dx, dz);
    }
    // cut corners when the segment after the next waypoint is already close and flat
    if (!last && mv.pi + 1 < n && d < 1.2 && path.flags?.[mv.pi + 1] === 0) {
      const w2 = path[mv.pi + 1], k = 1 - d / 1.2; dx += (w2.x - wp.x) * k * 0.6; dz += (w2.z - wp.z) * k * 0.6;
    }
    if (d < 1e-4) return;
    s.x = dx / Math.hypot(dx, dz); s.z = dz / Math.hypot(dx, dz); s.mag = 1;
    separate(ai);
    const fl = path.flags?.[mv.pi];
    if (fl === 1 && a.onGround && wp.y - a.pos.y > 0.3 && d < 1.7) s.jump = true;
    // slow when arriving at a hold spot
    if (last && gd < 1.5 && mv.mode !== 'run') s.mag = 0.6;
    // look-ahead for view
    let acc = 0, li = mv.pi, px = a.pos.x, pz = a.pos.z, py = a.pos.y;
    while (li < n && acc < 7) { const q = path[li]; acc += Math.hypot(q.x - px, q.z - pz); px = q.x; pz = q.z; py = q.y; li++; }
    ai.lookAhead.set(px, py + K.eye, pz); ai.hasLookAhead = true;
  }
  /** Don't shoulder teammates: repel from anyone closer than ~1 m and slip past the one standing in our way. */
  function separate(ai) {
    const a = ai.actor, s = ai.steer, acts = ctx.actors; let rx = 0, rz = 0, n = 0;
    for (let i = 0; i < acts.length; i++) {
      const o = acts[i]; if (o === a || !o.alive || o.team !== a.team) continue;
      const dx = o.pos.x - a.pos.x, dz = o.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.05 || d < 1e-3 || Math.abs(o.pos.y - a.pos.y) > 1.6) continue;
      const k = (1.05 - d) / 1.05, front = (dx * s.x + dz * s.z) / d;
      rx -= (dx / d) * k * 1.4; rz -= (dz / d) * k * 1.4;
      if (front > 0.4) { const sd = ((a.id + o.id) & 1) ? 1 : -1; rx += -s.z * sd * k * 1.2; rz += s.x * sd * k * 1.2; }   // slip past on a consistent side
      n++;
    }
    if (n) { const x = s.x + rx, z = s.z + rz, l = Math.hypot(x, z); if (l > 1e-4) { s.x = x / l; s.z = z / l; } }
  }
  function directWalk(ai, p) { const a = ai.actor; setSteer(ai, p.x - a.pos.x, p.z - a.pos.z, 1); }

  // stuck detection & recovery -----------------------------------------------------------------------------------------
  // Wedge detection every 0.35 s (< 0.2 m moved while steering): back off from the wedge, re-path on the raw (unsmoothed) node path,
  // escalate to a jump / sidestep, last resort snap to the nearest walkable node.
  function stuckTick(ai, now, dt) {
    const mv = ai.mv, a = ai.actor, s = ai.steer;
    if (mv.unstuckUntil > now) { s.x = mv.unx; s.z = mv.unz; s.mag = 1; s.jump = mv.unjump && ((now * 6) | 0) % 2 === 0; return; }
    const want = s.mag > 0.3 && !mv.arrived && (mv.has || ai.aim.it.kind === 2);
    if (!want) { mv.stuckAcc = Math.max(0, mv.stuckAcc - dt * 2); mv.sx = a.pos.x; mv.sz = a.pos.z; mv.st = now; ai.stuckNow = false; if (mv.stuckAcc <= 0) mv.stage = Math.max(0, mv.stage - dt * 0.5); return; }
    if (now - mv.st < 0.35) return;
    const moved = Math.hypot(a.pos.x - mv.sx, a.pos.z - mv.sz);
    mv.sx = a.pos.x; mv.sz = a.pos.z; mv.st = now;
    if (moved >= 0.2) { mv.stuckAcc = Math.max(0, mv.stuckAcc - 0.7); mv.stage = Math.max(0, mv.stage - 0.35); ai.stuckNow = false; return; }
    mv.stuckAcc += 0.35; ai.stuckNow = true; ai.stuckTotal += 0.35; B.tel.stuckTime += 0.35;
    mv.stage++;
    const st = Math.round(mv.stage), side = ai.rng() < 0.5 ? 1 : -1, yaw = a.yaw, bx = -s.x, bz = -s.z;
    if (B.tel.log.length < 160) B.tel.log.push({ k: 'stk', t: +now.toFixed(1), who: a.name, pos: [+a.pos.x.toFixed(1), +a.pos.y.toFixed(1), +a.pos.z.toFixed(1)], goal: [+mv.goal.x.toFixed(1), +mv.goal.y.toFixed(1), +mv.goal.z.toFixed(1)], stage: st, wp: mv.path ? [mv.pi, mv.path.length] : null, area: ctx.nav?.areaAt?.(a.pos), ord: ai.order ? ai.order.kind + ':' + (ai.order.role || '') : '-', near: ctx.actors.filter((o) => o !== a && Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z) < 1.5).map((o) => o.name + '/' + o.team[0] + (o.alive ? '' : 'x')).join(',') });
    if (mv.stuckAcc > 2.4 && !ai.stuckFlag) { ai.stuckFlag = true; B.tel.onStuck(ai, now); }
    mv.noSmooth = now + 4; mv.needPath = true; mv.path = null; mv.nextPathAt = now + 0.45;
    if (Math.hypot(mv.goal.x - a.pos.x, mv.goal.z - a.pos.z) < 3.2) mv.acceptNear = true;
    if (st <= 1) { mv.unstuckUntil = now + 0.4; mv.unjump = false; mv.unx = bx * 0.8 + Math.cos(yaw) * side * 0.4; mv.unz = bz * 0.8 - Math.sin(yaw) * side * 0.4; }
    else if (st === 2) { mv.unstuckUntil = now + 0.55; mv.unjump = true; mv.unx = bx * 0.5 + Math.cos(yaw) * side; mv.unz = bz * 0.5 - Math.sin(yaw) * side; }
    else if (st === 3) { mv.unstuckUntil = now + 0.7; mv.unjump = false; mv.unx = bx; mv.unz = bz; }
    else if (st === 4) { mv.unstuckUntil = now + 0.6; mv.unjump = true; mv.unx = Math.cos(yaw) * side; mv.unz = -Math.sin(yaw) * side; }
    else {   // last resort: snap to the nearest walkable node
      const sp = ctx.nav.snap(a.pos, _p, 3);
      if (sp) { a.pos.set(sp.x, sp.y, sp.z); a.vel.set(0, 0, 0); ai.teleports++; B.tel.teleports++; }
      mv.stage = 1; mv.unstuckUntil = now + 0.3; mv.unx = bx; mv.unz = bz; mv.unjump = false;
    }
  }

  // ------------------------------------------------------------------------------------------------------------------ fight movement
  function selectStyle(ai, m, d, now) {
    const fp = ai.fp, df = ai.diff, wi = ai.wi, a = ai.actor, o = ai.order;
    fp.styleT = now + 0.9 + ai.rng() * 1.4;
    let st = 'strafe';
    const onHold = o && o.kind === 'hold' && ai.mv.arrived;
    if (wi.klass === 'sniper' && d > 12) st = 'hold';
    else if ((a.hp < (35 + df.panic * 30) || (wi.reloading && wi.klass !== 'shotgun' && d > 7)) && ai.rng() < df.coverP && B.hasCoverFor(ai, m)) st = 'retreat';
    else if ((wi.klass === 'smg' || wi.klass === 'shotgun') && d < 13 && ai.rng() < 0.7) st = 'rush';
    else if (onHold && ai.rng() < 0.55 + df.peekSkill * 0.25) st = 'hold';
    else if (d > 30 && ai.rng() < df.crouchP * 1.8) st = 'hold';
    else if (ai.rng() > df.strafe) st = 'hold';
    if (st !== fp.style) { fp.style = st; fp.phase = 'stop'; fp.until = now + 0.2; }
    fp.crouch = (st === 'hold' && d > 16 && ai.rng() < df.crouchP * 2.2) || (wi.klass === 'sniper' && ai.rng() < 0.3);
  }

  function strafeDirOK(ai, sx, sz) {
    const a = ai.actor; _p.set(a.pos.x + sx * 1.3, a.pos.y, a.pos.z + sz * 1.3);
    return ctx.nav.isWalkable(_p) && ctx.nav.visible(a.pos, _p, { eye: false, eyeA: 0.6, eyeB: 0.6, ignoreSmoke: true });
  }

  function fightMove(ai, m, now, dt) {
    const a = ai.actor, fp = ai.fp, df = ai.diff, s = ai.steer;
    const e = m.actor, dx = e.pos.x - a.pos.x, dz = e.pos.z - a.pos.z, d = Math.hypot(dx, dz) + 1e-3;
    if (now >= fp.styleT) selectStyle(ai, m, d, now);
    ai.crouchWant = fp.crouch && fp.style === 'hold';
    const hs = a.move?.speed || 0;
    // right vector relative to the enemy (perpendicular), so strafes are always across the line of fire
    const rx = dz / d, rz = -dx / d;
    switch (fp.style) {
      case 'hold': { if (hs > 1.2 && ai.rng() < df.cs) brake(ai); else s.mag = 0; fp.phase = 'shoot'; break; }
      case 'rush': {
        if (d > 3.5) { setSteer(ai, dx, dz, 1); }
        else { setSteer(ai, rx * fp.dir, rz * fp.dir, 1); if (now >= fp.until) { fp.dir = -fp.dir; fp.until = now + 0.25 + ai.rng() * 0.3; } }
        break;
      }
      case 'retreat': {
        const cv = B.coverFor(ai, m, now);
        if (cv) { ai.coverPos = cv; setSteer(ai, cv.x - a.pos.x, cv.z - a.pos.z, 1); if (Math.hypot(cv.x - a.pos.x, cv.z - a.pos.z) < 0.7) { s.mag = 0; ai.crouchWant = true; } }
        else { fp.style = 'strafe'; }
        break;
      }
      default: {
        // strafe / stop / shoot cycle (peek-fight): move across, counter-strafe, burst, repeat
        if (fp.phase === 'move') {
          let sx = rx * fp.dir, sz = rz * fp.dir, fwd = 0;
          if (d < 4) fwd = -0.5; else if (d > 26 && ai.wi.klass === 'smg') fwd = 0.5;
          sx += (dx / d) * fwd; sz += (dz / d) * fwd; setSteer(ai, sx, sz, 1);
          if (now >= fp.until) { fp.phase = 'stop'; fp.until = now + 0.22; }
        } else if (fp.phase === 'stop') {
          if (ai.rng() < df.cs + 0.4) brake(ai); else s.mag = 0;
          if (hs < 1.7 || now >= fp.until) { fp.phase = 'shoot'; fp.until = now + 0.5 + ai.rng() * 0.35; fp.shootStart = now; }
        } else { // shoot
          s.mag = 0; if (hs > 1.2 && ai.rng() < df.cs) brake(ai);
          const done = fp.burstLeft <= 0 && now >= fp.nextBurstAt;
          if ((done && now - fp.shootStart > 0.12) || now >= fp.until + 0.5) {
            fp.dir = ai.rng() < 0.75 ? -fp.dir : fp.dir;
            if (!strafeDirOK(ai, rx * fp.dir, rz * fp.dir)) fp.dir = -fp.dir;
            fp.phase = 'move'; fp.until = now + 0.16 + ai.rng() * 0.3;
          }
        }
        // rookies keep moving and shooting
        if (df.cs < 0.5 && fp.phase !== 'move' && ai.rng() < 0.02) { fp.phase = 'move'; fp.until = now + 0.3; }
      }
    }
    // bump away from walls: if we are not moving though we want to, flip strafe direction
    if (s.mag > 0.3 && hs < 0.6 && now - fp.flipT > 0.3) { fp.dir = -fp.dir; fp.flipT = now; }
  }

  // ------------------------------------------------------------------------------------------------------------------ orders
  function pickupCheck(ai, now) {
    const a = ai.actor, inv = a.inventory, drops = ctx.combat?.drops; if (!drops || !drops.length || !inv) { ai.pickup = null; return; }
    if (ai.pickup) { if (!drops.includes(ai.pickup.d) || now > ai.pickup.until) ai.pickup = null; else if (inv.slots?.[1]) ai.pickup = null; }
    if (ai.pickup || inv.slots?.[1] || now < ai.pickupT || ai.target || a.hasBeacon) return;
    ai.pickupT = now + 1.5;
    let best = null, bd = 1e9;
    for (const d of drops) {
      const def = d.w?.def; if (!def || def.slot !== 1 || d.age < 0.5) continue; if (def.teams && !def.teams.includes(a.team)) continue;
      const dd = Math.hypot(d.pos.x - a.pos.x, d.pos.z - a.pos.z); if (dd > 22 || Math.abs(d.pos.y - a.pos.y) > 2.5 || dd >= bd) continue;
      // don't walk into a known enemy
      let danger = false; for (const m of ai.mem.values()) if (now - m.t < 6 && Math.hypot(m.pos.x - d.pos.x, m.pos.z - d.pos.z) < 14) { danger = true; break; }
      if (danger) continue; bd = dd; best = d;
    }
    if (best) ai.pickup = { d: best, pos: best.pos, until: now + 10 };
  }

  const OFF = [[0, 0], [1.2, 0.7], [-1.2, 0.7], [0.7, -1.3], [-0.7, -1.3], [1.6, -0.6], [-1.6, -0.6]];
  const _off = new THREE.Vector3();
  /** a stable per-bot spot around a shared waypoint, so five bots sent to one node do not pile up */
  function crowdOffset(ai, o) {
    if (o._offFor === ai && o._offBase === o.pos) return o._offPos;
    const k = OFF[ai.slot % OFF.length]; _off.set(o.pos.x + k[0], o.pos.y, o.pos.z + k[1]);
    const ok = (k[0] || k[1]) && ctx.nav.isWalkable(_off) && ctx.nav.visible(o.pos, _off, { eyeA: 0.6, eyeB: 0.6, ignoreSmoke: true });
    o._offFor = ai; o._offBase = o.pos; o._offPos = ok ? _off.clone() : o.pos; return o._offPos;
  }

  function orderTick(ai, now, dt) {
    const o = ai.order, a = ai.actor, mv = ai.mv, s = ai.steer;
    pickupCheck(ai, now);
    if (ai.pickup) { goTo(ai, ai.pickup.pos, 0.5, 'run'); return; }
    ai.planting = false; ai.defusing = false; ai.hasLookAhead = ai.hasLookAhead && false;
    if (!o) { stopGoal(ai); return; }
    switch (o.kind) {
      case 'goto': case 'hold': case 'push': case 'roam': {
        let pos = o.pos, r = o.r ?? (o.kind === 'hold' ? K.arriveHold : K.arrive);
        if (o.pickup) { r = Math.min(r, 0.5); }   // integration: Beacon pickup range is 1.6 m: no crowd offset / 1.5 m arrival slack, or the bot parks 2.4 m away and the round times out
        else if (o.kind === 'goto' || o.kind === 'push') { pos = crowdOffset(ai, o); r = Math.max(r, 1.5); }
        goTo(ai, pos, r, o.walk ? 'walk' : 'run');
        break;
      }
      case 'plant': {
        goTo(ai, o.pos, 0.6, 'walk');
        break;
      }
      case 'defuse': { goTo(ai, o.pos, 1.0, 'walk'); break; }
    }
  }

  function interactTick(ai, now) {
    const o = ai.order, a = ai.actor, mv = ai.mv;
    if (!o || ai.target) return;
    if (o.kind === 'plant' || o.kind === 'defuse') {
      const near = Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z) <= (o.kind === 'plant' ? 1.4 : 1.6) || mv.arrived;
      const spd = a.move?.speed || 0;
      if (near) {
        if (o.kind === 'plant') { if (!ctx.match?.beaconApi?.siteAt?.(a.pos)) return; ai.planting = true; }
        else ai.defusing = true;
        ai.steer.mag = 0; if (spd > 0.8) brake(ai);
        if (spd <= K.plantStill + 0.3) ctx.match?.interact?.(a, true);
      }
    }
  }

  // ------------------------------------------------------------------------------------------------------------------ main per-tick action
  /** think: ~15 Hz, decides intents. Heavy stuff lives here. */
  function think(ai, now) {
    const a = ai.actor;
    weaponInfo(ai);
    ai.thinkAt = now;
    // vision
    if (now >= ai.visAt) { ai.visAt = now + 1 / ai.diff.visHz; B.S.perceive(ai.bot, now); }
    manageWeapons(ai, now);
    const tgt = ai.target;
    // reload when safe
    if (!tgt && now - ai.lastThreatT > 1.4 && !ai.util?.busy) {
      const wi = ai.wi;
      if ((wi.klass === 'rifle' || wi.klass === 'smg' || wi.klass === 'heavy' || wi.klass === 'pistol' || wi.klass === 'sniper' || wi.klass === 'shotgun') && !wi.reloading && wi.reserve > 0 && wi.mag < wi.max * 0.45 && wi.def) ctx.combat.reload(a);
    }
    if (tgt) {
      ai.lastThreatT = now;
      // empty mag with an enemy close: swap to the pistol instead of a long reload
      if (ai.wi.klass !== 'pistol' && ai.wi.mag === 0 && a.inventory?.slots?.[2]?.mag > 0 && ai.aim.dist < 24) ai.pistolSwap = now + 3;
    }
    // reactive utility: strobe a spot we are about to peek, pulse a corner somebody is holding
    if (!tgt && now >= ai.utilReactAt && ai.util && !ai.util.cur && ai.util.orders.length === 0 && ctx.match?.phase !== 'freeze') {
      const have = a.inventory?.utility; let best = null, bd = 1e9;
      if (have && have.length) for (const m of ai.mem.values()) {
        if (!m.actor.alive || m.vis || m.conf < 0.55 || now - m.t > 5) continue;
        const d = Math.hypot(m.pos.x - a.pos.x, m.pos.z - a.pos.z); if (d < 7 || d > 22 || d >= bd) continue; bd = d; best = m;
      }
      ai.utilReactAt = now + 2;
      if (best && ai.rng() < ai.diff.util) {
        const atk = a.team === 'ember', typ = have.includes('strobe') && (atk || ai.rng() < 0.5) ? 'strobe' : have.includes('pulse') ? 'pulse' : null;
        if (typ) { B.utilOrder(ai.bot, typ, best.pos, 'now', { popUp: typ === 'strobe' ? 2.2 : 0, minD: 6, maxD: 24, ttl: 5 }); ai.utilReactAt = now + 7; }
      }
    }
    // aim intent
    const A = ai.aim;
    if (tgt) { A.it.kind = 2; A.it.m = tgt; }
    else {
      let rec = null;
      for (const m of ai.mem.values()) { if (!m.actor.alive) continue; if (now - m.seenT < 1.6 && (!rec || m.seenT > rec.seenT)) rec = m; }
      if (rec && ai.blind < 0.45) { A.it.kind = 1; A.it.x = rec.pos.x + rec.vel.x * 0.25; A.it.z = rec.pos.z + rec.vel.z * 0.25; A.it.y = rec.pos.y + K.headY; A.it.fast = true; }
      else if (ai.heard && now - ai.heard.t < 1.2 && ai.blind < 0.45) { A.it.kind = 1; A.it.x = ai.heard.x; A.it.z = ai.heard.z; A.it.y = ai.heard.y + K.headY; A.it.fast = true; }
      else if (ai.lookAt) { A.it.kind = 1; A.it.x = ai.lookAt.x; A.it.y = ai.lookAt.y; A.it.z = ai.lookAt.z; A.it.fast = false; }
      else if (ai.hasLookAhead && ai.mv.has && !ai.mv.arrived) { A.it.kind = 1; A.it.x = ai.lookAhead.x; A.it.y = ai.lookAhead.y; A.it.z = ai.lookAhead.z; A.it.fast = false; }
      else if (ai.order?.yaw !== undefined && ai.order.yaw !== null) { A.it.kind = 3; A.it.yaw = ai.order.yaw; A.it.pitch = 0; }
      else A.it.kind = 0;
    }
    if (tgt && !ai.lastTarget) { A.acqT = now; A.acqSet = false; }
    ai.lastTarget = tgt;
    orderTick(ai, now);
  }

  /** Per fixed tick. */
  function act(ai, now, dt) {
    _now = now;
    const a = ai.actor, c = ai.cmd, mvc = ai.mv.cmd, s = ai.steer;
    const frozen = !!(ctx.match?.frozen);
    const m = a.move || (a.move = null);
    if (a.move) a.move.frozen = frozen;
    if (now >= ai.nextThink) { ai.nextThink = now + (ai.target ? ai.thinkDt * 0.5 : ai.thinkDt); think(ai, now); }
    c.slot = 0; c.reload = false; c.use = false; c.drop = false; c.last = false;
    // behaviour -> steering
    s.mag = 0; s.jump = false;
    const tgt = ai.aim.it.kind === 2 ? ai.aim.it.m : null;
    ai.crouchWant = false;
    if (frozen) { ai.mv.st = now; ai.mv.sx = a.pos.x; ai.mv.sz = a.pos.z; ai.mv.stuckAcc = 0; }
    else {
      follow(ai, now, dt);
      if (tgt && tgt.vis && ai.blind < 0.5) fightMove(ai, tgt, now, dt);
      else {
        if (ai.blind > 0.4) { ai.steer.mag = 0; }
        else if (ai.order?.kind === 'hold' && ai.mv.arrived) { s.mag = 0; if ((a.move?.speed || 0) > 1.0) brake(ai); holdBehaviour(ai, now); }
        // alert: heard enemy close -> shift-walk
      }
      interactTick(ai, now);
      stuckTick(ai, now, dt);
    }
    // utility throws own the aim + buttons while active
    let utilActive = false;
    if (B.throws && !frozen) utilActive = B.throws.tick(ai, now, dt);
    if (ai.util?.hold) { s.mag = 0; if ((a.move?.speed || 0) > 1.0) brake(ai); s.jump = false; }
    stepAim(ai, dt);
    if (!utilActive) fireControl(ai, now, dt); else { c.fire = ai.util.fire; c.aim = ai.util.aimBtn; }
    // convert steer to cmd
    mvc.yaw = ai.aim.yaw; mvc.pitch = ai.aim.pitch;
    if (s.mag > 0.01 && !frozen) {
      const sy = Math.sin(ai.aim.yaw), cy = Math.cos(ai.aim.yaw);
      mvc.forward = (-sy * s.x - cy * s.z) * s.mag; mvc.right = (cy * s.x - sy * s.z) * s.mag;
    } else { mvc.forward = 0; mvc.right = 0; }
    mvc.jump = s.jump; mvc.crouch = ai.crouchWant || ai.defusing && false;
    const alertWalk = ai.heard && now - ai.heard.t < 2.5 && !tgt && ai.diff.tactics > 0.5 && ai.order?.sneak;
    mvc.walk = (ai.mv.mode === 'walk' || alertWalk) && !tgt && ai.mv.has;
    if (ai.planting || ai.defusing) { mvc.walk = true; }
    sim(a, mvc, dt);
    // keep our aim state in sync if something external rotated the actor
    if (Math.abs(wrapPi(a.yaw - ai.aim.yaw)) > 0.25 && now - ai.syncT > 0.05) { ai.aim.yaw = a.yaw; ai.aim.pitch = a.pitch; ai.aim.yv = ai.aim.pv = 0; }
    ai.syncT = now;
  }

  function holdBehaviour(ai, now) {
    const o = ai.order, a = ai.actor, df = ai.diff;
    // crouch-hold sometimes, scan slightly around the angle
    if (now > ai.holdT) {
      ai.holdT = now + 2 + ai.rng() * 3; ai.holdCrouch = ai.rng() < df.crouchP && o.crouch !== false;
      const ang = (o.yaw ?? a.yaw) + (ai.rng() - 0.5) * 0.7;
      ai.lookAt = ai.lookAt || new THREE.Vector3();
      ai.lookAt.set(a.pos.x - Math.sin(ang) * 20, a.pos.y + K.eye, a.pos.z - Math.cos(ang) * 20);
    }
    ai.crouchWant = ai.holdCrouch;
    // jiggle peek: step out and back while we expect company
    if (df.peekSkill > 0.5 && o.peek && now > ai.jigT && B.expectEnemy(ai, now)) {
      ai.jigT = now + 4 + ai.rng() * 5; ai.jig = { until: now + 0.28, dir: ai.rng() < 0.5 ? 1 : -1 };
    }
    if (ai.jig && now < ai.jig.until) {
      const yaw = ai.aim.yaw; setSteer(ai, Math.cos(yaw) * ai.jig.dir, -Math.sin(yaw) * ai.jig.dir, 1);
    } else if (ai.jig) { ai.jig = null; ai.mv.arrived = false; ai.steer.mag = 0; }
  }

  return { think, act, goTo, stopGoal, weaponInfo, brake, setSteer };
}
