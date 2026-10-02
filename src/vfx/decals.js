import * as THREE from 'three';
import { QuadPool } from './pool.js';

// Surface-aligned quads: impact decals (energy ring + fading scuff), pulse shock rings, beacon rings, glass ripples, ground glows.
//   aPos  x y z birth        aNrm  nx ny nz life        aParm size0 size1 kind seed
//   aCol  r g b a  (ring / glow colour, HDR)             aCol2 r g b a (scuff / body colour)
export const DECAL = { IMPACT: 0, PULSE: 1, BEACON: 2, RIPPLE: 3, GLOW: 4, WATER: 5, SCORCH: 6 };

const VERT = /* glsl */`
attribute vec2 corner;
attribute vec4 aPos, aNrm, aParm, aCol, aCol2;
uniform float uTime;
varying vec2 vUv;
varying vec4 vCol, vCol2, vInfo;   // vInfo: age, t, kind, seed
varying float vSize;
void main() {
  float age = uTime - aPos.w;
  float t = age / aNrm.w;
  if (age < 0.0 || t >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vUv = vec2(0.0); vCol = vCol2 = vInfo = vec4(0.0); vSize = 0.0; return; }
  vec3 n = normalize(aNrm.xyz);
  vec3 up = abs(n.y) > 0.98 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 tx = normalize(cross(up, n)); vec3 ty = cross(n, tx);
  float kind = aParm.z;
  float e = 1.0 - (1.0 - min(t, 1.0)) * (1.0 - min(t, 1.0));
  float size = aParm.x;
  if (kind == 1.0 || kind == 2.0 || kind == 5.0) size = mix(aParm.x, aParm.y, 1.0 - (1.0 - t) * (1.0 - t) * (1.0 - t));
  else if (kind == 3.0) size = mix(aParm.x, aParm.y, 1.0 - (1.0 - t) * (1.0 - t));
  else size = aParm.x;
  float rot = aParm.w * 6.2831;
  float c = cos(rot), s = sin(rot);
  vec2 q = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y);
  vec3 wp = aPos.xyz + n * 0.015 + (tx * q.x + ty * q.y) * size;
  vUv = corner; vCol = aCol; vCol2 = aCol2; vInfo = vec4(age, t, kind, aParm.w); vSize = size;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;

const FRAG = /* glsl */`
varying vec2 vUv;
varying vec4 vCol, vCol2, vInfo;
varying float vSize;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float kind = vInfo.z; float t = vInfo.y; float age = vInfo.x;
  float r = length(vUv);
  if (r > 1.0) discard;
  vec3 glow = vec3(0.0); float body = 0.0; vec3 bodyCol = vCol2.rgb;
  if (kind < 0.5) {                                   // IMPACT: expanding energy ring + hot dot + lingering scuff
    float rt = clamp(age / 0.3, 0.0, 1.0);
    float rad = mix(0.3, 1.0, 1.0 - (1.0 - rt) * (1.0 - rt));
    float ring = exp(-pow((r - rad * 0.9) * mix(8.0, 14.0, rt), 2.0)) * (1.0 - rt) * (1.0 - rt);
    float dotg = exp(-r * r * 36.0) * (1.0 - smoothstep(0.0, 0.6, age)) * 1.8;
    glow = vCol.rgb * (ring * vCol.a * 1.1 + dotg * vCol.a * 0.8);
    float n = vnoise(vUv * 6.0 + vInfo.w * 40.0);
    float hole = 1.0 - smoothstep(0.13, 0.24 + 0.04 * n, r);               // crisp dark bullet hole
    float halo = (1.0 - smoothstep(0.1, 0.65 + 0.2 * n, r)) * 0.55;         // scorch / scuff
    float fadeOut = 1.0 - smoothstep(0.7, 1.0, t);
    body = clamp(hole * 0.95 + halo, 0.0, 1.0) * vCol2.a * fadeOut;
    bodyCol = mix(vCol2.rgb, vCol2.rgb * 0.15, hole);
    float ember = exp(-r * r * 40.0) * (1.0 - smoothstep(0.0, 0.3, age)) * 0.5;   // cooling core
    glow += vCol.rgb * ember * vCol.a;
  } else if (kind < 1.5) {                            // PULSE: thick shock ring + inner disc wash
    float w = mix(0.22, 0.05, t);
    float ring = exp(-pow((r - (0.96 - w * 0.5)) / w, 2.0));
    float wash = (1.0 - smoothstep(0.0, 1.0, r)) * 0.22 * (1.0 - t);
    float fade = 1.0 - smoothstep(0.55, 1.0, t);
    glow = vCol.rgb * (ring * 1.5 + wash) * vCol.a * fade;
    body = 0.0;
  } else if (kind < 2.5) {                            // BEACON: thin ring, fades outward, faint hex-ish dashes
    float ring = exp(-pow((r - 0.94) * 30.0, 2.0));
    float ang = atan(vUv.y, vUv.x);
    float dash = 0.55 + 0.45 * step(0.0, sin(ang * 24.0 + t * 6.0));
    float fade = (1.0 - t) * smoothstep(0.0, 0.08, t);
    float inner = (1.0 - smoothstep(0.0, 1.0, r)) * 0.1;
    glow = vCol.rgb * (ring * dash * 1.5 + inner) * vCol.a * fade;
  } else if (kind < 3.5) {                            // RIPPLE: 2 concentric thin rings (glass / water)
    float fade = (1.0 - t) * (1.0 - t);
    float r1 = exp(-pow((r - 0.95) * 14.0, 2.0)), r2 = exp(-pow((r - 0.6) * 16.0, 2.0)) * smoothstep(0.1, 0.5, t) * 0.7;
    glow = vCol.rgb * (r1 + r2) * fade * vCol.a * 1.3;
  } else if (kind < 4.5) {                            // GLOW: soft ground disc
    float fade = smoothstep(0.0, 0.1, t) * (1.0 - t);
    glow = vCol.rgb * exp(-r * r * 4.0) * fade * vCol.a;
  } else if (kind < 5.5) {                            // WATER: thin white ripple
    float rr = exp(-pow((r - 0.9) * 10.0, 2.0)) * (1.0 - t);
    glow = vCol.rgb * rr * vCol.a * 0.8; body = rr * 0.15 * vCol2.a;
  } else {                                            // SCORCH: soft dark blotch (footprints / landing scuff)
    float n = vnoise(vUv * 4.0 + vInfo.w * 30.0);
    body = (1.0 - smoothstep(0.1, 0.8 + 0.2 * n, r)) * vCol2.a * (1.0 - smoothstep(0.5, 1.0, t));
  }
  float a = clamp(body, 0.0, 1.0);
  gl_FragColor = vec4(bodyCol * a + glow, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Decals {
  constructor(parent, max, time, opts) {
    this.uniforms = { uTime: time };
    this.pool = new QuadPool(parent, max, ['aPos', 'aNrm', 'aParm', 'aCol', 'aCol2'], VERT, FRAG, this.uniforms,
      { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, opts);
    this.pool.clear();
  }
  /** r,g,b,a: glow colour; r2,g2,b2,a2: body colour. */
  add(now, x, y, z, nx, ny, nz, life, size0, size1, kind, seed, r, g, b, a, r2 = 0.05, g2 = 0.05, b2 = 0.05, a2 = 0.8) {
    const d = this.pool.data, o = this.pool.next();
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = now;
    d[o + 4] = nx; d[o + 5] = ny; d[o + 6] = nz; d[o + 7] = life;
    d[o + 8] = size0; d[o + 9] = size1; d[o + 10] = kind; d[o + 11] = seed;
    d[o + 12] = r; d[o + 13] = g; d[o + 14] = b; d[o + 15] = a;
    d[o + 16] = r2; d[o + 17] = g2; d[o + 18] = b2; d[o + 19] = a2;
  }
  flush() { this.pool.flush(); }
  clear() { this.pool.clear(); }
}
