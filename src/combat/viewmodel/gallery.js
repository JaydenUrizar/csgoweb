// ?scene=viewmodel-gallery — every tagger, every animation, on a neutral backdrop, through the real render pipeline.
// URL params: tagger=<id> · anim=<name> · bg=mid|light|dark|sand · mode=fp|world · auto=1 (cycle) · skin=0..5 · team=ember|tide
// Debug handle: window.__vmGallery  { list, show(id, skin), play(anim, opts), state, set(obj), paused, look(dx,dy) }
import * as THREE from 'three';
import { IDS, DEFS } from './models.js';

const BG = { mid: 0x8b96a4, light: 0xdfe6ee, dark: 0x1c2027, sand: 0xc9b48c };
export const SKINS = [
  null,
  { pattern: 'stripes', primary: 0x2a2f45, accent: 0xff5ac8, glow: 0xff5ac8, wear: 0.1 },
  { pattern: 'hex', primary: 0xd8dfe8, accent: 0x5a6b8c, glow: 0x2fd0ff, wear: 0 },
  { pattern: 'camo', primary: 0x50603c, accent: 0x2d3826, glow: 0xb6ff3a, wear: 0.5 },
  { pattern: 'circuit', primary: 0x14181f, accent: 0x39f0a0, glow: 0x39f0a0, wear: 0 },
  { pattern: 'chevron', primary: 0xf2b21c, accent: 0x1a1a1a, glow: 0xffffff, wear: 0.25 },
];
export const ANIMS = ['idle', 'draw', 'fire', 'burst', 'reload', 'inspect', 'empty', 'melee', 'throw', 'plant', 'scope', 'walk', 'run', 'sprint', 'jump', 'look', 'holster'];

