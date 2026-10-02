// One physically-shaded material per actor (so a whole athlete = ONE skinned draw call). A small shader patch adds:
//  * role colouring from vertex masks (suit / accent / team-emissive / visor / helmet / back / fixed dark gear)
//  * cosmetic suit patterns in bind-pose object space (stable while animating)
//  * always-on team rim light + team emissive strips (team identity never depends on cosmetics)
//  * spawn materialise / pixel-dissolve (uMat), hit flash (uFlash), flash-freeze crystal look (uFreeze), holo finish
import * as THREE from 'three';

export const PATTERNS = { solid: 0, stripes: 1, hex: 2, chevron: 3, camo: 4, circuit: 5, gradient: 6, checker: 7 };
const FINISH = { matte: [0.82, 0.02, 0], satin: [0.5, 0.18, 0], metallic: [0.32, 0.75, 0], holo: [0.28, 0.35, 1] };

const GLSL_COMMON = /* glsl */`
uniform vec3 uSuit, uAccent, uTeam, uVisor, uHelmet, uHAccent, uBack, uPatCol;
uniform float uPattern, uTeamGlow, uVisorGlow, uRim, uHolo, uFreeze, uFlash, uMat, uTime, uFinishR, uFinishM;
varying vec4 vRole, vRole2; varying vec3 vObj;
float aHash(vec3 p){ p = fract(p*0.3183099 + vec3(.1,.2,.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float aNoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(aHash(i),aHash(i+vec3(1,0,0)),f.x), mix(aHash(i+vec3(0,1,0)),aHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(aHash(i+vec3(0,0,1)),aHash(i+vec3(1,0,1)),f.x), mix(aHash(i+vec3(0,1,1)),aHash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float patternMask(vec3 p){
  if (uPattern < 0.5) return 0.0;
  if (uPattern < 1.5) return step(0.55, fract(p.y*6.0));                                   // stripes
  if (uPattern < 2.5) { vec2 q = p.xy*vec2(9.0,9.0); q.x += floor(q.y)*0.5; vec2 g = abs(fract(q)-0.5);  // hex-ish cells
    return step(0.42, max(g.x*1.15, g.y*0.9)); }
  if (uPattern < 3.5) return step(0.6, fract((p.y + abs(p.x)*0.9)*5.0));                   // chevrons
  if (uPattern < 4.5) return step(0.56, aNoise(p*7.0)) * 0.9 + step(0.7, aNoise(p*13.0+4.0)) * 0.4; // camo
  if (uPattern < 5.5) { vec3 c = floor(p*9.0); float ln = max(step(fract(p.x*9.0),0.09), step(fract(p.y*9.0),0.09)); return ln * step(0.45, aHash(c)); } // circuit
  if (uPattern < 6.5) return smoothstep(0.3, 1.5, p.y);                                    // gradient
  vec3 c = floor(p*11.0); return mod(c.x+c.y+c.z, 2.0);                                     // checker
}
`;

