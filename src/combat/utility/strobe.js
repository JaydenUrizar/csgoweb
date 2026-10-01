import * as THREE from 'three';
import { STROBE as S } from './config.js';
import { makeBillboard, FLARE, RING, GLOW } from './fx.js';
import { mulberry32 } from '../../core/rng.js';
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const _eye = new THREE.Vector3(), _p = new THREE.Vector3(), _f = new THREE.Vector3(), _d = new THREE.Vector3(), _o = new THREE.Vector3(), _r = new THREE.Vector3();

/** Strobe (flash). Burst visuals + per-actor blinding (facing angle x distance x line-of-sight, attenuated by Haze). */
export function createStrobe(ctx, W, deps) {
  const { sparks, screen, haze, time } = deps;
  const bursts = []; let n = 0;   // active visual bursts
  const pool = [];
  const mk = () => { const o = { flare: makeBillboard(FLARE), halo: makeBillboard(GLOW), ring: makeBillboard(RING), ring2: makeBillboard(RING), t: 0, pos: new THREE.Vector3(), busy: false }; return o; };

  function los(from, actor) {
    // three samples around the eye so a sliver of cover gives partial protection
    actor.eyePos(_eye); let vis = 0;
    _r.set(Math.cos(actor.yaw), 0, -Math.sin(actor.yaw));
    for (let i = 0; i < S.sight; i++) {
      _p.copy(_eye); if (i === 1) _p.addScaledVector(_r, 0.22); else if (i === 2) _p.y += 0.16;
      if (!W.segmentBlocked(from, _p)) vis++;
    }
    return vis / S.sight;
  }
  /** Compute blind result for one actor (pure; also used by tests). Returns {amount, dur, hold} or null. */
  function evaluate(pos, actor) {
    if (!actor.alive) return null;
    actor.eyePos(_eye); _d.subVectors(pos, _eye); const dist = _d.length(); if (dist > S.range) return null; _d.multiplyScalar(1 / Math.max(dist, 1e-4));
    const vis = los(pos, actor); if (vis <= 0) return null;
    actor.forward(_f); const facing = _f.dot(_d);
    const angle = 0.15 + 0.85 * sstep(-0.6, 0.85, facing);
    const distF = 1 - sstep(S.fullRange, S.range, dist);
    let amount = angle * distF * (0.35 + 0.65 * vis);
    const od = haze ? haze.opticalDepth(pos, _eye) : 0; if (od > 0) amount *= Math.exp(-od * 0.8);
    if (amount < 0.03) return null;
    const dur = S.minDur + (S.maxDur - S.minDur) * Math.pow(amount, 0.9);
    const hold = Math.min(dur * 0.8, 0.25 + 1.45 * amount * amount + 0.2 * amount);
    return { amount, dur, hold, dist, facing, vis };
  }

  return {
    evaluate,
    detonate(pos, thrower) {
      // --- gameplay ---
      const t = time();
      for (const a of ctx.actors) {
        const r = evaluate(pos, a); if (!r) continue;
        a.blind = { amount: r.amount, t0: t, dur: r.dur, hold: r.hold, until: t + r.dur, by: thrower };
        ctx.events.emit('util:blind', { actor: a, amount: r.amount, duration: r.dur, hold: r.hold, thrower, dist: r.dist });
        if (a === ctx.localActor) {
          screen.trigger(r.amount, r.dur, r.hold);
          ctx.render?.shake?.(0.25 * r.amount, 6);
        }
      }
      // --- visuals ---
      const rnd = mulberry32(1000 + (n++) * 7919 + Math.round(pos.x * 31 + pos.z * 17));
      const b = pool.pop() || mk(); b.busy = true; b.t = 0; b.pos.copy(pos);
      for (const m of [b.flare, b.halo, b.ring, b.ring2]) { ctx.render?.scene?.add(m); m.visible = true; }
      b.flare.material.uniforms.uSeed.value = rnd() * 6; bursts.push(b);
      for (let i = 0; i < 46; i++) {
        const az = rnd() * Math.PI * 2, el = (rnd() * 1.7 - 0.55), sp = 5 + rnd() * 13, ce = Math.cos(el);
        const hot = rnd(); const cr = 1, cg = 0.85 + 0.15 * hot, cb = 0.55 + 0.45 * hot;
        sparks.emit(pos.x, pos.y, pos.z, Math.cos(az) * ce * sp, Math.sin(el) * sp + 2, Math.sin(az) * ce * sp, 0.45 + rnd() * 0.55, 0.05 + rnd() * 0.05, cr, cg, cb, 11, 1.1);
      }
      deps.light?.(pos, 0xffffff, 90, 26, 0.55);
      deps.glow?.(pos, 1, 1, 0.96, 1.4, 0.9);
      haze?.disturb?.(pos, 0.8, 0.25, 1.2);
    },
    update(dt) {
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]; b.t += dt; const t = b.t;
        // core flare: instant pop, hot hold, soft decay
        const fl = b.flare.material.uniforms, hl = b.halo.material.uniforms, r1 = b.ring.material.uniforms, r2 = b.ring2.material.uniforms;
        const fsz = 0.4 + 3.6 * (1 - Math.exp(-t * 26)); fl.uPosSize.value.set(b.pos.x, b.pos.y, b.pos.z, fsz); fl.uAlpha.value = 2.6 * Math.exp(-Math.max(0, t - 0.06) * 5.5) * (1 - sstep(0.5, 0.75, t));
        hl.uPosSize.value.set(b.pos.x, b.pos.y, b.pos.z, 2.2 + 7 * (1 - Math.exp(-t * 8))); hl.uAlpha.value = 1.1 * Math.exp(-t * 3.2) * (1 - sstep(1.2, 1.6, t)); hl.uColor.value.setRGB(1, 0.95, 0.82);
        const u1 = Math.min(1, t / 0.32), u2 = Math.min(1, Math.max(0, (t - 0.06) / 0.5));
        r1.uPosSize.value.set(b.pos.x, b.pos.y, b.pos.z, 0.4 + 6.5 * (1 - Math.pow(1 - u1, 3))); r1.uT.value = u1; r1.uAlpha.value = 3.2 * (1 - u1) * (t < 0.32 ? 1 : 0); r1.uColor.value.setRGB(1, 0.97, 0.9);
        r2.uPosSize.value.set(b.pos.x, b.pos.y, b.pos.z, 0.4 + 11 * (1 - Math.pow(1 - u2, 3))); r2.uT.value = u2; r2.uAlpha.value = 1.6 * (1 - u2) * (t > 0.06 && t < 0.56 ? 1 : 0); r2.uColor.value.setRGB(0.75, 0.9, 1.0);
        if (t > 1.7) { for (const m of [b.flare, b.halo, b.ring, b.ring2]) { m.visible = false; m.parent?.remove(m); } b.busy = false; pool.push(b); bursts.splice(i, 1); }
      }
    },
    active: () => bursts.length,
    dispose() { for (const b of bursts) for (const m of [b.flare, b.halo, b.ring, b.ring2]) m.parent?.remove(m); bursts.length = 0; },
  };
}
