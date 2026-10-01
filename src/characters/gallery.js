// ?scene=character-gallery : lineup of both teams in every pose, orbit camera, tag-out replay, hitbox overlay.
// Also exposes ctx.characters.debug.* for deterministic inspection (see docs/pieces/avatars.md).
import * as THREE from 'three';
import { createActor } from '../core/actor.js';
import { onFire, onReload, onThrow, onHit, landImpact } from './anim.js';
import { resetTag } from './sequence.js';
import { SAMPLE_SPECS, HELMETS, VISORS, BACKS, PATTERNS, TAGOUTS } from './defaults.js';
import { NC, CAPS, GROUP_COLORS } from './hitboxes.js';
import { TEAMS } from '../core/config.js';

const R = (v) => v;
// [name, dbg-props]. vel = [x(right), z(back)] m/s relative to aim yaw (treadmill).
const POSES = {
  idle: {}, walk: { vel: [0, -2.5] }, walkBack: { vel: [0, 2.5] }, strafeL: { vel: [-2.5, 0] }, strafeR: { vel: [2.5, 0] },
  run: { vel: [0, -5.2] }, runBack: { vel: [0, 4.2] }, runL: { vel: [-4.6, 0] }, runR: { vel: [4.6, 0] },
  runFL: { vel: [-3.7, -3.7] }, runFR: { vel: [3.7, -3.7] }, runBL: { vel: [-3.0, 3.0] }, runBR: { vel: [3.0, 3.0] },
  crouch: { crouch: 1 }, crouchWalk: { crouch: 1, vel: [0, -1.6] }, crouchStrafe: { crouch: 1, vel: [1.6, 0] },
  jump: { air: true, vy: 4.5 }, fall: { air: true, vy: -7 }, slide: { slide: true, vel: [0, -6], crouch: 1 },
  aimUp: { pitch: 0.95 }, aimDown: { pitch: -0.85 },
  // one-shot actions looped
  fire: { loop: 'fire', every: 0.2 }, reload: { loop: 'reload', every: 3.2 }, switch: { loop: 'switch', every: 1.6 }, throw: { weapon: 'haze', loop: 'throw', every: 1.5 },
  melee: { weapon: 'tap', loop: 'fire', every: 0.9 }, plant: { plant: 1 }, disarm: { plant: 2 }, hit: { loop: 'hit', every: 0.9 }, land: { loop: 'land', every: 1.4 },
  spawn: { loop: 'spawn', every: 2.0 }, tagout: { loop: 'tagout', every: 3.8 },
  // hold poses
  pistol: { weapon: 'pip' }, smg: { weapon: 'zip' }, rifle: { weapon: 'arc' }, sniper: { weapon: 'lance' }, shotgun: { weapon: 'scatter' }, lmg: { weapon: 'storm' }, grenade: { weapon: 'haze' }, beacon: { weapon: 'beacon' },
};
const PAGES = [
  ['idle', 'walk', 'walkBack', 'strafeL', 'strafeR', 'run', 'runBack', 'runFL', 'runFR', 'runBL', 'runBR', 'crouch', 'crouchWalk', 'jump', 'fall', 'slide'],
  ['pistol', 'smg', 'rifle', 'sniper', 'shotgun', 'lmg', 'melee', 'grenade', 'beacon', 'fire', 'reload', 'switch', 'throw', 'plant', 'hit', 'aimUp', 'aimDown'],
  ['tagout', 'tagout', 'tagout', 'tagout', 'tagout', 'tagout', 'spawn'],   // tag-out styles page: each figure uses a style
];
const TAG_STYLE_PAGE = TAGOUTS;
const WEAPON_BY_TEAM = { ember: 'arc', tide: 'rail' };

