import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createActor } from '../../core/actor.js';
import { TYPES } from './config.js';

// ?scene=utility-lab : self-contained test arena (own collision BVH, independent of the map module) with stand-in actors.
//   Yard (open sky, crates, stairs, ramp) -> long covered corridor -> side branch (L corner) -> big room with pillars & platform.
//   Left click: strong throw, right click: short, both: medium (throws on release, like CS). Z / 1-3: cycle Haze/Strobe/Pulse. Hold to preview the arc.
//   Scripted access: ctx.utilityLab (view/lookAt/throw/ceilings/reset, named vantage points) — see docs/pieces/utility.md.
export function registerLab(ctx, util) {
  ctx.debugScenes ||= {};
  ctx.debugScenes['utility-lab'] = async () => buildLab(ctx, util);
}

function gridTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#b9b2a2'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#c4bdad' : '#aea797'; g.fillRect(i * 64, j * 64, 64, 64); }
  g.strokeStyle = 'rgba(40,40,40,0.5)'; g.lineWidth = 3; g.strokeRect(1, 1, 254, 254); g.strokeStyle = 'rgba(40,40,40,0.18)'; g.lineWidth = 1; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function figure(color, name) {
  const g = new THREE.Group(); g.name = name;
  const suit = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6 }), dark = new THREE.MeshStandardMaterial({ color: 0x23272e, flatShading: true, roughness: 0.7 });
  const vis = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), toneMapped: false });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.24), dark); legs.position.y = 0.425;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), suit); torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), dark); head.position.y = 1.62;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.05), vis); visor.position.set(0, 1.63, -0.14);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), suit); const a2 = arm.clone(); arm.position.set(0.31, 1.15, 0); a2.position.set(-0.31, 1.15, 0);
  g.add(legs, torso, head, visor, arm, a2); g.traverse((o) => { o.castShadow = true; o.receiveShadow = true; }); return g;
}

