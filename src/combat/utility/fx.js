import * as THREE from 'three';
// Self-contained additive effect primitives (billboard flares/rings, spark streaks, pooled flash light). No external assets.
const BB_VERT = /* glsl */`
uniform vec4 uPosSize;   // world xyz, half-size (m)
varying vec2 vUv;
void main(){ vUv = position.xy; vec4 c = viewMatrix * vec4(uPosSize.xyz, 1.0); vec3 vp = c.xyz + vec3(position.xy * uPosSize.w, 0.0); if (c.z > -0.1) { gl_Position = vec4(2.,2.,2.,1.); return; } gl_Position = projectionMatrix * vec4(vp, 1.0); }`;
const BB_FRAG = /* glsl */`
uniform float uT, uKind, uSeed; uniform vec3 uColor; uniform float uAlpha;
varying vec2 vUv;
void main(){
  float r = length(vUv); if (r > 1.0) discard;
  float a;
  if (uKind < 0.5) {               // flare: hot core + soft halo + spikes
    float core = exp(-r * r * 22.0), halo = pow(max(0.0, 1.0 - r), 2.2);
    float ang = atan(vUv.y, vUv.x) + uSeed;
    float spikes = pow(abs(cos(ang * 3.0)), 24.0) * pow(max(0.0, 1.0 - r), 1.6) * 0.9 + pow(abs(cos(ang * 5.0 + 0.6)), 40.0) * pow(max(0.0, 1.0 - r), 2.4) * 0.5;
    a = core * 2.4 + halo * 0.85 + spikes;
  } else if (uKind < 1.5) {        // ring: thin bright leading edge with soft trailing glow
    float w = mix(0.10, 0.03, uT); float d = abs(r - 0.92); a = exp(-d * d / (w * w)) * 1.6 + smoothstep(0.92, 0.35, r) * 0.18 * (1.0 - uT);
    if (r > 0.99) a *= 0.0;
  } else {                         // soft glow
    a = pow(max(0.0, 1.0 - r), 1.6);
  }
  gl_FragColor = vec4(uColor * a * uAlpha, 1.0);
  #include <colorspace_fragment>
}`;
const bbGeo = new THREE.PlaneGeometry(2, 2);
export function makeBillboard(kind) {
  const m = new THREE.ShaderMaterial({ vertexShader: BB_VERT, fragmentShader: BB_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, toneMapped: false,
    uniforms: { uPosSize: { value: new THREE.Vector4() }, uT: { value: 0 }, uKind: { value: kind }, uSeed: { value: 0 }, uColor: { value: new THREE.Color(1, 1, 1) }, uAlpha: { value: 1 } } });
  const mesh = new THREE.Mesh(bbGeo, m); mesh.frustumCulled = false; mesh.renderOrder = 80; mesh.visible = false; mesh.userData.busy = false; return mesh;
}
export const FLARE = 0, RING = 1, GLOW = 2;

// ---- sparks: instanced streaks ------------------------------------------------------------------------------------------
const SP_VERT = /* glsl */`
attribute vec4 iP;     // pos xyz, life01 (1 -> 0)
attribute vec4 iV;     // vel xyz, size
attribute vec3 iC;     // colour
varying float vL; varying vec3 vC; varying float vY;
void main(){
  vL = iP.w; vC = iC; vY = position.y;
  vec4 a = viewMatrix * vec4(iP.xyz, 1.0), b = viewMatrix * vec4(iP.xyz - iV.xyz * 0.045, 1.0);
  if (a.z > -0.1 || iP.w <= 0.0) { gl_Position = vec4(2.,2.,2.,1.); return; }
  vec3 dir = b.xyz - a.xyz; vec3 side = normalize(cross(dir, vec3(0.0, 0.0, 1.0)) + vec3(1e-5, 0.0, 0.0)) * iV.w * 0.5 * mix(1.0, 0.3, position.y);
  vec3 vp = mix(a.xyz, b.xyz, position.y) + side * position.x * 2.0;
  gl_Position = projectionMatrix * vec4(vp, 1.0);
}`;
const SP_FRAG = /* glsl */`varying float vL; varying vec3 vC; varying float vY;
void main(){ float a = smoothstep(0.0, 0.3, vL) * (1.0 - vY * 0.85); gl_FragColor = vec4(vC * a * 2.2, 1.0);
  #include <colorspace_fragment>
}`;
export function createSparks(cap = 384) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3)); geo.setIndex([0, 1, 2, 0, 2, 3]);
  const iP = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), iV = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), iC = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  iP.setUsage(THREE.DynamicDrawUsage); iV.setUsage(THREE.DynamicDrawUsage); iC.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('iP', iP); geo.setAttribute('iV', iV); geo.setAttribute('iC', iC); geo.instanceCount = cap;
  const mat = new THREE.ShaderMaterial({ vertexShader: SP_VERT, fragmentShader: SP_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 81;
  const life = new Float32Array(cap), maxLife = new Float32Array(cap), grav = new Float32Array(cap), drag = new Float32Array(cap); let head = 0, live = 0;
  return {
    mesh,
    emit(x, y, z, vx, vy, vz, life01, size, r, g, b, gravity = 12, dragK = 0.6) {
      const i = head; head = (head + 1) % cap; const p = iP.array, v = iV.array, c = iC.array;
      p[i * 4] = x; p[i * 4 + 1] = y; p[i * 4 + 2] = z; p[i * 4 + 3] = 1; v[i * 4] = vx; v[i * 4 + 1] = vy; v[i * 4 + 2] = vz; v[i * 4 + 3] = size; c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b;
      life[i] = life01; maxLife[i] = life01; grav[i] = gravity; drag[i] = dragK; live++;
    },
    update(dt, world) {
      const p = iP.array, v = iV.array; let any = false;
      for (let i = 0; i < cap; i++) {
        if (life[i] <= 0) continue; life[i] -= dt; any = true;
        if (life[i] <= 0) { p[i * 4 + 3] = 0; continue; }
        v[i * 4 + 1] -= grav[i] * dt; const k = Math.exp(-drag[i] * dt); v[i * 4] *= k; v[i * 4 + 1] *= k; v[i * 4 + 2] *= k;
        p[i * 4] += v[i * 4] * dt; p[i * 4 + 1] += v[i * 4 + 1] * dt; p[i * 4 + 2] += v[i * 4 + 2] * dt; p[i * 4 + 3] = life[i] / maxLife[i];
        if (world && p[i * 4 + 1] < world.floorY(p[i * 4], p[i * 4 + 1], p[i * 4 + 2]) ) { v[i * 4 + 1] *= -0.3; p[i * 4 + 1] += 0.02; }
      }
      iP.needsUpdate = iV.needsUpdate = iC.needsUpdate = true; mesh.visible = any;
    },
  };
}
