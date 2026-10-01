// Human controller + camera feel (owner: move). Movement physics live in simulate.js (shared with bots).
import * as THREE from 'three';
import { createActor } from '../core/actor.js';
import { createSim, TUNE } from './simulate.js';
import { buildCourse } from './course.js';
import { MeshBVH } from 'three-mesh-bvh';

const DEG = Math.PI / 180;
const YAW_PER_COUNT = 0.022 * DEG;          // CS-compatible: 0.022° per count × sens
const PITCH_LIM = 89 * DEG;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function create(ctx) {
  const actor = createActor({ name: 'You', team: 'ember', isPlayer: true });
  const sp = ctx.map?.spawns?.ember?.[0];
  if (sp) { actor.pos.copy(sp.pos); actor.yaw = sp.yaw || 0; }
  ctx.actors.push(actor); ctx.localActor = actor;

  const sim = createSim({
    collider: () => ctx.map?.collider,
    emit: (t, d) => ctx.events.emit(t, d),
    surfaceAt: (v) => ctx.map?.surfaceAt?.(v),
    actors: () => ctx.actors,
    makeVec3: () => new THREE.Vector3(),
  });
  sim.ensure(actor);
  const cmd = { forward: 0, right: 0, jump: false, crouch: false, walk: false, yaw: 0, pitch: 0 };

  // ---- state -----------------------------------------------------------------------------------
  const S = {
    mode: 'play', frozenFlag: null, sensScale: 1, zoom: 1, zoomCur: 1,
    // interpolation pairs (eye position + effects)
    pe: new THREE.Vector3(), ce: new THREE.Vector3(),
    po: { y: 0, roll: 0, pitch: 0, fov: 0, x: 0 }, co: { y: 0, roll: 0, pitch: 0, fov: 0, x: 0 },
    // springs
    landY: 0, landV: 0, tiltP: 0, tiltV: 0, roll: 0, rollV: 0, fov: 0, fovV: 0, bobAmt: 0, bobPhaseSeen: 0, slideRoll: 0,
    recoil: [0, 0, 0], recoilV: [0, 0, 0], flinch: [0, 0, 0], flinchV: [0, 0, 0], recoilW: 11, flinchW: 26,
    crouchToggle: false, crouchLatch: false, crouchPrev: false,
    // death / spectate / free
    deathT: 0, killer: null, target: null, freePos: new THREE.Vector3(), freeVel: new THREE.Vector3(),
    tp: new THREE.Vector3(), tc: new THREE.Vector3(), tYaw: 0, tPitch: 0, camYaw: 0, camPitch: 0, camRoll: 0,
    deathEye: new THREE.Vector3(), deathDrop: 0, specCooldown: 0,
    lookDx: 0, lookDy: 0, hist: new Float32Array(600 * 8), histN: 0, tick: 0, snap: true,
  };
  const viewInfo = { speed: 0, hspeed: 0, onGround: true, crouch: false, walking: false, sliding: false, aimPunch: { x: 0, y: 0 }, lookDelta: { x: 0, y: 0 }, roll: 0, landDip: 0 };

  const api = {
    actor, simulate: sim.simulate, tune: TUNE, view: viewInfo,
    get mode() { return S.mode; },
    get frozen() { return S.frozenFlag ?? (ctx.match?.phase === 'freeze'); },
    set frozen(v) { S.frozenFlag = v === null || v === undefined ? null : !!v; },
    get sensScale() { return S.sensScale; }, set sensScale(v) { S.sensScale = v; },
    /** aim punch (recoil spring) in radians: x = pitch (+ = up), y = yaw (+ = left). Combat adds it to shot direction. */
    aimPunch: { x: 0, y: 0, z: 0 },
    setZoom(mult) { S.zoom = clamp(mult, 0.1, 1.5); },       // fov multiplier (tan-space), smoothed
    /** View punch. pitch>0 kicks the view UP, yaw>0 LEFT, roll>0 clockwise-left. kind 'recoil' (default, also drives aimPunch) or 'flinch'. Radians. */
    punch(pitch = 0, yaw = 0, roll = 0, kind = 'recoil') {
      const q = kind === 'flinch' ? S.flinch : S.recoil; q[0] += pitch; q[1] += yaw; q[2] += roll;
    },
    respawn(spawn) {
      const s = spawn || {}; const p = s.pos || s;
      actor.pos.set(p.x ?? 0, p.y ?? 0, p.z ?? 0); actor.vel.set(0, 0, 0);
      actor.yaw = s.yaw ?? actor.yaw; actor.pitch = 0; actor.alive = true; actor.tagged = false;
      const m = sim.ensure(actor); m.hasEnd = false; m.sliding = false; m.crouching = false; m.mantle = null; m.viewStep = 0; m.jumped = false; m.speedScale = 1;
      actor.crouchT = 0; actor.eyeHeight = 1.62; actor.height = 1.8;
      S.mode = 'play'; S.target = null; S.landY = S.landV = 0; S.snap = true; S.deathT = 0;
      S.recoil.fill(0); S.recoilV.fill(0); S.flinch.fill(0); S.flinchV.fill(0);
    },
    spectate(target) {
      if (!target) { S.mode = 'free'; S.freePos.copy(ctx.render.camera.position); S.freeVel.set(0, 0, 0); S.camYaw = actor.yaw; S.camPitch = actor.pitch; return; }
      S.target = target; S.mode = 'spectate'; S.snap = true; ctx.events.emit('spectate', { actor: target });
    },
    nextSpectate(dir = 1) {
      const list = ctx.actors.filter((a) => a !== actor && a.alive && a.team === actor.team); if (!list.length) return;
      const i = list.indexOf(S.target); api.spectate(list[(i + dir + list.length * 2) % list.length]);
    },
    debug: {},
  };

  // ---- events ----------------------------------------------------------------------------------
  ctx.events.on('land', (e) => { if (e.actor !== actor) return; S.landV -= Math.min(3.2, e.speed * 0.42); S.tiltV -= Math.min(0.5, e.speed * 0.02); });
  ctx.events.on('jump', (e) => { if (e.actor !== actor) return; S.tiltV += 0.5; S.landV += 0.5; });
  ctx.events.on('mantle', (e) => { if (e.actor === actor) S.landV -= 1.2; });
  ctx.events.on('tag:out', (e) => { if (e?.victim === actor) { S.killer = e.attacker || null; } });

  // ---- look --------------------------------------------------------------------------------------
  function applyLook() {
    const md = ctx.input.consumeMouse();
    if (!md.dx && !md.dy) return;
    if (!ctx.input.locked) return;
    const k = YAW_PER_COUNT * (ctx.settings.get('sensitivity') ?? 1) * S.sensScale;
    const inv = ctx.settings.get('invertY') ? -1 : 1;
    const dyaw = -md.dx * k, dp = -md.dy * k * inv;
    S.lookDx += dyaw; S.lookDy += dp;
    if (S.mode === 'free' || S.mode === 'spectate') { S.camYaw += dyaw; S.camPitch = clamp(S.camPitch + dp, -PITCH_LIM, PITCH_LIM); return; }
    if (S.mode !== 'play') return;
    actor.yaw += dyaw; actor.pitch = clamp(actor.pitch + dp, -PITCH_LIM, PITCH_LIM);
  }

  // ---- helpers -----------------------------------------------------------------------------------
  function spring(x, v, target, w, z, dt) { const a = -w * w * (x - target) - 2 * z * w * v; v += a * dt; return [x + v * dt, v]; }
  function critical(q, qv, w, dt) { for (let i = 0; i < 3; i++) { const a = -w * w * q[i] - 2 * w * qv[i]; qv[i] += a * dt; q[i] += qv[i] * dt; } }

  function fixedView(dt) {
    const m = actor.move, hs = m.speed, run = TUNE.runSpeed;
    // previous = current
    S.pe.copy(S.ce);
    Object.assign(S.po, S.co);
    // eye
    S.ce.set(actor.pos.x, actor.pos.y + actor.eyeHeight + m.viewStep, actor.pos.z);
    // landing spring (critically-ish damped)
    let r = spring(S.landY, S.landV, 0, 22, 0.75, dt); S.landY = clamp(r[0], -0.16, 0.08); S.landV = r[1];
    r = spring(S.tiltP, S.tiltV, 0, 18, 0.8, dt); S.tiltP = r[0]; S.tiltV = r[1];
    // gait bob
    const gaitOn = m.onGround && !m.sliding && hs > 0.8 ? clamp(hs / run, 0, 1.3) : 0;
    S.bobAmt += (gaitOn - S.bobAmt) * (1 - Math.exp(-10 * dt));
    const bobScale = ctx.settings.get('headBob') ?? 1;
    const ph = m.gait, bob = S.bobAmt * bobScale;
    const bobY = -Math.abs(Math.cos(ph)) * 0.016 * bob + 0.008 * bob;      // dips at foot-fall
    const bobX = Math.sin(ph) * 0.007 * bob;
    const bobRoll = Math.sin(ph) * 0.0035 * bob, bobPitch = Math.abs(Math.cos(ph)) * -0.0022 * bob;
    // strafe roll (tiny): velocity along camera-right
    const cy = Math.cos(actor.yaw), sy = Math.sin(actor.yaw);
    const side = actor.vel.x * cy - actor.vel.z * sy;                      // +right
    let rollT = -clamp(side, -8, 8) * 0.0011;
    // slide roll
    const slideTarget = m.sliding ? 0.045 * m.slideSide : 0;
    S.slideRoll += (slideTarget - S.slideRoll) * (1 - Math.exp(-9 * dt));
    rollT -= S.slideRoll;
    r = spring(S.roll, S.rollV, rollT, 16, 1, dt); S.roll = r[0]; S.rollV = r[1];
    // airborne pitch lean (very small)
    const airP = m.onGround ? 0 : clamp(actor.vel.y * 0.0007, -0.012, 0.01);
    // fov kick
    const sm = clamp((hs - 4.5) / (11 - 4.5), 0, 1); let fovT = (sm * sm * (3 - 2 * sm)) * 4.5 * DEG + m.slideK * 2.2 * DEG;
    r = spring(S.fov, S.fovV, fovT, 9, 1, dt); S.fov = r[0]; S.fovV = r[1];
    // punch springs
    critical(S.recoil, S.recoilV, S.recoilW, dt); critical(S.flinch, S.flinchV, S.flinchW, dt);
    S.co.y = bobY + S.landY; S.co.x = bobX;
    S.co.roll = bobRoll + S.roll + S.recoil[2] + S.flinch[2];
    S.co.pitch = bobPitch + S.tiltP + airP + m.slideK * -0.02 + S.recoil[0] + S.flinch[0];
    S.co.fov = S.fov;
    api.aimPunch.x = S.recoil[0]; api.aimPunch.y = S.recoil[1]; api.aimPunch.z = S.recoil[2];
    S.camYawOff = S.recoil[1] + S.flinch[1];
  }

  // ---- fixed update ------------------------------------------------------------------------------
  function fixedUpdate(dt) {
    applyLook();
    S.tick++;
    const m = sim.ensure(actor);
    const inp = ctx.input, live = inp.locked;
    m.frozen = api.frozen && actor.alive;
    m.autoBhop = !!ctx.settings.get('autoBhop');
    if (!actor.alive && S.mode === 'play') {
      S.mode = 'death'; S.deathT = 0; S.deathEye.copy(S.ce); S.deathDrop = 0; S.camYaw = actor.yaw; S.camPitch = actor.pitch;
    }
    if (S.mode === 'play') {
      let f = 0, r = 0;
      if (live) { f = (inp.down('forward') ? 1 : 0) - (inp.down('back') ? 1 : 0); r = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0); }
      let crouch = live && inp.down('crouch');
      if (ctx.settings.get('crouchToggle')) { if (crouch && !S.crouchPrev) S.crouchLatch = !S.crouchLatch; S.crouchPrev = crouch; crouch = S.crouchLatch; }
      cmd.forward = f; cmd.right = r; cmd.jump = live && inp.down('jump'); cmd.crouch = crouch; cmd.walk = live && inp.down('walk'); cmd.yaw = actor.yaw; cmd.pitch = actor.pitch;
      sim.simulate(actor, cmd, dt);
      fixedView(dt);
    } else {
      cmd.forward = cmd.right = 0; cmd.jump = cmd.crouch = cmd.walk = false; cmd.yaw = actor.yaw; cmd.pitch = actor.pitch;
      if (S.mode === 'death') { actor.alive = actor.alive; sim.simulate(actor, cmd, dt); S.deathT += dt; }
      critical(S.recoil, S.recoilV, S.recoilW, dt); critical(S.flinch, S.flinchV, S.flinchW, dt);
      if (S.mode === 'spectate' && S.target) { S.tp.copy(S.tc); S.tc.set(S.target.pos.x, S.target.pos.y + S.target.eyeHeight, S.target.pos.z); }
      if (S.mode === 'free') freeStep(dt);
      if (S.mode === 'death' && S.deathT > 1.6) {
        const tm = (ctx.actors || []).filter((a) => a !== actor && a.alive && a.team === actor.team);
        const next = S.killer?.alive ? S.killer : tm[0];
        if (next) api.spectate(next); else api.spectate(null);
      }
      if (S.mode === 'spectate' || S.mode === 'free') {
        if (live && inp.pressed('fire')) api.nextSpectate(1);
        if (live && inp.pressed('aim')) api.nextSpectate(-1);
        if (live && inp.pressed('jump')) api.spectate(S.mode === 'free' ? (ctx.actors.find((a) => a !== actor && a.alive && a.team === actor.team) || null) : null);
        if (S.mode === 'spectate' && S.target && !S.target.alive) api.nextSpectate(1);
      }
    }
    // telemetry ring
    const h = S.hist, o = (S.histN % 600) * 8, m2 = actor.move;
    h[o] = S.tick; h[o + 1] = m2.speed; h[o + 2] = m2.tickAccel; h[o + 3] = m2.onGround ? 1 : 0; h[o + 4] = actor.pos.y; h[o + 5] = actor.vel.y; h[o + 6] = m2.sliding ? 1 : 0; h[o + 7] = m2.crouching ? 1 : 0; S.histN++;
    if (S.snap) { S.snap = false; S.pe.copy(S.ce); Object.assign(S.po, S.co); if (S.mode === 'spectate') S.tp.copy(S.tc); }
  }
  function freeStep(dt) {
    const inp = ctx.input; const sp = (inp.down('walk') ? 3 : inp.down('crouch') ? 25 : 12);
    const f = (inp.down('forward') ? 1 : 0) - (inp.down('back') ? 1 : 0), r = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0), u = (inp.down('jump') ? 1 : 0);
    const cp = Math.cos(S.camPitch);
    const tx = (-Math.sin(S.camYaw) * cp * f + Math.cos(S.camYaw) * r) * sp, ty = (Math.sin(S.camPitch) * f + u) * sp, tz = (-Math.cos(S.camYaw) * cp * f - Math.sin(S.camYaw) * r) * sp;
    const k = 1 - Math.exp(-10 * dt); S.freeVel.x += (tx - S.freeVel.x) * k; S.freeVel.y += (ty - S.freeVel.y) * k; S.freeVel.z += (tz - S.freeVel.z) * k;
    S.freePos.addScaledVector(S.freeVel, dt);
  }

  // ---- per-frame camera -----------------------------------------------------------------------------
  const _e = new THREE.Euler(0, 0, 0, 'YXZ');
  let lastFov = -1, lastAspect = -1;
  function update(dt, alpha) {
    applyLook();
    const cam = ctx.render?.camera; if (!cam) return;
    const a = alpha ?? 1;
    let yaw, pitch, roll = 0, fovAdd = 0;
    if (S.mode === 'play') {
      cam.position.set(S.pe.x + (S.ce.x - S.pe.x) * a, S.pe.y + (S.ce.y - S.pe.y) * a, S.pe.z + (S.ce.z - S.pe.z) * a);
      const oy = S.po.y + (S.co.y - S.po.y) * a, ox = S.po.x + (S.co.x - S.po.x) * a;
      cam.position.y += oy; cam.position.x += ox * Math.cos(actor.yaw); cam.position.z -= ox * Math.sin(actor.yaw);
      yaw = actor.yaw + (S.camYawOff || 0); pitch = actor.pitch + S.po.pitch + (S.co.pitch - S.po.pitch) * a; roll = S.po.roll + (S.co.roll - S.po.roll) * a; fovAdd = S.po.fov + (S.co.fov - S.po.fov) * a;
    } else if (S.mode === 'death') {
      const t = S.deathT, e = 1 - Math.exp(-3.2 * t);
      cam.position.set(S.deathEye.x, S.deathEye.y - 0.7 * e, S.deathEye.z);
      let ty = actor.yaw, tp = actor.pitch;
      if (S.killer) { const k = S.killer; const dx = k.pos.x - cam.position.x, dz = k.pos.z - cam.position.z, dy = k.pos.y + 1.3 - cam.position.y; ty = Math.atan2(-dx, -dz); tp = Math.atan2(dy, Math.hypot(dx, dz)); }
      let dyaw = ty - S.camYaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      const k2 = 1 - Math.exp(-5 * dt); S.camYaw += dyaw * k2; S.camPitch += (tp - S.camPitch) * k2;
      yaw = S.camYaw; pitch = S.camPitch; roll = 0.35 * e * (S.killer ? 1 : 0.6);
    } else if (S.mode === 'spectate' && S.target) {
      cam.position.set(S.tp.x + (S.tc.x - S.tp.x) * a, S.tp.y + (S.tc.y - S.tp.y) * a, S.tp.z + (S.tc.z - S.tp.z) * a);
      let dy = S.target.yaw - S.camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); S.camYaw += dy * (1 - Math.exp(-18 * dt)); S.camPitch += (S.target.pitch - S.camPitch) * (1 - Math.exp(-18 * dt));
      yaw = S.camYaw; pitch = S.camPitch;
    } else { cam.position.copy(S.freePos); yaw = S.camYaw; pitch = S.camPitch; }
    _e.set(clamp(pitch, -1.553, 1.553), yaw, roll, 'YXZ'); cam.quaternion.setFromEuler(_e);
    // fov: settings.fov is HORIZONTAL degrees; convert to vertical for the current aspect, add kick, apply zoom
    S.zoomCur += (S.zoom - S.zoomCur) * (1 - Math.exp(-14 * dt));
    const hf = (ctx.settings.get('fov') ?? 100) * DEG + fovAdd, asp = cam.aspect || 16 / 9;
    const vf = 2 * Math.atan(Math.tan(hf / 2) / asp * S.zoomCur) / DEG;
    if (Math.abs(vf - lastFov) > 0.002 || asp !== lastAspect) { cam.fov = vf; cam.updateProjectionMatrix(); lastFov = vf; lastAspect = asp; }
    // info for viewmodel / HUD
    const m = actor.move;
    viewInfo.speed = m.speed3; viewInfo.hspeed = m.speed; viewInfo.onGround = m.onGround; viewInfo.crouch = m.crouching; viewInfo.walking = m.walking; viewInfo.sliding = m.sliding;
    viewInfo.aimPunch.x = S.recoil[0]; viewInfo.aimPunch.y = S.recoil[1];
    viewInfo.lookDelta.x = S.lookDx; viewInfo.lookDelta.y = S.lookDy; S.lookDx = S.lookDy = 0;
    viewInfo.roll = roll; viewInfo.landDip = S.landY;
  }

  // ---- debug ---------------------------------------------------------------------------------------
  let course = null;
  api.debug = {
    telemetry() {
      const m = actor.move, h = S.hist, n = Math.min(S.histN, 600), ticks = [];
      for (let i = Math.max(0, n - 30); i < n; i++) { const o = ((S.histN - n + i) % 600) * 8; ticks.push({ tick: h[o], speed: h[o + 1], accel: h[o + 2], ground: !!h[o + 3], y: h[o + 4], vy: h[o + 5] }); }
      return { speed: m.speed, speed3: m.speed3, vy: actor.vel.y, accel: m.tickAccel, onGround: m.onGround, sliding: m.sliding, crouching: m.crouching, airTime: m.airTime, accurate: m.accurate, inaccuracy: m.inaccuracy, ground: [m.gnx, m.gny, m.gnz], pos: actor.pos.toArray(), mode: S.mode, recent: ticks };
    },
    history() { const n = Math.min(S.histN, 600), out = []; for (let i = 0; i < n; i++) { const o = ((S.histN - n + i) % 600) * 8; out.push([...S.hist.subarray(o, o + 8)]); } return out; },
    tune(o) { Object.assign(TUNE, o); return { ...TUNE }; },
    goto(name) { const s = course?.stations[name]; if (!s) return null; api.respawn({ pos: { x: s.x, y: s.y, z: s.z }, yaw: s.yaw }); return s; },
    get course() { return course; },
    enterCourse() { return enterCourse(); }, exitCourse() { exitCourse(); },
    punchTest() { api.punch(0.05, 0.01, 0.01); },
  };
  function enterCourse() {
    if (course) return course;
    const c = buildCourse();
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(c.positions, 3)); geo.boundsTree = new MeshBVH(geo);
    const col = new THREE.Mesh(geo); col.visible = false;
    const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.BufferAttribute(c.positions, 3)); vg.setAttribute('color', new THREE.BufferAttribute(c.colors, 3)); vg.computeVertexNormals();
    const mesh = new THREE.Mesh(vg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 })); mesh.receiveShadow = mesh.castShadow = true;
    const grid = new THREE.GridHelper(120, 120, 0x556070, 0x7c8796); grid.position.y = 0.01; grid.material.opacity = 0.35; grid.material.transparent = true;
    const grp = new THREE.Group(); grp.add(mesh, grid); ctx.render.scene.add(grp);
    course = { group: grp, collider: col, stations: c.stations, prevCollider: ctx.map?.collider, prevVisible: ctx.map?.group?.visible, geo, vg };
    if (ctx.map) { ctx.map.collider = col; if (ctx.map.group) ctx.map.group.visible = false; }
    return course;
  }
  function exitCourse() {
    if (!course) return;
    if (ctx.map) { ctx.map.collider = course.prevCollider; if (ctx.map.group) ctx.map.group.visible = course.prevVisible ?? true; }
    ctx.render.scene.remove(course.group); course.geo.dispose(); course.vg.dispose(); course = null;
  }
  ctx.debugScenes['movement-course'] = async () => {
    enterCourse();
    const want = ctx.params.get('station') || 'start';
    api.debug.goto(want) || api.debug.goto('start');
  };

  return Object.assign(api, { fixedUpdate, update, dispose() { exitCourse(); } });
}
