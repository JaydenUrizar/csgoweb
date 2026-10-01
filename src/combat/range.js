// ?scene=range — the tagger proving ground. Flat range with static / strafing / crouched / armoured target dummies, distance
// markers, penetration lanes (wood / glass / stone) and a degree-grid spray wall. Works without the real map or characters:
// it installs its own collider + raycast on ctx.map while active and hides the map group.
//
//   ?test=1&scene=range[&tagger=arc][&bay=main|pen|wall][&overlay=0]
//   keys: [ / ] cycle tagger · T cycle bay (main lane / penetration lanes / spray wall) · Y reset dummies + refill + clear holes · U toggle dummy armour
//   ctx.combat.debug.range = { bay(name), setTagger(id), reset(), stats(), targets, impacts }
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createActor } from '../core/actor.js';
import { TAGGERS } from './taggers.js';

const ORDER = ['tap', 'pip', 'twin', 'judge', 'zip', 'hum', 'arc', 'rail', 'halo', 'lance', 'scatter', 'storm'];
const BAYS = { main: { x: 0, z: 10, yaw: 0 }, pen: { x: 30, z: 10, yaw: 0 }, wall: { x: 60, z: 10, yaw: 0 } };

export function registerRange(ctx, core) {
  const run = () => range(ctx, core);
  ctx.debugScenes.range = run; ctx.debugScenes['tagger-range'] = run;
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

async function range(ctx, core) {
  const R = ctx.render, scene = R.scene, L = ctx.localActor;
  const P = ctx.params;
  const group = new THREE.Group(); group.name = 'tagger-range'; scene.add(group);
  if (ctx.map?.group) ctx.map.group.visible = false;

  // ------------------------------------------------------------------------------------------------ geometry
  const solids = [], thin = [], surfaces = [];
  const mats = new Map();
  const mat = (color, o = {}) => { const k = color + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.02, ...o })); return mats.get(k); };
  function box(cx, y0, cz, w, h, d, o = {}) {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(cx, y0 + h / 2, cz);
    const m = new THREE.Mesh(g, o.material || mat(o.color ?? 0xb8a27c, o.mo)); m.castShadow = !o.noShadow; m.receiveShadow = true; group.add(m);
    const b = { min: new THREE.Vector3(cx - w / 2, y0, cz - d / 2), max: new THREE.Vector3(cx + w / 2, y0 + h, cz + d / 2), surface: o.surface || 'stone' };
    surfaces.push(b);
    if (o.thin) { b.thin = true; thin.push(b); } else { const c = g.clone().toNonIndexed(); for (const k of Object.keys(c.attributes)) if (k !== 'position') c.deleteAttribute(k); solids.push(c); }
    return m;
  }
  const gridTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#c9b48d'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(70,55,30,.35)'; c.lineWidth = 2; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4); c.stroke(); } c.strokeStyle = 'rgba(60,45,25,.6)'; c.lineWidth = 4; c.strokeRect(0, 0, w, h); }, [130, 60]);
  box(15, -1, -25, 130, 1, 120, { material: new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.95 }), noShadow: true });    // floor, 1 m tiles
  box(15, 0, -51, 130, 14, 2, { color: 0x9a8d78 });                                                                                      // backstop
  box(-49, 0, -25, 2, 8, 120, { color: 0x9a8d78 }); box(79, 0, -25, 2, 8, 120, { color: 0x9a8d78 }); box(15, 0, 36, 130, 8, 2, { color: 0x9a8d78 });

  // ---- spray wall (bay wall): exact degree grid at 20 m from the player position of that bay
  const WD = 20, WX = 17, WH = 15.6, wallX = BAYS.wall.x, wallZ = BAYS.wall.z - WD, eyeY = 1.62;
  const wallTex = canvasTex(2048, 1024, (c, w, h) => {
    c.fillStyle = '#1b2129'; c.fillRect(0, 0, w, h);
    const u = (x) => (x + WX) / (2 * WX) * w, v = (y) => h - (y / WH) * h;
    c.font = '20px monospace'; c.textBaseline = 'top';
    for (let dg = -40; dg <= 40; dg++) {
      const x = WD * Math.tan(dg * Math.PI / 180); if (Math.abs(x) > WX) continue; const major = dg % 5 === 0;
      c.strokeStyle = major ? 'rgba(160,190,230,.55)' : 'rgba(120,140,170,.18)'; c.lineWidth = major ? 2 : 1; c.beginPath(); c.moveTo(u(x), 0); c.lineTo(u(x), h); c.stroke();
      if (major) { c.fillStyle = '#9fc4ff'; c.fillText(`${dg}°`, u(x) + 4, v(0.6)); }
    }
    for (let dg = -5; dg <= 40; dg++) {
      const y = eyeY + WD * Math.tan(dg * Math.PI / 180); if (y < 0 || y > WH) continue; const major = dg % 5 === 0;
      c.strokeStyle = major ? 'rgba(160,190,230,.55)' : 'rgba(120,140,170,.18)'; c.lineWidth = major ? 2 : 1; c.beginPath(); c.moveTo(0, v(y)); c.lineTo(w, v(y)); c.stroke();
      if (major) { c.fillStyle = '#9fc4ff'; c.fillText(`${dg}°`, u(-WX) + 6, v(y) - 22); c.fillText(`${dg}°`, u(WX) - 60, v(y) - 22); }
    }
    c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.beginPath(); c.arc(u(0), v(eyeY), 0.49 / (2 * WX) * w * 0.5 + 6, 0, 7); c.stroke();   // ~ head at 20 m
    c.beginPath(); c.moveTo(u(0) - 30, v(eyeY)); c.lineTo(u(0) + 30, v(eyeY)); c.moveTo(u(0), v(eyeY) - 30); c.lineTo(u(0), v(eyeY) + 30); c.stroke();
    c.fillStyle = '#ffd23f'; c.font = '26px monospace'; c.fillText('SPRAY WALL  20 m  ·  1 grid = 1°  ·  aim point = standing eye', 30, 20);
  });
  box(wallX, 0, wallZ - 0.5, 2 * WX, WH, 1, { material: new THREE.MeshBasicMaterial({ map: wallTex }), noShadow: true });

  // ---- penetration lanes (bay pen): panel then a dummy 2.2 m behind
  const penLanes = [
    { x: 24, kind: 'wood', label: 'WOOD (thin, penetrable)', mesh: () => box(24, 0, 0, 2.4, 2.4, 0.12, { color: 0xb07a3c, surface: 'wood', thin: true }) },
    { x: 30, kind: 'glass', label: 'GLASS (thin, penetrable)', mesh: () => box(30, 0, 0, 2.4, 2.4, 0.06, { material: new THREE.MeshStandardMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.0 }), surface: 'glass', thin: true, noShadow: true }) },
    { x: 36, kind: 'stone', label: 'STONE 0.6 m (blocks)', mesh: () => box(36, 0, 0, 2.4, 2.4, 0.6, { color: 0x8b8578, surface: 'stone' }) },
  ];
  for (const l of penLanes) l.mesh();

  // ---- main-lane furniture: distance markers
  const labelTex = (txt) => canvasTex(256, 96, (c, w, h) => { c.fillStyle = 'rgba(16,20,26,.85)'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffd23f'; c.lineWidth = 5; c.strokeRect(2, 2, w - 4, h - 4); c.fillStyle = '#fff'; c.font = 'bold 54px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 3); });
  for (const d of [5, 10, 15, 20, 25, 30, 40, 50]) {
    const z = 10 - d;
    box(0, 0.001, z, 18, 0.02, 0.1, { material: new THREE.MeshBasicMaterial({ color: d % 10 === 0 ? 0xffd23f : 0xffffff }), noShadow: true, surface: 'stone' }).castShadow = false;
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: labelTex(`${d} m`), transparent: true })); sp.position.set(-9.6, 1.4, z); sp.rotation.y = Math.PI / 2 * 0.9; group.add(sp);
    const sp2 = sp.clone(); sp2.position.x = 9.6; sp2.rotation.y = -Math.PI / 2 * 0.9; group.add(sp2);
  }
  // cover for wall-bang demo lane on main: low stone block
  box(-8, 0, -10, 3, 1.2, 0.6, { color: 0x8b8578 });

  // collision + raycast ------------------------------------------------------------------------------------------------
  const geo = mergeGeometries(solids); geo.boundsTree = new MeshBVH(geo);
  const collider = new THREE.Mesh(geo); collider.visible = false;
  const ray = new THREE.Ray(), bvh = geo.boundsTree;
  const inBox = (p, b, e) => p.x >= b.min.x - e && p.x <= b.max.x + e && p.y >= b.min.y - e && p.y <= b.max.y + e && p.z >= b.min.z - e && p.z <= b.max.z + e;
  function slab(o, d, b, far) {   // front-face entry only, like a single-sided BVH mesh
    if (inBox(o, b, 0)) return null;
    let t0 = 0, t1 = far, ax = -1, sg = 0;
    for (let a = 0; a < 3; a++) {
      const k = a === 0 ? 'x' : a === 1 ? 'y' : 'z', oo = o[k], dd = d[k], lo = b.min[k], hi = b.max[k];
      if (Math.abs(dd) < 1e-9) { if (oo < lo || oo > hi) return null; continue; }
      let ta = (lo - oo) / dd, tb = (hi - oo) / dd, s = dd > 0 ? -1 : 1; if (ta > tb) { const q = ta; ta = tb; tb = q; }
      if (ta > t0) { t0 = ta; ax = a; sg = s; } if (tb < t1) t1 = tb; if (t0 > t1) return null;
    }
    if (ax < 0 || t0 <= 0) return null; const n = new THREE.Vector3(); n.setComponent(ax, sg); return { t: t0, n };
  }
  const saved = { raycast: ctx.map?.raycast, surfaceAt: ctx.map?.surfaceAt, collider: ctx.map?.collider, thinWalls: ctx.map?.thinWalls };
  function rangeRaycast(o, d, far = 500) {
    ray.origin.copy(o); ray.direction.copy(d);
    const h = bvh.raycastFirst(ray, THREE.FrontSide, 0, far);
    let best = h ? { point: h.point.clone(), normal: h.face.normal.clone(), distance: h.distance } : null;
    for (const b of thin) { const s = slab(o, d, b, best ? best.distance : far); if (s && (!best || s.t < best.distance)) best = { point: o.clone().addScaledVector(d, s.t), normal: s.n, distance: s.t, thin: true, surface: b.surface }; }
    return best;
  }
  const surfaceAt = (p) => { let best = null, bv = 1e9; for (const b of surfaces) if (inBox(p, b, 0.03)) { const v = (b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z); if (v < bv) { bv = v; best = b; } } return best?.surface || 'stone'; };
  if (ctx.map) {
    ctx.map.raycast = rangeRaycast; ctx.map.surfaceAt = surfaceAt; ctx.map.collider = collider;
    ctx.map.thinWalls = thin.map((b) => new THREE.Box3(b.min.clone(), b.max.clone()));
  }

  // ------------------------------------------------------------------------------------------------ dummies
  const targets = core.targets;
  function makeDummyMesh(color, armored, crouch) {
    const g = new THREE.Group(), ms = [];
    const M = (c, e = 0) => { const m = new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0 }); ms.push(m); m.userData.base = c; return m; };
    const part = (geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; g.add(me); return me; };
    const body = M(color), dark = M(0x243040), head = M(0xffe08a), vest = M(armored ? 0xff9a3c : color);
    part(new THREE.BoxGeometry(0.2, 0.84, 0.22), dark, -0.13, 0.42, 0); part(new THREE.BoxGeometry(0.2, 0.84, 0.22), dark, 0.13, 0.42, 0);
    part(new THREE.BoxGeometry(0.46, 0.26, 0.26), body, 0, 0.98, 0);                      // stomach
    part(new THREE.BoxGeometry(0.5, 0.36, 0.3), vest, 0, 1.29, 0);                        // chest
    part(new THREE.BoxGeometry(0.11, 0.42, 0.13), body, -0.36, 1.2, 0); part(new THREE.BoxGeometry(0.11, 0.42, 0.13), body, 0.36, 1.2, 0);
    part(new THREE.IcosahedronGeometry(0.155, 1), head, 0, 1.63, 0);
    if (armored) part(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 10), M(0xff9a3c), 0, 1.74, 0);
    g.userData.mats = ms; g.userData.flash = 0; if (crouch) g.scale.y = 1.25 / 1.8;
    return g;
  }
  const dummies = [];
  function addDummy(name, x, z, o = {}) {
    const a = createActor({ name, team: 'tide' }); a.isDummy = true; a.pos.set(x, 0, z); a.yaw = Math.PI; a.hp = 100; a.armor = o.armor ? 100 : 0; a.helmet = !!o.armor; a.crouching = !!o.crouch;
    a.height = 1.8; a.eyeHeight = 1.62;
    const mesh = makeDummyMesh(o.color ?? 0x2fd0ff, !!o.armor, !!o.crouch); mesh.position.copy(a.pos); mesh.rotation.y = a.yaw; group.add(mesh);
    const d = { actor: a, mesh, home: new THREE.Vector3(x, 0, z), move: o.move || null, dir: 1, respawnAt: 0, firstHit: -1, armorBase: !!o.armor, hue: o.color };
    targets.push(a); dummies.push(d); a.dummy = d; return d;
  }
  // main lane (player stands at z = 10)
  addDummy('10 m static', 0, 0);
  addDummy('20 m static', -2.5, -10); addDummy('30 m static', 2.5, -20); addDummy('45 m static', 0, -35);
  addDummy('15 m crouched', 3.5, -5, { crouch: true }); addDummy('12 m armoured', -4, -2, { armor: true, color: 0x7d8cff });
  addDummy('15 m strafing', 0, -5, { move: { amp: 4, speed: 3.2 }, color: 0x5ce0a0 }); addDummy('25 m strafing', 0, -15, { move: { amp: 6, speed: 4.2 }, color: 0x5ce0a0 });
  // penetration lanes: dummies 2.2 m behind panels (panel z=0, player at z=10)
  for (const l of penLanes) addDummy(`pen ${l.kind}`, l.x, -2.2, { color: 0xff8fb0 });

  const hpFlash = (d, amt) => { d.mesh.userData.flash = Math.max(d.mesh.userData.flash, amt); };
  function respawn(d) {
    const a = d.actor; a.hp = 100; a.alive = true; a.tagged = false; a.armor = armorMode && d.armorBase !== false ? 100 : d.armorBase ? 100 : 0; a.helmet = a.armor > 0; a.dmgTaken = 0;
    a.pos.copy(d.home); d.mesh.scale.setScalar(1); if (a.crouching) d.mesh.scale.y = 1.25 / 1.8; d.mesh.visible = true; d.firstHit = -1; d.respawnAt = 0; a.cb?.dmgBy.clear();
  }
  let armorMode = false;

  // ------------------------------------------------------------------------------------------------ decals (bullet holes)
  const MAXH = 500, holeGeo = new THREE.CircleGeometry(1, 10), holes = new THREE.InstancedMesh(holeGeo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), MAXH);
  holes.count = 0; holes.frustumCulled = false; holes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); holes.setColorAt(0, new THREE.Color()); group.add(holes);
  let hn = 0, hcount = 0, sprayStart = 0, lastImpactT = -9; const impacts = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _sc = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), _z = new THREE.Vector3(0, 0, 1);
  const hook = (e) => {
    if (e.actor !== L || e.surface === 'body') return;
    if (core.time - lastImpactT > 0.7) sprayStart = e.shot; lastImpactT = core.time;
    const idx = e.shot - sprayStart, dist = e.point.distanceTo(L.pos);
    if (impacts.length < 4000) impacts.push({ x: +e.point.x.toFixed(3), y: +e.point.y.toFixed(3), z: +e.point.z.toFixed(3), shot: idx, surface: e.surface, tagger: e.tagger });
    if (!e.normal) return;
    const r = Math.min(0.2, 0.03 + dist * 0.0016);
    _q.setFromUnitVectors(_z, e.normal); _p.copy(e.point).addScaledVector(e.normal, 0.012); _sc.set(r, r, r);
    _m.compose(_p, _q, _sc); const i = hn % MAXH; holes.setMatrixAt(i, _m); _c.setHSL(Math.max(0, 0.66 - idx * 0.022), 1, 0.55); holes.setColorAt(i, _c);
    hn++; hcount = Math.min(MAXH, hn); holes.count = hcount; holes.instanceMatrix.needsUpdate = true; if (holes.instanceColor) holes.instanceColor.needsUpdate = true;
  };
  core.hooks.impact.push(hook);
  const clearHoles = () => { hn = 0; hcount = 0; holes.count = 0; impacts.length = 0; };

  // ------------------------------------------------------------------------------------------------ damage numbers
  const NUM = 10, nums = [];
  for (let i = 0; i < NUM; i++) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })); s.scale.set(1.0, 0.5, 1); s.visible = false; s.renderOrder = 300; group.add(s); nums.push({ s, c, t, life: 0 });
  }
  let numI = 0;
  function showNum(p, text, color) {
    const n = nums[numI++ % NUM], x = n.c.getContext('2d'); x.clearRect(0, 0, 128, 64); x.font = 'bold 44px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 6; x.strokeStyle = '#000'; x.strokeText(text, 64, 34); x.fillStyle = color; x.fillText(text, 64, 34);
    n.t.needsUpdate = true; n.s.position.copy(p); n.s.position.y += 0.3; n.s.visible = true; n.life = 0.9;
  }

  // ------------------------------------------------------------------------------------------------ stats + overlay
  const S = { shots: 0, hits: 0, crowns: 0, dmg: 0, kills: 0, last: null, lastTTK: 0, ttk: [], since: core.time };
  const offs = [];
  offs.push(ctx.events.on('weapon:fire', (e) => { if (e.actor === L && e.hitscan !== false) S.shots++; }));
  offs.push(ctx.events.on('tag:hit', (e) => {
    const d = e.victim?.dummy; if (!d) return;
    hpFlash(d, e.hitgroup === 'head' ? 1.4 : 0.9); if (d.firstHit < 0) d.firstHit = core.time;
    if (e.attacker === L) { S.hits++; S.dmg += e.damage; if (e.hitgroup === 'head') S.crowns++; S.last = { dmg: e.damage, group: e.hitgroup, dist: e.distance, wb: e.wallbang, through: e.through, abs: e.armorAbsorbed, hp: e.victim.hp }; }
    showNum(e.point, `${e.damage}${e.wallbang ? ' wb' : ''}`, e.hitgroup === 'head' ? '#ffe066' : (e.armorAbsorbed > 0 ? '#9fb0ff' : '#ffffff'));
  }));
  offs.push(ctx.events.on('tag:out', (e) => {
    const d = e.victim?.dummy; if (!d) return;
    d.respawnAt = core.time + 1.6; d.outT = 0; if (e.attacker === L) { S.kills++; S.lastTTK = core.time - d.firstHit; S.ttk.push(S.lastTTK); }
    ctx.vfx?.shards?.(_p.set(d.actor.pos.x, 1.0, d.actor.pos.z), 0x2fd0ff, 'shatter', { dir: e.dir });
  }));

  let hud = null, xh = null;
  if (P.get('overlay') !== '0' && typeof document !== 'undefined') {
    hud = document.createElement('div'); hud.id = 'range-hud';
    hud.style.cssText = 'position:fixed;left:12px;top:12px;z-index:50;font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#e6f0ff;background:rgba(10,14,20,.72);border:1px solid rgba(255,255,255,.14);border-radius:6px;padding:8px 10px;pointer-events:none;white-space:pre;min-width:290px';
    document.body.appendChild(hud);
    if (!ctx.hud || ctx.hud.__stub) {
      xh = document.createElement('div'); xh.style.cssText = 'position:fixed;left:50%;top:50%;width:0;height:0;z-index:49;pointer-events:none';
      for (let i = 0; i < 4; i++) { const b = document.createElement('div'); b.style.cssText = 'position:absolute;background:#6dff9a;box-shadow:0 0 0 1px rgba(0,0,0,.6)'; xh.appendChild(b); }
      document.body.appendChild(xh);
    }
  }
  const stanceOf = () => (L.crouching ? 'crouch' : L.onGround === false ? 'air' : 'stand');
  let hudT = 0;
  function drawHud() {
    if (!hud) return;
    const w = core.equipped(L), def = w?.def, cb = L.cb;
    const inacc = def && !def.melee ? core.inaccuracy(L) : 0, sp = Math.hypot(L.vel.x, L.vel.z);
    const acc = S.shots ? (100 * S.hits / S.shots).toFixed(0) : '-';
    const avg = S.ttk.length ? (S.ttk.reduce((a, b) => a + b, 0) / S.ttk.length).toFixed(2) : '-';
    const l = S.last;
    hud.textContent =
      `RANGE  ${def ? def.name.toUpperCase() : '?'} (${def?.cs || ''})  slot ${L.inventory.current}\n` +
      `${def?.melee ? 'melee' : `ammo ${w?.mag}/${w?.reserve}  ${w?.state}${w?.scopeLevel ? '  SCOPE ' + w.scopeLevel : ''}`}\n` +
      `inaccuracy ${inacc.toFixed(2)}°  (${(Math.tan(inacc * Math.PI / 180) * 2000).toFixed(0)} cm @20m)  xhair ${core.crosshairSpread(L).toFixed(2)}\n` +
      `recoil idx ${cb ? cb.recoilIdx.toFixed(1) : 0}  speed ${sp.toFixed(1)} m/s  ${stanceOf()}  hp ${L.hp}\n` +
      `shots ${S.shots}  hits ${S.hits} (${acc}%)  crowns ${S.crowns}  dmg ${S.dmg}  tags ${S.kills}\n` +
      `last ${l ? `${l.dmg} ${l.group} @ ${l.dist.toFixed(1)}m${l.wb ? ' wallbang/' + l.through : ''}${l.abs ? ' abs ' + l.abs : ''} (hp ${l.hp})` : '-'}\n` +
      `TTK last ${S.lastTTK ? S.lastTTK.toFixed(2) + 's' : '-'}  avg ${avg}s\n` +
      `[ ] tagger · T bay · Y reset · U dummy armour ${armorMode ? 'ON' : 'off'}`;
    if (xh) {
      const gap = 4 + core.crosshairSpread(L) * 44, len = 7, els = xh.children, t = 2;
      const set = (e, x, y, w2, h2) => { e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.width = w2 + 'px'; e.style.height = h2 + 'px'; };
      set(els[0], -t / 2, -gap - len, t, len); set(els[1], -t / 2, gap, t, len); set(els[2], -gap - len, -t / 2, len, t); set(els[3], gap, -t / 2, len, t);
      xh.style.display = w?.scopeLevel ? 'none' : 'block';
    }
  }

  // ------------------------------------------------------------------------------------------------ scene control
  function bay(name) {
    const b = BAYS[name] || BAYS.main; L.pos.set(b.x, 0, b.z); L.vel.set(0, 0, 0); L.yaw = b.yaw; L.pitch = 0; L.onGround = true; L.hp = 100; L.alive = true; L.tagged = false; sc.bayName = name; clearHoles();
    for (const d of dummies) respawn(d);
  }
  function setTagger(id) {
    if (!TAGGERS[id]) return; const w = core.give(L, id, { select: true }); if (id === 'tap') core.switchTo(L, 3); else core.switchTo(L, TAGGERS[id].slot);
    sc.tagger = id; return w;
  }
  function resetAll() { clearHoles(); for (const d of dummies) respawn(d); const w = core.equipped(L); if (w?.def && !w.def.melee) { w.mag = w.def.mag; w.reserve = w.def.reserve; } S.shots = S.hits = S.crowns = S.dmg = S.kills = 0; S.ttk.length = 0; S.lastTTK = 0; S.last = null; }
  const sc = { bayName: 'main', tagger: 'pip', bay, setTagger, reset: resetAll, stats: () => ({ ...S }), targets, dummies, impacts, clearHoles, holes: () => hcount, group, armor: (v) => { armorMode = v ?? !armorMode; for (const d of dummies) { if (!d.armorBase) { d.actor.armor = armorMode ? 100 : 0; d.actor.helmet = armorMode; } } } };
  const onKey = (e) => {
    if (e.repeat || ctx.input?.captureKeys) return;
    if (e.code === 'BracketRight' || e.code === 'BracketLeft') { const cur = core.equipped(L)?.def?.id || 'pip', i = ORDER.indexOf(cur); setTagger(ORDER[(i + (e.code === 'BracketRight' ? 1 : ORDER.length - 1) + ORDER.length) % ORDER.length]); }
    else if (e.code === 'KeyT') { const ks = Object.keys(BAYS); bay(ks[(ks.indexOf(sc.bayName) + 1) % ks.length]); }
    else if (e.code === 'KeyY') resetAll();
    else if (e.code === 'KeyU') sc.armor();
  };
  if (typeof addEventListener === 'function') { addEventListener('keydown', onKey); offs.push(() => removeEventListener('keydown', onKey)); }

  // ------------------------------------------------------------------------------------------------ per-tick
  const _dv = new THREE.Vector3();
  const system = {
    fixedUpdate(dt) {
      for (const d of dummies) {
        const a = d.actor;
        if (a.alive === false) { if (d.respawnAt && core.time >= d.respawnAt) respawn(d); continue; }
        if (d.move) {
          const m = d.move; a.pos.x += d.dir * m.speed * dt; a.vel.set(d.dir * m.speed, 0, 0);
          if (a.pos.x > d.home.x + m.amp) d.dir = -1; else if (a.pos.x < d.home.x - m.amp) d.dir = 1;
        }
      }
      // keep the local actor healthy & on the range (practice)
      if (L.alive === false && ctx.match?.phase == null) { L.hp = 100; L.alive = true; L.tagged = false; core.reset(L, { keep: true }); }
    },
    update(dt) {
      for (const d of dummies) {
        const a = d.actor, m = d.mesh;
        m.position.set(a.pos.x, 0, a.pos.z); m.rotation.y = a.yaw;
        if (a.alive === false) { d.outT = (d.outT || 0) + dt; const k = Math.max(0, 1 - d.outT / 0.22); m.scale.setScalar(k); m.visible = k > 0; }
        const f = m.userData.flash; if (f > 0) { m.userData.flash = Math.max(0, f - dt * 5); for (const mm of m.userData.mats) mm.emissiveIntensity = m.userData.flash * 0.9; }
      }
      for (const n of nums) if (n.life > 0) { n.life -= dt; n.s.position.y += dt * 0.9; n.s.material.opacity = Math.min(1, n.life * 2.2); if (n.life <= 0) n.s.visible = false; }
      hudT += dt; if (hudT > 0.08) { hudT = 0; drawHud(); }
    },
  };
  ctx.engine.add(system, 8.5);

  // ------------------------------------------------------------------------------------------------ start
  const startBay = P.get('bay') || 'main';
  bay(startBay);
  core.reset(L, { keep: false, revive: true });
  const start = P.get('tagger') || 'arc'; setTagger(start);
  L.credits = 9000;
  sc.dispose = () => {
    for (const o of offs) o?.(); ctx.engine.remove(system); group.parent?.remove(group); hud?.remove(); xh?.remove();
    const i = core.hooks.impact.indexOf(hook); if (i >= 0) core.hooks.impact.splice(i, 1); targets.length = 0;
    if (ctx.map) { ctx.map.raycast = saved.raycast; ctx.map.surfaceAt = saved.surfaceAt; ctx.map.collider = saved.collider; ctx.map.thinWalls = saved.thinWalls; if (ctx.map.group) ctx.map.group.visible = true; }
  };
  core.debug.range = sc;
  return sc;
}
