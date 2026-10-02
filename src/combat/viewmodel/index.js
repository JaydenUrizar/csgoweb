// First-person viewmodels — owner: `viewmodel` piece. Imported by src/combat/index.js as ctx.combat.viewmodel.
// API (docs/ARCHITECTURE.md "Stable shared APIs" + extensions listed in docs/pieces/viewmodel.md):
//   setTagger(id, skin, opts) · event(name, payload) · worldModel(id, skin) · muzzle · update(dt, state) · setVisible(b)
import * as THREE from 'three';
import { Spring, clamp, approach, smooth, sampleTrack, lerp } from './anim.js';
import { getViewModel, getWorldModel, DEFS, IDS } from './models.js';
import { Hand, createHandMats } from './hands.js';
import { profile } from './profiles.js';
import { clipsFor } from './clips.js';
import { setGauge } from './builder.js';
import { createFx, frand, seedFx } from './fx.js';

const DEG = Math.PI / 180, TAU = Math.PI * 2;
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _col = new THREE.Color();
const _piv = new THREE.Vector3(0, 0.02, 0.26);       // point the rig rotates about (behind the grip -> weapon sweeps like it is held from the shoulder)
const CH6 = ['w', 'rh', 'lh'], CH1 = ['rc', 'lc'];
const MARKS_QUIET = new Set(['draw']);