export function createActorMaterial() {
  const u = {
    uSuit: { value: new THREE.Color(0xd9531e) }, uAccent: { value: new THREE.Color(0xe6ebf2) }, uTeam: { value: new THREE.Color(0xff7a2f) },
    uVisor: { value: new THREE.Color(0xffe1c8) }, uHelmet: { value: new THREE.Color(0xdde3ea) }, uHAccent: { value: new THREE.Color(0x3a3f4b) },
    uBack: { value: new THREE.Color(0x3a3f4b) }, uPatCol: { value: new THREE.Color(0xffffff) },
    uPattern: { value: 0 }, uTeamGlow: { value: 1.2 }, uVisorGlow: { value: 2.4 }, uRim: { value: 0.75 }, uHolo: { value: 0 },
    uFreeze: { value: 0 }, uFlash: { value: 0 }, uMat: { value: 1 }, uTime: { value: 0 }, uFinishR: { value: 0.6 }, uFinishM: { value: 0.1 },
  };
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 });
  m.userData.u = u; m.name = 'actor';
  m.customProgramCacheKey = () => 'flux-actor-v3';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aRole; attribute vec4 aRole2; varying vec4 vRole; varying vec4 vRole2; varying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRole = aRole; vRole2 = aRole2; vObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_COMMON)
      .replace('#include <clipping_planes_fragment>', /* glsl */`#include <clipping_planes_fragment>
        float matEdge = 0.0;
        if (uMat < 0.999) {
          float n = aHash(floor(vObj * 20.0));
          float e = (vObj.y + n * 0.24) - (uMat * 2.35 - 0.3);
          if (e > 0.0) discard;
          matEdge = smoothstep(-0.2, 0.0, e);
        }`)
      .replace('#include <color_fragment>', /* glsl */`
        vec3 aCol = vColor.rgb; float aoV = vColor.r;
        vec3 aSuit = mix(uSuit, uPatCol, patternMask(vObj) * 0.7);
        vec3 aBase = aCol;
        aBase = mix(aBase, aSuit * aoV, vRole.x);
        aBase = mix(aBase, uAccent * aoV, vRole.y);
        aBase = mix(aBase, uTeam * 0.55 * aoV, vRole.z);
        aBase = mix(aBase, uVisor * 0.35, vRole.w);
        aBase = mix(aBase, uHelmet * aoV, vRole2.x);
        aBase = mix(aBase, uHAccent * aoV, vRole2.y);
        aBase = mix(aBase, uBack * aoV, vRole2.z);
        float aFrz = uFreeze * 0.92; float aCell = aHash(floor(vObj * 11.0));
        vec3 aIce = mix(vec3(0.5, 0.78, 1.0), uTeam, 0.18) * (0.6 + 0.5 * aCell);
        aBase = mix(aBase, aIce, aFrz);
        diffuseColor.rgb *= aBase;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nfloat aFin = clamp(vRole.x + vRole2.x + vRole2.z, 0.0, 1.0);\nroughnessFactor = mix(mix(0.62, uFinishR, aFin), 0.1, uFreeze);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(uFinishM * aFin, 0.35, uFreeze);')
      .replace('#include <emissivemap_fragment>', /* glsl */`#include <emissivemap_fragment>
        float aFres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
        totalEmissiveRadiance += uTeam * vRole.z * uTeamGlow;
        totalEmissiveRadiance += uVisor * vRole.w * uVisorGlow;
        totalEmissiveRadiance += uTeam * aFres * uRim * (1.0 - uFreeze * 0.3);
        totalEmissiveRadiance += diffuseColor.rgb * 0.13 * (1.0 - uFreeze);
        totalEmissiveRadiance += uTeam * (0.5 + 0.5 * sin(6.2831 * (vObj.y * 1.5 + uTime * 0.5))) * aFres * uHolo * 1.2;
        totalEmissiveRadiance += aIce * (aFres * 1.4 + 0.07 + 0.35 * step(0.9, aCell)) * uFreeze;
        totalEmissiveRadiance += vec3(uFlash) * (0.7 + aFres);
        totalEmissiveRadiance += uTeam * matEdge * 4.0 + vec3(matEdge) * 0.6;`);
  };
  return m;
}

const _c = new THREE.Color(), _h = { h: 0, s: 0, l: 0 }, _t = { h: 0, s: 0, l: 0 };
const SRGB = THREE.SRGBColorSpace;
const wrapH = (d) => d - Math.round(d);
// Per-team palette clamps. EVERY colour slot is forced into the team's hue band or a neutral; the opposite team's hue can never appear.
const TEAM_RULES = {
  ember: { suit: { s: [0.45, 0.7], l: [0.12, 0.19] }, accent: { l: [0.78, 0.92] }, helmet: { l: [0.78, 0.92] }, back: { l: [0.1, 0.2] }, hAccent: { l: [0.1, 0.5] } },
  tide:  { suit: { s: [0.62, 0.95], l: [0.36, 0.5] }, accent: { l: [0.74, 0.92] }, helmet: { l: [0.58, 0.9] }, back: { l: [0.28, 0.5] }, hAccent: { l: [0.1, 0.55] } },
};
function clampSlot(out, hex, th, rule, teamHueOk = true) {
  _c.set(hex).getHSL(_h, SRGB);
  const dh = wrapH(_h.h - th), inBand = teamHueOk && Math.abs(dh) < 0.07 && _h.s > 0.2;
  const l = Math.min(rule.l[1], Math.max(rule.l[0], _h.l));
  if (inBand) out.setHSL(th + Math.max(-0.03, Math.min(0.03, dh)), Math.min(_h.s, 0.7), l, SRGB);
  else out.setHSL(th, Math.min(_h.s, 0.08), l, SRGB);       // neutral grey (tiny team tint)
  return out;
}
/** Lock every cosmetic colour slot to the team (hue band or neutral). Cosmetics keep shape, pattern type and finish only. */
export function applySpecToMaterial(mat, spec, teamColor, team = 'ember') {
  const u = mat.userData.u, s = spec.suit || {}, h = spec.helmet || {}, v = spec.visor || {}, b = spec.back || {};
  const R = TEAM_RULES[team] || TEAM_RULES.ember;
  new THREE.Color(teamColor).getHSL(_t, SRGB); const th = _t.h;
  _c.set(s.base ?? teamColor).getHSL(_h, SRGB);
  u.uSuit.value.setHSL(th + (team === 'ember' ? 0.0 : 0) + Math.max(-0.02, Math.min(0.02, wrapH(_h.h - th))), Math.min(R.suit.s[1], Math.max(R.suit.s[0], _h.s)), Math.min(R.suit.l[1], Math.max(R.suit.l[0], _h.l)), SRGB);
  clampSlot(u.uAccent.value, s.accent ?? 0xe6ebf2, th, R.accent);
  u.uPatCol.value.copy(u.uSuit.value); u.uPatCol.value.getHSL(_h, SRGB); u.uPatCol.value.setHSL(_h.h, _h.s, Math.min(0.85, _h.l + (team === 'ember' ? 0.05 : 0.12)), SRGB);   // subtle tone-on-tone patterns only
  u.uPattern.value = PATTERNS[s.pattern] ?? 0;
  u.uTeam.value.set(teamColor);
  u.uVisor.value.setHSL(th, 0.85, 0.74, SRGB);
  clampSlot(u.uHelmet.value, h.color ?? 0xdde3ea, th, R.helmet);
  clampSlot(u.uHAccent.value, h.accent ?? 0x3a3f4b, th, R.hAccent);
  clampSlot(u.uBack.value, b.color ?? 0x3a3f4b, th, R.back);
  const f = FINISH[s.material] || FINISH.satin;
  u.uFinishR.value = f[0]; u.uFinishM.value = f[1]; u.uHolo.value = f[2] * 0.45;
}
