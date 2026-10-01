// Crosshair designer: shared drawing routine, share-code import/export, and the big live-preview editor.
import { h } from './ui.js';

export const XH_DEFAULT = { style: 'classic', size: 5, gap: 3, thickness: 1.6, color: '#6dff9a', opacity: 1, dot: false, dotSize: 2, outline: true, outlineThickness: 1, dynamic: true };
export const XH_STYLES = [['classic', 'Classic'], ['tstyle', 'T-Style'], ['dot', 'Dot'], ['circle', 'Ring']];

/** Draw a crosshair centred at (cx,cy). `s` = pixels per crosshair unit, `spread` = extra gap in units (dynamic). */
export function drawCrosshair(g, c, cx, cy, s = 1, spread = 0) {
  const gap = c.gap + (c.dynamic ? spread : 0), len = c.size, th = c.thickness, o = c.outline ? c.outlineThickness : 0;
  g.save(); g.globalAlpha = c.opacity ?? 1; g.translate(cx, cy);
  const rect = (x0, y0, w, hh, col) => { g.fillStyle = col; g.fillRect(Math.round(x0 * s * 2) / 2, Math.round(y0 * s * 2) / 2, w * s, hh * s); };
  const bar = (x0, y0, w, hh) => { if (o) rect(x0 - o, y0 - o, w + o * 2, hh + o * 2, 'rgba(0,0,0,.88)'); };
  const fill = (x0, y0, w, hh) => rect(x0, y0, w, hh, c.color);
  const parts = [];
  if (c.style === 'classic' || c.style === 'tstyle') {
    parts.push([-gap - len, -th / 2, len, th], [gap, -th / 2, len, th], [-th / 2, gap, th, len]);
    if (c.style === 'classic') parts.push([-th / 2, -gap - len, th, len]);
  }
  if (c.style === 'dot') parts.push([-c.dotSize / 2 - th / 2, -c.dotSize / 2 - th / 2, c.dotSize + th, c.dotSize + th]);
  if (c.dot && c.style !== 'dot') parts.push([-c.dotSize / 2, -c.dotSize / 2, c.dotSize, c.dotSize]);
  for (const p of parts) bar(...p);
  if (c.style === 'circle') {
    const r = (gap + len) * s; g.lineWidth = (th + o * 2) * s; g.strokeStyle = 'rgba(0,0,0,.88)'; if (o) { g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.stroke(); }
    g.lineWidth = th * s; g.strokeStyle = c.color; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.stroke();
  }
  for (const p of parts) fill(...p);
  g.restore();
}

// ---- share code: FT-XXXXX-XXXXX-... (Crockford base32 of a compact byte packing + checksum) ----
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function xhEncode(c) {
  const bytes = [
    XH_STYLES.findIndex((s) => s[0] === c.style) & 3, clamp(Math.round(c.size * 4), 0, 255), clamp(Math.round((c.gap + 10) * 4), 0, 255), clamp(Math.round(c.thickness * 8), 0, 255),
    ...[1, 3, 5].map((i) => parseInt(c.color.slice(i, i + 2), 16) || 0), clamp(Math.round(c.opacity * 100), 0, 100),
    (c.dot ? 1 : 0) | (c.outline ? 2 : 0) | (c.dynamic ? 4 : 0), clamp(Math.round(c.dotSize * 8), 0, 255), clamp(Math.round(c.outlineThickness * 8), 0, 255),
  ];
  let sum = 0; for (const b of bytes) sum = (sum * 31 + b) & 255; bytes.push(sum);
  let bits = 0, acc = 0, out = '';
  for (const b of bytes) { acc = (acc << 8) | b; bits += 8; while (bits >= 5) { out += B32[(acc >> (bits - 5)) & 31]; bits -= 5; } acc &= (1 << bits) - 1; }
  if (bits) out += B32[(acc << (5 - bits)) & 31];
  return 'FT-' + out.match(/.{1,5}/g).join('-');
}
export function xhDecode(str) {
  try {
    const t = String(str).toUpperCase().replace(/^FT-?/, '').replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    let bits = 0, acc = 0; const bytes = [];
    for (const ch of t) { const v = B32.indexOf(ch); if (v < 0) return null; acc = (acc << 5) | v; bits += 5; if (bits >= 8) { bytes.push((acc >> (bits - 8)) & 255); bits -= 8; acc &= (1 << bits) - 1; } }
    if (bytes.length < 14) return null;
    const b = bytes.slice(0, 14); let sum = 0; for (let i = 0; i < 13; i++) sum = (sum * 31 + b[i]) & 255; if (sum !== b[13]) return null;
    const hex = (n) => n.toString(16).padStart(2, '0');
    return { style: XH_STYLES[b[0] & 3][0], size: b[1] / 4, gap: b[2] / 4 - 10, thickness: b[3] / 8, color: '#' + hex(b[4]) + hex(b[5]) + hex(b[6]), opacity: clamp(b[7], 0, 100) / 100, dot: !!(b[8] & 1), outline: !!(b[8] & 2), dynamic: !!(b[8] & 4), dotSize: b[9] / 8, outlineThickness: b[10] / 8 };
  } catch { return null; }
}

