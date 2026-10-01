// 2D procedural item icons for locker cards / slots (canvas). Cached as data URLs per item.
import { drawPattern, mix, hex } from '../preview/textures.js';
import { RARITY } from '../catalog.js';

const cache = new Map();
const W = 240, H = 176;

function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function bgFor(c, rarity) {
  const col = RARITY[rarity].css;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a3e48'); g.addColorStop(1, '#22252d'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const rg = c.createRadialGradient(W / 2, H * 0.55, 8, W / 2, H * 0.55, W * 0.62); rg.addColorStop(0, 'rgba(255,255,255,0.13)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = rg; c.fillRect(0, 0, W, H);
  const rg2 = c.createRadialGradient(W / 2, H * 1.05, 6, W / 2, H * 1.05, W * 0.6); rg2.addColorStop(0, col + '55'); rg2.addColorStop(1, col + '00'); c.fillStyle = rg2; c.fillRect(0, 0, W, H);
}
function patFill(c, kind, base, accent, size = 128) {
  const p = document.createElement('canvas'); p.width = p.height = size; drawPattern(p.getContext('2d'), size, kind, base, accent, (base ^ accent) & 0xffff);
  return c.createPattern(p, 'repeat');
}
const shadow = (c, col, b) => { c.shadowColor = col; c.shadowBlur = b; };
const noShadow = (c) => { c.shadowBlur = 0; c.shadowColor = 'transparent'; };

