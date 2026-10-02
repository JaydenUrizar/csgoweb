// Procedural canvas textures for suit patterns and tagger skins (with wear). Cached.
import * as THREE from 'three';

const cache = new Map();
const hex = (c) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mix = (a, b, t) => { const r = (a >> 16) & 255, g = (a >> 8) & 255, bl = a & 255, r2 = (b >> 16) & 255, g2 = (b >> 8) & 255, b2 = b & 255; return ((r + (r2 - r) * t) << 16) | ((g + (g2 - g) * t) << 8) | (bl + (b2 - bl) * t); };
export { hex, mix };

/** Draw a pattern into ctx over a size x size tile (tileable-ish). */
export function drawPattern(ctx, size, kind, base, accent, seed = 1) {
  const S = size, rnd = mulberry(seed * 977 + 13);
  ctx.fillStyle = hex(base); ctx.fillRect(0, 0, S, S);
  ctx.save();
  switch (kind) {
    case 'stripes': {
      const n = 6, w = S / n / 2;
      ctx.fillStyle = hex(accent);
      for (let i = 0; i < n; i++) ctx.fillRect(i * S / n + w * 0.5, 0, w, S);
      break;
    }
    case 'chevron': {
      const n = 4, h = S / n;
      ctx.lineWidth = S / 20; ctx.strokeStyle = hex(accent); ctx.lineCap = 'butt';
      for (let i = -1; i < n + 1; i++) { ctx.beginPath(); ctx.moveTo(0, i * h + h * 0.55); ctx.lineTo(S / 2, i * h - h * 0.1 + h * 0.55 - h * 0.35 + h * 0.35); ctx.lineTo(S, i * h + h * 0.55); ctx.stroke(); }
      ctx.strokeStyle = hex(mix(base, accent, 0.4)); ctx.lineWidth = S / 44;
      for (let i = -1; i < n + 1; i++) { ctx.beginPath(); ctx.moveTo(0, i * h + h * 0.8); ctx.lineTo(S / 2, i * h + h * 0.25 + h * 0.35); ctx.lineTo(S, i * h + h * 0.8); ctx.stroke(); }
      break;
    }
    case 'hex': {
      const r = S / 8, hh = r * Math.sqrt(3);
      ctx.strokeStyle = hex(accent); ctx.lineWidth = S / 64;
      for (let row = -1; row < S / hh + 1; row++) for (let col = -1; col < S / (r * 1.5) + 1; col++) {
        const cx = col * r * 1.5, cy = row * hh + (col & 1 ? hh / 2 : 0);
        ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; const x = cx + Math.cos(a) * r * 0.9, y = cy + Math.sin(a) * r * 0.9; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath();
        if ((row * 7 + col * 3) % 5 === 0) { ctx.globalAlpha = 0.5; ctx.fillStyle = hex(accent); ctx.fill(); ctx.globalAlpha = 1; }
        ctx.stroke();
      }
      break;
    }
    case 'camo': {
      const cols = [mix(base, 0x000000, 0.3), mix(base, accent, 0.35), mix(base, accent, 0.65)];
      for (let k = 0; k < 44; k++) {
        ctx.fillStyle = hex(cols[k % 3]); const cx = rnd() * S, cy = rnd() * S, rr = S * (0.06 + rnd() * 0.12);
        // blocky pixel camo
        const px = S / 32; ctx.beginPath();
        for (let j = 0; j < 7; j++) { const w = (rr * (0.5 + rnd())) | 0; ctx.rect(((cx + (rnd() - 0.5) * rr * 2) / px | 0) * px, ((cy + (rnd() - 0.5) * rr * 2) / px | 0) * px, (w / px | 0 || 1) * px, (px * (1 + (rnd() * 3 | 0)))); }
        ctx.fill();
      }
      break;
    }
    case 'circuit': {
      ctx.strokeStyle = hex(accent); ctx.fillStyle = hex(accent); ctx.lineWidth = S / 90; ctx.lineJoin = 'round';
      const g = S / 16;
      for (let k = 0; k < 20; k++) {
        let x = ((rnd() * 16) | 0) * g, y = ((rnd() * 16) | 0) * g; ctx.beginPath(); ctx.moveTo(x, y);
        const segs = 2 + (rnd() * 3 | 0);
        for (let j = 0; j < segs; j++) { if (rnd() < 0.5) x += (((rnd() * 5) | 0) - 2) * g; else y += (((rnd() * 5) | 0) - 2) * g; ctx.lineTo(x, y); }
        ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, S / 60, 0, 6.3); ctx.fill();
      }
      break;
    }
    case 'gradient': {
      const gr = ctx.createLinearGradient(0, 0, 0, S);
      gr.addColorStop(0, hex(mix(base, accent, 0.0))); gr.addColorStop(0.55, hex(mix(base, accent, 0.45))); gr.addColorStop(1, hex(accent));
      ctx.fillStyle = gr; ctx.fillRect(0, 0, S, S);
      break;
    }
    case 'checker': {
      const n = 8, c = S / n; ctx.fillStyle = hex(accent);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) & 1) ctx.fillRect(i * c, j * c, c, c);
      break;
    }
    default: break;        // solid
  }
  ctx.restore();
}