export function createViewmodel(ctx) {
  if (ctx.__viewmodel) return ctx.__viewmodel;
  const R = ctx.render, viewScene = R?.viewScene, viewCamera = R?.viewCamera;
  if (!viewScene || !viewCamera) { const st = { __stub: true, setTagger() {}, event() {}, worldModel: (id, sk) => getWorldModel(id, sk), update() {}, setVisible() {}, muzzle: null }; return st; }

  // ---------------------------------------------------------------- scene graph
  if (!viewCamera.parent) viewScene.add(viewCamera);
  viewCamera.layers.enable(3);
  const root = new THREE.Group(); root.name = 'viewmodel-root'; viewCamera.add(root);
  const rig = new THREE.Group(); rig.name = 'viewmodel-rig'; root.add(rig);
  const muzzleObj = new THREE.Object3D(); muzzleObj.name = 'viewmodel-muzzle'; rig.add(muzzleObj);
  const castRoot = new THREE.Group(); castRoot.name = 'viewmodel-fx'; viewCamera.add(castRoot);
  const shoulderR = new THREE.Object3D(), shoulderL = new THREE.Object3D(); shoulderR.position.set(0.34, -0.5, 0.36); shoulderL.position.set(-0.3, -0.55, 0.34); root.add(shoulderR, shoulderL);
  const lights = new THREE.Group(); lights.name = 'viewmodel-lights'; viewCamera.add(lights);
  const key = new THREE.DirectionalLight(0xfff0dc, 2.6); key.position.set(-0.7, 1.1, 0.5); key.target.position.set(0.1, -0.2, -0.5);
  const fill = new THREE.HemisphereLight(0xcfe2ff, 0x6a5a48, 0.95);
  const rim = new THREE.DirectionalLight(0x9fd4ff, 1.5); rim.position.set(0.9, 0.4, -1.4); rim.target.position.set(0.1, -0.2, -0.4);
  const under = new THREE.DirectionalLight(0xffb070, 0.5); under.position.set(0.2, -1, 0.3); under.target.position.set(0.1, -0.2, -0.5);
  lights.add(key, key.target, fill, rim, rim.target, under, under.target);
  try {   // stylised studio reflections for the metal parts
    if (R.renderer && !viewScene.environment) {
      const pm = new THREE.PMREMGenerator(R.renderer); const envScene = new THREE.Scene(); envScene.background = new THREE.Color(0x28303c);
      const panel = (c, i, p, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s[0], s[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); envScene.add(m); };
      panel(0xffffff, 4.5, [-3, 4, 2], [3, 3]); panel(0xbfd8ff, 4, [4, 1, -3], [2, 5]); panel(0xffd2a0, 3, [0, -3, 2], [4, 2]); panel(0xffffff, 2.2, [0, 5, -4], [6, 2]); panel(0x8fa8c8, 1.2, [-5, 0, -2], [2, 6]);
      viewScene.environment = pm.fromScene(envScene, 0.04).texture; viewScene.environmentIntensity = 0.7; pm.dispose();
    }
  } catch (e) { /* environment is optional */ }
  const muzzleFxLight = null; void muzzleFxLight;
  const fx = createFx({ muzzle: muzzleObj, castRoot, root });
  const hmats = createHandMats();
  const handR = new Hand('r', hmats), handL = new Hand('l', hmats);
  rig.add(handR.root, handL.root);

  // ---------------------------------------------------------------- state
  const S = {
    id: null, model: null, prof: profile('pip'), meta: null, clips: null, skin: null, visible: true, ready: false,
    time: 0, shots: 0, heat: 0, heatOverride: null, ammo: 30, ammoMax: 30, ammoShown: -1, ammoLock: -1,
    scopeIn: false, scopeT: 0, zoomLevel: 0, fovMul: 1,
    bobPhase: 0, bobAmp: 0, sprint: 0, crouch: 0, air: 0, hpLow: 0, lookVX: 0, lookVY: 0, lastGround: true, jumpAt: -9, landAt: -9, speed: 0,
    pending: null, hidden: false, consumed: false, plantOn: false, thrown: false, meleeSide: 0, lastEv: {},
    lightPunch: 0,
  };
  const kick = new Spring(6, 260, 21), climb = new Spring(6, 32, 8), look = new Spring(6, 70, 11), land = new Spring(6, 170, 13), jump = new Spring(6, 90, 10), scopeSp = new Spring(1, 120, 16);
  let partSp = {}, chA = {}, chB = {}, partNames = [];
  const act = { name: '', clip: null, t: 0, speed: 1, hold: false, loop: false, markI: 0, on: false, id: 0 };
  const prev = { clip: null, t: 0, speed: 1, on: false, blend: 1 };
  const settings = { fov: 68, offsetX: 0, offsetY: 0, offsetZ: 0, bob: 1 };
  const readSettings = () => { try { const v = ctx.settings?.get?.('viewmodel'); if (v) Object.assign(settings, v); } catch (e) { /* ignore */ } };
  readSettings(); ctx.events?.on?.('settings:change', (e) => { if (e?.key === 'viewmodel') readSettings(); });
  const vFovOf = (h) => 2 * Math.atan(Math.tan((h * DEG) / 2) / (4 / 3)) / DEG;

  const emitMark = (name) => { if (!MARKS_QUIET.has(name)) ctx.events?.emit?.('viewmodel:mark', { id: S.id, name }); };

  // ---------------------------------------------------------------- style (team / suit)
  function refreshStyle() {
    let team = ctx.localActor?.team || 'ember', suit = null;
    try { const c = ctx.cosmetics; if (c?.resolve && c?.getLoadout && ctx.localActor) suit = c.resolve(c.getLoadout(ctx.localActor))?.suit; } catch (e) { /* stub */ }
    hmats.setStyle(team, suit);
  }
  refreshStyle();
  // Integration: loadouts are per team and apply() fires on every round:start/halftime/side pick, so restyle hands + tagger skin when the local loadout changes (otherwise the viewmodel keeps the previous side's colours).
  ctx.events?.on?.('cosmetics:change', (e) => { if (e?.actor !== ctx.localActor || !S.model) return; const sk = e.spec?.taggerSkin; try { if (sk) { S.model.mats.apply(sk); S.skin = sk; } } catch (err) { /* keep old skin */ } refreshStyle(); });

  // ---------------------------------------------------------------- model swapping
  function mkBuffers(model) {
    partNames = Object.keys(model.parts).filter((n) => n !== 'main'); const mk = () => { const o = {}; for (const n of [...CH6, ...partNames]) o[n] = new Float64Array(6); for (const n of CH1) o[n] = new Float64Array(1); return o; };
    chA = mk(); chB = mk();
    partSp = {}; const f = model.meta.fire || {};
    for (const n of partNames) { const s = new Spring(6, f[n]?.k ?? 700, f[n]?.c ?? 40); partSp[n] = s; }
  }
  function setModel(id, skin) {
    if (S.model) { rig.remove(S.model.root); }
    const model = getViewModel(id), prof = profile(id);
    S.id = id; S.model = model; S.prof = prof; S.meta = model.meta; S.clips = clipsFor(id, model.meta, prof);
    model.mats.apply(skin); S.skin = skin;
    model.root.scale.x = ['rifle', 'smg', 'sniper', 'heavy', 'shotgun'].includes(model.meta.cls) ? 0.86 : 1;   // slimmer flanks: reads as a side profile, not a block
    rig.add(model.root); model.root.visible = true; for (const n in model.parts) model.parts[n].visible = true;
    model.root.traverse((o) => o.layers.enable(3));
    muzzleObj.position.copy(model.anchors.muzzle.position);
    mkBuffers(model);
    S.ammoShown = -1; S.heat = 0; S.consumed = false; S.plantOn = false; S.thrown = false;
    kick.reset(); climb.reset(); fx.clear();
    const h = model.meta.hands || {};
    handR.root.visible = !!h.r; handL.root.visible = !!h.l;
    fx.setCellColor(model.mats.glowColor);
    refreshStyle();
    rig.visible = false; S.fresh = true;   // stay hidden until the next update() has posed the rig (no first-frame flash at the camera)
  }
  const skinOf = (s) => (s && s.taggerSkin ? s.taggerSkin : s || null);

  // ---------------------------------------------------------------- actions (clips)
  function startClip(name, { dur, speed, hold = false, loop = false, force = false } = {}) {
    const c = S.clips?.[name]; if (!c) return false;
    if (act.on && /^(reload|bolt|pump|inspect)/.test(act.name) && !name.startsWith('reload')) { resetParts(); S.ammoLock = -1; }
    if (act.on && act.clip) { prev.clip = act.clip; prev.t = act.t; prev.on = true; prev.blend = 0; prev.speed = act.speed; }
    act.name = name; act.clip = c; act.t = 0; act.on = true; act.hold = hold; act.loop = loop; act.markI = 0; act.id++;
    act.speed = speed ?? (dur ? c.dur / dur : 1);
    return true;
  }
  function endClip() { act.on = false; act.clip = null; act.name = ''; }
  const busy = () => act.on && (act.name === 'reload' || act.name === 'draw' || act.name === 'holster');
  function resetParts() { if (!S.model) return; for (const n in S.model.parts) S.model.parts[n].visible = true; if (S.model.gauge.n) setGauge(S.model, S.ammoMax ? S.ammo / S.ammoMax : 1); }

  function doMark(name) {
    if (name.startsWith('hide:')) { const p = S.model?.parts[name.slice(5)]; if (p) p.visible = false; return; }
    if (name.startsWith('show:')) { const p = S.model?.parts[name.slice(5)]; if (p) p.visible = true; return; }
    switch (name) {
      case 'cellOut': dropCell(); break;
      case 'cellIn': S.ammoLock = S.ammoMax; S.ammoShown = -1; break;
      case 'shellIn': S.ammoLock = Math.min(S.ammoMax, (S.ammoLock < 0 ? S.ammo : S.ammoLock) + 1); S.ammoShown = -1; kick.kick(1, -0.002, -0.05); break;
      case 'seat': kick.kick(1, -0.003, -0.12); kick.kick(3, -0.012, -0.5); break;
      case 'eject': ejectCasing(false); break;
      case 'release': S.thrown = true; S.consumed = true; if (S.model) S.model.root.visible = false; ctx.events?.emit?.('viewmodel:release', { id: S.id }); break;
      case 'swingStart': fx.trailStart(S.model?.mats.glowColor || _col.set(0xffaa33)); break;
      case 'swingEnd': fx.trailStop(); break;
      case 'hit': kick.kick(2, 0.012); kick.kick(3, -0.05); break;
      case 'ringSpin': break;
      default: break;
    }
    emitMark(name);
  }
  function dropCell() {
    const m = S.model, cp = m?.parts.cell || m?.parts.drum || m?.parts.cyl; if (!cp) return;
    cp.getWorldPosition(_p); castRoot.worldToLocal(_p);
    const s = m.meta.cellSize || [0.03, 0.09, 0.03];
    fx.drop(_p.x, _p.y, _p.z, s[0], s[1], s[2], m.mats.ammoColor);
  }

  function advanceAct(dt) {
    if (prev.on) { prev.blend += dt / 0.1; if (prev.blend >= 1) { prev.on = false; prev.clip = null; } else prev.t += dt * prev.speed; }
    if (!act.on) return;
    const c = act.clip; act.t += dt * act.speed; const u = act.t / c.dur;
    while (act.markI < c.marks.length && c.marks[act.markI][0] <= u) { doMark(c.marks[act.markI][1]); act.markI++; }
    if (u >= 1) {
      if (act.hold) { act.t = c.dur * 0.999; return; }
      if (act.loop) { act.t = (c.loopFrom || 0) * c.dur; act.markI = 0; while (act.markI < c.marks.length && c.marks[act.markI][0] < (c.loopFrom || 0)) act.markI++; return; }
      const name = act.name; endClip(); onClipEnd(name);
    }
  }
  function onClipEnd(name) {
    if (name === 'holster') { resetParts(); S.ammoLock = -1; }
    if (name === 'holster' && S.pending) { const p = S.pending; S.pending = null; setModel(p.id, p.skin); startClip('draw', { dur: p.time ?? S.prof.draw }); }
    else if (name === 'holster') { S.hidden = true; }
    else if (name.startsWith('reload')) { S.ammoLock = -1; resetParts(); }
    else if (name === 'draw') { /* idle */ }
    else if (name === 'throwRel') { S.hidden = true; ctx.events?.emit?.('viewmodel:throwDone', { id: S.id }); }
    if (name === 'melee1' || name === 'melee2' || name === 'bash' || name === 'inspect' || name === 'empty' || name === 'pump' || name === 'bolt') fx.trailStop();
    resetPartsAfter(name);
  }
  function resetPartsAfter(name) { if (name.startsWith('reload') || name === 'inspect' || name === 'pump' || name === 'bolt') { if (S.model) for (const n in S.model.parts) S.model.parts[n].visible = true; } }

  // ---------------------------------------------------------------- events
  const nowT = () => S.time;
  function dedupe(name, w = 0.03) { const t = nowT(); if (t - (S.lastEv[name] ?? -9) < w) return true; S.lastEv[name] = t; return false; }

  function fire(p = {}) {
    if (!S.model || S.consumed) return;
    if (p.mag != null) { S.ammo = p.mag; if (p.max) S.ammoMax = p.max; } else if (S.ammo > 0) S.ammo = Math.max(0, S.ammo - 1);
    const pr = S.prof, k = pr.kick, n = S.shots++;
    if (act.on && (act.name === 'inspect' || act.name === 'pump' || act.name === 'bolt' || act.name === 'empty' || act.name.startsWith('reloadShell'))) { const nm = act.name; endClip(); onClipEnd(nm); }
    const amp = (i, v, mx) => { kick.x[i] += Math.abs(kick.x[i] + v) < Math.abs(mx) || Math.sign(kick.x[i]) !== Math.sign(v) ? v : 0; };
    const r1 = frand() - 0.5, r2 = frand() - 0.5, sgn = ((n * 2654435761) >>> 3) & 1 ? 1 : -1;
    amp(2, k.z * 0.01 * (0.85 + frand() * 0.3), k.z * 0.01 * k.max);
    amp(3, k.pitch * DEG * (0.85 + frand() * 0.3), k.pitch * DEG * k.max);
    amp(4, (k.yaw * DEG) * (r1 * 2 + 0.3 * sgn), k.yaw * DEG * k.max * 1.5);
    amp(5, (k.roll * DEG) * (r2 * 2 - 0.2 * sgn), k.roll * DEG * k.max * 1.5);
    kick.v[3] += k.pitch * DEG * 3.2; kick.v[2] += k.z * 0.01 * 2.2;
    climb.kick(3, k.pitch * 0.33 * DEG); climb.kick(1, 0.0006);
    // per-part mechanics
    const f = S.meta.fire || {};
    for (const nm of partNames) { const spec = f[nm], sp = partSp[nm]; if (!spec) continue;
      if (spec.kick) for (let i = 0; i < 6; i++) sp.x[i] += spec.kick[i] * (i < 3 ? 0.01 : DEG);
      if (spec.step) for (let i = 0; i < 6; i++) { sp.t[i] += spec.step[i] * (i < 3 ? 0.01 : DEG); }
    }
    // heat
    S.heat = Math.min(1, S.heat + pr.heat);
    // visuals
    fx.fire(pr.flash, S.model.mats.glowColor, p.power ?? 1);
    muzzleObj.updateWorldMatrix(true, false); muzzleObj.getWorldPosition(_p); castRoot.worldToLocal(_p); fx.smoke(_p.x, _p.y, _p.z, (pr.flash.size || 1) * (S.meta.cls === 'pistol' ? 0.6 : 1), S.meta.cls === 'pistol' ? 1 : 2);
    S.model.mats.flash = 1;
    if (!S.meta.afterFire && !p.silent) ejectCasing(true);
    if (S.ammo <= 0) S.ammoLock = -1;
    if (S.meta.afterFire && S.ammo > 0) afterFireT = S.meta.afterFire.delay;
  }
  function ejectCasing() {
    const ej = S.meta.eject; if (!ej || !S.model) return;
    S.model.anchors.eject.updateWorldMatrix(true, false); S.model.anchors.eject.getWorldPosition(_p); castRoot.worldToLocal(_p);
    S.model.anchors.eject.getWorldQuaternion(_q);
    _p2.set(ej.v[0] * 0.55 + (frand() - 0.5) * 0.35, ej.v[1] * 0.55 + frand() * 0.35, ej.v[2] * 0.4 + (frand() - 0.5) * 0.3).applyQuaternion(_q);
    fx.eject(_p.x, _p.y, _p.z, _p2.x, _p2.y, _p2.z, S.model.mats.glowColor, S.meta.ejectSize || 1);
  }
  let afterFireT = -1;

  function reloadClipFor(p) {
    if (p.shell && S.clips.reloadShell) { const n = Math.max(1, (S.ammoMax || 6) - (S.ammo || 0)); const key = 'reloadShell' + n; if (!S.clips[key]) S.clips[key] = S.clips.reloadShell(n); return key; }
    return S.clips.reload ? 'reload' : null;
  }
  function event(name, p = {}) {
    const dur0 = p.dur ?? p.time ?? p.duration;
    if (!S.model && name !== 'ammo' && name !== 'heat') return;
    switch (name) {
      case 'fire': if (dedupe('fire', 0.012)) return; fire(p); break;
      case 'reloadStart': { if (act.on && act.name.startsWith('reload')) return; S.scopeIn = false; const c = reloadClipFor(p); if (!c) return; S.ammoLock = c.startsWith('reloadShell') ? S.ammo : -1; startClip(c, { dur: dur0 ?? (c.startsWith('reloadShell') ? undefined : S.prof.reload) }); break; }
      case 'reloadEnd': { if (act.on && act.name.startsWith('reload')) { act.speed = Math.max(act.speed, 4); } break; }
      case 'draw': if (S.pending) { S.pending.time = Math.max(0.25, (dur0 ?? S.prof.draw) - 0.14); break; } S.hidden = false; S.consumed = false; if (S.model) S.model.root.visible = true; startClip('draw', { dur: dur0 ?? S.prof.draw }); break;
      case 'holster': if (!(act.on && act.name === 'holster')) startClip('holster'); break;
      case 'inspect': if (!busy() && !S.consumed) startClip('inspect', { dur: p.time }); break;
      case 'scopeIn': if (S.meta?.scope) { S.scopeIn = true; if (p.level != null) S.zoomLevel = p.level; ctx.events?.emit?.('viewmodel:scope', { id: S.id, level: S.zoomLevel }); } break;
      case 'scopeOut': S.scopeIn = false; break;
      case 'empty': if (dedupe('empty', 0.08)) return; if (!busy()) startClip('empty'); break;
      case 'melee': if (dedupe('melee', 0.1)) return; if (S.consumed) return; if (p.kind === 'stab' && S.clips.stab) startClip('stab'); else if (S.clips.melee1) { S.meleeSide ^= 1; startClip(S.meleeSide ? 'melee2' : 'melee1'); } else startClip('bash'); break;
      case 'heat': S.heat = Math.max(S.heat, p.value ?? p.heat ?? 0); break;
      case 'ammo': if (p.mag != null) { S.ammo = p.mag; } if (p.max != null) S.ammoMax = p.max; S.ammoShown = -1; break;
      case 'throw': {
        if (!S.clips.throwWind) return; const st = p.stage;
        if (st === 'windup' || st === 'pull') { S.consumed = false; S.hidden = false; if (S.model) S.model.root.visible = true; startClip('throwWind', { hold: true, dur: p.time }); }
        else if (st === 'release') { S.throwPower = p.power ?? 1; S.throwLob = !!p.lob; startClip(S.throwLob ? 'throwLob' : 'throwRel', {}); ctx.events?.emit?.('viewmodel:throw', { id: S.id, power: S.throwPower }); }
        else if (st === 'cancel') { startClip('draw', { dur: 0.35 }); }
        else { const dl = Math.max(0.08, p.delay ?? 0.16), lob = (p.power ?? 1) < 0.6; S.consumed = false; S.hidden = false; S.model.root.visible = true; const nm = lob ? 'throwFullLob' : 'throwFull'; startClip(nm, { dur: Math.max(0.3, Math.min(1.0, dl / 0.58)) }); ctx.events?.emit?.('viewmodel:throw', { id: S.id, power: p.power ?? 1 }); }
        break; }
      case 'plant': case 'disarm': {
        const nm = name === 'plant' ? 'plant' : 'disarm'; const c = S.clips[nm] || S.clips.plant; if (!c) return;
        if (p.on === false || p.stage === 'end' || p.stage === 'cancel') { S.plantOn = false; if (act.on && (act.name === 'plant' || act.name === 'disarm')) { endClip(); startClip('plantEnd'); } }
        else { S.plantOn = true; S.plantProg = p.progress ?? 0; if (!(act.on && (act.name === 'plant' || act.name === 'disarm'))) { S.clips.__use = c; startClip(S.clips[nm] ? nm : 'plant', { loop: true }); } }
        break; }
      case 'progress': S.plantProg = p.value ?? p.progress ?? 0; break;
      default: break;
    }
  }
  let pendingRelease = -1;

  // ---------------------------------------------------------------- per-frame update
  const P = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
  const zero6 = (a) => { a[0] = a[1] = a[2] = a[3] = a[4] = a[5] = 0; };
  function sampleInto(clipObj, t, out) {
    for (const n in out) { const a = out[n]; for (let i = 0; i < a.length; i++) a[i] = 0; }
    const u = clamp(t / clipObj.dur, 0, 1);
    for (const n in clipObj.tracks) { const o = out[n]; if (o) sampleTrack(clipObj.tracks[n], u, o); }
  }
  const blendCh = (a, b, w) => { for (const n in a) { const A = a[n], B = b[n]; for (let i = 0; i < A.length; i++) A[i] = B[i] + (A[i] - B[i]) * w; } };

  function update(dt, st = {}) {
    if (!S.model) return;
    if (ctx.__vmGallery && !st.__g) return;   // gallery drives the rig itself
    dt = clamp(dt, 0, 0.05); if (dt <= 0) { dt = 1 / 240; }
    S.time += dt;
    let pr = S.prof, meta = S.meta, model = S.model, wgt = pr.weight;
    // ---- inputs
    const speed = st.speed || 0, onGround = st.onGround !== false, crouch = !!st.crouch, walking = !!st.walking;
    const sprint = st.sprinting != null ? (st.sprinting ? 1 : 0) : smooth(7.6, 9.6, speed);
    const lx = -clamp(st.lookDelta?.x || 0, -0.35, 0.35), ly = clamp(st.lookDelta?.y || 0, -0.35, 0.35);
    if (st.scoped != null && meta.scope) S.scopeIn = !!st.scoped;
    if (st.ammo !== undefined) { if (st.ammo != null) { if (S.ammoLock < 0) S.ammo = st.ammo; S.ammoMax = st.ammoMax || S.ammoMax; } else S.ammoMax = 0; }
    if (st.heat != null) S.heatOverride = st.heat;
    S.speed = speed;
    // ---- jump / land
    if (st.jumped || (S.lastGround && !onGround && S.time - S.jumpAt > 0.2 && (st.vy == null || st.vy > 1))) { if (S.time - S.jumpAt > 0.2) { jump.kick(1, 0.004, 0.09); jump.kick(3, 0, 0.5); jump.kick(2, 0, 0.05); S.jumpAt = S.time; } }
    if (!S.lastGround && onGround && S.time - S.landAt > 0.15) { const sp = clamp((st.landSpeed ?? Math.max(4, speed)) / 9, 0.25, 1.4); doLand(sp); }
    S.lastGround = onGround;
    // ---- action clips
    advanceAct(dt); plantTick();
    if (S.model !== model) { pr = S.prof; meta = S.meta; model = S.model; wgt = pr.weight; }   // a clip end / plant swap may have changed the model
    if (afterFireT >= 0) { afterFireT -= dt; if (afterFireT < 0 && !act.on) startClip(meta.afterFire.clip, { dur: meta.afterFire.dur }); else if (afterFireT < 0) afterFireT = -1; }
    if (pendingRelease >= 0) { pendingRelease -= dt; if (pendingRelease < 0 && act.on && act.name === 'throwWind') { startClip('throwRel'); ctx.events?.emit?.('viewmodel:throw', { id: S.id, power: 1 }); } }
    if (act.clip) sampleInto(act.clip, act.t, chA); else for (const n in chA) chA[n].fill(0);
    if (prev.on && prev.clip) { sampleInto(prev.clip, prev.t, chB); blendCh(chA, chB, prev.blend); }
    // ---- procedural state
    S.bobAmp = approach(S.bobAmp, (onGround ? clamp(speed / 6.4, 0, 1.15) : 0) * (crouch ? 0.55 : 1) * (walking ? 0.45 : 1) * (1 - sprint * 0.2), 9, dt);
    if (S.bobAmp > 0.01) S.bobPhase += dt * TAU * Math.max(speed, 1.5) / 3.7;
    S.sprint = approach(S.sprint, sprint * (onGround ? 1 : 0.6), 7, dt);
    S.crouch = approach(S.crouch, crouch ? 1 : 0, 10, dt);
    S.air = approach(S.air, onGround ? 0 : 1, onGround ? 9 : 6, dt);
    S.hpLow = approach(S.hpLow, st.hp != null && st.hp < 25 ? 1 : 0, 3, dt);
    const scopeTarget = S.scopeIn && !act.on ? 1 : (S.scopeIn && act.name === 'bolt' ? 0 : S.scopeIn ? 0 : 0); scopeSp.t[0] = S.scopeIn && !(act.on && (act.name === 'reload' || act.name === 'bolt' || act.name === 'draw')) ? 1 : 0; void scopeTarget;
    scopeSp.step(dt); const sc = clamp(scopeSp.x[0], 0, 1.02); S.scopeT = sc;
    // look inertia: velocity-proportional offset pulled through a spring => weapon lags the camera, overshoots slightly, settles
    S.lookVX = approach(S.lookVX, lx / dt, 24, dt); S.lookVY = approach(S.lookVY, ly / dt, 24, dt);
    const lg = 0.028 * wgt, wx = clamp(S.lookVX, -14, 14), wy = clamp(S.lookVY, -10, 10);
    look.t[4] = wx * lg; look.t[3] = -wy * lg * 0.7; look.t[5] = wx * lg * 0.55; look.t[0] = -wx * lg * 0.075; look.t[1] = wy * lg * 0.06; look.t[2] = Math.abs(wx) * 0.0009 * wgt;
    if (st.aimPunch) look.t[3] -= (st.aimPunch.x || 0) * 0.15;
    look.k = 60 + 30 / wgt; look.c = 9 + 4 / wgt;
    look.step(dt);
    kick.k = pr.kick.k; kick.c = pr.kick.c; kick.step(dt); climb.step(dt); land.step(dt); jump.step(dt);
    for (const n of partNames) { const sp = partSp[n]; if (meta.slideLock && n === meta.slideLock && S.ammo <= 0 && !act.on) sp.t[2] = 0.028; else if (n === meta.slideLock) sp.t[2] = 0; sp.step(dt); }
    // ---- heat
    if (S.heatOverride == null) S.heat = Math.max(0, S.heat - pr.cool * dt * (0.4 + S.heat));
    else S.heat = approach(S.heat, S.heatOverride, 12, dt);
    if (S.model.mats.flash > 0) S.model.mats.flash = Math.max(0, S.model.mats.flash - dt * 9);
    // ---- compose
    const bp = S.bobPhase, ba = S.bobAmp * settings.bob * (0.85 + 0.15 * pr.bob), t = S.time;
    const idle = 1 - clamp(S.bobAmp * 1.6, 0, 0.8);
    const spr = S.sprint, ap = S.air, cr = S.crouch;
    const rest = pr.rest;
    let x = rest.p[0] * 0.01 + settings.offsetX * 0.01, y = rest.p[1] * 0.01 + settings.offsetY * 0.01, z = rest.p[2] * 0.01 + settings.offsetZ * 0.01;
    let rx = rest.r[0] * DEG, ry = rest.r[1] * DEG, rz = rest.r[2] * DEG;
    // idle breathing
    const br = Math.sin(t * 1.55), br2 = Math.sin(t * 0.83 + 1.3), hp = 1 + S.hpLow * 1.4;
    y += br * 0.0017 * idle * hp; x += br2 * 0.0010 * idle; rx += br * 0.0048 * idle * hp; rz += br2 * 0.0035 * idle; ry += Math.sin(t * 0.6) * 0.003 * idle;
    // walk / run bob (figure-8), footfall at phase = k*pi
    x += Math.sin(bp) * 0.0105 * ba; y += -(0.5 + 0.5 * Math.cos(bp * 2)) * 0.0135 * ba + 0.004 * ba; z += Math.sin(bp * 2 + 0.6) * 0.0055 * ba;
    rz += Math.sin(bp) * 0.030 * ba; rx += Math.cos(bp * 2) * 0.0125 * ba; ry += Math.sin(bp + 0.5) * 0.0175 * ba;
    // sprint pose: weapon lowered/angled across
    x += spr * -0.030; y += spr * -0.042; z += spr * 0.018; rx += spr * -0.36; ry += spr * 0.62; rz += spr * 0.22;
    // crouch, air
    y += cr * -0.006; z += cr * 0.004; rx += cr * -0.02;
    y += ap * 0.006; rx += ap * 0.032; z += ap * -0.004; rz += ap * 0.02 * Math.sin(t * 2.1);
    // springs
    x += look.x[0] + kick.x[0] + jump.x[0] + land.x[0]; y += look.x[1] + kick.x[1] + climb.x[1] + jump.x[1] + land.x[1]; z += look.x[2] + kick.x[2] + jump.x[2] + land.x[2];
    rx += look.x[3] + kick.x[3] + climb.x[3] + jump.x[3] + land.x[3]; ry += look.x[4] + kick.x[4]; rz += look.x[5] + kick.x[5];
    // clip offsets
    const w = chA.w; x += w[0]; y += w[1]; z += w[2]; rx += w[3]; ry += w[4]; rz += w[5];
    // scope: bring the eyepiece to the view centre
    if (meta.scope && sc > 0.001) {
      const c = meta.scope.center, e = sc * sc * (3 - 2 * sc);
      x = lerp(x, -c[0] * 0.01, e); y = lerp(y, -c[1] * 0.01 - 0.004, e); z = lerp(z, -0.16 - c[2] * 0.01, e);
      rx = lerp(rx, 0, e * 0.9); ry = lerp(ry, 0, e * 0.9); rz = lerp(rz, 0, e);
    }
    // apply rig with pivot compensation
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _p.copy(_piv).sub(_p2.copy(_piv).applyQuaternion(_q));
    rig.quaternion.copy(_q); rig.position.set(x + _p.x, y + _p.y, z + _p.z);
    // parts
    for (const n of partNames) { const g = model.parts[n], pv = model.pivots[n], o = chA[n], sp = partSp[n];
      g.position.set(pv[0] * 0.01 + o[0] + sp.x[0], pv[1] * 0.01 + o[1] + sp.x[1], pv[2] * 0.01 + o[2] + sp.x[2]);
      g.rotation.set(o[3] + sp.x[3], o[4] + sp.x[4], o[5] + sp.x[5], 'YXZ'); }
    // hands
    const hd = meta.hands || {};
    placeHand(handR, hd.r, chA.rh, chA.rc[0]); placeHand(handL, hd.l, chA.lh, chA.lc[0]);
    // ammo gauge / glow
    const frac = S.ammoMax > 0 ? S.ammo / S.ammoMax : 1;
    const shown = S.ammoLock >= 0 ? S.ammoLock : S.ammo;
    if (shown !== S.ammoShown) { S.ammoShown = shown; if (model.gauge.n) setGauge(model, S.ammoMax > 0 ? shown / S.ammoMax : 1); }
    model.mats.update(S.heat + (meta.idleHeat || 0), S.ammoMax > 0 ? shown / S.ammoMax : 1, S.ammoMax > 0 ? 1 : 0, model.mats.flash * 0.7, S.time);
    void frac;
    // scope zoom
    S.fovMul = meta.scope ? lerp(1, meta.scope.zoom[Math.min(S.zoomLevel, meta.scope.zoom.length - 1)], smooth(0.35, 1, sc)) : 1;
    const hide = !S.visible || S.hidden || (meta.scope && sc > 0.93);
    S.fresh = false; rig.visible = !hide; handR.root.visible = !hide && !!hd.r; handL.root.visible = !hide && !!hd.l;
    // fov
    const vf = vFovOf(settings.fov || 68); if (Math.abs(viewCamera.fov - vf) > 0.01) { viewCamera.fov = vf; viewCamera.updateProjectionMatrix(); }
    // matrices, sleeves, fx
    root.updateMatrixWorld(true);
    shoulderR.getWorldPosition(_p); handR.aimSleeve(_p); shoulderL.getWorldPosition(_p); handL.aimSleeve(_p);
    if (act.on && (act.name === 'melee1' || act.name === 'melee2') && meta.trail) {
      const tp = model.anchors.tip; if (tp) { tp.getWorldPosition(_p); castRoot.worldToLocal(_p); model.anchors.tipBase.getWorldPosition(_p2); castRoot.worldToLocal(_p2); fx.trailPush(_p.x, _p.y, _p.z, _p2.x, _p2.y, _p2.z); }
    }
    fx.update(dt);
  }

  function placeHand(h, spec, o, curlD) {
    if (!spec) return;
    h.root.position.set(spec.p[0] * 0.01 + o[0], spec.p[1] * 0.01 + o[1], spec.p[2] * 0.01 + o[2]);
    h.root.rotation.set(spec.r[0] * DEG + o[3], spec.r[1] * DEG + o[4], spec.r[2] * DEG + o[5], 'YXZ');
    const c = spec.curl, d = curlD || 0; const tmp = h._c;
    tmp[0] = clamp(c[0] + d, 0, 1); tmp[1] = clamp(c[1] + d, 0, 1); tmp[2] = clamp(c[2] + d, 0, 1); tmp[3] = clamp(c[3] + d, 0, 1); tmp[4] = clamp(c[4] + d * 0.6, 0, 1);
    h.setCurl(tmp);
  }
  function doLand(sp) { land.kick(1, -0.028 * sp, -0.35 * sp); land.kick(3, -0.06 * sp, -0.5 * sp); land.kick(2, 0.012 * sp, 0.1 * sp); S.landAt = S.time; }

  // ---------------------------------------------------------------- bus hooks (no-ops when the tagger module already drives event())
  const isMe = (a) => !a || a === ctx.localActor;
  ctx.events?.on?.('jump', (e) => { if (isMe(e?.actor) && S.time - S.jumpAt > 0.2) { jump.kick(1, 0.004, 0.09); jump.kick(3, 0, 0.5); S.jumpAt = S.time; } });
  ctx.events?.on?.('land', (e) => { if (isMe(e?.actor) && S.time - S.landAt > 0.15) doLand(clamp((e?.speed ?? 6) / 9, 0.25, 1.4)); });
  ctx.events?.on?.('footstep', (e) => { if (e?.actor && e.actor === ctx.localActor && S.bobAmp > 0.15) { const d = S.bobPhase - Math.round(S.bobPhase / Math.PI) * Math.PI; S.bobPhase -= d * 0.3; } });


  // ---- beacon plant / disarm arm animation, driven by the match piece's events
  let plantPrev = null, restoreAt = -1;
  const onMe = (n, f) => ctx.events?.on?.(n, (e) => { if (isMe(e?.actor) && S.ready) f(e); });
  function plantBegin(modelId, kind) {
    if (!plantPrev) plantPrev = { id: S.id, skin: S.skin };
    restoreAt = -1; S.hidden = false; S.consumed = false;
    if (S.id !== modelId) { S.pending = null; setTaggerRaw(modelId, null, { instant: true }); }
    event(kind, { on: true, progress: 0 });
  }
  function plantStop() {
    if (!(S.plantOn || plantPrev)) return;
    event('plant', { on: false });
    if (plantPrev) restoreAt = S.time + 0.4;
  }
  onMe('beacon:arm', () => plantBegin('beacon', 'plant'));
  onMe('beacon:disarm', (e) => plantBegin(e.kit ? 'kit' : 'beacon', 'disarm'));
  for (const n of ['beacon:armed', 'beacon:armCancel', 'beacon:disarmed', 'beacon:disarmCancel']) onMe(n, plantStop);
  function plantTick() {
    if (restoreAt >= 0 && S.time >= restoreAt) {
      restoreAt = -1; const pr = plantPrev; plantPrev = null;
      if (pr && (S.id === 'beacon' || S.id === 'kit') && pr.id && pr.id !== S.id) setTaggerRaw(pr.id, pr.skin, { instant: true });
    }
    if (S.plantOn) { const pg = ctx.match?.beacon?.progress; if (pg != null) S.plantProg = pg; }
  }

  function setTaggerRaw(id, skin = null, opts = {}) {
    if (!DEFS[id]) id = 'pip'; skin = skinOf(skin);
    if (S.id === id && !S.pending) {
      if (JSON.stringify(skin) !== JSON.stringify(S.skin)) { S.model.mats.apply(skin); S.skin = skin; fx.setCellColor(S.model.mats.glowColor); }
      if (S.hidden && !opts.keep) { S.hidden = false; S.consumed = false; S.model.root.visible = true; startClip('draw', { dur: opts.time ?? S.prof.draw }); }
      return;
    }
    if (S.model && !S.hidden && !opts.instant && S.visible && S.ready) { S.pending = { id, skin, time: opts.time }; if (!(act.on && act.name === 'holster')) startClip('holster'); return; }
    S.pending = null; S.hidden = false; setModel(id, skin); S.ready = true; startClip('draw', { dur: opts.time ?? S.prof.draw });
  }

  // ---------------------------------------------------------------- public API
  const api = {
    __viewmodel: true,
    /** Equip a tagger model. skin = CosmeticSpec.taggerSkin (or a whole spec). opts.instant skips the holster of the previous model. */
    setTagger(id, skin = null, opts = {}) { if (ctx.__vmGallery && !opts.__g) return; return setTaggerRaw(id, skin, opts); },
    event(name, p) { if (ctx.__vmGallery) return; return event(name, p); },
    update,
    setVisible(b) { S.visible = !!b; rig.visible = S.visible && !S.hidden && !S.fresh; fx.clear(); },
    worldModel: (id, skin) => getWorldModel(id, skinOf(skin)),
    get muzzle() { return muzzleObj; },
    /** World-space point for tracers/casings: projects the on-screen muzzle through the world camera at `depth` metres. */
    muzzleWorld(out = new THREE.Vector3(), depth = 0.6) {
      const cam = R.camera; muzzleObj.updateWorldMatrix(true, false); muzzleObj.getWorldPosition(_p);
      viewCamera.updateMatrixWorld(); viewCamera.matrixWorldInverse.copy(viewCamera.matrixWorld).invert(); _p.project(viewCamera);
      cam.updateMatrixWorld(); _p2.set(_p.x, _p.y, 0.5).unproject(cam); cam.getWorldPosition(_v3);
      _p2.sub(_v3).normalize(); return out.copy(_v3).addScaledVector(_p2, depth);
    },
    /** Multiply the world camera FOV by this (1 = no zoom). Smoothly follows scope-in/out. */
    /** HUD asks: 'does the viewmodel draw its own scope overlay?' -> true while the weapon is still raising so the HUD reticle waits for the lens to hide. */
    get drawsScopeOverlay() { return !(S.scopeIn && S.scopeT > 0.9); },
    get fovMul() { return S.fovMul; }, get scopeT() { return S.scopeT; }, get scoped() { return S.scopeT > 0.93; },
    get zoomLevels() { return S.meta?.scope?.zoom.length || 0; },
    get current() { return S.id; }, get busy() { return act.on; }, get action() { return act.on ? act.name : (S.hidden ? 'hidden' : 'idle'); },
    get heat() { return S.heat; },
    get ids() { return IDS; },
    debug: {
      state: () => ({ id: S.id, action: act.on ? act.name : 'idle', t: act.on ? act.t / act.clip.dur : 0, heat: S.heat, ammo: S.ammo, ammoMax: S.ammoMax, scopeT: S.scopeT, fovMul: S.fovMul, shots: S.shots, bob: S.bobAmp, sprint: S.sprint }),
      play: (name, o) => startClip(name, o), stop: () => endClip(), event, update: (dt, st) => update(dt, st), setTagger: (id, sk, o) => setTaggerRaw(id, sk, { ...o, __g: true }),
      clips: () => Object.keys(S.clips || {}), events: ['fire', 'reloadStart', 'reloadEnd', 'draw', 'holster', 'inspect', 'scopeIn', 'scopeOut', 'throw', 'melee', 'empty', 'heat', 'ammo', 'plant', 'disarm'],
      model: () => S.model, hands: () => ({ r: handR, l: handL }), rig, root, fx, S, chA,
      setAmmo(m, M) { S.ammo = m; if (M) S.ammoMax = M; S.ammoShown = -1; S.ammoLock = -1; },
      setHeat(v) { S.heatOverride = v; }, seed: seedFx,
      reset() { S.heat = 0; S.heatOverride = null; kick.reset(); climb.reset(); look.reset(); land.reset(); jump.reset(); endClip(); fx.clear(); S.scopeIn = false; scopeSp.reset(); S.consumed = false; S.hidden = false; if (S.model) { S.model.root.visible = true; resetParts(); } S.ammoLock = -1; S.ammo = S.ammoMax; S.shots = 0; for (const n of partNames) partSp[n].reset(); },
    },
  };
  ctx.__viewmodel = api;
  ctx.debugScenes = ctx.debugScenes || {};
  ctx.debugScenes['viewmodel-gallery'] = async (c) => { const g = await import('./gallery.js'); return g.run(c, api); };
  return api;
}
