// Mini renderer/scene/camera for the locker: platform, lights, bloom, turntable, drag-rotate, trail + tag-out FX.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRig, TEAM_COL, makeSkinnedTagger } from './rig.js';
import { createRealRig } from './real.js';
import { ParticleSystem, RibbonTrail, TagOutFx, SHAPE } from './fx.js';
import { backdropTexture, radialTexture, mix } from './textures.js';

const FOCUS = {
  body:   { y: 1.0, dist: 4.7, fov: 30, cy: 1.0, yaw: null },
  head:   { y: 1.45, dist: 2.1, fov: 30, cy: 1.55, yaw: 0 },
  back:   { y: 0.9, dist: 4.5, fov: 30, cy: 1.1, yaw: Math.PI },
  tagger: { y: 1.15, dist: 3.3, fov: 30, cy: 1.2, yaw: 0, gun: true },
  charm:  { y: 0.95, dist: 2.3, fov: 30, cy: 1.05, yaw: 1.1 },
  name:   { y: 1.75, dist: 3.0, fov: 30, cy: 1.85, yaw: 0 },
  wide:   { y: 1.0, dist: 5.0, fov: 30, cy: 1.1, yaw: 0.45 },
  run:    { y: 0.8, dist: 6.0, fov: 30, cy: 1.15, yaw: 1.25 },
};