// ---- preview backgrounds ----
function paintBg(g, w, h_, kind) {
  if (kind === 'light') {
    const gr = g.createLinearGradient(0, 0, 0, h_); gr.addColorStop(0, '#9fd0f5'); gr.addColorStop(.6, '#e8f0f8'); gr.addColorStop(1, '#d9c9a4'); g.fillStyle = gr; g.fillRect(0, 0, w, h_);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(w * .3, h_ * .25, w * .12, h_ * .05, 0, 0, 7); g.ellipse(w * .7, h_ * .18, w * .1, h_ * .04, 0, 0, 7); g.fill();
  } else if (kind === 'dark') {
    const gr = g.createLinearGradient(0, 0, 0, h_); gr.addColorStop(0, '#12161f'); gr.addColorStop(1, '#06080c'); g.fillStyle = gr; g.fillRect(0, 0, w, h_);
    g.fillStyle = 'rgba(255,255,255,.03)'; for (let i = 0; i < 9; i++) g.fillRect(i * w / 9, 0, 1, h_);
  } else if (kind === 'sand') {
    g.fillStyle = '#c8ad78'; g.fillRect(0, 0, w, h_); let a = 7; const r = () => (a = (a * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${90 + r() * 90 | 0},${70 + r() * 60 | 0},${40 + r() * 40 | 0},${.08 + r() * .14})`; g.fillRect(r() * w, r() * h_, 2 + r() * 8, 2 + r() * 5); }
    g.fillStyle = 'rgba(60,40,20,.25)'; g.fillRect(0, h_ * .55, w, h_ * .02);
  } else { // busy
    let a = 3; const r = () => (a = (a * 16807) % 2147483647) / 2147483647; const cols = ['#e8462f', '#2fd0ff', '#6dff9a', '#ffd25a', '#ff4dd2', '#ffffff', '#3050ff', '#111'];
    for (let i = 0; i < 90; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = .5 + r() * .5; const x = r() * w, y = r() * h_; g.save(); g.translate(x, y); g.rotate(r() * 3.14); g.fillRect(-10, -3, 20 + r() * 60, 3 + r() * 10); g.restore(); }
    g.globalAlpha = 1; g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 12; i++) g.fillRect(0, i * h_ / 12, w, 2);
  }
}

export function createCrosshairDesigner(ctx, kit, toast = () => {}) {
  const S = ctx.settings;
  const get = () => ({ ...XH_DEFAULT, ...(S.get('crosshair') || {}) });
  const put = (patch) => { S.set('crosshair', { ...get(), ...patch }); refreshAll(); };
  const refreshers = [];
  const reg = (c) => { refreshers.push(c.refresh); return c.el; };
  const refreshAll = () => { refreshers.forEach((f) => f()); codeIn.value = xhEncode(get()); };

  // preview
  const canvas = h('canvas'); const bgc = document.createElement('canvas'); bgc.width = 640; bgc.height = 480;
  const state = { bg: 'light', mode: 'standing', zoom: 4, t: 0, fireT: 99 };
  const bgBtns = [['light', 'Sky'], ['dark', 'Dark'], ['sand', 'Sand'], ['busy', 'Busy']].map(([k, l]) => h('button', { class: 'fx-btn sm ghost', onClick: () => { state.bg = k; paintBgNow(); mark(); } }, l));
  const modeBtns = [['standing', 'Standing'], ['moving', 'Moving'], ['firing', 'Firing'], ['both', 'Sprint+Fire']].map(([k, l]) => h('button', { class: 'fx-btn sm ghost', onClick: () => { state.mode = k; mark(); } }, l));
  const zoomBtns = [[2, '2×'], [4, '4×'], [6, '6×']].map(([k, l]) => h('button', { class: 'fx-btn sm ghost', onClick: () => { state.zoom = k; mark(); } }, l));
  const mark = () => { bgBtns.forEach((b, i) => b.classList.toggle('pri', ['light', 'dark', 'sand', 'busy'][i] === state.bg)); modeBtns.forEach((b, i) => b.classList.toggle('pri', ['standing', 'moving', 'firing', 'both'][i] === state.mode)); zoomBtns.forEach((b, i) => b.classList.toggle('pri', [2, 4, 6][i] === state.zoom)); };
  const paintBgNow = () => paintBg(bgc.getContext('2d'), 640, 480, state.bg);
  paintBgNow(); mark();
  let raf = 0, running = false;
  const frame = () => {
    if (!running) return; raf = requestAnimationFrame(frame);
    const rect = canvas.getBoundingClientRect(); const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(2, Math.round(rect.width * dpr)), hh = Math.max(2, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
    const g = canvas.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(bgc, 0, 0, w, hh);
    state.t += 1 / 60; state.fireT += 1 / 60; if ((state.mode === 'firing' || state.mode === 'both') && state.fireT > .55) state.fireT = 0;
    const mv = state.mode === 'moving' || state.mode === 'both' ? 1 : 0; const fr = state.mode === 'firing' || state.mode === 'both' ? Math.max(0, 1 - state.fireT * 2.4) : 0;
    const spread = mv * 4.5 + fr * 5 + (state.mode === 'moving' || state.mode === 'both' ? Math.sin(state.t * 6) * .4 : 0);
    const s = state.zoom * (w / 960) * 1.6; // preview px per unit
    drawCrosshair(g, get(), w / 2, hh / 2, s, spread);
  };
  const view = h('div', { class: 'fx-xh-view' }, canvas, h('span', { class: 'cap' }, 'Live preview'));

  // controls
  const C = kit;
  const rows = [];
  const styleP = C.pills(XH_STYLES, { get: () => get().style, set: (v) => put({ style: v }) });
  const size = C.slider({ min: 0, max: 20, step: .5, def: 5, get: () => get().size, set: (v) => put({ size: v }), fmt: (v) => v.toFixed(1), label: 'Length' });
  const gap = C.slider({ min: -5, max: 15, step: .5, def: 3, get: () => get().gap, set: (v) => put({ gap: v }), fmt: (v) => v.toFixed(1), label: 'Gap' });
  const thick = C.slider({ min: .5, max: 6, step: .1, def: 1.6, get: () => get().thickness, set: (v) => put({ thickness: v }), fmt: (v) => v.toFixed(1), label: 'Thickness' });
  const opac = C.slider({ min: .1, max: 1, step: .05, def: 1, get: () => get().opacity, set: (v) => put({ opacity: v }), fmt: (v) => Math.round(v * 100), unit: '%', label: 'Opacity' });
  const dot = C.toggle({ get: () => get().dot, set: (v) => put({ dot: v }), label: 'Centre dot' });
  const dotSize = C.slider({ min: 1, max: 6, step: .5, def: 2, get: () => get().dotSize, set: (v) => put({ dotSize: v }), fmt: (v) => v.toFixed(1), label: 'Dot size' });
  const outl = C.toggle({ get: () => get().outline, set: (v) => put({ outline: v }), label: 'Outline' });
  const outlT = C.slider({ min: .5, max: 3, step: .5, def: 1, get: () => get().outlineThickness, set: (v) => put({ outlineThickness: v }), fmt: (v) => v.toFixed(1), label: 'Outline thickness' });
  const dyn = C.toggle({ get: () => get().dynamic, set: (v) => put({ dynamic: v }), label: 'Dynamic' });
  const swatches = ['#6dff9a', '#ffffff', '#2fd0ff', '#ffe14d', '#ff7a2f', '#ff4dd2', '#ff3b3b'];
  const swWrap = h('div', { class: 'fx-sw' }, swatches.map((c) => h('button', { style: { '--c': c }, 'aria-label': c, onClick: () => put({ color: c }) })));
  const hue = h('input', { type: 'range', class: 'fx-hue', min: 0, max: 359, step: 1, 'aria-label': 'Hue' });
  const hex = h('input', { class: 'fx-num', type: 'text', maxlength: 7, style: { width: '6.6rem', textTransform: 'uppercase' } });
  const hsl2hex = (H) => { const l = .6, a = Math.min(l, 1 - l); const f = (n) => { const k = (n + H / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); };
  hue.addEventListener('input', () => put({ color: hsl2hex(+hue.value) }));
  hex.addEventListener('focus', () => { ctx.input.captureKeys = true; }); hex.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') hex.blur(); });
  hex.addEventListener('change', () => { let v = hex.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) put({ color: v.toLowerCase() }); else hex.value = get().color; });
  const colorCtl = { refresh() { const c = get().color; hex.value = c; [...swWrap.children].forEach((b, i) => b.classList.toggle('on', swatches[i] === c)); } };
  refreshers.push(colorCtl.refresh);
  const codeIn = h('input', { spellcheck: 'false', 'aria-label': 'Crosshair code' });
  codeIn.addEventListener('focus', () => { ctx.input.captureKeys = true; codeIn.select(); }); codeIn.addEventListener('keydown', (e) => e.stopPropagation());
  const say = toast;
  const doImport = (txt) => { const d = xhDecode(txt); if (!d) { say('Invalid crosshair code'); codeIn.classList.add('bad'); return; } put(d); say('Crosshair imported'); };
  codeIn.addEventListener('change', () => doImport(codeIn.value));
  const copyBtn = h('button', { class: 'fx-btn sm', onClick: async () => { try { await navigator.clipboard.writeText(codeIn.value); say('Code copied'); } catch { codeIn.select(); document.execCommand?.('copy'); say('Code selected — copy it'); } } }, 'Copy');
  const pasteBtn = h('button', { class: 'fx-btn sm', onClick: async () => { try { doImport(await navigator.clipboard.readText()); } catch { codeIn.focus(); say('Paste the code, then press Enter'); } } }, 'Paste');
  const R = (l, d, ctl, o) => C.row(l, d, ctl, o);
  const left = h('div', null,
    C.group('Style', R('Shape', null, reg(styleP)), R('Colour', null, h('div', { style: { display: 'flex', flexDirection: 'column', gap: '.6rem', alignItems: 'stretch', flex: 1 } }, swWrap, h('div', { style: { display: 'flex', gap: '.8rem', alignItems: 'center' } }, hue, hex)), { tall: true }), R('Opacity', null, reg(opac))),
    C.group('Geometry', R('Length', null, reg(size)), R('Gap', 'Distance from centre', reg(gap)), R('Thickness', null, reg(thick))),
    C.group('Extras', R('Centre dot', null, reg(dot)), R('Dot size', null, reg(dotSize)), R('Outline', 'Improves contrast on bright maps', reg(outl)), R('Outline width', null, reg(outlT)), R('Dynamic spread', 'Widens when moving & firing', reg(dyn))));
  const right = h('div', { class: 'fx-xh-prev' }, view,
    h('div', { class: 'fx-xh-bg' }, ...bgBtns, h('span', { style: { flex: 1 } }), ...zoomBtns),
    h('div', { class: 'fx-xh-bg' }, ...modeBtns),
    h('div', { class: 'fx-lab', style: { marginTop: '1.3rem' } }, 'Share code', h('em', null, 'Import / export')),
    h('div', { class: 'fx-code' }, codeIn, copyBtn, pasteBtn),
    h('div', { style: { marginTop: '.9rem', display: 'flex', gap: '.5rem' } }, h('button', { class: 'fx-btn sm ghost', onClick: () => put({ ...XH_DEFAULT }) }, 'Reset crosshair'), h('button', { class: 'fx-btn sm ghost', onClick: () => put({ style: 'classic', size: 4, gap: 2, thickness: 1, color: '#ffffff', dot: false, outline: true, dynamic: false, opacity: 1 }) }, 'Preset: Pro white')));
  const el = h('div', { class: 'fx-xh' }, left, right);
  refreshAll();
  return { el, refresh: refreshAll, start() { if (running) return; running = true; state.t = 0; frame(); }, stop() { running = false; cancelAnimationFrame(raf); } };
}
