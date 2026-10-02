import * as THREE from 'three';

// Procedural sky: gradient dome + sun disc + faceted low-poly clouds, and a PMREM environment built from the same dome.
// The dome/clouds are drawn at the far plane (gl_Position.z = w) so they work with any camera near/far and never clip.

export const SKY_DEFAULTS = {
  sunElevation: 44, sunAzimuth: 205,               // degrees; azimuth 0 = +Z toward... (x = sin(az)*cos(el), z = cos(az)*cos(el))
  sunColor: 0xffe0b4, sunIntensity: 5.3,
  skyTop: 0x5a8acb, skyMid: 0x92b4dc, skyHorizon: 0xddd8cd, ground: 0xb79f7c,
  envTop: 0xaeb6c4, envMid: 0xc2c2c0, envHorizon: 0xc9c4b8, envGround: 0x9d8868,   // ambient-only palette: near-neutral warm, slight cool from above
  fogColor: null,                                  // null = derived from skyHorizon
  fogDensity: 0.0020,
  cloudAmount: 1,
};

const DOME_VS = `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * viewMatrix * vec4(position * 10.0 + cameraPosition, 1.0);
  gl_Position = p.xyww;
}`;
const DOME_FS = `
uniform vec3 uTop, uMid, uHorizon, uGround, uSunCol, uSunDir;
uniform float uEnv, uSunSize;
varying vec3 vDir;
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  float t = clamp(h, 0.0, 1.0);
  vec3 sky = mix(uHorizon, uMid, smoothstep(0.0, 0.32, t));
  sky = mix(sky, uTop, smoothstep(0.22, 0.95, t));
  float sd = max(dot(d, uSunDir), 0.0);
  // warm mie-ish glow toward the sun + slight horizon warming on the sun side
  vec3 glow = uSunCol * (pow(sd, 6.0) * 0.16 + pow(sd, 40.0) * 0.30 + pow(sd, 400.0) * 0.6);
  sky += glow * (1.0 - 0.6 * t);
  float sunSide = pow(max(dot(normalize(vec3(d.x, 0.0, d.z) + 1e-4), normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-4)), 0.0), 3.0);
  sky = mix(sky, sky * vec3(1.06, 0.98, 0.86) + uSunCol * 0.06, sunSide * (1.0 - smoothstep(0.0, 0.5, t)));
  // below the horizon: hazy warm ground
  vec3 gnd = mix(uHorizon * 0.96, uGround, smoothstep(0.0, 0.22, -h));
  vec3 col = mix(sky, gnd, smoothstep(0.012, -0.012, h));
  if (uEnv < 0.5) {
    float disc = smoothstep(uSunSize, uSunSize + 0.00012, sd) ;
    col += uSunCol * disc * 30.0;
  }
  col += (ign(gl_FragCoord.xy) - 0.5) * (1.0 / 255.0) * 0.6;   // kill banding
  gl_FragColor = vec4(col, 1.0);
}`;

const CLOUD_VS = `
attribute vec3 color;
uniform float uYaw;
varying vec3 vCol; varying float vElev;
void main(){
  float c = cos(uYaw), s = sin(uYaw);
  vec3 p = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);
  vCol = color; vElev = normalize(p).y;
  vec4 q = projectionMatrix * viewMatrix * vec4(p + cameraPosition, 1.0);
  gl_Position = q.xyww;
}`;
const CLOUD_FS = `
uniform vec3 uHorizon; uniform float uAmt;
varying vec3 vCol; varying float vElev;
void main(){
  float fade = smoothstep(0.015, 0.16, vElev);
  vec3 c = mix(uHorizon, vCol, 0.35 + 0.65 * smoothstep(0.02, 0.35, vElev));
  gl_FragColor = vec4(c, fade * uAmt);
}`;

