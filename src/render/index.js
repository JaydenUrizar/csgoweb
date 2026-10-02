import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { createSky } from './sky.js';
import { createPost } from './post.js';
import { bakeVertexAO, bakeVertexAOAsync } from './ao.js';
import { registerScenes } from './scenes.js';
import { createSkyOcc } from './skyocc.js';
import { LAYER } from '../core/config.js';

// Rendering, lighting & post-FX. Owner: render piece. Contract: docs/ARCHITECTURE.md + docs/pieces/render.md.

const PRESETS = {
  low:    { pr: 1.0,  scale: 0.85, shadow: 1024, R: 26, msaa: 0, ssao: false, ssaoSamples: 0,  bloomLevels: 3, shafts: false, fxaa: true, grain: 0.0,   caBase: 0 },
  medium: { pr: 1.25, scale: 1.0,  shadow: 2048, R: 30, msaa: 0, ssao: false, ssaoSamples: 0,  bloomLevels: 4, shafts: false, fxaa: true, grain: 0.010, caBase: 0 },
  high:   { pr: 1.5,  scale: 1.0,  shadow: 3072, R: 36, msaa: 4, ssao: true,  ssaoSamples: 12, bloomLevels: 5, shafts: true,  fxaa: true, grain: 0.014, caBase: 0.0006 },
  ultra:  { pr: 2.0,  scale: 1.0,  shadow: 4096, R: 40, msaa: 4, ssao: true,  ssaoSamples: 20, bloomLevels: 5, shafts: true,  fxaa: true, grain: 0.016, caBase: 0.0010 },
};

