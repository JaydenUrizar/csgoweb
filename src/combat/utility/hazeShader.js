// Haze puff shader: camera-facing sphere-impostor billboards with procedural cloud alpha, lit-sphere shading,
// self-shadowing, forward scatter, wake (bullet tunnel) carving and gl_FragDepth so puffs intersect geometry like spheres.
export const HAZE_VERT = /* glsl */`
attribute vec4 iA;   // world centre xyz, radius
attribute vec4 iB;   // seed, core(0 shell..1 deep), alpha multiplier, unused
varying vec2 vP; varying vec4 vC; varying vec4 vB; varying vec3 vCW; varying float vNear;
uniform float uPad;
void main() {
  vec4 c = viewMatrix * vec4(iA.xyz, 1.0);
  float R = iA.w;
  vC = vec4(c.xyz, R); vB = iB; vCW = iA.xyz;
  float d = length(c.xyz);
  vNear = smoothstep(R * 0.15, R * 1.05, d - R * 0.35);   // fade puffs the camera is inside / touching
  if (c.z > R * 0.6 || R < 0.01) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vP = vec2(0.0); return; }
  float zq = min(c.z + R * 0.85, -0.14);
  float k = zq / c.z; k = clamp(k, 0.0, 6.0);
  float pad = uPad * (1.0 + 0.35 * clamp(R / max(d, 0.01), 0.0, 1.0));
  vP = position.xy * 2.0 * pad;                 // -pad..pad in sphere radii
  vec3 vp = vec3(c.xy * k + vP * R * k, zq);
  gl_Position = projectionMatrix * vec4(vp, 1.0);
}`;
export const HAZE_FRAG = /* glsl */`
uniform mat4 projectionMatrix;
uniform sampler2D uTex; uniform float uTime, uOpacity, uFade;
uniform vec3 uSunDir, uSunCol, uSkyCol, uGroundCol, uAlbedo, uCenter, uCamPos;
uniform float uCloudR;
uniform vec3 uGlowPos; uniform vec4 uGlow;     // point flash light inside/near the cloud: rgb*intensity, range
uniform vec4 uWA[4]; uniform vec4 uWB[4]; uniform vec2 uWC[4];
varying vec2 vP; varying vec4 vC; varying vec4 vB; varying vec3 vCW; varying float vNear;
mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
void main() {
  float r2 = dot(vP, vP);
  if (r2 >= 1.0) discard;
  float r = sqrt(r2);
  float seed = vB.x, core = vB.y;
  vec2 uv = rot(seed * 6.2831 + uTime * (0.05 + 0.04 * fract(seed * 7.0))) * vP;
  vec2 o = vec2(fract(seed * 13.7), fract(seed * 5.3));
  vec4 t1 = texture2D(uTex, uv * 0.55 + o + vec2(uTime * 0.012, -uTime * 0.008));
  vec4 t2 = texture2D(uTex, uv * 1.25 + o * 1.7 - vec2(uTime * 0.02, uTime * 0.015));
  float h = t1.r, det = t2.a;
  // soft translucent billow: Beer-law thickness through the sphere, eroded by noise
  float z0 = sqrt(1.0 - r2);
  float dens = 1.0 - exp(-1.7 * z0 * vC.w);
  float a = smoothstep(0.03, 0.8, dens + ((h - 0.5) * 0.65 + (det - 0.5) * 0.2) * (0.3 + 0.7 * (1.0 - dens)));
  // sphere normal (view space) + noise bump
  float z = z0;
  vec3 nv = normalize(vec3(vP * 0.92 + (t1.gb - 0.5) * 0.85 * (1.0 - r * 0.4) + (t2.gb - 0.5) * 0.25, z));
  vec3 nW = normalize((vec4(nv, 0.0) * viewMatrix).xyz);
  // depth: sphere front surface
  float zf = vC.z + vC.w * z * 0.9;
  float ndc = (projectionMatrix[2][2] * zf + projectionMatrix[3][2]) / (-zf);
  gl_FragDepth = clamp(ndc * 0.5 + 0.5, 0.0, 1.0);
  // wakes: carve tunnels (planar point at the puff centre depth => clean grooves across all puffs)
  vec3 rightW = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 upW = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 wp = vCW + (rightW * vP.x + upW * vP.y) * vC.w;
  float carve = 0.0, wakeEdge = 0.0;
  for (int i = 0; i < 4; i++) {
    float amt = uWC[i].y; if (amt <= 0.001) continue;
    float t = clamp(dot(wp - uWA[i].xyz, uWB[i].xyz), 0.0, uWA[i].w);
    float d = distance(wp, uWA[i].xyz + uWB[i].xyz * t);
    float rr = uWC[i].x;
    carve = max(carve, amt * (1.0 - smoothstep(rr * 0.35, rr, d)));
    wakeEdge = max(wakeEdge, amt * smoothstep(rr * 0.5, rr * 0.95, d) * (1.0 - smoothstep(rr * 0.95, rr * 1.7, d)));
  }
  a *= 1.0 - carve;
  a *= uOpacity * vB.z * uFade * vNear;
  if (a < 0.004) discard;
  // lighting
  vec3 L = uSunDir;
  float ndl = dot(nW, L);
  float wrap = pow(clamp(ndl * 0.5 + 0.5, 0.0, 1.0), 1.35);
  float sunSide = dot(normalize(vCW - uCenter + vec3(0.0, 0.001, 0.0)), L);          // puffs on the far side of the cloud sit in its shadow
  float depthShade = mix(1.0, 0.58, core * (1.0 - smoothstep(-0.35, 0.85, sunSide)));
  float sideShade = 0.78 + 0.22 * smoothstep(-0.8, 0.8, sunSide);
  float hgt = clamp((vCW.y - uCenter.y) / max(uCloudR, 0.5) * 0.5 + 0.5, 0.0, 1.0);   // darker toward the floor
  vec3 amb = mix(uGroundCol, uSkyCol, clamp(nW.y * 0.5 + 0.5, 0.0, 1.0)) * mix(0.72, 1.0, hgt);
  vec3 col = uAlbedo * (uSunCol * wrap * 1.35 * depthShade * sideShade + amb * mix(0.62, 0.42, core * 0.6));
  col *= 0.5 + 0.5 * smoothstep(0.0, 0.75, z * (0.7 + 0.6 * h));
  // creases between billows darken slightly
  col *= 0.86 + 0.14 * smoothstep(0.2, 0.8, h);
  // forward scatter: bright silvery rim when the sun is behind the cloud
  vec3 vdir = normalize(vCW - uCamPos);
  float fs = pow(clamp(dot(vdir, L), 0.0, 1.0), 5.0);
  col += uSunCol * fs * pow(1.0 - z, 1.6) * 0.9 * (1.0 - core * 0.5);
  // flash/pulse glow lighting the cloud from inside
  if (uGlow.w > 0.0) { float dg = distance(vCW, uGlowPos); col += uGlow.rgb * (1.0 - smoothstep(0.0, uGlow.w, dg)) * 0.9; }
  col += wakeEdge * uSunCol * 0.35;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export const OVERLAY_VERT = /* glsl */`void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;
export const OVERLAY_FRAG = /* glsl */`uniform vec3 uCol; uniform float uAlpha; void main(){ gl_FragColor = vec4(uCol, uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
