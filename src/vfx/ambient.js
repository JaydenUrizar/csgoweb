import * as THREE from 'three';

// Ambient floating motes (dust in sun shafts / rising embers). Fully GPU animated and wrapped around the camera:
// zero CPU per frame apart from two uniforms. One draw call.
const VERT = /* glsl */`
attribute vec2 corner;
attribute vec4 aSeed;
uniform float uTime;
uniform vec3 uCam;
uniform vec3 uBox;
uniform vec3 uSun;
uniform vec3 uCol;
uniform float uEmber;
uniform float uIntensity;
varying vec2 vUv;
varying vec4 vCol;
void main() {
  float t = uTime;
  vec3 s = aSeed.xyz;
  vec3 base = s * uBox;
  float ph = aSeed.w * 6.2831;
  vec3 drift = vec3(sin(t * 0.21 + ph) * 0.28, 0.035 + 0.02 * sin(t * 0.4 + ph * 2.0), cos(t * 0.17 + ph * 1.7) * 0.28);
  drift = mix(drift, vec3(sin(t * 0.9 + ph) * 0.35, 0.55 + s.x * 0.4, cos(t * 0.8 + ph * 2.0) * 0.35), uEmber);
  vec3 p = base + drift * t + vec3(sin(t * 0.9 + ph * 3.0), sin(t * 0.7 + ph * 5.0), cos(t * 0.8 + ph * 4.0)) * 0.05;
  p = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
  vec3 wp = p + uCam;
  float d = length(p);
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  float size = mix(0.013, 0.034, fract(aSeed.w * 13.7)) * (1.0 + uEmber * 0.6);
  vec3 toP = normalize(p + 1e-4);
  float sunAlign = pow(max(dot(toP, uSun), 0.0), 2.0);
  float tw = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(t * (1.3 + fract(aSeed.w * 7.0) * 2.5) + ph * 5.0), 3.0);
  float edge = smoothstep(0.6, 2.0, d) * (1.0 - smoothstep(uBox.x * 0.32, uBox.x * 0.5, d));
  float bright = mix(0.12 + 1.5 * sunAlign, 0.9 + 0.5 * sin(t * 12.0 + ph * 9.0), uEmber);
  vCol = vec4(uCol * bright * tw * uIntensity, edge);
  vUv = corner;
  mv.xy += corner * size * max(1.0, d * 0.16);   // slight growth with distance keeps far motes visible
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
varying vec2 vUv;
varying vec4 vCol;
void main() {
  if (vCol.a <= 0.0) discard;
  float r2 = dot(vUv, vUv);
  float a = exp(-r2 * 5.0) * step(r2, 1.0);
  gl_FragColor = vec4(vCol.rgb * a * vCol.a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Ambient {
  constructor(parent, time, maxCount = 320) {
    this.max = maxCount; this.mode = 'dust'; this.enabled = true; this.density = 1;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setAttribute('corner', new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const seed = new Float32Array(maxCount * 4); let a = 12345;
    const r = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
    for (let i = 0; i < seed.length; i++) seed[i] = r();
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 4));
    g.instanceCount = maxCount; this.geometry = g;
    this.uniforms = { uTime: time, uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(26, 12, 26) }, uSun: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() }, uCol: { value: new THREE.Color(1.0, 0.92, 0.75) }, uEmber: { value: 0 }, uIntensity: { value: 1 } };
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(g, this.material); this.mesh.frustumCulled = false; this.mesh.renderOrder = 10; this.mesh.name = 'ambient-motes';
    parent.add(this.mesh);
  }
  set({ mode, density, intensity, enabled } = {}) {
    if (enabled !== undefined) this.enabled = enabled;
    if (mode) { this.mode = mode; this.uniforms.uEmber.value = mode === 'embers' ? 1 : 0; this.uniforms.uCol.value.set(mode === 'embers' ? 0xff8a3a : 0xffe9c2); if (mode === 'embers') this.uniforms.uCol.value.multiplyScalar(2.2); }
    if (density !== undefined) this.density = density;
    if (intensity !== undefined) this.uniforms.uIntensity.value = intensity;
  }
  update(camera, sunDir) {
    this.mesh.visible = this.enabled && this.density > 0;
    this.geometry.instanceCount = Math.round(this.max * Math.min(1, this.density));
    this.uniforms.uCam.value.copy(camera.position);
    if (sunDir) this.uniforms.uSun.value.copy(sunDir);
  }
}