export function createStage(canvas, { ctx = null, preserve = false, name = 'PLAYER', fallbackOnly = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: preserve });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(); scene.background = backdropTexture('ember');
  const pmrem = new THREE.PMREMGenerator(renderer); const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04); scene.environment = envRT.texture; scene.environmentIntensity = 0.3;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  // ---- lights
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x2a1a10, 0.25); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1dc, 1.5); key.position.set(-2.4, 4.2, 3.4); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -1.6; key.shadow.camera.right = 1.6; key.shadow.camera.top = 2.4; key.shadow.camera.bottom = -0.5; key.shadow.camera.near = 1; key.shadow.camera.far = 12; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fc3ff, 0.35); fill.position.set(3, 1.6, 2.5); scene.add(fill);
  const rimA = new THREE.DirectionalLight(0xff7a2f, 1.5); rimA.position.set(-3, 2.2, -3.2); scene.add(rimA);
  const rimB = new THREE.DirectionalLight(0xff7a2f, 1.3); rimB.position.set(3, 2.6, -3); scene.add(rimB);
  const under = new THREE.PointLight(0xff7a2f, 0.5, 3.5, 2); under.position.set(0, 0.1, 1.0); scene.add(under);

  // ---- platform
  const plat = new THREE.Group(); scene.add(plat);
  const platMat = new THREE.MeshStandardMaterial({ color: 0x14171f, roughness: 0.32, metalness: 0.7, flatShading: false });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.32, 0.09, 48), platMat); disc.position.y = -0.045; disc.receiveShadow = true; plat.add(disc);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff7a2f, toneMapped: false }); ringMat.color.multiplyScalar(2.2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.012, 6, 96), ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.002; plat.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.006, 6, 80), ringMat); ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.003; plat.add(ring2);
  const ticks = new THREE.Group(); plat.add(ticks);
  const tickMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; const m = new THREE.Mesh(new THREE.BoxGeometry(i % 4 ? 0.012 : 0.02, 0.004, i % 4 ? 0.06 : 0.11), tickMat); m.position.set(Math.cos(a) * 1.05, 0.004, Math.sin(a) * 1.05); m.rotation.y = -a + Math.PI / 2; ticks.add(m); }
  const shadowCatch = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.55 })); shadowCatch.rotation.x = -Math.PI / 2; shadowCatch.position.y = 0.006; shadowCatch.receiveShadow = true; scene.add(shadowCatch);
  const glowTex = radialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)', 256);
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xff7a2f, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.y = 0.001; scene.add(floorGlow);
  // light shafts behind
  const shaftTex = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const c = cv.getContext('2d'); const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 256); const g2 = c.createLinearGradient(0, 0, 64, 0); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)'); c.globalCompositeOperation = 'destination-out'; c.fillStyle = g2; c.fillRect(0, 0, 64, 256); const t = new THREE.CanvasTexture(cv); return t; })();
  const shafts = [];
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9 + i * 0.25, 5.2), new THREE.MeshBasicMaterial({ map: shaftTex, color: 0xff7a2f, transparent: true, opacity: 0.16 + (i % 2) * 0.05, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); m.position.set(-2.4 + i * 1.6, 2.4, -2.6 - (i % 2) * 0.6); m.rotation.z = (i - 1.5) * 0.09; scene.add(m); shafts.push(m); }

  // ---- rig
  const rig = (!fallbackOnly && ctx && createRealRig(ctx, name)) || createRig();
  rig.stageScene = scene; scene.add(rig.root); rig.enter?.();
  const glowFx = new ParticleSystem(1800, { additive: true }), solidFx = new ParticleSystem(700, { additive: false });
  scene.add(glowFx.points, solidFx.points);
  const ribbons = [new RibbonTrail(46), new RibbonTrail(46)]; for (const r of ribbons) scene.add(r.mesh);
  const tagFx = new TagOutFx(scene, glowFx, solidFx);
  const inspect = { g: new THREE.Group(), key: '', obj: null, a: 0 }; inspect.g.position.y = 1.15; inspect.g.visible = false; scene.add(inspect.g);
  function syncInspect() {
    const sk = S.spec?.taggerSkin, kind = rig.tagger?.kind ?? 'arc'; if (!sk) return; const k = JSON.stringify(sk) + kind; if (k === inspect.key) return; inspect.key = k;
    if (inspect.obj) { inspect.g.remove(inspect.obj); inspect.obj.traverse((o) => { if (o.isMesh && o.material?.dispose) o.material.dispose(); }); }
    inspect.obj = makeSkinnedTagger(kind, sk); const len = { pip: 0.3, zip: 0.62, arc: 0.95, lance: 1.1 }[kind] ?? 0.9; inspect.obj.position.z = -len * 0.5 + 0.1; inspect.g.add(inspect.obj);
    const sc = 1.45 / Math.max(0.5, len); inspect.g.scale.setScalar(Math.min(2.4, sc));
  }

  // ---- composer
  let composer = null, bloom = null;
  function makeComposer(w, h) {
    try {
      const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
      composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.5, 1.0); composer.addPass(bloom); composer.addPass(new OutputPass());
    } catch { composer = null; }
  }

  // ---- state
  const S = {
    team: 'ember', yaw: 0.35, yawVel: 0, target: { y: 0.98, dist: 4.5, cy: 1.15, x: 0, fov: 30 }, cur: { y: 0.98, dist: 4.5, cy: 1.15, x: 0, fov: 30 },
    focus: 'body', yawGoal: null, turntable: true, dragging: false, idleT: 0, w: 1, h: 1, time: 0, name, jog: false, tagT: 0, tagPhase: 'idle', tagEffect: 'shatter', tagColor: 0x9be7ff, tagWait: 0, zoom: 1, trail: null, trailAcc: 0, spec: null, dust: 0, lookAt: new THREE.Vector3(0, 1, 0), pose: 0,
  };
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

  function setTeamTheme(team) {
    S.team = team; const c = TEAM_COL[team];
    scene.background = backdropTexture(team);
    ringMat.color.setHex(c).multiplyScalar(2.2); floorGlow.material.color.setHex(c); rimA.color.setHex(c); rimB.color.setHex(c); under.color.setHex(c);
    for (const s of shafts) s.material.color.setHex(c);
    hemi.color.setHex(team === 'tide' ? 0xa8d8ff : 0xffd8b0);
  }
  setTeamTheme('ember');

  const api = {
    canvas, renderer, scene, camera, rig, stage: S,
    get team() { return S.team; },
    setSpec(spec, team = S.team, nm = S.name) {
      if (team !== S.team) setTeamTheme(team); S.name = nm; S.spec = spec;
      rig.setSpec(spec, { team, name: nm });
      ribbons[0].setColors(spec.trail.color, spec.trail.color2); ribbons[1].setColors(spec.trail.color, spec.trail.color2);
    },
    setFocus(f) {
      const F = FOCUS[f] ?? FOCUS.body; S.focus = f; S.target.y = F.y; S.target.dist = F.dist; S.target.cy = F.cy; S.target.fov = F.fov; S.yawGoal = F.yaw; S.gunFocus = !!F.gun;
      rig.inspectTarget = F.gun ? 1 : 0;
    },
    setTaggerKind(k) { rig.setTaggerKind?.(k); },
    playEmote(id) { if (S.tagPhase !== 'idle') api.stopTagOut(); rig.stopEmote?.(); S.tagT = 0; rig.playEmote?.(id); },
    stopEmote() { rig.stopEmote?.(); },
    get emoting() { return !!rig.emote; },
    setJog(b) { S.jog = b; rig.jog = b; if (!b) for (const r of ribbons) r.reset(); },
    setTurntable(b) { S.turntable = b; },
    nudge(dyaw) { S.yaw += dyaw; S.yawVel = 0; S.yawGoal = null; S.idleT = 0; },
    fling(v) { S.yawVel = v; S.idleT = 0; },
    setDragging(b) { S.dragging = b; if (b) { S.yawGoal = null; S.idleT = 0; } },
    zoomBy(d) { S.zoom = Math.min(1.5, Math.max(0.6, S.zoom * (1 + d))); },
    enter() { rig.enter?.(); if (S.spec) rig.setSpec(S.spec, { team: S.team, name: S.name }); },
    leave() { rig.leave?.(); },
    get isReal() { return !!rig.isReal; },
    playTagOut(effect, color) {
      if (rig.isReal) { S.tagEffect = effect; S.tagColor = color ?? 0x9be7ff; S.tagPhase = 'real'; S.tagT = 0; rig.stopEmote?.(); rig.tagOut(effect); tagFlash = 0.6; return; }
      rig.stopEmote?.(); S.tagEffect = effect; S.tagColor = color ?? 0x9be7ff; S.tagPhase = 'freeze'; S.tagT = 0; rig.setCrystal?.(true);
    },
    stopTagOut() { if (rig.isReal && S.tagPhase !== 'idle') rig.respawn(); S.tagPhase = 'idle'; tagFx.stop(); rig.setCrystal?.(false); rig.setVisible?.(true); rig.root.scale.setScalar(1); },
    get tagPhase() { return S.tagPhase; },
    setTrail(spec) { S.trail = spec; },
    resize(w, h, dpr) {
      w = Math.max(2, w | 0); h = Math.max(2, h | 0); S.w = w; S.h = h;
      renderer.setPixelRatio(dpr ?? Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      const pr = renderer.getPixelRatio(); if (!composer) makeComposer(w * pr, h * pr); else { composer.setPixelRatio?.(pr); composer.setSize(w, h); bloom?.setSize(w * pr, h * pr); }
      const sc = h * pr / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); glowFx.setScale(sc); solidFx.setScale(sc);
    },
    /** advance simulation by dt seconds (no render) */
    tick(dt) {
      dt = Math.min(dt, 0.1); S.time += dt;
      const kk = 1 - Math.exp(-dt * 5);
      // yaw control
      S.idleT += dt;
      if (S.dragging) { /* yaw driven by pointer */ }
      else {
        if (S.yawGoal != null) { let d = S.yawGoal - S.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); S.yaw += d * (1 - Math.exp(-dt * 4.5)); if (Math.abs(d) < 0.01) S.yawGoal = S.yawGoal; S.yawVel = 0; }
        else { S.yaw += S.yawVel * dt; S.yawVel *= Math.exp(-dt * 2.6); if (S.turntable && S.idleT > 2.2 && !rig.emote && S.tagPhase === 'idle') S.yaw += dt * 0.42; }
      }
      rig.root.rotation.y = S.yaw; if (rig.setNameVisible) rig.setNameVisible(S.focus === 'name');
      // camera targets
      for (const k of ['y', 'cy', 'fov']) S.cur[k] += (S.target[k] - S.cur[k]) * kk;
      S.cur.dist += (S.target.dist * S.zoom - S.cur.dist) * kk;
      let ty = S.cur.y, tx = 0, tz = 0;
      if (false) { if (!(rig.tagger.focus && rig.tagger.focus(_v))) rig.tagger.group.getWorldPosition(_v); _v.y = _v.y * 0.85 + ty * 0.15; tx = _v.x * 0.9; ty = _v.y; tz = _v.z * 0.9; }
      else if (S.focus === 'charm' && rig.animated?.charm) { rig.animated.charm.item.getWorldPosition(_v); tx = _v.x * 0.8; ty = _v.y * 0.6 + S.cur.y * 0.4; tz = _v.z * 0.8; }
      S.lookAt.x += (tx - S.lookAt.x) * kk; S.lookAt.y += (ty - S.lookAt.y) * kk; S.lookAt.z += (tz - S.lookAt.z) * kk;
      const el = S.cur.cy - S.lookAt.y;
      camera.position.set(S.lookAt.x, S.cur.cy, S.lookAt.z + S.cur.dist);
      camera.lookAt(S.lookAt.x, S.lookAt.y, S.lookAt.z);
      if (Math.abs(camera.fov - S.cur.fov) > 0.01) { camera.fov = S.cur.fov; camera.updateProjectionMatrix(); }
      void el;
      // tag-out timeline
      rig.update(dt);
      const insp = S.focus === 'tagger'; if (insp) syncInspect(); inspect.g.visible = insp && !!inspect.obj; rig.root.visible = !insp; if (insp) { inspect.a += dt; inspect.g.rotation.set(0.12 * Math.sin(S.time * 0.8), S.yaw + Math.PI / 2 * 0 - 1.2, 0.05); inspect.g.position.y = 1.15 + Math.sin(S.time * 1.3) * 0.02; }
      if (S.tagPhase === 'freeze') {
        S.tagT += dt; rig.body.position.y += Math.sin(S.tagT * 40) * 0.002;
        if (S.tagT > 0.55) { S.tagPhase = 'burst'; S.tagT = 0; rig.setCrystal?.(false); rig.setVisible?.(false); tagFx.play(S.tagEffect, S.tagColor, S.spec ? [S.spec.suit.accent, S.spec.suit.base, S.spec.suit.patternColor, S.tagColor, 0xffffff, S.spec.visor.glow] : null, 0, 0); rig.root.getWorldPosition(_v); tagFx.group.rotation.y = 0; glowFx.emit(0, 1, 0, 0, 0, 0, 0.35, 0.3, 4.0, 0xffffff, S.tagColor, SHAPE.ring, 0, 0, 0.9); tagFlash = 1; }
      } else if (S.tagPhase === 'burst') {
        S.tagT += dt; if (!tagFx.playing && S.tagT > 0.4) { S.tagPhase = 'wait'; S.tagT = 0; }
      } else if (S.tagPhase === 'wait') {
        S.tagT += dt; if (S.tagT > 0.55) { S.tagPhase = 'back'; S.tagT = 0; rig.setVisible?.(true); glowFx.emit(0, 0.05, 0, 0, 0, 0, 0.5, 0.4, 3.2, TEAM_COL[S.team], 0xffffff, SHAPE.ring, 0, 0, 0.9); }
      } else if (S.tagPhase === 'back') {
        S.tagT += dt; const u = Math.min(1, S.tagT / 0.45); const s = 0.9 + 0.1 * Math.sin(u * Math.PI * 0.5) + 0.05 * Math.sin(u * Math.PI); rig.root.scale.setScalar(s); if (u >= 1) { S.tagPhase = 'idle'; rig.root.scale.setScalar(1); }
      }
      if (S.tagPhase === 'real') { S.tagT += dt; if (S.tagT > 2.7) { rig.respawn(); S.tagPhase = 'realback'; S.tagT = 0; } } else if (S.tagPhase === 'realback') { S.tagT += dt; if (S.tagT > 0.9) S.tagPhase = 'idle'; }
      tagFx.update(dt);
      // dust
      S.dust -= dt; if (S.dust <= 0) { S.dust = 0.09; glowFx.emit((Math.random() - 0.5) * 4, Math.random() * 3.2, (Math.random() - 0.5) * 3 - 0.3, (Math.random() - 0.5) * 0.06, 0.05 + Math.random() * 0.1, 0, 5 + Math.random() * 3, 0.03 + Math.random() * 0.03, 0.02, mix(TEAM_COL[S.team], 0xffffff, 0.5), TEAM_COL[S.team], SHAPE.glow, 0, 0, 0.5); }
      // trails
      emitTrail(dt);
      glowFx.update(dt); solidFx.update(dt); glowFx.tintPass(); solidFx.tintPass();
      // decor
      ticks.rotation.y += dt * 0.08; ring.material.color.setHex(TEAM_COL[S.team]).multiplyScalar(2.0 + 0.4 * Math.sin(S.time * 1.7));
      floorGlow.material.opacity = 0.5 + 0.08 * Math.sin(S.time * 1.7);
      if (bloom) { bloom.strength += ((tagFlash > 0 ? 1.1 : 0.35) - bloom.strength) * Math.min(1, dt * 8); }
      tagFlash = Math.max(0, tagFlash - dt * 3);
    },
    render() {
      if (!S.w) return;
      if (composer && !S.noBloom) composer.render(); else renderer.render(scene, camera);
    },
    get fxCount() { return glowFx.n + solidFx.n; },
    dispose() {
      rig.dispose?.(); glowFx.dispose(); solidFx.dispose(); for (const r of ribbons) r.dispose(); tagFx.dispose();
      composer?.dispose?.(); pmrem.dispose(); envRT.dispose(); renderer.dispose(); renderer.forceContextLoss?.();
    },
  };
  let tagFlash = 0;
  const yawFwd = { x: 0, z: 1 };
  function emitTrail(dt) {
    const tr = S.trail; if (!S.jog || !tr || tr.type === 'none') { if (!S.jog) for (const r of ribbons) r.reset(); return; }
    const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw); yawFwd.x = fx; yawFwd.z = fz;
    const speed = 4.4; const bx = -fx, bz = -fz;
    rig.backWorld(_v); rig.heelWorld(0, _v2); rig.heelWorld(1, _v3);
    const c1 = tr.color, c2 = tr.color2;
    switch (tr.type) {
      case 'ribbon': {
        ribbons[0].width = 0.07; ribbons[0].update(dt, _v.x, _v.y - 0.05, _v.z, bx, bz, speed * 0.85, true);
        ribbons[1].update(dt, _v.x + Math.cos(S.yaw) * 0.0, _v.y - 0.35, _v.z, bx, bz, speed * 0.85, true); ribbons[1].width = 0.045; break;
      }
      case 'sparks': S.trailAcc += dt * 90; while (S.trailAcc >= 1) { S.trailAcc -= 1; const src = Math.random() < 0.5 ? _v2 : _v3; glowFx.emit(src.x, src.y + 0.03, src.z, bx * (1 + Math.random() * 2.2) + (Math.random() - 0.5), 0.8 + Math.random() * 2.2, bz * (1 + Math.random() * 2.2) + (Math.random() - 0.5), 0.5 + Math.random() * 0.5, 0.07 + Math.random() * 0.05, 0.01, c1, c2, SHAPE.spark, 9, 0.6, 1); } break;
      case 'pixels': S.trailAcc += dt * 70; while (S.trailAcc >= 1) { S.trailAcc -= 1; const yy = 0.15 + Math.random() * 1.5; solidFx.emit(_v.x + (Math.random() - 0.5) * 0.35, yy, _v.z + (Math.random() - 0.5) * 0.25, bx * speed * (0.6 + Math.random() * 0.3), (Math.random() - 0.5) * 0.4, bz * speed * (0.6 + Math.random() * 0.3), 0.9 + Math.random() * 0.5, 0.075, 0.075, Math.random() < 0.5 ? c1 : c2, c2, SHAPE.square, 0, 1.6, 1, 0, 0, 0.03); } break;
      case 'comet': S.trailAcc += dt * 160; while (S.trailAcc >= 1) { S.trailAcc -= 1; const yy = _v.y - 0.1 + (Math.random() - 0.5) * 0.12; glowFx.emit(_v.x, yy, _v.z, bx * speed * 0.9, 0, bz * speed * 0.9, 0.85, 0.16, 0.0, Math.random() < 0.5 ? c2 : c1, c1, SHAPE.glow, 0, 1.4, 0.9); } break;
      case 'petals': S.trailAcc += dt * 40; while (S.trailAcc >= 1) { S.trailAcc -= 1; solidFx.emit(_v.x + (Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 1.1, _v.z + (Math.random() - 0.5) * 0.2, bx * speed * 0.7, 0.2 + Math.random() * 0.4, bz * speed * 0.7, 1.4 + Math.random() * 0.8, 0.11, 0.08, Math.random() < 0.6 ? c1 : c2, c1, SHAPE.petal, 0.3, 1.4, 1, (Math.random() - 0.5) * 7, 2.4); } break;
    }
  }
  api.dispose = api.dispose.bind(api);
  return api;
}
