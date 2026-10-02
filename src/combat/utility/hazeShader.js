// Haze puff shader. Camera-facing sphere-impostor billboards whose alpha is a noise-eroded Beer-law thickness; shading comes from the
// *cloud* shape (blended with a small per-puff normal) so no bubble-wrap outlines; sun term is gated by a CPU sun-visibility per puff (map shadows),
// ambient comes from the scene hemisphere; wakes (bullet tunnels) are carved with the SAME formula the CPU density query uses (see haze.js wakeFactor),
// integrated along 4 samples of the view-ray chord through each puff -> the on-screen tunnel and blocksLine agree.
export const HAZE_VERT = /* glsl */`
attribute vec4 iA;   // world centre xyz, radius
attribute vec4 iB;   // seed, core(0 shell..1 deep), alpha multiplier, sun visibility
varying vec2 vP; varying vec4 vC; varying vec4 vB; varying vec3 vCW; varying float vNear;
uniform float uPad;
void main() {
  vec4 c = viewMatrix * vec4(iA.xyz, 1.0);
  float R = iA.w;
  vC = vec4(c.xyz, R); vB = iB; vCW = iA.xyz;
  float d = length(c.xyz);
  vNear = smoothstep(R * 0.15, R * 1.05, d - R * 0.35);
  if (c.z > R * 0.6 || R < 0.01) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vP = vec2(0.0); return; }
  float zq = min(c.z + R * 0.85, -0.14);
  float k = clamp(zq / c.z, 0.0, 6.0);
  float pad = uPad * (1.0 + 0.35 * clamp(R / max(d, 0.01), 0.0, 1.0));
  vP = position.xy * 2.0 * pad;
  vec3 vp = vec3(c.xy * k + vP * R * k, zq);
  gl_Position = projectionMatrix * vec4(vp, 1.0);
}`;
export const HAZE_FRAG = /* glsl */`
uniform mat4 projectionMatrix;
uniform sampler2D uTex; uniform float uTime, uOpacity, uFade, uExposure;
uniform vec3 uSunDir, uSunCol, uSkyCol, uGroundCol, uAlbedo, uCenter, uCamPos, uFogCol;
uniform float uCloudR, uFloorY;
uniform vec3 uGlowPos; uniform vec4 uGlow;
uniform int uWN; uniform vec4 uWA[8]; uniform vec4 uWB[8]; uniform vec2 uWC[8];
varying vec2 vP; varying vec4 vC; varying vec4 vB; varying vec3 vCW; varying float vNear;
mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
float wakeF(vec3 p) {
  float f = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uWN) break;
    float t = clamp(dot(p - uWA[i].xyz, uWB[i].xyz), 0.0, uWA[i].w);
    float d = distance(p, uWA[i].xyz + uWB[i].xyz * t);
    float ph = uWB[i].w;
    float r = uWC[i].x * (1.0 + 0.32 * sin(t * 4.7 + ph) + 0.18 * sin(t * 11.3 + ph * 2.1));
    f *= 1.0 - uWC[i].y * (1.0 - smoothstep(r * 0.45, r, d));
  }
  return f;
}
void main() {
  float r2 = dot(vP, vP);
  if (r2 >= 1.0) discard;
  float r = sqrt(r2);
  float seed = vB.x, core = vB.y;
  vec2 uv = rot(seed * 6.2831 + uTime * (0.04 + 0.03 * fract(seed * 7.0))) * vP;
  vec2 o = vec2(fract(seed * 13.7), fract(seed * 5.3));
  vec4 t0 = texture2D(uTex, uv * 0.3 + o * 2.3 + vec2(uTime * 0.017, uTime * 0.011));
  vec2 wv = (t0.gb - 0.5) * 0.45;                                   // domain warp -> swirling, non-repeating structure
  vec4 t1 = texture2D(uTex, uv * 0.42 + o + wv + vec2(uTime * 0.03, -uTime * 0.02));
  vec4 t2 = texture2D(uTex, uv * 0.8 + o * 1.7 + wv * 1.3 - vec2(uTime * 0.05, uTime * 0.035));
  float h = t1.r, det = t2.a;
  float z0 = sqrt(1.0 - r2);
  // thickness through the sphere, broken up by two noise octaves -> ragged wispy silhouette, not a clean disc
  float dens = 1.0 - exp(-1.5 * z0 * vC.w);
  float n = (h - 0.5) * 1.15 + (det - 0.5) * 0.55 + (t2.r - 0.5) * 0.4;
  float a = smoothstep(0.05, 0.8, dens * (0.7 + 0.6 * h) + n * (0.35 + 0.8 * (1.0 - dens)) * 0.9 - 0.1 * r);
  a = min(a, 0.995);
  // sphere normal + noise bump (view space) -> world
  vec3 nv = normalize(vec3(vP * 0.9 + (t1.gb - 0.5) * 0.55 + (t2.gb - 0.5) * 0.12, z0));
  vec3 nS = normalize((vec4(nv, 0.0) * viewMatrix).xyz);
  float zf = vC.z + vC.w * z0 * 0.9;
  float ndc = (projectionMatrix[2][2] * zf + projectionMatrix[3][2]) / (-zf);
  gl_FragDepth = clamp(ndc * 0.5 + 0.5, 0.0, 1.0);
  // ---- wakes: same math as the CPU query, averaged along the chord of the view ray through this puff
  if (uWN > 0) {
    vec3 rightW = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 upW = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 wp = vCW + (rightW * vP.x + upW * vP.y) * vC.w;
    vec3 vd = normalize(wp - uCamPos); float hc = vC.w * z0;
    float wf = 0.25 * (wakeF(wp - vd * hc * 0.75) + wakeF(wp - vd * hc * 0.25) + wakeF(wp + vd * hc * 0.25) + wakeF(wp + vd * hc * 0.75));
    float tau = -log(max(1.0 - a, 0.004));
    a = 1.0 - exp(-tau * wf);
  }
  a *= uOpacity * vB.z * uFade * vNear;
  { float yy = vCW.y + nS.y * vC.w * 0.55; a *= smoothstep(uFloorY - 0.05, uFloorY + 0.5, yy); }
  if (a < 0.004) discard;
  // ---- lighting: cloud-scale normal (bulge) + a little per-puff structure
  vec3 nC = normalize(vCW - uCenter + vec3(0.0, 0.35 * uCloudR, 0.0));
  vec3 nW = normalize(mix(nC, nS, 0.38));
  vec3 L = uSunDir;
  float ndl = dot(nW, L);
  float sunVis = vB.w;
  float lit = pow(clamp(ndl * 0.55 + 0.45, 0.0, 1.0), 1.5);
  float sunSide = dot(normalize(vCW - uCenter + vec3(0.0, 0.001, 0.0)), L);
  float inner = mix(1.0, 0.55, core * (1.0 - smoothstep(-0.3, 0.8, sunSide)));      // deep interior sits in the cloud's own shadow
  vec3 sun = uSunCol * 1.35 * lit * inner * sunVis;
  float hgt = clamp((vCW.y - uCenter.y) / max(uCloudR, 0.5) * 0.5 + 0.5, 0.0, 1.0);
  vec3 amb = mix(uGroundCol, uSkyCol, clamp(nW.y * 0.5 + 0.5, 0.0, 1.0)) * mix(0.7, 1.0, hgt) * mix(1.0, 0.7, core * 0.6);
  vec3 col = uAlbedo * (sun + amb);
  col *= 0.88 + 0.12 * smoothstep(0.15, 0.85, h);                                   // faint crease variation
  col = mix(col, uFogCol * dot(col, vec3(0.333)), 0.14);                           // environment tint
  vec3 vdir = normalize(vCW - uCamPos);
  float fs = pow(clamp(dot(vdir, L), 0.0, 1.0), 5.0);
  col += uSunCol * fs * pow(1.0 - z0, 1.6) * 0.5 * (1.0 - core * 0.5) * sunVis;     // silvery rim when the sun is behind
  if (uGlow.w > 0.0) { float dg = distance(vCW, uGlowPos); col += uGlow.rgb * (1.0 - smoothstep(0.0, uGlow.w, dg)) * 0.7; }
  col *= uExposure;
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export const OVERLAY_VERT = /* glsl */`void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;
export const OVERLAY_FRAG = /* glsl */`uniform vec3 uCol; uniform float uAlpha; void main(){ gl_FragColor = vec4(uCol, uAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
