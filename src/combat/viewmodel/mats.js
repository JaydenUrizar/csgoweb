// Materials + procedural skin patterns for viewmodel/world tagger models.
import * as THREE from 'three';

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
    case 'stripes': g.fillStyle = A; for (let i = -N; i < N * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 14, 0); g.lineTo(i + 14 - N, N); g.lineTo(i - N, N); g.fill(); } break;
    case 'hex': g.strokeStyle = A; g.lineWidth = 3; { const r = 16, h = r * Math.sqrt(3); for (let y = -1; y < 5; y++) for (let x = -1; x < 6; x++) { const cx = x * r * 3 + (y & 1 ? r * 1.5 : 0), cy = y * h / 2 * 1; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.stroke(); } } break;
    case 'chevron': g.fillStyle = A; for (let y = -N; y < N * 2; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(N / 2, y + 22); g.lineTo(N, y); g.lineTo(N, y + 10); g.lineTo(N / 2, y + 32); g.lineTo(0, y + 10); g.fill(); } break;
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

/** A full material set for one tagger model. `keys` -> Material. Call apply(skin) to (re)skin, update() to drive glow/heat. */
export class MatSet {
  constructor(defaults) {
    this.defaults = defaults; this.skin = null; this.glowK = 2.4;
    const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
    this.body = std({ roughness: 0.42, metalness: 0.28, envMapIntensity: 1.0 });
    this.trim = std({ roughness: 0.3, metalness: 0.75 });
    this.dark = std({ roughness: 0.45, metalness: 0.55 });
    this.rubber = std({ roughness: 0.92, metalness: 0.0 });
    this.grip = std({ roughness: 0.75, metalness: 0.1 });
    this.glow = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.core = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.coreOff = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.vent = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.glass = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.32, depthWrite: false, vertexColors: true, envMapIntensity: 1.6 });
    this.lens = new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.04, metalness: 0.9, emissive: 0x000000, envMapIntensity: 2.0, vertexColors: true });
    this.all = [this.body, this.trim, this.dark, this.rubber, this.grip, this.glow, this.core, this.coreOff, this.vent, this.glass, this.lens];
    this.glowColor = new THREE.Color(); this.heat = 0; this.ammoColor = new THREE.Color(); this.flash = 0;
    this.apply(null);
  }
  apply(skin) {
    const d = this.defaults, s = { ...d, ...(skin || {}) };
    for (const k of ['pattern', 'primary', 'accent', 'glow', 'wear']) if (s[k] == null) s[k] = d[k];
    this.skin = s;
    const tex = patternTexture(s.pattern, s.primary, s.accent, s.wear || 0);
    this.body.map = tex; this.body.color.set(tex ? 0xffffff : s.primary); this.body.needsUpdate = true;
    this.trim.color.set(s.accent);
    this.dark.color.copy(shade(s.primary, 0.32)).lerp(_c.set(0x1b2029), 0.55);
    this.grip.color.copy(shade(s.accent, 0.28)).lerp(_c.set(0x1a1a20), 0.5);
    this.rubber.color.set(0x14161a);
    this.glowColor.set(s.glow); this.glass.color.set(s.glow).lerp(_c.set(0xffffff), 0.55);
    this.glass.emissive?.copy(this.glowColor).multiplyScalar(0.08);
    this.update(0, 0, 1, 0);
    return this;
  }
  /** heat 0..1 (vent/barrel glow), ammoFrac 0..1 (core colour), pulse 0..1 extra glow (fire flash). */
  update(heat, ammoFrac, ammoKnown = 1, pulse = 0, t = 0) {
    this.heat = heat;
    const gk = this.glowK * (1 + pulse * 0.9 + 0.06 * Math.sin(t * 2.2));
    this.glow.color.copy(this.glowColor).multiplyScalar(gk);
    // ammo colour: accent glow -> amber -> red as the cell empties
    const f = ammoFrac;
    if (f > 0.5) this.ammoColor.copy(this.glowColor); else if (f > 0.25) this.ammoColor.copy(this.glowColor).lerp(_c.set(0xffb020), (0.5 - f) / 0.25); else this.ammoColor.set(0xffb020).lerp(_c.set(0xff2a2a), (0.25 - f) / 0.25);
    const blink = f < 0.2 && ammoKnown ? 0.75 + 0.25 * Math.sin(t * 14) : 1;
    this.core.color.copy(this.ammoColor).multiplyScalar(gk * 1.05 * blink);
    this.coreOff.color.copy(this.glowColor).multiplyScalar(0.06).add(_c.set(0x040608));
    if (heat < 0.5) _c.copy(HEAT_COLD).lerp(HEAT_WARM, heat * 2); else _c.copy(HEAT_WARM).lerp(HEAT_HOT, (heat - 0.5) * 2);
    this.vent.color.copy(_c).multiplyScalar(0.25 + heat * 3.2);
  }
  dispose() { for (const m of this.all) m.dispose(); }
}
