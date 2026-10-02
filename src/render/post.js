import * as THREE from 'three';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

// Custom lean post pipeline (no EffectComposer):
//   world (HDR, MSAA optional, depth texture) → SSAO (half res, bilateral blur) → viewmodel (own HDR target, alpha) →
//   bloom (dual-filter chain, threshold on world+viewmodel) → god-rays → composite (AO, bloom, ACES, grade, vignette, grain, CA, screen fx) → FXAA → screen.
// All passes are one fullscreen triangle; all uniforms are preallocated (no per-frame allocation).

const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const SSAO_FS = `
uniform sampler2D tDepth; uniform mat4 uProjInv; uniform float uProj11, uAsp, uRadius, uIntensity, uBias; uniform vec2 uTexel; uniform int uSamples;
varying vec2 vUv;
vec3 vpos(vec2 uv, float d){ vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
vec3 vpos(vec2 uv){ return vpos(uv, texture2D(tDepth, uv).x); }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  float d0 = texture2D(tDepth, vUv).x;
  if (d0 > 0.999999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = vpos(vUv, d0);
  vec3 pr = vpos(vUv + vec2(uTexel.x, 0.0)), pl = vpos(vUv - vec2(uTexel.x, 0.0)), pu = vpos(vUv + vec2(0.0, uTexel.y)), pd = vpos(vUv - vec2(0.0, uTexel.y));
  vec3 dx = abs(pr.z - P.z) < abs(pl.z - P.z) ? pr - P : P - pl;
  vec3 dy = abs(pu.z - P.z) < abs(pd.z - P.z) ? pu - P : P - pd;
  vec3 N = normalize(cross(dx, dy));
  float rot = ign(gl_FragCoord.xy) * 6.2831853;
  float rpx = uRadius * uProj11 * 0.5 / max(0.05, -P.z);            // radius in uv-y units
  rpx = min(rpx, 0.12);
  float occ = 0.0; float fs = float(uSamples);
  for (int i = 0; i < 24; i++) {
    if (i >= uSamples) break;
    float fi = (float(i) + 0.5) / fs, a = float(i) * 2.399963 + rot;
    vec2 off = vec2(cos(a) / uAsp, sin(a)) * rpx * (0.12 + 0.88 * fi);
    vec3 Q = vpos(vUv + off);
    vec3 v = Q - P; float d2 = dot(v, v), dist = sqrt(d2);
    float rc = clamp(2.0 - dist / uRadius, 0.0, 1.0);
    occ += max(0.0, dot(N, v) - uBias * (-P.z * 0.01 + 0.02)) / (d2 + 0.02) * rc;
  }
  float ao = 1.0 - clamp(occ * uRadius / fs * uIntensity, 0.0, 0.7);
  gl_FragColor = vec4(vec3(ao), 1.0);
}`;

const BLUR_FS = `
uniform sampler2D tAO, tDepth; uniform vec2 uDir; uniform float uNear, uFar;
varying vec2 vUv;
float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
void main(){
  float z0 = lin(texture2D(tDepth, vUv).x);
  float sum = texture2D(tAO, vUv).r * 0.2; float ws = 0.2;
  for (int i = -3; i <= 3; i++) {
    if (i == 0) continue;
    vec2 uv = vUv + uDir * float(i);
    float z = lin(texture2D(tDepth, uv).x);
    float w = (0.2 - abs(float(i)) * 0.03) * exp(-abs(z - z0) / (0.05 * z0 + 0.03) );
    sum += texture2D(tAO, uv).r * w; ws += w;
  }
  gl_FragColor = vec4(vec3(sum / ws), 1.0);
}`;

