// Materials + procedural skin patterns for viewmodel/world tagger models.
import * as THREE from 'three';
import { createUber, setSub, setGlow } from './uber.js';

const patCache = new Map();
const hex = (n) => '#' + (n >>> 0 & 0xffffff).toString(16).padStart(6, '0');
const shade = (n, k) => { const c = new THREE.Color(n); c.multiplyScalar(k); return c; };
let _seed = 1; const rnd = () => (_seed = (_seed * 16807) % 2147483647) / 2147483647;

/** 128px tileable pattern canvas -> CanvasTexture (cached). */
export function patternTexture(pattern, primary, accent, wear = 0) {
  if (!pattern || (pattern === 'solid' && wear <= 0.02)) return null;
  const key = `${pattern}|${primary}|${accent}|${wear.toFixed(2)}`;
  if (patCache.has(key)) return patCache.get(key);
  if (typeof document === 'undefined') return null;
  const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  g.fillStyle = hex(primary); g.fillRect(0, 0, N, N);
  const A = hex(accent), D = '#' + shade(primary, 0.55).getHexString();
  _seed = 7 + (primary ^ accent) % 997;
  switch (pattern) {
    case 'stripes': g.fillStyle = A; for (let i = -N; i < N * 2; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 24, 0); g.lineTo(i + 24 - N, N); g.lineTo(i - N, N); g.fill(); } break;
    case 'hex': g.strokeStyle = A; g.lineWidth = 3; { const r = 16, h = r * Math.sqrt(3); for (let y = -1; y < 5; y++) for (let x = -1; x < 6; x++) { const cx = x * r * 3 + (y & 1 ? r * 1.5 : 0), cy = y * h / 2 * 1; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.stroke(); } } break;
    case 'chevron': g.fillStyle = A; for (let y = -N; y < N * 2; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(N / 2, y + 30); g.lineTo(N, y); g.lineTo(N, y + 16); g.lineTo(N / 2, y + 46); g.lineTo(0, y + 16); g.fill(); } break;
    case 'camo': for (let i = 0; i < 26; i++) { g.fillStyle = i % 3 === 0 ? A : i % 3 === 1 ? D : '#' + shade(primary, 1.35).getHexString(); g.beginPath(); const cx = rnd() * N, cy = rnd() * N, r = 10 + rnd() * 16; for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, rr = r * (0.6 + rnd() * 0.6); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.fill(); } break;
    case 'circuit': g.strokeStyle = A; g.fillStyle = A; g.lineWidth = 3; for (let i = 0; i < 9; i++) { let x = Math.floor(rnd() * 8) * 16, y = Math.floor(rnd() * 8) * 16; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { if (k & 1) y += (rnd() < 0.5 ? -1 : 1) * 16 * (1 + Math.floor(rnd() * 2)); else x += (rnd() < 0.5 ? -1 : 1) * 16 * (1 + Math.floor(rnd() * 2)); g.lineTo(x, y); } g.stroke(); g.fillRect(x - 4, y - 4, 8, 8); } break;
    case 'gradient': { const gr = g.createLinearGradient(0, 0, 0, N); gr.addColorStop(0, hex(primary)); gr.addColorStop(0.5, hex(primary)); gr.addColorStop(1, A); g.fillStyle = gr; g.fillRect(0, 0, N, N); } break;
    case 'checker': g.fillStyle = A; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) & 1) g.fillRect(x * 32, y * 32, 32, 32); break;
    default: break;
  }
  if (wear > 0.02) {   // scuffs + edge dirt
    g.globalAlpha = 0.5 * wear; g.fillStyle = '#0a0a0a';
    for (let i = 0; i < 60 * wear; i++) g.fillRect(rnd() * N, rnd() * N, 1 + rnd() * 5, 1 + rnd() * 1.5);
    g.globalAlpha = 0.28 * wear; g.fillStyle = '#ffffff';
    for (let i = 0; i < 40 * wear; i++) g.fillRect(rnd() * N, rnd() * N, 1 + rnd() * 3, 1);
    g.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  patCache.set(key, tex); return tex;
}

const HEAT_COLD = new THREE.Color(0x0a0608), HEAT_WARM = new THREE.Color(0xff5a1a), HEAT_HOT = new THREE.Color(0xfff0b0);
const _c = new THREE.Color();
/** sub-material ids shared with geo/builder (per-vertex aMat). 'glass' is a separate transparent mesh. */
export const MAT_ID = { body: 0, trim: 1, dark: 2, rubber: 3, grip: 4, glow: 5, core: 6, coreOff: 7, vent: 8, lens: 9 };
const PATTERN_CONTRAST = 0.4, SKIN_STRENGTH = 0.22;   // skins are applied to body panels only, at reduced contrast so part separation stays readable

