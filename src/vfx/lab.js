import * as THREE from 'three';
import { createActor } from '../core/actor.js';

// ?scene=vfx-lab : neutral arena + control panel that fires every effect. Deterministic under ?test=1 + __game.advance().
// Programmatic: __game.ctx.vfx.debug.fire('impact-metal'), .list(), .cam('close'), .slow(0.25)
export function registerLab(ctx, vfx) {
  const dbg = vfx.debug;
  let lab = null;

  const SURF = ['stone', 'tile', 'metal', 'wood', 'glass', 'sand', 'water', 'grass', 'rubber'];
  const TSTYLE = ['beam', 'pulse', 'comet', 'prism', 'laser', 'twin'];
  const SHARD = ['shatter', 'confetti', 'pixelate', 'fireworks', 'petals', 'stars'];

  function build() {
    const R = ctx.render, scene = R.scene;
    const g = new THREE.Group(); g.name = 'vfx-lab-arena'; scene.add(g);
    if (ctx.map?.group) ctx.map.group.visible = false;
    const std = (color, o = {}) => (R.materials?.flat ? R.materials.flat(color, o) : new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...o }));
    const mk = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    // floor: soft checker so motion & ground contact read
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c2 = cv.getContext('2d');
    c2.fillStyle = '#b9b4ab'; c2.fillRect(0, 0, 128, 128); c2.fillStyle = '#aaa59c'; c2.fillRect(0, 0, 64, 64); c2.fillRect(64, 64, 64, 64);
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(30, 30); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const floor = mk(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }), 0, 0, -6); floor.rotation.x = -Math.PI / 2;
    mk(new THREE.BoxGeometry(60, 8, 0.5), std(0x8d8880), 0, 4, -14);            // back wall
    const T = {};
    const defs = [
      ['stone', 0xa79b8a, -7.2], ['tile', 0xdedad0, -4.8], ['metal', 0x555b66, -2.4], ['wood', 0x9b7148, 0], ['glass', 0x9fdcff, 2.4], ['sand', 0xd3b988, 4.8], ['rubber', 0x3a3a40, 7.2],
    ];
    for (const [name, col, x] of defs) {
      let mat = std(col, name === 'metal' ? { metalness: 0.6, roughness: 0.4 } : {});
      if (name === 'glass') mat = new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.1 });
      mk(new THREE.BoxGeometry(2.0, 2.6, 0.35), mat, x, 1.3, -9);
      T[name] = { x, y: 1.5, z: -8.82, n: [0, 0, 1] };
    }
    // floor patches
    const water = mk(new THREE.BoxGeometry(3.4, 0.04, 3.4), new THREE.MeshStandardMaterial({ color: 0x3aa0d8, roughness: 0.15, metalness: 0.2 }), -3.6, 0.02, -3.4); T.water = { x: -3.6, y: 0.04, z: -3.4, n: [0, 1, 0] };
    const grass = mk(new THREE.BoxGeometry(3.4, 0.04, 3.4), std(0x6f9a4a), 3.6, 0.02, -3.4); T.grass = { x: 3.6, y: 0.04, z: -3.4, n: [0, 1, 0] };
    // dummy actor (mannequin for muzzle / shards / pings)
    const dummy = createActor({ name: 'dummy', team: 'ember' }); dummy.pos.set(1.6, 0, -2.6); dummy.yaw = 2.5;
    const body = new THREE.Group();
    const mm = std(0x6b7280);
    body.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 4, 10), mm)); body.children[0].position.y = 0.9;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), std(0x9aa3b2)); head.position.y = 1.62; body.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.6), std(0x22252b)); gun.position.set(0.28, 1.25, -0.4); body.add(gun);
    body.position.copy(dummy.pos); body.rotation.y = dummy.yaw; body.traverse((o) => { o.castShadow = true; }); g.add(body);
    const dummy2 = createActor({ name: 'dummy2', team: 'tide' }); dummy2.pos.set(-1.6, 0, -2.6); dummy2.yaw = -2.5;
    const body2 = body.clone(); body2.position.copy(dummy2.pos); body2.rotation.y = dummy2.yaw; g.add(body2);
    dummy.alive = dummy2.alive = true;
    // fake first-person muzzle so the viewmodel flash can be judged when the combat piece is a stub
    let fakeMuzzle = null, fakeGun = null;
    if (ctx.render.viewScene && !ctx.combat?.viewmodel?.muzzle) {
      fakeGun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.6, metalness: 0.3 })); fakeGun.position.set(0.2, -0.2, -0.6);
      fakeMuzzle = new THREE.Object3D(); fakeMuzzle.position.set(0.2, -0.2, -0.98); ctx.render.viewScene.add(fakeGun, fakeMuzzle); vfx.viewMuzzleOverride = fakeMuzzle;
    }
    return { group: g, T, dummy, dummy2, body, body2, fakeMuzzle, fakeGun };
  }

  // ---- camera rig (runs after every other module so it always wins) -------------------------------------------------------
  const CAMS = {
    wide: [0, 1.65, 3.2, 0, 1.3, -8, 90],
    walls: [0, 1.55, -1.2, 0, 1.45, -9, 70],
    wall: (x) => [x * 0.6, 1.55, -5.4, x, 1.5, -9, 55],
    floor: (x, z) => [x, 1.3, z + 3.2, x, 0.1, z, 62],
    dummy: [0.2, 1.5, 1.6, 1.6, 1.2, -2.6, 62],
    muzzle: [2.4, 1.5, -0.4, 1.6, 1.3, -2.6, 40],
    tracer: [0.3, 1.6, 0.8, -0.5, 1.4, -6, 80],
    beacon: [3.5, 2.2, 3.0, 0, 2.4, -4, 66],
    view: [0, 1.6, 2.2, 0, 1.4, -8, 78],
  };
  const camState = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 90, key: 'wide', hold: true };
  function setCam(arr, key) {
    if (!arr) return; camState.pos.set(arr[0], arr[1], arr[2]); camState.look.set(arr[3], arr[4], arr[5]); camState.fov = arr[6] || 80; camState.key = key || 'custom'; camState.hold = true;
    applyCam();
  }
  function applyCam() {
    const c = ctx.render.camera; c.position.copy(camState.pos); c.lookAt(camState.look);
    if (Math.abs(c.fov - camState.fov) > 0.01) { c.fov = camState.fov; c.updateProjectionMatrix(); }
  }

  // ---- effect catalogue ------------------------------------------------------------------------------------------------
  const P3 = (x, y, z) => ({ x, y, z });
  function catalogue() {
    const T = lab.T, cat = {};
    const nrm = (t) => P3(t.n[0], t.n[1], t.n[2]);
    for (const s of SURF) {
      cat['impact-' + s] = { cam: () => (T[s].n[1] ? CAMS.floor(T[s].x, T[s].z) : CAMS.wall(T[s].x)), run: () => vfx.impact(P3(T[s].x, T[s].y, T[s].z), nrm(T[s]), s, { force: true, color: 0xff9a4a }) };
    }
    TSTYLE.forEach((st, i) => {
      cat['tracer-' + st] = { cam: () => CAMS.tracer, run: () => {
        const cols = [0xff9a4a, 0x5fe0ff, 0xffe066, 0xffffff, 0xff5a5a, 0x9f7bff];
        vfx.tracer(P3(4.2, 1.3, -3.5), P3(-1.2 + i * 0.5, 1.4, -8.8), cols[i], st, { look: { style: st, width: st === 'laser' ? 0.045 : 0.026, len: st === 'laser' ? 14 : st === 'comet' ? 6 : 4.4, speed: 900, intensity: 1.9, white: 0.3 }, force: true });
      } };
    });
    cat['tracer-volley'] = { cam: () => CAMS.tracer, run: () => { for (let i = 0; i < 6; i++) vfx.tracer(P3(4.2, 1.3, -3.5), P3(-3 + i * 1.2, 1.2 + (i % 3) * 0.3, -8.8), i % 2 ? 0x5fe0ff : 0xff9a4a, 'beam', { look: { style: 'beam', width: 0.024, len: 4, speed: 900, intensity: 1.8, white: 0.3 }, force: true }); } };
    cat['muzzle-world'] = { cam: () => CAMS.muzzle, run: () => { const d = lab.dummy; d.forward(new THREE.Vector3()); vfx.muzzleFlash(d, 'arc'); } };
    cat['muzzle-view'] = { cam: () => CAMS.view, run: () => vfx.muzzleFlash('view', 'arc') };
    SHARD.forEach((st, i) => { cat['shards-' + st] = { cam: () => CAMS.dummy, run: () => vfx.shards(P3(lab.dummy.pos.x, 1.0, lab.dummy.pos.z), i % 2 ? 0x2fd0ff : 0xff7a2f, st, { dir: P3(-0.5, 0, 1), force: true }) }; });
    cat['hitping'] = { cam: () => CAMS.dummy, run: () => vfx.hitPing(P3(lab.dummy.pos.x, 1.3, lab.dummy.pos.z)) };
    cat['hitping-crown'] = { cam: () => CAMS.dummy, run: () => vfx.hitPing(P3(lab.dummy.pos.x, 1.62, lab.dummy.pos.z), { crown: true }) };
    cat['footstep'] = { cam: () => CAMS.floor(0, -2), run: () => { vfx.footstepDust(P3(0, 0, -2), 'stone', 7); vfx.footstepDust(P3(0.25, 0, -1.8), 'stone', 7); } };
    cat['land-soft'] = { cam: () => CAMS.floor(0, -2), run: () => vfx.landPuff(P3(0, 0, -2), 6, 'stone') };
    cat['land-hard'] = { cam: () => CAMS.floor(0, -2), run: () => vfx.landPuff(P3(0, 0, -2), 13, 'sand') };
    cat['slide'] = { cam: () => CAMS.floor(0, -2), run: () => { for (let i = 0; i < 6; i++) vfx.slideSparks(P3(0, 0, -1.5 - i * 0.05), P3(0, 0, -1)); } };
    cat['jumppad'] = { cam: () => CAMS.floor(0, -2), run: () => vfx.jumpPad(P3(0, 0, -2)) };
    cat['pulse'] = { cam: () => CAMS.wide, run: () => vfx.pulse(P3(0, 0, -4), { radius: 7 }) };
    cat['strobe'] = { cam: () => CAMS.wide, run: () => vfx.strobe(P3(0, 1.6, -5)) };
    cat['haze'] = { cam: () => CAMS.wide, run: () => vfx.haze(P3(0, 0, -5), { radius: 4, duration: 14 }) };
    for (const st of ['dropped', 'arming', 'armed', 'disarming', 'disarmed', 'complete']) cat['beacon-' + st] = { cam: () => CAMS.beacon, run: () => { vfx.beacon.auto = false; vfx.beacon.show(P3(0, 0, -4), st, { force: true }); vfx.beacon.setProgress(0.6); vfx.beacon.setFuse(st === 'armed' ? 9 : 35, 35); } };
    cat['beacon-off'] = { cam: () => CAMS.beacon, run: () => vfx.beacon.hide() };
    cat['screen-flash'] = { cam: () => CAMS.wide, run: () => vfx.screen('flash', { amount: 0.5 }) };
    cat['screen-whiteout'] = { cam: () => CAMS.wide, run: () => vfx.screen('whiteout', { t: 0.6 }) };
    cat['screen-damage'] = { cam: () => CAMS.wide, run: () => vfx.screen('damage', { amount: 0.6, dir: 0.8 }) };
    cat['motes'] = { cam: () => CAMS.wide, run: () => vfx.ambient.set({ mode: 'dust', enabled: true }) };
    cat['embers'] = { cam: () => CAMS.wide, run: () => vfx.ambient.set({ mode: 'embers', enabled: true }) };
    cat['fight'] = { cam: () => CAMS.wide, run: () => {
      // stress: ~10 shots/s worth of everything at once
      for (let i = 0; i < 10; i++) {
        const s = SURF[i % 5], t = T[s]; if (!t) continue;
        vfx.tracer(P3(0.9 - i * 0.3, 1.25, 1.0), P3(t.x, 1.3 + (i % 3) * 0.2, -8.8), i % 2 ? 0x5fe0ff : 0xff9a4a, 'beam', { look: { style: 'beam', width: 0.024, len: 4, speed: 900, intensity: 1.8, white: 0.3 }, force: true });
        vfx.impact(P3(t.x, 1.3 + (i % 3) * 0.2, -8.82), P3(0, 0, 1), s, { force: true });
      }
      vfx.muzzleFlash(lab.dummy, 'arc'); vfx.muzzleFlash(lab.dummy2, 'rail'); vfx.muzzleFlash('view', 'arc');
      vfx.shards(P3(lab.dummy.pos.x, 1, lab.dummy.pos.z), 0xff7a2f, 'shatter', { force: true }); vfx.shards(P3(lab.dummy2.pos.x, 1, lab.dummy2.pos.z), 0x2fd0ff, 'confetti', { force: true });
    } };
    return cat;
  }

  let cat = null;
  dbg.list = () => Object.keys(cat || (lab ? (cat = catalogue()) : {}));
  /** fire an effect by name; opts.cam=false keeps the current camera */
  dbg.fire = (name, o = {}) => {
    if (!lab) return false; cat = cat || catalogue();
    const e = cat[name]; if (!e) return false;
    if (o.cam !== false) setCam(typeof e.cam === 'function' ? e.cam() : e.cam, name);
    e.run(); return true;
  };
  dbg.cam = (name, ...a) => { const c = CAMS[name]; if (!c) return false; setCam(typeof c === 'function' ? c(...a) : c, name); return true; };
  dbg.setCamera = (arr) => setCam(arr);
  dbg.slow = (s) => { ctx.engine.timeScale = s; };
  dbg.lab = () => lab;

  // ---- panel ---------------------------------------------------------------------------------------------------------------
  function panel() {
    if (ctx.params.get('panel') === '0') return null;
    const host = document.getElementById('ui') || document.body;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:10px;top:10px;width:230px;max-height:calc(100vh - 20px);overflow:auto;background:rgba(10,14,22,.82);color:#dfe8f5;font:11px/1.35 system-ui,sans-serif;padding:8px;border-radius:8px;z-index:20;pointer-events:auto;backdrop-filter:blur(6px)';
    const btn = 'background:#1d2a40;color:#dfe8f5;border:1px solid #33486b;border-radius:4px;padding:3px 6px;margin:1px;font:11px system-ui;cursor:pointer';
    const groups = [['Tracers', 'tracer-'], ['Muzzle', 'muzzle-'], ['Impacts', 'impact-'], ['Tag-out', 'shards-'], ['Hits', 'hitping'], ['Movement', ['footstep', 'land-soft', 'land-hard', 'slide', 'jumppad']], ['Utility', ['pulse', 'strobe', 'haze']], ['Beacon', 'beacon-'], ['Screen', 'screen-'], ['Ambient', ['motes', 'embers']], ['Stress', ['fight']]];
    let html = '<b style="font-size:12px">VFX LAB</b> <span style="opacity:.6">slow-mo</span> ';
    for (const s of [1, 0.5, 0.25, 0.1]) html += `<button data-slow="${s}" style="${btn}">${s}x</button>`;
    html += ' <button data-play="1" style="' + btn + ';border-color:#ffb35a">&#9654; play all</button>';
    for (const [title, sel] of groups) {
      const names = dbg.list().filter((n) => Array.isArray(sel) ? sel.includes(n) : n.startsWith(sel));
      html += `<div style="margin-top:6px;opacity:.65;text-transform:uppercase;letter-spacing:.06em">${title}</div>`;
      for (const n of names) html += `<button data-fx="${n}" style="${btn}">${n.replace(/^[a-z]+-/, '') || n}</button>`;
    }
    html += '<div style="margin-top:6px;opacity:.65">CAMERA</div>';
    for (const c of ['wide', 'walls', 'dummy', 'muzzle', 'beacon', 'view']) html += `<button data-cam="${c}" style="${btn}">${c}</button>`;
    el.innerHTML = html; host.appendChild(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.fx) dbg.fire(b.dataset.fx, { cam: false }); else if (b.dataset.cam) dbg.cam(b.dataset.cam); else if (b.dataset.slow) dbg.slow(+b.dataset.slow); else if (b.dataset.play) dbg.play();
    });
    return el;
  }

  // timeline: play every effect in order (1.8 s apart) driven by vfx clock so it obeys slow-mo
  const seq = { on: false, i: 0, next: 0, names: [] };
  dbg.play = (names) => { seq.names = names || dbg.list().filter((n) => !n.startsWith('screen-') && n !== 'fight' && n !== 'beacon-off'); seq.i = 0; seq.next = vfx.now; seq.on = true; };
  dbg.stop = () => { seq.on = false; };

  ctx.debugScenes['vfx-lab'] = async () => {
    try { ctx.menu?.backdrop?.leave?.(); } catch { /* menu piece optional */ }
    lab = build(); cat = catalogue();
    ctx.engine.add({
      update() {
        if (seq.on && vfx.now >= seq.next) { if (seq.i >= seq.names.length) seq.on = false; else { dbg.fire(seq.names[seq.i++], { cam: false }); seq.next = vfx.now + 1.9; } }
        if (camState.hold) applyCam();
      },
    }, 999);
    setCam(CAMS.wide, 'wide');
    panel();
    const q = ctx.params.get('fx'); if (q) for (const n of q.split(',')) dbg.fire(n, { cam: n === q.split(',')[0] });
    const cm = ctx.params.get('cam'); if (cm) dbg.cam(cm);
    if (ctx.params.get('ambient') === '0') vfx.ambient.set({ enabled: false });
  };
}