export function create(ctx) {
  const app = document.getElementById('app');
  const test = !!ctx.params.get('test');
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!ctx.params.get('preserve') || test });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;               // tone mapping / grading happen in our composite pass
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(100, 1, 0.05, 400);
  camera.layers.enable(LAYER.ACTOR); camera.layers.enable(LAYER.FX);
  const viewScene = new THREE.Scene();
  const viewCamera = new THREE.PerspectiveCamera(68, 1, 0.01, 10);

  // ---- sky / environment / fog / lights ------------------------------------------------------------------------------------------
  const skyOcc = createSkyOcc(); THREE.Material.prototype.onBeforeCompile = skyOcc.hook;   // global ambient-occlusion hook for every lit material
  const sky = createSky(renderer);
  scene.add(sky.dome); scene.add(sky.clouds);
  scene.fog = new THREE.FogExp2(0xcfe0ee, sky.params.fogDensity);

  const sun = new THREE.DirectionalLight(0xffe7c2, 3.6); sun.castShadow = true; scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.0);        // cool sky fill from the shaded side
  const hemi = new THREE.HemisphereLight(0xd2d4d8, 0xb08d62, 0.16); scene.add(hemi);                        // sky / warm bounce
  const sunDir = sky.sunDir;

  // viewmodel lighting (rotated into camera space every frame so the gun is lit like the world)
  const vKey = new THREE.DirectionalLight(0xfff0d6, 1.5), vRim = new THREE.DirectionalLight(0x9cc8ff, 0.9), vHemi = new THREE.HemisphereLight(0xdfeaff, 0x8a7358, 0.38);
  viewScene.add(vKey, vKey.target, vRim, vRim.target, vHemi);

  const materials = createMaterials(renderer, skyOcc.hook);
  const post = createPost(renderer);

  // ---- state ----------------------------------------------------------------------------------------------------------------------
  let quality = 'high', preset = PRESETS.high, canvasW = 2, canvasH = 2;
  const dyn = { enabled: !test, scale: 1, over: 0, under: 0, ema: 1 / 60, last: 0 };
  const cfg = { scale: 1 };
  const fx = {
    flash: { color: new THREE.Color(1, 1, 1), amount: 0, decay: 3 },
    blur: { value: 0, hold: 0 }, tint: { color: new THREE.Color(1, 0, 0), amount: 0, hold: 0 },
    damage: { dir: 0, amount: 0 }, white: { hold: 0, level: 0 },
    shake: { trauma: 0, decay: 6, t: 0 },
    exposure: 0.97, bloom: 0.08, ao: 1.0, vignette: 0.10, grain: 1, ca: 1, contrast: 1.12, saturation: 0.80,
    toggles: { skyocc: true, bloom: true, ssao: true, grain: true, vignette: true, shadows: true, fxaa: true, shafts: true },
  };
  const stats = { beforeVM: () => { skyOcc.U.uSkyOccOn.value = 0; }, afterVM: () => { skyOcc.U.uSkyOccOn.value = skyOcc.state.done && fx.toggles.skyocc ? 1 : 0; }, sceneCalls: 0, sceneTris: 0, calls: 0, tris: 0, sunVis: 0, sunUV: new THREE.Vector2(0.5, 0.5), shaftI: 0.08 };
  const infoObj = { calls: 0, triangles: 0, points: 0, lines: 0, geometries: 0, textures: 0, postCalls: 0, quality, scale: 1, fps: 60, width: 0, height: 0, shadowMap: 0 };
  let followTarget = null, viewHasContent = false, hasFollow = false;

  // ---- sky / lighting configuration ----------------------------------------------------------------------------------------------
  const _c = new THREE.Color();
  function applySky() {
    const p = sky.params; sky.apply();
    sun.color.copy(sky.sunColor); sun.intensity = p.sunIntensity;
    // fill from the opposite side, cool
    hemi.color.set(p.envTop).lerp(_c.set(0xffffff), 0.2); hemi.groundColor.set(p.envGround);
    scene.fog.color.copy(sky.fogColor); scene.fog.density = p.fogDensity;
    vKey.color.copy(sky.sunColor).lerp(_c.set(0xffffff), 0.3);
    const env = sky.buildEnvironment(); scene.environment = env; viewScene.environment = env;
    scene.environmentIntensity = 0.6; viewScene.environmentIntensity = 0.5;
  }
  function setSky(o = {}) { Object.assign(sky.params, o); applySky(); }

  function applyQuality(name) {
    const p = PRESETS[name] || PRESETS.high; quality = PRESETS[name] ? name : 'high'; preset = p; infoObj.quality = quality;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, p.pr));
    sun.shadow.mapSize.set(p.shadow, p.shadow);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    const R = p.R; const c = sun.shadow.camera; c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 1; c.far = 200; c.updateProjectionMatrix();
    const texel = (2 * R) / p.shadow; sun.shadow.bias = -0.00025; sun.shadow.normalBias = Math.max(0.03, texel * 1.7); sun.shadow.radius = 1.1; sun.shadow.blurSamples = 8;
    sun.userData.texel = texel; sun.userData.R = R;
    resize();
  }
  function resize() {
    const w = app.clientWidth || innerWidth, h = app.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    const sz = renderer.getDrawingBufferSize(_sz); canvasW = sz.x; canvasH = sz.y;
    camera.aspect = w / h; camera.updateProjectionMatrix(); viewCamera.aspect = w / h; viewCamera.updateProjectionMatrix();
    reconfigure();
  }
  const _sz = new THREE.Vector2();
  function reconfigure() {
    const p = preset; cfg.scale = p.scale * dyn.scale;
    post.configure(canvasW, canvasH, { scale: cfg.scale, msaa: Math.min(p.msaa, renderer.capabilities.maxSamples | 0), ssao: p.ssao, ssaoSamples: p.ssaoSamples, bloomLevels: p.bloomLevels, shafts: p.shafts, fxaa: p.fxaa });
    infoObj.width = post.S.w; infoObj.height = post.S.h; infoObj.scale = cfg.scale;
  }

  // ---- screen effects -------------------------------------------------------------------------------------------------------------
  const screen = {
    flash(color = 0xffffff, amount = 1, decay = 3) { fx.flash.color.set(color); fx.flash.amount = Math.max(fx.flash.amount, Math.min(1, amount)); fx.flash.decay = decay; },
    blur(amount = 0) { if (amount <= 0) { fx.blur.value = 0; fx.blur.hold = 0; } else { fx.blur.value = Math.min(1, amount); fx.blur.hold = 0.12; } },
    tint(color = 0xff2030, amount = 0) { if (amount <= 0) { fx.tint.amount = 0; fx.tint.hold = 0; } else { fx.tint.color.set(color); fx.tint.amount = Math.min(1, amount); fx.tint.hold = 0.15; } },
    damage(dirRad = 0, amount = 0.3) { fx.damage.dir = dirRad; fx.damage.amount = Math.min(1, Math.max(fx.damage.amount, amount)); },
    whiteout(t = 1) { fx.white.hold = Math.max(fx.white.hold, t); fx.white.level = 1; },
    clear() { fx.flash.amount = 0; fx.blur.value = fx.blur.hold = 0; fx.tint.amount = fx.tint.hold = 0; fx.damage.amount = 0; fx.white.hold = fx.white.level = 0; fx.shake.trauma = 0; },
  };

  // ---- shadow frustum follow (texel-snapped: zero shimmer) -------------------------------------------------------------------------
  const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _ctr = new THREE.Vector3(), _f = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function updateSun() {
    const R = sun.userData.R, texel = sun.userData.texel;
    const src = hasFollow ? followTarget : camera.position;
    _ctr.copy(src);
    if (!hasFollow) { _f.set(0, 0, -1).applyQuaternion(camera.quaternion); _f.y = 0; if (_f.lengthSq() > 1e-4) { _f.normalize(); _ctr.addScaledVector(_f, R * 0.32); } }
    _ctr.y = Math.max(0, _ctr.y - 1.6);
    _x.crossVectors(_up, sunDir).normalize(); _y.crossVectors(sunDir, _x);
    const cx = _ctr.dot(_x), cy = _ctr.dot(_y), sx = Math.round(cx / texel) * texel, sy = Math.round(cy / texel) * texel;
    _ctr.addScaledVector(_x, sx - cx).addScaledVector(_y, sy - cy);
    sun.target.position.copy(_ctr); sun.position.copy(_ctr).addScaledVector(sunDir, 100);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
    // fill light from the shaded side, no shadows
  }

  // ---- shake ---------------------------------------------------------------------------------------------------------------------
  const _qs = new THREE.Quaternion(), _es = new THREE.Euler(), _savedQ = new THREE.Quaternion(), _savedP = new THREE.Vector3();
  let shaking = false;
  function applyShake() {
    shaking = false;
    const s = fx.shake, k = ctx.settings?.get?.('screenShake') ?? 1;
    if (s.trauma <= 0.001 || k <= 0) return;
    const a = s.trauma * s.trauma * k, t = s.t;
    _es.set((Math.sin(t * 43.1) + Math.sin(t * 27.7 + 1.3) * 0.5) * 0.020 * a, (Math.sin(t * 37.3 + 2.1) + Math.sin(t * 22.9) * 0.5) * 0.020 * a, Math.sin(t * 31.7 + 0.7) * 0.030 * a, 'YXZ');
    _savedQ.copy(camera.quaternion); _savedP.copy(camera.position); shaking = true;
    camera.quaternion.multiply(_qs.setFromEuler(_es));
    camera.position.y += Math.sin(t * 53.0) * 0.012 * a;
  }
  function endShake() { if (!shaking) return; camera.quaternion.copy(_savedQ); camera.position.copy(_savedP); camera.updateMatrixWorld(true); shaking = false; }

  // ---- per-frame update (effect decay, uniform upload) ---------------------------------------------------------------------------
  const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  let time = 0;
  function update(dt) {
    time += dt; materials.time.value = time;
    const f = fx;
    f.flash.amount = Math.max(0, f.flash.amount - f.flash.decay * dt);
    if (f.blur.hold > 0) f.blur.hold -= dt; else f.blur.value = Math.max(0, f.blur.value - 5 * dt);
    if (f.tint.hold > 0) f.tint.hold -= dt; else f.tint.amount = Math.max(0, f.tint.amount - 3 * dt);
    f.damage.amount = Math.max(0, f.damage.amount - 2.4 * dt);
    if (f.white.hold > 0) f.white.hold -= dt; else f.white.level = Math.max(0, f.white.level - dt / 2.4);
    f.shake.trauma = Math.max(0, f.shake.trauma - f.shake.decay * dt * 0.25 - dt * 0.05); f.shake.t += dt;
    sky.update(camera, dt);
    if (!skyOcc.state.done) {
      if (!skyOcc.state.job && ctx.map?.raycast && ctx.map.bounds && ctx.map.heightAt) skyOcc.begin(ctx.map);
      skyOcc.state.job?.run(ctx.manualStepping ? 1e9 : 5);
    }
  }

  const api = {
    renderer, scene, camera, viewScene, viewCamera, sun, fill, hemi, sky: sky.dome, skyModule: sky, sunDir, materials, screen, quality,
    layers: { world: LAYER.WORLD, actor: LAYER.ACTOR, fx: LAYER.FX, viewmodel: LAYER.VIEWMODEL },
    update,
    resize, setSky, setTimeOfDay: setSky,
    setQuality(q) { applyQuality(q); api.quality = quality; },
    setViewmodelFov(deg) { viewCamera.fov = deg; viewCamera.updateProjectionMatrix(); },
    setFov(deg) { camera.fov = deg; camera.updateProjectionMatrix(); },
    shake(amount = 0.3, decay = 6) { fx.shake.trauma = Math.min(1, fx.shake.trauma + amount); fx.shake.decay = decay; },
    follow(pos) { if (pos) { followTarget = pos; hasFollow = true; } else hasFollow = false; },
    bakeVertexAO, bakeVertexAOAsync,
    addPostPass() { /* reserved: custom passes are not supported by the lean pipeline; use ctx.render.screen.* */ },
    info() {
      const i = renderer.info;
      infoObj.calls = stats.calls; infoObj.triangles = stats.tris; infoObj.points = i.render.points; infoObj.lines = i.render.lines;
      infoObj.geometries = i.memory.geometries; infoObj.textures = i.memory.textures; infoObj.postCalls = Math.max(0, i.render.calls - stats.calls);
      infoObj.fps = 1 / dyn.ema; infoObj.scale = cfg.scale; infoObj.shadowMap = preset.shadow; return infoObj;
    },
    render() {
      const now = performance.now();
      // dynamic resolution (never in ?test mode)
      if (dyn.enabled && dyn.last) {
        const dt = (now - dyn.last) / 1000; if (dt < 0.25) dyn.ema += (dt - dyn.ema) * 0.08;
        if (dyn.ema > 1 / 48) { if (++dyn.over > 90) { dyn.over = 0; setDyn(dyn.scale - 0.1); } } else dyn.over = 0;
        if (dyn.ema < 1 / 66) { if (++dyn.under > 360) { dyn.under = 0; setDyn(dyn.scale + 0.1); } } else dyn.under = 0;
      }
      dyn.last = now;
      // uniforms
      const u = post.uniforms, t = fx.toggles;
      u.uExposure.value = fx.exposure; u.uBloom.value = t.bloom ? fx.bloom : 0; u.uAOI.value = t.ssao ? fx.ao : 0;
      u.uVig.value = t.vignette ? fx.vignette : 0; u.uContrast.value = fx.contrast; u.uSat.value = fx.saturation;
      const dm = fx.damage.amount, wl = fx.white.level, fl = fx.flash.amount;
      u.uGrain.value = t.grain ? preset.grain * fx.grain * (1 + dm * 1.5) + wl * 0.02 : 0; u.uCA.value = preset.caBase * fx.ca + dm * 0.0008;
      u.uBlur.value = fx.blur.value; u.uWhite.value = wl; u.uTime.value = time;
      u.uFlash.value.set(fx.flash.color.r, fx.flash.color.g, fx.flash.color.b, fl);
      // flash/tint colours are display-space: convert linear working colour back to sRGB-ish
      u.uFlash.value.x = Math.pow(fx.flash.color.r, 1 / 2.2); u.uFlash.value.y = Math.pow(fx.flash.color.g, 1 / 2.2); u.uFlash.value.z = Math.pow(fx.flash.color.b, 1 / 2.2);
      u.uTint.value.set(Math.pow(fx.tint.color.r, 1 / 2.2), Math.pow(fx.tint.color.g, 1 / 2.2), Math.pow(fx.tint.color.b, 1 / 2.2), fx.tint.amount);
      u.uDamage.value.set(fx.damage.dir, dm, 0, 0);
      // sun shadow frustum & camera-space viewmodel lighting
      sun.castShadow = t.shadows; updateSun();
      camera.updateMatrixWorld();
      _f.set(0, 0, -1).applyQuaternion(camera.quaternion); const sd = _f.dot(sunDir);
      stats.sunVis = t.shafts && preset.shafts ? THREE.MathUtils.clamp((sd - 0.12) / 0.5, 0, 1) : 0;
      if (stats.sunVis > 0) { _v.copy(sunDir).multiplyScalar(100).add(camera.position).project(camera); stats.sunUV.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5); }
      _q.copy(camera.quaternion).invert();
      _v.copy(sunDir).applyQuaternion(_q); vKey.position.copy(_v).multiplyScalar(5);
      _v.set(-sunDir.x, 0.4, -sunDir.z).normalize().applyQuaternion(_q); vRim.position.copy(_v).multiplyScalar(5);
      viewScene.environmentRotation.setFromQuaternion(camera.quaternion);
      viewHasContent = false; for (let i = 0; i < viewScene.children.length; i++) { const c = viewScene.children[i]; if (c.visible && !c.isLight) { viewHasContent = true; break; } }
      applyShake();
      camera.updateMatrixWorld();
      renderer.info.reset();
      post.render(scene, camera, viewScene, viewCamera, viewHasContent, stats);
      endShake();
    },
    debug: {
      fx, stats, presets: PRESETS, post,
      screens() { return { flash: fx.flash.amount, blur: fx.blur.value, tint: fx.tint.amount, damage: fx.damage.amount, whiteout: fx.white.level, shake: fx.shake.trauma }; },
      setExposure(x) { fx.exposure = x; },
      setSunAngle(el, az) { setSky({ sunElevation: el, sunAzimuth: az }); },
      toggle(name, on) { if (name in fx.toggles) fx.toggles[name] = !!on; if (name === 'skyocc') skyOcc.U.uSkyOccOn.value = on && skyOcc.state.done ? 1 : 0; },
      skyOcc,
      stats() { return { ...stats, ...api.info(), dynScale: dyn.scale }; },
      setDynamic(on) { dyn.enabled = !!on; },
    },
  };
  function setDyn(s) { s = Math.max(0.5, Math.min(1, s)); if (Math.abs(s - dyn.scale) < 0.01) return; dyn.scale = s; reconfigure(); }

  ctx.events.on('settings:change', ({ key, value }) => {
    if (key === 'quality') api.setQuality(value);
    else if (key === 'viewmodel') api.setViewmodelFov(value?.fov ?? 68);
  });
  addEventListener('resize', resize);

  applySky();
  const q0 = ctx.params.get('q') || ctx.settings?.get?.('quality') || 'high';
  applyQuality(q0); api.quality = quality; api.setViewmodelFov(ctx.settings?.get?.('viewmodel')?.fov ?? 68);
  registerScenes(ctx, api);
  return api;
}
