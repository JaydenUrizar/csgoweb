// Procedural animation: locomotion (world-planted foot IK synced to stride distance), aim upper-body, tagger hold poses
// with arm IK, action layers (fire/reload/switch/throw/melee/plant/hit/land) and springs. All scratch objects are module
// level: no allocation in the per-frame path.
import * as THREE from 'three';
import { B, SEG } from './body.js';
import { HOLD, RELOAD } from './weapons.js';
import { PLAYER } from '../core/config.js';

const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
const lerpAngle = (a, b, t) => a + wrap(b - a) * t;
export { clamp, lerp, sstep, wrap };

const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), DOWN = new THREE.Vector3(0, -1, 0);
const _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _J = new THREE.Vector3(), _T = new THREE.Vector3(), _pole = new THREE.Vector3(), _d = new THREE.Vector3(),
  _dn = new THREE.Vector3(), _pp = new THREE.Vector3(), _K = new THREE.Vector3(), _u = new THREE.Vector3(), _l = new THREE.Vector3(), _wr = new THREE.Vector3();
const _pPos = new THREE.Vector3(), _cPos = new THREE.Vector3(), _pQ = new THREE.Quaternion(), _cQ = new THREE.Quaternion(), _pQi = new THREE.Quaternion(), _cQi = new THREE.Quaternion();
const _qU = new THREE.Quaternion(), _qL = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _qAim = new THREE.Quaternion(), _qHold = new THREE.Quaternion(), _qPL = new THREE.Quaternion();
const _e = new THREE.Euler(), _pv = new THREE.Vector3(), _pl = new THREE.Vector3(), _lv = new THREE.Vector3();
const RX90 = new THREE.Quaternion().setFromAxisAngle(X, PI / 2);
const HAND_LEN = 0.045, _pouch = new THREE.Vector3();

/** Two-bone IK in parent space. J joint, T target, returns local quats for upper (qU) and lower (qL, relative to upper). */
function ik2(J, T, l1, l2, pole, qU, qL) {
  _d.subVectors(T, J); let dist = _d.length();
  const maxR = (l1 + l2) * 0.9995, minR = Math.abs(l1 - l2) + 0.02;
  if (dist < 1e-5) { _d.set(0, -1, 0); dist = minR; } else _d.multiplyScalar(1 / dist);
  dist = clamp(dist, minR, maxR); _dn.copy(_d);
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  _pp.copy(pole).addScaledVector(_dn, -pole.dot(_dn));
  if (_pp.lengthSq() < 1e-6) _pp.set(0, 0, -1).addScaledVector(_dn, _dn.z);
  _pp.normalize();
  _K.copy(J).addScaledVector(_dn, a).addScaledVector(_pp, h);
  _u.subVectors(_K, J).multiplyScalar(1 / l1);
  _l.copy(J).addScaledVector(_dn, dist).sub(_K).multiplyScalar(1 / l2);
  qU.setFromUnitVectors(DOWN, _u);
  _qc.setFromUnitVectors(DOWN, _l); qL.copy(qU).invert().multiply(_qc);
}

// ------------------------------------------------------------------ helpers used by events
export const spring = (s, dt, k = 300, c = 22) => { s[1] += (-k * s[0] - c * s[1]) * dt; s[0] += s[1] * dt; };
function keys(arr, s) {               // arr = [[t, ...values]] smooth interpolation, returns into _kv
  let i = 0; while (i < arr.length - 2 && s > arr[i + 1][0]) i++;
  const a = arr[i], b = arr[i + 1], t = sstep((s - a[0]) / Math.max(1e-6, b[0] - a[0]));
  for (let k = 1; k < a.length; k++) _kv[k - 1] = lerp(a[k], b[k], t);
  return _kv;
}
const _kv = [0, 0, 0, 0, 0, 0, 0, 0];
const MELEE_K = [[0, 0, 0, 0, 0, 0, 0], [0.3, 0.06, 0.4, 0.18, -1.35, 0.3, 0.55], [0.52, -0.16, 0.0, -0.32, -0.15, 0.1, -0.7], [0.66, -0.1, -0.02, -0.28, -0.05, 0.05, -0.4], [1, 0, 0, 0, 0, 0, 0]];
const THROW_K = [[0, 0.12, 0.58, 0.38, 1.25, 0, 0], [0.2, 0.0, 0.3, 0.1, 0.6, 0, 0], [0.34, -0.08, 0.1, -0.45, -0.6, 0, 0], [0.62, -0.14, -0.25, -0.2, -1.0, 0, 0], [1, 0, 0, 0, 0, 0, 0]];

