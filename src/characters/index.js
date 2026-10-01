// FLUX TAG characters & animation (piece: avatars). See docs/pieces/avatars.md.
//   ctx.characters.spawn(actor) / remove / update / tagOut(actor, dir) / muzzleWorldPos(actor) / setVisible / hitTest(ray, ignore)
import * as THREE from 'three';
import { buildModel, applyCosmetics, setHeld, disposeModel } from './model.js';
import { animate, onFire, onReload, onThrow, onHit, startSwitch, landImpact, resetFeet } from './anim.js';
import { classOf } from './weapons.js';
import { broad, narrow, fillHit, createDebugMesh, updateDebugMesh, CAPS, NC } from './hitboxes.js';
import { createTagOutFx } from './tagout.js';
import { startTagOut, tickTag, resetTag } from './sequence.js';
import { registerGallery } from './gallery.js';

const idOf = (t) => (typeof t === 'string' ? t : t?.id || null);
const _hit = { actor: null, hitgroup: '', point: null, distance: 0, normal: null };
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

export function create(ctx) {
  const scene = ctx.render?.scene || new THREE.Scene();
  const group = new THREE.Group(); group.name = 'characters'; scene.add(group);
  const fx = createTagOutFx(ctx, group);
  const models = new Map();
  let tick = 0, viewActor = undefined, showHb = false, showNames = false;
  const state = { thirdPerson: false, hitDebug: null };

  const resolveSpec = (actor) => { try { return ctx.cosmetics?.resolve?.(actor.cosmetics) || null; } catch { return null; } };
  const model = (a) => (a ? models.get(a.id) : null);
  const compatVfx = () => !!(ctx.vfx && ctx.vfx.shards && !ctx.vfx.characterDriven && !ctx.vfx.__stub);

  // ------------------------------------------------------------------ lifecycle
  function spawn(actor, o = {}) {
    let m = models.get(actor.id);
    if (m) { if (o.spec || o.refresh) applyCosmetics(m, o.spec || resolveSpec(actor)); if (o.materialise) resetTag(m); return m; }
    m = buildModel(ctx, actor, o.spec || resolveSpec(actor));
    m.auto = !!o.auto; group.add(m.root); models.set(actor.id, m); actor.model = m;
    if (actor.alive === false) { m.hidden = true; m.root.visible = false; }
    else if (o.materialise ?? !o.auto) m.spawnT = 0;
    m.aliveLast = actor.alive; m.wantId = undefined;
    return m;
  }
  function remove(actor) {
    const m = models.get(actor.id); if (!m) return; models.delete(actor.id); disposeModel(m); if (m.hbDbg) m.hbDbg.removeFromParent(); if (m.plate) m.plate.removeFromParent(); if (actor.model === m) actor.model = null;
  }
  function refreshCosmetics(actor) { const m = model(actor); if (m) applyCosmetics(m, resolveSpec(actor)); }
  function setVisible(a, v) {
    if (typeof a === 'boolean') { for (const m of models.values()) { m.visible = a; m.root.visible = a && !m.hidden; } return; }
    const m = model(a); if (m) { m.visible = v; m.root.visible = v && !m.hidden; }
  }
  function setViewActor(a) { viewActor = a; }
  function autoManage() {
    for (const a of ctx.actors) if (!models.has(a.id)) spawn(a, { auto: true });
    for (const m of models.values()) if (m.auto && !ctx.actors.includes(m.actor)) remove(m.actor);
  }

  // ------------------------------------------------------------------ tagger sync
  function syncHeld(m, forceId) {
    const a = m.actor, dbg = m.dbg; let e = null;
    try { e = ctx.combat?.equipped?.(a) || null; } catch { e = null; }
    let id = forceId !== undefined ? forceId : dbg?.weapon !== undefined ? dbg.weapon : (e ? idOf(e.def) || e.id || null : (ctx.combat?.equipped ? null : 'arc'));
    const def = e?.def || (id && ctx.combat?.taggers?.[id]) || null, cls = id ? classOf(id, def) : 'none';
    if (id !== m.wantId) {
      const first = m.wantId === undefined; m.wantId = id;
      if (first || dbg?.instant || m.hidden) setHeld(ctx, m, id, cls, m.spec.taggerSkin);
      else startSwitch(m, id, cls, (mm, s) => setHeld(ctx, mm, s.id, s.cls, mm.spec.taggerSkin));
    }
    // reload from combat state
    if (e) {
      if (e.state === 'reload') { if (!m.reload && !m.reloadSeen) { m.reloadSeen = true; onReload(m, cls, def?.reloadTime ?? def?.reload ?? 2.2); } }
      else if (m.reloadSeen) { m.reloadSeen = false; if (m.reload && m.reload.t < m.reload.dur * 0.88) m.reload.t = m.reload.dur * 0.88; }
    }
    if (m.held.ball) m.held.ball.visible = false;
  }

  // ------------------------------------------------------------------ tag-out
  function tagOut(actor, dir, o = {}) {
    const m = model(actor) || spawn(actor, { auto: true, materialise: false }); if (!m || m.tag) return false;
    let d = dir || m.lastHitDir;
    return startTagOut(ctx, m, d, { ...o, compat: compatVfx() });
  }

  // ------------------------------------------------------------------ events
  const on = (t, fn) => ctx.events.on(t, (e) => { try { fn(e); } catch (err) { console.error('[characters]', t, err); ctx.errors?.push?.(`characters ${t}: ${err?.stack || err}`); } });
  on('weapon:fire', (e) => { const m = model(e.actor); if (!m || m.tag) return; const id = idOf(e.tagger), cls = id ? classOf(id, e.tagger) : m.held.cls; onFire(m, cls); });
  on('weapon:reload', (e) => {
    const m = model(e.actor); if (!m || m.tag) return; const id = idOf(e.tagger), def = typeof e.tagger === 'object' ? e.tagger : ctx.combat?.taggers?.[id], cls = id ? classOf(id, def) : m.held.cls, st = String(e.stage ?? 'start');
    if (/cancel|abort|interrupt/.test(st)) m.reload = null;
    else if (/end|done|finish|complete/.test(st)) { if (m.reload) m.reload.t = Math.max(m.reload.t, m.reload.dur * 0.9); }
    else { m.reloadSeen = true; onReload(m, cls, def?.reloadTime ?? def?.reload ?? 2.2); }
  });
  on('weapon:switch', (e) => { const m = model(e.actor); if (m && !m.tag) syncHeld(m, idOf(e.tagger) ?? undefined); });
  on('util:throw', (e) => { const m = model(e.actor); if (m && !m.tag) onThrow(m); });
  on('tag:hit', (e) => {
    const m = model(e.victim); if (!m || m.tag) return; const d = e.dir || (e.attacker ? _v.subVectors(e.victim.pos, e.attacker.pos).setY(0).normalize() : null); if (!d) return;
    m.lastHitDir = m.lastHitDir || new THREE.Vector3(); m.lastHitDir.set(d.x, d.y || 0, d.z);
    const c = Math.cos(m.hipsYaw), s = Math.sin(m.hipsYaw);
    _v2.set(d.x * c - d.z * s, 0, d.x * s + d.z * c); onHit(m, _v2, e.damage ?? 20, e.hitgroup === 'crown' || e.hitgroup === 'head');
  });
  on('tag:out', (e) => {
    const v = e.victim; if (!v) return; let d = e.dir;
    if (!d && e.attacker) d = _v.subVectors(v.pos, e.attacker.pos).setY(0).normalize().clone();
    tagOut(v, d);
  });
  on('footstep', (e) => {
    const m = model(e.actor); if (!m || m.gaitW < 0.5) return;
    const p2 = m.phase * 2, frac = p2 - Math.round(p2); m.phasePending = (m.phasePending || 0) - frac * 0.5 * 0.4;
  });
  on('land', (e) => { const m = model(e.actor); if (m) landImpact(m, e.speed ?? 6); });
  on('jump', (e) => { const m = model(e.actor); if (m) m.jumpT = 0; });
  on('spectate', (e) => { viewActor = e.actor || null; });
  on('round:start', () => { fx.clear(); for (const m of models.values()) { if (m.actor.alive !== false) { if (m.tag) resetTag(m); else if (!m.auto || m.actor.alive) m.spawnT = 0; } } });

  // ------------------------------------------------------------------ frame update
  function fixedUpdate() { tick++; for (const m of models.values()) { m.prev.copy(m.cur); m.cur.copy(m.actor.pos); } }
  function fpOf(m) { const va = viewActor !== undefined ? viewActor : (ctx.localActor?.alive !== false ? ctx.localActor : null); return !state.thirdPerson && va === m.actor; }
  function update(dt, alpha) {
    autoManage();
    for (const m of models.values()) {
      const a = m.actor;
      if (!m.tag && a.alive === false && m.aliveLast !== false && !m.hidden && !m.manual) tagOut(a, m.lastHitDir);
      if (a.alive !== false && m.aliveLast === false) { if (m.tag || m.hidden) resetTag(m); }
      m.aliveLast = a.alive;
      const fp = fpOf(m);
      if (fp !== m.firstPerson) { m.firstPerson = fp; m.mat.colorWrite = !fp; m.mat.depthWrite = !fp; if (m.held.obj) m.held.obj.visible = !fp; }
      if (m.hidden) continue;
      if (m.dbg?.loop) m.dbg.loop(m, dt);
      if (m.tag && tickTag(ctx, m, dt, fx, tick)) continue;
      if (!m.visible) { continue; }
      syncHeld(m);
      animate(ctx, m, dt, alpha);
      if (m.held.obj) m.held.obj.visible = !fp && !m.hideHeld;
      if (showHb) { if (!m.hbDbg) { m.hbDbg = createDebugMesh(m); scene.add(m.hbDbg); } m.hbDbg.visible = true; updateDebugMesh(m, m.hbDbg, tick); } else if (m.hbDbg) m.hbDbg.visible = false;
      if (showNames) updatePlate(m);
    }
    fx.update(dt);
  }

  // ------------------------------------------------------------------ nameplates (optional)
  function updatePlate(m) {
    if (!m.plate) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); sp.scale.set(1.0, 0.25, 1); sp.renderOrder = 10; sp.userData.canvas = c; sp.userData.tex = t; m.plate = sp;
      m.attach.nameplate.add(sp);
    }
    const sp = m.plate; if (sp.userData.name !== m.actor.name) {
      sp.userData.name = m.actor.name; const c = sp.userData.canvas, g = c.getContext('2d'); g.clearRect(0, 0, 256, 64);
      g.fillStyle = 'rgba(8,10,14,0.6)'; g.fillRect(8, 12, 240, 40); g.fillStyle = '#' + m.teamColor.toString(16).padStart(6, '0'); g.fillRect(8, 12, 6, 40);
      g.font = '700 28px "Barlow Condensed", "Arial Narrow", sans-serif'; g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(String(m.actor.name || '').toUpperCase().slice(0, 14), 24, 33); sp.userData.tex.needsUpdate = true;
    }
    sp.visible = !m.firstPerson;
  }

  // ------------------------------------------------------------------ hitboxes
  function testOne(m, ro, rd, far) {
    if (!broad(m, ro, rd, far)) return -1; return narrow(m, ro, rd, far, tick);
  }
  const skip = (m, ignore) => (Array.isArray(ignore) ? ignore.includes(m.actor) : m.actor === ignore);
  const usable = (m) => m.actor.alive !== false && !m.tag && !m.hidden && m.visible && !m.manualNoHit;
  /** ray: THREE.Ray | Raycaster | {origin, direction}; ignore: actor (or array) to skip; far: max distance. */
  function hitTest(ray, ignore, far) {
    const ro = ray.origin || ray.ray?.origin, rd = ray.direction || ray.ray?.direction; far = far ?? ray.far ?? 1000; if (!isFinite(far)) far = 1000;
    let bm = null, bi = -1, bt = far;
    for (const m of models.values()) {
      if (skip(m, ignore) || !usable(m)) continue;
      const i = testOne(m, ro, rd, bt); if (i >= 0 && m._t <= bt) { bt = m._t; bm = m; bi = i; }
    }
    return bm ? fillHit(bm, bi, ro, rd, bt, { actor: null, hitgroup: '', point: null, distance: 0, normal: null }) : null;
  }
  /** All actor hits along the ray (one per actor), nearest first: for penetration / wallbang logic. */
  function hitTestAll(ray, ignore, far, out = []) {
    const ro = ray.origin || ray.ray?.origin, rd = ray.direction || ray.ray?.direction; far = far ?? ray.far ?? 1000; if (!isFinite(far)) far = 1000; out.length = 0;
    for (const m of models.values()) {
      if (skip(m, ignore) || !usable(m)) continue;
      const i = testOne(m, ro, rd, far); if (i >= 0) out.push(fillHit(m, i, ro, rd, m._t, { actor: null, hitgroup: '', point: null, distance: 0, normal: null }));
    }
    out.sort((a, b) => a.distance - b.distance); return out;
  }

  function muzzleWorldPos(actor, out = new THREE.Vector3()) {
    const m = model(actor); if (!m) return actor.eyePos ? actor.eyePos(out).addScaledVector(actor.forward(_v), 0.6) : out.copy(actor.pos);
    const mz = m.held.muzzle;
    if (mz) { mz.updateWorldMatrix(true, false); return out.setFromMatrixPosition(mz.matrixWorld); }
    m.pivot.updateWorldMatrix(true, false); return out.set(0, 0.03, -0.6).applyMatrix4(m.pivot.matrixWorld);
  }
  /** World-space object for a named attach point: head, visor, back, shoulderL/R, handR, handL, trailEmitter, nameplate, weapon, hip. */
  function attachPoint(actor, name) { return model(actor)?.attach[name] || null; }

  // ------------------------------------------------------------------ api
  const api = {
    spawn, remove, update, fixedUpdate, tagOut, muzzleWorldPos, setVisible, hitTest, hitTestAll, attachPoint, refreshCosmetics, setViewActor,
    handlesTagOut: true,             // vfx should NOT spawn its own shard burst on tag:out (see docs/requests/vfx-from-avatars-1.md)
    model, models, group, fx,
    get count() { return models.size; },
    setThirdPerson(b) { state.thirdPerson = !!b; },
    showHitboxes(b) { showHb = !!b; }, showNameplates(b) { showNames = !!b; for (const m of models.values()) if (m.plate) m.plate.visible = showNames; },
    clearEffects() { fx.clear(); },
    stats() {
      let tris = 0; for (const m of models.values()) tris += m.mesh.geometry.attributes.position.count / 3;
      return { actors: models.size, trisPerActor: models.size ? Math.round(tris / models.size) : 0, particles: fx.count(), drawCalls: ctx.render?.info?.()?.calls };
    },
    dispose() { for (const m of [...models.values()]) remove(m.actor); fx.dispose(); group.removeFromParent(); },
    debug: null,
  };
  api.debug = registerGallery(ctx, api, { models, group, scene, getTick: () => tick, spawn, remove, fx, state, CAPS, NC, syncHeld });
  return api;
}
