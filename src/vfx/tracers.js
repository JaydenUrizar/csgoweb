import * as THREE from 'three';
import { QuadPool } from './pool.js';

// Tracer ribbons. A bright head races from `from` to `to`; a tapered tail trails behind it and is swallowed at the end.
//   aFrom x y z birth     aTo x y z speed     aCol r g b intensity     aParm width len style seed
export const TRACER_STYLE = { BEAM: 0, PULSE: 1, COMET: 2, PRISM: 3, LASER: 4, TWIN: 5 };

const VERT = /* glsl */`
attribute vec2 corner;
attribute vec4 aFrom, aTo, aCol, aParm;
uniform float uTime;
uniform float uPx;        // world size of one pixel at unit depth
uniform float uNear;
varying vec2 vUv;
varying vec4 vCol;
varying vec4 vParm;       // style, seed, segment length (m), age
varying float vLen;
void main() {
  float age = uTime - aFrom.w;
  vec3 d = aTo.xyz - aFrom.xyz;
  float dist = length(d);
  float len = aParm.y;
  float travelled = aTo.w * age;
  float headD = min(travelled, dist);
  float tailD = clamp(travelled - len, 0.0, dist);
  float seg = headD - tailD;
  if (age < 0.0 || seg < 0.02 || dist < 0.01) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vUv = vec2(0.0); vCol = vec4(0.0); vParm = vec4(0.0); vLen = 0.0; return; }
  vec3 dir = d / dist;
  vec3 head = aFrom.xyz + dir * headD, tail = aFrom.xyz + dir * tailD;
  vec4 h = modelViewMatrix * vec4(head, 1.0), tl = modelViewMatrix * vec4(tail, 1.0);
  float s = corner.y * 0.5 + 0.5;
  vec3 pv = mix(tl.xyz, h.xyz, s);
  vec3 ax = h.xyz - tl.xyz;
  vec3 toCam = normalize(-pv);
  vec3 side = cross(ax, toCam);
  float sl = length(side);
  side = sl > 1e-6 ? side / sl : vec3(1.0, 0.0, 0.0);
  float taper = mix(0.35, 1.0, pow(s, 0.8));
  float style = aParm.z;
  if (style > 1.5 && style < 2.5) taper = mix(0.2, 1.0, pow(s, 2.2));
  float other = aParm.x < 0.0 ? 1.0 : 0.0;
  float w = abs(aParm.x) * taper;
  float minW = uPx * max(-pv.z, 0.1) * 5.0;                 // >= ~5 px quad (core ~2-3 px)
  // foreshortened (near-axial) tracers: widen into a hot blob so they still read
  float axial = length(ax.xy) / max(length(ax), 1e-4);
  float blob = 1.0 + (1.0 - smoothstep(0.1, 0.5, axial)) * 1.8;
  float hw = min(max(w * 0.5, minW * mix(0.5, 0.3, other)) * mix(blob, 1.0, other), uPx * max(-pv.z, 0.1) * 45.0);   // cap ~90px wide
  float thin = clamp(w / max(minW, 1e-5), 0.8, 1.0);
  pv += side * corner.x * hw;
  float nearFade = smoothstep(uNear * 0.3, uNear, -pv.z);
  float remain = smoothstep(0.0, 1.0, seg / max(min(len, dist), 0.05));
  float toEnd = dist - mix(tailD, headD, s);
  remain *= mix(1.0, mix(0.0, 1.0, smoothstep(0.3, 2.2, toEnd)) * 0.9 + 0.1, other);   // others' tracers dissolve ~2 m before whatever they hit
  vUv = vec2(s, corner.x);
  vCol = vec4(aCol.rgb * aCol.a * mix(1.0, 0.55, other), thin * nearFade * remain);
  vParm = vec4(aParm.z, aParm.w, seg, age);
  vLen = seg;
  gl_Position = projectionMatrix * vec4(pv, 1.0);
}`;