export function plantModeOf(ctx, a, m) {
  if (m.dbg && m.dbg.plant != null) return m.dbg.plant;
  const s = a.action || a.interact || a.move?.action;
  if (s === 'plant' || s === 'arm') return 1; if (s === 'disarm' || s === 'defuse') return 2;
  if (a.planting) return 1; if (a.disarming) return 2;
  const b = ctx.match?.beacon;
  if (b) { if (b.state === 'arming' && b.carrier === a) return 1; if (b.state === 'disarming' && (b.disarmer === a || b.defuser === a || a.disarming)) return 2; }
  return 0;
}

function footPitch(f, moving) {
  if (f.mode === 1) return lerp(-0.45, 0.3, sstep(f.t));
  if (moving) { const us = f.stanceU; if (us < 0.15) return 0.3 * (1 - us / 0.15); if (us > 0.6) return -0.5 * sstep((us - 0.6) / 0.4); }
  return 0;
}

export function resetFeet(m) {
  const hy = m.hipsYaw, c = Math.cos(hy), s = Math.sin(hy);
  for (const f of m.feet) { const nx = f.sgn * 0.14; f.p.set(m.rp.x + nx * c, m.gy, m.rp.z - nx * s); f.mode = 0; f.t = 0; f.yaw = hy + f.sgn * 0.08; f.pitch = 0; f.lift = 0; f.idleT = 0; }
  m.feetInit = true;
}