/** A full material set for one tagger model: one opaque uber material (+ one glass material). apply(skin) re-skins, update() drives glow/heat. */
export class MatSet {
  constructor(defaults) {
    this.defaults = defaults; this.skin = null; this.glowK = 2.4;
    this.u = createUber(10, { noTone: [5, 6, 7, 8] });
    this.opaque = this.u.material;
    this.glass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.32, depthWrite: false, vertexColors: true, envMapIntensity: 1.6 });
    this.all = [this.opaque, this.glass];
    this.glowColor = new THREE.Color(); this.heat = 0; this.ammoColor = new THREE.Color(); this.flash = 0;
    this.apply(null);
  }
  apply(skin) {
    const d = this.defaults, s = { ...d, ...(skin || {}) };
    for (const k of ['pattern', 'primary', 'accent', 'glow', 'wear']) if (s[k] == null) s[k] = d[k];
    // keep each tagger's identity: skins only lightly re-tint furniture/trim and glow
    if (skin && d.pattern && d.pattern !== 'solid') s.pattern = d.pattern;   // models with their own finish (hex, stripes, chevron, gradient) keep it
    if (skin) { s.accent = new THREE.Color(d.accent).lerp(new THREE.Color(s.accent), 0.3).getHex(); s.glow = new THREE.Color(d.glow).lerp(new THREE.Color(s.glow), 0.3).getHex(); }
    this.skin = s;
    const u = this.u;
    // a custom skin tints the weapon's own gunmetal instead of replacing it (readable finish, never a full-contrast slab);
    // the pattern accent is pulled toward the tinted body so stripes stay subtle.
    const custom = !!skin, hsl = { h: 0, s: 0, l: 0 }, sp = new THREE.Color(s.primary); sp.getHSL(hsl); if (custom) sp.setHSL(hsl.h, hsl.s * 0.7, hsl.l * 0.85);   // tame loud skins
    const body = custom ? new THREE.Color(d.primary).lerp(sp, SKIN_STRENGTH) : new THREE.Color(s.primary);
    const acc = new THREE.Color(body).lerp(new THREE.Color(s.accent), PATTERN_CONTRAST).getHex();
    const tex = patternTexture(s.pattern, body.getHex(), acc, s.wear || 0);
    if (u.material.map !== tex) { u.material.map = tex; u.material.needsUpdate = true; }
    if (tex) u.pal[MAT_ID.body].set(1, 1, 1); else setSub(u, MAT_ID.body, body, 0.42, 0.28);
    setSub(u, MAT_ID.trim, s.accent, 0.3, 0.75);
    setSub(u, MAT_ID.dark, _c.set(s.primary).multiplyScalar(0.32).lerp(new THREE.Color(0x1b2029), 0.55), 0.45, 0.55);
    setSub(u, MAT_ID.rubber, 0x14161a, 0.92, 0.0);
    setSub(u, MAT_ID.grip, _c.set(s.accent).multiplyScalar(0.28).lerp(new THREE.Color(0x1a1a20), 0.5), 0.75, 0.1);
    setSub(u, MAT_ID.lens, 0x0a1418, 0.04, 0.9);
    this.glowColor.set(s.glow); this.glass.color.set(s.glow).lerp(_c.set(0xffffff), 0.55);
    this.glass.emissive?.copy(this.glowColor).multiplyScalar(0.08);
    this.update(0, 0, 1, 0);
    return this;
  }
  /** heat 0..1 (vent/barrel glow), ammoFrac 0..1 (core colour), pulse 0..1 extra glow (fire flash). */
  update(heat, ammoFrac, ammoKnown = 1, pulse = 0, t = 0) {
    this.heat = heat; const u = this.u;
    const gk = this.glowK * (1 + pulse * 0.9 + 0.06 * Math.sin(t * 2.2));
    setGlow(u, MAT_ID.glow, this.glowColor, gk);
    const f = ammoFrac;
    if (f > 0.5) this.ammoColor.copy(this.glowColor); else if (f > 0.25) this.ammoColor.copy(this.glowColor).lerp(_c.set(0xffb020), (0.5 - f) / 0.25); else this.ammoColor.set(0xffb020).lerp(_c.set(0xff2a2a), (0.25 - f) / 0.25);
    const blink = f < 0.2 && ammoKnown ? 0.75 + 0.25 * Math.sin(t * 14) : 1;
    setGlow(u, MAT_ID.core, this.ammoColor, gk * 1.05 * blink);
    _c.copy(this.glowColor).multiplyScalar(0.06).add(new THREE.Color(0x040608)); setGlow(u, MAT_ID.coreOff, _c, 1);
    if (heat < 0.5) _c.copy(HEAT_COLD).lerp(HEAT_WARM, heat * 2); else _c.copy(HEAT_WARM).lerp(HEAT_HOT, (heat - 0.5) * 2);
    setGlow(u, MAT_ID.vent, _c, 0.25 + heat * 3.2);
  }
  dispose() { for (const m of this.all) m.dispose(); }
}