// ---------------------------------------------------------------- glyph painters (drawn in a 240x176 box, origin top-left)
function drawSuitBody(c, base, accent, pattern, material, s = 1, ox = 0, oy = 0) {
  c.save(); c.translate(W / 2 + ox, H / 2 + oy); c.scale(s, s); c.translate(-W / 2, -H / 2);
  const fill = pattern === 'solid' ? hex(base) : patFill(c, pattern, base, accent);
  const shape = () => {
    // legs
    rr(c, 96, 96, 22, 58, 6); rr(c, 122, 96, 22, 58, 6);
    // arms
    rr(c, 64, 42, 20, 58, 9); rr(c, 156, 42, 20, 58, 9);
    // torso
    rr(c, 84, 36, 72, 70, 12);
  };
  c.fillStyle = fill; c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2;
  // draw each piece separately so shading works
  const parts = [[96, 96, 22, 58, 6], [122, 96, 22, 58, 6], [64, 44, 20, 56, 9], [156, 44, 20, 56, 9], [84, 36, 72, 66, 12]];
  for (const [x, y, w, h, r] of parts) { rr(c, x, y, w, h, r); c.fillStyle = fill; c.fill(); c.stroke(); }
  // shading
  const sh = c.createLinearGradient(80, 0, 160, 0); sh.addColorStop(0, 'rgba(255,255,255,0.14)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
  c.fillStyle = sh; for (const [x, y, w, h, r] of parts) { rr(c, x, y, w, h, r); c.fill(); }
  if (material === 'metallic') { const g = c.createLinearGradient(80, 30, 160, 110); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.18)'); c.fillStyle = g; rr(c, 84, 36, 72, 66, 12); c.fill(); }
  if (material === 'holo') { const g = c.createLinearGradient(70, 30, 170, 130); g.addColorStop(0, 'rgba(255,80,220,0.35)'); g.addColorStop(0.5, 'rgba(80,255,240,0.25)'); g.addColorStop(1, 'rgba(255,240,90,0.3)'); c.fillStyle = g; for (const [x, y, w, h, r] of parts) { rr(c, x, y, w, h, r); c.fill(); } }
  // accent: shoulders, belt, knees
  c.fillStyle = hex(accent);
  rr(c, 60, 34, 28, 14, 5); c.fill(); rr(c, 152, 34, 28, 14, 5); c.fill(); rr(c, 84, 96, 72, 8, 3); c.fill(); rr(c, 96, 128, 22, 8, 3); c.fill(); rr(c, 122, 128, 22, 8, 3); c.fill();
  // head + neck
  c.fillStyle = '#1c1f27'; rr(c, 103, 8, 34, 32, 9); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.stroke();
  c.fillStyle = 'rgba(120,230,255,0.9)'; rr(c, 108, 20, 24, 8, 4); c.fill();
  c.restore(); void shape;
}
const ICONS = {
  suit(c, it) { drawSuitBody(c, it.base, it.accent, it.pattern, it.material, 1.02, 0, 4); },
  pattern(c, it) {
    // fabric swatch, slightly folded
    const acc = it.color ?? 0xffb627; const base = 0x2a2f3a; const kind = it.pattern === 'auto' ? 'chevron' : it.pattern;
    c.save(); rr(c, 40, 22, 160, 130, 10); c.clip(); c.fillStyle = patFill(c, kind, it.pattern === 'auto' ? 0x3a3f4a : base, it.pattern === 'auto' ? 0x9aa6b8 : acc, 160); c.fillRect(30, 12, 180, 150);
    const g = c.createLinearGradient(40, 22, 200, 152); g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); c.fillStyle = g; c.fillRect(30, 12, 180, 150); c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1.5; rr(c, 40, 22, 160, 130, 10); c.stroke();
    if (it.pattern === 'auto') { c.fillStyle = 'rgba(0,0,0,0.5)'; rr(c, 82, 66, 76, 42, 8); c.fill(); c.fillStyle = '#fff'; c.font = '700 22px "Barlow Condensed",Arial Narrow,sans-serif'; c.textAlign = 'center'; c.fillText('AUTO', 120, 95); }
  },
  helmet(c, it) {
    c.save(); c.translate(120, 96);
    const col = it.color, acc = it.accent;
    const dome = (r = 50, a = Math.PI) => { c.beginPath(); c.arc(0, 8, r, Math.PI, 0); c.lineTo(r, 20); c.lineTo(-r, 20); c.closePath(); };
    // head
    c.fillStyle = '#1c1f27'; rr(c, -40, 0, 80, 74, 18); c.fill();
    c.fillStyle = hex(mix(0x66d9ff, 0x000000, 0.2)); rr(c, -32, 26, 64, 16, 8); c.fill();
    const g = c.createLinearGradient(-50, -50, 50, 20); g.addColorStop(0, hex(mix(col, 0xffffff, 0.3))); g.addColorStop(1, hex(mix(col, 0x000000, 0.35)));
    if (it.shape === 'none') { c.fillStyle = '#2a2118'; c.beginPath(); c.arc(0, 10, 40, Math.PI, 0); c.lineTo(38, 12); c.lineTo(-38, 12); c.fill(); }
    else {
      if (it.shape === 'horns') { c.strokeStyle = hex(acc); c.lineWidth = 9; c.lineCap = 'round'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 32, -8); c.quadraticCurveTo(s * 62, -20, s * 52, -56); c.stroke(); } }
      if (it.shape === 'antenna') { c.strokeStyle = '#9aa0ad'; c.lineWidth = 4; c.beginPath(); c.moveTo(18, -38); c.lineTo(28, -78); c.stroke(); c.fillStyle = hex(acc); shadow(c, hex(acc), 14); c.beginPath(); c.arc(28, -80, 7, 0, 7); c.fill(); noShadow(c); }
      if (it.shape === 'halo') { c.strokeStyle = hex(acc); shadow(c, hex(acc), 16); c.lineWidth = 6; c.beginPath(); c.ellipse(0, -52, 46, 12, 0, 0, 7); c.stroke(); noShadow(c); }
      c.fillStyle = g; dome(it.shape === 'hex' ? 46 : 48); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 2; c.stroke();
      if (it.shape === 'hex') { c.strokeStyle = hex(acc); c.lineWidth = 2.5; c.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; c.lineTo(Math.cos(a) * 22, -14 + Math.sin(a) * 22 * 0.7); } c.closePath(); c.stroke(); }
      if (it.shape === 'crest') { c.fillStyle = hex(acc); c.beginPath(); c.moveTo(-34, -30); c.lineTo(-20, -68); c.lineTo(0, -80); c.lineTo(22, -66); c.lineTo(36, -30); c.lineTo(26, -34); c.lineTo(0, -58); c.lineTo(-24, -36); c.fill(); }
      if (it.shape === 'visorcap') { c.fillStyle = hex(acc); c.beginPath(); c.moveTo(-40, 16); c.lineTo(60, 12); c.lineTo(66, 22); c.lineTo(-40, 24); c.fill(); }
      c.fillStyle = hex(acc); c.fillRect(-46, 8, 92, 7);
      c.fillStyle = 'rgba(255,255,255,0.28)'; c.beginPath(); c.ellipse(-16, -22, 18, 8, -0.5, 0, 7); c.fill();
    }
    c.restore();
  },
  visor(c, it) {
    c.save(); c.translate(120, 88);
    c.fillStyle = '#1c1f27'; rr(c, -70, -52, 140, 108, 26); c.fill();
    const g = c.createLinearGradient(-70, -52, 70, 56); g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.3)'); c.fillStyle = g; rr(c, -70, -52, 140, 108, 26); c.fill();
    const col = hex(it.color), glow = hex(it.glow); shadow(c, glow, 20); c.fillStyle = col; c.strokeStyle = glow;
    switch (it.shape) {
      case 'wide': rr(c, -56, -14, 112, 34, 14); c.fill(); break;
      case 'slit': rr(c, -58, -4, 116, 14, 7); c.fill(); break;
      case 'round': for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 30, 2, 22, 0, 7); c.fill(); } break;
      case 'shades': c.fillStyle = col; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 6, -14); c.lineTo(s * 56, -14); c.lineTo(s * 50, 20); c.lineTo(s * 12, 20); c.closePath(); c.fill(); c.lineWidth = 3; c.stroke(); } break;
      case 'cyclops': c.beginPath(); c.arc(0, 4, 24, 0, 7); c.fill(); c.lineWidth = 5; c.stroke(); break;
      case 'x': c.lineWidth = 12; c.lineCap = 'round'; c.beginPath(); c.moveTo(-42, -22); c.lineTo(42, 28); c.moveTo(42, -22); c.lineTo(-42, 28); c.stroke(); break;
    }
    noShadow(c); c.restore();
  },
  back(c, it) {
    c.save(); c.translate(120, 92); const col = hex(it.color), dk = hex(mix(it.color, 0x000000, 0.5)), lt = hex(mix(it.color, 0xffffff, 0.4));
    switch (it.model) {
      case 'none': c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 34, 0, 7); c.moveTo(-24, 24); c.lineTo(24, -24); c.stroke(); break;
      case 'pack': { c.fillStyle = col; rr(c, -40, -56, 80, 108, 16); c.fill(); c.fillStyle = dk; rr(c, -30, -8, 60, 40, 8); c.fill(); rr(c, -52, -22, 14, 52, 6); c.fill(); rr(c, 38, -22, 14, 52, 6); c.fill(); c.fillStyle = lt; rr(c, -26, -42, 52, 8, 4); c.fill(); break; }
      case 'wings': { for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { c.save(); c.scale(s, 1); c.rotate(-0.15 - i * 0.26); c.fillStyle = i % 2 ? col : lt; shadow(c, col, 8); c.beginPath(); c.moveTo(10, 30); c.lineTo(20, -12 - 52 + i * 4); c.lineTo(8, -70 + i * 6); c.lineTo(0, 0); c.fill(); c.restore(); } noShadow(c); break; }
      case 'tail': { c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = 26; c.beginPath(); c.moveTo(-40, 46); c.bezierCurveTo(-20, -10, 40, 30, 46, -46); c.stroke(); c.strokeStyle = lt; c.lineWidth = 8; c.beginPath(); c.moveTo(-40, 46); c.bezierCurveTo(-20, -10, 40, 30, 46, -46); c.stroke(); break; }
      case 'jet': { for (const s of [-1, 1]) { c.fillStyle = dk; rr(c, s * 24 - 14, -46, 28, 74, 10); c.fill(); c.fillStyle = col; rr(c, s * 24 - 10, -40, 20, 52, 8); c.fill(); shadow(c, col, 18); c.fillStyle = lt; c.beginPath(); c.moveTo(s * 24 - 10, 30); c.lineTo(s * 24 + 10, 30); c.lineTo(s * 24, 64); c.fill(); noShadow(c); } break; }
      case 'banner': { c.fillStyle = dk; c.fillRect(-2, -66, 4, 130); c.fillRect(-32, -66, 64, 4); c.fillStyle = col; c.beginPath(); c.moveTo(-28, -62); c.lineTo(28, -62); c.lineTo(28, 36); c.lineTo(0, 22); c.lineTo(-28, 36); c.closePath(); c.fill(); c.fillStyle = lt; c.fillRect(-28, -30, 56, 8); c.fillRect(-28, 0, 56, 4); break; }
    }
    c.restore();
  },
  trail(c, it) {
    c.save();
    if (it.type === 'none') { c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 6; c.beginPath(); c.arc(120, 88, 34, 0, 7); c.moveTo(96, 112); c.lineTo(144, 64); c.stroke(); c.restore(); return; }
    const a = hex(it.color), b = hex(it.color2);
    const path = (t) => [30 + t * 180, 100 - Math.sin(t * 3.1) * 40 + (1 - t) * 20];
    if (it.type === 'ribbon') { for (let k = 0; k < 2; k++) { const gr = c.createLinearGradient(30, 0, 210, 0); gr.addColorStop(0, b + '00'); gr.addColorStop(1, a); c.strokeStyle = gr; c.lineWidth = 8 - k * 3; shadow(c, a, 12); c.beginPath(); for (let i = 0; i <= 30; i++) { const [x, y] = path(i / 30); i ? c.lineTo(x, y + k * 16) : c.moveTo(x, y + k * 16); } c.stroke(); } noShadow(c); }
    else { for (let i = 0; i < 46; i++) { const t = Math.pow(i / 46, 0.8), [x, y] = path(t); const jx = Math.sin(i * 12.9) * 8, jy = Math.cos(i * 7.7) * 12 + (it.type === 'sparks' ? t * 12 : 0); const r = 1.5 + t * (it.type === 'comet' ? 9 : 5); c.globalAlpha = 0.25 + t * 0.75; c.fillStyle = i % 3 ? a : b;
      if (it.type === 'pixels') { c.fillRect(x + jx, y + jy, r * 1.4, r * 1.4); } else if (it.type === 'petals') { c.save(); c.translate(x + jx, y + jy); c.rotate(i); c.beginPath(); c.ellipse(0, 0, r * 1.7, r * 0.9, 0, 0, 7); c.fill(); c.restore(); } else { shadow(c, a, it.type === 'comet' ? 10 : 6); c.beginPath(); c.arc(x + jx * (it.type === 'comet' ? 0.3 : 1), y + jy * (it.type === 'comet' ? 0.3 : 1), r, 0, 7); c.fill(); noShadow(c); } } c.globalAlpha = 1; }
    c.restore();
  },
  tagOut(c, it) {
    c.save(); c.translate(120, 88); const col = hex(it.color); const rnd = (i) => { const x = Math.sin(i * 91.7 + 3.1) * 43758.5; return x - Math.floor(x); };
    // silhouette fading into pieces
    c.fillStyle = 'rgba(255,255,255,0.08)'; rr(c, -22, -50, 44, 100, 16); c.fill();
    const n = 34;
    for (let i = 0; i < n; i++) {
      const a = rnd(i) * 6.283, r = 16 + rnd(i + 50) * 66, x = Math.cos(a) * r * 1.15, y = Math.sin(a) * r * 0.85, s = 3 + rnd(i + 9) * 9; c.save(); c.translate(x, y); c.rotate(rnd(i + 3) * 6);
      switch (it.effect) {
        case 'shatter': c.fillStyle = i % 2 ? col : '#e9fbff'; c.globalAlpha = 0.9; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.9, s * 0.7); c.lineTo(-s * 0.8, s * 0.6); c.closePath(); c.fill(); break;
        case 'confetti': c.fillStyle = ['#ff6fb5', '#ffd166', '#5fe6ff', '#a6ff6a', '#c38bff'][i % 5]; c.fillRect(-s * 0.4, -s * 0.7, s * 0.8, s * 1.4); break;
        case 'pixelate': c.fillStyle = i % 3 ? col : '#ffffff'; c.fillRect(Math.round(x / 8) * 8 - x, Math.round(y / 8) * 8 - y, 7, 7); break;
        case 'fireworks': { c.strokeStyle = i % 2 ? col : '#ffe9a8'; c.lineWidth = 2.5; c.lineCap = 'round'; shadow(c, col, 8); c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 0 + s, 0); c.stroke(); noShadow(c); break; }
        case 'petals': c.fillStyle = i % 2 ? col : '#fff0f5'; c.beginPath(); c.ellipse(0, 0, s * 1.1, s * 0.6, 0, 0, 7); c.fill(); break;
        case 'stars': c.fillStyle = i % 2 ? col : '#fff'; shadow(c, col, 8); c.beginPath(); for (let k = 0; k < 10; k++) { const rr2 = k % 2 ? s * 0.4 : s; const aa = k / 10 * 6.283 - 1.57; c.lineTo(Math.cos(aa) * rr2, Math.sin(aa) * rr2); } c.closePath(); c.fill(); noShadow(c); break;
      }
      c.restore();
    }
    if (it.effect === 'fireworks') { for (let k = 0; k < 3; k++) { const cx = (k - 1) * 46, cy = -30 + (k % 2) * 30; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; c.strokeStyle = k === 1 ? col : '#ffe9a8'; c.lineWidth = 2.5; c.lineCap = 'round'; shadow(c, col, 8); c.beginPath(); c.moveTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8); c.lineTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24); c.stroke(); } } noShadow(c); }
    c.restore();
  },
  skin(c, it) {
    // rifle silhouette with the skin pattern
    c.save(); c.translate(120, 90); c.scale(1.02, 1.02);
    const fill = patFill(c, it.pattern, it.primary, it.accent, 128);
    const g = (x, y, w, h, r, f = fill) => { rr(c, x, y, w, h, r); c.fillStyle = f; c.fill(); c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 2; c.stroke(); };
    g(-96, -20, 46, 24, 6, hex(mix(it.primary, 0x0a0b10, 0.75)));      // stock
    g(-52, -26, 100, 28, 6);                                             // receiver
    g(46, -22, 52, 20, 4, hex(it.accent));                              // handguard
    g(96, -14, 30, 7, 2, hex(mix(it.primary, 0x0a0b10, 0.75)));       // barrel
    c.save(); c.rotate(-0.3); g(-4, 4, 22, 52, 5, hex(mix(it.primary, 0x0a0b10, 0.75))); c.restore();   // mag
    c.save(); c.rotate(0.28); g(-44, 4, 20, 40, 5, hex(mix(it.primary, 0x0a0b10, 0.75))); c.restore();   // grip
    g(-30, -36, 46, 10, 3, hex(mix(it.primary, 0x0a0b10, 0.75)));
    shadow(c, hex(it.glow), 14); c.fillStyle = hex(it.glow); rr(c, -44, -22, 88, 4, 2); c.fill(); noShadow(c);
    const gl = c.createLinearGradient(-90, -30, 90, 20); gl.addColorStop(0, 'rgba(255,255,255,0.22)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.25)'); c.fillStyle = gl; rr(c, -96, -36, 220, 60, 8); c.fill();
    c.restore();
  },
  charm(c, it) {
    c.save(); c.translate(120, 40); const col = hex(it.color), lt = hex(mix(it.color, 0xffffff, 0.5));
    c.strokeStyle = '#aab0bd'; c.lineWidth = 3; c.setLineDash([5, 4]); c.beginPath(); c.moveTo(0, -40); c.lineTo(0, 22); c.stroke(); c.setLineDash([]); c.translate(0, 74);
    if (it.model === 'none') { c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 32, 0, 7); c.moveTo(-22, 22); c.lineTo(22, -22); c.stroke(); c.restore(); return; }
    shadow(c, col, 22);
    switch (it.model) {
      case 'orb': { const g = c.createRadialGradient(-10, -10, 4, 0, 0, 34); g.addColorStop(0, '#fff'); g.addColorStop(0.35, lt); g.addColorStop(1, col); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 34, 0, 7); c.fill(); break; }
      case 'cube': { c.fillStyle = col; c.fillRect(-26, -26, 52, 52); noShadow(c); c.fillStyle = lt; c.beginPath(); c.moveTo(-26, -26); c.lineTo(-14, -38); c.lineTo(38, -38); c.lineTo(26, -26); c.fill(); c.fillStyle = hex(mix(it.color, 0x000000, 0.35)); c.beginPath(); c.moveTo(26, -26); c.lineTo(38, -38); c.lineTo(38, 14); c.lineTo(26, 26); c.fill(); break; }
      case 'star': { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 15 : 40, a = i / 10 * 6.283 - 1.57; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); noShadow(c); c.fillStyle = lt; c.globalAlpha = 0.5; c.beginPath(); c.arc(-6, -8, 10, 0, 7); c.fill(); c.globalAlpha = 1; break; }
      case 'cat': { c.fillStyle = col; c.beginPath(); c.arc(0, 4, 32, 0, 7); c.fill(); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 12, -20); c.lineTo(s * 34, -46); c.lineTo(s * 34, -10); c.fill(); } noShadow(c); c.fillStyle = '#111'; for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 12, 2, 4, 0, 7); c.fill(); } c.fillRect(-2, 10, 4, 4); c.strokeStyle = '#111'; c.lineWidth = 1.6; for (const s of [-1, 1]) for (const k of [-3, 3]) { c.beginPath(); c.moveTo(s * 18, 12 + k); c.lineTo(s * 36, 12 + k * 2.4); c.stroke(); } break; }
      case 'bolt': { c.fillStyle = col; c.beginPath(); c.moveTo(10, -42); c.lineTo(-24, 4); c.lineTo(-2, 4); c.lineTo(-12, 42); c.lineTo(26, -10); c.lineTo(4, -10); c.lineTo(20, -42); c.closePath(); c.fill(); break; }
    }
    noShadow(c); c.restore();
  },
  nameplate(c, it) {
    c.save(); c.translate(120, 88); const col = hex(it.color);
    c.font = '700 40px "Barlow Condensed","Arial Narrow",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (it.style === 'hex') { c.beginPath(); c.moveTo(-84, 0); c.lineTo(-62, -30); c.lineTo(62, -30); c.lineTo(84, 0); c.lineTo(62, 30); c.lineTo(-62, 30); c.closePath(); c.fillStyle = 'rgba(8,10,16,0.75)'; c.fill(); c.strokeStyle = col; c.lineWidth = 3; shadow(c, col, 12); c.stroke(); noShadow(c); c.fillStyle = '#fff'; c.fillText('PLAYER', 0, 2); }
    else if (it.style === 'glow') { shadow(c, col, 22); c.fillStyle = col; for (let i = 0; i < 2; i++) c.fillText('PLAYER', 0, 0); noShadow(c); c.fillStyle = '#fff'; c.fillText('PLAYER', 0, 0); c.fillStyle = col; c.fillRect(-56, 28, 112, 3); }
    else { shadow(c, 'rgba(0,0,0,0.8)', 8); c.fillStyle = col; c.fillText('PLAYER', 0, 0); noShadow(c); c.fillStyle = '#7f8798'; c.fillRect(-46, 28, 92, 3); }
    c.restore();
  },
  emote(c, it) {
    // little stick-figure key pose for each emote
    c.save(); c.translate(120, 90); c.strokeStyle = '#e9eef7'; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round'; shadow(c, 'rgba(120,200,255,0.5)', 10);
    const line = (...p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); };
    const head = (x, y) => { c.fillStyle = '#e9eef7'; c.beginPath(); c.arc(x, y, 12, 0, 7); c.fill(); };
    let by = 0, hx = 0;
    switch (it.anim) {
      case 'wave': head(0, -50); line(0, -36, 0, 10); line(0, -28, 30, -50, 44, -74); line(0, -28, -22, -4); line(0, 10, -16, 52); line(0, 10, 16, 52); c.strokeStyle = 'rgba(120,220,255,0.8)'; c.lineWidth = 3; c.beginPath(); c.arc(50, -76, 12, -1, 1); c.stroke(); break;
      case 'salute': head(0, -50); line(0, -36, 0, 10); line(0, -28, 24, -34, 12, -54); line(0, -28, -22, -4); line(0, 10, -12, 52); line(0, 10, 12, 52); break;
      case 'flex': head(0, -50); line(0, -36, 0, 10); line(0, -28, 38, -20, 38, -52); line(0, -28, -38, -20, -38, -52); line(0, 10, -22, 52); line(0, 10, 22, 52); break;
      case 'shuffle': head(8, -50); line(6, -36, 0, 8); line(6, -28, 30, -16); line(6, -28, -20, -8); line(0, 8, -26, 30, -34, 52); line(0, 8, 20, 30, 20, 52); break;
      case 'shrug': head(0, -48); line(0, -34, 0, 10); line(0, -28, 32, -16, 46, -32); line(0, -28, -32, -16, -46, -32); line(0, 10, -14, 52); line(0, 10, 14, 52); break;
      case 'spin': head(0, -50); line(0, -36, 0, 10); line(0, -28, 44, -24); line(0, -28, -44, -24); line(0, 10, -10, 52); line(0, 10, 10, 52); c.strokeStyle = 'rgba(120,220,255,0.7)'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 66, 0.3, 4.6); c.stroke(); break;
      case 'cheer': head(0, -44); line(0, -30, 0, 14); line(0, -24, 30, -52, 34, -78); line(0, -24, -30, -52, -34, -78); line(0, 14, -22, 30, -12, 48); line(0, 14, 22, 30, 12, 48); break;
      case 'point': head(-6, -50); line(-4, -36, 0, 10); line(-4, -28, 46, -30, 78, -32); line(-4, -28, -24, -4); line(0, 10, -12, 52); line(0, 10, 16, 52); break;
      case 'clap': head(0, -50); line(0, -36, 0, 10); line(0, -28, 20, -12, 4, -10); line(0, -28, -20, -12, -4, -10); line(0, 10, -12, 52); line(0, 10, 12, 52); c.strokeStyle = 'rgba(255,220,120,0.9)'; c.lineWidth = 3; line(-18, -30, -24, -36); line(18, -30, 24, -36); line(0, -24, 0, -34); break;
      case 'robot': head(0, -50); line(0, -36, 0, 10); line(0, -28, 36, -28, 36, -56); line(0, -28, -36, -28, -36, 0); line(0, 10, -18, 10, -18, 52); line(0, 10, 18, 10, 18, 52); break;
      case 'bow': head(30, -12); line(24, -4, -6, 8); line(20, 0, 34, 30); line(-6, 8, -18, 52); line(-6, 8, 8, 52); break;
      case 'sway': head(-10, -48); line(-6, -34, 6, 10); line(-6, -26, 26, -44, 38, -70); line(-6, -26, -34, -40, -48, -66); line(6, 10, -6, 52); line(6, 10, 24, 50); break;
      default: head(0, -50); line(0, -36, 0, 10); line(0, 10, -12, 52); line(0, 10, 12, 52);
    }
    void by; void hx; noShadow(c); c.restore();
  },
};

/** Render item icon to a data URL (cached). */
export function iconFor(item, scale = 1.5) {
  const key = item.id + '|' + scale; let u = cache.get(key); if (u) return u;
  const cv = document.createElement('canvas'); cv.width = W * scale; cv.height = H * scale; const c = cv.getContext('2d'); c.scale(scale, scale);
  bgFor(c, item.rarity);
  try { ICONS[item.cat]?.(c, item); } catch { /* icon failures must never break the UI */ }
  // subtle vignette
  const v = c.createLinearGradient(0, H * 0.7, 0, H); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.25)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
  u = cv.toDataURL('image/png'); cache.set(key, u); return u;
}
export function slotIconFor(item) { return iconFor(item, 0.75); }
