import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Debug/showcase scenes: ?scene=render-gallery, ?scene=render-fx  (use with ?test=1&seed=1 and __game.advance(s))
export function registerScenes(ctx, R) {
  ctx.debugScenes ||= {};
  const M = R.materials;

  function isolate(group) {
    const hidden = [];
    for (const c of R.scene.children) {
      if (c === group || c.isLight || c === R.sky || c === R.skyModule.clouds || c.userData?.keep) continue;
      if (c.visible) { c.visible = false; hidden.push(c); }
    }
    return () => hidden.forEach((c) => { c.visible = true; });
  }
  function stage(opts = {}) {
    const g = new THREE.Group(); g.name = 'render-stage'; R.scene.add(g);
    const restoreVis = isolate(g);
    const saved = { fov: R.camera.fov, sky: { ...R.skyModule.params } };
    R.setFov(opts.fov ?? 58);
    R.setSky({ sunElevation: opts.el ?? 33, sunAzimuth: opts.az ?? 322 });
    const cam = { pos: new THREE.Vector3(...(opts.cam || [0.5, 2.0, 9.5])), look: new THREE.Vector3(...(opts.look || [0, 1.05, 0])) };
    const ui = document.getElementById('ui'), uiPrev = ui?.style.display; if (ui && !ctx.params.get('ui')) ui.style.display = 'none';
    ctx.combat?.viewmodel?.setVisible?.(false);
    const fov = opts.fov ?? 58;
    const sys = { update() { R.camera.position.copy(cam.pos); R.camera.lookAt(cam.look); if (R.camera.fov !== fov) R.setFov(fov); R.camera.updateMatrixWorld(); } };
    ctx.engine.add(sys, 9999);
    R.follow(cam.look);
    sys.update();
    const cleanup = () => { if (ui) ui.style.display = uiPrev || ''; ctx.combat?.viewmodel?.setVisible?.(true); ctx.engine.remove(sys); R.scene.remove(g); restoreVis(); R.setFov(saved.fov); R.setSky(saved.sky); R.follow(null); g.traverse((o) => o.geometry?.dispose?.()); };
    R.debug.endScene = cleanup; R.debug.stageCam = cam;
    return { g, cam, cleanup };
  }
  const mesh = (geo, mat, x, y, z, g, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; g.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, g) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, g);
  const ico = (r, mat, x, y, z, g, d = 2) => mesh(new THREE.IcosahedronGeometry(r, d), mat, x, y, z, g);

  function buildShowcase(g) {
    // ground + back wall
    box(140, 0.4, 140, M.textured('sand'), 0, -0.2, 0, g);
    // floor pads (textured kinds seen from above/at glancing angle)
    ['concrete', 'tile', 'grass', 'rubber', 'grid', 'water'].forEach((k, i) => box(2.2, 0.1, 2.2, M.textured(k), -6.6 + i * 2.65, 0.05, 5.6, g));
    // wall panels
    const kinds = ['brick', 'concrete', 'tile', 'wood', 'metal', 'grid'];
    kinds.forEach((k, i) => box(2.5, 3.6, 0.4, M.textured(k), -6.35 + i * 2.55, 1.8, -4.2, g));
    box(17, 0.4, 0.6, M.textured('concrete'), 0, 3.8, -4.2, g);
    // material spheres — back row
    const back = [M.flat(0xf2ede2), M.flat(0xff7a2f), M.toon(0x59c2ff), M.metal(0xd8dde4, 0.18), M.metal(0xd4a24c, 0.45), M.glass(0x9fdcff, 0.3), M.emissive(0x33e0ff, 3), M.emissive(0xff8a3a, 3.5)];
    back.forEach((m, i) => { ico(0.62, m, -4.9 + i * 1.4, 0.72, -0.6, g, 2); });
    // front row: team suits, hologram, textured kinds
    const front = [M.team('ember'), M.team('tide'), M.hologram(0x66e0ff), M.textured('brick'), M.textured('wood'), M.textured('tile'), M.toon(0xffd166), M.flat(0x7be07b)];
    front.forEach((m, i) => { ico(0.55, m, -4.55 + i * 1.3, 0.62, 2.3, g, m.isShaderMaterial ? 2 : 1); });
    // pedestal cubes with different roughness
    for (let i = 0; i < 4; i++) box(0.7, 0.35 + i * 0.25, 0.7, M.metal(0xc8ccd2, 0.08 + i * 0.28), 5.2 + (i % 2) * 0.9, (0.35 + i * 0.25) / 2, 3.6 - Math.floor(i / 2) * 1.0, g);
    // tall casters for shadow reading
    box(0.5, 4.2, 0.5, M.flat(0xd9c6a3), -7.5, 2.1, 1.3, g); box(0.5, 3.0, 0.5, M.flat(0xd9c6a3), 7.4, 1.5, 0.5, g);
    box(1.6, 0.25, 6.0, M.flat(0xe6dcc4), 1.0, 2.9, 3.2, g).receiveShadow = false;   // overhead canopy casting a big shadow band
    // emissive strips + glass
    box(4.0, 0.06, 0.06, M.emissive(0x4ff3ff, 3.2), 0, 3.05, -3.9, g, false);
    box(2.6, 2.0, 0.05, M.glass(0xa8e6ff, 0.22), -4.0, 1.05, 4.2, g, false);
    box(0.08, 1.4, 0.08, M.emissive(0xff5a2a, 4), 7.4, 0.9, 4.2, g, false);
    // AO-baked courtyard corner (uses ctx.render.bakeVertexAO)
    const parts = [new THREE.BoxGeometry(3.4, 0.4, 3.4).translate(0, 0.2, 0), new THREE.BoxGeometry(0.4, 2.2, 3.4).translate(-1.5, 1.5, 0), new THREE.BoxGeometry(3.4, 2.2, 0.4).translate(0, 1.5, -1.5), new THREE.BoxGeometry(0.9, 0.9, 0.9).translate(0.7, 0.85, 0.6)].map((p) => p.toNonIndexed());
    const geo = mergeGeometries(parts); R.bakeVertexAO(geo, { samples: 32, radius: 1.8, strength: 0.85, skyBoost: 0.15 });
    mesh(geo, M.flat(0xf0e2c4, { vertexColors: true }), 10.2, 0, -1.0, g);
    return g;
  }

  // ---------------------------------------------------------------------------------------------------------------------------------
  ctx.debugScenes['render-gallery'] = async () => {
    const s = stage({ cam: [0.8, 3.3, 12.8], look: [0.8, 1.0, 0.4], fov: 50 });
    buildShowcase(s.g);
    return s.cleanup;
  };

  ctx.debugScenes['render-fx'] = async () => {
    const s = stage({ cam: [0.8, 3.3, 12.8], look: [0.8, 1.0, 0.4], fov: 50 });
    buildShowcase(s.g);
    const label = document.createElement('div'); label.style.cssText = 'position:fixed;left:16px;top:12px;color:#fff;font:600 14px system-ui;text-shadow:0 1px 3px #000;pointer-events:none;z-index:99';
    document.body.appendChild(label);
    const seq = [
      ['idle', 0.6, () => {}], ['flash (white)', 1.4, () => R.screen.flash(0xffffff, 0.8, 1.6)], ['flash (orange)', 1.4, () => R.screen.flash(0xff8a3a, 0.6, 1.6)],
      ['blur 0.8 (sustained 1s)', 1.3, () => R.screen.blur(0.8)], ['tint teal', 1.3, () => R.screen.tint(0x2fd0ff, 0.5)],
      ['damage (from right)', 1.4, () => R.screen.damage(Math.PI / 2, 0.8)], ['damage (from ahead) + shake', 1.4, () => { R.screen.damage(0, 0.6); R.shake(0.5); }],
      ['whiteout 0.6s', 3.4, () => R.screen.whiteout(0.6)], ['shake 0.9', 1.6, () => R.shake(0.9, 5)],
    ];
    let idx = -1, t = 0, next = 0;
    const sys = { update(dt) {
      t += dt;
      if (t >= next) {
        idx = (idx + 1) % seq.length; const [name, dur, fn] = seq[idx]; label.textContent = 'render-fx: ' + name; next = t + dur; fn();
      }
      if (seq[idx] && seq[idx][0].startsWith('blur') || seq[idx]?.[0].startsWith('tint')) { const n = seq[idx][0]; if (n.startsWith('blur')) R.screen.blur(0.8); else R.screen.tint(0x2fd0ff, 0.5); }
    } };
    ctx.engine.add(sys, 9998);
    R.debug.fxScene = { seq, get index() { return idx; }, jump(i) { idx = i - 1; next = 0; } };
    const prev = s.cleanup;
    return () => { ctx.engine.remove(sys); label.remove(); prev(); };
  };
}