// ------------------------------------------------------------------ main update
/** ctx: game ctx; m: model; returns nothing. Sets bone transforms, updates world matrices & shader uniforms. */
export function animate(ctx, m, dt, alpha) {
  const a = m.actor, dbg = m.dbg, bones = m.bones, sp = m.sp, u = m.u;
  dt = clamp(dt, 1e-4, 0.05); m.time += dt;
  // ---------------------------------------------------------------- kinematics
  m.rp.lerpVectors(m.prev, m.cur, clamp(alpha, 0, 1));
  const rp = m.rp;
  if (rp.distanceToSquared(m.lastRp) > 9) { m.lastRp.copy(rp); m.vx = m.vz = 0; m.gy = rp.y; m.feetInit = false; m.hipsYaw = a.yaw; }
  const tread = !!(dbg && dbg.vel);
  m.treadmill = tread;
  let tvx, tvz;
  if (tread) { const sy = Math.sin(a.yaw), cy = Math.cos(a.yaw); tvx = dbg.vel.x * cy + dbg.vel.z * sy; tvz = -dbg.vel.x * sy + dbg.vel.z * cy; m.vx = tvx; m.vz = tvz; }
  else {
    tvx = (rp.x - m.lastRp.x) / dt; tvz = (rp.z - m.lastRp.z) / dt;
    const k = 1 - Math.exp(-dt / 0.05); m.vx += (tvx - m.vx) * k; m.vz += (tvz - m.vz) * k;
  }
  const tvy = dbg && dbg.vy != null ? dbg.vy : tread ? 0 : (rp.y - m.lastRp.y) / dt; m.vy += (tvy - m.vy) * (1 - Math.exp(-dt / 0.05));
  m.lastRp.copy(rp);
  m.speed = Math.hypot(m.vx, m.vz);
  const speed = m.speed;
  const moving = speed > (m.moving ? 0.3 : 0.6);
  m.moving = moving;
  const onGround = dbg && dbg.air ? false : (a.onGround !== false && !(m.vy > 2.8 || m.vy < -4.5));
  // ground height (smoothed for stairs)
  if (onGround && Math.abs(rp.y - m.gy) < 0.7) m.gy += (rp.y - m.gy) * (1 - Math.exp(-dt * 22)); else m.gy = rp.y;
  const gy = m.gy;

  // crouch / slide / plant
  const pm = plantModeOf(ctx, a, m); m.plantMode = pm;
  let ct = Math.max(typeof a.crouchT === 'number' ? a.crouchT : 0, a.crouching ? 1 : 0, clamp((PLAYER.height - (a.height || PLAYER.height)) / (PLAYER.height - PLAYER.crouchHeight), 0, 1));
  if (dbg && dbg.crouch != null) ct = dbg.crouch;
  if (pm) ct = Math.max(ct, 0.9);
  m.crouch += clamp(ct - m.crouch, -dt * 7, dt * 7);
  const cr = m.crouch;
  const slideT = (dbg && dbg.slide) || a.sliding || a.move?.sliding ? 1 : 0;
  m.slideW += clamp(slideT - m.slideW, -dt * 8, dt * 8);
  const slideW = m.slideW;
  m.plantW += clamp((pm ? 1 : 0) - m.plantW, -dt * 6, dt * 6);
  const plantW = m.plantW;
  // air
  if (!onGround) m.airTime = (m.airTime || 0) + dt; else m.airTime = 0;
  const airT = !onGround && m.airTime > 0.07 ? 1 : 0;
  const wasAir = m.airW > 0.5;
  m.airW += clamp(airT - m.airW, -dt * 12, dt * 12);
  if (wasAir && airT === 0 && m.airW <= 0.5 + 1e-3 && !m.landedFlag) { /* handled below */ }
  if (m.wasAir && !airT) { landImpact(m, Math.max(0, -m.fallV || 0)); }
  if (airT) m.fallV = m.vy;
  m.wasAir = !!airT;
  const airW = m.airW;
  m.jumpT += dt; m.landT += dt;
  const gaitOn = moving && onGround && slideW < 0.5;

  // ---------------------------------------------------------------- hips yaw
  let legOff = 0;
  if (moving && slideW < 0.5) {
    const sA = Math.sin(a.yaw), cA = Math.cos(a.yaw), lx = m.vx * cA - m.vz * sA, lz = m.vx * sA + m.vz * cA;
    let th = Math.atan2(lx, -lz); if (th > PI / 2) th -= PI; else if (th < -PI / 2) th += PI;
    legOff = clamp(-th * 0.32, -0.62, 0.62);
  }
  m.legOffset += (legOff - m.legOffset) * (1 - Math.exp(-dt * 10));
  let target = a.yaw + m.legOffset;
  if (slideW > 0.3 && speed > 1) target = Math.atan2(-m.vx, -m.vz);
  if (moving || airW > 0.5 || slideW > 0.3) { m.hipsYaw += wrap(target - m.hipsYaw) * (1 - Math.exp(-dt * 12)); m.turning = false; }
  else {
    const dy = wrap(a.yaw - m.hipsYaw);
    if (Math.abs(dy) > 0.95) m.turning = true;
    if (m.turning) { m.hipsYaw += dy * (1 - Math.exp(-dt * 8)); if (Math.abs(dy) < 0.16) m.turning = false; }
  }
  m.hipsYaw = wrap(m.hipsYaw);
  const hy = m.hipsYaw, ch = Math.cos(hy), sh = Math.sin(hy);
  const vlx = m.vx * ch - m.vz * sh, vlz = m.vx * sh + m.vz * ch;   // velocity in hips frame (x right, z back)
  const sN = speed, run = sstep((sN - 1.5) / 3.7);
  const gaitW = gaitOn ? 1 : 0; m.gaitW = (m.gaitW || 0) + (gaitW - (m.gaitW || 0)) * (1 - Math.exp(-dt * 10));

  // ---------------------------------------------------------------- gait parameters + phase
  let C = clamp(0.8 + 0.28 * sN, 1.2, 2.6) * (1 - 0.28 * cr);
  const hmax = 0.44 - 0.16 * cr;
  let duty = lerp(0.62, 0.36, sstep((sN - 2.0) / 3.2)) + 0.05 * cr; duty = Math.min(duty, 2 * hmax / C);
  const h = duty * C * 0.5, liftAmp = lerp(0.1, 0.22, run) * (1 - 0.12 * cr) + 0.025 * cr;
  if (gaitOn) { m.phase += sN * dt / C; if (m.phase > 1e3) m.phase -= 1e3; }
  if (m.phasePending) { const pc = m.phasePending * (1 - Math.exp(-dt * 14)); m.phase += pc; m.phasePending -= pc; if (Math.abs(m.phasePending) < 1e-4) m.phasePending = 0; }
  const ph = m.phase;

  // ---------------------------------------------------------------- feet (world planted)
  if (!m.feetInit) resetFeet(m);
  const dWx = sN > 1e-3 ? m.vx / sN : 0, dWz = sN > 1e-3 ? m.vz / sN : 0, dlx = sN > 1e-3 ? vlx / sN : 0, dlz = sN > 1e-3 ? vlz / sN : -1;
  for (let i = 0; i < 2; i++) {
    const f = m.feet[i], sg = f.sgn;
    const nx = sg * (0.14 + 0.03 * cr), nz = -0.03 * cr;
    const nwx = rp.x + nx * ch + nz * sh, nwz = rp.z - nx * sh + nz * ch, toe = hy + sg * 0.08 + (sg * 0.06 * cr);
    if (tread) { f.p.x -= m.vx * dt; f.p.z -= m.vz * dt; f.sp.x -= m.vx * dt; f.sp.z -= m.vz * dt; }
    if (airW > 0.5 || (!onGround && m.airTime > 0.07)) {
      // ---- airborne pose (foot targets in hips frame)
      const up = clamp(m.vy / 4.5, -1, 1), t = (up + 1) * 0.5, lead = i === 0;
      let lz = lead ? lerp(-0.14, 0.12, t) : lerp(0.1, -0.1, t), ly = lead ? lerp(0.1, 0.34, t) : lerp(0.05, 0.26, t);
      const tuck = Math.exp(-m.jumpT * 5) * 0.1; ly += tuck; lz += -dlz * 0.0;
      const lx = sg * 0.17;
      f.p.set(rp.x + lx * ch + lz * sh, gy, rp.z - lx * sh + lz * ch); f.lift = ly; f.mode = 1; f.t = 0.5; f.sp.copy(f.p); f.yawStart = f.yaw; f.yaw = lerpAngle(f.yaw, toe, 0.3); f.pitch = lerp(0.35, -0.25, t) * (lead ? 1 : 0.7);
      f.airPose = true; continue;
    }
    if (f.airPose) { f.airPose = false; f.mode = 1; f.t = 0.35; f.sp.copy(f.p); f.yawStart = f.yaw; f.landing = true; }
    if (plantW > 0.5 && moving === false) {
      const lead = i === 0, lx = sg * 0.15, lz = lead ? -0.34 : 0.3, ly = lead ? 0.0 : 0.2;
      f.p.set(rp.x + lx * ch + lz * sh, gy, rp.z - lx * sh + lz * ch); f.lift = ly; f.mode = 1; f.t = 0.5; f.sp.copy(f.p); f.yaw = lerpAngle(f.yaw, hy, 0.3); f.pitch = lead ? 0 : -1.0; f.airPose = true; continue;
    }
    if (slideW > 0.5) {
      const lead = i === 0, lx = sg * 0.13, lz = lead ? -0.6 : -0.12, ly = lead ? 0.05 : 0.03;
      f.p.set(rp.x + lx * ch + lz * sh, gy, rp.z - lx * sh + lz * ch); f.lift = ly; f.mode = 1; f.t = 0.5; f.sp.copy(f.p); f.yaw = lerpAngle(f.yaw, hy, 0.3); f.pitch = lead ? 0.5 : 0.0; f.airPose = true; continue;
    }
    if (gaitOn) {
      const pf = (((ph + i * 0.5) % 1) + 1) % 1;
      if (pf < duty) { if (f.mode === 1) { f.mode = 0; f.landing = false; f.yaw = lerpAngle(f.yawStart ?? f.yaw, toe, 1); } f.stanceU = pf / duty; }
      else { const u2 = (pf - duty) / (1 - duty); if (f.mode === 0) { f.mode = 1; f.sp.copy(f.p); f.yawStart = f.yaw; } f.t = u2; }
    } else if (f.mode === 0) {
      // ---- idle stepping: replant when displaced / turned
      f.stanceU = 0.5; f.idleT += dt;
      const dx = f.p.x - nwx, dz = f.p.z - nwz, err = Math.hypot(dx, dz), yerr = Math.abs(wrap(f.yaw - toe)), other = m.feet[1 - i];
      if (other.mode === 0 && (err > 0.3 || yerr > 0.8 || (f.idleT > 0.35 && (err > 0.05 || yerr > 0.14)))) { f.mode = 1; f.t = 0; f.sp.copy(f.p); f.yawStart = f.yaw; f.idleT = 0; f.landing = false; }
    }
    if (f.mode === 1) {
      let uu;
      if (gaitOn) uu = f.t; else { f.t += dt / (f.landing ? 0.22 : 0.26); uu = f.t; if (uu >= 1) { f.mode = 0; f.t = 0; f.yaw = toe; f.p.x = nwx; f.p.z = nwz; f.idleT = 0; f.lift = 0; f.landing = false; f.pitch = 0; continue; } }
      let tx, tz;
      if (gaitOn) {
        const Lrem = (1 - uu) * (1 - duty) * C, tlx = nx + dlx * h, tlz = nz + dlz * h, lead = tread ? 0 : Lrem;
        tx = rp.x + tlx * ch + tlz * sh + dWx * lead; tz = rp.z - tlx * sh + tlz * ch + dWz * lead;
      } else { tx = nwx; tz = nwz; }
      const e = sstep(uu);
      f.p.x = lerp(f.sp.x, tx, e); f.p.z = lerp(f.sp.z, tz, e);
      f.lift = (gaitOn ? liftAmp : 0.11) * Math.sin(PI * Math.pow(uu, 0.8));
      f.yaw = lerpAngle(f.yawStart ?? f.yaw, gaitOn ? hy + sg * 0.05 : toe, e);
    } else f.lift = 0;
    f.pitch = footPitch(f, gaitOn);
    if (f.mode === 0 && f.pitch < 0) f.lift += 0.09 * Math.sin(-f.pitch);
  }

  // ---------------------------------------------------------------- pelvis & torso
  let bobAmp = lerp(0.012, 0.034, run) * (1 - 0.5 * cr) * m.gaitW;
  let hipY = lerp(0.885, 0.44, cr) - 0.018 * run * m.gaitW + bobAmp * -Math.cos(4 * PI * ph) + sp.land[0];
  hipY = lerp(hipY, lerp(0.84, 0.6, cr), airW); hipY = lerp(hipY, 0.4, slideW);
  const pel = bones[B.pelvis];
  pel.position.set(0, hipY, 0.11 * cr + 0.05 * slideW);
  const gw = m.gaitW, sPh = Math.sin(TAU * ph);
  let pPitch = clamp(0.042 * vlz, -0.26, 0.14) * (1 - airW * 0.5) - 0.3 * cr + 0.5 * slideW - 0.6 * plantW + sp.land[0] * 0.8;
  const pRoll = -0.02 * vlx * (1 - airW) + 0.045 * sPh * gw * (0.5 + run) - 0.12 * airW * clamp(vlx / 5, -1, 1);
  const pYaw = -0.11 * sPh * gw * (0.4 + run);
  _e.set(pPitch, pYaw, pRoll, 'YXZ'); pel.quaternion.setFromEuler(_e);
  const twist = clamp(wrap(a.yaw - hy), -1.3, 1.3);
  const pit = clamp(a.pitch, -1.35, 1.35), br = 0.5 + 0.5 * Math.sin(m.time * 1.7 + m.id), breath = (1 - m.gaitW) * 0.6 + 0.4;
  const spine = bones[B.spine], chest = bones[B.chest], neck = bones[B.neck], head = bones[B.head];
  _e.set(-0.5 * pPitch + pit * 0.24 + 0.008 * br * breath + 0.12 * plantW, (twist - pYaw) * 0.38, -0.5 * pRoll, 'YXZ'); spine.quaternion.setFromEuler(_e);
  chest.position.y = 0.2 + 0.0035 * br * breath;
  _e.set(pit * 0.34 + sp.fp[0] + sp.recoilChest[0] - 0.14 * (m.reloadW || 0), (twist - pYaw) * 0.62 + sp.fy[0] + 0.1 * sPh * gw * run, -0.35 * pRoll + sp.fr[0] - 0.03 * sPh * gw * run, 'YXZ'); chest.quaternion.setFromEuler(_e);
  _e.set(pit * 0.2 + sp.hp[0], 0, sp.hr[0], 'YXZ'); neck.quaternion.setFromEuler(_e);
  _e.set(pit * 0.2 - 0.3 * (m.reloadW || 0) - 0.12 * (m.aimW ?? 1) * 0, 0.08 * (m.reloadW || 0), 0.06 * (m.aimW ?? 1), 'YXZ'); head.quaternion.setFromEuler(_e);
  m.root.position.set(rp.x, gy, rp.z); m.root.rotation.y = hy;
  m.root.updateMatrixWorld(true);
  _pQ.setFromRotationMatrix(pel.matrixWorld); _pPos.setFromMatrixPosition(pel.matrixWorld); _pQi.copy(_pQ).invert();
  _cQ.setFromRotationMatrix(chest.matrixWorld); _cPos.setFromMatrixPosition(chest.matrixWorld); _cQi.copy(_cQ).invert();

  // ---------------------------------------------------------------- legs IK
  for (let i = 0; i < 2; i++) {
    const f = m.feet[i], sg = f.sgn, uL = bones[i === 0 ? B.uLegL : B.uLegR], lL = bones[i === 0 ? B.lLegL : B.lLegR], fT = bones[i === 0 ? B.footL : B.footR];
    _J.set(sg * SEG.hipX, -0.02, 0);
    _T.set(f.p.x, gy + SEG.ankleY + f.lift, f.p.z).sub(_pPos).applyQuaternion(_pQi);
    _pole.set(sg * 0.12, 0.0, -1);
    ik2(_J, _T, SEG.thigh, SEG.shin, _pole, _qU, _qL);
    uL.quaternion.copy(_qU); lL.quaternion.copy(_qL);
    _qa.setFromAxisAngle(Y, f.yaw); _qb.setFromAxisAngle(X, f.pitch); _qa.multiply(_qb);       // desired foot world quat
    _qc.copy(_pQi).multiply(_qa);                                                              // in pelvis space
    fT.quaternion.copy(_qU).multiply(_qL).invert().multiply(_qc);
  }

  // ---------------------------------------------------------------- tagger / hands
  updateUpper(ctx, m, dt, pit, run, cr, plantW, pm, airW, sPh, ph, gw);

  m.root.updateMatrixWorld(true);
  // uniforms
  m.hitFlash = Math.max(0, m.hitFlash - dt * 7);
  u.uTime.value = m.time;
  if (!m.tag) u.uFlash.value = m.hitFlash * 0.55;
  u.uMat.value = m.spawnT >= 0 ? sstep(m.spawnT / 0.8) : 1;
  if (m.spawnT >= 0) { m.spawnT += dt; if (m.spawnT > 0.85) { m.spawnT = -1; u.uMat.value = 1; } }
  // springs
  spring(sp.kz, dt, 420, 26); spring(sp.kp, dt, 380, 24); spring(sp.kr, dt, 380, 24);
  spring(sp.fp, dt, 240, 15); spring(sp.fr, dt, 240, 15); spring(sp.fy, dt, 240, 15); spring(sp.hp, dt, 300, 17); spring(sp.hr, dt, 300, 17);
  spring(sp.land, dt, 380, 23); spring(sp.recoilChest, dt, 420, 26);
  m.fireT += dt;
}