async function buildLab(ctx, util) {
  const R = ctx.render, scene = R?.scene; if (!scene) throw new Error('utility-lab needs ctx.render.scene');
  if (ctx.map?.group) ctx.map.group.visible = false;
  const group = new THREE.Group(); group.name = 'utility-lab'; scene.add(group);
  // Isolate the lab from match flow / bots / HUD (deterministic, and immune to other pieces' work-in-progress). ?isolate=0 keeps them.
  const detached = [];
  if (ctx.params.get('isolate') !== '0') {
    for (const k of ['hud', 'menu', 'ai', 'match', 'player']) { const m = ctx[k]; if (m) { ctx.engine.remove(m); detached.push(m); } }
    const ui = document.getElementById('ui'); if (ui) { ui.dataset.utilHidden = ui.style.display || ''; ui.style.display = 'none'; }
  }
  const solids = [], visuals = [], ceilings = [];
  const wall = new THREE.MeshStandardMaterial({ color: 0xd5cdbb, flatShading: true, roughness: 0.92 });
  const prop = new THREE.MeshStandardMaterial({ color: 0x8b8f7a, flatShading: true, roughness: 0.8 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xb98d5b, flatShading: true, roughness: 0.85 });
  const ceilM = new THREE.MeshStandardMaterial({ color: 0x9aa1ab, flatShading: true, roughness: 0.95 });
  const gridTex = gridTexture();
  const box = (x0, y0, z0, x1, y1, z1, mat = wall, opts = {}) => {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0; const g = new THREE.BoxGeometry(w, h, d); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; group.add(m); if (opts.ceiling) ceilings.push(m);
    const c = g.clone().toNonIndexed(); for (const k of Object.keys(c.attributes)) if (k !== 'position') c.deleteAttribute(k); solids.push(c); return m;
  };
  // ---- floor (visual uses world-space UVs so the 1 m grid is exact)
  { const FX0 = -40, FX1 = 40, FZ0 = -60, FZ1 = 44; const g = new THREE.PlaneGeometry(FX1 - FX0, FZ1 - FZ0); g.rotateX(-Math.PI / 2); g.translate((FX0 + FX1) / 2, 0, (FZ0 + FZ1) / 2);
    const uv = g.attributes.uv, pos = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 4, pos.getZ(i) / 4);
    const t = gridTex.clone(); t.needsUpdate = true; const fm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.95 })); fm.receiveShadow = true; group.add(fm);
    box(FX0, -1, FZ0, FX1, 0, FZ1, wall).visible = false; }
  const H = 4.2, T = 0.3;
  // ---- yard z 6..30, x -16..16
  box(-16 - T, 0, 6, -16, 5.5, 30 + T); box(16, 0, 6, 16 + T, 5.5, 30 + T); box(-16 - T, 0, 30, 16 + T, 5.5, 30 + T);
  box(-16, 0, 6 - T, -2 - T, 5.5, 6); box(2 + T, 0, 6 - T, 16, 5.5, 6);          // north wall with corridor mouth
  box(-9, 0, 12, -3, 0.95, 12.4, trim); box(-7.5, 0, 16, -5.5, 1.3, 18.2, prop); box(4, 0, 18, 7, 2.4, 21, prop); box(8, 0, 10, 11, 1.1, 12, prop);
  for (let i = 0; i < 6; i++) box(10, 0, 22 + i * 0.4, 13.2 - i * 0.0, 0.2 * (i + 1), 22.4 + i * 0.4, trim);   // stairs going up toward +z
  box(10, 0, 24.4, 16, 1.2, 28, trim);                                                                     // stair landing
  { const rg = new THREE.BufferGeometry(); const v = new Float32Array([-14, 0, 14, -10, 0, 14, -14, 0, 20, -10, 0, 20, -14, 1.4, 20, -10, 1.4, 20]); // ramp wedge
    const tri = [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5, 0, 4, 2, 1, 3, 5, 0, 1, 5, 0, 5, 4]; rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri.length * 3), 3)); const p = rg.attributes.position; tri.forEach((k, i) => p.setXYZ(i, v[k * 3], v[k * 3 + 1], v[k * 3 + 2])); rg.computeVertexNormals();
    const m = new THREE.Mesh(rg, trim); m.material = trim.clone(); m.material.side = THREE.DoubleSide; group.add(m); const rc = rg.clone(); rc.deleteAttribute('normal'); solids.push(rc); }
  // ---- main corridor C1: x -2..2, z 6 .. -24
  box(-2 - T, 0, -24, -2, H, -14.4); box(-2 - T, 0, -9.6, -2, H, 6); box(-2 - T, 2.7, -14.4, -2, H, -9.6); box(2, 0, -24, 2 + T, H, 6);
  ceilings.push(box(-2 - T, H, -24, 2 + T, H + 0.3, -3, ceilM));
  box(-2, 0, -14, -0.6, 2.2, -13.8, prop);                                   // thin half-wall / door frame in the corridor
  box(0.9, 0, -19, 2, 1.0, -18, prop);                                       // crate
  // ---- side branch C2 (west of the corridor, z -14.4..-9.6) is built below; opening in the corridor west wall above
  // ---- big room: x -10..10, z -44..-24
  box(-10 - T, 0, -44 - T, -10, 7.5, -24); box(10, 0, -44 - T, 10 + T, 7.5, -24); box(-10 - T, 0, -44 - T, 10 + T, 7.5, -44);
  box(-10, 0, -24, -2 - T, 7.5, -24 + T); box(2 + T, 0, -24, 10, 7.5, -24 + T);
  ceilings.push(box(-10 - T, 7.5, -44 - T, 10 + T, 7.8, -24 + T, ceilM));
  box(-5, 0, -32, -4, 7.5, -31, prop); box(4, 0, -32, 5, 7.5, -31, prop); box(-5, 0, -39, -4, 7.5, -38, prop); box(4, 0, -39, 5, 7.5, -38, prop);
  box(-3, 0, -44, 3, 1.4, -40, trim); for (let i = 0; i < 4; i++) box(-3, 0, -40, 3, 0.35 * (i + 1), -40 + 0.5 * (4 - i) - 0.5 * 0 - 0.0, trim);
  const branchZ0 = -14.4, branchZ1 = -9.6;
  box(-18 - T, 0, branchZ0 - T, -2 - T, H, branchZ0); box(-18 - T, 0, branchZ1, -2 - T, H, branchZ1 + T); box(-18 - T, 0, branchZ0 - T, -18, H, branchZ1 + T);
  ceilings.push(box(-18 - T, H, branchZ0 - T, -2 - T, H + 0.3, branchZ1 + T, ceilM));

  // ---- merge collision, BVH
  const geo = mergeGeometries(solids, false); geo.boundsTree = new MeshBVH(geo); const collider = new THREE.Mesh(geo); collider.visible = false; collider.name = 'utility-lab-collider';
  util.setWorld(collider);
  // ---- lighting (only if the scene has no sun of its own)
  const own = [];
  const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x7a6e5c, 0.9); scene.add(hemi); own.push(hemi);
  if (!R.sun) { const sun = new THREE.DirectionalLight(0xfff0d8, 2.6); sun.position.set(18, 30, 12); sun.castShadow = true; scene.add(sun); own.push(sun); }
  const bg0 = scene.background; scene.background = new THREE.Color(0x9cc0e4);
  // ---- stand-in actors
  const mkActor = (name, team, x, z, yawDeg) => { const a = createActor({ name, team }); a.pos.set(x, 0, z); a.yaw = THREE.MathUtils.degToRad(yawDeg); a.hp = 100; if (!ctx.characters || ctx.characters.__stub) { const f = figure(team === 'ember' ? 0xff7a2f : 0x2fd0ff, 'lab-actor-' + name); a.labFig = f; f.position.copy(a.pos); f.rotation.y = a.yaw; group.add(f); } else ctx.characters.spawn?.(a, { auto: true, materialise: false }); return a; };
  const actors = { A: mkActor('A', 'tide', 0, -17.5, 0), B: mkActor('B', 'ember', 9, 24, 200), C: mkActor('C', 'tide', -3.5, -26.5, 0), D: mkActor('D', 'tide', 0, -12.5, 0) };
  const added = []; for (const a of Object.values(actors)) { ctx.actors.push(a); added.push(a); }
  // ---- local actor
  let me = ctx.localActor; let ownMe = ctx.params.get('isolate') !== '0';
  if (!me) { me = createActor({ name: 'You', team: 'ember', isPlayer: true }); ctx.actors.push(me); ctx.localActor = me; ownMe = true; }
  me.pos.y = 0;
  if (ctx.params.get('vm') !== '1') ctx.combat?.viewmodel?.setVisible?.(false);
  me.pos.set(0, 0, 14); me.yaw = 0; me.pitch = 0; me.alive = true; util.infinite = true;
  // ---- API
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const lab = {
    group, collider, actors, me,
    /** put the local view at eye position (x,y,z) looking yaw/pitch (radians) */
    view(x, y, z, yaw = 0, pitch = 0) { me.pos.set(x, y - me.eyeHeight, z); me.yaw = yaw; me.pitch = pitch; me.vel.set(0, 0, 0); const c = R.camera; c.position.set(x, y, z); c.rotation.set(pitch, yaw, 0, 'YXZ'); c.updateMatrixWorld(true); },
    lookAt(from, to) { const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z; const yaw = Math.atan2(-dx, -dz), pitch = Math.asin(dy / Math.hypot(dx, dy, dz)); lab.view(from.x, from.y, from.z, yaw, pitch); },
    ceilings(on) { for (const c of ceilings) c.visible = on; },
    reset() { util.clear(); for (const a of Object.values(actors)) { a.alive = true; a.hp = 100; a.armor = 0; a.blind = null; a.vel.set(0, 0, 0); } me.blind = null; me.hp = 100; },
    place(name, x, z) { const a = actors[name]; a.pos.set(x, 0, z); },
    /** Named vantage points: {eye, target} */
    points: {
      yardLookCorridor: { eye: V(0, 1.62, 16), target: V(0, 1.6, -20) },
      yardOverview: { eye: V(-11, 6.5, 27), target: V(0, 1.2, 12) },
      corridorInside: { eye: V(0, 1.62, 2.5), target: V(0, 1.4, -22) },
      corridorFar: { eye: V(0, 1.62, -21.5), target: V(0, 1.5, 4) },
      roomWide: { eye: V(0, 1.62, -26), target: V(0, 3, -42) },
      side45: { eye: V(-9, 2.2, 22), target: V(0, 1.6, 12) },
    },
  };
  // ---- local play: click = strong, right = short, both = medium (throw on release), Z/1-3 cycle
  let type = 'haze'; let held = { l: false, r: false, both: false }; const order = ['haze', 'strobe', 'pulse'];
  const ui = document.body; let hud = null;
  if (ctx.params.get('labui') !== '0') { hud = document.createElement('div'); hud.style.cssText = 'position:fixed;left:12px;bottom:12px;font:12px/1.4 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.5);padding:8px 10px;border-radius:6px;pointer-events:none;white-space:pre'; ui.appendChild(hud); }
  const sys = {
    update() {
      const inp = ctx.input; if (!inp) return;
      for (let i = 0; i < 3; i++) if (inp.pressed('slot' + (i + 1))) type = order[i];
      if (inp.pressed('utilitySwap')) type = order[(order.indexOf(type) + 1) % 3];
      const l = inp.down('fire'), r = inp.down('aim');
      if (l) held.l = true; if (r) held.r = true; if (l && r) held.both = true;
      if (l || r) util.preview.show(me, type, held.both ? 'medium' : held.l ? 'strong' : 'weak');
      else if (held.l || held.r) { util.preview.hide(); util.throw(me, type, held.both ? 'medium' : held.l ? 'strong' : 'weak'); held = { l: false, r: false, both: false }; }
      if (hud) hud.textContent = `UTILITY LAB   [${TYPES[type].name.toUpperCase()}]  Z / 1-3 cycle\nLMB strong · RMB short · both medium (release throws)\nsmokes ${util.smokes.length}   blind ${util.blindAmount(me).toFixed(2)}`;
      if (ownMe) {
        const md = inp.consumeMouse(), sens = 0.0022 * (ctx.settings?.get?.('sensitivity') ?? 1); me.yaw -= md.dx * sens; me.pitch = Math.max(-1.5, Math.min(1.5, me.pitch - md.dy * sens));
        const dt = 1 / 60, sp = (inp.down('walk') ? 3 : 6.5) * dt, fw = (inp.down('forward') ? 1 : 0) - (inp.down('back') ? 1 : 0), st = (inp.down('right') ? 1 : 0) - (inp.down('left') ? 1 : 0);
        me.pos.x += (-Math.sin(me.yaw) * fw + Math.cos(me.yaw) * st) * sp; me.pos.z += (-Math.cos(me.yaw) * fw - Math.sin(me.yaw) * st) * sp; if (inp.down('jump')) me.pos.y += sp; if (inp.down('crouch')) me.pos.y = Math.max(0, me.pos.y - sp);
        me.vel.set(0, 0, 0);
        const c = R.camera; me.eyePos(c.position); c.rotation.set(me.pitch, me.yaw, 0, 'YXZ'); }
    },
  };
  ctx.engine.add(sys, 8);
  lab.type = (t) => { if (t) type = t; return type; };
  ctx.utilityLab = lab;
  // keep stand-in models on their actors + knock-back follow
  const follow = { update() { for (const a of Object.values(actors)) { const f = a.labFig; if (!f) continue; f.visible = a.alive; f.position.copy(a.pos); f.rotation.y = a.yaw; } } };
  ctx.engine.add(follow, 9);
  lab.view(0, 1.62, 16, 0, -0.02);
  lab.dispose = () => { group.parent?.remove(group); for (const o of own) scene.remove(o); scene.background = bg0; ctx.engine.remove(sys); ctx.engine.remove(follow); if (ctx.map?.group) ctx.map.group.visible = true; util.setWorld(null); util.infinite = false; hud?.remove(); for (const m of detached) ctx.engine.add(m, 20); const u2 = document.getElementById('ui'); if (u2 && 'utilHidden' in u2.dataset) u2.style.display = u2.dataset.utilHidden; for (const a of added) { const i = ctx.actors.indexOf(a); if (i >= 0) ctx.actors.splice(i, 1); } };
}
