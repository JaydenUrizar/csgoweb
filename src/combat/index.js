// ctx.combat — owner: `tagger` piece (core.js / taggers.js / ballistics.js / range.js) + viewmodel + utility sub-pieces.
// Contract: docs/ARCHITECTURE.md §combat, extras documented in docs/pieces/tagger.md.
import { createCore } from './core.js';
import { createViewmodel } from './viewmodel/index.js';
import { createUtility } from './utility/index.js';
import { registerRange } from './range.js';
import { stub } from '../core/stub.js';

export function create(ctx) {
  const core = createCore(ctx);
  ctx.combat = core;                      // sub-pieces may look at ctx.combat during their own create()
  const safe = (fn, name) => { try { return fn(ctx) || stub(name); } catch (e) { console.error(`[combat] ${name} failed`, e); ctx.errors?.push?.(`combat:${name}: ${e?.stack || e}`); return stub(name); } };
  core.viewmodel = safe(createViewmodel, 'viewmodel');
  core.utility = safe(createUtility, 'utility');

  // ---- events
  ctx.events.on('round:start', () => {
    core.clearDrops();
    for (const a of ctx.actors) if (a.cb?.wasOut) { core.reset(a, { keep: false, revive: false }); a.cb.wasOut = false; }
  });
  ctx.events.on('tag:out', (e) => { if (e.victim?.cb) e.victim.cb.wasOut = true; });

  // ---- per-frame: viewmodel + late camera fallback (only when the player module does not read ctx.combat.aimPunch itself)
  const vmState = { speed: 0, onGround: true, crouch: false, walking: false, aimPunch: { x: 0, y: 0 }, lookDelta: { x: 0, y: 0 }, scoped: false, scopeLevel: 0, hp: 100, tagger: null, cycle: 0 };
  const ap = { pitch: 0, yaw: 0 };
  const api = core;
  api.fixedUpdate = ((base) => function (dt) { base(dt); core.utility.fixedUpdate?.(dt); core.viewmodel.fixedUpdate?.(dt); })(core.fixedUpdate);
  api.update = function (dt, alpha) {
    const a = ctx.localActor;
    if (a) {
      const cb = core.brain(a), w = core.equipped(a);
      // look delta (rad) for viewmodel sway
      let dy = a.yaw - cb.yawPrev, dp = a.pitch - cb.pitchPrev; cb.yawPrev = a.yaw; cb.pitchPrev = a.pitch;
      if (dy > Math.PI) dy -= 2 * Math.PI; else if (dy < -Math.PI) dy += 2 * Math.PI;
      const S = vmState; S.speed = Math.hypot(a.vel.x, a.vel.z); S.onGround = a.onGround !== false; S.crouch = !!a.crouching; S.walking = !!a.walking;
      core.aimPunch(a, ap); S.aimPunch.x = ap.pitch; S.aimPunch.y = ap.yaw; S.lookDelta.x = dy; S.lookDelta.y = dp;
      S.scoped = !!w?.scopeLevel; S.scopeLevel = w?.scopeLevel || 0; S.hp = a.hp; S.tagger = w?.id || null;
      if (w && w.def && !w.def.melee && !w.def.utility) { S.ammo = w.mag; S.ammoMax = w.def.mag; } else { S.ammo = null; S.ammoMax = 0; }
      S.vy = a.vel.y;
      core.viewmodel.update?.(dt, S);
    }
    core.utility.update?.(dt, alpha);
  };
  const lateCam = {
    update() {
      const a = ctx.localActor, P = ctx.player, cam = ctx.render?.camera;
      if (!a || !cam || P?.usesCombatPunch || P?.setAimPunch || (typeof P?.punch === 'function')) return;
      core.aimPunch(a, ap);
      cam.rotation.set(a.pitch + ap.pitch, a.yaw + ap.yaw, 0, 'YXZ');
      const f = core.scopeFov(a);
      const base = ctx.settings?.get?.('fov') || 100, want = f ?? base;
      if (Math.abs(cam.fov - want) > 0.01) { cam.fov = want; cam.updateProjectionMatrix(); }
    },
  };
  ctx.engine?.add?.(lateCam, 99);

  // ---- debug / inspection
  core.debug = {
    give: (a, id, o) => core.give(a || ctx.localActor, id, o),
    loadout: (a, ids) => { a = a || ctx.localActor; for (const id of ids) core.give(a, id, { select: false }); return core.inventory(a); },
    state: (a) => { a = a || ctx.localActor; const w = core.equipped(a), cb = core.brain(a); return { id: w?.id, mag: w?.mag, reserve: w?.reserve, state: w?.state, scope: w?.scopeLevel, recoilIdx: +cb.recoilIdx.toFixed(2), inaccFire: +cb.inaccFire.toFixed(3), inaccDeg: +core.inaccuracy(a).toFixed(3), xhair: +core.crosshairSpread(a).toFixed(3), shots: cb.shots, punch: core.aimPunch(a, {}) }; },
    last: () => core.debugLast,
    reset: (a, o) => core.reset(a || ctx.localActor, o),
    drops: () => core.drops.length,
  };
  registerRange(ctx, core);
  return api;
}