/** Suit texture (256², repeat). */
export function suitTexture(kind, base, accent) {
  const key = `s|${kind}|${base}|${accent}`;
  let t = cache.get(key); if (t) return t;
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const ctx = cv.getContext('2d'); drawPattern(ctx, 256, kind, base, accent, (base ^ accent) & 0xffff);
  t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(key, t); return t;
}

/** Tagger skin texture with wear (0..1): scuffs, edge wear, dirt. */
export function skinTexture(kind, primary, accent, wear, decal = 'none', glow = 0xffffff) {
  const w = Math.round(wear * 20) / 20;
  const key = `k|${kind}|${primary}|${accent}|${w}|${decal}`;
  let t = cache.get(key); if (t) return t;
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d'); drawPattern(ctx, S, kind, primary, accent, (primary ^ accent) & 0xffff);
  drawDecal(ctx, S, decal, accent, glow, primary);
  paintWear(ctx, S, w, primary);
  t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(key, t); return t;
}
/** Skin decals (bold, readable at gun scale). Painted over the base pattern. */
export function drawDecal(c, S, decal, accent, glow, primary) {
  if (!decal || decal === 'none') return; const A = hex(accent), G = hex(glow), D = hex(mix(primary, 0x000000, 0.6)); c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  const rnd = mulberry(77 + decal.length * 13);
  switch (decal) {
    case 'bars': c.fillStyle = A; for (let i = -2; i < 12; i++) { c.beginPath(); c.moveTo(i * S / 6, 0); c.lineTo(i * S / 6 + S / 12, 0); c.lineTo(i * S / 6 + S / 12 + S / 3, S); c.lineTo(i * S / 6 + S / 3, S); c.fill(); } break;
    case 'arrows': c.strokeStyle = A; c.lineWidth = S / 14; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(S * 0.15, i * S / 4 + S * 0.1); c.lineTo(S * 0.5, i * S / 4 + S * 0.22); c.lineTo(S * 0.85, i * S / 4 + S * 0.1); c.stroke(); } break;
    case 'scales': c.strokeStyle = A; c.lineWidth = S / 40; for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { c.beginPath(); c.arc(x * S / 8 + (y & 1 ? S / 16 : 0), y * S / 14, S / 16, 0, Math.PI); c.stroke(); } break;
    case 'dots': c.fillStyle = A; for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { c.beginPath(); c.arc(x * S / 5 + S / 10 + (y & 1 ? S / 10 : 0), y * S / 5 + S / 10, S / 18, 0, 7); c.fill(); } break;
    case 'bolt': c.fillStyle = G; c.beginPath(); c.moveTo(S * 0.6, 0); c.lineTo(S * 0.25, S * 0.55); c.lineTo(S * 0.5, S * 0.55); c.lineTo(S * 0.35, S); c.lineTo(S * 0.8, S * 0.38); c.lineTo(S * 0.55, S * 0.38); c.lineTo(S * 0.75, 0); c.fill(); break;
    case 'flame': for (const [col, k] of [[A, 1], [G, 0.62]]) { c.fillStyle = col; for (let i = 0; i < 6; i++) { const x = i * S / 5; c.beginPath(); c.moveTo(x - S / 10, S); c.quadraticCurveTo(x, S * (0.55 - 0.2 * k * (i % 2)), x + S / 14, S * (0.2 + 0.3 * k + 0.1 * (i % 2))); c.quadraticCurveTo(x + S / 8, S * 0.6, x + S / 8, S); c.fill(); } } break;
    case 'sun': c.fillStyle = G; c.beginPath(); c.arc(S / 2, S / 2, S * 0.2, 0, 7); c.fill(); c.strokeStyle = A; c.lineWidth = S / 26; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; c.beginPath(); c.moveTo(S / 2 + Math.cos(a) * S * 0.28, S / 2 + Math.sin(a) * S * 0.28); c.lineTo(S / 2 + Math.cos(a) * S * 0.45, S / 2 + Math.sin(a) * S * 0.45); c.stroke(); } break;
    case 'wave': c.strokeStyle = A; c.lineWidth = S / 22; for (let r = 0; r < 6; r++) { c.beginPath(); for (let x = 0; x <= S; x += 8) { const y = r * S / 5 + Math.sin(x / S * 12.5 + r) * S / 22; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } break;
    case 'bubbles': c.strokeStyle = G; c.lineWidth = S / 50; for (let i = 0; i < 16; i++) { c.beginPath(); c.arc(rnd() * S, rnd() * S, S * (0.03 + rnd() * 0.07), 0, 7); c.stroke(); } break;
    case 'grid': c.strokeStyle = G; c.lineWidth = S / 70; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * S / 8, 0); c.lineTo(i * S / 8, S); c.moveTo(0, i * S / 8); c.lineTo(S, i * S / 8); c.stroke(); } break;
    case 'lantern': c.fillStyle = G; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(S * (0.2 + i * 0.3), S / 2, S * 0.1, S * 0.16, 0, 0, 7); c.fill(); c.fillStyle = A; c.fillRect(S * (0.2 + i * 0.3) - 3, S * 0.3, 6, S * 0.4); c.fillStyle = G; } break;
    case 'leaf': c.fillStyle = A; for (let i = 0; i < 7; i++) { c.save(); c.translate(rnd() * S, rnd() * S); c.rotate(rnd() * 6); c.beginPath(); c.ellipse(0, 0, S * 0.09, S * 0.04, 0, 0, 7); c.fill(); c.restore(); } break;
    case 'static': for (let i = 0; i < 260; i++) { c.fillStyle = rnd() < 0.5 ? A : G; c.globalAlpha = 0.25 + rnd() * 0.6; c.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 14, 2); } c.globalAlpha = 1; break;
    case 'laurel': c.fillStyle = A; for (const sx of [0.3, 0.7]) for (let i = 0; i < 6; i++) { c.save(); c.translate(S * sx, S * (0.15 + i * 0.13)); c.rotate((sx < 0.5 ? -0.6 : 0.6)); c.beginPath(); c.ellipse(0, 0, S * 0.1, S * 0.04, 0, 0, 7); c.fill(); c.restore(); } break;
    case 'ring': c.strokeStyle = G; c.lineWidth = S / 20; c.beginPath(); c.arc(S / 2, S / 2, S * 0.3, 0, 7); c.stroke(); c.strokeStyle = D; c.lineWidth = S / 8; c.beginPath(); c.arc(S / 2, S / 2, S * 0.42, 0, 7); c.stroke(); break;
  }
  c.restore();
}
export function paintWear(ctx, S, wear, base = 0x444444) {
  if (wear <= 0.02) return;
  const rnd = mulberry(4242 + ((wear * 100) | 0));
  // dirt gradient from edges
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.75);
  g.addColorStop(0, 'rgba(20,16,12,0)'); g.addColorStop(1, `rgba(24,18,12,${0.15 + wear * 0.6})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  // scratches
  const nSc = Math.floor(wear * 70);
  ctx.lineCap = 'round';
  for (let i = 0; i < nSc; i++) {
    const x = rnd() * S, y = rnd() * S, a = rnd() * 6.28, l = 8 + rnd() * S * 0.28;
    ctx.strokeStyle = `rgba(${200 + (rnd() * 55 | 0)},${200 + (rnd() * 55 | 0)},${205},${0.16 + rnd() * 0.5})`; ctx.lineWidth = 0.6 + rnd() * 1.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  // paint chips down to bare metal
  const nCh = Math.floor(wear * wear * 90);
  for (let i = 0; i < nCh; i++) {
    const x = rnd() * S, y = rnd() * S, r = 1 + rnd() * (2 + wear * 8);
    ctx.fillStyle = `rgba(${120 + (rnd() * 40 | 0)},${124 + (rnd() * 40 | 0)},${130 + (rnd() * 40 | 0)},0.9)`;
    ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28, rr = r * (0.5 + rnd() * 0.9); ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill();
  }
  // grime speckle
  const nSp = Math.floor(wear * 900);
  for (let i = 0; i < nSp; i++) { ctx.fillStyle = `rgba(20,16,12,${rnd() * 0.5})`; ctx.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2); }
}

/** Soft radial gradient texture (glow sprites / shadows). */
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const key = `r|${inner}|${outer}|${size}`; let t = cache.get(key); if (t) return t;
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; cache.set(key, t); return t;
}

/** Studio backdrop tinted for a side. */
export function backdropTexture(team) {
  const key = `b|${team}`; let t = cache.get(key); if (t) return t;
  const W = 512, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
  const warm = team !== 'tide';
  const c0 = warm ? '#3a1c12' : '#0f2b3a', c1 = warm ? '#1a0d0d' : '#0a1522', c2 = warm ? '#0b0709' : '#050a12';
  const g = ctx.createRadialGradient(W * 0.5, H * 0.58, 20, W * 0.5, H * 0.58, W * 0.78);
  g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // faint floor horizon glow
  const g2 = ctx.createLinearGradient(0, H * 0.55, 0, H); g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(1, warm ? 'rgba(255,120,50,0.10)' : 'rgba(40,200,255,0.10)');
  ctx.fillStyle = g2; ctx.fillRect(0, H * 0.55, W, H * 0.45);
  t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; cache.set(key, t); return t;
}