const HDR_SAMPLE = `
uniform sampler2D tWorld, tVM;
vec3 hdrSrc(vec2 uv){ vec4 vm = texture2D(tVM, uv); return texture2D(tWorld, uv).rgb * (1.0 - vm.a) + vm.rgb; }
`;
const PRE_FS = HDR_SAMPLE + `
uniform vec2 uTexel; uniform float uThr, uKnee, uClamp;
varying vec2 vUv;
vec3 thr(vec3 c){ c = min(c, vec3(uClamp)); float br = max(c.r, max(c.g, c.b)); float rq = clamp(br - uThr + uKnee, 0.0, 2.0 * uKnee); rq = rq * rq / (4.0 * uKnee + 1e-4); return c * (max(rq, br - uThr) / max(br, 1e-4)); }
float kw(vec3 c){ return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
void main(){
  vec2 t = uTexel;
  vec3 a = hdrSrc(vUv + t * vec2(-2.0, 2.0)), b = hdrSrc(vUv + t * vec2(0.0, 2.0)), c = hdrSrc(vUv + t * vec2(2.0, 2.0));
  vec3 d = hdrSrc(vUv + t * vec2(-2.0, 0.0)), e = hdrSrc(vUv), f = hdrSrc(vUv + t * vec2(2.0, 0.0));
  vec3 g = hdrSrc(vUv + t * vec2(-2.0, -2.0)), h = hdrSrc(vUv + t * vec2(0.0, -2.0)), i = hdrSrc(vUv + t * vec2(2.0, -2.0));
  vec3 j = hdrSrc(vUv + t * vec2(-1.0, 1.0)), k = hdrSrc(vUv + t * vec2(1.0, 1.0)), l = hdrSrc(vUv + t * vec2(-1.0, -1.0)), m = hdrSrc(vUv + t * vec2(1.0, -1.0));
  vec3 g0 = thr((a + b + d + e) * 0.25), g1 = thr((b + c + e + f) * 0.25), g2 = thr((d + e + g + h) * 0.25), g3 = thr((e + f + h + i) * 0.25), g4 = thr((j + k + l + m) * 0.25);
  float w0 = 0.125 * kw(g0), w1 = 0.125 * kw(g1), w2 = 0.125 * kw(g2), w3 = 0.125 * kw(g3), w4 = 0.5 * kw(g4);
  gl_FragColor = vec4((g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4), 1.0);
}`;
const DOWN_FS = `
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main(){
  vec2 t = uTexel;
  vec3 a = texture2D(tSrc, vUv + t * vec2(-2.0, 2.0)).rgb, b = texture2D(tSrc, vUv + t * vec2(0.0, 2.0)).rgb, c = texture2D(tSrc, vUv + t * vec2(2.0, 2.0)).rgb;
  vec3 d = texture2D(tSrc, vUv + t * vec2(-2.0, 0.0)).rgb, e = texture2D(tSrc, vUv).rgb, f = texture2D(tSrc, vUv + t * vec2(2.0, 0.0)).rgb;
  vec3 g = texture2D(tSrc, vUv + t * vec2(-2.0, -2.0)).rgb, h = texture2D(tSrc, vUv + t * vec2(0.0, -2.0)).rgb, i = texture2D(tSrc, vUv + t * vec2(2.0, -2.0)).rgb;
  vec3 j = texture2D(tSrc, vUv + t * vec2(-1.0, 1.0)).rgb, k = texture2D(tSrc, vUv + t * vec2(1.0, 1.0)).rgb, l = texture2D(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb, m = texture2D(tSrc, vUv + t * vec2(1.0, -1.0)).rgb;
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(o, 1.0);
}`;
const UP_FS = `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uWeight; varying vec2 vUv;
void main(){
  vec2 t = uTexel;
  vec3 o = texture2D(tSrc, vUv).rgb * 4.0;
  o += (texture2D(tSrc, vUv + vec2(-t.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(t.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, -t.y)).rgb + texture2D(tSrc, vUv + vec2(0.0, t.y)).rgb) * 2.0;
  o += texture2D(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + t * vec2(1.0, -1.0)).rgb + texture2D(tSrc, vUv + t * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + t * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(o * (uWeight / 16.0), 1.0);
}`;

const SHAFT_FS = `
uniform sampler2D tWorld, tDepth; uniform vec2 uSunUV; uniform float uAsp;
varying vec2 vUv;
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  vec2 delta = (uSunUV - vUv) / 20.0; vec2 uv = vUv + delta * ign(gl_FragCoord.xy);
  float dist = length((uSunUV - vUv) * vec2(uAsp, 1.0));
  vec3 acc = vec3(0.0); float decay = 1.0;
  for (int i = 0; i < 20; i++) {
    float sky = step(0.99999, texture2D(tDepth, uv).x);
    vec3 c = min(texture2D(tWorld, uv).rgb, vec3(4.0));
    acc += c * sky * decay; decay *= 0.94; uv += delta;
  }
  float fall = exp(-dist * 1.6);
  gl_FragColor = vec4(acc / 20.0 * fall, 1.0);
}`;