export function registerGallery(ctx, api, X) {
  const { models, scene, spawn, remove, fx } = X;
  const S = { active: false, actors: [], orbit: { az: 0, el: 12, dist: 7.5, tx: 0, ty: 1.0, tz: 0, fov: 34 }, page: 0, layout: 'lineup', group: null, saved: {}, labels: [], overlay: null, marker: null, key: null };
  const rng = { s: 12345, next() { this.s = (this.s * 1664525 + 1013904223) >>> 0; return this.s / 4294967296; } };

  // ------------------------------------------------------------------ pose application
  function trigger(m, what) {
    const a = m.actor, cls = m.held.cls;
    switch (what) {
      case 'fire': ctx.events.emit('weapon:fire', { actor: a, tagger: m.held.id || 'arc', origin: a.pos, dir: a.forward(), hitscan: true }); break;
      case 'reload': onReload(m, cls, 2.4); break;
      case 'throw': onThrow(m); break;
      case 'hit': ctx.events.emit('tag:hit', { attacker: null, victim: a, damage: 30, hitgroup: 'chest', dir: { x: Math.sin(a.yaw), y: 0, z: Math.cos(a.yaw) * -1 } }); break;
      case 'land': landImpact(m, 8); break;
      case 'spawn': m.spawnT = 0; break;
      case 'tagout': { const d = new THREE.Vector3(0.35, 0, -1).normalize(); if (m.tag || m.hidden) resetTag(m); api.tagOut(a, d, { style: m.dbg?.style }); break; }
      case 'switch': { const ids = a.team === 'tide' ? ['rail', 'pip', 'zip'] : ['arc', 'pip', 'lance']; m.dbg._sw = ((m.dbg._sw || 0) + 1) % ids.length; m.dbg.weapon = ids[m.dbg._sw]; break; }
    }
  }
  function applyPose(m, name, opts = {}) {
    const p = POSES[name]; if (!p) throw new Error('unknown pose ' + name);
    const keepWeapon = m.dbg?.weapon;
    const dbg = m.dbg = { instant: true, weapon: WEAPON_BY_TEAM[m.actor.team] };
    if (opts.instantWeapon === false) dbg.instant = false;
    if (p.vel) dbg.vel = { x: p.vel[0], z: p.vel[1] };
    if (p.crouch != null) dbg.crouch = p.crouch; if (p.air) { dbg.air = true; dbg.vy = p.vy; } if (p.slide) dbg.slide = true; if (p.plant) dbg.plant = p.plant; if (p.weapon !== undefined) dbg.weapon = p.weapon;
    if (p.loop === 'switch') { dbg.instant = false; }
    m.actor.pitch = p.pitch ?? 0; m.pose = name;
    if (p.loop) { dbg.t = p.every * 0.8; dbg.loop = (mm, dt) => { mm.dbg.t += dt; if (mm.dbg.t >= p.every) { mm.dbg.t = 0; trigger(mm, p.loop); } }; }
    if (name === 'tagout' && opts.style) dbg.style = opts.style;
    if (name === 'plant' || name === 'disarm') dbg.weapon = 'beacon';
    if (p.crouch != null || p.plant) { m.crouch = p.crouch ?? 1; }
    if (p.air) { m.airW = 1; m.airTime = 1; }
    if (m.tag || m.hidden) resetTag(m), m.spawnT = -1, m.u.uMat.value = 1;
    m.feetInit = false; m.reload = null; m.sw = null; m.meleeT = m.throwT = -1; m.phase = 0; m.wantId = undefined; m.held.id = undefined;
    m.legOffset = 0; m.moving = false;
    if (p.loop === 'fire' || name === 'fire') m.fireT = 0;
    return m;
  }

  // ------------------------------------------------------------------ scene
  function makeActor(team, i, spec) {
    const a = createActor({ name: (team === 'ember' ? 'EMB' : 'TDE') + (i + 1), team }); a.yaw = Math.PI; a.cosmetics = null;
    const m = spawn(a, { spec, materialise: false }); m.manual = true; m.dbg = { instant: true, weapon: WEAPON_BY_TEAM[team] }; S.actors.push(a); return m;
  }
  function clearActors() { for (const a of S.actors) remove(a); S.actors.length = 0; for (const l of S.labels) l.removeFromParent(); S.labels.length = 0; fx.clear(); }
  function label(text, x, y, z) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48; const g = c.getContext('2d');
    g.fillStyle = 'rgba(10,12,16,0.55)'; g.fillRect(0, 6, 256, 36); g.font = '600 24px system-ui, sans-serif'; g.fillStyle = '#e8eef6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 25);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false })); sp.scale.set(1.15, 0.215, 1); sp.position.set(x, y, z); sp.renderOrder = 20; S.group.add(sp); S.labels.push(sp); return sp;
  }
  function layout(kind = 'lineup', page = 0, poseOverride) {
    if (!S.group) buildStage(); clearActors(); S.layout = kind; S.page = page;
    if (kind === 'pair' || kind === 'solo') {
      const ms = [];
      ms.push(makeActor('ember', 0, SAMPLE_SPECS[0]));
      if (kind === 'pair') ms.push(makeActor('tide', 0, SAMPLE_SPECS[0]));
      ms.forEach((m, i) => { m.actor.pos.set(kind === 'pair' ? (i ? 0.85 : -0.85) : 0, 0, 0); m.cur.copy(m.actor.pos); m.prev.copy(m.actor.pos); m.rp.copy(m.actor.pos); m.lastRp.copy(m.actor.pos); m.root.position.copy(m.actor.pos); m.hipsYaw = m.actor.yaw; });
      S.orbit.dist = kind === 'pair' ? 4.6 : 3.6; S.orbit.ty = 0.95; S.orbit.tx = 0; S.orbit.el = 8;
      if (poseOverride) ms.forEach((m) => applyPose(m, poseOverride));
      return ms;
    }
    if (kind === 'cosmetics') {  // every helmet x visor x back x pattern x tag-out on show
      const n = SAMPLE_SPECS.length; const ms = [];
      for (let i = 0; i < 16; i++) {
        const spec = i < n ? SAMPLE_SPECS[i] : { helmet: { shape: HELMETS[i % HELMETS.length] }, visor: { shape: VISORS[i % VISORS.length] }, back: { model: BACKS[i % BACKS.length] }, suit: { pattern: PATTERNS[i % PATTERNS.length] }, tagOutEffect: TAGOUTS[i % TAGOUTS.length] };
        const m = makeActor(i % 2 ? 'tide' : 'ember', i, spec); m.actor.pos.set((i % 8 - 3.5) * 1.3, 0, i < 8 ? 0.7 : -1.2); m.cur.copy(m.actor.pos); m.prev.copy(m.actor.pos); m.rp.copy(m.actor.pos); m.lastRp.copy(m.actor.pos); m.root.position.copy(m.actor.pos); ms.push(m);
      }
      S.orbit.dist = 13; S.orbit.el = 14; S.orbit.ty = 0.95; S.orbit.tx = 0; return ms;
    }
    // lineup: two rows (ember front, tide back), one column per pose
    const names = PAGES[page] || PAGES[0], n = names.length, gap = 1.25, ms = [];
    for (let i = 0; i < n; i++) for (const team of ['ember', 'tide']) {
      const spec = page === 2 ? { tagOutEffect: TAG_STYLE_PAGE[i % TAG_STYLE_PAGE.length] } : SAMPLE_SPECS[0];
      const m = makeActor(team, i, spec), a = m.actor;
      a.pos.set((i - (n - 1) / 2) * gap, 0, team === 'ember' ? 0.9 : -0.9); m.cur.copy(a.pos); m.prev.copy(a.pos); m.rp.copy(a.pos); m.lastRp.copy(a.pos); m.root.position.copy(a.pos);
      applyPose(m, names[i], { style: page === 2 ? TAG_STYLE_PAGE[i % TAG_STYLE_PAGE.length] : undefined });
      if (team === 'ember') label(page === 2 && names[i] === 'tagout' ? TAG_STYLE_PAGE[i % TAG_STYLE_PAGE.length] : names[i], a.pos.x, 2.05, a.pos.z);
      ms.push(m);
    }
    S.orbit.dist = Math.max(8, n * gap * 0.78); S.orbit.el = 13; S.orbit.ty = 0.95; S.orbit.tx = 0; S.orbit.az = 0;
    return ms;
  }

  function buildStage() {
    const g = S.group = new THREE.Group(); g.name = 'character-gallery-stage'; scene.add(g);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: 0x46505f, roughness: 0.85, metalness: 0 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
    const grid = new THREE.GridHelper(28, 28, 0x6b778a, 0x596579); grid.position.y = 0.002; grid.material.transparent = true; grid.material.opacity = 0.35; g.add(grid);
    const key = new THREE.DirectionalLight(0xfff2e0, 2.6); key.position.set(5, 9, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 30; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    const fill = new THREE.DirectionalLight(0x9db8ff, 0.8); fill.position.set(-6, 4, 3);
    const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(-2, 5, -8);
    const hemi = new THREE.HemisphereLight(0xc8d8f0, 0x2a2f38, 0.55);
    g.add(key, fill, rim, hemi); S.key = key;
    // disable the world's own lights + map while the gallery is up
    const r = ctx.render; S.saved = { map: ctx.map?.group?.visible, sun: r?.sun?.visible, hemi: r?.hemi?.visible, bg: scene.background, fog: scene.fog };
    if (ctx.map?.group) ctx.map.group.visible = false; if (r?.sun) r.sun.visible = false; if (r?.hemi) r.hemi.visible = false;
    scene.background = new THREE.Color(0x2b3240); scene.fog = null;
    const la = ctx.localActor; if (la) { const m = api.model(la); if (m) { m.manualNoHit = true; } api.setVisible(la, false); S.hiddenLocal = la; }
    api.setViewActor(null);
  }
  function exitStage() {
    clearActors(); if (S.group) { S.group.removeFromParent(); S.group = null; }
    const r = ctx.render; if (ctx.map?.group && S.saved.map !== undefined) ctx.map.group.visible = S.saved.map; if (r?.sun && S.saved.sun !== undefined) r.sun.visible = S.saved.sun; if (r?.hemi && S.saved.hemi !== undefined) r.hemi.visible = S.saved.hemi;
    scene.background = S.saved.bg ?? scene.background; scene.fog = S.saved.fog ?? scene.fog; if (S.hiddenLocal) api.setVisible(S.hiddenLocal, true); S.active = false; api.setViewActor(undefined);
    if (S.overlay) { S.overlay.remove(); S.overlay = null; }
  }

  // ------------------------------------------------------------------ camera + input
  const _cam = new THREE.Vector3();
  const sys = {
    update() {
      if (!S.active) return; const o = S.orbit, cam = ctx.render.camera, az = THREE.MathUtils.degToRad(o.az), el = THREE.MathUtils.degToRad(o.el);
      cam.fov = o.fov; cam.updateProjectionMatrix?.();
      cam.position.set(o.tx + Math.sin(az) * Math.cos(el) * o.dist, o.ty + Math.sin(el) * o.dist, o.tz + Math.cos(az) * Math.cos(el) * o.dist);
      cam.lookAt(o.tx, o.ty, o.tz);
      if (S.key) { S.key.target.position.set(o.tx, 0, o.tz); S.key.target.updateMatrixWorld(); }
    },
  };
  function attachInput() {
    const el = ctx.render.renderer.domElement; let drag = null;
    el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0, btn: e.button }; });
    addEventListener('pointerup', (e) => { if (drag && drag.moved < 4 && e.target === el) clickTest(e); drag = null; });
    addEventListener('pointermove', (e) => { if (!drag || !S.active) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.btn === 2 || e.shiftKey) { S.orbit.tx -= dx * 0.008 * Math.cos(THREE.MathUtils.degToRad(S.orbit.az)); S.orbit.tz += dx * 0.008 * Math.sin(THREE.MathUtils.degToRad(S.orbit.az)); S.orbit.ty += dy * 0.006; }
      else { S.orbit.az -= dx * 0.35; S.orbit.el = THREE.MathUtils.clamp(S.orbit.el + dy * 0.3, -5, 80); } });
    addEventListener('wheel', (e) => { if (S.active) S.orbit.dist = THREE.MathUtils.clamp(S.orbit.dist * (1 + Math.sign(e.deltaY) * 0.08), 1.6, 30); }, { passive: true });
    addEventListener('keydown', (e) => {
      if (!S.active) return;
      if (e.code === 'KeyH') api.showHitboxes(!api.__hb && (api.__hb = true)) , (api.__hb = api.__hb), toggleHb();
      else if (e.code === 'KeyT') replayTagOut();
      else if (e.code === 'KeyN') { S.names = !S.names; api.showNameplates(S.names); }
      else if (e.code === 'BracketRight') layout('lineup', (S.page + 1) % PAGES.length);
      else if (e.code === 'BracketLeft') layout('lineup', (S.page + PAGES.length - 1) % PAGES.length);
      else if (e.code === 'KeyP') layout('pair'); else if (e.code === 'KeyO') layout('lineup', 0); else if (e.code === 'KeyC') layout('cosmetics');
      else if (e.code === 'KeyR') { S.orbit.az = 0; S.orbit.el = 12; }
    });
  }
  let hbOn = false;
  function toggleHb(v) { hbOn = v ?? !hbOn; api.showHitboxes(hbOn); updateOverlay(); }
  function replayTagOut() { for (const a of S.actors) { const m = api.model(a); if (!m) continue; if (m.tag || m.hidden) resetTag(m), m.spawnT = -1, m.u.uMat.value = 1; api.tagOut(a, new THREE.Vector3(0.3, 0, -1).normalize(), { style: m.dbg?.style }); } }
  function clickTest(e) {
    const el = ctx.render.renderer.domElement, r = el.getBoundingClientRect(), nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1;
    const rc = new THREE.Raycaster(); rc.setFromCamera({ x: nx, y: ny }, ctx.render.camera);
    const h = api.hitTest(rc.ray, null, 60);
    if (!S.marker) { S.marker = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false })); S.marker.renderOrder = 1000; scene.add(S.marker); }
    S.marker.visible = !!h; if (h) { S.marker.position.copy(h.point); S.lastHit = `${h.actor.name} : ${h.hitgroup.toUpperCase()}  ${h.distance.toFixed(2)} m`; } else S.lastHit = 'miss';
    updateOverlay();
  }
  function updateOverlay() {
    if (ctx.params.get('ui') === '0') return;
    if (!S.overlay) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:12px;bottom:10px;font:12px/1.5 system-ui,sans-serif;color:#dfe8f5;background:rgba(10,12,16,.55);padding:6px 10px;border-radius:6px;pointer-events:none;z-index:50;white-space:pre'; document.body.appendChild(d); S.overlay = d; }
    S.overlay.textContent = `character-gallery   layout ${S.layout}${S.layout === 'lineup' ? ' page ' + (S.page + 1) + '/' + PAGES.length : ''}\n[ ]  page   P pair   O lineup   C cosmetics   H hitboxes ${hbOn ? 'ON' : 'off'}   T tag-out replay   N nameplates   drag=orbit  wheel=zoom  click=hit test\n${S.lastHit ? 'hit: ' + S.lastHit : ''}`;
  }

  async function open() {
    if (S.active) return; S.active = true; buildStage(); ctx.engine.add(sys, 999); attachInput(); layout(ctx.params.get('layout') || 'lineup', +(ctx.params.get('page') || 0), ctx.params.get('pose') || undefined);
    if (ctx.params.get('hitboxes')) toggleHb(true); updateOverlay();
  }
  ctx.debugScenes['character-gallery'] = open;

  // ------------------------------------------------------------------ debug API
  const debug = {
    poses: Object.keys(POSES), pages: PAGES, samples: SAMPLE_SPECS,
    open, layout, exit: exitStage,
    /** Apply a pose to one actor (or every gallery actor). name ∈ debug.poses */
    pose(name, actor) {
      if (!S.active) return open().then(() => debug.pose(name, actor));
      const list = actor ? [api.model(actor)] : [...S.actors].map((a) => api.model(a)); for (const m of list) if (m) applyPose(m, name); return list.length;
    },
    /** Force the held tagger id for one/all actors (pip, zip, arc, rail, lance, scatter, storm, tap, haze, beacon...). */
    setTagger(id, actor) { const list = actor ? [api.model(actor)] : S.actors.map((a) => api.model(a)); for (const m of list) if (m) { m.dbg = m.dbg || {}; m.dbg.weapon = id; m.dbg.instant = true; } },
    trigger(what, actor) { const list = actor ? [api.model(actor)] : S.actors.map((a) => api.model(a)); for (const m of list) if (m) trigger(m, what); },
    hitboxes: toggleHb, replayTagOut,
    tagOutAll(style) { for (const a of S.actors) { const m = api.model(a); if (m) { if (m.tag || m.hidden) resetTag(m), m.spawnT = -1, m.u.uMat.value = 1; api.tagOut(a, new THREE.Vector3(0.3, 0, -1).normalize(), { style: style || m.dbg?.style }); } } },
    cam(az, el, dist, ty, tx) { const o = S.orbit; if (az !== undefined) o.az = az; if (el !== undefined) o.el = el; if (dist !== undefined) o.dist = dist; if (ty !== undefined) o.ty = ty; if (tx !== undefined) o.tx = tx; },
    actors: () => S.actors, orbit: S.orbit,
    /** Aim direction for gallery actors (yaw radians, +left). */
    setYaw(y) { for (const a of S.actors) a.yaw = y; },
    /** Measure planted-foot slip (m per stance) for a real moving actor: returns max horizontal foot speed while in stance. */
    footSlip(actor) { const m = api.model(actor); return m ? m.slip || 0 : 0; },
    stats: () => api.stats(),
    capsules: () => CAPS.map((c) => c[0]),
  };
  return debug;
}