function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function createSky(renderer) {
  const p = { ...SKY_DEFAULTS };
  const sunDir = new THREE.Vector3(), sunColor = new THREE.Color(), fogColor = new THREE.Color();
  const uni = () => ({
    uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGround: { value: new THREE.Color() },
    uSunCol: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() }, uEnv: { value: 0 }, uSunSize: { value: 0.99985 },
  });
  const domeGeo = new THREE.IcosahedronGeometry(1, 3);
  const mkDome = (env) => { const m = new THREE.ShaderMaterial({ vertexShader: DOME_VS, fragmentShader: DOME_FS, uniforms: uni(), side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false }); m.uniforms.uEnv.value = env; return m; };
  const domeMat = mkDome(0), envMat = mkDome(1);
  const dome = new THREE.Mesh(domeGeo, domeMat); dome.frustumCulled = false; dome.renderOrder = -1000; dome.name = 'skyDome';
  const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(domeGeo, envMat)); envScene.children[0].frustumCulled = false;

  // ---- clouds -----------------------------------------------------------------------------------------------------------------------
  const cloudMat = new THREE.ShaderMaterial({ vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, uniforms: { uHorizon: { value: new THREE.Color() }, uAmt: { value: 1 }, uYaw: { value: 0 } }, transparent: true, depthWrite: false, depthTest: true, fog: false, side: THREE.DoubleSide });
  let clouds = null, cloudBase = null;
  function buildClouds() {
    const r = mulberry(7), tris = [], blob = new THREE.IcosahedronGeometry(1, 1), bp = blob.attributes.position;
    const pos = [], nor = []; const v = new THREE.Vector3(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), t = new THREE.Vector3();
    for (let c = 0; c < 16; c++) {
      const az = r() * Math.PI * 2, el = (7 + r() * 34) * Math.PI / 180, R = 190, cx = Math.sin(az) * Math.cos(el) * R, cy = Math.sin(el) * R, cz = Math.cos(az) * Math.cos(el) * R;
      const size = 9 + r() * 13, nb = 4 + Math.floor(r() * 4), ang = Math.atan2(cx, cz);
      for (let b = 0; b < nb; b++) {
        const k = b - (nb - 1) / 2, sc = size * (0.55 + 0.45 * Math.cos(k / nb * 2.4) + r() * 0.15);
        t.set(cx + Math.cos(ang) * k * size * 0.85, cy + (r() - 0.3) * size * 0.25, cz - Math.sin(ang) * k * size * 0.85);
        s.set(sc, sc * 0.42, sc * 0.75); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang + r() * 0.4); m.compose(t, q, s);
        for (let i = 0; i < bp.count; i += 3) {
          for (let j = 0; j < 3; j++) { v.fromBufferAttribute(bp, i + j).applyMatrix4(m); pos.push(v.x, v.y, v.z); }
        }
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cloudBase = g; recolorClouds(); return g;
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _ctr = new THREE.Vector3();
  function recolorClouds() {
    const g = cloudBase, P = g.attributes.position, n = P.count, col = new Float32Array(n * 3);
    const lit = new THREE.Color(1.0, 0.985, 0.955).lerp(sunColor, 0.25), shade = new THREE.Color(0.42, 0.53, 0.72), mid = new THREE.Color(0.80, 0.87, 0.96), tmp = new THREE.Color();
    for (let i = 0; i < n; i += 3) {
      _a.fromBufferAttribute(P, i); _b.fromBufferAttribute(P, i + 1); _c.fromBufferAttribute(P, i + 2);
      _n.subVectors(_b, _a).cross(_c.clone().sub(_a)).normalize(); _ctr.copy(_a).add(_b).add(_c).multiplyScalar(1 / 3).normalize();
      if (_n.dot(_ctr) < 0) _n.negate();
      const nl = _n.dot(sunDir), up = _n.y;
      const f = THREE.MathUtils.clamp(nl * 0.75 + 0.35, 0, 1), band = f > 0.72 ? 1 : f > 0.42 ? 0.62 : f > 0.2 ? 0.3 : 0;   // stylised 4-step lighting
      tmp.copy(shade).lerp(mid, Math.min(1, band * 1.6)).lerp(lit, Math.max(0, band - 0.5) * 2);
      tmp.multiplyScalar(0.92 + 0.12 * up);
      for (let j = 0; j < 3; j++) { col[(i + j) * 3] = tmp.r; col[(i + j) * 3 + 1] = tmp.g; col[(i + j) * 3 + 2] = tmp.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  function ensureClouds() {
    if (!clouds) { clouds = new THREE.Mesh(buildClouds(), cloudMat); clouds.frustumCulled = false; clouds.renderOrder = -900; clouds.name = 'skyClouds'; }
    else recolorClouds();
    return clouds;
  }

  let envTarget = null, pmrem = null;
  const api = {
    dome, get clouds() { return ensureClouds(); }, params: p, sunDir, sunColor, fogColor, envTexture: null,
    apply() {
      const el = THREE.MathUtils.degToRad(p.sunElevation), az = THREE.MathUtils.degToRad(p.sunAzimuth);
      sunDir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
      sunColor.set(p.sunColor);
      { const u = domeMat.uniforms; u.uTop.value.set(p.skyTop); u.uMid.value.set(p.skyMid); u.uHorizon.value.set(p.skyHorizon); u.uGround.value.set(p.ground); u.uSunCol.value.copy(sunColor); u.uSunDir.value.copy(sunDir); }
      { const u = envMat.uniforms; u.uTop.value.set(p.envTop); u.uMid.value.set(p.envMid); u.uHorizon.value.set(p.envHorizon); u.uGround.value.set(p.envGround); u.uSunCol.value.copy(sunColor).multiplyScalar(0.25); u.uSunDir.value.copy(sunDir); }
      if (p.fogColor != null) fogColor.set(p.fogColor); else fogColor.set(p.skyHorizon).lerp(new THREE.Color(p.skyMid), 0.18);
      cloudMat.uniforms.uHorizon.value.copy(fogColor); cloudMat.uniforms.uAmt.value = p.cloudAmount;
      if (clouds) recolorClouds();
    },
    /** (Re)generate the PMREM environment from the sky dome. Cheap enough to call on sky changes (not every frame). */
    buildEnvironment() {
      pmrem ||= new THREE.PMREMGenerator(renderer);
      const old = envTarget; envTarget = pmrem.fromScene(envScene, 0.02, 0.1, 100); api.envTexture = envTarget.texture; old?.dispose(); return api.envTexture;
    },
    update(camera, dt) {
      dome.position.copy(camera.position); if (clouds) { clouds.position.copy(camera.position); cloudMat.uniforms.uYaw.value += dt * 0.0012; }
    },
  };
  api.apply();
  return api;
}