const FRAG = /* glsl */`
varying vec2 vUv;
varying vec4 vCol;
varying vec4 vParm;
varying float vLen;
vec3 hsv(float h, float s, float v) { vec3 k = clamp(abs(fract(h + vec3(0.0, 0.6667, 0.3333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }
void main() {
  if (vCol.a <= 0.0) discard;
  float s = vUv.x, y = vUv.y;
  float style = vParm.x;
  float ay = abs(y);
  vec3 col = vCol.rgb;
  float a;
  float core = exp(-ay * ay * 9.0);
  float halo = exp(-ay * ay * 2.2) * 0.45;
  float body = pow(s, 1.1);
  float headHot = exp(-(1.0 - s) * (6.0 / (1.0 + vLen * 0.25))) * 1.6;
  vec3 sat = col * 1.5;
  if (style < 0.5) {                                   // BEAM
    a = (core * 1.25 + halo) * body + core * headHot;
    col = mix(sat, vec3(1.0), core * (0.55 + headHot * 0.3));
  } else if (style < 1.5) {                            // PULSE (dashed energy packets)
    float pat = smoothstep(0.3, 0.7, 0.5 + 0.5 * sin((s * vLen * 2.2 - vParm.w * 24.0) * 3.14159));
    a = (core * (0.5 + pat * 0.9) + halo * 0.7) * body + core * headHot * 0.8;
    col = mix(sat, vec3(1.0), core * pat * 0.6);
  } else if (style < 2.5) {                            // COMET
    float fizz = 0.8 + 0.2 * sin(s * 90.0 + vParm.y * 40.0 - vParm.w * 60.0);
    a = (core * pow(s, 1.8) * fizz * 1.3 + halo * pow(s, 1.5)) + exp(-ay * ay * 4.0) * headHot * 0.9;
    col = mix(sat, vec3(1.0), pow(s, 4.0) * core);
  } else if (style < 3.5) {                            // PRISM
    vec3 rb = hsv(s * 0.85 + vParm.w * 1.5 + vParm.y, 0.65, 1.6);
    a = (core * 1.1 + halo) * body + core * headHot * 0.6;
    col = mix(rb, vec3(1.0), core * 0.5);
  } else if (style < 4.5) {                            // LASER
    float e = smoothstep(0.0, 0.2, s);
    a = (exp(-ay * ay * 14.0) * 1.4 + halo * 0.6) * e;
    col = mix(sat, vec3(1.0), exp(-ay * ay * 30.0) * 0.85);
  } else {                                             // TWIN
    float ph = s * vLen * 3.0 - vParm.w * 30.0 + vParm.y * 6.0;
    float y1 = ay - 0.45 - 0.25 * sin(ph), y2 = ay - 0.45 + 0.25 * sin(ph);
    a = (exp(-y1 * y1 * 40.0) + exp(-y2 * y2 * 40.0)) * 1.0 * body + halo * 0.5 * body + core * headHot * 0.7;
    col = mix(sat, vec3(1.0), 0.3);
  }
  a *= step(abs(y), 1.0);
  gl_FragColor = vec4(col * a * vCol.a * 3.2, 0.0);          // additive (alpha 0 in premultiplied blending)
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Tracers {
  constructor(parent, max, time, near) {
    this.uniforms = { uTime: time, uPx: { value: 0.002 }, uNear: near };
    this.pool = new QuadPool(parent, max, ['aFrom', 'aTo', 'aCol', 'aParm'], VERT, FRAG, this.uniforms, { depthTest: true }, { order: 30, name: 'tracers' });
    this.pool.clear();
    this.count = 0;
  }
  add(now, fx, fy, fz, tx, ty, tz, speed, r, g, b, intensity, width, len, style, seed) {
    const d = this.pool.data, o = this.pool.next();
    d[o] = fx; d[o + 1] = fy; d[o + 2] = fz; d[o + 3] = now;
    d[o + 4] = tx; d[o + 5] = ty; d[o + 6] = tz; d[o + 7] = speed;
    d[o + 8] = r; d[o + 9] = g; d[o + 10] = b; d[o + 11] = intensity;
    d[o + 12] = width; d[o + 13] = len; d[o + 14] = style; d[o + 15] = seed;
    this.count++;
  }
  /** call each frame with camera info. */
  update(camera, height) { this.uniforms.uPx.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5)) / Math.max(1, height); this.pool.flush(); }
  clear() { this.pool.clear(); }
}