function landImpact(m, fallSpeed) {
  const fs = clamp(fallSpeed, 0, 14); m.landT = 0;
  m.sp.land[1] -= fs * 0.34 + 0.15; m.sp.recoilChest[1] -= fs * 0.03;
}
export { landImpact };

// ------------------------------------------------------------------ upper body / weapon / arms
function updateUpper(ctx, m, dt, pit, run, cr, plantW, pm, airW, sPh, ph, gw) {
  const a = m.actor, bones = m.bones, sp = m.sp, held = m.held;
  let cls = held.cls; if (pm) cls = 'carry';
  const H = HOLD[cls] || HOLD.none;
  // ---- readiness / low ready
  const shooting = m.fireT < 1.4 || (m.dbg && m.dbg.aim);
  const readyT = shooting || m.speed < 3.6 || m.reload || m.sw ? 1 : 0;
  m.aimW = (m.aimW ?? 1) + clamp(readyT - (m.aimW ?? 1), -dt * 5, dt * 5);
  const low = 1 - m.aimW;
  let px = H.pos[0], py = H.pos[1], pz = H.pos[2], rx = H.rot[0], ry = H.rot[1], rz = H.rot[2];
  const heavy = cls === 'melee' || cls === 'grenade' || cls === 'none' ? 0.3 : 1;
  py -= 0.05 * low * heavy; pz += 0.03 * low * heavy; rx -= 0.3 * low * heavy;
  // gait sway
  px += 0.022 * sPh * gw * (0.4 + run); py += 0.016 * Math.sin(2 * TAU * ph) * gw * (0.4 + run); pz += 0.02 * Math.cos(TAU * ph) * gw * run;
  const br = Math.sin(m.time * 1.7 + m.id) * 0.5 + 0.5; py += 0.003 * br * (1 - gw);
  // ---- fire kick
  pz += sp.kz[0]; rx += sp.kp[0]; rz += sp.kr[0];
  // ---- weapon switch
  let swOff = 0;
  if (m.sw) {
    const s = m.sw; s.t += dt;
    if (s.t < s.out) swOff = sstep(s.t / s.out);
    else { if (!s.done) { s.done = true; m.swapNow?.(m, s); } swOff = 1 - sstep((s.t - s.out) / s.in); if (s.t >= s.out + s.in) { m.sw = null; swOff = 0; } }
  }
  py -= 0.34 * swOff; rx -= 0.95 * swOff; pz += 0.05 * swOff; px += 0.06 * swOff;
  // ---- reload
  let LX = 0, LY = 0, LZ = 0, hasL = !!H.L, lroll = H.lroll;
  if (H.L) { LX = H.L[0]; LY = H.L[1]; LZ = H.L[2]; }
  if (m.reload) {
    const r = m.reload; r.t += dt; const s = clamp(r.t / r.dur, 0, 1), way = RELOAD[cls];
    if (way && H.L) {
      let i = 0; while (i < way.length - 2 && s > way[i + 1][0]) i++;
      const A = way[i], Bn = way[i + 1], t = sstep((s - A[0]) / Math.max(1e-6, Bn[0] - A[0]));
      LX = lerp(A[1], Bn[1], t); LY = lerp(A[2], Bn[2], t); LZ = lerp(A[3], Bn[3], t);
    }
    const bump = sstep(s / 0.12) * (1 - sstep((s - 0.84) / 0.14));
    const big = cls === 'pistol' ? 0.7 : 1;
    rx += 0.42 * bump * big; rz -= 0.5 * bump * big; py += 0.07 * bump; px -= 0.06 * bump; pz += 0.05 * bump;
    if (s > 0.64 && s < 0.8) { const k = Math.sin((s - 0.64) / 0.16 * PI); py -= 0.045 * k; rx -= 0.18 * k; }   // slam the mag home
    if (s > 0.32 && s < 0.5) { px += 0.03 * Math.sin((s - 0.32) / 0.18 * PI); }
    m.reloadW = bump; m.mag.visible = s > 0.3 && s < 0.7 && (cls !== 'shotgun');
    if (s >= 1) { m.reload = null; m.mag.visible = false; m.reloadW = 0; }
  }
  if (!m.reload) { m.reloadW = (m.reloadW || 0) * 0.85; if (m.mag.visible) m.mag.visible = false; }
  // ---- melee / throw
  if (m.meleeT >= 0) {
    m.meleeT += dt; const s = m.meleeT / 0.42;
    if (s >= 1) m.meleeT = -1; else { const k = keys(MELEE_K, s); px += k[0]; py += k[1]; pz += k[2]; rx += k[3]; ry += k[4]; rz += k[5]; sp.fy[1] += 0; }
  }
  m.hideHeld = false;
  if (m.throwT >= 0) {
    m.throwT += dt; const s = m.throwT / 0.62;
    if (s >= 1) { m.throwT = -1; m.ball.visible = false; }
    else {
      const k = keys(THROW_K, s); px += k[0]; py += k[1]; pz += k[2]; rx += k[3];
      if (s < 0.34) { m.ball.visible = true; if (cls === 'grenade') m.hideHeld = true; sp.fy[0] = 0.3 * (1 - s / 0.34); }
      else { m.ball.visible = false; if (!m.throwRel) { m.throwRel = true; sp.recoilChest[1] -= 1.8; sp.fy[1] -= 5; } }
    }
  } else m.throwRel = false;
  // ---- plant / disarm pose (device held low in front, both hands pressing)
  if (plantW > 0.01) {
    const press = Math.sin(m.time * 9) * 0.012 * (pm === 2 ? 1.5 : 1);
    px = lerp(px, 0.0, plantW); py = lerp(py, -0.62 + press, plantW); pz = lerp(pz, -0.3, plantW); rx = lerp(rx, -0.55, plantW); ry = lerp(ry, 0, plantW); rz = lerp(rz, 0, plantW);
  }
  // ---- compose pivot in chest space
  _e.set(a.pitch, a.yaw, 0, 'YXZ'); _qAim.setFromEuler(_e);
  _e.set(rx, ry, rz, 'YXZ'); _qHold.setFromEuler(_e);
  _pv.set(px, py, pz).applyQuaternion(_qAim);
  _p.set(0, 0.22, 0).applyQuaternion(_cQ).add(_cPos).add(_pv);                 // pivot world
  if (plantW > 0.01) { const fy = -Math.sin(a.yaw), fz2 = -Math.cos(a.yaw); _p.lerp(_p2.set(m.rp.x + fy * 0.42, m.gy + 0.3 + Math.sin(m.time * 9) * 0.012, m.rp.z + fz2 * 0.42), plantW); }
  _pl.copy(_p).sub(_cPos).applyQuaternion(_cQi);                               // chest space
  _qPL.copy(_cQi).multiply(_qAim).multiply(_qHold);
  m.pivot.position.copy(_pl); m.pivot.quaternion.copy(_qPL);
  // ---- arms
  const mountR = bones[B.uArmR], mountL = bones[B.uArmL];
  const hasR = cls !== 'none' || plantW > 0.01 || true;
  // right hand target
  _J.set(SEG.shoulderX, 0.22, 0);
  const grip = cls !== 'none';
  let armPh = sPh;
  if (grip) {
    _qb.copy(_qPL).multiply(RX90); _qc.setFromAxisAngle(Y, H.rroll || 0); _qb.multiply(_qc);   // hand world (chest space)
    _wr.set(0, HAND_LEN, 0).applyQuaternion(_qb).add(_pl);
    solveArm(m, 1, _wr, _qb, run, cr);
  } else relaxedArm(m, 1, armPh, run, gw, cr);
  // left hand
  if (hasL || plantW > 0.01) {
    let lx = LX, ly = LY, lz = LZ, roll = lroll;
    if (plantW > 0.01 && !H.L) { lx = -0.12; ly = -0.02; lz = 0; roll = 1.4; }
    if (plantW > 0.01) { lx = lerp(lx, -0.12, plantW); ly = lerp(ly, -0.03, plantW); lz = lerp(lz, 0, plantW); roll = lerp(roll, 1.4, plantW); }
    _lv.set(lx, ly, lz);
    // slide the foregrip toward the grip if out of reach
    _p2.copy(_lv).applyQuaternion(_qPL).add(_pl);
    if (m.reload) { const rs = clamp(m.reload.t / m.reload.dur, 0, 1), pw = sstep((rs - 0.12) / 0.16) * (1 - sstep((rs - 0.5) / 0.14)); _p2.lerp(_pouch.set(-0.14, -0.16, -0.18), pw); }
    _wr.set(-SEG.shoulderX, 0.22, 0).sub(_p2); const dist = _wr.length();
    if (dist > 0.7 && lz < -0.1) { _lv.z += Math.min(0.26, (dist - 0.7) * 0.9); _p2.copy(_lv).applyQuaternion(_qPL).add(_pl); }
    _qb.copy(_qPL).multiply(RX90); _qc.setFromAxisAngle(Y, roll); _qb.multiply(_qc);
    _wr.set(0, HAND_LEN, 0).applyQuaternion(_qb).add(_p2);
    solveArm(m, -1, _wr, _qb, run, cr);
  } else relaxedArm(m, -1, -armPh, run, gw, cr);
}

