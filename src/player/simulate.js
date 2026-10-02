// Fixed-step character movement (owner: move). PURE: no DOM, no rendering. Shared by the human and bots:
//   sim.simulate(actor, cmd, dt)   cmd = {forward,right (−1..1), jump, crouch, walk, yaw, pitch}
// Source/CS-style ground accel + friction (strong counter-strafe), 30-unit air-strafe wish cap with a soft speed cap,
// slide-crouch, jump buffer + coyote, ledge mantle, stairs (0.45 m), capsule vs three-mesh-bvh triangle soup.
import { PLAYER } from '../core/config.js';
import { gather, resolve, resetContacts, probeSupport, fits, C, G, SKIN, triCount, gatherOverflow } from './geom.js';

// ---------------------------------------------------------------------------------------------
// Tunables (metres, seconds). Mutable at runtime through ctx.player.debug.tune({...}).
// CS2 reference: run 250 u/s = 4.76 m/s, gravity 800 u/s², accel 5.5, friction 5.2, air wish cap 30 u/s, air accel 12.
// Ours is ~1.39x faster than CS2 (6.6 m/s) so everything speed-like scales by the same factor.
// ---------------------------------------------------------------------------------------------
export const TUNE = {
  runSpeed: 7.2, walkMul: 0.52, crouchMul: 0.34,
  accel: 9.0, friction: 5.6, stopSpeed: 1.6,            // ground (Source formulas)
  gravity: 23, terminal: 46, jumpHeight: 1.05,           // jump v0 = sqrt(2 g h) = 6.95 m/s, hang ≈ 0.60 s
  airAccel: 30, airCap: 1.4,                            // 30 u/s * (7.2/250) ≈ 0.86 m/s wish cap
  softStart: 7.8, softEnd: 11.0, hardMax: 12.2,            // air-strafe gain fades 1 → 0 between these horizontal speeds
  bhopCap: 99, bhopKeep: 1,                           // takeoff above bhopCap keeps only this fraction of the excess
  coyote: 0.075, jumpBuffer: 0.11,
  stepHeight: 0.45, snapDown: 0.45,
  launchSpeed: 8.1,                                      // running off a ramp crest faster than this launches instead of gluing
  // slide
  slideMinSpeed: 4.8, slideBoost: 1.38, slideBoostMax: 10.0, slideEndSpeed: 3.3, slideMaxTime: 1.5, slideMinTime: 0.15, slideCooldown: 0.45,
  slideDecelBase: 1.5, slideDecelK: 0.22, slideSteer: 1.7, slideSlope: 0.9,
  // mantle
  mantleMaxLip: 0.65, mantleMinLip: 0.08, mantleMaxAboveGround: 1.62, crouchJumpLift: 0.17, mantleCooldown: 0.18,
  crouchRate: 16, eyeSlideDrop: 0.3,
  strideRun: 1.95, strideWalk: 1.7, strideCrouch: 1.25,
  actorPush: true,
};

const R = PLAYER.radius, HS = PLAYER.height, HC = PLAYER.crouchHeight;
const MAX_DT = 1 / 60;
const EMPTY = { forward: 0, right: 0, jump: false, crouch: false, walk: false, yaw: 0, pitch: 0 };

export function newMove(existing) {
  const m = existing || {};
  Object.assign(m, {
    __v: 2,
    speedScale: m.speedScale ?? 1, autoBhop: false, frozen: false,
    // outputs for other pieces
    speed: 0, speed3: 0, accurate: true, inaccuracy: 0, onGround: true, sliding: false, crouching: false, walking: false, airTime: 0, landRecover: 0, groundY: 0,
    gnx: 0, gny: 1, gnz: 0, wishSpeed: 0, tickAccel: 0, gait: 0, viewStep: 0, viewStepV: 0, teleports: 0,
    // internals
    jumpPrev: false, jumpBuf: 0, coyote: 0, crouchPrev: false, crouchBuf: 0, slideT: 0, slideCd: 0, slideK: 0, slideSide: 1,
    stride: 0, foot: 0, mantle: null, mantleCd: 0, jumped: false, tucked: false, hasEnd: false, ex: 0, ey: 0, ez: 0, lastLandSpeed: 0, lastJumpTick: -1, tick: 0,
    wishx: 0, wishz: 0, prevHS: 0, hitWallTicks: 0, mantleCount: 0, groundTicks: 0,
  });
  return m;
}

