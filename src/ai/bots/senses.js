// Perception: vision cone + line of sight (smoke aware via nav.visible), reaction windows, hearing, last-known memory, team callouts.
import * as THREE from 'three';
import { K } from './config.js';
import { DEG, between, randn, clamp } from './util.js';

const _o = { eyeA: K.eye, eyeB: K.headY, eye: false, ignoreSmoke: false };
const _f = new THREE.Vector3();

export function createSenses(B) {
  const { ctx } = B;

  function memOf(bot, e) {
    const mm = bot.ai.mem; let m = mm.get(e.id);
    if (!m) { m = { id: e.id, actor: e, pos: new THREE.Vector3(), vel: new THREE.Vector3(), t: -99, seenT: -99, heardT: -99, conf: 0, vis: 0, visSince: 0, spotted: false, react: 0.3, src: '', lostT: -99, called: false, hitT: -99, firstSeen: -1, g: new THREE.Vector3(), gT: -99, hasSpot: false, spotT: -99 }; mm.set(e.id, m); }
    return m;
  }

  function visBits(bot, e) {
    const a = bot.actor, n = ctx.nav; if (!n) return 0;
    _o.eyeA = a.eyeHeight || K.eye; _o.ignoreSmoke = false;
    let bits = 0;
    _o.eyeB = e.crouching ? K.headYCrouch : K.headY;
    if (n.visible(a.pos, e.pos, _o)) bits |= 1;
    _o.eyeB = e.crouching ? 0.6 : 0.95;
    if (n.visible(a.pos, e.pos, _o)) bits |= 2;
    return bits;
  }

  function reaction(bot, m, d, bits, now) {
    const ai = bot.ai, df = ai.diff;
    let r = between(ai.rng, df.react) * (1 + d / 90);
    if (bits === 2) r *= 1.12;
    // pre-aimed: crosshair already near the enemy
    const a = bot.actor, dx = m.actor.pos.x - a.pos.x, dz = m.actor.pos.z - a.pos.z;
    const yawErr = Math.abs(((Math.atan2(-dx, -dz) - ai.aim.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (yawErr < 7 * DEG) r *= 0.55; else if (yawErr < 20 * DEG) r *= 0.8;
    if (now - m.t < 4 && m.conf > 0.4) r *= 0.7;          // expected (heard / called)
    if (now - m.hitT < 1.5) r *= 0.6;                      // just got shot by them
    return Math.max(0.08, r);
  }

  /** Run a vision pass for one bot. */
  function perceive(bot, now) {
    const ai = bot.ai, a = bot.actor, df = ai.diff, enemies = B.enemiesOf(bot.team);
    const blind = ctx.combat?.utility?.blindAmount?.(a) ?? 0;
    ai.blind = blind;
    a.forward(_f);
    const cosFov = Math.cos(df.fov * 0.5 * DEG);
    let best = null, bestScore = -1e9, any = false;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]; if (!e.alive || e.tagged) continue;
      const m = memOf(bot, e);
      const dx = e.pos.x - a.pos.x, dy = e.pos.y - a.pos.y, dz = e.pos.z - a.pos.z, d = Math.hypot(dx, dy, dz);
      let bits = 0;
      if (blind < 0.5 && d < K.maxSight) {
        const dot = d < 1e-3 ? 1 : (_f.x * dx + _f.y * dy + _f.z * dz) / d;
        if (d < K.closeSense || dot >= cosFov) bits = visBits(bot, e);
      }
      if (bits) {
        if (!m.vis) { m.visSince = now; m.react = reaction(bot, m, d, bits, now); if (m.firstSeen < 0) m.firstSeen = now; if (now - m.spotT > 3) m.hasSpot = false; }
        // glimpse tracking (private until the reaction window has elapsed: unnoticed sightings must not leak position or move the aim)
        const dt = now - m.gT;
        if (dt > 0 && dt < 0.6 && m.vis) m.vel.set((e.pos.x - m.g.x) / dt, 0, (e.pos.z - m.g.z) / dt); else m.vel.set(e.vel?.x || 0, 0, e.vel?.z || 0);
        m.g.copy(e.pos); m.gT = now; m.vis = bits;
        const was = m.spotted; m.spotted = now - m.visSince >= m.react;
        if (m.spotted) {
          m.pos.copy(e.pos); m.seenT = m.t = now; m.conf = 1; m.src = 'vis'; m.spotT = now; m.hasSpot = true;
          if (!was) B.onSpotted(bot, m, now);
        }
        any = true;
      } else {
        if (m.vis) { m.vis = 0; m.lostT = now; }
        if (m.spotted && now - m.lostT > 0.4) { m.spotted = false; }
        if (now - m.lostT > 3) m.called = false;
        // blend team intel
        const it = B.teamIntel(bot.team).get(e.id);
        if (it && it.t > m.t + 0.2 && it.by !== bot) { m.pos.copy(it.pos); m.t = it.t; m.conf = Math.min(0.6, it.conf); m.src = 'team'; m.vel.set(0, 0, 0); }
      }
      const wk = ai.wi?.klass, emax = wk === 'sniper' ? 130 : df.engage * (wk === 'smg' ? 0.7 : wk === 'pistol' ? 0.6 : wk === 'shotgun' ? 0.3 : 1);
      if (m.vis && m.spotted && d < emax) {
        let s = -d + (now - m.hitT < 2 ? 12 : 0) + (ai.target === m ? 5 : 0) + (bits & 1 ? 2 : 0);
        if (s > bestScore) { bestScore = s; best = m; }
      }
    }
    if (best !== ai.target) { B.onTargetChange(bot, ai.target, best, now); ai.target = best; }
    return any;
  }

  /** Something audible happened at `pos` caused by `src` (an enemy actor). Called from event handlers. */
  function hear(bot, pos, src, kind, now, sigma) {
    const ai = bot.ai, m = memOf(bot, src);
    if (m.vis || now - m.seenT < 0.35) return;
    const conf = kind === 'shot' ? 0.75 : kind === 'hit' ? 0.85 : 0.55;
    if (now - m.heardT < 0.12 && m.conf >= conf) { m.heardT = now; return; }
    const s = sigma ?? (1.2 + Math.hypot(pos.x - bot.actor.pos.x, pos.z - bot.actor.pos.z) * 0.07);
    m.pos.set(pos.x + randn(ai.rng) * s, pos.y, pos.z + randn(ai.rng) * s);
    m.t = m.heardT = now; m.conf = Math.max(m.conf * 0.5, conf); m.src = 'hear'; m.vel.set(0, 0, 0);
    ai.heard = { t: now, x: m.pos.x, y: m.pos.y, z: m.pos.z, kind, id: src.id };
    if (kind !== 'step' && now - ai.lastHeardCall > 3) { ai.lastHeardCall = now; B.onHeard(bot, m, kind, now); }
  }

  return { memOf, perceive, hear, visBits };
}