const _hq = new THREE.Quaternion();
function solveArm(m, sg, wrist, handQ, run, cr) {
  const B_ = m.bones, uA = B_[sg < 0 ? B.uArmL : B.uArmR], fA = B_[sg < 0 ? B.fArmL : B.fArmR], hA = B_[sg < 0 ? B.handL : B.handR];
  _J.set(sg * SEG.shoulderX, 0.22, 0);
  _pole.set(sg * (sg > 0 ? 0.35 : 0.15), -1.0, sg > 0 ? 0.1 : 0.35);
  ik2(_J, wrist, SEG.arm1, SEG.arm2, _pole, _qU, _qL);
  uA.quaternion.copy(_qU); fA.quaternion.copy(_qL);
  _hq.copy(_qU).multiply(_qL).invert().multiply(handQ); hA.quaternion.copy(_hq);
}
function relaxedArm(m, sg, s, run, gw, cr) {
  // hanging / swinging arm (FK-ish through IK targets)
  const B_ = m.bones, uA = B_[sg < 0 ? B.uArmL : B.uArmR], fA = B_[sg < 0 ? B.fArmL : B.fArmR], hA = B_[sg < 0 ? B.handL : B.handR];
  const amp = (0.12 + 0.2 * run) * gw, sw = s * amp * -sg;
  _J.set(sg * SEG.shoulderX, 0.22, 0);
  _wr.set(sg * (0.3 + 0.03 * cr), -0.42 + 0.07 * Math.abs(sw) / 0.3 + 0.06 * cr + 0.04 * run * gw, -0.03 + sw - 0.08 * cr - 0.08 * run * gw);
  _pole.set(sg * 0.5, -0.5, 0.9);
  ik2(_J, _wr, SEG.arm1, SEG.arm2, _pole, _qU, _qL);
  uA.quaternion.copy(_qU); fA.quaternion.copy(_qL);
  _e.set(-0.25 - 0.4 * run * gw, 0, sg * -0.05, 'YXZ'); hA.quaternion.setFromEuler(_e);
}