export async function run(ctx, vm) {
  const P = new URLSearchParams(location.search), R = ctx.render;
  if (ctx.__vmGallery) return ctx.__vmGallery;
  // neutral backdrop
  try { if (ctx.map?.group) ctx.map.group.visible = false; if (R.sky) R.sky.visible = false; R.skyModule?.clouds && (R.skyModule.clouds.visible = false); } catch (e) { /* ignore */ }
  const bgKey = P.get('bg') || 'mid';
  R.scene.background = new THREE.Color(BG[bgKey] ?? BG.mid); if (R.scene.fog) R.scene.fog = null;
  for (const el of document.body.children) if (el.id !== 'app' && el.tagName !== 'SCRIPT') el.style.display = 'none';
  const tag = document.createElement('div');
  tag.style.cssText = 'position:fixed;left:14px;top:12px;font:600 15px/1.3 system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000;pointer-events:none;z-index:50;white-space:pre';
  document.body.appendChild(tag);
  const gs = { speed: 0, onGround: true, crouch: false, walking: false, lookDelta: { x: 0, y: 0 }, scoped: false, hp: 100, sprinting: undefined, ammo: undefined, ammoMax: undefined, heat: undefined, aimPunch: null };
  const G = { vm, id: 'pip', skin: null, skinIdx: 0, paused: false, tasks: [], t: 0, state: gs, mode: P.get('mode') || 'fp', label: '', lookSweep: null, world: null, auto: !!P.get('auto') };
  if (P.get('team')) { try { ctx.localActor.team = P.get('team'); } catch (e) { /* ignore */ } }
  // schedule helper: run fn after `after` seconds of gallery time
  const at = (after, fn) => G.tasks.push({ t: G.t + after, fn });

  function show(id, skinIdx = G.skinIdx) {
    G.id = id; G.skinIdx = skinIdx; G.skin = SKINS[skinIdx % SKINS.length];
    G.tasks.length = 0; vm.debug.reset?.();
    vm.debug.setTagger(id, G.skin, { instant: true });
    if (G.mode === 'world') showWorld(id); else hideWorld();
    setLabel();
  }
  function setLabel(extra = '') { G.label = `${G.id.toUpperCase()}  ·  skin ${G.skinIdx}  ·  ${extra}`; tag.textContent = G.label; }
  function showWorld(id) {
    hideWorld(); vm.setVisible(false);
    const m = vm.worldModel(id, G.skin); G.world = new THREE.Group(); G.world.add(m); R.scene.add(G.world);
    const l = new THREE.DirectionalLight(0xffffff, 2.2); l.position.set(2, 3, 2); G.world.add(l); G.world.add(new THREE.HemisphereLight(0xdde8ff, 0x665544, 1.0));
    G.worldModel = m;
  }
  function hideWorld() { if (G.world) { R.scene.remove(G.world); G.world = null; } vm.setVisible(true); }

  function play(anim, o = {}) {
    const st = gs; gs.speed = 0; gs.sprinting = undefined; gs.scoped = false; gs.crouch = false; gs.walking = false; gs.onGround = true;
    G.lookSweep = null;
    const cls = vm.debug.model()?.meta?.cls, id = G.id;
    switch (anim) {
      case 'idle': break;
      case 'draw': vm.debug.event('draw'); break;
      case 'holster': vm.debug.event('holster'); break;
      case 'fire': case 'burst': { const n = o.n ?? (anim === 'burst' ? 6 : 1), rate = o.rate ?? (cls === 'sniper' ? 0.6 : 0.09); for (let i = 0; i < n; i++) at(i * rate, () => vm.debug.event('fire', { mag: Math.max(0, (vm.debug.S.ammo || 30) - 1) })); break; }
      case 'reload': vm.debug.setAmmo(Math.max(1, Math.round((vm.debug.S.ammoMax || 30) * 0.12)), vm.debug.S.ammoMax); vm.debug.event('reloadStart'); break;
      case 'inspect': vm.debug.event('inspect'); break;
      case 'empty': vm.debug.setAmmo(0); vm.debug.event('empty'); break;
      case 'melee': vm.debug.event('melee'); at(0.7, () => vm.debug.event('melee')); break;
      case 'throw': vm.debug.event('throw', { stage: 'windup' }); at(0.75, () => vm.debug.event('throw', { stage: 'release', power: 1 })); at(2.2, () => { vm.debug.event('draw'); }); break;
      case 'plant': vm.debug.event('plant', { on: true, progress: 0 }); { const T = 2.4; for (let i = 1; i <= 8; i++) at(i * T / 8, () => vm.debug.event('progress', { value: i / 8 })); at(T + 0.2, () => vm.debug.event('plant', { on: false })); } break;
      case 'scope': vm.debug.event('scopeIn'); at(1.6, () => vm.debug.event('scopeOut')); break;
      case 'walk': gs.speed = 3.2; gs.walking = true; break;
      case 'run': gs.speed = 6.4; break;
      case 'sprint': gs.speed = 9.5; gs.sprinting = true; break;
      case 'jump': at(0.1, () => { gs.onGround = false; gs.vy = 4; }); at(0.65, () => { gs.onGround = true; gs.landSpeed = 6; }); break;
      case 'look': G.lookSweep = { t0: G.t, amp: 0.05, f: 1.4 }; break;
      default: break;
    }
    setLabel(anim);
  }
  G.show = show; G.play = play; G.at = at; G.list = IDS; G.anims = ANIMS;
  G.set = (o) => Object.assign(gs, o);
  G.look = (dx, dy) => { gs.lookDelta.x = dx; gs.lookDelta.y = dy; };
  G.setMode = (m) => { G.mode = m; show(G.id); };
  G.setBg = (k) => { R.scene.background = new THREE.Color(BG[k] ?? BG.mid); };
  G.cycle = 0;

  // orbit: inspect the rig from any angle (yaw/pitch deg, distance m). null = true first-person view.
  const _eo = new THREE.Euler(), _qo = new THREE.Quaternion(), _vo = new THREE.Vector3();
  function applyOrbit() {
    const root = vm.debug.root, o = G.orbitCfg;
    if (!o) { root.position.set(0, 0, 0); root.quaternion.identity(); return; }
    const rp = vm.debug.S.prof.rest.p; _vo.set(rp[0] * 0.01, rp[1] * 0.01, rp[2] * 0.01);
    _eo.set(o.pitch * Math.PI / 180, o.yaw * Math.PI / 180, 0, 'YXZ'); _qo.setFromEuler(_eo); root.quaternion.copy(_qo);
    _vo.applyQuaternion(_qo).negate(); root.position.set(_vo.x + (o.x ?? 0), _vo.y + (o.y ?? 0), _vo.z - o.dist);
  }
  G.orbit = (yaw, pitch = 0, dist = 0.6, x = 0, y = 0) => { G.orbitCfg = yaw == null ? null : { yaw, pitch, dist, x, y }; };
  // driver
  const sys = {
    update(dt) {
      if (G.paused) return;
      G.t += dt;
      for (let i = 0; i < G.tasks.length; i++) if (G.tasks[i].t <= G.t) { const f = G.tasks[i].fn; G.tasks.splice(i, 1); i--; f(); }
      if (G.lookSweep) { const s = G.lookSweep, ph = (G.t - s.t0) * s.f * Math.PI * 2; gs.lookDelta.x = Math.cos(ph) * s.amp * dt * 8 * (Math.PI * 2 * s.f) * 0.125; gs.lookDelta.y = Math.sin(ph * 0.5) * 0.004; }
      applyOrbit();
      gs.__g = true; vm.debug.update(dt, gs); gs.lookDelta.x = gs.lookDelta.y = 0; gs.jumped = false;
      if (G.world) { G.world.rotation.y += dt * 0.7; }
    },
  };
  ctx.engine.add(sys, 9);
  if (G.mode === 'world') {   // world-model turntable framing
    R.camera.position.set(0, 0.25, 1.4); R.camera.rotation.set(-0.1, 0, 0);
  }
  ctx.__vmGallery = G; window.__vmGallery = G;
  if (P.get('orbit')) { const [a, b2, d] = P.get('orbit').split(',').map(Number); G.orbit(a, b2 || 0, d || 0.6); }
  const id0 = P.get('tagger') || 'pip'; show(id0, +(P.get('skin') || 0));
  const an = P.get('anim'); if (an) at(0.2, () => play(an));
  if (G.auto) { // auto playlist
    const order = P.get('list') ? P.get('list').split(',') : IDS;
    let i = Math.max(0, order.indexOf(id0)); const seq = ['draw', 'fire', 'burst', 'reload', 'inspect'];
    const step = () => { const id = order[i % order.length]; i++; show(id); let d = 0.9; const cls = vm.debug.model()?.meta?.cls;
      const list = cls === 'melee' ? ['melee', 'inspect'] : cls === 'grenade' ? ['throw', 'inspect'] : cls === 'gear' ? ['plant', 'inspect'] : cls === 'sniper' || id === 'halo' ? [...seq, 'scope'] : seq;
      for (const a of list) { at(d, () => play(a)); d += a === 'reload' ? 3.6 : a === 'inspect' ? 4.4 : a === 'scope' ? 2.4 : a === 'throw' ? 3 : a === 'plant' ? 3 : 1.6; }
      at(d, step); };
    step();
  }
  return G;
}