const COMP_FS = HDR_SAMPLE + `
uniform sampler2D tAO, tBloom, tShaft;
uniform vec2 uRes; uniform float uTime, uAsp;
uniform float uExposure, uBloom, uAOI, uVig, uGrain, uCA, uContrast, uSat, uBlur, uShaft, uWhite;
uniform vec3 uShadowTint, uHighTint, uBloomTint;
uniform vec4 uFlash, uTint, uDamage;
varying vec2 vUv;
vec3 hdr(vec2 uv){
  vec4 vm = texture2D(tVM, uv);
  vec3 w = texture2D(tWorld, uv).rgb;
  float ao = texture2D(tAO, uv).r; w *= mix(1.0, ao, uAOI);
  vec3 c = w * (1.0 - vm.a) + vm.rgb;
  c += texture2D(tBloom, uv).rgb * uBloomTint * uBloom;
  c += texture2D(tShaft, uv).rgb * uShaft;
  return c;
}
vec3 aces(vec3 v){
  const mat3 IN = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OUT = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  v = IN * (v * uExposure / 0.6);
  vec3 a = v * (v + 0.0245786) - 0.000090537, b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp(OUT * (a / b), 0.0, 1.0);
}
vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec2 uv = vUv, c = uv - 0.5; vec2 ca2 = c * vec2(uAsp, 1.0);
  float r2 = dot(ca2, ca2);
  float ca = uCA * (0.4 + r2 * 2.4) + uDamage.y * 0.003 + uWhite * 0.004;
  vec3 col;
  if (uBlur > 0.002 || ca > 0.0003) {
    vec3 acc = vec3(0.0); float n = 0.0;
    int taps = uBlur > 0.002 ? 10 : 1;
    for (int i = 0; i < 10; i++) {
      if (i >= taps) break;
      float fi = float(i), a = fi * 2.399963;
      vec2 o = (taps > 1) ? (vec2(cos(a), sin(a)) * sqrt((fi + 0.5) / 10.0) * uBlur * 0.018 * vec2(1.0 / uAsp, 1.0) - c * uBlur * 0.10 * (fi / 10.0)) : vec2(0.0);
      vec2 co = c * ca * 2.0;
      acc += vec3(hdr(uv + o + co).r, hdr(uv + o).g, hdr(uv + o - co).b); n += 1.0;
    }
    col = acc / n;
  } else col = hdr(uv);
  col = aces(col);
  col = toSRGB(col);
  // grade (display space): saturation, contrast around a filmic pivot, split-toning
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col = (col - 0.46) * uContrast + 0.46;
  col = col * 0.95 + 0.045;
  col = mix(col, vec3(l), (1.0 - smoothstep(0.0, 0.55, l)) * 0.4);
  col += mix(uShadowTint, uHighTint, smoothstep(0.1, 0.9, l)) * 0.07;
  // vignette
  col *= 1.0 - uVig * smoothstep(0.18, 0.85, r2 * 1.7);
  // damage: directional red edge pulse
  if (uDamage.y > 0.001) {
    vec2 dv = normalize(ca2 + 1e-5); vec2 hd = vec2(sin(uDamage.x), cos(uDamage.x));
    float dirw = 0.10 + 0.9 * pow(max(dot(dv, hd), 0.0), 3.0);
    float edge = smoothstep(0.10, 0.45, r2 * 1.6);
    col = mix(col, vec3(0.95, 0.12, 0.10), clamp(edge * dirw * uDamage.y * 0.6, 0.0, 0.7));
  }
  col = mix(col, uTint.rgb, uTint.a * 0.5 * (0.6 + 0.4 * smoothstep(0.0, 0.6, r2 * 1.8)) );
  col = mix(col, uFlash.rgb, uFlash.a);
  col = mix(col, vec3(1.0, 0.985, 0.95), clamp(uWhite, 0.0, 1.0));
  col += (hash(uv * uRes + fract(uTime) * 61.7) - 0.5) * uGrain + (hash(uv * uRes + 3.1) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createPost(renderer) {
  const triGeo = new THREE.BufferGeometry();
  triGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  triGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const tri = new THREE.Mesh(triGeo); tri.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(tri); const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mk = (fs, uniforms, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false, ...extra });
  const T = (v = null) => ({ value: v }), V2 = () => ({ value: new THREE.Vector2() });

  const blankTex = (r, g, b, a) => { const t = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1); t.needsUpdate = true; return t; };
  const whiteTex = blankTex(255, 255, 255, 255), clearTex = blankTex(0, 0, 0, 0), blackTex = blankTex(0, 0, 0, 255);

  const ssaoMat = mk(SSAO_FS, { tDepth: T(), uProjInv: T(new THREE.Matrix4()), uProj11: T(1), uAsp: T(1), uRadius: T(1.2), uIntensity: T(0.8), uBias: T(0.2), uTexel: V2(), uSamples: T(12) });
  const blurMat = mk(BLUR_FS, { tAO: T(), tDepth: T(), uDir: V2(), uNear: T(0.05), uFar: T(400) });
  const preMat = mk(PRE_FS, { tWorld: T(), tVM: T(), uTexel: V2(), uThr: T(2.0), uKnee: T(0.6), uClamp: T(40) });
  const downMat = mk(DOWN_FS, { tSrc: T(), uTexel: V2() });
  const upMat = mk(UP_FS, { tSrc: T(), uTexel: V2(), uWeight: T(1) }, { blending: THREE.AdditiveBlending, transparent: true });
  const shaftMat = mk(SHAFT_FS, { tWorld: T(), tDepth: T(), uSunUV: V2(), uAsp: T(1) });
  const compMat = mk(COMP_FS, {
    tWorld: T(), tVM: T(clearTex), tAO: T(whiteTex), tBloom: T(blackTex), tShaft: T(blackTex), uRes: V2(), uTime: T(0), uAsp: T(1),
    uExposure: T(1), uBloom: T(0.18), uAOI: T(0.8), uVig: T(0.22), uGrain: T(0.018), uCA: T(0), uContrast: T(1.08), uSat: T(1.1), uBlur: T(0), uShaft: T(0), uWhite: T(0),
    uShadowTint: T(new THREE.Color(0.55, 0.75, 1.0)), uHighTint: T(new THREE.Color(1.0, 0.82, 0.55)), uBloomTint: T(new THREE.Color(1, 0.96, 0.9)),
    uFlash: T(new THREE.Vector4()), uTint: T(new THREE.Vector4()), uDamage: T(new THREE.Vector4()),
  });
  const fxaaMat = mk(FXAAShader.fragmentShader, { tDiffuse: T(), resolution: V2() });

  const HALF = THREE.HalfFloatType;
  const S = { w: 0, h: 0, scale: 1, msaa: 0, ao: false, bloomLevels: 4, shafts: false, fxaa: true, ready: false };
  let worldRT, vmRT, aoRT, aoRT2, ldrRT, shaftRT; const bloomRT = [];
  const dispose = (t) => t?.dispose?.();

  function alloc(w, h, cfg) {
    [worldRT, vmRT, aoRT, aoRT2, ldrRT, shaftRT, ...bloomRT].forEach(dispose); bloomRT.length = 0;
    const lin = { magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, generateMipmaps: false };
    const dt = new THREE.DepthTexture(w, h); dt.type = THREE.UnsignedIntType;
    worldRT = new THREE.WebGLRenderTarget(w, h, { type: HALF, depthBuffer: true, depthTexture: dt, samples: cfg.msaa, ...lin });
    vmRT = new THREE.WebGLRenderTarget(w, h, { type: HALF, depthBuffer: true, samples: cfg.msaa, ...lin });
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    if (cfg.ssao) { aoRT = new THREE.WebGLRenderTarget(hw, hh, { type: THREE.UnsignedByteType, depthBuffer: false, ...lin }); aoRT2 = new THREE.WebGLRenderTarget(hw, hh, { type: THREE.UnsignedByteType, depthBuffer: false, ...lin }); } else aoRT = aoRT2 = null;
    let bw = w, bh = h;
    for (let i = 0; i < cfg.bloomLevels; i++) { bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1); bloomRT.push(new THREE.WebGLRenderTarget(bw, bh, { type: HALF, depthBuffer: false, ...lin })); }
    shaftRT = cfg.shafts ? new THREE.WebGLRenderTarget(Math.max(1, w >> 2), Math.max(1, h >> 2), { type: HALF, depthBuffer: false, ...lin }) : null;
    ldrRT = cfg.fxaa ? new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false, ...lin }) : null;
  }
  function configure(canvasW, canvasH, cfg) {
    const w = Math.max(2, Math.round(canvasW * cfg.scale)), h = Math.max(2, Math.round(canvasH * cfg.scale));
    Object.assign(S, cfg, { w, h }); alloc(w, h, cfg); S.ready = true;
    compMat.uniforms.uRes.value.set(w, h); compMat.uniforms.uAsp.value = w / h;
    ssaoMat.uniforms.uSamples.value = cfg.ssaoSamples || 12;
  }

  function pass(mat, target, blend = false) { tri.material = mat; renderer.setRenderTarget(target); renderer.render(qScene, qCam); }
  const size2 = new THREE.Vector2();

  function post(scene, camera, viewScene, viewCamera, hasVM, stats) {
    const pr = renderer.getPixelRatio(); void pr;
    renderer.autoClear = false;
    const info = renderer.info;
    // world
    renderer.setRenderTarget(worldRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); renderer.render(scene, camera);
    stats.sceneCalls = info.render.calls; stats.sceneTris = info.render.triangles;
    // ssao
    let aoTex = whiteTex;
    if (S.ssao && aoRT) {
      const u = ssaoMat.uniforms; u.tDepth.value = worldRT.depthTexture; u.uProjInv.value.copy(camera.projectionMatrixInverse); u.uProj11.value = camera.projectionMatrix.elements[5]; u.uAsp.value = S.w / S.h;
      u.uTexel.value.set(1 / S.w, 1 / S.h);
      pass(ssaoMat, aoRT);
      const b = blurMat.uniforms; b.tDepth.value = worldRT.depthTexture; b.uNear.value = camera.near; b.uFar.value = camera.far;
      b.tAO.value = aoRT.texture; b.uDir.value.set(1 / aoRT.width, 0); pass(blurMat, aoRT2);
      b.tAO.value = aoRT2.texture; b.uDir.value.set(0, 1 / aoRT.height); pass(blurMat, aoRT);
      aoTex = aoRT.texture;
    }
    // viewmodel
    let vmTex = clearTex;
    if (hasVM) {
      renderer.setRenderTarget(vmRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, true); renderer.render(viewScene, viewCamera); vmTex = vmRT.texture;
    }
    stats.calls = info.render.calls; stats.tris = info.render.triangles;
    // bloom
    const nb = bloomRT.length;
    if (nb) {
      const pu = preMat.uniforms; pu.tWorld.value = worldRT.texture; pu.tVM.value = vmTex; pu.uTexel.value.set(1 / S.w, 1 / S.h);
      pass(preMat, bloomRT[0]);
      for (let i = 1; i < nb; i++) { const d = downMat.uniforms; d.tSrc.value = bloomRT[i - 1].texture; d.uTexel.value.set(1 / bloomRT[i - 1].width, 1 / bloomRT[i - 1].height); pass(downMat, bloomRT[i]); }
      for (let i = nb - 2; i >= 0; i--) { const d = upMat.uniforms; d.tSrc.value = bloomRT[i + 1].texture; d.uTexel.value.set(1 / bloomRT[i + 1].width, 1 / bloomRT[i + 1].height); d.uWeight.value = 1.0; pass(upMat, bloomRT[i]); }
    }
    // god rays
    let shaftTex = blackTex;
    if (shaftRT && stats.sunVis > 0.02) {
      const u = shaftMat.uniforms; u.tWorld.value = worldRT.texture; u.tDepth.value = worldRT.depthTexture; u.uSunUV.value.copy(stats.sunUV); u.uAsp.value = S.w / S.h;
      pass(shaftMat, shaftRT); shaftTex = shaftRT.texture;
    }
    // composite
    const cu = compMat.uniforms; cu.tWorld.value = worldRT.texture; cu.tVM.value = vmTex; cu.tAO.value = aoTex; cu.tBloom.value = nb ? bloomRT[0].texture : blackTex; cu.tShaft.value = shaftTex;
    cu.uShaft.value = shaftTex === blackTex ? 0 : stats.shaftI * stats.sunVis;
    if (ldrRT) {
      pass(compMat, ldrRT);
      fxaaMat.uniforms.tDiffuse.value = ldrRT.texture; fxaaMat.uniforms.resolution.value.set(1 / S.w, 1 / S.h);
      pass(fxaaMat, null);
    } else pass(compMat, null);
    renderer.setRenderTarget(null); renderer.autoClear = true;
  }

  return { S, uniforms: compMat.uniforms, bloomUniforms: preMat.uniforms, ssaoUniforms: ssaoMat.uniforms, configure, render: post, get worldRT() { return worldRT; }, get aoRT() { return aoRT; }, whiteTex,
    dispose() { [worldRT, vmRT, aoRT, aoRT2, ldrRT, shaftRT, ...bloomRT].forEach(dispose); } };
}