// ------------------------------------------------------------------ event hooks
export function onFire(m, cls) {
  const H = HOLD[cls] || HOLD.rifle, sp = m.sp; m.fireT = 0;
  if (cls === 'melee') { m.meleeT = 0; return; }
  if (cls === 'grenade') return;
  const s = (1 + (Math.random() - 0.5) * 0.3);
  sp.kz[1] += H.kick[0] * 30 * s; sp.kp[1] += H.kick[1] * 26 * s; sp.kr[1] += (Math.random() - 0.5) * H.kick[1] * 20;
  sp.recoilChest[1] += H.kick[1] * 6; if (cls === 'sniper' || cls === 'shotgun') { sp.fp[1] += 1.4; sp.hp[1] += 1.2; }
}
export function onReload(m, cls, dur = 2.0) {
  if (!HOLD[cls] || !HOLD[cls].L) return; if (m.reload) return;
  m.reload = { t: 0, dur: clamp(dur, 0.6, 5) };
}
export function onThrow(m, type) {
  m.throwT = 0; m.fireT = 0; m.throwRel = false;
  const c = type === 'strobe' ? 0xfff3c4 : type === 'pulse' ? 0xa78bfa : 0xdde3ea; m.ball.material.color.setHex(c); m.ball.material.emissive.setHex(c);
  m.sp.fy[1] += 3.5;
}
export function onHit(m, dirLocal, damage = 20, crown = false) {
  const sp = m.sp, k = clamp(damage / 100, 0.05, 1) * 5 + 1.5;
  sp.fp[1] += dirLocal.z * k * 0.9; sp.fr[1] += -dirLocal.x * k * 0.9; sp.fy[1] += dirLocal.x * k * 0.35;
  sp.hp[1] += (crown ? 2.4 : 0.8) * Math.sign(dirLocal.z || -1) * k * 0.4; sp.hr[1] += -dirLocal.x * k * 0.3;
  m.hitFlash = 1;
}
export function startSwitch(m, id, cls, swapNow) { m.sw = { t: 0, out: 0.12, in: 0.28, id, cls, done: false }; m.swapNow = swapNow; }