export function createSim(env) {
  const V = { x: 0, y: 0, z: 0 };
  const PA = { x: 0, y: 0, z: 0 }, PB = { x: 0, y: 0, z: 0 }, VA = { x: 0, y: 0, z: 0 };
  let LANDVY = 0;

  // ---- BVH access -------------------------------------------------------------------------
  let bvh = null, bvhOwner = null;
  function getBVH() {
    const col = env.collider?.();
    if (!col) return null;
    const g = col.geometry;
    if (!g) return null;
    if (col !== bvhOwner || !g.boundsTree) { bvhOwner = col; if (!g.boundsTree) { throw new Error('collider has no boundsTree'); } }
    return g.boundsTree;
  }

  function gatherFor(a, dt, extra = 0) {
    const p = a.pos, sp = Math.hypot(a.vel.x, a.vel.z) + 3;
    const pad = 0.3 + sp * dt * 1.5 + extra, dn = 0.75 + Math.max(0, -a.vel.y) * dt * 1.6, up = 0.85 + Math.max(0, a.vel.y) * dt * 1.6;
    gather(bvh, p.x - R - pad, p.y - dn, p.z - R - pad, p.x + R + pad, p.y + HS + up, p.z + R + pad);
  }

  // ---- swept move via substeps + depenetration --------------------------------------------
  // clip: 0 none, 1 clip vs walls, 2 clip vs walls + kill downward vel on ground contact (records LANDVY)
  function moveSlide(p, vel, dx, dy, dz, hull, clip, stopOnGround = false) {
    const len = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
    const n = len > 0.1 ? Math.ceil(len / 0.1) : 1;
    const sx = dx / n, sy = dy / n, sz = dz / n;
    for (let i = 0; i < n; i++) {
      const rx = p.x, ry = p.y + hull * 0.5, rz = p.z;
      p.x += sx; p.y += sy; p.z += sz;
      C.nWall = 0;
      const wasGround = C.ground;
      C.ground = false;
      resolve(p, hull, R, rx, ry, rz);
      const grounded = C.ground; C.ground = grounded || wasGround;
      if (vel && clip) {
        for (let k = 0; k < C.nWall; k++) {
          const nx = C.wx[k], ny = C.wy[k], nz = C.wz[k];
          const into = vel.x * nx + vel.y * ny + vel.z * nz;
          if (into < 0) { vel.x -= nx * into; vel.y -= ny * into; vel.z -= nz * into; }
        }
        // creases: 2 planes → slide along their intersection line, 3+ planes → stop dead
        if (C.nWall > 1) {
          let bad = 0, bi = -1, bj = -1;
          for (let k = 0; k < C.nWall; k++) { const into = vel.x * C.wx[k] + vel.y * C.wy[k] + vel.z * C.wz[k]; if (into < -1e-4) { bad++; if (bi < 0) bi = k; else bj = k; } }
          if (bad >= 1) {
            let i0 = bi, j0 = bj;
            if (j0 < 0) { // one plane still violated after the first pass: pair it with the plane we last slid along
              j0 = (bi + 1) % C.nWall;
            }
            let dx = C.wy[i0] * C.wz[j0] - C.wz[i0] * C.wy[j0], dy = C.wz[i0] * C.wx[j0] - C.wx[i0] * C.wz[j0], dz = C.wx[i0] * C.wy[j0] - C.wy[i0] * C.wx[j0];
            const dl = Math.hypot(dx, dy, dz);
            if (dl < 1e-4) { vel.x = vel.y = vel.z = 0; }
            else {
              dx /= dl; dy /= dl; dz /= dl; const al = vel.x * dx + vel.y * dy + vel.z * dz;
              vel.x = dx * al; vel.y = dy * al; vel.z = dz * al;
              for (let k = 0; k < C.nWall; k++) if (vel.x * C.wx[k] + vel.y * C.wy[k] + vel.z * C.wz[k] < -1e-3) { vel.x = vel.y = vel.z = 0; break; }
            }
          }
        }
        if (clip === 2 && grounded && vel.y < 0) { if (vel.y < LANDVY) LANDVY = vel.y; vel.y = 0; }
      }
      if (stopOnGround && grounded) break;
    }
  }

  // ---- helpers ----------------------------------------------------------------------------
  function accelerate(v, wx, wz, wishspeed, accel, dt) {
    const cur = v.x * wx + v.z * wz, add = wishspeed - cur;
    if (add <= 0) return;
    let as = accel * dt * wishspeed; if (as > add) as = add;
    v.x += wx * as; v.z += wz * as;
  }
  function friction(v, dt, fric, stop) {
    const sp = Math.hypot(v.x, v.z);
    if (sp < 1e-4) { v.x = v.z = 0; return; }
    const control = sp < stop ? stop : sp, drop = control * fric * dt;
    const ns = sp - drop > 0 ? sp - drop : 0, k = ns / sp; v.x *= k; v.z *= k;
  }
  const smooth01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

  // ---- events -----------------------------------------------------------------------------
  const _tmpV = { x: 0, y: 0, z: 0, isVector3: false };
  function emit(type, data) { env.emit?.(type, data); }

  // ---- try to step up over an obstacle (Source StepMove) ---------------------------------
  // Returns true when PB holds a better end state; VA holds the velocity after the step.
  function tryStep(a, m, hull, x0, y0, z0, vx, vz, dt, hDoneA) {
    let lift = TUNE.stepHeight;
    while (lift > 0.1 && !fits(x0, y0 + lift, z0, hull, R)) lift -= 0.1;
    if (lift <= 0.1) return false;
    PB.x = x0; PB.y = y0 + lift; PB.z = z0;
    VA.x = vx; VA.y = 0; VA.z = vz;
    resetContacts();
    // travel a little further than this tick's displacement so the round foot ends up over the tread, not on the lip
    const hl = Math.hypot(vx, vz) * dt, ext = hl > 1e-6 ? Math.min(0.12, Math.max(hl, 0.09)) / hl : 1;
    moveSlide(PB, VA, vx * dt * ext, 0, vz * dt * ext, hull, 1);
    const prog = Math.hypot(PB.x - x0, PB.z - z0);
    if (prog < hDoneA + 0.002) return false;
    const hvx = vx, hvz = vz;                // keep the pre-step velocity (a stair lip must not eat speed)
    resetContacts();
    moveSlide(PB, null, 0, -(lift + 0.06), 0, hull, 0, true);
    if (!C.ground) return false;
    if (PB.y - y0 > TUNE.stepHeight + 0.02 || PB.y - y0 < 0.03) return false;      // must actually rise (else it's just a wall slide)
    if (C.gny < 0.7) return false;
    if (!probeSupport(PB, hull, R, 0.02) || G.y - y0 > TUNE.stepHeight + 0.02) return false;   // the SURFACE we land on must be ≤ step height up (not just the lip we balance on)
    if (Math.hypot(PB.x - x0, PB.z - z0) < hDoneA + 0.002) return false;      // ended up no further than the plain slide
    VA.x = hvx; VA.z = hvz;
    return true;
  }

  // ---- mantle ------------------------------------------------------------------------------
  function tryMantle(a, m, hull, pvx, pvz) {
    if (m.mantleCd > 0 || !C.hitWall) return false;
    let dx = -C.wnx, dz = -C.wnz; const l = Math.hypot(dx, dz);
    if (l < 0.3) return false; dx /= l; dz /= l;
    const into = pvx * dx + pvz * dz, wish = (m.wishx * dx + m.wishz * dz);
    if (into < 0.8 && wish < 0.35) return false;
    const p = a.pos;
    // The wall contact may be the near side of a much higher wall: search lip height upward.
    const F = R + SKIN + 0.12;
    let found = -1;
    for (let hh = 0.1; hh <= TUNE.mantleMaxLip + 1e-6; hh += 0.05) {
      if (!fits(p.x, p.y + hh, p.z, hull, R)) return false;
      if (fits(p.x + dx * F, p.y + hh, p.z + dz * F, hull, R)) { found = hh; break; }
    }
    if (found < 0) return false;
    const tx = p.x + dx * F, tz = p.z + dz * F;
    if (!fits(p.x + dx * F * 0.5, p.y + found, p.z + dz * F * 0.5, hull, R)) return false;
    PB.x = tx; PB.y = p.y + found; PB.z = tz;
    resetContacts();
    moveSlide(PB, null, 0, -(0.12), 0, hull, 0, true);
    if (!C.ground || C.gny < 0.7) return false;
    const lip = PB.y - p.y;
    if (lip < TUNE.mantleMinLip || lip > TUNE.mantleMaxLip + 0.02) return false;
    if (PB.y - m.groundY > TUNE.mantleMaxAboveGround) return false;
    const hs = Math.hypot(pvx, pvz);
    const carry = Math.min(TUNE.runSpeed, Math.max(2.8, hs * 0.8));
    m.mantle = { t: 0, dur: 0.13 + lip * 0.16, x0: p.x, y0: p.y, z0: p.z, x1: PB.x, y1: PB.y, z1: PB.z, hy: p.y + found, cx: dx * carry, cz: dz * carry, lip };
    m.mantleCd = TUNE.mantleCooldown;
    m.mantleCount++;
    return true;
  }

  function advanceMantle(a, m, dt) {
    const mt = m.mantle; mt.t += dt;
    const u = Math.min(1, mt.t / mt.dur);
    const up = u < 0.6 ? 1 - Math.pow(1 - u / 0.6, 2) : 1;
    let y = mt.y0 + (mt.hy - mt.y0) * up;
    if (u > 0.6) y = mt.hy + (mt.y1 - mt.hy) * smooth01((u - 0.6) / 0.4);
    const h = smooth01((u - 0.2) / 0.8);
    a.pos.set(mt.x0 + (mt.x1 - mt.x0) * h, y, mt.z0 + (mt.z1 - mt.z0) * h);
    a.vel.set(mt.cx * 0.5, (mt.hy - mt.y0) / mt.dur * 0.5, mt.cz * 0.5);
    if (u >= 1) {
      a.pos.set(mt.x1, mt.y1, mt.z1);
      a.vel.set(mt.cx, 0, mt.cz);
      m.mantle = null; m.onGround = true; m.groundY = a.pos.y; m.airTime = 0; m.jumped = false; m.coyote = 0;
      emit('mantle', { actor: a, height: mt.lip, pos: a.pos });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // main step
  // ---------------------------------------------------------------------------------------------
  function step(a, m, cmd, dt) {
    const p = a.pos, v = a.vel;
    if (!(p.x === p.x && p.y === p.y && p.z === p.z)) { p.set(m.ex, m.ey, m.ez); v.set(0, 0, 0); }
    m.tick++;
    if (cmd.yaw !== undefined) a.yaw = cmd.yaw;
    if (cmd.pitch !== undefined) a.pitch = cmd.pitch;
    if (env.speedScale) { const sc = env.speedScale(a); if (sc > 0) m.speedScale = sc; }
    const dead = !a.alive, frozen = m.frozen;
    let fw = cmd.forward || 0, rt = cmd.right || 0, jump = !!cmd.jump, crouch = !!cmd.crouch, walk = !!cmd.walk;
    if (dead || frozen) { fw = rt = 0; jump = false; if (dead) crouch = false; }
    if (fw > 1) fw = 1; else if (fw < -1) fw = -1; if (rt > 1) rt = 1; else if (rt < -1) rt = -1;

    bvh = getBVH();
    if (!bvh) { // no world yet: just integrate gravity-free
      p.x += v.x * dt; p.z += v.z * dt; finish(a, m, dt, 0, 0, 0, walk, false); return;
    }

    // timers
    m.slideCd = Math.max(0, m.slideCd - dt); m.mantleCd = Math.max(0, m.mantleCd - dt); m.landRecover = Math.max(0, m.landRecover - dt);
    if (m.coyote > 0) m.coyote -= dt;
    const crouchEdge = crouch && !m.crouchPrev; m.crouchPrev = crouch;
    if (crouchEdge) m.crouchBuf = 0.15; else m.crouchBuf = Math.max(0, m.crouchBuf - dt);
    const jumpEdge = jump && !m.jumpPrev; m.jumpPrev = jump;
    if (jumpEdge) m.jumpBuf = TUNE.jumpBuffer; else if (m.jumpBuf > 0) m.jumpBuf -= dt;

    // wish direction
    const sy = Math.sin(a.yaw), cy = Math.cos(a.yaw);
    let wx = -sy * fw + cy * rt, wz = -cy * fw - sy * rt;
    const wl = Math.hypot(wx, wz); let wmag = wl > 1 ? 1 : wl;
    if (wl > 1e-6) { wx /= wl; wz /= wl; } else { wx = wz = 0; wmag = 0; }
    m.wishx = wx * wmag; m.wishz = wz * wmag;
    if (rt !== 0) m.slideSide = rt > 0 ? 1 : -1;

    // mantle in progress: input locked, path driven
    if (m.mantle) {
      const ox = p.x, oz = p.z;
      advanceMantle(a, m, dt);
      finish(a, m, dt, p.x - ox, p.z - oz, 0, walk, true);
      return;
    }

    // external teleport? (respawn/place) → re-probe ground below
    const teleported = !m.hasEnd || Math.abs(p.x - m.ex) + Math.abs(p.y - m.ey) + Math.abs(p.z - m.ez) > 1e-4;
    gatherFor(a, dt);
    let hull = m.crouching ? HC : HS;
    if (teleported) {
      m.teleports++; m.viewStep = 0; m.mantle = null; m.stride = 0; m.hasEnd = true;
      C.ground = false; resetContacts();
      resolve(p, hull, R, p.x, p.y + hull * 0.5, p.z);
      const sup = probeSupport(p, hull, R, 0.03);
      m.onGround = sup && v.y <= 0.5; if (m.onGround) { m.gnx = G.nx; m.gny = G.ny; m.gnz = G.nz; m.groundY = p.y; m.airTime = 0; } else { m.airTime = 0; }
    }

    // ---- crouch / uncrouch (hull is instant, camera/eye is smoothed in finish) -----------------
    if (crouch || m.sliding) { m.crouching = true; }
    else if (m.crouching && fits(p.x, p.y, p.z, HS, R)) m.crouching = false;
    hull = m.crouching ? HC : HS;

    // ---- slide start -------------------------------------------------------------------------
    let hs = Math.hypot(v.x, v.z);
    const landedCrouch = crouch && m.onGround && m.groundTicks < 2 && m.airTime > 0.1;
    if (!m.sliding && m.onGround && m.slideCd <= 0 && (m.crouchBuf > 0 || landedCrouch) && crouch && hs >= TUNE.slideMinSpeed && !frozen && !dead) {
      m.sliding = true; m.slideT = 0; m.crouching = true; m.crouchBuf = 0; hull = HC;
      if (hs < TUNE.slideBoostMax) { const nh = Math.min(hs * TUNE.slideBoost, TUNE.slideBoostMax), k = nh / hs; v.x *= k; v.z *= k; hs = nh; }
      emit('slide', { actor: a, speed: hs, pos: a.pos, side: m.slideSide });
    }

    // ---- jump ---------------------------------------------------------------------------------
    const canGround = m.onGround || (m.coyote > 0 && !m.jumped);
    if (canGround && !frozen && !dead && (m.jumpBuf > 0 || (m.autoBhop && jump && m.onGround))) {
      v.y = Math.sqrt(2 * TUNE.gravity * TUNE.jumpHeight);
      if (hs > TUNE.bhopCap) { const ns = TUNE.bhopCap + (hs - TUNE.bhopCap) * TUNE.bhopKeep, k = ns / hs; v.x *= k; v.z *= k; hs = ns; }
      m.onGround = false; m.coyote = 0; m.jumpBuf = 0; m.jumped = true; m.tucked = false; m.airTime = 0; m.lastJumpTick = m.tick;
      if (m.sliding) { m.sliding = false; m.slideCd = TUNE.slideCooldown * 0.5; }
      emit('jump', { actor: a, speed: hs, crouch: m.crouching, pos: a.pos });
    }

    const speedMax = TUNE.runSpeed * m.speedScale * (m.crouching ? TUNE.crouchMul : walk ? TUNE.walkMul : 1);
    const wishspeed = wmag * speedMax; m.wishSpeed = wishspeed;
    const px0 = p.x, py0 = p.y, pz0 = p.z;
    let landSpeed = 0, landed = false;

    if (m.onGround) {
      // ================= GROUND =================
      m.groundTicks++; m.airTime = 0; m.jumped = false;
      if (m.sliding) {
        m.slideT += dt;
        const endBy = (!crouch && m.slideT > TUNE.slideMinTime) || hs < TUNE.slideEndSpeed || m.slideT > TUNE.slideMaxTime || dead || frozen;
        if (endBy) { m.sliding = false; m.slideCd = TUNE.slideCooldown; }
        else {
          // low, speed-dependent friction; steering by rotating the velocity; gravity along slopes
          const drop = (TUNE.slideDecelBase + TUNE.slideDecelK * hs) * dt;
          if (hs > 1e-4) { const ns = Math.max(0, hs - drop), k = ns / hs; v.x *= k; v.z *= k; }
          if (m.gny < 0.9999) { v.x += TUNE.gravity * m.gny * m.gnx * dt * TUNE.slideSlope; v.z += TUNE.gravity * m.gny * m.gnz * dt * TUNE.slideSlope; }
          if (wmag > 0.1) {
            const h2 = Math.hypot(v.x, v.z);
            if (h2 > 0.5) {
              const vx = v.x / h2, vz = v.z / h2;
              let ang = Math.atan2(vx * wz - vz * wx, vx * wx + vz * wz);           // signed angle vel→wish
              const maxTurn = TUNE.slideSteer * dt * wmag;
              if (ang > maxTurn) ang = maxTurn; else if (ang < -maxTurn) ang = -maxTurn;
              const c = Math.cos(ang), s = Math.sin(ang);
              const nx = v.x * c - v.z * s, nz = v.x * s + v.z * c; v.x = nx; v.z = nz;
            }
          }
        }
      }
      if (!m.sliding) {
        friction(v, dt, TUNE.friction, wmag > 0 ? Math.min(TUNE.stopSpeed, wishspeed) : TUNE.stopSpeed);   // slow wishspeeds (scoped / leg-hit crouch-walk) must still win against friction
        if (wmag > 0) {
          // counter-strafe assist: opposing wish never overshoots into reverse acceleration in the same tick
          const before = v.x * wx + v.z * wz;
          accelerate(v, wx, wz, wishspeed, TUNE.accel, dt);
          if (before < 0 && v.x * wx + v.z * wz > 0 && hs > 0.5) { const along = v.x * wx + v.z * wz; v.x -= wx * along; v.z -= wz * along; }
        }
      }
      // ---- walk move over the ground plane ----
      groundMove(a, m, hull, dt);
    } else {
      // ================= AIR =================
      m.airTime += dt; m.groundTicks = 0;
      if (m.crouching && !m.tucked && v.y > 0.5 && m.jumped) {
        // crouch-jump: legs pull up, feet gain a little height (CS crouch-jump bonus)
        const lift = TUNE.crouchJumpLift;
        if (fits(p.x, p.y + lift, p.z, HC, R)) { p.y += lift; m.viewStep = Math.max(-0.7, Math.min(0.7, m.viewStep - lift)); }
        m.tucked = true;
      }
      if (m.sliding) { m.sliding = false; m.slideCd = TUNE.slideCooldown; }
      if (wmag > 0) airAccel(v, wx, wz, TUNE.runSpeed * m.speedScale, wmag, dt);
      const pvx = v.x, pvz = v.z, pvy = v.y;
      v.y -= TUNE.gravity * dt * 0.5;
      if (v.y < -TUNE.terminal) v.y = -TUNE.terminal;
      resetContacts(); LANDVY = 0;
      moveSlide(p, v, v.x * dt, v.y * dt, v.z * dt, hull, 2);
      if (C.hitWall || C.ground) {      // blocked in the air / landed against something: velocity = what actually happened
        const cv = Math.hypot(v.x, v.z), act = Math.hypot(p.x - px0, p.z - pz0) / dt;
        if (cv > 1e-3 && act < cv * 0.6) { if (act < 0.3) { v.x = v.z = 0; } else { v.x = (p.x - px0) / dt; v.z = (p.z - pz0) / dt; } }
      }
      if (C.ground && LANDVY < 0) {
        landed = true; landSpeed = -LANDVY;
        m.onGround = true; m.gnx = C.gnx; m.gny = C.gny; m.gnz = C.gnz; m.groundY = p.y; m.groundTicks = 1;
        m.jumped = false; m.tucked = false; v.y = 0;
      } else {
        v.y -= TUNE.gravity * dt * 0.5;
        if (v.y < -TUNE.terminal) v.y = -TUNE.terminal;
        if (C.hitWall && pvy > -3.2 && !m.mantle) tryMantle(a, m, hull, pvx, pvz);
      }
      // ceiling bonk: kill upward velocity (clip did it); nothing else
      const hs2 = Math.hypot(v.x, v.z);
      if (hs2 > TUNE.hardMax) { const k = TUNE.hardMax / hs2; v.x *= k; v.z *= k; }
    }

    finish(a, m, dt, p.x - px0, p.z - pz0, p.y - py0, walk, false, landed, landSpeed);
  }

  function airAccel(v, wx, wz, speedMax, wmag, dt) {
    const wishFull = wmag * speedMax;
    const wishCap = Math.min(wishFull, TUNE.airCap * (speedMax / TUNE.runSpeed));
    const cur = v.x * wx + v.z * wz, add = wishCap - cur;
    if (add <= 0) return;
    let as = TUNE.airAccel * wishFull * dt; if (as > add) as = add;
    // soft speed cap: strafing gain fades out between softStart and softEnd
    const hs = Math.hypot(v.x, v.z);
    if (hs > TUNE.softStart && as > 0) {
      const f = 1 - smooth01((hs - TUNE.softStart) / (TUNE.softEnd - TUNE.softStart));
      // only fade the part of the acceleration that increases speed; pure turning/braking stays free
      const nx = v.x + wx * as, nz = v.z + wz * as;
      if (Math.hypot(nx, nz) > hs) as *= f;
    }
    const ox = v.x, oz = v.z, hs0 = Math.hypot(ox, oz);
    v.x += wx * as; v.z += wz * as;
    // forgiving strafing: steering with the strafe keys may bend the path but never bleeds speed (only deliberate braking, wish > ~135° off, does)
    if (hs0 > 0.5 && (wx * ox + wz * oz) / hs0 > -0.7) { const hs1 = Math.hypot(v.x, v.z); if (hs1 < hs0) { const k = hs0 / hs1; v.x *= k; v.z *= k; } }
  }

  // ---- ground movement over plane + stairs + snap ----------------------------------------------
  function groundMove(a, m, hull, dt) {
    const p = a.pos, v = a.vel;
    const x0 = p.x, y0 = p.y, z0 = p.z;
    const hvx = v.x, hvz = v.z;
    let vy = 0;
    if (m.gny < 0.9999) vy = -(m.gnx * hvx + m.gnz * hvz) / m.gny;
    V.x = hvx; V.y = vy; V.z = hvz;
    resetContacts();
    moveSlide(p, V, V.x * dt, V.y * dt, V.z * dt, hull, 1);
    const hWant = Math.hypot(hvx, hvz) * dt, hDone = Math.hypot(p.x - x0, p.z - z0);
    let steppedDy = 0;
    const blockedA = C.hitWall;
    if (hWant > 1e-5 && hDone < hWant * 0.92 && C.hitWall) {
      if (tryStep(a, m, hull, x0, y0, z0, hvx, hvz, dt, hDone)) {
        steppedDy = PB.y - p.y;
        p.x = PB.x; p.y = PB.y; p.z = PB.z; V.x = VA.x; V.z = VA.z; V.y = 0;
        // horizontal speed after clipping in the lifted move
        if (hDone < 1e-6) { /* keep V */ }
      }
    }
    if (steppedDy === 0 && hWant > 1e-5 && hDone >= hWant * 0.92) { v.x = hvx; v.z = hvz; }   // grazed a lip but wasn't actually slowed: keep speed
    else { v.x = V.x; v.z = V.z; }
    {
      // blocked? take velocity from what actually happened (zero when wedged) → no phantom speed / footsteps
      const cv = Math.hypot(v.x, v.z), act = Math.hypot(p.x - x0, p.z - z0) / dt;
      if (blockedA && cv < 0.6 && act < 0.3 && steppedDy === 0) { v.x = v.z = 0; }
      else if (blockedA && cv > 1e-3 && act < cv * 0.6 && steppedDy === 0) { if (act < 0.3) { v.x = v.z = 0; } else { v.x = (p.x - x0) / dt; v.z = (p.z - z0) / dt; } }
    }
    if (blockedA && !m.sliding) {   // gliding along a wall never gains speed beyond what we had / run speed
      const lim = Math.max(m.prevHS, TUNE.runSpeed * m.speedScale), hh = Math.hypot(v.x, v.z);
      if (hh > lim) { const k = lim / hh; v.x *= k; v.z *= k; }
    }
    // is there still ground under us?
    let sup = probeSupport(p, hull, R, 0.02);
    let launched = false;
    if (sup) { m.gnx = G.nx; m.gny = G.ny; m.gnz = G.nz; }
    else {
      // stay grounded going downhill / down stairs, unless we're fast and leaving a ramp crest upward
      const launch = V.y > 0.8 && Math.hypot(v.x, v.z) >= TUNE.launchSpeed;
      PB.x = p.x; PB.y = p.y; PB.z = p.z;
      resetContacts();
      moveSlide(PB, null, 0, -TUNE.snapDown, 0, hull, 0, true);
      if (C.ground && probeSupport(PB, hull, R, 0.02) && !(launch && p.y - PB.y > 0.05)) {
        steppedDy += PB.y - p.y;
        p.y = PB.y; p.x = PB.x; p.z = PB.z;
        m.gnx = G.nx; m.gny = G.ny; m.gnz = G.nz; sup = true;
      } else { launched = launch; }
    }
    if (sup) { m.onGround = true; m.groundY = p.y; v.y = 0; }
    else {
      m.onGround = false; m.coyote = TUNE.coyote; m.airTime = 0; m.groundTicks = 0;
      v.y = launched ? V.y : 0;
    }
    // stairs / big snaps → view smoothing (camera eases the pop)
    const dy = p.y - y0;
    if (m.onGround && Math.abs(dy) > 0.045) m.viewStep = Math.max(-0.7, Math.min(0.7, m.viewStep - dy));
  }

  // ---- post step: view/anim state, events, actor-actor separation ------------------------------
  function finish(a, m, dt, dxm, dzm, dym, walk, mantling, landed = false, landSpeed = 0) {
    const p = a.pos, v = a.vel;
    // soft player-vs-player separation
    if (TUNE.actorPush && !mantling) separate(a, m, dt);
    const hs = Math.hypot(v.x, v.z);
    const moved = Math.hypot(dxm, dzm);
    m.tickAccel = (hs - m.prevHS) / dt; m.prevHS = hs;
    m.speed = hs; m.speed3 = Math.hypot(hs, v.y);
    m.walking = walk && !m.crouching && m.onGround && hs > 0.3;
    // accuracy exposure for the tagger piece
    const accSpeed = TUNE.runSpeed * TUNE.crouchMul + 0.12;
    if (landed) { m.landRecover = 0.28; m.lastLandSpeed = landSpeed; }
    let inacc = m.onGround ? Math.min(1, Math.max(0, (hs - accSpeed) / (TUNE.runSpeed - accSpeed))) : 1;
    if (m.sliding) inacc = 1;
    if (m.landRecover > 0) inacc = Math.max(inacc, m.landRecover / 0.28 * 0.6);
    m.inaccuracy = inacc;
    m.accurate = m.onGround && !m.sliding && hs <= accSpeed && m.landRecover <= 0.14;
    // hull / eye smoothing
    const target = m.crouching ? 1 : 0;
    a.crouchT += (target - a.crouchT) * (1 - Math.exp(-TUNE.crouchRate * dt));
    m.slideK += ((m.sliding ? 1 : 0) - m.slideK) * (1 - Math.exp(-14 * dt));
    a.eyeHeight = PLAYER.eye - (PLAYER.eye - PLAYER.crouchEye) * a.crouchT - TUNE.eyeSlideDrop * m.slideK;
    a.height = HS - (HS - HC) * a.crouchT;
    a.onGround = m.onGround; a.crouching = m.crouching; a.walking = m.walking;
    // view step smoothing decays (fixed-step, deterministic)
    if (m.viewStep !== 0) {
      const mag0 = Math.abs(m.viewStep), want = Math.min(9, 2.5 + 16 * mag0);
      m.viewStepV += (want - m.viewStepV) * (1 - Math.exp(-dt / 0.03));         // eased start → no pop
      const mag = Math.max(0, mag0 - m.viewStepV * dt);
      m.viewStep = m.viewStep < 0 ? -mag : mag; if (mag < 1e-4) { m.viewStep = 0; m.viewStepV = 0; }
    }
    // footsteps + gait phase
    const actSpeed = moved / dt;
    if (m.onGround && !m.sliding && hs > 0.6 && actSpeed > 0.5) {
      const len = m.crouching ? TUNE.strideCrouch : m.walking ? TUNE.strideWalk : TUNE.strideRun;
      m.stride += moved; m.gait += moved / len * Math.PI;
      if (m.stride >= len) {
        m.stride -= len; m.foot ^= 1;
        _surfacePos.x = p.x; _surfacePos.y = p.y - 0.1; _surfacePos.z = p.z;
        emit('footstep', { actor: a, pos: p.clone ? p.clone() : { x: p.x, y: p.y, z: p.z }, surface: env.surfaceAt?.(_surfacePos) || 'stone', speed: hs, crouch: m.crouching, walk: m.walking, foot: m.foot });
      }
    } else if (actSpeed < 0.3) m.stride = Math.min(m.stride, 0.4);
    if (landed) {
      _surfacePos.x = p.x; _surfacePos.y = p.y - 0.1; _surfacePos.z = p.z;
      emit('land', { actor: a, speed: landSpeed, surface: env.surfaceAt?.(_surfacePos) || 'stone', pos: p.clone ? p.clone() : { x: p.x, y: p.y, z: p.z }, hspeed: hs, crouch: m.crouching });
    }
    m.ex = p.x; m.ey = p.y; m.ez = p.z; m.hasEnd = true;
  }
  const _surfacePos = (typeof env.makeVec3 === 'function') ? env.makeVec3() : { x: 0, y: 0, z: 0 };

  function separate(a, m, dt) {
    const list = env.actors?.(); if (!list || list.length < 2) return;
    const p = a.pos, v = a.vel, lim = R * 2;
    let pushed = false;
    for (let i = 0; i < list.length; i++) {
      const o = list[i]; if (o === a || !o.alive) continue;
      const dy = o.pos.y - p.y; if (dy > a.height - 0.2 || -dy > o.height - 0.2) continue;
      const dx = p.x - o.pos.x, dz = p.z - o.pos.z, d2 = dx * dx + dz * dz;
      if (d2 >= lim * lim) continue;
      let d = Math.sqrt(d2), nx, nz;
      if (d < 1e-4) { const s = (a.id % 7) * 0.9 + 0.3; nx = Math.cos(s); nz = Math.sin(s); d = 0; } else { nx = dx / d; nz = dz / d; }
      const pen = lim - d, push = Math.min(pen * 0.5, 0.05 + 0.6 * dt);
      p.x += nx * push; p.z += nz * push; pushed = true;
      const into = v.x * nx + v.z * nz; if (into < 0) { v.x -= nx * into * 0.9; v.z -= nz * into * 0.9; }
    }
    if (pushed && bvh) { resetContacts(); resolve(p, m.crouching ? HC : HS, R, p.x, p.y + 0.9, p.z, 2); }
  }

  function simulate(a, cmd, dt) {
    const m = (a.move && a.move.__v === 2) ? a.move : (a.move = newMove(a.move));
    if (!cmd) cmd = EMPTY;
    if (dt > MAX_DT) { const n = Math.ceil(dt / MAX_DT); for (let i = 0; i < n; i++) step(a, m, cmd, dt / n); }
    else step(a, m, cmd, dt);
    return m;
  }

  return { simulate, TUNE, ensure: (a) => ((a.move && a.move.__v === 2) ? a.move : (a.move = newMove(a.move))), debug: { triCount, get overflow() { return gatherOverflow; } } };
}
